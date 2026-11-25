import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { content } from "../server/content.js";
import {
  createPool,
  migrate,
  one,
  readTransaction,
  rows,
  writeTransaction,
} from "../server/db.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const testDatabase = databaseUrl
  ? decodeURIComponent(new URL(databaseUrl).pathname.slice(1))
  : "";
if (databaseUrl && !testDatabase.endsWith("_test")) {
  throw new Error("The integration test database name must end in _test.");
}

const pool = databaseUrl
  ? createPool({ ...process.env, DATABASE_URL: databaseUrl })
  : null;
const skip = databaseUrl
  ? false
  : "Set TEST_DATABASE_URL to a dedicated MySQL database ending in _test.";
const storyBody = "Το φως έσβησε και η θάλασσα άλλαξε πάλι χρώμα.";

before(async () => {
  if (pool) await migrate(pool);
});
after(async () => {
  if (pool) await pool.end();
});

function write(action, user, data) {
  return writeTransaction(pool, (db) => content[action](db, user, data));
}

function read(action, user, data) {
  return readTransaction(pool, (db) => content[action](db, user, data));
}

async function writers(t, count) {
  const fixtureId = randomUUID();
  const users = Array.from({ length: count }, (_, index) => ({
    id: `${fixtureId}-${index}`,
    isAdmin: false,
  }));
  const placeholders = users.map(() => "?").join(", ");
  const ids = users.map((user) => user.id);

  t.after(() =>
    writeTransaction(pool, async (db) => {
      const stories = await rows(
        db,
        `SELECT id FROM stories WHERE authorId IN (${placeholders}) ORDER BY level DESC`,
        ids,
      );
      for (const story of stories) {
        await rows(db, "DELETE FROM stories WHERE id = ?", [story.id]);
      }
      await rows(db, `DELETE FROM users WHERE id IN (${placeholders})`, ids);
    }),
  );

  await writeTransaction(pool, async (db) => {
    for (const [index, user] of users.entries()) {
      await rows(
        db,
        `INSERT INTO users (id, name, handle, initials, tone, bio, avatarUrl)
        VALUES (?, ?, ?, 'J', 'green', '', '')`,
        [user.id, `Jun ${index}`, `@jun${index}`],
      );
    }
  });
  return users;
}

test(
  "drafts preserve branch identity and published descendants survive soft deletion",
  { skip },
  async (t) => {
    const [author, writer] = await writers(t, 2);
    const root = await write("saveStory", author, {
      title: "Αρχή",
      body: storyBody,
    });
    const draft = await write("saveStory", writer, {
      title: "草稿",
      parentId: root.storyId,
      asDraft: true,
    });
    assert.equal(draft.status, "draft");
    await assert.rejects(
      read("getStoryComments", null, { storyId: draft.storyId }),
      { code: "not-found" },
    );
    await assert.rejects(
      write("saveStory", author, {
        title: "Hidden parent",
        body: storyBody,
        parentId: draft.storyId,
      }),
      { code: "not-found" },
    );
    await assert.rejects(
      write("saveStory", author, {
        storyId: draft.storyId,
        title: "Wrong writer",
        asDraft: true,
      }),
      { code: "not-found" },
    );
    const published = await write("saveStory", writer, {
      storyId: draft.storyId,
      title: "續章",
      body: storyBody,
      publish: true,
    });
    assert.equal(published.storyId, draft.storyId);
    assert.equal(published.status, "active");
    await assert.rejects(
      write("deleteStory", writer, { storyId: root.storyId }),
      { code: "permission-denied" },
    );
    const deleted = await write("deleteStory", author, {
      storyId: root.storyId,
    });
    assert.equal(deleted.hardDeleted, false);
    const child = await one(
      pool,
      "SELECT parentId, rootId, level, body FROM stories WHERE id = ?",
      [published.storyId],
    );
    assert.deepEqual(child, {
      parentId: root.storyId,
      rootId: root.storyId,
      level: 1,
      body: storyBody,
    });
    const inactiveDraft = await write("saveStory", writer, {
      title: "Independent draft",
      asDraft: true,
    });
    assert.equal(
      (await write("deleteStory", writer, { storyId: inactiveDraft.storyId }))
        .hardDeleted,
      true,
    );
    assert.equal(
      await one(pool, "SELECT id FROM stories WHERE id = ?", [
        inactiveDraft.storyId,
      ]),
      null,
    );
  },
);

