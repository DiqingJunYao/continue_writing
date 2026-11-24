"use strict";

const { createHash } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore
} = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { setGlobalOptions } = require("firebase-functions/v2");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const {
  MAX_TREE_DEPTH,
  assertActive,
  assertOwner,
  cleanCommentText,
  cleanId,
  cleanProfileInput,
  cleanStoryInput,
  publicTombstone,
  requireAdmin,
  requireAuth,
  requireRecentAuth,
  requireObject,
  snapshotToClient,
  toClientValue
} = require("./lib/model");

initializeApp();
const db = getFirestore();

setGlobalOptions({
  region: "europe-west1",
  maxInstances: 40,
  concurrency: 40,
  timeoutSeconds: 120,
  memory: "256MiB"
});

const COLLECTIONS = Object.freeze({
  profiles: "profiles",
  stories: "stories",
  archives: "storyArchives",
  drafts: "drafts",
  comments: "comments",
  storyLikes: "storyLikes",
  commentLikes: "commentLikes",
  reports: "reports",
  notifications: "notifications",
  audit: "moderationAudit",
  accountDeletionJobs: "accountDeletionJobs",
  system: "system"
});
const ADMINISTRATOR_DOCUMENT = "administrator";

// Switch to true only after the production web app is sending valid App Check
// tokens and the Firebase metrics confirm legitimate traffic is verified. The
// callable wrapper keeps enforcement off inside the local Functions emulator.
const ENFORCE_APP_CHECK = false;

const callable = (handler, options = {}) => onCall({
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR === "true" ? false : ENFORCE_APP_CHECK,
  ...options
}, async (request) => {
  try {
    return await handler(request);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Unhandled Branchline function error", error);
    throw new HttpsError("internal", "The server could not complete that request.");
  }
});

function timestamp() {
  return FieldValue.serverTimestamp();
}

function likeDocumentId(targetId, uid) {
  return `${targetId}__${uid}`;
}

function accountAuditId(uid) {
  return `account_${createHash("sha256").update(uid).digest("hex")}`;
}

function deletionJobReference(uid) {
  return db.collection(COLLECTIONS.accountDeletionJobs).doc(accountAuditId(uid));
}

function assertAccountWritableSnapshot(snapshot) {
  if (snapshot.exists) {
    throw new HttpsError(
      "failed-precondition",
      "This action is unavailable while an involved account is being deleted."
    );
  }
}

async function assertAccountWritable(transaction, uid) {
  const snapshot = await transaction.get(deletionJobReference(uid));
  assertAccountWritableSnapshot(snapshot);
}

async function assertAccountWritableDirect(uid) {
  const snapshot = await deletionJobReference(uid).get();
  assertAccountWritableSnapshot(snapshot);
}

async function isConfiguredAdministrator(uid, hasAdminClaim) {
  if (!uid || !hasAdminClaim) return false;
  const snapshot = await db.collection(COLLECTIONS.system).doc(ADMINISTRATOR_DOCUMENT).get();
  return snapshot.exists && snapshot.data().uid === uid;
}

async function requireConfiguredAdministrator(request) {
  const uid = requireAdmin(request);
  if (!await isConfiguredAdministrator(uid, true)) {
    throw new HttpsError("permission-denied", "This account is not the designated administrator.");
  }
  return uid;
}

function archiveFromStory(story, archivedStatus, deletionSource) {
  return {
    title: story.title || "",
    deck: story.deck || "",
    body: story.body || "",
    genre: story.genre || "Speculative",
    authorId: story.authorId || null,
    archivedStatus,
    deletionSource,
    archivedAt: timestamp(),
    originalCreatedAt: story.createdAt || null
  };
}

function notificationPayload({ type, actorId, recipientId, storyId, targetStoryId, quote }) {
  return {
    type,
    actorId,
    recipientId,
    storyId,
    targetStoryId: targetStoryId || storyId,
    quote: String(quote || "").slice(0, 180),
    read: false,
    createdAt: timestamp()
  };
}

function createNotification(transaction, values) {
  if (!values.recipientId || values.recipientId === values.actorId) return;
  const reference = values.notificationId
    ? db.collection(COLLECTIONS.notifications).doc(values.notificationId)
    : db.collection(COLLECTIONS.notifications).doc();
  transaction.set(reference, notificationPayload(values));
}

function storyDocument({ id, parent, authorId, values }) {
  const parentId = parent?.id || null;
  return {
    parentId,
    rootId: parent ? (parent.rootId || parent.id) : id,
    level: parent ? Number(parent.level || 0) + 1 : 0,
    authorId,
    status: "active",
    deletionSource: null,
    reportCount: 0,
    title: values.title,
    deck: values.deck,
    body: values.body,
    genre: values.genre,
    createdAt: timestamp(),
    updatedAt: timestamp(),
    likes: 0,
    commentCount: 0,
    views: 0
  };
}

function draftDocument({ id, parent, authorId, values, existingCreatedAt = null }) {
  return {
    parentId: parent?.id || null,
    rootId: parent ? (parent.rootId || parent.id) : id,
    level: parent ? Number(parent.level || 0) + 1 : 0,
    authorId,
    status: "draft",
    title: values.title,
    deck: values.deck,
    body: values.body,
    genre: values.genre,
    createdAt: existingCreatedAt || timestamp(),
    updatedAt: timestamp(),
    likes: 0,
    commentCount: 0,
    views: 0,
    reportCount: 0
  };
}

async function getParentInTransaction(transaction, parentId) {
  if (!parentId) return null;
  const reference = db.collection(COLLECTIONS.stories).doc(cleanId(parentId, "Parent chapter ID"));
  const snapshot = await transaction.get(reference);
  assertActive(snapshot, "Parent chapter");
  const parent = { id: snapshot.id, ...snapshot.data() };
  if (Number(parent.level || 0) >= MAX_TREE_DEPTH) {
    throw new HttpsError("failed-precondition", "This story has reached the maximum supported depth.");
  }
  return parent;
}

