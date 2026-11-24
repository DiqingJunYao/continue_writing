import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app-check.js";
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onIdTokenChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-functions.js";
import {
  firebaseConfig,
  firebaseAppCheckSiteKey,
  firebaseEmulators,
  firebaseFunctionsRegion
} from "./firebase-config.js";

const REQUIRED_CONFIG_FIELDS = ["apiKey", "authDomain", "projectId", "appId"];
const CALLABLE_FUNCTIONS = new Set([
  "bootstrap",
  "getStoryComments",
  "ensureProfile",
  "saveStory",
  "toggleStoryLike",
  "addComment",
  "addReply",
  "toggleCommentLike",
  "reportStory",
  "deleteStory",
  "deleteAccount",
  "moderateStory",
  "markNotificationsRead"
]);
const CALLABLE_TIMEOUTS = Object.freeze({
  bootstrap: 60_000,
  deleteAccount: 540_000
});

let firebaseApp = null;
let firebaseAuth = null;
let firebaseFunctions = null;
let initializationPromise = null;
let authObserverStarted = false;
let authObserverUnsubscribe = null;
let authResolved = false;
let authRevision = 0;
let activeUser = null;
let activeClaims = Object.freeze({});
let authError = null;
const authSubscribers = new Set();
const callableCache = new Map();

export class BranchlineBackendError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "BranchlineBackendError";
    this.code = code;
    this.details = options.details ?? null;
  }
}

function isUsableConfigValue(value) {
  return typeof value === "string"
    && value.trim().length > 0
    && !value.includes("REPLACE_")
    && !value.includes("<YOUR_");
}

export function isFirebaseConfigured() {
  return REQUIRED_CONFIG_FIELDS.every((field) => isUsableConfigValue(firebaseConfig[field]));
}

function authSnapshot() {
  return Object.freeze({
    configured: isFirebaseConfigured(),
    ready: authResolved,
    user: activeUser,
    claims: activeClaims,
    error: authError
  });
}

function publishAuthSnapshot() {
  const snapshot = authSnapshot();
  authSubscribers.forEach((subscriber) => {
    try {
      subscriber(snapshot);
    } catch (error) {
      console.error("Branchline auth subscriber failed", error);
    }
  });
}

function friendlyMessageForCode(code) {
  const messages = {
    "auth/account-exists-with-different-credential": "An account already exists for this email. Sign in with the Google or Facebook provider you used first.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for Branchline and try again.",
    "auth/popup-closed-by-user": "The sign-in window was closed before sign-in finished.",
    "auth/cancelled-popup-request": "Another sign-in window is already open.",
    "auth/network-request-failed": "The sign-in service could not be reached. Check your connection and try again.",
    "auth/requires-recent-login": "Confirm your identity again before deleting your account.",
    "auth/unauthorized-domain": "This website domain has not been authorized in Firebase Authentication.",
    "functions/unauthenticated": "Sign in before doing that.",
    "functions/permission-denied": "Your account does not have permission to do that.",
    "functions/invalid-argument": "Some submitted information is invalid. Check the form and try again.",
    "functions/not-found": "The requested story or comment no longer exists.",
    "functions/already-exists": "That action has already been recorded.",
    "functions/failed-precondition": "That action is not available in the chapter's current state.",
    "functions/resource-exhausted": "Too many requests were made. Wait a moment and try again.",
    "functions/deadline-exceeded": "The server took too long to respond. Try again.",
    "functions/unavailable": "Branchline's shared service is temporarily unavailable. Try again shortly.",
    "functions/internal": "The shared service encountered an error. Try again."
  };
  return messages[code] || "Branchline could not complete that request. Try again.";
}

function normalizeError(error, fallbackCode = "backend/unknown") {
  if (error instanceof BranchlineBackendError) return error;
  const code = typeof error?.code === "string" ? error.code : fallbackCode;
  return new BranchlineBackendError(code, friendlyMessageForCode(code), {
    cause: error,
    details: code.startsWith("functions/") ? error?.details ?? null : null
  });
}

function requireConfigured() {
  if (!isFirebaseConfigured()) {
    throw new BranchlineBackendError(
      "backend/not-configured",
      "Firebase is not configured for this Branchline build."
    );
  }
}

function startAuthObserver() {
  if (authObserverStarted) return;
  authObserverStarted = true;
  authObserverUnsubscribe = onIdTokenChanged(firebaseAuth, async (user) => {
    const revision = ++authRevision;
    activeUser = user;
    activeClaims = Object.freeze({});
    authError = null;
    if (user) {
      try {
        const token = await user.getIdTokenResult();
        if (revision !== authRevision) return;
        activeClaims = Object.freeze({ ...token.claims });
      } catch (error) {
        if (revision !== authRevision) return;
        authError = normalizeError(error, "auth/token-refresh-failed");
      }
    }
    if (revision !== authRevision) return;
    authResolved = true;
    publishAuthSnapshot();
  }, (error) => {
    authRevision += 1;
    activeUser = null;
    activeClaims = Object.freeze({});
    authError = normalizeError(error, "auth/observer-failed");
    authResolved = true;
    authObserverUnsubscribe?.();
    authObserverUnsubscribe = null;
    authObserverStarted = false;
    publishAuthSnapshot();
  });
}

