import { createHash, randomUUID } from "node:crypto";
import { clientDates, one, rows } from "./db.js";
import {
  AppError,
  MAX_TREE_DEPTH,
  cleanCommentText,
  cleanId,
  cleanStoryInput,
  publicTombstone,
  requireObject,
} from "./model.js";

const COMMENT_PAGE_SIZE = 100;

async function getStory(db, id) {
  const story = await one(db, "SELECT * FROM stories WHERE id = ?", [id]);
  if (!story) throw new AppError("not-found", "Chapter was not found.");
  return story;
}

async function activeStory(db, id) {
  const story = await getStory(db, id);
  if (story.status === "draft") {
    throw new AppError("not-found", "Chapter was not found.");
  }
  if (story.status !== "active") {
    throw new AppError("failed-precondition", "This chapter is unavailable.");
  }
  return story;
}

async function activeComment(db, id) {
  const comment = await one(
    db,
    "SELECT * FROM comments WHERE id = ? AND status = 'active'",
    [id],
  );
  if (!comment)
    throw new AppError("not-found", "The comment is no longer available.");
  return comment;
}

function assertStoryOwner(story, user) {
  if (story.authorId !== user.id) {
    if (story.status === "draft")
      throw new AppError("not-found", "Chapter was not found.");
    throw new AppError("permission-denied", "You do not own this chapter.");
  }
}

async function notify(
  db,
  {
    type,
    actorId,
    recipientId,
    storyId,
    targetStoryId = storyId,
    quote,
    targetId,
  },
) {
  if (!recipientId || recipientId === actorId) return;
  // A like is one inbox event per target and actor, even if toggled repeatedly.
  const id = targetId
    ? createHash("sha256")
        .update(JSON.stringify([type, targetId, actorId]))
        .digest("hex")
    : randomUUID();
  await rows(
    db,
    `INSERT INTO notifications (id, type, actorId, recipientId, storyId, targetStoryId, \`quote\`)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`,
    [
      id,
      type,
      actorId,
      recipientId,
      storyId,
      targetStoryId,
      quote.slice(0, 180),
    ],
  );
}

async function logModeration(db, action, actorId, story) {
  await rows(
    db,
    `INSERT INTO moderationAudit (id, action, actorId, storyId, previousStatus)
    VALUES (?, ?, ?, ?, ?)`,
    [randomUUID(), action, actorId, story.id, story.status],
  );
}

async function saveStory(db, user, data) {
  const payload = requireObject(data);
  const requestedId = cleanId(payload.storyId, "Chapter ID", {
    optional: true,
  });
  const requestedParentId = cleanId(payload.parentId, "Parent chapter ID", {
    optional: true,
  });
  const publish = payload.publish === true;
  const asDraft = payload.asDraft === true && !publish;
  const { title, deck, body, genre } = cleanStoryInput(payload, {
    draft: asDraft,
  });
  const storyId = requestedId || randomUUID();
  if (requestedParentId === storyId) {
    throw new AppError("invalid-argument", "A chapter cannot continue itself.");
  }

  const existing = requestedId ? await getStory(db, requestedId) : null;
  if (existing) assertStoryOwner(existing, user);
  if (existing && !["active", "draft"].includes(existing.status)) {
    throw new AppError(
      "failed-precondition",
      "Unavailable chapters cannot be edited.",
    );
  }
  if (existing?.status === "active" && (payload.asDraft === true || publish)) {
    throw new AppError(
      "failed-precondition",
      "Published chapters cannot be converted to drafts.",
    );
  }

  const parentId = existing ? existing.parentId : requestedParentId;
  const needsParentCheck =
    !existing || (existing.status === "draft" && !asDraft);
  const parent =
    needsParentCheck && parentId ? await activeStory(db, parentId) : null;
  if (parent && parent.level >= MAX_TREE_DEPTH) {
    throw new AppError(
      "failed-precondition",
      "This story has reached the maximum supported depth.",
    );
  }
  const status = asDraft ? "draft" : "active";
  if (existing) {
    await rows(
      db,
      `UPDATE stories SET title = ?, deck = ?, body = ?, genre = ?, status = ?,
      updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [title, deck, body, genre, status, storyId],
    );
  } else {
    await rows(
      db,
      `INSERT INTO stories (id, parentId, rootId, level, authorId, status, title, deck, body, genre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        storyId,
        parentId,
        parent?.rootId || storyId,
        parent ? parent.level + 1 : 0,
        user.id,
        status,
        title,
        deck,
        body,
        genre,
      ],
    );
  }
  if (!asDraft && parent) {
    await notify(db, {
      type: "continuation",
      actorId: user.id,
      recipientId: parent.authorId,
      storyId,
      targetStoryId: parent.id,
      quote: title,
    });
  }
  return {
    storyId,
    status,
    created: !existing || (existing.status === "draft" && !asDraft),
  };
}

