# Branchline

Branchline is a collaborative, branching fiction platform. Readers move vertically through a story's ancestry and continuations, and horizontally between alternate versions that share the same parent.

## Run locally

No build step is required. Serve `dist/` with any static file server, for example:

```bash
python3 -m http.server 4173 --directory dist
```

Then open `http://localhost:4173`. The production Firebase backend must already be deployed and must authorize `localhost` for authentication.

For local Firebase emulators, start the emulator suite as described in [FIREBASE_SETUP.md](FIREBASE_SETUP.md), then open `http://localhost:4173/?emulators=1`.

Run the automated checks with:

```bash
npm --prefix functions run check
npm --prefix functions test
npm --prefix tests run test:rules
npm --prefix tests run test:backend
npm --prefix tests run test:browser:emulator
```

## Application behavior

- Stories, comments, likes, reports, notifications, drafts, and moderation state are shared through trusted callable Firebase Functions and Cloud Firestore.
- Authentication uses Firebase Google and Facebook providers. Guests can read, while signed-in members can write.
- Administrator access requires both a server-controlled Firebase custom claim and the singleton administrator record.
- Reported and deleted stories are rendered as tombstones while their descendants remain navigable.
- Branchline itself keeps only branch-selection preferences in `localStorage`; Firebase Authentication manages its own browser session persistence.

The domain model is intentionally API-friendly: stories use `parentId` relationships, sibling versions are derived by shared parent, and levels are derived from ancestry.

## Backend and deployment

The browser never receives direct Firestore permission. It uses the allowlisted functions in `functions/`, which enforce authentication, ownership, moderation, and account-erasure behavior with the Admin SDK. See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for the immutable Firestore location decision, provider configuration, deployment, seeding, administrator setup, and production verification checklist.
