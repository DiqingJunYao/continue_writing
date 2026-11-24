import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc
} from "firebase/firestore";

const projectId = "demo-branchline";
const protectedCollections = [
  "profiles",
  "stories",
  "storyArchives",
  "drafts",
  "comments",
  "storyLikes",
  "commentLikes",
  "reports",
  "notifications",
  "moderationAudit",
  "accountDeletionJobs",
  "system"
];

let testEnvironment;

before(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile(new URL("../firestore.rules", import.meta.url), "utf8")
    }
  });
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
});

after(async () => {
  await testEnvironment.cleanup();
});

async function expectAllDirectAccessDenied(database) {
  for (const collectionName of protectedCollections) {
    const target = doc(database, collectionName, "target");
    await assertFails(getDoc(target));
    await assertFails(getDocs(collection(database, collectionName)));
    await assertFails(setDoc(target, { value: "forbidden" }));
    await assertFails(updateDoc(target, { value: "still forbidden" }));
    await assertFails(deleteDoc(target));
  }
}

test("unauthenticated browser clients cannot access any application collection", async () => {
  const database = testEnvironment.unauthenticatedContext().firestore();
  await expectAllDirectAccessDenied(database);
});

test("authenticated members cannot bypass callable Functions", async () => {
  const database = testEnvironment.authenticatedContext("member-1", {
    email: "member@example.test"
  }).firestore();
  await expectAllDirectAccessDenied(database);
});

test("an administrator custom claim does not grant direct Firestore access", async () => {
  const database = testEnvironment.authenticatedContext("admin-1", {
    admin: true,
    email: "admin@example.test"
  }).firestore();
  await expectAllDirectAccessDenied(database);
});

test("the rules file is intentionally deny-by-default", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /match \/\{document=\*\*\}/);
  assert.match(rules, /allow read, write: if false;/);
});
