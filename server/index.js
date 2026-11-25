import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import staticFiles from "@fastify/static";
import { bootstrap, deleteAccount, ensureProfile } from "./account.js";
import { clearSessionCookie, loadSession, registerAuth } from "./auth.js";
import { content } from "./content.js";
import { createPool, one, readTransaction, writeTransaction } from "./db.js";
import { AppError, requireObject } from "./model.js";

const actions = { ...content, bootstrap, deleteAccount, ensureProfile };
const publicActions = new Set(["bootstrap", "getStoryComments"]);
const statusByCode = {
  "invalid-argument": 400,
  unauthenticated: 401,
  "permission-denied": 403,
  "not-found": 404,
  "already-exists": 409,
  "failed-precondition": 409,
  "resource-exhausted": 429,
  unavailable: 503,
};

export async function buildApp({ pool, env = process.env, providers, logger = false }) {
  const publicUrl = new URL(env.PUBLIC_ORIGIN || "http://localhost:4173");
  const origin = publicUrl.origin;
  const secureCookies = publicUrl.protocol === "https:";
  const localHttp = publicUrl.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(publicUrl.hostname);
  if ((!secureCookies && !localHttp) || publicUrl.href !== origin + "/") {
    throw new Error("PUBLIC_ORIGIN must be a bare HTTPS origin or a loopback HTTP origin for development.");
  }
  if (env.NODE_ENV === "production" && !secureCookies) {
    throw new Error("Production requires an HTTPS PUBLIC_ORIGIN.");
  }
  const app = Fastify({
    logger,
    logController: new Fastify.LogController({ disableRequestLogging: true }),
    bodyLimit: 64 * 1024,
    requestTimeout: 30_000,
    trustProxy: env.TRUST_PROXY || false,
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(statusByCode[error.code] || 500).send({
        error: { code: error.code, message: error.message },
      });
    }
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.statusCode === 429 ? "resource-exhausted" : "invalid-argument",
          message: error.statusCode === 429 ? "Too many requests. Try again shortly." : "The request could not be processed.",
        },
      });
    }
    request.log.error({ code: error.code, name: error.name }, "Branchline request failed");
    return reply.code(500).send({ error: { code: "internal", message: "Branchline could not complete this request." } });
  });

  app.addHook("onRequest", (request, reply, done) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    if (secureCookies) reply.header("Strict-Transport-Security", "max-age=31536000");
    if (request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
      if (request.method === "POST" && request.headers.origin !== origin) {
        return done(new AppError("permission-denied", "The request must come from Branchline."));
      }
    } else {
      reply.header("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
      reply.header("Content-Security-Policy", [
        "default-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' https: data:",
        "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'", "form-action 'self'",
      ].join("; "));
    }
    done();
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
  await registerAuth(app, { pool, origin, secureCookies, env, providers });

  app.get("/healthz", async (_request, reply) => {
    try {
      await one(pool, "SELECT id FROM app_state WHERE id = 1");
      return { status: "ok" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  for (const [name, action] of Object.entries(actions)) {
    app.post(`/api/actions/${name}`, async (request, reply) => {
      const isPublic = publicActions.has(name);
      const data = requireObject(request.body ?? {});
      const run = isPublic ? readTransaction : writeTransaction;
      const result = await run(pool, async (db) => {
        const user = await loadSession(db, request, secureCookies);
        const expectedUser = request.headers["x-branchline-user"];
        if (!isPublic && (!user || (expectedUser !== undefined && expectedUser !== user.id))) {
          throw new AppError("unauthenticated", "Sign in to continue.");
        }
        if (name === "moderateStory" && !user?.isAdmin) {
          throw new AppError("permission-denied", "Administrator access is required.");
        }
        return action(db, user, data);
      });
      if (name === "deleteAccount") clearSessionCookie(reply, secureCookies);
      return { result };
    });
  }

  await app.register(staticFiles, {
    root: fileURLToPath(new URL("../dist/", import.meta.url)),
    wildcard: false,
    cacheControl: false,
    setHeaders: (reply) => reply.header("Cache-Control", "no-cache"),
  });
  return app;
}

async function main() {
  const pool = createPool();
  let app;
  try {
    if (!await one(pool, "SELECT id FROM app_state WHERE id = 1")) {
      throw new Error("Run npm run migrate before starting Branchline.");
    }
    app = await buildApp({ pool, logger: true });
    app.addHook("onClose", () => pool.end());
    await app.listen({ host: process.env.HOST || "127.0.0.1", port: Number(process.env.PORT || 4173) });
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => app.close().catch(() => { process.exitCode = 1; }));
    }
  } catch (error) {
    if (app) await app.close();
    else await pool.end();
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Branchline startup failed: ${error.code || error.message}`);
    process.exitCode = 1;
  });
}
