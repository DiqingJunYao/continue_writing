# Branchline

Branchline is a collaborative, branching fiction platform. Readers move vertically through a story's ancestry and continuations and horizontally between alternate versions that share the same parent.

## Run locally

Fastify serves both the browser app and the API. For local development, install Node.js 22 or newer, Make, and Docker Compose.

```bash
make start
```

Open [localhost:4173](http://localhost:4173). `make start` creates `.env` on first run, installs dependencies when needed, waits for MySQL, initializes the schema, and starts Fastify in the foreground. Press Ctrl+C to stop Fastify. `make stop-db` stops the MySQL container and preserves its data.

Run `make seed` to add two example story trees and a sample comment. If you use an existing MySQL server, set `DATABASE_URL` in `.env` and run `npm ci`, `npm run migrate`, and `npm start` directly.

## Google and Facebook sign-in

Guest reading works with no OAuth credentials. To enable sign-in, add the provider credentials to the server environment and register the callback URLs using the exact `PUBLIC_ORIGIN` that readers use. For example, a site at `https://branchline.example.com` uses the following settings.

| Provider | Server environment | Authorized callback path |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `/api/auth/google/callback` |
| Facebook | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, optional `FACEBOOK_GRAPH_VERSION` | `/api/auth/facebook/callback` |

Create a **Web application** OAuth client in Google Cloud. For local testing with the default settings, register `http://localhost:4173/api/auth/google/callback` and use the same hostname in the browser. [Google's web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server)

Configure Facebook Login in the Meta app dashboard and add the full HTTPS callback to **Valid OAuth Redirect URIs**. Complete the app's launch settings, including its privacy and data-deletion information, before enabling Facebook Login for the public. [Meta's Facebook Login guide](https://developers.facebook.com/documentation/facebook-login/guides/advanced/manual-flow)

## Administrator

Have the intended administrator sign in once. Obtain the `user.uid` from `/api/session` while signed in with that account, then run this command on the server.

```bash
npm run set-admin -- USER_ID
```

The database stores a single administrator assignment. Reload the app to see the moderation tab.

## Deploy

Use a Node host with a private MySQL connection and an HTTPS reverse proxy. Set `NODE_ENV=production`, `PUBLIC_ORIGIN` to the public HTTPS origin, and `DATABASE_URL` to the app's database connection. Set `DATABASE_TLS=true` if the database connection requires TLS. Set `TRUST_PROXY` to the trusted proxy address or CIDR if using forwarded client IPs. The app serves both the site and `/api` on the same origin.

Run `npm ci --omit=dev` and `npm run migrate`, then run `npm start` under your host's process supervisor. Point the reverse proxy to `HOST` and `PORT`. Configure backups for MySQL and use `/healthz` to check database connectivity.

Reported and removed chapters retain a placeholder so their descendants stay linked. Account erasure also removes the person's sessions, OAuth links, comments under their chapters, and recoverable story content. On other authors' chapters, replies remain attached to a blank placeholder for the erased person's comments.

The reader and moderation views currently load up to 500 published chapters into the browser at once. The app displays a notice above this limit. Comments load a page at a time. The Firebase prototype is available in Git history at `abe1d93`.

## Verify

Set `TEST_DATABASE_URL` to a disposable MySQL database whose name ends in `_test`, then run the checks below. The browser suite uses Chromium from `CHROMIUM_PATH` or `/snap/bin/chromium`, and tests sign-in using stubbed provider responses with real server sessions and MySQL persistence.

```bash
npm test
npm run test:browser
```
