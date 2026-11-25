import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { buildApp } from "../server/index.js";
import { createPool, migrate, one, rows, writeTransaction } from "../server/db.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !decodeURIComponent(new URL(databaseUrl).pathname.slice(1)).endsWith("_test")) {
  throw new Error("The integration test database name must end in _test.");
}
const pool = databaseUrl ? createPool({ ...process.env, DATABASE_URL: databaseUrl }) : null;
const skip = pool ? false : "Set TEST_DATABASE_URL to a dedicated MySQL database ending in _test.";

before(async () => {
  if (pool) await migrate(pool);
});
after(async () => {
  if (pool) await pool.end();
});

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function getCookie(response, name) {
  return [response.headers["set-cookie"]].flat().find((cookie) => cookie?.startsWith(`${name}=`));
}

function cookiePair(cookie) {
  return cookie.split(";", 1)[0];
}

async function fixture(t, { secure = false, beforeIdentity = async () => {} } = {}) {
  const origin = secure ? "https://branchline.example.test" : "http://127.0.0.1:4173";
  const prefix = secure ? "__Host-branchline-" : "branchline-";
  const subject = `auth-test-${randomUUID()}`;
  const knownFlows = new Map();

  function provider(name) {
    return {
      start({ redirectUri, state, nonce, verifier, mode }) {
        knownFlows.set(state, { state, nonce, verifier, mode });
        assert.equal(redirectUri, `${origin}/api/auth/${name}/callback`);
        const authorizationUrl = new URL(`https://provider.example.test/${name}`);
        authorizationUrl.searchParams.set("state", state);
        return authorizationUrl;
      },
      async identity({ callbackUrl, state, nonce, verifier, mode }) {
        assert.deepEqual({ state, nonce, verifier, mode }, knownFlows.get(state));
        assert.equal(callbackUrl.origin, origin);
        await beforeIdentity(mode);
        const code = callbackUrl.searchParams.get("code");
        assert(code.startsWith(subject));
        return { subject: code, name: "Branchline Test Writer" };
      },
    };
  }

  const app = await buildApp({
    pool,
    env: { PUBLIC_ORIGIN: origin, NODE_ENV: "test" },
    providers: { google: provider("google"), facebook: provider("facebook") },
  });
  t.after(async () => {
    await app.close();
    await writeTransaction(pool, async (db) => {
      const accounts = await rows(db, "SELECT userId FROM oauthAccounts WHERE subject LIKE ?", [`${subject}%`]);
      for (const { userId } of accounts) {
        await rows(db, "DELETE FROM users WHERE id = ?", [userId]);
      }
      for (const state of knownFlows.keys()) {
        await rows(db, "DELETE FROM oauthFlows WHERE stateHash = ?", [hash(state)]);
      }
    });
  });

  async function start(providerName, mode = "signin", sessionCookie = null) {
    const response = await app.inject({
      url: `/api/auth/${providerName}/start?mode=${mode}`,
      headers: sessionCookie ? { cookie: sessionCookie } : {},
    });
    assert.equal(response.statusCode, 302, response.body);
    const state = new URL(response.headers.location).searchParams.get("state");
    const flowCookie = getCookie(response, `${prefix}oauth-${state}`);
    assert.match(flowCookie, /HttpOnly.*SameSite=Lax/i);
    if (secure) assert.match(flowCookie, /; Secure\b/i);
    return { providerName, state, flowCookie: cookiePair(flowCookie), sessionCookie };
  }

  function callback(flow, code = subject) {
    const { providerName, state, flowCookie, sessionCookie } = flow;
    const query = new URLSearchParams({ state, code });
    return app.inject({
      url: `/api/auth/${providerName}/callback?${query}`,
      headers: { cookie: [flowCookie, sessionCookie].filter(Boolean).join("; ") },
    });
  }

  async function session(sessionCookie) {
    const response = await app.inject({
      url: "/api/session",
      headers: sessionCookie ? { cookie: sessionCookie } : {},
    });
    assert.equal(response.statusCode, 200);
    return response.json();
  }

  function accepted(response) {
    assert.match(response.body, /"type":"branchline-auth","ok":true/);
    return getCookie(response, `${prefix}session`);
  }

  return { app, origin, subject, start, callback, session, accepted };
}

test("OAuth state is provider-bound, browser-bound and single use", { skip }, async (t) => {
  const { subject, start, callback, session, accepted } = await fixture(t);
  assert.deepEqual(await session(), { user: null, providers: ["google", "facebook"] });
  const flow = await start("google");
  const other = await start("google");
  for (const invalid of [
    { ...flow, flowCookie: null },
    { ...flow, flowCookie: other.flowCookie },
    { ...flow, flowCookie: `${flow.flowCookie.split("=")[0]}=${other.flowCookie.split("=")[1]}` },
    { ...flow, providerName: "facebook" },
  ]) {
    assert.match((await callback(invalid)).body, /"ok":false/);
  }
  assert.equal(await one(pool, "SELECT userId FROM oauthAccounts WHERE subject = ?", [subject]), null);
  const response = await callback(flow);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.headers["content-security-policy"], /script-src 'nonce-/);
  const cookie = accepted(response);
  assert.match(cookie, /HttpOnly.*SameSite=Lax/i);
  assert.equal((await session(cookiePair(cookie))).user.provider, "google");
  assert.match((await callback(flow)).body, /"ok":false/);
});

