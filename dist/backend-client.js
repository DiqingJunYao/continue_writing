const providers = ["google", "facebook"];
const actions = new Set([
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
  "markNotificationsRead",
]);

let account = null;
let enabledProviders = [];
let openingOAuth = false;

export class BranchlineBackendError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "BranchlineBackendError";
    this.code = code;
  }
}

async function request(path, options = {}, timeout = 30_000) {
  let response;
  let payload;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
    if (response.status !== 204) payload = await response.json();
  } catch (error) {
    const timedOut = error.name === "TimeoutError";
    throw new BranchlineBackendError(
      timedOut ? "deadline-exceeded" : "unavailable",
      timedOut
        ? "The server took too long to respond. Try again."
        : "Branchline could not reach the shared service. Try again.",
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new BranchlineBackendError(
      payload?.error?.code ||
        (response.status === 401 ? "unauthenticated" : "internal"),
      payload?.error?.message || "Branchline could not complete that request.",
    );
  }
  return payload;
}

export async function refreshSession() {
  const session = await request("/api/session");
  account = session.user;
  const available = Array.isArray(session.providers)
    ? session.providers
    : providers;
  enabledProviders = providers.filter((provider) =>
    available.includes(provider),
  );
  return account;
}

export function forgetSession() {
  account = null;
}

export function isProviderEnabled(provider) {
  return enabledProviders.includes(provider);
}

function waitForOAuth(popup) {
  return new Promise((resolve, reject) => {
    let closedAt = 0;
    let finished = false;

    function finish(error) {
      if (finished) return;
      finished = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(checkClosed);
      window.clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    }

    function onMessage(event) {
      const isCallback =
        event.origin === window.location.origin &&
        event.source === popup &&
        event.data?.type === "branchline-auth" &&
        typeof event.data.ok === "boolean";
      if (!isCallback) return;
      // Settle before closing so a popup-close poll cannot mask the result.
      finish(
        event.data.ok
          ? null
          : new BranchlineBackendError(
              "auth/sign-in-failed",
              typeof event.data.message === "string" && event.data.message
                ? event.data.message
                : "Sign-in could not be completed. Try again.",
            ),
      );
      popup.close();
    }

    window.addEventListener("message", onMessage);
    const checkClosed = window.setInterval(() => {
      if (!popup.closed) return;
      // The callback can post its result and close in the same browser task.
      closedAt ||= Date.now();
      if (Date.now() - closedAt < 500) return;
      finish(new BranchlineBackendError(
        "auth/popup-closed",
        "The sign-in window closed before sign-in finished.",
      ));
    }, 250);
    const timeout = window.setTimeout(() => {
      finish(new BranchlineBackendError(
        "auth/timeout",
        "Sign-in took too long. Try again.",
      ));
      popup.close();
    }, 10 * 60_000);
  });
}

async function completeOAuth(provider, mode, expectedUser = null) {
  if (!isProviderEnabled(provider)) {
    throw new BranchlineBackendError(
      "auth/provider-unavailable",
      "This sign-in option is unavailable on this server.",
    );
  }
  if (openingOAuth) {
    throw new BranchlineBackendError("auth/in-progress", "A sign-in window is already open.");
  }
  const popup = window.open(
    `/api/auth/${provider}/start?mode=${mode}`,
    "_blank",
    "popup,width=520,height=680",
  );
  if (!popup) {
    throw new BranchlineBackendError(
      "auth/popup-blocked",
      "Your browser blocked the sign-in window. Allow pop-ups for Branchline and try again.",
    );
  }
  openingOAuth = true;
  try {
    await waitForOAuth(popup);
    const verified = await refreshSession();
    if (
      !verified ||
      verified.provider !== provider ||
      (expectedUser && verified.uid !== expectedUser)
    ) {
      throw new BranchlineBackendError(
        "unauthenticated",
        "Your Branchline session could not be confirmed. Sign in again.",
      );
    }
    return verified;
  } finally {
    openingOAuth = false;
  }
}

export function signInWithProvider(provider) {
  return completeOAuth(provider, "signin");
}

export function reauthenticateSession(expectedUser) {
  if (!account || account.uid !== expectedUser) {
    throw new BranchlineBackendError(
      "unauthenticated",
      "Sign in again before deleting your account.",
    );
  }
  return completeOAuth(account.provider, "reauth", expectedUser);
}

export async function signOutSession(expectedUser) {
  await request("/api/auth/signout", {
    method: "POST",
    headers: expectedUser ? { "X-Branchline-User": expectedUser } : {},
  });
  forgetSession();
}

export async function callBackend(name, payload = {}, { expectedUser } = {}) {
  if (!actions.has(name)) {
    throw new BranchlineBackendError(
      "backend/unknown-operation",
      "Branchline does not recognize that operation.",
    );
  }
  const headers = { "Content-Type": "application/json" };
  if (expectedUser) headers["X-Branchline-User"] = expectedUser;
  const response = await request(`/api/actions/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  }, name === "deleteAccount" ? 120_000 : 30_000);
  return response.result;
}
