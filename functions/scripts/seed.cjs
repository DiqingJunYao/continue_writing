"use strict";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { requireProjectId } = require("./project-id.cjs");

let projectId;
try {
  projectId = requireProjectId();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
if (!usingEmulator && process.env.BRANCHLINE_ALLOW_PRODUCTION_SEED !== "yes") {
  console.error("Production seeding is disabled. Use the Firestore emulator or set BRANCHLINE_ALLOW_PRODUCTION_SEED=yes deliberately.");
  process.exit(1);
}

initializeApp({ projectId });
const db = getFirestore();
const now = Timestamp.now();

const profiles = {
  demo_nora: { name: "Nora Vale", handle: "@noravale", initials: "NV", tone: "green", bio: "Writes toward the strange light.", avatarUrl: "", createdAt: now, updatedAt: now },
  demo_jules: { name: "Jules Park", handle: "@julespark", initials: "JP", tone: "blue", bio: "Collector of unsettling endings.", avatarUrl: "", createdAt: now, updatedAt: now },
  demo_imani: { name: "Imani Cross", handle: "@imanicross", initials: "IC", tone: "purple", bio: "Builds rooms behind ordinary doors.", avatarUrl: "", createdAt: now, updatedAt: now }
};

const stories = {
  seed_lightkeeper: {
    parentId: null,
    rootId: "seed_lightkeeper",
    level: 0,
    authorId: "demo_nora",
    status: "active",
    deletionSource: null,
    reportCount: 0,
    title: "The Last Lightkeeper",
    deck: "On the night the sea forgot the moon, Mara saw a light where no island should be.",
    genre: "Speculative",
    body: "The lighthouse had been dark for nineteen years when it blinked at Mara from beyond the reef. Once. Twice. Then a third time—slow and deliberate.\n\nShe stepped onto the porch as the impossible beam turned and pointed straight at her.",
    createdAt: now,
    updatedAt: now,
    likes: 0,
    commentCount: 1,
    views: 0
  },
  seed_signal: {
    parentId: "seed_lightkeeper",
    rootId: "seed_lightkeeper",
    level: 1,
    authorId: "demo_jules",
    status: "active",
    deletionSource: null,
    reportCount: 0,
    title: "A Signal in the Fog",
    deck: "Mara answers the impossible light—and something answers back.",
    genre: "Speculative",
    body: "Mara carried the old signal lamp down to the beach. Its brass was green and its wick had turned to powder.\n\nShe struck a match. The lamp caught with a blue flame, and bells began ringing beyond the reef.",
    createdAt: now,
    updatedAt: now,
    likes: 0,
    commentCount: 0,
    views: 0
  },
  seed_house: {
    parentId: null,
    rootId: "seed_house",
    level: 0,
    authorId: "demo_imani",
    status: "active",
    deletionSource: null,
    reportCount: 0,
    title: "The House That Remembered Us",
    deck: "Every room kept a different version of the family who left it behind.",
    genre: "Magical realism",
    body: "When Celia unlocked the blue house, the hallway exhaled her childhood name. Dust rose from the floorboards in the shape of two running children.\n\nThe estate agent had promised the house was empty. The house, apparently, had not agreed.",
    createdAt: now,
    updatedAt: now,
    likes: 0,
    commentCount: 0,
    views: 0
  }
};

const comments = {
  seed_comment_welcome: {
    storyId: "seed_lightkeeper",
    parentCommentId: null,
    replyToCommentId: null,
    authorId: "demo_imani",
    status: "active",
    deletionSource: null,
    text: "That final image feels like an invitation to keep walking into the fog.",
    createdAt: now,
    updatedAt: now,
    likes: 0
  }
};

async function main() {
  const batch = db.batch();
  Object.entries(profiles).forEach(([id, value]) => batch.set(db.collection("profiles").doc(id), value, { merge: true }));
  Object.entries(stories).forEach(([id, value]) => batch.set(db.collection("stories").doc(id), value, { merge: true }));
  Object.entries(comments).forEach(([id, value]) => batch.set(db.collection("comments").doc(id), value, { merge: true }));
  await batch.commit();
  console.log(`Seeded ${Object.keys(profiles).length} profiles, ${Object.keys(stories).length} stories, and ${Object.keys(comments).length} comment in ${projectId}.`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
