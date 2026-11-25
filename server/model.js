export class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const GENRES = new Set([
  "Speculative",
  "Fantasy",
  "Mystery",
  "Adventure",
  "Romance",
  "Science fiction",
  "Horror",
  "Magical realism",
  "Literary",
]);

const TONES = new Set(["rose", "green", "blue", "purple"]);
const MAX_TREE_DEPTH = 100;

function requireRecentAuth(user, now = Date.now()) {
  const authTime = user.authAt instanceof Date
    ? user.authAt.getTime()
    : Date.parse(String(user.authAt ?? "").replace(" ", "T") + "Z");
  if (
    !Number.isFinite(authTime) ||
    authTime > now + 60_000 ||
    now - authTime > 300_000
  ) {
    throw new AppError(
      "unauthenticated",
      "Confirm your identity with Google or Facebook again before deleting your account.",
    );
  }
}

function requireObject(value, label = "payload") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("invalid-argument", `${label} must be an object.`);
  }
  return value;
}

function cleanText(value, { label, max, required = false, min = 0 } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (required && !text) {
    throw new AppError("invalid-argument", `${label || "Text"} is required.`);
  }
  if (text.length < min || text.length > max) {
    throw new AppError(
      "invalid-argument",
      `${label || "Text"} must be between ${min} and ${max} characters.`,
    );
  }
  return text;
}

function cleanId(value, label = "ID", { optional = false } = {}) {
  if ((value === null || value === undefined || value === "") && optional)
    return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new AppError("invalid-argument", `${label} is invalid.`);
  }
  return value;
}

function cleanStoryInput(raw, { draft = false } = {}) {
  const input = requireObject(raw);
  const title = cleanText(input.title, {
    label: "Title",
    max: 80,
    required: true,
    min: 1,
  });
  const deck = cleanText(input.deck, { label: "Hook", max: 140 });
  const body = cleanText(input.body, {
    label: "Story",
    max: 8000,
    required: !draft,
    min: draft ? 0 : 1,
  });
  if (!draft && wordCount(body) < 8) {
    throw new AppError(
      "invalid-argument",
      "Published chapters need at least eight words.",
    );
  }
  const genre =
    typeof input.genre === "string" && GENRES.has(input.genre)
      ? input.genre
      : "Speculative";
  return { title, deck, body, genre };
}

function wordCount(value = "") {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "word",
    });
    const segments = segmenter.segment(value);
    let count = 0;
    for (const segment of segments) {
      if (segment.isWordLike) {
        count++;
      }
    }
    return count;
  }

function cleanCommentText(value) {
  return cleanText(value, {
    label: "Comment",
    max: 600,
    required: true,
    min: 1,
  });
}

function cleanProfileInput(raw, token = {}) {
  const input = requireObject(raw || {});
  const tokenName = typeof token.name === "string" ? token.name : "";
  const name = cleanText(input.name || tokenName || "Branchline member", {
    label: "Display name",
    max: 80,
    required: true,
    min: 1,
  });
  const fallbackHandle = `@${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24) || "writer"
  }`;
  let handle = cleanText(input.handle || fallbackHandle, {
    label: "Handle",
    max: 32,
    min: 2,
  });
  if (!handle.startsWith("@")) handle = `@${handle}`;
  if (!/^@[A-Za-z0-9_-]{1,31}$/.test(handle)) {
    throw new AppError(
      "invalid-argument",
      "Handle may use letters, numbers, underscores, and hyphens.",
    );
  }
  const initials = cleanText(input.initials || initialsFor(name), {
    label: "Initials",
    max: 3,
    min: 1,
  }).toUpperCase();
  const tone = TONES.has(input.tone) ? input.tone : "green";
  const bio = cleanText(input.bio, { label: "Bio", max: 240 });
  const tokenPicture = typeof token.picture === "string" ? token.picture : "";
  const avatarUrl = cleanUrl(input.avatarUrl || tokenPicture);
  return { name, handle, initials, tone, bio, avatarUrl };
}

function cleanUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(String(value));
    if (parsed.protocol !== "https:") return "";
    return parsed.toString().slice(0, 1000);
  } catch {
    return "";
  }
}

function initialsFor(name) {
  return (
    String(name)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "BM"
  );
}

function publicTombstone(status) {
  return {
    title: status === "reported" ? "Reported chapter" : "Deleted chapter",
    deck: "",
    body: "",
    genre: "Unavailable",
  };
}

export {
  GENRES,
  MAX_TREE_DEPTH,
  cleanCommentText,
  cleanId,
  cleanProfileInput,
  cleanStoryInput,
  publicTombstone,
  requireRecentAuth,
  requireObject,
};
