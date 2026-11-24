# Branchline Firebase setup

Branchline's browser configuration already targets the Firebase project `continuewriting-9e48b`. The values in the web configuration identify the project; they are not server credentials. Never put a Facebook app secret, service-account key, private key, or Firebase CLI token in this repository.

The current ChatGPT Sites deployment is still the safe browser-local demo. Keep it unchanged until the backend is deployed. The Firebase-backed frontend may then be published to the still-private Site for production verification; do not make that Site public until every launch gate below passes.

## 1. Make the irreversible database choice

Creating the default Cloud Firestore database permanently fixes its location. Choose the location deliberately before clicking **Create**; it cannot be changed later.

For a primarily European audience, use a European location. `eur3` is the usual multi-region choice when availability matters, while a single European region can be preferable when cost and regional latency matter more. The callable Functions in this repository are configured for `europe-west1`, so confirm the database location and Functions region together before provisioning.

In the [Firebase console](https://console.firebase.google.com/project/continuewriting-9e48b/firestore):

1. Open **Firestore Database** and choose **Create database**.
2. Select **Standard edition** and the default database.
3. Confirm the chosen European location.
4. Select **Production mode**. Browser access is intentionally denied; trusted callable Functions use the Admin SDK.

See [Cloud Firestore locations](https://firebase.google.com/docs/firestore/locations) before making this choice.

## 2. Configure Google and Facebook authentication

Open **Firebase console → Authentication → Sign-in method**.

### Google

1. Enable **Google**.
2. Select a project support email.
3. Save the provider.

### Facebook

1. Create or select the Meta app in [Meta for Developers](https://developers.facebook.com/).
2. Add the Facebook Login product.
3. In Firebase Authentication, enable **Facebook** and enter the Meta App ID and App Secret. The secret belongs only in Firebase/Meta settings—never in Git or browser code.
4. Add this exact valid OAuth redirect URI in Meta's Facebook Login settings:

   ```text
   https://continuewriting-9e48b.firebaseapp.com/__/auth/handler
   ```

5. Add `branchline-story-tree.flutedtune.chatgpt.site` under **App Domains**, add the **Website** platform, and use `https://branchline-story-tree.flutedtune.chatgpt.site/` as its Site URL.
6. Before switching the Meta app to live mode, complete its public app details: app icon, category and contact details, a real Privacy Policy URL, and a user-data deletion URL or deletion-instructions URL. These legal URLs must be publicly reachable during Meta review even while the application itself stays private, so host them on a separate public URL or publish only those routes through an approved public location. Add the required data-protection-officer contact details if Meta marks them as applicable. Do not invent or copy legal text—publish policies that accurately describe Branchline and identify the responsible operator.
7. While the Meta app is in development mode, use its configured test accounts. Complete Meta's required review before opening sign-in to the public.

Firebase's [Facebook web-authentication guide](https://firebase.google.com/docs/auth/web/facebook-login) describes the provider and redirect setup.

### Authorized domains

In **Firebase console → Authentication → Settings → Authorized domains**, add:

```text
branchline-story-tree.flutedtune.chatgpt.site
```

Keep `localhost` only while local authentication testing needs it. The Firebase project currently authorizes the default Firebase domains and `localhost`, but not the Branchline Sites domain.

## 3. Enable billing for Cloud Functions

Upgrade the project to the **Blaze** plan before deploying second-generation Cloud Functions. Set budget alerts in Google Cloud Billing before inviting users. Billing is usage based; an alert does not itself cap spending.

Do not enable App Check enforcement yet. Add it only after the client integration is deployed and its request metrics have been observed.

## 4. Authenticate the deployment tooling

Use the Firebase CLI for the local deployment route:

```bash
npx firebase-tools@15.37.0 login
npx firebase-tools@15.37.0 projects:list
```

Confirm that `continuewriting-9e48b` appears before deploying. Every command below passes `--project continuewriting-9e48b`, so no tracked `.firebaserc` project binding is required.

Install the pinned backend and test dependencies:

```bash
npm --prefix functions ci
npm --prefix tests ci
```

## 5. Run local checks and emulators

Run the Functions syntax checks and the deny-by-default Firestore Rules suite:

```bash
npm --prefix functions run check
npm --prefix functions test
npm --prefix tests run test:rules
npm --prefix tests run test:backend
npm --prefix tests run test:browser:emulator
```

The backend smoke test exercises guest denial, profiles, drafts, publishing, continuations, comments/replies, likes, inbox reads, fourth-report hiding, administrator restore, author deletion, and account erasure. The browser test drives both Google and Facebook through the local Auth emulator, publishes and reacts through the real UI, checks desktop/mobile layout, and runs serious/critical WCAG A/AA checks in headless Chromium. Set `CHROMIUM_PATH` if Chromium is installed somewhere other than `/snap/bin/chromium`.

This machine currently has Java 17. Firebase CLI 15 requires Java 21 for its emulators, so the test workspace deliberately pins CLI 14.27.0 for local emulator work. To inspect the complete local stack manually:

```bash
npm --prefix tests exec -- firebase emulators:start \
  --project demo-branchline \
  --config firebase.json \
  --only auth,firestore,functions
```

The configured ports are Auth `9099`, Functions `5001`, Firestore `8080`, and Emulator UI `4000`. Emulator data is disposable and must never be mistaken for the production project.

Serve `dist/`, then open `http://localhost:4173/?emulators=1` to opt the browser into the local Auth and Functions emulators. Emulator routing is accepted only on a localhost hostname; the production site cannot enable it through a query string.

## 6. Deploy the trusted backend

Review [firestore.rules](firestore.rules), [firestore.indexes.json](firestore.indexes.json), and the Functions source before the first deployment. The Rules intentionally reject all browser Firestore reads and writes; the browser talks to allowlisted callable Functions instead.

Deploy the Rules and indexes first:

```bash
npx firebase-tools@15.37.0 deploy \
  --project continuewriting-9e48b \
  --only firestore:rules,firestore:indexes
```

Wait until every composite index shows **Ready** in the Firestore console. Only then deploy the Functions revision that depends on those indexes:

```bash
npx firebase-tools@15.37.0 deploy \
  --project continuewriting-9e48b \
  --only functions
```

After the first Functions deployment, configure automatic cleanup for old build images so Artifact Registry storage does not grow indefinitely:

```bash
npx firebase-tools@15.37.0 functions:artifacts:setpolicy \
  --project continuewriting-9e48b \
  --location europe-west1 \
  --days 7
```

Do not weaken the Rules to make a client request pass. Fix the callable API or its authentication instead.

## 7. Seed initial stories

The seed script uses the Admin SDK. Run it only with Application Default Credentials for the intended project, or against the emulator. Never download a service-account key into the repository.

For production, authenticate Application Default Credentials using an approved Google Cloud workflow, verify the active project, then run:

```bash
BRANCHLINE_ALLOW_PRODUCTION_SEED=yes \
  GOOGLE_CLOUD_PROJECT=continuewriting-9e48b \
  npm --prefix functions run seed
```

The safety flag is intentionally required outside the emulator. The seed uses stable document IDs and merge writes, but do not run it casually against live data because it replaces those seed documents' fields.
The script also rejects conflicting `FIREBASE_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT`, and `GCLOUD_PROJECT` values instead of guessing which project you intended.

## 8. Assign the single administrator

1. Sign in once with the Google or Facebook account that will be the administrator.
2. Copy that user's Firebase UID from **Authentication → Users**.
3. With approved Application Default Credentials for `continuewriting-9e48b`, run:

   ```bash
   GOOGLE_CLOUD_PROJECT=continuewriting-9e48b \
     npm --prefix functions run set-admin -- FIREBASE_UID
   ```

   The script verifies the target, acquires a short-lived server-side handoff lease, grants its claim while preserving unrelated custom claims, atomically updates the singleton administrator record, and then removes old administrator claims. A simultaneous assignment command stops without making changes. Every administrator request must match both the claim and singleton record, so only the singleton account is authorized during the handoff and cached tokens from a replaced administrator stop working immediately.
   It also stops before making changes if the supported project environment variables disagree.
4. Have the new administrator sign out and sign back in so their browser receives the new claim. A replaced administrator should also sign in again for an accurate UI, but the backend rejects their old cached token as soon as the singleton record changes.
5. Verify that a normal member and the replaced account cannot open moderation, and that only the designated account can hide or restore chapters.

Never authorize administrators from a writable profile document. The backend must require both the server-controlled custom claim and singleton administrator record.

## 9. Publish privately and verify production

After the backend, indexes, rules, seed data, providers, authorized domain, and administrator are ready, publish the exact locally tested frontend commit to the existing **private** Sites project. The automated browser suite is intentionally emulator-only; use it before publishing, then manually test these flows against the production Firebase project from the private Sites URL:

- Google sign-in and Facebook sign-in from the Sites domain.
- A guest can read but cannot mutate data.
- A member can create a root, draft, continuation, comment, reply, and like.
- Activity appears only in the correct recipient's inbox.
- The fourth distinct report redacts the public story but preserves its tree position.
- An administrator can inspect and restore moderation/author deletions, but cannot restore account-erased content.
- Account deletion asks for fresh Google/Facebook confirmation, blocks simultaneous writes, removes Auth/profile/comment data, destroys archived content, and leaves only redacted story tombstones needed to preserve descendants.
- Direct Firestore requests remain denied for guests, members, and administrators.

The frontend is already wired through [dist/firebase-client.js](dist/firebase-client.js). Keep the Site private if any check fails.

### Current capacity gate

The reader bootstrap intentionally stops at the newest 500 published story nodes and displays a visible capacity warning if that boundary is reached. Do not make the Site public—or keep it public—while that warning appears: add paginated story/tree/profile/admin loading and rerun the production checks first. Comment threads are already loaded on demand in exact, 100-item pages.

## 10. Enable App Check before public launch

1. Create a score-based reCAPTCHA Enterprise web key for `branchline-story-tree.flutedtune.chatgpt.site`; do not add `localhost` to the production key.
2. Register this Firebase web app with App Check and that key.
3. Put the public site key in `firebaseAppCheckSiteKey` in [dist/firebase-config.js](dist/firebase-config.js), republish to the private Site, and verify that legitimate callable requests appear as verified in App Check metrics.
4. Change `ENFORCE_APP_CHECK` in [functions/index.js](functions/index.js) to `true`, rerun the emulator suites, and redeploy Functions. The callable wrapper deliberately bypasses enforcement only when `FUNCTIONS_EMULATOR=true`, so local tests remain deterministic. Confirm unverified production requests are rejected while the private production Site still works.
5. Only after App Check, OAuth, legal-page, moderation, account-deletion, budget-alert, and production smoke checks pass should the Sites deployment become public.

See [Firebase App Check](https://firebase.google.com/docs/app-check) and the [reCAPTCHA Enterprise web setup](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider). App Check protects the public callable API from unauthorized clients; it does not replace authentication, authorization, or spending alerts.