export async function initializeFirebaseBackend() {
  requireConfigured();
  if (initializationPromise) return initializationPromise;

  const attempt = new Promise((resolve, reject) => {
    try {
      firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
      if (!firebaseEmulators.enabled && firebaseAppCheckSiteKey) {
        initializeAppCheck(firebaseApp, {
          provider: new ReCaptchaEnterpriseProvider(firebaseAppCheckSiteKey),
          isTokenAutoRefreshEnabled: true
        });
      }
      firebaseAuth = getAuth(firebaseApp);
      firebaseFunctions = getFunctions(firebaseApp, firebaseFunctionsRegion);

      if (firebaseEmulators.enabled) {
        connectAuthEmulator(
          firebaseAuth,
          `http://${firebaseEmulators.host}:${firebaseEmulators.authPort}`,
          { disableWarnings: true }
        );
        connectFunctionsEmulator(
          firebaseFunctions,
          firebaseEmulators.host,
          firebaseEmulators.functionsPort
        );
      }

      const stopWaiting = subscribeToAuth((snapshot) => {
        if (!snapshot.ready) return;
        stopWaiting();
        if (snapshot.error && !snapshot.user) reject(snapshot.error);
        else resolve(snapshot);
      });
      startAuthObserver();
    } catch (error) {
      reject(normalizeError(error, "backend/initialization-failed"));
    }
  });

  initializationPromise = attempt.catch((error) => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}

export function subscribeToAuth(subscriber) {
  if (typeof subscriber !== "function") {
    throw new TypeError("subscribeToAuth requires a callback function");
  }
  authSubscribers.add(subscriber);
  queueMicrotask(() => {
    if (authSubscribers.has(subscriber)) subscriber(authSnapshot());
  });
  return () => authSubscribers.delete(subscriber);
}

export function currentFirebaseUser() {
  return activeUser;
}

export function currentClaims() {
  return activeClaims;
}

function providerForName(providerName) {
  let provider;
  if (providerName === "google") {
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
  } else if (providerName === "facebook") {
    provider = new FacebookAuthProvider();
    provider.addScope("email");
    provider.addScope("public_profile");
  } else {
    throw new BranchlineBackendError("auth/unsupported-provider", "Choose Google or Facebook to sign in.");
  }
  return provider;
}

export async function signInWithFirebase(providerName) {
  await initializeFirebaseBackend();
  const provider = providerForName(providerName);

  try {
    const result = await signInWithPopup(firebaseAuth, provider);
    await result.user.getIdToken(true);
    return result.user;
  } catch (error) {
    throw normalizeError(error, "auth/sign-in-failed");
  }
}

export async function reauthenticateFirebaseUser() {
  await initializeFirebaseBackend();
  if (!activeUser) {
    throw new BranchlineBackendError("functions/unauthenticated", "Sign in before deleting your account.");
  }
  const providerId = activeUser.providerData
    .map((profile) => profile.providerId)
    .find((id) => id === "google.com" || id === "facebook.com");
  if (!providerId) {
    throw new BranchlineBackendError(
      "auth/unsupported-provider",
      "This account must be confirmed with Google or Facebook before deletion."
    );
  }

  try {
    await reauthenticateWithPopup(activeUser, providerForName(providerId === "facebook.com" ? "facebook" : "google"));
    await activeUser.getIdToken(true);
  } catch (error) {
    throw normalizeError(error, "auth/requires-recent-login");
  }
}

export async function signOutFirebase() {
  await initializeFirebaseBackend();
  try {
    await signOut(firebaseAuth);
  } catch (error) {
    throw normalizeError(error, "auth/sign-out-failed");
  }
}

export async function callBackend(name, payload = {}) {
  if (!CALLABLE_FUNCTIONS.has(name)) {
    throw new BranchlineBackendError("backend/unknown-operation", "Branchline does not recognize that operation.");
  }
  await initializeFirebaseBackend();
  if (!callableCache.has(name)) {
    callableCache.set(name, httpsCallable(firebaseFunctions, name, {
      timeout: CALLABLE_TIMEOUTS[name] || 30_000
    }));
  }
  try {
    const result = await callableCache.get(name)(payload);
    return result.data;
  } catch (error) {
    throw normalizeError(error, "functions/unknown");
  }
}