async function toggleStoryLike(db, user, data) {
  const storyId = cleanId(data.storyId, "Chapter ID");
  const story = await activeStory(db, storyId);
  const removed = await rows(
    db,
    "DELETE FROM storyLikes WHERE storyId = ? AND userId = ?",
    [storyId, user.id],
  );
  const liked = removed.affectedRows === 0;
  if (liked) {
    await rows(db, "INSERT INTO storyLikes (storyId, userId) VALUES (?, ?)", [
      storyId,
      user.id,
    ]);
    await notify(db, {
      type: "like",
      targetId: storyId,
      actorId: user.id,
      recipientId: story.authorId,
      storyId,
      quote: story.title,
    });
  }
  const { likes } = await one(
    db,
    "SELECT COUNT(*) AS likes FROM storyLikes WHERE storyId = ?",
    [storyId],
  );
  return { liked, likes: Number(likes) };
}

async function writeComment(db, user, story, text, target) {
  const id = randomUUID();
  const parentCommentId = target ? target.parentCommentId || target.id : null;
  await rows(
    db,
    `INSERT INTO comments (id, storyId, parentCommentId, replyToCommentId, authorId, status, text)
    VALUES (?, ?, ?, ?, ?, 'active', ?)`,
    [id, story.id, parentCommentId, target?.id || null, user.id, text],
  );
  await notify(db, {
    type: target ? "reply" : "comment",
    actorId: user.id,
    recipientId: target ? target.authorId : story.authorId,
    storyId: story.id,
    quote: text,
  });
  return {
    ...clientDates(await one(db, "SELECT * FROM comments WHERE id = ?", [id])),
    likes: 0,
    likedBy: [],
  };
}

async function addComment(db, user, data) {
  const storyId = cleanId(data.storyId, "Chapter ID");
  const text = cleanCommentText(data.text);
  const story = await activeStory(db, storyId);
  return writeComment(db, user, story, text, null);
}

async function addReply(db, user, data) {
  const replyToCommentId = cleanId(data.replyToCommentId, "Comment ID");
  const text = cleanCommentText(data.text);
  const target = await activeComment(db, replyToCommentId);
  const story = await activeStory(db, target.storyId);
  return writeComment(db, user, story, text, target);
}

async function toggleCommentLike(db, user, data) {
  const commentId = cleanId(data.commentId, "Comment ID");
  const comment = await activeComment(db, commentId);
  await activeStory(db, comment.storyId);
  const removed = await rows(
    db,
    "DELETE FROM commentLikes WHERE commentId = ? AND userId = ?",
    [commentId, user.id],
  );
  const liked = removed.affectedRows === 0;
  if (liked) {
    await rows(
      db,
      "INSERT INTO commentLikes (commentId, userId) VALUES (?, ?)",
      [commentId, user.id],
    );
    await notify(db, {
      type: "comment_like",
      targetId: commentId,
      actorId: user.id,
      recipientId: comment.authorId,
      storyId: comment.storyId,
      quote: comment.text,
    });
  }
  const { likes } = await one(
    db,
    "SELECT COUNT(*) AS likes FROM commentLikes WHERE commentId = ?",
    [commentId],
  );
  return { liked, likes: Number(likes) };
}