test(
  "the fourth distinct report hides the original text and an administrator can restore it",
  { skip },
  async (t) => {
    const [author, ...reporters] = await writers(t, 5);
    const { storyId } = await write("saveStory", author, {
      title: "A reported chapter",
      body: storyBody,
    });
    await write("addComment", reporters[0], {
      storyId,
      text: "The first thought.",
    });
    assert.equal(
      (await write("reportStory", reporters[0], { storyId })).reportCount,
      1,
    );
    await assert.rejects(write("reportStory", reporters[0], { storyId }), {
      code: "already-exists",
    });

    const results = await Promise.all(
      reporters.slice(1).map((user) => write("reportStory", user, { storyId })),
    );
    assert.equal(
      results.filter((result) => result.status === "reported").length,
      1,
    );
    assert.equal(
      results.find((result) => result.status === "reported").reportCount,
      4,
    );
    const story = await one(
      pool,
      "SELECT title, body, status FROM stories WHERE id = ?",
      [storyId],
    );
    assert.deepEqual(story, {
      title: "Reported chapter",
      body: "",
      status: "reported",
    });
    assert.equal(
      (
        await one(pool, "SELECT body FROM storyArchives WHERE storyId = ?", [
          storyId,
        ])
      ).body,
      storyBody,
    );
    await assert.rejects(read("getStoryComments", null, { storyId }), {
      code: "failed-precondition",
    });
    await assert.rejects(
      write("moderateStory", author, { storyId, action: "restore" }),
      { code: "permission-denied" },
    );

    const admin = { ...author, isAdmin: true };
    assert.equal(
      (await write("moderateStory", admin, { storyId, action: "restore" }))
        .status,
      "active",
    );
    assert.equal(
      (await one(pool, "SELECT body FROM stories WHERE id = ?", [storyId]))
        .body,
      storyBody,
    );
    assert.equal(
      await one(pool, "SELECT storyId FROM storyArchives WHERE storyId = ?", [
        storyId,
      ]),
      null,
    );
    assert.equal(
      (await read("getStoryComments", null, { storyId })).comments.length,
      1,
    );
    assert.equal(
      (await write("reportStory", reporters[0], { storyId })).reportCount,
      1,
    );
  },
);

test(
  "reply relationships and per-reader likes are retained across exact comment pages",
  { skip },
  async (t) => {
    const [author, commenter, reader] = await writers(t, 3);
    const { storyId } = await write("saveStory", author, {
      title: "Comments",
      body: storyBody,
    });
    const root = await write("addComment", commenter, {
      storyId,
      text: "我喜欢这一章。",
    });
    const reply = await write("addReply", author, {
      replyToCommentId: root.id,
      text: "谢谢你的回复。",
    });
    const nestedReply = await write("addReply", reader, {
      replyToCommentId: reply.id,
      text: "Κι εγώ συμφωνώ.",
    });
    assert.equal(nestedReply.parentCommentId, root.id);
    assert.equal(nestedReply.replyToCommentId, reply.id);
    assert.deepEqual(
      await write("toggleCommentLike", reader, { commentId: root.id }),
      { liked: true, likes: 1 },
    );
    assert.deepEqual(
      await write("toggleCommentLike", reader, { commentId: root.id }),
      { liked: false, likes: 0 },
    );
    assert.deepEqual(
      await write("toggleCommentLike", reader, { commentId: root.id }),
      { liked: true, likes: 1 },
    );

    const privateView = await read("getStoryComments", reader, { storyId });
    const publicView = await read("getStoryComments", null, { storyId });
    assert.deepEqual(
      privateView.comments.find((comment) => comment.id === root.id).likedBy,
      [reader.id],
    );
    assert.deepEqual(
      publicView.comments.find((comment) => comment.id === root.id).likedBy,
      [],
    );
    assert(privateView.users.some((user) => user.id === commenter.id));
    const likeNotice = await rows(
      pool,
      "SELECT id FROM notifications WHERE type = 'comment_like' AND recipientId = ?",
      [commenter.id],
    );
    assert.equal(likeNotice.length, 1);
    assert.equal(
      (
        await write("markNotificationsRead", author, {
          notificationIds: [likeNotice[0].id],
        })
      ).updated,
      0,
    );
    assert.equal(
      (
        await write("markNotificationsRead", commenter, {
          notificationIds: [likeNotice[0].id],
        })
      ).updated,
      1,
    );

    const tiedCursorTime = "2023-11-14 22:13:20.123";
    const fixtures = Array.from({ length: 101 }, (_, index) => ({
      id: `${storyId}-${String(index).padStart(3, "0")}`,
      text: `Fixture ${index}`,
    }));
    await writeTransaction(pool, (db) =>
      rows(
        db,
        `INSERT INTO comments (id, storyId, authorId, status, text, createdAt, updatedAt)
    VALUES ${fixtures.map(() => "(?, ?, ?, 'active', ?, ?, ?)").join(", ")}`,
        fixtures.flatMap(({ id, text }) => [
          id,
          storyId,
          author.id,
          text,
          tiedCursorTime,
          tiedCursorTime,
        ]),
      ),
    );

    const pageOne = await read("getStoryComments", null, { storyId });
    assert.equal(pageOne.comments.length, 100);
    assert.deepEqual(pageOne.nextCursor, {
      id: fixtures[99].id,
      createdAt: "2023-11-14T22:13:20.123Z",
    });
    const pageTwo = await read("getStoryComments", null, {
      storyId,
      cursor: pageOne.nextCursor,
    });
    assert.equal(pageTwo.comments[0].id, fixtures[100].id);
    assert.equal(pageTwo.comments.length, 4);
    assert.equal(pageTwo.nextCursor, null);
    assert.equal(
      new Set([...pageOne.comments, ...pageTwo.comments].map(({ id }) => id))
        .size,
      104,
    );
    await assert.rejects(
      read("getStoryComments", null, {
        storyId,
        cursor: { id: fixtures[99].id, createdAt: "2023-02-31T09:00:00.123Z" },
      }),
      { code: "invalid-argument" },
    );
  },
);
