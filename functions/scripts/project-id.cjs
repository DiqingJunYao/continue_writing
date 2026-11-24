"use strict";

const PROJECT_ENV_NAMES = [
  "FIREBASE_PROJECT_ID",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT"
];

function requireProjectId(environment = process.env) {
  const configured = PROJECT_ENV_NAMES
    .map((name) => ({ name, value: String(environment[name] || "").trim() }))
    .filter(({ value }) => value);

  if (configured.length === 0) {
    throw new Error(`Set one of ${PROJECT_ENV_NAMES.join(", ")} explicitly.`);
  }

  const distinctProjectIds = new Set(configured.map(({ value }) => value));
  if (distinctProjectIds.size > 1) {
    const details = configured.map(({ name, value }) => `${name}=${value}`).join(", ");
    throw new Error(
      `Conflicting Firebase project IDs: ${details}. Unset the stale variable before continuing.`
    );
  }

  return configured[0].value;
}

module.exports = { requireProjectId };
