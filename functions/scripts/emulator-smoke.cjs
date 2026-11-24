"use strict";

const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { createHash } = require("node:crypto");
const { promisify } = require("node:util");
const { join } = require("node:path");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const projectId = process.env.GCLOUD_PROJECT;
const emulatorHosts = {
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FUNCTIONS_EMULATOR_HOST: process.env.FUNCTIONS_EMULATOR_HOST
};
const missingEmulators = Object.entries(emulatorHosts)
  .filter(([, value]) => !value)
  .map(([name]) => name);
if (projectId !== "demo-branchline" || missingEmulators.length) {
  console.error(
    "Refusing to run: use the demo-branchline project with the Auth, Firestore, and Functions emulators."
    + (missingEmulators.length ? ` Missing: ${missingEmulators.join(", ")}.` : "")
  );
  process.exit(1);
}
const nonLocalEmulator = Object.entries(emulatorHosts).find(([, value]) => (
  !/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(value)
));
if (nonLocalEmulator) {
  console.error(`Refusing non-local ${nonLocalEmulator[0]}=${nonLocalEmulator[1]}.`);
  process.exit(1);
}
const authHost = emulatorHosts.FIREBASE_AUTH_EMULATOR_HOST;
const functionsHost = emulatorHosts.FUNCTIONS_EMULATOR_HOST;
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = "branchline-test-password";
const execFileAsync = promisify(execFile);

initializeApp({ projectId });
const db = getFirestore();

async function authRequest(path, body) {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/${path}?key=fake-key`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error?.message || `Auth request failed: ${response.status}`);
  return result;
}

async function createUser(index) {
  return authRequest("accounts:signUp", {
    email: `branchline-${runId}-${index}@example.test`,
    password,
    returnSecureToken: true
  });
}

async function callFunction(name, token, data = {}) {
  const response = await fetch(`http://${functionsHost}/${projectId}/europe-west1/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ data })
  });
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`${name}: ${body.error?.status || response.status} ${body.error?.message || "unknown error"}`);
  }
  return body.result;
}