async function updateQuery(query, changes) {
  const snapshot = await query.get();
  if (snapshot.empty) return 0;
  const writer = db.bulkWriter();
  snapshot.docs.forEach((document) => writer.update(document.ref, changes));
  await writer.close();
  return snapshot.size;
}

async function deleteQuery(query) {
  const snapshot = await query.get();
  if (snapshot.empty) return 0;
  const writer = db.bulkWriter();
  snapshot.docs.forEach((document) => writer.delete(document.ref));
  await writer.close();
  return snapshot.size;
}

async function deleteDocuments(documents) {
  if (!documents.length) return 0;
  const writer = db.bulkWriter();
  const unique = new Map(documents.map((document) => [document.ref.path, document]));
  unique.forEach((document) => writer.delete(document.ref));
  await writer.close();
  return unique.size;
}

async function queryByChunks(collection, field, values, chunkSize = 30) {
  const unique = [...new Set(values.filter(Boolean))];
  const documents = [];
  for (let index = 0; index < unique.length; index += chunkSize) {
    const chunk = unique.slice(index, index + chunkSize);
    if (!chunk.length) continue;
    const snapshot = await db.collection(collection).where(field, "in", chunk).get();
    documents.push(...snapshot.docs);
  }
  return documents;
}

async function clearStoryReports(storyId) {
  return deleteQuery(db.collection(COLLECTIONS.reports).where("storyId", "==", storyId));
}

async function restoreStoryComments(storyId) {
  const snapshot = await db.collection(COLLECTIONS.comments)
    .where("storyId", "==", storyId)
    .where("deletionSource", "==", "story")
    .get();
  if (snapshot.empty) return 0;
  const writer = db.bulkWriter();
  snapshot.docs.forEach((document) => writer.update(document.ref, {
    status: "active",
    deletionSource: null,
    updatedAt: timestamp()
  }));
  await writer.close();
  return snapshot.size;
}

