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
- Google and Facebook buttons simulate OAuth for the demo; production credentials and a backend are not included.
- The signed-in demo account has administrator access so the moderation screen can be reviewed.
- Reported and deleted stories are rendered as tombstones while their descendants remain navigable.

The domain model is intentionally API-friendly: stories use `parentId` relationships, sibling versions are derived by shared parent, and levels are derived from ancestry.