async function main() {
  const users = await Promise.all([1, 2, 3, 4].map(createUser));
  await assert.rejects(
    () => callFunction("saveStory", null, {
      title: "Guest chapter",
      body: "Guests must never be allowed to publish through this endpoint."
    }),
    /UNAUTHENTICATED/
  );
  await Promise.all(users.map((user, index) => callFunction("ensureProfile", user.idToken, {
    name: `Test Writer ${index + 1}`,
    handle: `@testwriter${index + 1}`
  })));

  const root = await callFunction("saveStory", users[0].idToken, {
    title: "Emulator Root",
    deck: "A shared test branch.",
    body: "One two three four five six seven eight nine ten.",
    genre: "Speculative"
  });
  assert.equal(root.status, "active");

  const rootOwnerLockId = `account_${createHash("sha256").update(users[0].localId).digest("hex")}`;
  await db.collection("accountDeletionJobs").doc(rootOwnerLockId).set({ status: "processing" });
  await Promise.all([
    assert.rejects(
      () => callFunction("toggleStoryLike", users[1].idToken, { storyId: root.storyId }),
      /FAILED_PRECONDITION/
    ),
    assert.rejects(
      () => callFunction("addComment", users[1].idToken, { storyId: root.storyId, text: "Blocked during deletion." }),
      /FAILED_PRECONDITION/
    ),
    assert.rejects(
      () => callFunction("saveStory", users[1].idToken, {
        parentId: root.storyId,
        title: "Blocked branch",
        body: "This branch must not survive a parent author account deletion."
      }),
      /FAILED_PRECONDITION/
    ),
    assert.rejects(
      () => callFunction("reportStory", users[1].idToken, { storyId: root.storyId }),
      /FAILED_PRECONDITION/
    )
  ]);
  await db.collection("accountDeletionJobs").doc(rootOwnerLockId).delete();

  const like = await callFunction("toggleStoryLike", users[1].idToken, { storyId: root.storyId });
  assert.deepEqual(like, { liked: true, likes: 1 });
  const comment = await callFunction("addComment", users[1].idToken, {
    storyId: root.storyId,
    text: "A comment written through the trusted backend."
  });
  assert.equal(comment.storyId, root.storyId);
  const commentAuthorLockId = `account_${createHash("sha256").update(users[1].localId).digest("hex")}`;
  await db.collection("accountDeletionJobs").doc(commentAuthorLockId).set({ status: "processing" });
  await Promise.all([
    assert.rejects(
      () => callFunction("addReply", users[2].idToken, {
        replyToCommentId: comment.id,
        text: "This reply must wait until account deletion finishes."
      }),
      /FAILED_PRECONDITION/
    ),
    assert.rejects(
      () => callFunction("toggleCommentLike", users[3].idToken, { commentId: comment.id }),
      /FAILED_PRECONDITION/
    )
  ]);
  await db.collection("accountDeletionJobs").doc(commentAuthorLockId).delete();
  const reply = await callFunction("addReply", users[2].idToken, {
    replyToCommentId: comment.id,
    text: "A reply that should remain connected if the parent author leaves."
  });
  assert.equal(reply.parentCommentId, comment.id);
  const commentLike = await callFunction("toggleCommentLike", users[3].idToken, { commentId: comment.id });
  assert.deepEqual(commentLike, { liked: true, likes: 1 });

  const continuation = await callFunction("saveStory", users[1].idToken, {
    parentId: root.storyId,
    title: "Emulator Branch",
    deck: "The path continues.",
    body: "Another chapter has enough words to pass server validation safely.",
    genre: "Mystery"
  });
  assert.equal(continuation.status, "active");

  const draft = await callFunction("saveStory", users[2].idToken, {
    parentId: root.storyId,
    title: "Private emulator draft",
    deck: "This must be visible only to its owner.",
    body: "",
    genre: "Fantasy",
    asDraft: true
  });
  assert.equal(draft.status, "draft");
  const guestBeforeReports = await callFunction("bootstrap", null);
  assert(!guestBeforeReports.stories.some((story) => story.id === draft.storyId));
  const draftOwnerView = await callFunction("bootstrap", users[2].idToken);
  assert(draftOwnerView.stories.some((story) => story.id === draft.storyId && story.status === "draft"));

  const paginationStory = await callFunction("saveStory", users[3].idToken, {
    title: "Pagination fixture",
    body: "This temporary chapter verifies exact comment pagination without losing any entries."
  });
  const paginationBatch = db.batch();
  for (let index = 0; index < 101; index += 1) {
    paginationBatch.set(db.collection("comments").doc(`page_${runId}_${String(index).padStart(3, "0")}`), {
      storyId: paginationStory.storyId,
      parentCommentId: null,
      replyToCommentId: null,
      authorId: users[3].localId,
      status: "active",
      deletionSource: null,
      text: `Pagination comment ${index}`,
      createdAt: new Timestamp(1700000000, index * 1000),
      updatedAt: new Timestamp(1700000000, index * 1000),
      likes: 0
    });
  }
  await paginationBatch.commit();
  const firstCommentPage = await callFunction("getStoryComments", null, { storyId: paginationStory.storyId });
  assert.equal(firstCommentPage.comments.length, 100);
  assert.equal(firstCommentPage.nextCursor.nanoseconds, 99000);
  const secondCommentPage = await callFunction("getStoryComments", null, {
    storyId: paginationStory.storyId,
    cursor: firstCommentPage.nextCursor
  });
  assert.equal(secondCommentPage.comments.length, 1);
  assert.equal(secondCommentPage.nextCursor, null);
  assert(!firstCommentPage.comments.some((comment) => comment.id === secondCommentPage.comments[0].id));

  const ownerView = await callFunction("bootstrap", users[0].idToken);
  const ownerTypes = ownerView.notifications.map((item) => item.type);
  assert(ownerTypes.includes("like"));
  assert(ownerTypes.includes("comment"));
  assert(ownerTypes.includes("continuation"));
  const commentAuthorView = await callFunction("bootstrap", users[1].idToken);
  const commentAuthorTypes = commentAuthorView.notifications.map((item) => item.type);
  assert(commentAuthorTypes.includes("reply"));
  assert(commentAuthorTypes.includes("comment_like"));
  const readResult = await callFunction("markNotificationsRead", users[0].idToken);
  assert(readResult.updated >= 3);
  const readOwnerView = await callFunction("bootstrap", users[0].idToken);
  assert(readOwnerView.notifications.every((item) => item.read));

  for (const user of users) {
    await callFunction("reportStory", user.idToken, { storyId: root.storyId });
  }
  const publicView = await callFunction("bootstrap", null);
  const hidden = publicView.stories.find((story) => story.id === root.storyId);
  assert.equal(hidden.status, "reported");
  assert.equal(hidden.body, "");
  assert.equal(hidden.title, "Reported chapter");

  await getAuth().setCustomUserClaims(users[0].localId, { admin: true });
  await db.collection("system").doc("administrator").set({ uid: users[0].localId });
  const adminSession = await authRequest("accounts:signInWithPassword", {
    email: users[0].email,
    password,
    returnSecureToken: true
  });
  const adminView = await callFunction("bootstrap", adminSession.idToken);
  assert.equal(adminView.isAdmin, true);
  assert.match(adminView.stories.find((story) => story.id === root.storyId).body, /One two three/);
  await db.collection("system").doc("administrator").set({ uid: users[2].localId });
  const replacedAdminView = await callFunction("bootstrap", adminSession.idToken);
  assert.equal(replacedAdminView.isAdmin, false, "the singleton record invalidates a cached admin token");
  await db.collection("system").doc("administrator").set({ uid: users[0].localId });
  const restored = await callFunction("moderateStory", adminSession.idToken, {
    storyId: root.storyId,
    action: "restore"
  });
  assert.equal(restored.status, "active");
  const restoredPublicView = await callFunction("bootstrap", null);
  assert.match(restoredPublicView.stories.find((story) => story.id === root.storyId).body, /One two three/);

  const authorDeletion = await callFunction("deleteStory", adminSession.idToken, { storyId: root.storyId });
  assert.equal(authorDeletion.status, "deleted");
  const deletedPublicView = await callFunction("bootstrap", null);
  assert.equal(deletedPublicView.stories.find((story) => story.id === root.storyId).title, "Deleted chapter");
  assert(deletedPublicView.stories.some((story) => story.id === continuation.storyId));
  await callFunction("moderateStory", adminSession.idToken, { storyId: root.storyId, action: "restore" });

  const deletion = await callFunction("deleteAccount", users[1].idToken);
  assert.equal(deletion.deleted, true);
  await assert.rejects(
    () => authRequest("accounts:signInWithPassword", {
      email: users[1].email,
      password,
      returnSecureToken: true
    }),
    /EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/
  );
  const afterAccountDeletion = await callFunction("bootstrap", null);
  const preservedBranch = afterAccountDeletion.stories.find((story) => story.id === continuation.storyId);
  assert.equal(preservedBranch.status, "deleted");
  assert.equal(preservedBranch.deletionSource, "account");
  assert.deepEqual(afterAccountDeletion.comments, []);
  const commentPage = await callFunction("getStoryComments", null, { storyId: root.storyId });
  const erasedComment = commentPage.comments.find((item) => item.id === comment.id);
  const preservedReply = commentPage.comments.find((item) => item.id === reply.id);
  assert.equal(erasedComment.status, "deleted");
  assert.equal(erasedComment.text, "");
  assert.equal(preservedReply.status, "active");

  const deletionJobId = `account_${createHash("sha256").update(users[1].localId).digest("hex")}`;
  const deletionJob = await db.collection("accountDeletionJobs").doc(deletionJobId).get();
  assert.equal(deletionJob.data().status, "deleted");
  assert.equal(deletionJob.data().uid, undefined);
  assert.equal(deletionJob.data().storyIds, undefined);

  const handoffScript = join(__dirname, "set-admin.cjs");
  const handoffResults = await Promise.allSettled([
    execFileAsync(process.execPath, [handoffScript, users[2].localId], { env: process.env, timeout: 30_000 }),
    execFileAsync(process.execPath, [handoffScript, users[3].localId], { env: process.env, timeout: 30_000 })
  ]);
  assert(handoffResults.some((result) => result.status === "fulfilled"));
  handoffResults
    .filter((result) => result.status === "rejected")
    .forEach((result) => assert.match(
      `${result.reason?.stderr || ""} ${result.reason?.message || ""}`,
      /Another administrator assignment is already in progress/
    ));
  const configuredAdministrator = await db.collection("system").doc("administrator").get();
  const authUsers = await getAuth().listUsers(1000);
  const claimAdministrators = authUsers.users.filter((user) => user.customClaims?.admin === true);
  assert.equal(claimAdministrators.length, 1, "a concurrent handoff must leave exactly one administrator claim");
  assert.equal(claimAdministrators[0].uid, configuredAdministrator.data().uid);
  assert.equal(
    (await db.collection("system").doc("administratorHandoff").get()).exists,
    false,
    "the handoff lease must be released"
  );

  console.log("Firebase Functions emulator smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