exports.bootstrap = callable(async (request) => {
  const uid = request.auth?.uid || null;
  const isAdmin = await isConfiguredAdministrator(uid, request.auth?.token?.admin === true);

  const storiesPromise = db.collection(COLLECTIONS.stories)
    .orderBy("updatedAt", "desc")
    .limit(501)
    .get();
  const draftsPromise = uid
    ? db.collection(COLLECTIONS.drafts).where("authorId", "==", uid).limit(200).get()
    : Promise.resolve(null);
  const notificationsPromise = uid
    ? db.collection(COLLECTIONS.notifications)
      .where("recipientId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get()
    : Promise.resolve(null);
  const storyLikesPromise = uid
    ? db.collection(COLLECTIONS.storyLikes).where("userId", "==", uid).limit(1000).get()
    : Promise.resolve(null);
  const reportsPromise = uid
    ? db.collection(COLLECTIONS.reports).where("userId", "==", uid).limit(1000).get()
    : Promise.resolve(null);
  const auditPromise = isAdmin
    ? db.collection(COLLECTIONS.audit).orderBy("createdAt", "desc").limit(300).get()
    : Promise.resolve(null);

  const [
    storiesSnapshot,
    draftsSnapshot,
    notificationsSnapshot,
    storyLikesSnapshot,
    reportsSnapshot,
    auditSnapshot
  ] = await Promise.all([
    storiesPromise,
    draftsPromise,
    notificationsPromise,
    storyLikesPromise,
    reportsPromise,
    auditPromise
  ]);

  const storyDocuments = storiesSnapshot.docs.slice(0, 500);
  const storyLikes = new Set(storyLikesSnapshot?.docs.map((document) => document.data().storyId) || []);
  const reportedStories = new Set(reportsSnapshot?.docs.map((document) => document.data().storyId) || []);
  const archiveDocuments = isAdmin
    ? await getDocumentsByIds(COLLECTIONS.archives, storyDocuments.map((document) => document.id))
    : [];
  const archives = new Map(archiveDocuments.map((document) => [document.id, document.data()]));

  const stories = storyDocuments.map((document) => {
    const value = snapshotToClient(document);
    if (isAdmin && archives.has(document.id)) {
      Object.assign(value, toClientValue(archives.get(document.id)));
    }
    value.likedBy = storyLikes.has(document.id) && uid ? [uid] : [];
    value.reportedBy = reportedStories.has(document.id) && uid ? [uid] : [];
    if (!isAdmin) value.reportCount = 0;
    return value;
  });

  if (draftsSnapshot) {
    draftsSnapshot.docs.forEach((document) => {
      stories.push({
        ...snapshotToClient(document),
        likedBy: [],
        reportedBy: [],
        reportCount: 0
      });
    });
  }

  const notifications = notificationsSnapshot?.docs.map(snapshotToClient) || [];
  const auditLog = auditSnapshot?.docs.map(snapshotToClient) || [];
  const profileIds = [
    uid,
    ...stories.map((story) => story.authorId),
    ...notifications.map((notification) => notification.actorId),
    ...auditLog.map((entry) => entry.actorId)
  ];
  const profileDocuments = await getDocumentsByIds(COLLECTIONS.profiles, profileIds);
  const users = profileDocuments.map((document) => ({
    ...snapshotToClient(document),
    role: document.id === uid && isAdmin ? "admin" : "user"
  }));
  const currentUser = uid ? users.find((user) => user.id === uid) || null : null;

  return {
    schemaVersion: 4,
    users,
    stories,
    comments: [],
    notifications,
    auditLog,
    currentUser,
    isAdmin,
    truncated: storiesSnapshot.size > 500
  };
});

exports.getStoryComments = callable(async (request) => {
  const uid = request.auth?.uid || null;
  const storyId = cleanId(request.data?.storyId, "Chapter ID");
  const storySnapshot = await db.collection(COLLECTIONS.stories).doc(storyId).get();
  assertActive(storySnapshot);

  let query = db.collection(COLLECTIONS.comments)
    .where("storyId", "==", storyId)
    .orderBy("createdAt", "asc")
    .orderBy(FieldPath.documentId(), "asc")
    .limit(101);

  if (request.data?.cursor != null) {
    const cursor = requireObject(request.data.cursor, "Comment cursor");
    const cursorId = cleanId(cursor.id, "Comment cursor ID");
    const seconds = Number(cursor.seconds);
    const nanoseconds = Number(cursor.nanoseconds);
    if (
      !Number.isSafeInteger(seconds)
      || !Number.isInteger(nanoseconds)
      || nanoseconds < 0
      || nanoseconds > 999999999
    ) {
      throw new HttpsError("invalid-argument", "Comment cursor is invalid.");
    }
    query = query.startAfter(new Timestamp(seconds, nanoseconds), cursorId);
  }

  const snapshot = await query.get();
  const pageDocuments = snapshot.docs.slice(0, 100);
  const visibleDocuments = pageDocuments.filter((document) => {
    const comment = document.data();
    return comment.status === "active" || comment.deletionSource === "account";
  });
  const likedCommentIds = new Set();
  if (uid && visibleDocuments.length) {
    const likeSnapshots = await db.getAll(...visibleDocuments.map((document) => (
      db.collection(COLLECTIONS.commentLikes).doc(likeDocumentId(document.id, uid))
    )));
    likeSnapshots.forEach((document, index) => {
      if (document.exists) likedCommentIds.add(visibleDocuments[index].id);
    });
  }

  const profileDocuments = await getDocumentsByIds(
    COLLECTIONS.profiles,
    visibleDocuments.map((document) => document.data().authorId)
  );
  const comments = visibleDocuments.map((document) => ({
    ...snapshotToClient(document),
    likedBy: likedCommentIds.has(document.id) && uid ? [uid] : []
  }));
  const lastDocument = pageDocuments.at(-1);
  const lastCreatedAt = lastDocument?.data().createdAt;

  return {
    comments,
    users: profileDocuments.map(snapshotToClient),
    nextCursor: snapshot.size > 100 && lastDocument && lastCreatedAt instanceof Timestamp
      ? {
        id: lastDocument.id,
        seconds: lastCreatedAt.seconds,
        nanoseconds: lastCreatedAt.nanoseconds
      }
      : null
  };
});

exports.ensureProfile = callable(async (request) => {
  const uid = requireAuth(request);
  const profile = cleanProfileInput(request.data || {}, request.auth.token || {});
  const reference = db.collection(COLLECTIONS.profiles).doc(uid);
  await db.runTransaction(async (transaction) => {
    const [existing, deletionJob] = await Promise.all([
      transaction.get(reference),
      transaction.get(deletionJobReference(uid))
    ]);
    assertAccountWritableSnapshot(deletionJob);
    const value = {
      ...profile,
      updatedAt: timestamp()
    };
    if (!existing.exists) value.createdAt = timestamp();
    transaction.set(reference, value, { merge: true });
  });
  const refreshed = await reference.get();
  const isAdmin = await isConfiguredAdministrator(uid, request.auth.token.admin === true);
  return { ...snapshotToClient(refreshed), role: isAdmin ? "admin" : "user" };
});

exports.saveStory = callable(async (request) => {
  const uid = requireAuth(request);
  const payload = requireObject(request.data || {});
  const requestedId = cleanId(payload.storyId, "Chapter ID", { optional: true });
  const requestedParentId = cleanId(payload.parentId, "Parent chapter ID", { optional: true });
  const asDraft = payload.asDraft === true;
  const publish = payload.publish === true;
  const values = cleanStoryInput(payload, { draft: asDraft && !publish });
  const generatedReference = db.collection(COLLECTIONS.stories).doc();
  const storyId = requestedId || generatedReference.id;
  if (requestedParentId === storyId) {
    throw new HttpsError("invalid-argument", "A chapter cannot continue itself.");
  }

  const result = await db.runTransaction(async (transaction) => {
    const storyReference = db.collection(COLLECTIONS.stories).doc(storyId);
    const draftReference = db.collection(COLLECTIONS.drafts).doc(storyId);
    const [storySnapshot, draftSnapshot, deletionJob] = await Promise.all([
      transaction.get(storyReference),
      transaction.get(draftReference),
      transaction.get(deletionJobReference(uid))
    ]);
    assertAccountWritableSnapshot(deletionJob);

    if (storySnapshot.exists) {
      assertOwner(storySnapshot, uid, "chapter");
      if (storySnapshot.data().status !== "active") {
        throw new HttpsError("failed-precondition", "Unavailable chapters cannot be edited.");
      }
      if (asDraft || publish) {
        throw new HttpsError("failed-precondition", "Published chapters cannot be converted to drafts.");
      }
      transaction.update(storyReference, { ...values, updatedAt: timestamp() });
      return { storyId, status: "active", created: false };
    }

    if (requestedId && !draftSnapshot.exists) {
      throw new HttpsError("not-found", "Draft was not found.");
    }

    if (draftSnapshot.exists) assertOwner(draftSnapshot, uid, "draft");
    const draft = draftSnapshot.exists ? draftSnapshot.data() : null;
    const parentId = draft?.parentId || requestedParentId;
    const parent = await getParentInTransaction(transaction, parentId);
    if (parent?.authorId) await assertAccountWritable(transaction, parent.authorId);

    if (asDraft && !publish) {
      transaction.set(draftReference, draftDocument({
        id: storyId,
        parent,
        authorId: uid,
        values,
        existingCreatedAt: draft?.createdAt || null
      }), { merge: false });
      return { storyId, status: "draft", created: !draftSnapshot.exists };
    }

    const story = storyDocument({ id: storyId, parent, authorId: uid, values });
    transaction.create(storyReference, story);
    if (draftSnapshot.exists) transaction.delete(draftReference);
    if (parent) {
      createNotification(transaction, {
        type: "continuation",
        notificationId: `continuation__${storyId}`,
        actorId: uid,
        recipientId: parent.authorId,
        storyId,
        targetStoryId: parent.id,
        quote: values.title
      });
    }
    return { storyId, status: "active", created: true };
  });

  return result;
});

exports.toggleStoryLike = callable(async (request) => {
  const uid = requireAuth(request);
  const storyId = cleanId(request.data?.storyId, "Chapter ID");
  return db.runTransaction(async (transaction) => {
    const storyReference = db.collection(COLLECTIONS.stories).doc(storyId);
    const likeReference = db.collection(COLLECTIONS.storyLikes).doc(likeDocumentId(storyId, uid));
    const [storySnapshot, likeSnapshot, deletionJob] = await Promise.all([
      transaction.get(storyReference),
      transaction.get(likeReference),
      transaction.get(deletionJobReference(uid))
    ]);
    assertAccountWritableSnapshot(deletionJob);
    assertActive(storySnapshot);
    const story = storySnapshot.data();
    if (story.authorId) await assertAccountWritable(transaction, story.authorId);
    const currentLikes = Math.max(0, Number(story.likes || 0));
    if (likeSnapshot.exists) {
      const likes = Math.max(0, currentLikes - 1);
      transaction.delete(likeReference);
      transaction.update(storyReference, { likes });
      return { liked: false, likes };
    }
    const likes = currentLikes + 1;
    transaction.create(likeReference, { storyId, userId: uid, createdAt: timestamp() });
    transaction.update(storyReference, { likes });
    createNotification(transaction, {
      type: "like",
      notificationId: `story_like__${storyId}__${uid}`,
      actorId: uid,
      recipientId: story.authorId,
      storyId,
      quote: story.title
    });
    return { liked: true, likes };
  });
});

exports.addComment = callable(async (request) => {
  const uid = requireAuth(request);
  const storyId = cleanId(request.data?.storyId, "Chapter ID");
  const text = cleanCommentText(request.data?.text);
  const commentReference = db.collection(COLLECTIONS.comments).doc();
  await db.runTransaction(async (transaction) => {
    const storyReference = db.collection(COLLECTIONS.stories).doc(storyId);
    const [storySnapshot, deletionJob] = await Promise.all([
      transaction.get(storyReference),
      transaction.get(deletionJobReference(uid))
    ]);
    assertAccountWritableSnapshot(deletionJob);
    assertActive(storySnapshot);
    const story = storySnapshot.data();
    if (story.authorId) await assertAccountWritable(transaction, story.authorId);
    transaction.create(commentReference, {
      storyId,
      parentCommentId: null,
      replyToCommentId: null,
      authorId: uid,
      status: "active",
      deletionSource: null,
      text,
      createdAt: timestamp(),
      updatedAt: timestamp(),
      likes: 0
    });
    transaction.update(storyReference, {
      commentCount: Math.max(0, Number(story.commentCount || 0)) + 1
    });
    createNotification(transaction, {
      type: "comment",
      notificationId: `comment__${commentReference.id}`,
      actorId: uid,
      recipientId: story.authorId,
      storyId,
      quote: text
    });
  });
  const created = await commentReference.get();
  return snapshotToClient(created);
});

exports.addReply = callable(async (request) => {
  const uid = requireAuth(request);
  const replyToCommentId = cleanId(request.data?.replyToCommentId, "Comment ID");
  const text = cleanCommentText(request.data?.text);
  const replyReference = db.collection(COLLECTIONS.comments).doc();
  await db.runTransaction(async (transaction) => {
    const targetReference = db.collection(COLLECTIONS.comments).doc(replyToCommentId);
    const [targetSnapshot, deletionJob] = await Promise.all([
      transaction.get(targetReference),
      transaction.get(deletionJobReference(uid))
    ]);
    assertAccountWritableSnapshot(deletionJob);
    if (!targetSnapshot.exists || targetSnapshot.data().status !== "active") {
      throw new HttpsError("not-found", "The comment is no longer available.");
    }
    const target = targetSnapshot.data();
    const storyReference = db.collection(COLLECTIONS.stories).doc(target.storyId);
    const storySnapshot = await transaction.get(storyReference);
    assertActive(storySnapshot);
    const story = storySnapshot.data();
    await Promise.all([
      target.authorId ? assertAccountWritable(transaction, target.authorId) : Promise.resolve(),
      story.authorId ? assertAccountWritable(transaction, story.authorId) : Promise.resolve()
    ]);
    transaction.create(replyReference, {
      storyId: target.storyId,
      parentCommentId: target.parentCommentId || targetSnapshot.id,
      replyToCommentId: targetSnapshot.id,
      authorId: uid,
      status: "active",
      deletionSource: null,
      text,
      createdAt: timestamp(),
      updatedAt: timestamp(),
      likes: 0
    });
    transaction.update(storyReference, {
      commentCount: Math.max(0, Number(story.commentCount || 0)) + 1
    });
    createNotification(transaction, {
      type: "reply",
      notificationId: `reply__${replyReference.id}`,
      actorId: uid,
      recipientId: target.authorId,
      storyId: target.storyId,
      quote: text
    });
  });
  const created = await replyReference.get();
  return snapshotToClient(created);
});

exports.toggleCommentLike = callable(async (request) => {
  const uid = requireAuth(request);
  const commentId = cleanId(request.data?.commentId, "Comment ID");
  return db.runTransaction(async (transaction) => {
    const commentReference = db.collection(COLLECTIONS.comments).doc(commentId);
    const likeReference = db.collection(COLLECTIONS.commentLikes).doc(likeDocumentId(commentId, uid));
    const [commentSnapshot, likeSnapshot, deletionJob] = await Promise.all([
      transaction.get(commentReference),
      transaction.get(likeReference),
      transaction.get(deletionJobReference(uid))
    ]);
    assertAccountWritableSnapshot(deletionJob);
    if (!commentSnapshot.exists || commentSnapshot.data().status !== "active") {
      throw new HttpsError("not-found", "The comment is no longer available.");
    }
    const comment = commentSnapshot.data();
    const storyReference = db.collection(COLLECTIONS.stories).doc(comment.storyId);
    const storySnapshot = await transaction.get(storyReference);
    assertActive(storySnapshot);
    const story = storySnapshot.data();
    await Promise.all([
      comment.authorId ? assertAccountWritable(transaction, comment.authorId) : Promise.resolve(),
      story.authorId ? assertAccountWritable(transaction, story.authorId) : Promise.resolve()
    ]);
    const currentLikes = Math.max(0, Number(comment.likes || 0));
    if (likeSnapshot.exists) {
      const likes = Math.max(0, currentLikes - 1);
      transaction.delete(likeReference);
      transaction.update(commentReference, { likes });
      return { liked: false, likes };
    }
    const likes = currentLikes + 1;
    transaction.create(likeReference, { commentId, userId: uid, createdAt: timestamp() });
    transaction.update(commentReference, { likes });
    createNotification(transaction, {
      type: "comment_like",
      notificationId: `comment_like__${commentId}__${uid}`,
      actorId: uid,
      recipientId: comment.authorId,
      storyId: comment.storyId,
      quote: comment.text
    });
    return { liked: true, likes };
  });
});

exports.reportStory = callable(async (request) => {
  const uid = requireAuth(request);
  const storyId = cleanId(request.data?.storyId, "Chapter ID");
  return db.runTransaction(async (transaction) => {
    const storyReference = db.collection(COLLECTIONS.stories).doc(storyId);
    const reportReference = db.collection(COLLECTIONS.reports).doc(likeDocumentId(storyId, uid));
    const archiveReference = db.collection(COLLECTIONS.archives).doc(storyId);
    const [storySnapshot, reportSnapshot, deletionJob] = await Promise.all([
      transaction.get(storyReference),
      transaction.get(reportReference),
      transaction.get(deletionJobReference(uid))
    ]);
    assertAccountWritableSnapshot(deletionJob);
    assertActive(storySnapshot);
    if (reportSnapshot.exists) {
      throw new HttpsError("already-exists", "You already reported this chapter.");
    }
    const story = storySnapshot.data();
    if (story.authorId) await assertAccountWritable(transaction, story.authorId);
    const reportCount = Math.max(0, Number(story.reportCount || 0)) + 1;
    transaction.create(reportReference, { storyId, userId: uid, createdAt: timestamp() });
    if (reportCount < 4) {
      transaction.update(storyReference, { reportCount });
      return { reportCount, status: "active" };
    }
    transaction.set(archiveReference, archiveFromStory(story, "reported", "moderation"), { merge: false });
    transaction.update(storyReference, {
      ...publicTombstone("reported"),
      status: "reported",
      deletionSource: "moderation",
      reportCount,
      updatedAt: timestamp()
    });
    transaction.create(db.collection(COLLECTIONS.audit).doc(), {
      action: "story_auto_hidden",
      actorId: uid,
      storyId,
      previousStatus: "active",
      createdAt: timestamp()
    });
    return { reportCount, status: "reported" };
  });
});

exports.deleteStory = callable(async (request) => {
  const uid = requireAuth(request);
  const storyId = cleanId(request.data?.storyId, "Chapter ID");
  const result = await db.runTransaction(async (transaction) => {
    const storyReference = db.collection(COLLECTIONS.stories).doc(storyId);
    const draftReference = db.collection(COLLECTIONS.drafts).doc(storyId);
    const archiveReference = db.collection(COLLECTIONS.archives).doc(storyId);
    const [storySnapshot, draftSnapshot, deletionJob] = await Promise.all([
      transaction.get(storyReference),
      transaction.get(draftReference),
      transaction.get(deletionJobReference(uid))
    ]);
    assertAccountWritableSnapshot(deletionJob);
    if (draftSnapshot.exists) {
      assertOwner(draftSnapshot, uid, "draft");
      transaction.delete(draftReference);
      return { storyId, status: "deleted", hardDeleted: true };
    }
    assertOwner(storySnapshot, uid, "chapter");
    if (storySnapshot.data().status !== "active") {
      throw new HttpsError("failed-precondition", "Only active chapters can be deleted by their author.");
    }
    const story = storySnapshot.data();
    transaction.set(archiveReference, archiveFromStory(story, "deleted", "author"), { merge: false });
    transaction.update(storyReference, {
      ...publicTombstone("deleted"),
      status: "deleted",
      deletionSource: "author",
      updatedAt: timestamp()
    });
    transaction.create(db.collection(COLLECTIONS.audit).doc(), {
      action: "story_author_deleted",
      actorId: uid,
      storyId,
      previousStatus: "active",
      createdAt: timestamp()
    });
    return { storyId, status: "deleted", hardDeleted: false };
  });

  if (!result.hardDeleted) {
    await updateQuery(
      db.collection(COLLECTIONS.comments).where("storyId", "==", storyId).where("status", "==", "active"),
      { status: "deleted", deletionSource: "story", updatedAt: timestamp() }
    );
  }
  return result;
});

exports.moderateStory = callable(async (request) => {
  const adminId = await requireConfiguredAdministrator(request);
  await assertAccountWritableDirect(adminId);
  const storyId = cleanId(request.data?.storyId, "Chapter ID");
  const action = request.data?.action;
  if (action !== "hide" && action !== "restore") {
    throw new HttpsError("invalid-argument", "Moderation action must be hide or restore.");
  }

  // Clean up while the public node is still hidden. If cleanup fails, the
  // operation is safe to retry and no comments or reports become public.
  if (action === "restore") {
    const [storySnapshot, archiveSnapshot] = await Promise.all([
      db.collection(COLLECTIONS.stories).doc(storyId).get(),
      db.collection(COLLECTIONS.archives).doc(storyId).get()
    ]);
    if (!storySnapshot.exists) throw new HttpsError("not-found", "Chapter was not found.");
    const story = storySnapshot.data();
    if (story.status !== "reported" && story.status !== "deleted") {
      throw new HttpsError("failed-precondition", "This chapter is not hidden.");
    }
    if (story.deletionSource === "account") {
      throw new HttpsError("failed-precondition", "Account-erased content cannot be restored.");
    }
    if (!archiveSnapshot.exists) {
      throw new HttpsError("failed-precondition", "The recoverable chapter archive is missing.");
    }
    await Promise.all([restoreStoryComments(storyId), clearStoryReports(storyId)]);
  }

  const result = await db.runTransaction(async (transaction) => {
    const storyReference = db.collection(COLLECTIONS.stories).doc(storyId);
    const archiveReference = db.collection(COLLECTIONS.archives).doc(storyId);
    const administratorReference = db.collection(COLLECTIONS.system).doc(ADMINISTRATOR_DOCUMENT);
    const [storySnapshot, archiveSnapshot, deletionJob, administratorSnapshot] = await Promise.all([
      transaction.get(storyReference),
      transaction.get(archiveReference),
      transaction.get(deletionJobReference(adminId)),
      transaction.get(administratorReference)
    ]);
    if (!administratorSnapshot.exists || administratorSnapshot.data().uid !== adminId) {
      throw new HttpsError("permission-denied", "This account is no longer the designated administrator.");
    }
    assertAccountWritableSnapshot(deletionJob);
    if (!storySnapshot.exists) throw new HttpsError("not-found", "Chapter was not found.");
    const story = storySnapshot.data();
    if (story.authorId) await assertAccountWritable(transaction, story.authorId);
    if (action === "hide") {
      if (story.status !== "active") {
        throw new HttpsError("failed-precondition", "Only active chapters can be hidden.");
      }
      transaction.set(archiveReference, archiveFromStory(story, "reported", "moderation"), { merge: false });
      transaction.update(storyReference, {
        ...publicTombstone("reported"),
        status: "reported",
        deletionSource: "moderation",
        reportCount: Math.max(4, Number(story.reportCount || 0)),
        updatedAt: timestamp()
      });
      transaction.create(db.collection(COLLECTIONS.audit).doc(), {
        action: "story_hidden",
        actorId: adminId,
        storyId,
        previousStatus: "active",
        createdAt: timestamp()
      });
      return { storyId, status: "reported", previousStatus: "active" };
    }

    if (story.status !== "reported" && story.status !== "deleted") {
      throw new HttpsError("failed-precondition", "This chapter is not hidden.");
    }
    if (story.deletionSource === "account") {
      throw new HttpsError("failed-precondition", "Account-erased content cannot be restored.");
    }
    if (!archiveSnapshot.exists) {
      throw new HttpsError("failed-precondition", "The recoverable chapter archive is missing.");
    }
    const archive = archiveSnapshot.data();
    transaction.update(storyReference, {
      title: archive.title,
      deck: archive.deck,
      body: archive.body,
      genre: archive.genre,
      authorId: archive.authorId || story.authorId || null,
      status: "active",
      deletionSource: null,
      reportCount: 0,
      updatedAt: timestamp()
    });
    transaction.delete(archiveReference);
    transaction.create(db.collection(COLLECTIONS.audit).doc(), {
      action: "story_restored",
      actorId: adminId,
      storyId,
      previousStatus: story.status,
      createdAt: timestamp()
    });
    return { storyId, status: "active", previousStatus: story.status };
  });

  return result;
});

exports.markNotificationsRead = callable(async (request) => {
  const uid = requireAuth(request);
  await assertAccountWritableDirect(uid);
  const rawIds = Array.isArray(request.data?.notificationIds) ? request.data.notificationIds : null;
  let documents;
  if (rawIds) {
    if (rawIds.length > 100) throw new HttpsError("invalid-argument", "At most 100 notifications can be updated at once.");
    const references = [...new Set(rawIds)].map((id) => (
      db.collection(COLLECTIONS.notifications).doc(cleanId(id, "Notification ID"))
    ));
    const snapshots = references.length ? await db.getAll(...references) : [];
    documents = snapshots.filter((snapshot) => snapshot.exists && snapshot.data().recipientId === uid && !snapshot.data().read);
  } else {
    const snapshot = await db.collection(COLLECTIONS.notifications)
      .where("recipientId", "==", uid)
      .where("read", "==", false)
      .limit(500)
      .get();
    documents = snapshot.docs;
  }
  if (!documents.length) return { updated: 0 };
  const writer = db.bulkWriter();
  documents.forEach((document) => writer.update(document.ref, { read: true, readAt: timestamp() }));
  await writer.close();
  return { updated: documents.length };
});

async function getDocumentsByIds(collection, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const references = unique.map((id) => db.collection(collection).doc(id));
  const snapshots = await db.getAll(...references);
  return snapshots.filter((snapshot) => snapshot.exists);
}

async function recomputeStoryCounters(storyIds, commentCountStoryIds = new Set()) {
  const unique = [...new Set(storyIds.filter(Boolean))];
  if (!unique.length) return;
  const updates = [];
  for (const storyId of unique) {
    const tasks = [
      db.collection(COLLECTIONS.stories).doc(storyId).get(),
      db.collection(COLLECTIONS.storyLikes).where("storyId", "==", storyId).get(),
      db.collection(COLLECTIONS.reports).where("storyId", "==", storyId).get()
    ];
    if (commentCountStoryIds.has(storyId)) {
      tasks.push(
        db.collection(COLLECTIONS.comments)
          .where("storyId", "==", storyId)
          .where("status", "==", "active")
          .get()
      );
    }
    const [storySnapshot, likesSnapshot, reportsSnapshot, commentsSnapshot] = await Promise.all(tasks);
    if (!storySnapshot.exists) continue;
    const changes = {
      likes: likesSnapshot.size,
      reportCount: reportsSnapshot.size
    };
    if (commentsSnapshot) changes.commentCount = commentsSnapshot.size;
    updates.push({ reference: storySnapshot.ref, changes });
  }
  if (!updates.length) return;
  const writer = db.bulkWriter();
  updates.forEach(({ reference, changes }) => writer.update(reference, changes));
  await writer.close();
}

async function recomputeCommentLikes(commentIds) {
  const unique = [...new Set(commentIds.filter(Boolean))];
  if (!unique.length) return;
  const updates = [];
  for (const commentId of unique) {
    const [commentSnapshot, likesSnapshot] = await Promise.all([
      db.collection(COLLECTIONS.comments).doc(commentId).get(),
      db.collection(COLLECTIONS.commentLikes).where("commentId", "==", commentId).get()
    ]);
    if (commentSnapshot.exists) {
      updates.push({ reference: commentSnapshot.ref, likes: likesSnapshot.size });
    }
  }
  if (!updates.length) return;
  const writer = db.bulkWriter();
  updates.forEach(({ reference, likes }) => writer.update(reference, { likes }));
  await writer.close();
}

exports.deleteAccount = callable(async (request) => {
  const uid = requireRecentAuth(request);
  const jobReference = deletionJobReference(uid);
  const existingJob = await db.runTransaction(async (transaction) => {
    const [snapshot, administrator] = await Promise.all([
      transaction.get(jobReference),
      transaction.get(db.collection(COLLECTIONS.system).doc(ADMINISTRATOR_DOCUMENT))
    ]);
    if (administrator.exists && administrator.data().uid === uid) {
      throw new HttpsError(
        "failed-precondition",
        "Assign a different administrator before deleting this account."
      );
    }
    const existing = snapshot.exists ? snapshot.data() : {};
    if (existing.status !== "data_erased" && existing.status !== "deleted") {
      transaction.set(jobReference, {
        status: "processing",
        createdAt: existing.createdAt || timestamp(),
        updatedAt: timestamp()
      }, { merge: true });
    }
    return existing;
  });

  if (existingJob.status === "data_erased" || existingJob.status === "deleted") {
    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
    await jobReference.set({
      status: "deleted",
      updatedAt: timestamp(),
      completedAt: existingJob.completedAt || timestamp()
    }, { merge: true });
    return { deleted: true, preservedStoryNodes: Number(existingJob.preservedStoryNodes || 0) };
  }

  const [liveDrafts, liveStories, liveAuthoredComments] = await Promise.all([
    db.collection(COLLECTIONS.drafts).where("authorId", "==", uid).get(),
    db.collection(COLLECTIONS.stories).where("authorId", "==", uid).get(),
    db.collection(COLLECTIONS.comments).where("authorId", "==", uid).get()
  ]);

  const storyIds = [...new Set([
    ...(existingJob.storyIds || []),
    ...liveStories.docs.map((document) => document.id)
  ])];
  const draftIds = [...new Set([
    ...(existingJob.draftIds || []),
    ...liveDrafts.docs.map((document) => document.id)
  ])];

  const currentOwnedComments = await queryByChunks(COLLECTIONS.comments, "storyId", storyIds);
  const ownedCommentIds = [...new Set([
    ...(existingJob.ownedCommentIds || []),
    ...currentOwnedComments.map((document) => document.id)
  ])];
  const authoredCommentIds = [...new Set([
    ...(existingJob.authoredCommentIds || []),
    ...liveAuthoredComments.docs.map((document) => document.id)
  ])];
  const erasedCommentIds = [...new Set([...ownedCommentIds, ...authoredCommentIds])];

  const currentCommentCountStoryIds = liveAuthoredComments.docs
    .filter((document) => document.data().status === "active" && !storyIds.includes(document.data().storyId))
    .map((document) => document.data().storyId);
  const commentCountStoryIds = [...new Set([
    ...(existingJob.commentCountStoryIds || []),
    ...currentCommentCountStoryIds
  ])];

  // Persist all targets before destructive work. A retry can finish even after
  // author IDs or comments have already been redacted.
  await jobReference.set({
    storyIds,
    draftIds,
    ownedCommentIds,
    authoredCommentIds,
    commentCountStoryIds,
    status: "processing",
    updatedAt: timestamp(),
    createdAt: existingJob.createdAt || timestamp()
  }, { merge: true });

  const [
    ownStoryLikes,
    ownCommentLikes,
    ownReports,
    likesOnOwnedStories,
    reportsOnOwnedStories,
    likesOnErasedComments,
    recipientNotifications,
    actorNotifications,
    storyNotifications,
    targetNotifications,
    actorAuditEntries
  ] = await Promise.all([
    db.collection(COLLECTIONS.storyLikes).where("userId", "==", uid).get(),
    db.collection(COLLECTIONS.commentLikes).where("userId", "==", uid).get(),
    db.collection(COLLECTIONS.reports).where("userId", "==", uid).get(),
    queryByChunks(COLLECTIONS.storyLikes, "storyId", storyIds),
    queryByChunks(COLLECTIONS.reports, "storyId", storyIds),
    queryByChunks(COLLECTIONS.commentLikes, "commentId", erasedCommentIds),
    db.collection(COLLECTIONS.notifications).where("recipientId", "==", uid).get(),
    db.collection(COLLECTIONS.notifications).where("actorId", "==", uid).get(),
    queryByChunks(COLLECTIONS.notifications, "storyId", storyIds),
    queryByChunks(COLLECTIONS.notifications, "targetStoryId", storyIds),
    db.collection(COLLECTIONS.audit).where("actorId", "==", uid).get()
  ]);

  const storyIdSet = new Set(storyIds);
  const erasedCommentIdSet = new Set(erasedCommentIds);
  const counterStoryIds = [...new Set([
    ...(existingJob.counterStoryIds || []),
    ...ownStoryLikes.docs.map((document) => document.data().storyId),
    ...ownReports.docs.map((document) => document.data().storyId),
    ...commentCountStoryIds
  ].filter((id) => id && !storyIdSet.has(id)))];
  const counterCommentIds = [...new Set([
    ...(existingJob.counterCommentIds || []),
    ...ownCommentLikes.docs.map((document) => document.data().commentId)
  ].filter((id) => id && !erasedCommentIdSet.has(id)))];

  await jobReference.set({
    counterStoryIds,
    counterCommentIds,
    updatedAt: timestamp()
  }, { merge: true });

  const relationDocuments = new Map([
    ...ownStoryLikes.docs,
    ...ownCommentLikes.docs,
    ...ownReports.docs,
    ...likesOnOwnedStories,
    ...reportsOnOwnedStories,
    ...likesOnErasedComments
  ].map((document) => [document.ref.path, document]));
  const notificationDocuments = new Map([
    ...recipientNotifications.docs,
    ...actorNotifications.docs,
    ...storyNotifications,
    ...targetNotifications
  ].map((document) => [document.ref.path, document]));
  await deleteDocuments([...relationDocuments.values(), ...notificationDocuments.values()]);

  if (!actorAuditEntries.empty) {
    const auditWriter = db.bulkWriter();
    actorAuditEntries.docs.forEach((document) => auditWriter.update(document.ref, { actorId: null }));
    await auditWriter.close();
  }

  const ownedCommentDocuments = await getDocumentsByIds(COLLECTIONS.comments, ownedCommentIds);
  await deleteDocuments(ownedCommentDocuments);

  const ownedCommentIdSet = new Set(ownedCommentIds);
  const authoredCommentDocuments = await getDocumentsByIds(COLLECTIONS.comments, authoredCommentIds);
  const commentsToRedact = authoredCommentDocuments.filter((document) => !ownedCommentIdSet.has(document.id));
  if (commentsToRedact.length) {
    const writer = db.bulkWriter();
    commentsToRedact.forEach((document) => writer.update(document.ref, {
      authorId: null,
      status: "deleted",
      deletionSource: "account",
      text: "",
      likes: 0,
      updatedAt: timestamp()
    }));
    await writer.close();
  }

  await Promise.all([
    recomputeStoryCounters(counterStoryIds, new Set(commentCountStoryIds)),
    recomputeCommentLikes(counterCommentIds)
  ]);

  const [storiesToErase, draftsToErase] = await Promise.all([
    getDocumentsByIds(COLLECTIONS.stories, storyIds),
    getDocumentsByIds(COLLECTIONS.drafts, draftIds)
  ]);
  const finalWriter = db.bulkWriter();
  storiesToErase.forEach((document) => {
    finalWriter.update(document.ref, {
      ...publicTombstone("deleted"),
      authorId: null,
      status: "deleted",
      deletionSource: "account",
      reportCount: 0,
      likes: 0,
      commentCount: 0,
      updatedAt: timestamp()
    });
    finalWriter.delete(db.collection(COLLECTIONS.archives).doc(document.id));
  });
  draftsToErase.forEach((document) => finalWriter.delete(document.ref));
  finalWriter.delete(db.collection(COLLECTIONS.profiles).doc(uid));
  await finalWriter.close();

  await db.collection(COLLECTIONS.audit).doc(accountAuditId(uid)).set({
    action: "account_erased",
    actorId: null,
    storyId: null,
    createdAt: timestamp()
  }, { merge: false });

  // Keep a hash-keyed tombstone so an already-issued ID token cannot recreate
  // data after erasure. Remove the temporary target lists before Auth deletion.
  await jobReference.set({
    status: "data_erased",
    preservedStoryNodes: storyIds.length,
    uid: FieldValue.delete(),
    storyIds: FieldValue.delete(),
    draftIds: FieldValue.delete(),
    ownedCommentIds: FieldValue.delete(),
    authoredCommentIds: FieldValue.delete(),
    commentCountStoryIds: FieldValue.delete(),
    counterStoryIds: FieldValue.delete(),
    counterCommentIds: FieldValue.delete(),
    updatedAt: timestamp()
  }, { merge: true });

  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
  await jobReference.set({
    status: "deleted",
    completedAt: timestamp(),
    updatedAt: timestamp()
  }, { merge: true });
  return { deleted: true, preservedStoryNodes: storyIds.length };
}, { timeoutSeconds: 540, memory: "512MiB", concurrency: 10, maxInstances: 10 });
