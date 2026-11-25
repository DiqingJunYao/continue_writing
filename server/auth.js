import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import * as oidc from "openid-client";
import { one, rows, writeTransaction } from "./db.js";
import { AppError, cleanProfileInput } from "./model.js";

const FLOW_SECONDS = 600;
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

function randomToken() {
  return randomBytes(32).toString("base64url");
}

function hash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieName(name, secure) {
  return `${secure ? "__Host-" : ""}branchline-${name}`;
}

function cookieOptions(secure) {
  return { httpOnly: true, sameSite: "lax", path: "/", secure };
}

function cookieHash(request, name, secure) {
  const token = request.cookies[cookieName(name, secure)];
  return typeof token === "string" && OPAQUE_TOKEN.test(token) ? hash(token) : null;
}

export function clearSessionCookie(reply, secureCookies) {
  reply.clearCookie(cookieName("session", secureCookies), cookieOptions(secureCookies));
}

export async function loadSession(db, request, secureCookies) {
  const tokenHash = cookieHash(request, "session", secureCookies);
  if (!tokenHash) return null;

  const user = await one(db, `
    SELECT u.*, s.provider, s.authAt, (a.adminId = u.id) AS isAdmin
    FROM sessions AS s
    JOIN users AS u ON u.id = s.userId
    JOIN app_state AS a ON a.id = 1
    WHERE s.tokenHash = ? AND s.expiresAt > UTC_TIMESTAMP(3)
  `, [tokenHash]);
  if (!user) return null;
  return { ...user, isAdmin: Boolean(user.isAdmin) };
}

function googleProvider(clientId, clientSecret) {
  let configuration;
  function config() {
    configuration ??= oidc.discovery(
      new URL("https://accounts.google.com"),
      clientId,
      clientSecret,
      oidc.ClientSecretPost(clientSecret),
      { execute: [oidc.enableNonRepudiationChecks], timeout: 10 },
    ).catch((error) => {
      configuration = null;
      throw error;
    });
    return configuration;
  }

  return {
    async start({ redirectUri, state, verifier, nonce }) {
      return oidc.buildAuthorizationUrl(await config(), {
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile",
        prompt: "select_account",
        state,
        nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
      });
    },
    async identity({ callbackUrl, state, verifier, nonce }) {
      const result = await oidc.authorizationCodeGrant(await config(), callbackUrl, {
        expectedState: state,
        expectedNonce: nonce,
        pkceCodeVerifier: verifier,
        idTokenExpected: true,
      });
      const claims = result.claims();
      return { subject: claims?.sub, name: claims?.name, picture: claims?.picture };
    },
  };
}

function facebookProvider(appId, appSecret, graphVersion) {
  if (!/^v\d{1,3}\.\d+$/.test(graphVersion)) {
    throw new Error("FACEBOOK_GRAPH_VERSION must look like v27.0.");
  }
  const graphBase = `https://graph.facebook.com/${graphVersion}/`;

  async function graph(path, query, accessToken) {
    const url = new URL(path, graphBase);
    url.search = new URLSearchParams(query);
    const headers = { accept: "application/json" };
    if (accessToken) {
      headers.authorization = `Bearer ${accessToken}`;
      const proof = createHmac("sha256", appSecret).update(accessToken).digest("hex");
      url.searchParams.set("appsecret_proof", proof);
    }
    const response = await fetch(url, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Facebook could not verify this sign-in.");
    return response.json();
  }

  return {
    start({ redirectUri, state, mode }) {
      const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
      url.search = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "public_profile",
        state,
      });
      if (mode === "reauth") url.searchParams.set("auth_type", "reauthenticate");
      return url;
    },
    async identity({ callbackUrl, redirectUri }) {
      const token = await graph("oauth/access_token", {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code: callbackUrl.searchParams.get("code"),
      });
      const accessToken = token.access_token;
      if (typeof accessToken !== "string" || !accessToken) {
        throw new Error("Facebook did not return an access token.");
      }
      const { data: inspected } = await graph("debug_token", {
        input_token: accessToken,
      }, `${appId}|${appSecret}`);
      if (
        inspected?.is_valid !== true || String(inspected.app_id) !== appId ||
        inspected.type !== "USER" || typeof inspected.user_id !== "string"
      ) {
        throw new Error("Facebook issued an access token for a different app or account type.");
      }
      const profile = await graph("me", { fields: "id,name,picture" }, accessToken);
      if (profile.id !== inspected.user_id) {
        throw new Error("Facebook returned inconsistent account information.");
      }
      return { subject: profile.id, name: profile.name, picture: profile.picture?.data?.url };
    },
  };
}

