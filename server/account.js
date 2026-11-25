import { clientDates, one, rows } from "./db.js";
import { AppError, cleanProfileInput, publicTombstone, requireRecentAuth } from "./model.js";

const STORY_LIMIT = 500;
const PROFILE_FIELDS = "id, name, handle, initials, tone, bio, avatarUrl, createdAt, updatedAt";

function publicProfile(profile, isAdmin) {
  return { ...clientDates(profile), role: isAdmin ? "admin" : "user" };
}

export async function bootstrap(db, user) {
  const uid = user?.id ?? null;
  const isAdmin = user?.isAdmin === true;
  const chapters = await rows(db, `
    SELECT s.*,
      (SELECT COUNT(*) FROM storyLikes WHERE storyId = s.id) AS likes,
      (SELECT COUNT(*) FROM comments WHERE storyId = s.id AND status = 'active') AS commentCount,
      EXISTS(SELECT 1 FROM storyLikes WHERE storyId = s.id AND userId = ?) AS liked,
      EXISTS(SELECT 1 FROM reports WHERE storyId = s.id AND userId = ?) AS reported,
      CASE WHEN ? THEN (SELECT COUNT(*) FROM reports WHERE storyId = s.id) ELSE 0 END AS reportCount,
      a.title AS archivedTitle, a.deck AS archivedDeck, a.body AS archivedBody, a.genre AS archivedGenre
    FROM (SELECT * FROM stories WHERE status <> 'draft' ORDER BY updatedAt DESC, id DESC LIMIT ?) AS s
    LEFT JOIN storyArchives a ON ? AND a.storyId = s.id
    ORDER BY s.updatedAt DESC, s.id DESC`,
    [uid, uid, isAdmin, STORY_LIMIT + 1, isAdmin],
  );
  const stories = chapters.slice(0, STORY_LIMIT).map((chapter) => {
    const { liked, reported, archivedTitle, archivedDeck, archivedBody, archivedGenre, ...story } = chapter;
    if (archivedTitle != null) {
      Object.assign(story, { title: archivedTitle, deck: archivedDeck, body: archivedBody, genre: archivedGenre });
    }
    return { ...clientDates(story), likedBy: liked ? [uid] : [], reportedBy: reported ? [uid] : [] };
  });

  const notifications = uid ? (await rows(db, `
    SELECT n.id, n.type, n.actorId, n.recipientId, n.storyId, n.targetStoryId, n.readAt, n.createdAt,
      CASE WHEN s.status = 'active' AND t.status = 'active' THEN n.\`quote\` ELSE '' END AS \`quote\`
    FROM notifications n JOIN stories s ON s.id = n.storyId JOIN stories t ON t.id = n.targetStoryId
    WHERE n.recipientId = ?
    ORDER BY (n.readAt IS NULL) DESC, n.createdAt DESC, n.id DESC LIMIT 200`, [uid])
  ).map((note) => ({ ...clientDates(note), read: note.readAt != null })) : [];
  const unreadCount = uid ? Number((await one(db,
    "SELECT COUNT(*) AS total FROM notifications WHERE recipientId = ? AND readAt IS NULL", [uid],
  )).total) : 0;
  const auditLog = isAdmin ? (await rows(db,
    "SELECT * FROM moderationAudit ORDER BY createdAt DESC, id DESC LIMIT 300",
  )).map(clientDates) : [];

  if (uid) {
    const drafts = await rows(db, `
      SELECT * FROM stories WHERE authorId = ? AND status = 'draft' ORDER BY updatedAt DESC, id DESC LIMIT 200
    `, [uid]);
    for (const draft of drafts) {
      stories.push({ ...clientDates(draft), likes: 0, commentCount: 0, reportCount: 0, likedBy: [], reportedBy: [] });
    }
  }
  const profileIds = [...new Set([
    uid,
    ...stories.map((story) => story.authorId),
    ...notifications.map((note) => note.actorId),
    ...auditLog.map((entry) => entry.actorId),
  ].filter(Boolean))];
  const profiles = profileIds.length ? await rows(db,
    `SELECT ${PROFILE_FIELDS} FROM users WHERE id IN (${profileIds.map(() => "?").join(",")})`, profileIds,
  ) : [];
  const users = profiles.map((profile) => publicProfile(profile, isAdmin && profile.id === uid));
  return {
    users, stories, comments: [], notifications, unreadCount, auditLog,
    currentUser: users.find((profile) => profile.id === uid) ?? null,
    isAdmin, truncated: chapters.length > STORY_LIMIT,
  };
}

export async function ensureProfile(db, user, data) {
  const profile = cleanProfileInput(data, { name: user.name, picture: user.avatarUrl });
  const { name, handle, initials, tone, bio, avatarUrl } = profile;
  await rows(db, `
    UPDATE users SET name = ?, handle = ?, initials = ?, tone = ?, bio = ?, avatarUrl = ? WHERE id = ?
  `, [name, handle, initials, tone, bio, avatarUrl, user.id]);
  const updated = await one(db, `SELECT ${PROFILE_FIELDS} FROM users WHERE id = ?`, [user.id]);
  return publicProfile(updated, user.isAdmin);
}

export async function deleteAccount(db, user) {
  requireRecentAuth(user);
  if (user.isAdmin) {
    throw new AppError("failed-precondition", "Assign a different administrator before deleting this account.");
  }
  const uid = user.id;
  // Remove all comments under the erased stories, and redact only this user's
  // comments on other stories so replies from the community stay connected.
  await rows(db, "DELETE a FROM storyArchives a JOIN stories s ON s.id = a.storyId WHERE s.authorId = ?", [uid]);
  await rows(db, "DELETE n FROM notifications n JOIN stories s ON s.id IN (n.storyId, n.targetStoryId) WHERE s.authorId = ?", [uid]);
  await rows(db, "DELETE c FROM comments c JOIN stories s ON s.id = c.storyId WHERE s.authorId = ?", [uid]);
  await rows(db, "DELETE l FROM commentLikes l JOIN comments c ON c.id = l.commentId WHERE c.authorId = ?", [uid]);
  await rows(db, `
    UPDATE comments SET authorId = NULL, text = '', status = 'deleted', deletionSource = 'account'
    WHERE authorId = ?`, [uid]);
  await rows(db, "DELETE l FROM storyLikes l JOIN stories s ON s.id = l.storyId WHERE s.authorId = ?", [uid]);
  await rows(db, "DELETE r FROM reports r JOIN stories s ON s.id = r.storyId WHERE s.authorId = ?", [uid]);
  await rows(db, "DELETE FROM stories WHERE authorId = ? AND status = 'draft'", [uid]);
  const { title, deck, body, genre } = publicTombstone("deleted");
  const result = await rows(db, `
    UPDATE stories SET authorId = NULL, status = 'deleted', deletionSource = 'account',
      title = ?, deck = ?, body = ?, genre = ?
    WHERE authorId = ?`, [title, deck, body, genre, uid]);
  // Foreign keys remove sessions, provider identities and personal
  // likes/reports/notifications. Audit rows retain their action with no actor.
  await rows(db, "DELETE FROM users WHERE id = ?", [uid]);
  return { deleted: true, preservedStoryNodes: result.affectedRows };
}
