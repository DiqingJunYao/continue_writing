"use strict";

const { createHash, randomUUID } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const {
  FieldValue,
  Timestamp,
  getFirestore,
} = require("firebase-admin/firestore");
const { requireProjectId } = require("./project-id.cjs");

const uid = process.argv[2];
if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
  console.error(
    "Usage: npm --prefix functions run set-admin -- <FIREBASE_UID>",
  );
  process.exit(1);
}

let projectId;
try {
  projectId = requireProjectId();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

initializeApp({ projectId });
const db = getFirestore();
const HANDOFF_LEASE_MS = 10 * 60 * 1000;

async function acquireHandoffLease(reference, leaseId) {
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.exists ? snapshot.data() : null;
    const expiresAt = existing?.expiresAt?.toMillis?.();
    if (
      existing &&
      existing.leaseId !== leaseId &&
      (!Number.isFinite(expiresAt) || expiresAt > now)
    ) {
      throw new Error(
        "Another administrator assignment is already in progress. Try again after it finishes.",
      );
    }
    transaction.set(
      reference,
      {
        leaseId,
        acquiredAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(now + HANDOFF_LEASE_MS),
      },
      { merge: false },
    );
  });
}

async function releaseHandoffLease(reference, leaseId) {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists && snapshot.data().leaseId === leaseId) {
      transaction.delete(reference);
    }
  });
}

async function renewHandoffLease(reference, leaseId) {
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists || snapshot.data().leaseId !== leaseId) {
      throw new Error(
        "Administrator assignment lease was lost; stopping this command.",
      );
    }
    transaction.update(reference, {
      expiresAt: Timestamp.fromMillis(Date.now() + HANDOFF_LEASE_MS),
    });
  });
}

async function main() {
  const auth = getAuth();
  const deletionJobId = `account_${createHash("sha256").update(uid).digest("hex")}`;
  const deletionJobRef = db
    .collection("accountDeletionJobs")
    .doc(deletionJobId);
  const administratorRef = db.collection("system").doc("administrator");
  const handoffRef = db.collection("system").doc("administratorHandoff");
  const leaseId = randomUUID();
  await acquireHandoffLease(handoffRef, leaseId);

  try {
    const target = await auth.getUser(uid);
    const deletionJob = await deletionJobRef.get();
    if (deletionJob.exists) {
      throw new Error(
        "The selected account is being deleted or has already been erased.",
      );
    }

    const administrators = [];
    let pageToken;

    do {
      const page = await auth.listUsers(1000, pageToken);
      administrators.push(
        ...page.users.filter((user) => user.customClaims?.admin === true),
      );
      pageToken = page.pageToken;
    } while (pageToken);

    await renewHandoffLease(handoffRef, leaseId);
    const { admin: _previousAdmin, ...targetClaims } =
      target.customClaims || {};
    await auth.setCustomUserClaims(uid, { ...targetClaims, admin: true });

    // Recheck the deletion lock in the same transaction that changes the
    // singleton. A concurrent account deletion either wins first and blocks
    // this handoff, or retries and sees that this UID is now administrator.
    // The lease read also prevents a stale concurrent CLI process from
    // completing after another assignment has taken ownership.
    await db.runTransaction(async (transaction) => {
      const [currentDeletionJob, handoff] = await Promise.all([
        transaction.get(deletionJobRef),
        transaction.get(handoffRef),
      ]);
      if (currentDeletionJob.exists) {
        throw new Error(
          "The selected account is being deleted or has already been erased.",
        );
      }
      if (!handoff.exists || handoff.data().leaseId !== leaseId) {
        throw new Error(
          "Administrator assignment lease was lost; no handoff was completed.",
        );
      }
      transaction.set(
        administratorRef,
        {
          uid,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: false },
      );
      transaction.update(handoffRef, {
        expiresAt: Timestamp.fromMillis(Date.now() + HANDOFF_LEASE_MS),
      });
    });

    // The backend requires both this singleton and the claim. Once the
    // singleton points at the target, old claims are harmless and can be
    // removed safely while the handoff lease excludes another CLI run.
    const previousAdministrators = administrators.filter(
      (administrator) => administrator.uid !== uid,
    );
    for (const administrator of previousAdministrators) {
      await renewHandoffLease(handoffRef, leaseId);
      const { admin: _removedAdmin, ...remainingClaims } =
        administrator.customClaims || {};
      await auth.setCustomUserClaims(administrator.uid, remainingClaims);
    }

    console.log(
      `Administrator claim set exclusively for ${uid}; revoked ${previousAdministrators.length} prior administrator claim(s). ` +
        "Affected users must refresh their ID token or sign in again.",
    );
  } finally {
    try {
      await releaseHandoffLease(handoffRef, leaseId);
    } catch (error) {
      console.warn(
        `Administrator handoff lease could not be released: ${error.message}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
