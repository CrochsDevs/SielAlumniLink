import assert from "node:assert/strict";
import test from "node:test";
import { mentorConnectionStates } from "./connectionStates.js";

const user = { authId: "student-account", _id: "student-profile", email: "student@example.test" };
const own = { requesterAuthId: user.authId, requesterEmail: user.email, recipientAuthId: "mentor-account", recipientEmail: "mentor@example.test" };

test("only this account's accepted connection shows Connected", () => {
  for (const [status, expected] of [["accepted", "connected"], ["pending", "pending"], ["declined", undefined]]) {
    assert.equal(mentorConnectionStates([{ ...own, status }], user)[own.recipientEmail], expected);
  }
  assert.deepEqual(mentorConnectionStates([{ ...own, requesterAuthId: "other-student", status: "accepted" }], user), {});
  assert.deepEqual(mentorConnectionStates([{ ...own, status: "accepted" }], { ...user, authId: "other-account" }), {});
});

test("the latest status wins even when an older accepted record exists", () => {
  const accepted = { ...own, status: "accepted", updatedAt: "2026-01-01" };
  for (const status of ["pending", "declined"]) {
    const newer = { ...own, status, updatedAt: "2026-02-01" };
    for (const records of [[accepted, newer], [newer, accepted]]) {
      assert.equal(mentorConnectionStates(records, user)[own.recipientEmail], status === "pending" ? "pending" : undefined);
    }
  }
});

test("incoming and legacy email connections retain their correct status", () => {
  const incoming = { requesterAuthId: "mentor-account", requesterEmail: own.recipientEmail, recipientAuthId: user.authId, recipientEmail: user.email };
  assert.equal(mentorConnectionStates([{ ...incoming, status: "pending" }], user)[own.recipientEmail], "incoming");
  assert.equal(mentorConnectionStates([{ ...incoming, status: "accepted" }], user)[own.recipientEmail], "connected");
  assert.equal(mentorConnectionStates([{ requesterEmail: " STUDENT@EXAMPLE.TEST ", recipientEmail: own.recipientEmail, status: "accepted" }], user)[own.recipientEmail], "connected");
});