function configuredProviders(env) {
  const providers = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = googleProvider(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  }
  if (env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
    providers.facebook = facebookProvider(
      env.FACEBOOK_APP_ID,
      env.FACEBOOK_APP_SECRET,
      env.FACEBOOK_GRAPH_VERSION || "v27.0",
    );
  }
  return providers;
}

function popupResult(reply, origin, ok, message = "Sign-in could not be completed. Please try again.") {
  const nonce = randomToken();
  const result = JSON.stringify(ok
    ? { type: "branchline-auth", ok: true }
    : { type: "branchline-auth", ok: false, message }).replaceAll("<", "\\u003c");
  reply.header("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`);
  reply.header("Cross-Origin-Opener-Policy", "unsafe-none");
  reply.header("Referrer-Policy", "no-referrer");
  return reply.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Branchline sign-in</title>
<p>${ok ? "Sign-in completed." : "Sign-in could not be completed."}</p>
<p><a href="/">Return to Branchline</a></p>
<script nonce="${nonce}">
  if (window.opener) {
    window.opener.postMessage(${result}, ${JSON.stringify(origin)});
    window.close();
  }
</script></html>`);
}

function identitySubject(identity) {
  const subject = identity?.subject;
  if (typeof subject !== "string" || !/^[!-~]{1,255}$/.test(subject)) {
    throw new Error("The provider did not return a valid account identifier.");
  }
  return subject;
}

async function createUser(db, provider, subject, identity) {
  const name = typeof identity.name === "string" ? identity.name.trim().slice(0, 80) : "";
  const picture = typeof identity.picture === "string" ? identity.picture : "";
  const profile = cleanProfileInput({}, { name, picture });
  const userId = randomUUID();
  await rows(db, `
    INSERT INTO users (id, name, handle, initials, tone, bio, avatarUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [userId, profile.name, profile.handle, profile.initials, profile.tone, profile.bio, profile.avatarUrl]);
  await rows(db, "INSERT INTO oauthAccounts (provider, subject, userId) VALUES (?, ?, ?)", [provider, subject, userId]);
  return userId;
}

export function registerAuth(app, { pool, origin, secureCookies, env = process.env, providers = configuredProviders(env) }) {
  const enabled = ["google", "facebook"].filter((provider) => providers[provider]);
  const redirectUri = (provider) => `${origin}/api/auth/${provider}/callback`;

  app.get("/api/session", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const user = await loadSession(pool, request, secureCookies);
    return {
      providers: enabled,
      user: user ? { uid: user.id, displayName: user.name, photoURL: user.avatarUrl, provider: user.provider } : null,
    };
  });

  app.post("/api/auth/signout", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const tokenHash = cookieHash(request, "session", secureCookies);
    const expectedUser = request.headers["x-branchline-user"];
    if (tokenHash || expectedUser !== undefined) {
      await writeTransaction(pool, async (db) => {
        if (expectedUser !== undefined) {
          const user = await loadSession(db, request, secureCookies);
          if (!user || user.id !== expectedUser) {
            throw new AppError("unauthenticated", "Your sign-in changed. Please try again.");
          }
        }
        if (tokenHash) await rows(db, "DELETE FROM sessions WHERE tokenHash = ?", [tokenHash]);
      });
    }
    clearSessionCookie(reply, secureCookies);
    return reply.code(204).send();
  });

  app.get("/api/auth/:provider/start", { exposeHeadRoute: false }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("Referrer-Policy", "no-referrer");
    const { provider } = request.params;
    const mode = request.query.mode ?? "signin";
    if (!enabled.includes(provider)) return popupResult(reply, origin, false, "This sign-in option is unavailable.");
    if (request.headers["sec-fetch-site"] === "cross-site" || !["signin", "reauth"].includes(mode)) {
      return popupResult(reply, origin, false);
    }

    try {
      const state = randomToken();
      const browserToken = randomToken();
      const nonce = randomToken();
      const verifier = oidc.randomPKCECodeVerifier();
      const sessionHash = cookieHash(request, "session", secureCookies);
      await writeTransaction(pool, async (db) => {
        const user = await loadSession(db, request, secureCookies);
        if (mode === "reauth" && (!user || user.provider !== provider)) {
          throw new AppError("unauthenticated", "Confirm your identity with the account you used to sign in.");
        }
        if (mode === "signin" && user) {
          throw new AppError("failed-precondition", "You are already signed in. Sign out to switch accounts.");
        }
        await rows(db, "DELETE FROM oauthFlows WHERE expiresAt <= UTC_TIMESTAMP(3) LIMIT 100");
        await rows(db, "DELETE FROM sessions WHERE expiresAt <= UTC_TIMESTAMP(3) LIMIT 100");
        await rows(db, `
          INSERT INTO oauthFlows (stateHash, browserHash, provider, mode, userId, sessionHash, nonce, verifier, expiresAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP(3)))
        `, [hash(state), hash(browserToken), provider, mode, user?.id ?? null, user ? sessionHash : null, nonce, verifier, FLOW_SECONDS]);
      });
      const authorizationUrl = await providers[provider].start({ redirectUri: redirectUri(provider), state, nonce, verifier, mode });
      reply.setCookie(cookieName(`oauth-${state}`, secureCookies), browserToken, {
        ...cookieOptions(secureCookies), maxAge: FLOW_SECONDS,
      });
      return reply.redirect(String(authorizationUrl));
    } catch (error) {
      if (error instanceof AppError) return popupResult(reply, origin, false, error.message);
      request.log.warn({ provider, failure: error?.name }, "OAuth start failed");
      return popupResult(reply, origin, false);
    }
  });

  app.get("/api/auth/:provider/callback", { exposeHeadRoute: false }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const { provider } = request.params;
    const callbackUrl = new URL(redirectUri(provider));
    callbackUrl.search = new URL(request.raw.url, origin).search;
    const { searchParams } = callbackUrl;
    const state = searchParams.get("state");
    if (!enabled.includes(provider) || searchParams.getAll("state").length !== 1 || !OPAQUE_TOKEN.test(state)) {
      return popupResult(reply, origin, false);
    }
    const flowCookie = `oauth-${state}`;
    const browserHash = cookieHash(request, flowCookie, secureCookies);
    reply.clearCookie(cookieName(flowCookie, secureCookies), cookieOptions(secureCookies));
    if (!browserHash) return popupResult(reply, origin, false);

    try {
      const stateHash = hash(state);
      const flow = await writeTransaction(pool, async (db) => {
        const row = await one(db, `
          SELECT mode, userId, sessionHash, nonce, verifier FROM oauthFlows
          WHERE stateHash = ? AND browserHash = ? AND provider = ? AND expiresAt > UTC_TIMESTAMP(3)
        `, [stateHash, browserHash, provider]);
        if (row) await rows(db, "DELETE FROM oauthFlows WHERE stateHash = ?", [stateHash]);
        return row;
      });
      if (!flow || searchParams.has("error") || searchParams.getAll("code").length !== 1 || !searchParams.get("code")) {
        return popupResult(reply, origin, false);
      }
      const sessionHash = cookieHash(request, "session", secureCookies);
      if (flow.mode === "reauth" && (!flow.sessionHash || sessionHash !== flow.sessionHash)) {
        return popupResult(reply, origin, false, "Your sign-in changed. Please try again.");
      }
      const identity = await providers[provider].identity({
        callbackUrl,
        redirectUri: redirectUri(provider),
        state,
        nonce: flow.nonce,
        verifier: flow.verifier,
        mode: flow.mode,
      });
      const subject = identitySubject(identity);
      const sessionToken = randomToken();
      await writeTransaction(pool, async (db) => {
        const current = await loadSession(db, request, secureCookies);
        const account = await one(db, "SELECT userId FROM oauthAccounts WHERE provider = ? AND subject = ?", [provider, subject]);
        let userId = account?.userId;
        if (flow.mode === "reauth") {
          if (!current || current.id !== flow.userId || current.provider !== provider || userId !== current.id) {
            throw new AppError("unauthenticated", "Choose the same account you used to sign in.");
          }
          await rows(db, "DELETE FROM sessions WHERE tokenHash = ?", [sessionHash]);
        } else {
          if (current) throw new AppError("failed-precondition", "You are already signed in. Sign out to switch accounts.");
          userId ??= await createUser(db, provider, subject, identity);
        }
        await rows(db, `
          INSERT INTO sessions (tokenHash, userId, provider, authAt, expiresAt)
          VALUES (?, ?, ?, UTC_TIMESTAMP(3), TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP(3)))
        `, [hash(sessionToken), userId, provider, SESSION_SECONDS]);
      });
      reply.setCookie(cookieName("session", secureCookies), sessionToken, {
        ...cookieOptions(secureCookies), maxAge: SESSION_SECONDS,
      });
      return popupResult(reply, origin, true);
    } catch (error) {
      if (error instanceof AppError) return popupResult(reply, origin, false, error.message);
      request.log.warn({ provider, failure: error?.name }, "OAuth callback failed");
      return popupResult(reply, origin, false);
    }
  });
}
