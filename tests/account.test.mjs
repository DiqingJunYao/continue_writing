import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { bootstrap, deleteAccount } from "../server/account.js";
import { content } from "../server/content.js";
import {
  createPool,
  migrate,
  one,
  readTransaction,
  rows,
  writeTransaction,
} from "../server/db.js";
import { buildApp } from "../server/index.js";

const origin = "http://127.0.0.1:4173";
const databaseUrl = process.env.TEST_DATABASE_URL;
if (
  databaseUrl &&
  !decodeURIComponent(new URL(databaseUrl).pathname.slice(1)).endsWith("_test")
) {
  throw new Error("The integration test database name must end in _test.");
}
const pool = databaseUrl
  ? createPool({ ...process.env, DATABASE_URL: databaseUrl })
  : null;
const skip = pool
  ? false
  : "Set TEST_DATABASE_URL to a dedicated MySQL database ending in _test.";

before(async () => {
  if (pool) await migrate(pool);
});
after(async () => {
  if (pool) await pool.end();
});

function createSession(user) {
  const token = randomBytes(32).toString("base64url");
  return {
    user,
    tokenHash: createHash("sha256").update(token).digest("hex"),
    cookie: `branchline-session=${token}`,
  };
}

test(
  "account erasure removes private data and preserves other writers' connections",
  { skip },
  async (t) => {
    const leaving = randomUUID();
    const survivor = randomUUID();
    const erasedStoryTitle = `Erased story ${leaving}`;
    const erasedStoryBody = `The erased writer placed a lantern on the pier. ${leaving}`;
    const privateDraftTitle = `Private draft ${leaving}`;
    const commentText = `An account comment to be erased ${leaving}`;
    const stale = createSession(leaving);
    const recent = createSession(leaving);
    const other = createSession(survivor);
    const storyIds = [];
    const app = await buildApp({
      pool,
      env: { NODE_ENV: "test", PUBLIC_ORIGIN: origin },
      providers: {},
    });

    t.after(async () => {
      await app.close();
      await writeTransaction(pool, async (db) => {
        for (const id of [...storyIds].reverse()) {
          await rows(db, "DELETE FROM stories WHERE id = ?", [id]);
        }
        await rows(db, "DELETE FROM users WHERE id IN (?, ?)", [
          leaving,
          survivor,
        ]);
      });
    });

    await writeTransaction(pool, async (db) => {
      await rows(
        db,
        `INSERT INTO users (id, name, handle, initials, tone, bio, avatarUrl)
      VALUES (?, 'Leaving Writer', '@leaving', 'LW', 'green', '', ''),
             (?, 'Surviving Writer', '@surviving', 'SW', 'green', '', '')`,
        [leaving, survivor],
      );
      await rows(
        db,
        "INSERT INTO oauthAccounts (provider, subject, userId) VALUES ('google', ?, ?)",
        [leaving, leaving],
      );
      const flowHash = createHash("sha256").update(leaving).digest("hex");
      await rows(
        db,
        `INSERT INTO oauthFlows (stateHash, browserHash, provider, mode, userId, sessionHash, expiresAt)
      VALUES (?, ?, 'google', 'reauth', ?, ?, TIMESTAMPADD(MINUTE, 10, UTC_TIMESTAMP(3)))`,
        [flowHash, flowHash, leaving, recent.tokenHash],
      );
      for (const session of [stale, recent, other]) {
        const elapsedMinutes = session === stale ? -10 : 0;
        await rows(
          db,
          `INSERT INTO sessions (tokenHash, userId, provider, authAt, expiresAt)
        VALUES (?, ?, 'google', TIMESTAMPADD(MINUTE, ?, UTC_TIMESTAMP(3)), TIMESTAMPADD(DAY, 1, UTC_TIMESTAMP(3)))`,
          [session.tokenHash, session.user, elapsedMinutes],
        );
      }
    });

    async function request(name, data, session) {
      return app.inject({
        method: "POST",
        url: `/api/actions/${name}`,
        headers: session
          ? {
              origin,
              cookie: session.cookie,
              "x-branchline-user": session.user,
            }
          : { origin },
        payload: data,
      });
    }

    async function action(name, data, session) {
      const response = await request(name, data, session);
      assert.equal(response.statusCode, 200, response.body);
      return response.json().result;
    }

    async function chapter(session, data) {
      const { storyId } = await action("saveStory", data, session);
      storyIds.push(storyId);
      return storyId;
    }

    const rootId = await chapter(recent, {
      title: erasedStoryTitle,
      body: erasedStoryBody,
    });
    const childId = await chapter(other, {
      title: "A surviving branch",
      body: "Another writer continued the story and took it somewhere new.",
      parentId: rootId,
    });
    const activeId = await chapter(recent, {
      title: "Another story to erase",
      body: erasedStoryBody,
    });
    const draftId = await chapter(recent, {
      title: privateDraftTitle,
      body: "Private words",
      asDraft: true,
      parentId: childId,
    });
    const removedComment = await action(
      "addComment",
      {
        storyId: rootId,
        text: "This comment belongs to the archived chapter.",
      },
      other,
    );
    const removedReply = await action(
      "addReply",
      {
        replyToCommentId: removedComment.id,
        text: "This reply belongs to the archived chapter, too.",
      },
      recent,
    );
    const redacted = await action(
      "addComment",
      { storyId: childId, text: commentText },
      recent,
    );
    const kept = await action(
      "addReply",
      {
        replyToCommentId: redacted.id,
        text: "This writer and this reply stay.",
      },
      other,
    );
    await action("toggleCommentLike", { commentId: redacted.id }, other);
    await action("toggleStoryLike", { storyId: rootId }, other);
    await action("toggleStoryLike", { storyId: childId }, recent);
    await action("reportStory", { storyId: rootId }, other);
    await action("deleteStory", { storyId: rootId }, recent);

    const guest = await action("bootstrap", {});
    assert.equal(
      guest.stories.find((story) => story.id === rootId).title,
      "Deleted chapter",
    );
    assert.equal(guest.stories.find((story) => story.id === rootId).body, "");
    assert(!guest.stories.some((story) => story.id === draftId));
    const otherView = await action("bootstrap", {}, other);
    assert(!otherView.stories.some((story) => story.id === draftId));
    assert(
      otherView.notifications.some(
        (notification) =>
          notification.storyId === rootId && notification.quote === "",
      ),
    );
    const leavingView = await action("bootstrap", {}, recent);
    assert.equal(
      leavingView.stories.find((story) => story.id === draftId).title,
      privateDraftTitle,
    );
    assert(
      !JSON.stringify(leavingView.notifications).includes(erasedStoryTitle),
    );
    const adminView = await readTransaction(pool, (db) =>
      bootstrap(db, { id: survivor, isAdmin: true }),
    );
    assert.equal(
      adminView.stories.find((story) => story.id === rootId).body,
      erasedStoryBody,
    );
    assert(!adminView.stories.some((story) => story.id === draftId));

    const staleDeletion = await request("deleteAccount", {}, stale);
    assert.equal(staleDeletion.statusCode, 401, staleDeletion.body);
    assert.equal(staleDeletion.json().error.code, "unauthenticated");
    assert.equal(
      (await one(pool, "SELECT id FROM users WHERE id = ?", [leaving])).id,
      leaving,
    );
    await assert.rejects(
      writeTransaction(pool, (db) =>
        deleteAccount(db, { id: survivor, authAt: new Date(), isAdmin: true }),
      ),
      { code: "failed-precondition" },
    );

    const deletion = await request("deleteAccount", {}, recent);
    assert.equal(deletion.statusCode, 200, deletion.body);
    assert.deepEqual(deletion.json().result, {
      deleted: true,
      preservedStoryNodes: 2,
    });
    assert.match(deletion.headers["set-cookie"], /^branchline-session=;/);
    for (const [table, column, value] of [
      ["users", "id", leaving],
      ["oauthAccounts", "userId", leaving],
      ["oauthFlows", "userId", leaving],
      ["sessions", "userId", leaving],
      ["stories", "id", draftId],
      ["storyArchives", "storyId", rootId],
      ["storyLikes", "storyId", rootId],
      ["storyLikes", "userId", leaving],
      ["reports", "storyId", rootId],
      ["comments", "id", removedComment.id],
      ["comments", "id", removedReply.id],
      ["commentLikes", "commentId", redacted.id],
      ["notifications", "actorId", leaving],
      ["notifications", "recipientId", leaving],
      ["notifications", "storyId", rootId],
    ]) {
      assert.equal(
        await one(pool, `SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT 1`, [
          value,
        ]),
        null,
        `${table}.${column}`,
      );
    }

    const afterErasure = await action("bootstrap", {}, other);
    for (const id of [rootId, activeId]) {
      const node = afterErasure.stories.find((story) => story.id === id);
      assert.equal(node.status, "deleted");
      assert.equal(node.deletionSource, "account");
      assert.equal(node.body, "");
      assert.equal(node.authorId, null);
    }
    const child = afterErasure.stories.find((story) => story.id === childId);
    assert.equal(child.parentId, rootId);
    assert.equal(child.rootId, rootId);
    assert.equal(child.authorId, survivor);
    assert.equal(child.commentCount, 1);
    const thread = await action("getStoryComments", { storyId: childId });
    const deletedComment = thread.comments.find(
      (comment) => comment.id === redacted.id,
    );
    assert.equal(deletedComment.status, "deleted");
    assert.equal(deletedComment.text, "");
    assert.equal(deletedComment.authorId, null);
    const liveReply = thread.comments.find((comment) => comment.id === kept.id);
    assert.equal(liveReply.text, kept.text);
    assert.equal(liveReply.replyToCommentId, redacted.id);
    assert.equal(liveReply.parentCommentId, redacted.id);

    await assert.rejects(
      writeTransaction(pool, (db) =>
        content.moderateStory(
          db,
          { id: survivor, isAdmin: true },
          { storyId: rootId, action: "restore" },
        ),
      ),
      { code: "failed-precondition" },
    );
    const afterSession = await app.inject({
      url: "/api/session",
      headers: { cookie: recent.cookie },
    });
    assert.equal(afterSession.json().user, null);
    assert.equal(
      (
        await request(
          "saveStory",
          { title: "Revoked session", body: erasedStoryBody },
          stale,
        )
      ).statusCode,
      401,
    );
  },
);