test("concurrent Facebook signups share one account and use secure session cookies", { skip }, async (t) => {
  const { subject, start, callback, session, accepted } = await fixture(t, { secure: true });
  const flows = await Promise.all([start("facebook"), start("facebook")]);
  const results = await Promise.all(flows.map((flow) => callback(flow)));
  const sessions = await Promise.all(results.map((response) => {
    const cookie = accepted(response);
    assert.match(cookie, /^__Host-branchline-session=/);
    assert.match(cookie, /; Secure\b/i);
    assert.match(cookie, /HttpOnly.*SameSite=Lax/i);
    return session(cookiePair(cookie));
  }));
  assert.equal(sessions[0].user.provider, "facebook");
  assert.equal(sessions[0].user.uid, sessions[1].user.uid);
  const account = await one(pool, "SELECT userId FROM oauthAccounts WHERE provider = 'facebook' AND subject = ?", [subject]);
  assert.equal(account.userId, sessions[0].user.uid);
  const stored = await rows(pool, "SELECT tokenHash FROM sessions WHERE userId = ?", [account.userId]);
  const expectedHashes = results.map((response) => hash(cookiePair(accepted(response)).split("=")[1]));
  assert.deepEqual(new Set(stored.map((row) => row.tokenHash)), new Set(expectedHashes));
});

test("reauthentication matches the account and revokes the old session", { skip }, async (t) => {
  const { app, origin, subject, start, callback, session, accepted } = await fixture(t);
  const initialCookie = cookiePair(accepted(await callback(await start("google"))));
  const original = (await session(initialCookie)).user;
  await rows(pool, "UPDATE sessions SET authAt = '2000-01-01' WHERE userId = ?", [original.uid]);
  const wrongAccount = await callback(await start("google", "reauth", initialCookie), `${subject}-wrong`);
  assert.match(wrongAccount.body, /"ok":false/);
  assert.equal((await session(initialCookie)).user.uid, original.uid);
  assert.equal(await one(pool, "SELECT userId FROM oauthAccounts WHERE subject = ?", [`${subject}-wrong`]), null);
  const renewedCookie = cookiePair(accepted(await callback(await start("google", "reauth", initialCookie))));
  assert.notEqual(renewedCookie, initialCookie);
  assert.equal((await session(initialCookie)).user, null);
  assert.equal((await session(renewedCookie)).user.uid, original.uid);
  assert.equal(Number((await one(pool, "SELECT authAt > '2000-01-01' AS recent FROM sessions WHERE userId = ?", [original.uid])).recent), 1);

  const logout = (expectedUser, requestOrigin = origin) => app.inject({
    method: "POST",
    url: "/api/auth/signout",
    headers: { cookie: renewedCookie, origin: requestOrigin, "x-branchline-user": expectedUser },
  });
  assert.equal((await logout(original.uid, "https://cross-origin.example.test")).statusCode, 403);
  assert.equal((await logout(randomUUID())).statusCode, 401);
  assert.equal((await session(renewedCookie)).user.uid, original.uid);
  assert.equal((await logout(original.uid)).statusCode, 204);
  assert.equal((await session(renewedCookie)).user, null);
});

test("account deletion wins over an in-flight reauthentication", { skip }, async (t) => {
  const entered = Promise.withResolvers();
  const proceed = Promise.withResolvers();
  const { app, origin, subject, start, callback, session, accepted } = await fixture(t, {
    async beforeIdentity(mode) {
      if (mode === "reauth") {
        entered.resolve();
        await proceed.promise;
      }
    },
  });
  const cookie = cookiePair(accepted(await callback(await start("facebook"))));
  const user = (await session(cookie)).user;
  const pending = callback(await start("facebook", "reauth", cookie));
  try {
    await Promise.race([entered.promise, pending.then(() => assert.fail("Reauthentication did not reach the provider."))]);
    const deletion = await app.inject({
      method: "POST",
      url: "/api/actions/deleteAccount",
      headers: { cookie, origin, "x-branchline-user": user.uid },
      payload: {},
    });
    assert.equal(deletion.statusCode, 200, deletion.body);
  } finally {
    proceed.resolve();
  }
  assert.match((await pending).body, /"ok":false/);
  assert.equal((await session(cookie)).user, null);
  assert.equal(await one(pool, "SELECT userId FROM oauthAccounts WHERE subject = ?", [subject]), null);
});
