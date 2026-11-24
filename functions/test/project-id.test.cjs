"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { requireProjectId } = require("../scripts/project-id.cjs");

test("a single explicit Firebase project ID is accepted", () => {
  assert.equal(requireProjectId({ GOOGLE_CLOUD_PROJECT: "continuewriting-9e48b" }), "continuewriting-9e48b");
});

test("matching project environment variables are accepted", () => {
  assert.equal(requireProjectId({
    FIREBASE_PROJECT_ID: "continuewriting-9e48b",
    GCLOUD_PROJECT: "continuewriting-9e48b"
  }), "continuewriting-9e48b");
});

test("a missing project ID is rejected", () => {
  assert.throws(() => requireProjectId({}), /Set one of FIREBASE_PROJECT_ID/);
});

test("conflicting project environment variables are rejected", () => {
  assert.throws(() => requireProjectId({
    GOOGLE_CLOUD_PROJECT: "continuewriting-9e48b",
    GCLOUD_PROJECT: "unexpected-project"
  }), /Conflicting Firebase project IDs/);
});
