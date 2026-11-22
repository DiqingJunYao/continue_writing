# Branchline

Branchline is a polished front-end prototype for a collaborative, branching fiction platform. Readers move vertically through a story's ancestry and continuations, and horizontally between alternate versions that share the same parent.

## Run locally

No build step is required. Serve `dist/` with any static file server, for example:

```bash
python3 -m http.server 4173 --directory dist
```

Then open `http://localhost:4173`.

## Prototype behavior

- Story, comment, moderation, and session changes persist in browser `localStorage`.
- Google and Facebook buttons simulate separate member identities for the demo; they never grant administrator access.
- A seeded administrator account exists in the fixture for moderation QA, but public demo sign-in cannot assume that role.
- Reported and deleted stories are rendered as tombstones while their descendants remain navigable.

The domain model is intentionally API-friendly: stories use `parentId` relationships, sibling versions are derived by shared parent, and levels are derived from ancestry.

## Production boundary

This repository is still a browser-only demo. A public launch requires a trusted backend and real Google/Facebook OAuth (for example, Firebase Authentication plus server-enforced database rules). Until that is connected, `localStorage` data is device-local and can be modified by the visitor, so it must not be treated as secure shared production data.
