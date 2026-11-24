import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const workspace = fileURLToPath(new URL("..", import.meta.url));
const staticRoot = join(workspace, "dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  const requestPath = new URL(request.url || "/", "http://127.0.0.1").pathname;
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const normalizedPath = normalize(relativePath);
  if (normalizedPath.startsWith("..")) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  const filePath = join(staticRoot, normalizedPath);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/snap/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

const context = await browser.newContext({ reducedMotion: "reduce" });
const page = await context.newPage();
const browserErrors = [];
page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
});
page.on("requestfailed", (request) => {
  const failure = request.failure()?.errorText || "request failed";
  browserErrors.push(`request: ${request.url()} (${failure})`);
});

async function completeEmulatedOAuth(provider, email, displayName) {
  const providerLabel = provider === "facebook" ? "Facebook.com" : "Google.com";
  const popupPromise = page.waitForEvent("popup");
  await page.locator(`[data-oauth="${provider}"]`).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await popup.getByRole("button", { name: /Add new account/i }).click();
  const inputs = popup.locator("input");
  await inputs.nth(0).fill(email);
  await inputs.nth(1).fill(displayName);
  await inputs.nth(2).fill(displayName.toLowerCase().replace(/[^a-z0-9]+/g, ""));
  await popup.getByRole("button", { name: `Sign in with ${providerLabel}`, exact: true }).click();
  await popup.waitForEvent("close");
  await page.locator('[data-action="user-menu"]').waitFor({ state: "visible", timeout: 20_000 });
}

async function completeEmulatedReauthentication(trigger, email) {
  const popupPromise = page.waitForEvent("popup");
  await trigger();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await popup.locator(".js-reuse-account").filter({ hasText: email }).click();
  await popup.waitForEvent("close");
}

async function signOutFromUi() {
  await page.locator('[data-action="user-menu"]').click();
  await page.locator('#app-dialog [data-action="sign-out"]').click();
  await page.locator('header [data-action="sign-in"]').waitFor({ state: "visible", timeout: 20_000 });
}

async function assertNoSeriousAccessibilityViolations(label) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const violations = results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(" "))
    }));
  assert.deepEqual(violations, [], `${label}: ${JSON.stringify(violations)}`);
}

