import test from "node:test";
import assert from "node:assert/strict";
import { recordAdminAudit } from "./admin-audit.js";

process.env.MONGO_URI ||= "mongodb://127.0.0.1:27017/admin_audit_fixture";
const { default: ActivityModel } = await import("./activity.models.js");
const { default: UserModel } = await import("../users/users.models.js");
const { default: AuthModel } = await import("../auth/auth.models.js");
const { default: MagicLinkModel } = await import("../magic/magic.models.js");
const { updateUser, updateUserRole, deleteUser } =
  await import("../users/users.controllers.js");
const { default: activityRoutes } = await import("./activity.routes.js");
const { authorize } = await import("../../middlewares/auth.middleware.js");
const admin = {
  _id: "admin",
  role: "admin",
  name: "Admin Tester",
  email: "admin@example.test",
  password: "SECRET",
};
const profile = {
  _id: "profile",
  authId: "member",
  name: "Member",
  email: "member@example.test",
  role: "student",
};
const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  },
});

test("audit stores actor and target snapshots without arbitrary fields or credentials", async () => {
  const rows = [];
  const db = {
    collection: (name) => {
      assert.equal(name, "activity_logs");
      return { insertOne: async (row) => rows.push(row) };
    },
  };
  await recordAdminAudit(
    db,
    admin,
    "role_changed",
    { type: "user", id: "member", label: "Member", password: "SECRET" },
    "student → alumni",
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].actor, {
    authId: "admin",
    name: "Admin Tester",
    email: "admin@example.test",
    role: "admin",
  });
  assert.deepEqual(rows[0].target, {
    type: "user",
    id: "member",
    label: "Member",
  });
  assert.equal(rows[0].details, "student → alumni");
  assert.ok(rows[0].createdAt instanceof Date);
  assert.equal(JSON.stringify(rows).includes("SECRET"), false);
  await recordAdminAudit(db, { ...admin, role: "student" }, "role_changed", {});
  await recordAdminAudit(db, admin, "arbitrary_action", {});
  assert.equal(rows.length, 1);
});

test("a logging outage does not turn an already completed action into a failure", async (t) => {
  t.mock.method(console, "error", () => {});
  await assert.doesNotReject(
    recordAdminAudit(
      {
        collection: () => ({
          insertOne: async () => {
            throw new Error("offline");
          },
        }),
      },
      admin,
      "post_blocked",
      { id: "post" },
    ),
  );
});

test("successful admin user updates and role changes append audit events; rejected changes do not", async (t) => {
  let current = { ...profile };
  t.mock.method(UserModel, "findById", async () => ({ ...current }));
  t.mock.method(UserModel, "updateById", async (_id, changes) => {
    current = { ...current, ...changes };
  });
  t.mock.method(AuthModel, "updateRoleById", async () => ({
    modifiedCount: 1,
  }));
  const audit = t.mock.method(ActivityModel, "logAdmin", async () => {});
  const req = (body) => ({
    user: admin,
    params: { id: "profile" },
    body,
    ip: "127.0.0.1",
  });
  const res = response();
  await updateUser(req({ name: "Updated Member", password: "SECRET" }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(audit.mock.calls[0].arguments[1], "user_updated");
  assert.equal(audit.mock.calls[0].arguments[2].label, "Updated Member");
  assert.equal(audit.mock.calls[0].arguments[3], "Updated fields: name.");
  await updateUserRole(req({ role: "alumni" }), response());
  assert.equal(audit.mock.calls[1].arguments[1], "role_changed");
  assert.equal(audit.mock.calls[1].arguments[3], "student → alumni.");
  const bad = response();
  await updateUserRole(req({ role: "invalid" }), bad);
  assert.equal(bad.statusCode, 400);
  assert.equal(audit.mock.callCount(), 2);
  assert.equal(
    JSON.stringify(
      audit.mock.calls.map((call) => call.arguments.slice(1)),
    ).includes("SECRET"),
    false,
  );
});

test("account disable is logged before cleanup; profile removal is logged only after cleanup succeeds", async (t) => {
  t.mock.method(UserModel, "findById", async () => profile);
  t.mock.method(AuthModel, "findById", async () => ({
    ...profile,
    _id: "member",
  }));
  let disabled = false;
  t.mock.method(AuthModel, "disableById", async () => {
    disabled = true;
  });
  t.mock.method(MagicLinkModel, "deleteByEmail", async () => {});
  let cleanupFails = true;
  t.mock.method(UserModel, "deleteByAuthId", async () => {
    if (cleanupFails) throw new Error("cleanup failed");
  });
  t.mock.method(UserModel, "deleteById", async () => {});
  const actions = [];
  t.mock.method(ActivityModel, "logAdmin", async (_actor, action) => {
    assert.equal(disabled, true);
    actions.push(action);
  });
  const req = { user: admin, params: { id: "profile" } };
  const failed = response();
  await deleteUser(req, failed);
  assert.equal(failed.statusCode, 500);
  assert.deepEqual(actions, ["account_disabled"]);
  cleanupFails = false;
  const passed = response();
  await deleteUser(req, passed);
  assert.equal(passed.statusCode, 200);
  assert.deepEqual(actions, [
    "account_disabled",
    "account_disabled",
    "user_deleted",
  ]);
});

test("audit routes expose only GET and restrict access to administrators", () => {
  const endpoints = activityRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => layer.route);
  assert.equal(endpoints.length, 1);
  assert.deepEqual(Object.keys(endpoints[0].methods), ["get"]);
  const guard = authorize("admin");
  for (const role of ["student", "alumni"]) {
    const res = response();
    let reached = false;
    guard({ user: { role } }, res, () => {
      reached = true;
    });
    assert.equal(res.statusCode, 403);
    assert.equal(reached, false);
  }
  let reached = false;
  guard({ user: admin }, response(), () => {
    reached = true;
  });
  assert.equal(reached, true);
});
