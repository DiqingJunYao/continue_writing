"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { requireRecentAuth } = require("../lib/model");

test("recent authentication is accepted for account deletion", () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(requireRecentAuth({
    auth: { uid: "member_1", token: { auth_time: now - 30 } }
  }), "member_1");
});

test("stale or missing authentication is rejected for account deletion", () => {
  const now = Math.floor(Date.now() / 1000);
  for (const authTime of [undefined, now - 301, now + 61]) {
    assert.throws(
      () => requireRecentAuth({
        auth: { uid: "member_1", token: { auth_time: authTime } }
      }),
      (error) => error?.code === "unauthenticated"
    );
  }
});