async function archiveStory(db, story, status, deletionSource) {
  await rows(
    db,
    "INSERT INTO storyArchives (storyId, title, deck, genre, body) VALUES (?, ?, ?, ?, ?)",
    [story.id, story.title, story.deck, story.genre, story.body],
  );
  const { title, deck, genre, body } = publicTombstone(status);
  await rows(
    db,
    `UPDATE stories SET status = ?, deletionSource = ?, title = ?, deck = ?, genre = ?, body = ?,
    updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?`,
    [status, deletionSource, title, deck, genre, body, story.id],
  );
}

async function reportStory(db, user, data) {
  const storyId = cleanId(data.storyId, "Chapter ID");
  const story = await activeStory(db, storyId);
  if (
    await one(
      db,
      "SELECT userId FROM reports WHERE storyId = ? AND userId = ?",
      [storyId, user.id],
    )
  ) {
    throw new AppError("already-exists", "You already reported this chapter.");
  }
  await rows(db, "INSERT INTO reports (storyId, userId) VALUES (?, ?)", [
    storyId,
    user.id,
  ]);
  const count = await one(
    db,
    "SELECT COUNT(*) AS reportCount FROM reports WHERE storyId = ?",
    [storyId],
  );
  const reportCount = Number(count.reportCount);
  if (reportCount < 4) return { reportCount, status: "active" };

  await archiveStory(db, story, "reported", "moderation");
  await logModeration(db, "story_auto_hidden", user.id, story);
  return { reportCount, status: "reported" };
}

async function deleteStory(db, user, data) {
  const storyId = cleanId(data.storyId, "Chapter ID");
  const story = await getStory(db, storyId);
  assertStoryOwner(story, user);
  if (story.status === "draft") {
    await rows(db, "DELETE FROM stories WHERE id = ?", [storyId]);
    return { storyId, status: "deleted", hardDeleted: true };
  }
  if (story.status !== "active") {
    throw new AppError(
      "failed-precondition",
      "Only active chapters can be deleted by their author.",
    );
  }
  await archiveStory(db, story, "deleted", "author");
  await rows(
    db,
    `UPDATE comments SET status = 'deleted', deletionSource = 'story', updatedAt = CURRENT_TIMESTAMP(3)
    WHERE storyId = ? AND status = 'active'`,
    [storyId],
  );
  await logModeration(db, "story_author_deleted", user.id, story);
  return { storyId, status: "deleted", hardDeleted: false };
}

async function moderateStory(db, user, data) {
  if (!user?.isAdmin)
    throw new AppError(
      "permission-denied",
      "Administrator access is required.",
    );
  const storyId = cleanId(data.storyId, "Chapter ID");
  const { action } = data;
  if (action !== "hide" && action !== "restore") {
    throw new AppError(
      "invalid-argument",
      "Moderation action must be hide or restore.",
    );
  }

  if (action === "hide") {
    const story = await activeStory(db, storyId);
    await archiveStory(db, story, "reported", "moderation");
    await logModeration(db, "story_hidden", user.id, story);
    return { storyId, status: "reported", previousStatus: story.status };
  }

  const story = await getStory(db, storyId);
  if (!["reported", "deleted"].includes(story.status)) {
    throw new AppError("failed-precondition", "This chapter is not hidden.");
  }
  if (story.deletionSource === "account") {
    throw new AppError(
      "failed-precondition",
      "Account-erased content cannot be restored.",
    );
  }
  const archive = await one(
    db,
    "SELECT title, deck, genre, body FROM storyArchives WHERE storyId = ?",
    [storyId],
  );
  if (!archive)
    throw new AppError(
      "failed-precondition",
      "The recoverable chapter archive is missing.",
    );

  await rows(
    db,
    `UPDATE stories SET title = ?, deck = ?, genre = ?, body = ?, status = 'active',
    deletionSource = NULL, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?`,
    [archive.title, archive.deck, archive.genre, archive.body, storyId],
  );
  await rows(
    db,
    `UPDATE comments SET status = 'active', deletionSource = NULL, updatedAt = CURRENT_TIMESTAMP(3)
    WHERE storyId = ? AND deletionSource = 'story'`,
    [storyId],
  );
  await rows(db, "DELETE FROM storyArchives WHERE storyId = ?", [storyId]);
  await rows(db, "DELETE FROM reports WHERE storyId = ?", [storyId]);
  await logModeration(db, "story_restored", user.id, story);
  return { storyId, status: "active", previousStatus: story.status };
}

