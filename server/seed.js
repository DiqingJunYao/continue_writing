import { one, rows, writeTransaction } from "./db.js";

const profiles = {
  demo_nora: {
    name: "Nora Vale",
    handle: "@noravale",
    initials: "NV",
    tone: "green",
    bio: "Writes toward the strange light.",
    avatarUrl: "",
  },
  demo_jules: {
    name: "Jules Park",
    handle: "@julespark",
    initials: "JP",
    tone: "blue",
    bio: "Collector of unsettling endings.",
    avatarUrl: "",
  },
  demo_imani: {
    name: "Imani Cross",
    handle: "@imanicross",
    initials: "IC",
    tone: "purple",
    bio: "Builds rooms behind ordinary doors.",
    avatarUrl: "",
  },
};

const stories = {
  seed_lightkeeper: {
    parentId: null,
    rootId: "seed_lightkeeper",
    level: 0,
    authorId: "demo_nora",
    status: "active",
    title: "The Last Lightkeeper",
    deck: "On the night the sea forgot the moon, Mara saw a light where no island should be.",
    genre: "Speculative",
    body: "The lighthouse had been dark for nineteen years when it blinked at Mara from beyond the reef. Once. Twice. Then a third time—slow and deliberate.\n\nShe stepped onto the porch as the impossible beam turned and pointed straight at her.",
  },
  seed_signal: {
    parentId: "seed_lightkeeper",
    rootId: "seed_lightkeeper",
    level: 1,
    authorId: "demo_jules",
    status: "active",
    title: "A Signal in the Fog",
    deck: "Mara answers the impossible light—and something answers back.",
    genre: "Speculative",
    body: "Mara carried the old signal lamp down to the beach. Its brass was green and its wick had turned to powder.\n\nShe struck a match. The lamp caught with a blue flame, and bells began ringing beyond the reef.",
  },
  seed_house: {
    parentId: null,
    rootId: "seed_house",
    level: 0,
    authorId: "demo_imani",
    status: "active",
    title: "The House That Remembered Us",
    deck: "Every room kept a different version of the family who left it behind.",
    genre: "Magical realism",
    body: "When Celia unlocked the blue house, the hallway exhaled her childhood name. Dust rose from the floorboards in the shape of two running children.\n\nThe estate agent had promised the house was empty. The house, apparently, had not agreed.",
  },
};

const comments = {
  seed_comment_welcome: {
    storyId: "seed_lightkeeper",
    parentCommentId: null,
    replyToCommentId: null,
    authorId: "demo_imani",
    status: "active",
    text: "That final image feels like an invitation to keep walking into the fog.",
  },
};

export async function seed(pool) {
  await writeTransaction(pool, async (db) => {
    for (const [table, fixtures] of [["users", profiles], ["stories", stories], ["comments", comments]]) {
      for (const [id, fixture] of Object.entries(fixtures)) {
        if (await one(db, `SELECT id FROM ${table} WHERE id = ?`, [id])) continue;
        // Table names and columns come only from the fixtures defined above.
        const columns = ["id", ...Object.keys(fixture)];
        await rows(db, `
          INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})
        `, [id, ...Object.values(fixture)]);
      }
    }
  });
}
