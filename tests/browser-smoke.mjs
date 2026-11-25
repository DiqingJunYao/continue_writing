import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";
import { buildApp } from "../server/index.js";
import { createPool, migrate, one, rows, writeTransaction } from "../server/db.js";
import { seed } from "../server/seed.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test")) {
  throw new Error("Set TEST_DATABASE_URL to a dedicated MySQL database ending in _test.");
}
const pool = createPool({ DATABASE_URL: databaseUrl });
const port = Number(process.env.TEST_PORT || 4179);
const origin = `http://127.0.0.1:${port}`;
const subject = randomUUID();
const providerForTest = (name) => ({
  start({ redirectUri, state }) {
    const callback = new URL(redirectUri);
    callback.search = new URLSearchParams({ state, code: "browser-test" });
    return callback;
  },
  identity({ callbackUrl }) {
    assert.equal(callbackUrl.searchParams.get("code"), "browser-test");
    return { subject, name: `Browser ${name} Writer` };
  },
});
let server;
let browser;
let page;
let schemaReady = false;
const browserErrors = [];

async function completeOAuth(provider) {
  await page.locator(`[data-oauth="${provider}"]`).click();
  await page.locator('[data-action="user-menu"]').waitFor({ state: "visible", timeout: 20_000 });
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
  await migrate(pool);
  schemaReady = true;
  await seed(pool);
  server = await buildApp({
    pool,
    env: { PUBLIC_ORIGIN: origin },
    providers: { google: providerForTest("Google"), facebook: providerForTest("Facebook") },
  });
  await server.listen({ port, host: "127.0.0.1" });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/snap/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  page = await context.newPage();
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "request failed";
    // A successful popup closes while its document is still settling.
    if (failure === "net::ERR_ABORTED" && request.isNavigationRequest()) return;
    browserErrors.push(`request: ${request.url()} (${failure})`);
  });
  await page.goto(`${origin}/#story/seed_lightkeeper`, { waitUntil: "networkidle" });
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
  await completeOAuth("google");

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
  const unsavedBeforeSessionRefresh = await page.locator("#story-editor").evaluate((form) => ({
    title: form.elements.title.value,
    deck: form.elements.deck.value,
    body: form.elements.body.value
  }));
  await page.evaluate(async () => {
    const client = await import("./backend-client.js");
    await client.refreshSession();
  });
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#story-editor").count(), 1, "same-user session refresh must preserve the editor");
  assert.deepEqual(
    await page.locator("#story-editor").evaluate((form) => ({
      title: form.elements.title.value,
      deck: form.elements.deck.value,
      body: form.elements.body.value
    })),
    unsavedBeforeSessionRefresh,
    "same-user session refresh must preserve unsaved writing"
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

  await page.goto(`${origin}/#profile`, { waitUntil: "networkidle" });
  await page.locator(".story-list-card").filter({ hasText: "Browser Continuation" }).waitFor({ state: "visible" });
  await assertNoSeriousAccessibilityViolations("member profile");
  await signOutFromUi();

  await page.locator('header [data-action="sign-in"]').click();
  await page.locator("#app-dialog[open]").waitFor({ state: "visible" });
  await completeOAuth("facebook");
  assert.match(await page.locator("header").textContent(), /My stories/i);
  await page.locator('header a[href="#profile"]').click();
  await page.locator('main [data-action="account-data"]').click();
  await page.locator('#app-dialog [data-action="delete-account"]').click();
  await page.locator('header [data-action="sign-in"]').waitFor({ state: "visible", timeout: 20_000 });
  assert.equal(await one(pool, "SELECT userId FROM oauthAccounts WHERE provider = 'facebook' AND subject = ?", [subject]), null);

  await page.goto(`${origin}/#write/start`, { waitUntil: "networkidle" });
  await page.locator(".auth-wall").waitFor({ state: "visible" });
  assert.match(await page.locator("main").textContent(), /Sign in with Google or Facebook/i);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/#story`, { waitUntil: "networkidle" });
  await page.locator("#story-card").waitFor({ state: "visible" });
  const mobileLayout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  assert(mobileLayout.scrollWidth <= mobileLayout.clientWidth + 1, `mobile page overflows: ${JSON.stringify(mobileLayout)}`);
  await assertNoSeriousAccessibilityViolations("mobile guest reader");

  assert.deepEqual(browserErrors, [], browserErrors.join("\n"));
  console.log("Branchline Fastify/MySQL browser smoke passed");
} finally {
  try {
    await browser?.close();
    await server?.close();
    if (schemaReady) {
      await writeTransaction(pool, async (db) => {
        const accounts = await rows(db, "SELECT userId FROM oauthAccounts WHERE subject = ? AND provider IN ('google', 'facebook')", [subject]);
        for (const { userId } of accounts) {
          await rows(db, "DELETE FROM stories WHERE authorId = ?", [userId]);
          await rows(db, "DELETE FROM users WHERE id = ?", [userId]);
        }
      });
    }
  } finally {
    await pool.end();
  }
}