async function markNotificationsRead(db, user, data) {
  const ids = data.notificationIds;
  if (ids === undefined) {
    const result = await rows(
      db,
      "UPDATE notifications SET readAt = CURRENT_TIMESTAMP(3) WHERE recipientId = ? AND readAt IS NULL",
      [user.id],
    );
    return { updated: result.affectedRows };
  }
  if (!Array.isArray(ids) || ids.length > 100) {
    throw new AppError(
      "invalid-argument",
      "Supply up to 100 notification IDs.",
    );
  }
  const validIds = [
    ...new Set(ids.map((id) => cleanId(id, "Notification ID"))),
  ];
  if (!validIds.length) return { updated: 0 };
  const placeholders = validIds.map(() => "?").join(", ");
  const result = await rows(
    db,
    `UPDATE notifications SET readAt = CURRENT_TIMESTAMP(3)
    WHERE recipientId = ? AND readAt IS NULL AND id IN (${placeholders})`,
    [user.id, ...validIds],
  );
  return { updated: result.affectedRows };
}

function parseCommentCursor(raw) {
  const { id, createdAt } = requireObject(raw, "Comment cursor");
  const timestamp = typeof createdAt === "string" ? Date.parse(createdAt) : NaN;
  if (
    !Number.isFinite(timestamp) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) ||
    createdAt !== new Date(timestamp).toISOString() ||
    createdAt < "1000-01-01T00:00:00.000Z"
  ) {
    throw new AppError("invalid-argument", "Comment cursor is invalid.");
  }
  return {
    id: cleanId(id, "Comment cursor ID"),
    timestamp: createdAt.slice(0, -1).replace("T", " "),
  };
}

async function getStoryComments(db, user, data) {
  const storyId = cleanId(data.storyId, "Chapter ID");
  await activeStory(db, storyId);

  const cursor = data.cursor == null ? null : parseCommentCursor(data.cursor);
  const cursorClause = cursor
    ? "AND (c.createdAt > ? OR (c.createdAt = ? AND c.id > ?))"
    : "";
  const result = await rows(
    db,
    `SELECT c.*,
      (SELECT COUNT(*) FROM commentLikes l WHERE l.commentId = c.id) AS likes,
      EXISTS(SELECT 1 FROM commentLikes l WHERE l.commentId = c.id AND l.userId = ?) AS isLiked
    FROM comments c JOIN stories s ON s.id = c.storyId AND s.status = 'active'
    WHERE c.storyId = ? AND (c.status = 'active' OR c.deletionSource = 'account') ${cursorClause}
    ORDER BY c.createdAt, c.id LIMIT ${COMMENT_PAGE_SIZE + 1}`,
    [
      user?.id ?? null,
      storyId,
      ...(cursor ? [cursor.timestamp, cursor.timestamp, cursor.id] : []),
    ],
  );
  const comments = result
    .slice(0, COMMENT_PAGE_SIZE)
    .map(({ isLiked, likes, ...comment }) => ({
      ...clientDates(comment),
      likes: Number(likes),
      likedBy: isLiked && user ? [user.id] : [],
    }));
  const authorIds = [
    ...new Set(comments.map((comment) => comment.authorId).filter(Boolean)),
  ];
  const users = authorIds.length
    ? await rows(
        db,
        `SELECT id, name, handle, initials, tone, bio, avatarUrl, createdAt, updatedAt
    FROM users WHERE id IN (${authorIds.map(() => "?").join(", ")})`,
        authorIds,
      )
    : [];
  const lastComment = comments.at(-1);
  return {
    comments,
    users: users.map(clientDates),
    nextCursor:
      result.length > COMMENT_PAGE_SIZE
        ? { id: lastComment.id, createdAt: lastComment.createdAt }
        : null,
  };
}

export const content = {
  saveStory,
  toggleStoryLike,
  addComment,
  addReply,
  toggleCommentLike,
  reportStory,
  deleteStory,
  moderateStory,
  markNotificationsRead,
  getStoryComments,
};