try {
  await page.goto(`${origin}/?emulators=1#story`, { waitUntil: "networkidle" });
  await page.locator("#story-card").waitFor({ state: "visible", timeout: 20_000 });

  const title = await page.locator("#story-title").textContent();
  assert(title?.trim(), "a seeded story title should render");
  assert.match(
    (await page.locator('[data-action="open-comments"]').textContent()) || "",
    /1/,
    "an unopened story must use its persisted comment counter"
  );
  assert.equal(await page.locator(".root-card").count(), 2, "both independent root stories should render");
  assert.equal(await page.locator('[data-story-nav="left"]:not([disabled])').count(), 0, "independent roots are not alternate versions");
  assert.equal(await page.locator('[data-story-nav="right"]:not([disabled])').count(), 0, "independent roots are not alternate versions");
  await assertNoSeriousAccessibilityViolations("guest reader");

  await page.locator("#story-card").focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForURL(/#story\/seed_signal$/);
  assert.equal((await page.locator("#story-title").textContent())?.trim(), "A Signal in the Fog");
  await page.locator("#story-card").focus();
  await page.keyboard.press("ArrowUp");
  await page.locator("#story-title").filter({ hasText: title.trim() }).waitFor({ state: "visible" });

  await page.locator('[data-action="open-comments"]').click();
  await page.locator("#comments-dialog[open]").waitFor({ state: "visible" });
  assert.match(await page.locator("#comments-dialog").textContent(), /Sign in to join/i);
  await page.locator('[data-action="close-comments"]').click();

  await page.locator('[data-action="continue-story"]').first().click();
  await page.locator("#app-dialog[open]").waitFor({ state: "visible" });
  assert.match(await page.locator("#app-dialog").textContent(), /Continue with Google/i);
  assert.match(await page.locator("#app-dialog").textContent(), /Continue with Facebook/i);
  await completeEmulatedOAuth("google", "browser-google@example.test", "Browser Google Writer");

  await page.locator("#story-editor").waitFor({ state: "visible", timeout: 20_000 });
  assert.match(await page.locator(".reference-panel").textContent(), new RegExp(title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await page.locator("#story-title-input").fill("Browser Continuation");
  await page.locator("#story-deck-input").fill("A continuation created through the complete browser flow.");
  await page.locator("#story-body-input").fill("We go to a new sea at dawn.");
  assert.equal(
    await page.locator("#story-editor").evaluate((form) => form.checkValidity()),
    true,
    "the native form must accept a short chapter that satisfies the eight-word rule"
  );
  await page.locator("#story-body-input").fill("The browser writer opened another door and followed the quiet light into a future no one had named before.");
  const unsavedBeforeTokenRefresh = await page.locator("#story-editor").evaluate((form) => ({
    title: form.elements.title.value,
    deck: form.elements.deck.value,
    body: form.elements.body.value
  }));
  await page.evaluate(async () => {
    const client = await import("./firebase-client.js");
    await client.currentFirebaseUser().getIdToken(true);
  });
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#story-editor").count(), 1, "same-user token refresh must preserve the editor");
  assert.deepEqual(
    await page.locator("#story-editor").evaluate((form) => ({
      title: form.elements.title.value,
      deck: form.elements.deck.value,
      body: form.elements.body.value
    })),
    unsavedBeforeTokenRefresh,
    "same-user token refresh must preserve unsaved writing"
  );
  const editorState = await page.locator("#story-editor").evaluate((form) => ({
    valid: form.checkValidity(),
    mode: form.dataset.mode,
    storyId: form.dataset.storyId,
    submitDisabled: form.querySelector('button[type="submit"]')?.disabled || false
  }));
  assert.equal(editorState.valid, true, JSON.stringify(editorState));
  await page.locator("#story-editor button[type=submit]").click();
  try {
    await page.locator("#story-title").filter({ hasText: "Browser Continuation" }).waitFor({ state: "visible", timeout: 20_000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      hash: location.hash,
      main: document.querySelector("main")?.innerText.slice(0, 1500),
      toasts: [...document.querySelectorAll(".toast")].map((item) => item.innerText),
      formPresent: Boolean(document.querySelector("#story-editor"))
    }));
    throw new Error(`Continuation was not published: ${JSON.stringify({ editorState, diagnostic })}`, { cause: error });
  }

  await page.locator('[data-action="like-story"]').click();
  await page.locator('[data-action="like-story"][aria-pressed="true"]').waitFor({ state: "visible", timeout: 20_000 });
  await page.locator('[data-action="open-comments"]').click();
  await page.locator("#comment-text").fill("This comment was saved by the shared backend.");
  await page.locator("#comment-form button[type=submit]").click();
  const savedComment = page.locator("#comments-dialog .comment-row").filter({ hasText: "This comment was saved" });
  await savedComment.locator(".comment-text").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator("#comment-text").fill("An unfinished comment that should survive a reply action.");
  await savedComment.locator("[data-comment-reply]").click();
  assert.equal(
    await page.locator("#comment-text").inputValue(),
    "An unfinished comment that should survive a reply action.",
    "opening a reply must preserve the comment draft"
  );
  await page.locator(".inline-reply-form textarea").fill("An unfinished reply that should survive the same action.");
  await savedComment.locator("[data-comment-reply]").click();
  assert.equal(
    await page.locator(".inline-reply-form textarea").inputValue(),
    "An unfinished reply that should survive the same action.",
    "rebuilding the thread must preserve the reply draft"
  );
  await page.locator('[data-action="close-comments"]').click();

  await page.goto(`${origin}/?emulators=1#profile`, { waitUntil: "networkidle" });
  await page.locator(".story-list-card").filter({ hasText: "Browser Continuation" }).waitFor({ state: "visible" });
  await assertNoSeriousAccessibilityViolations("member profile");
  await signOutFromUi();

  await page.locator('header [data-action="sign-in"]').click();
  await page.locator("#app-dialog[open]").waitFor({ state: "visible" });
  await completeEmulatedOAuth("facebook", "browser-facebook@example.test", "Browser Facebook Writer");
  assert.match(await page.locator("header").textContent(), /My stories/i);
  await page.locator('header a[href="#profile"]').click();
  await page.locator('main [data-action="account-data"]').click();
  await completeEmulatedReauthentication(
    () => page.locator('#app-dialog [data-action="delete-account"]').click(),
    "browser-facebook@example.test"
  );
  await page.locator('header [data-action="sign-in"]').waitFor({ state: "visible", timeout: 20_000 });

  await page.goto(`${origin}/?emulators=1#write/start`, { waitUntil: "networkidle" });
  await page.locator(".auth-wall").waitFor({ state: "visible" });
  assert.match(await page.locator("main").textContent(), /Sign in with Google or Facebook/i);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/?emulators=1#story`, { waitUntil: "networkidle" });
  await page.locator("#story-card").waitFor({ state: "visible" });
  const mobileLayout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  assert(mobileLayout.scrollWidth <= mobileLayout.clientWidth + 1, `mobile page overflows: ${JSON.stringify(mobileLayout)}`);
  await assertNoSeriousAccessibilityViolations("mobile guest reader");

  assert.deepEqual(browserErrors, [], browserErrors.join("\n"));
  console.log("Branchline browser emulator smoke passed");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
