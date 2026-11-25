import test from "node:test";
import assert from "node:assert/strict";
import {
  createUserInvitations,
  invitationProfile,
  ensureInvitationIndexes,
} from "./user-invitations.js";
import { resetTokenHash } from "../auth/password-reset.js";
import { invitationEmail } from "../../utils/email-templates.js";
import { createUserDirectory } from "./user-directory.js";
import { frontendOrigin } from "../../config/frontend-origin.js";

const row = {
  first_name: "Ana",
  middle_name: "Maria",
  last_name: "Cruz",
  email: " ANA@example.test ",
  source_user_type: "alumni",
  address: "123 Sample Street, Manila",
  birthday: "2000-02-29",
  student_number: "2020-001",
  contact_no: "09123456789",
};
const actor = { _id: "admin", role: "admin" };
const at = new Date("2026-11-24T08:00:00Z");
const same = (a, b) =>
  a instanceof Date || b instanceof Date ? +a === +b : String(a) === String(b);
const get = (value, key) =>
  key.split(".").reduce((obj, part) => obj?.[part], value);
function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or")
      return value.some((condition) => matches(doc, condition));
    const actual = get(doc, key);
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.entries(value).every(([op, expected]) =>
        op === "$exists"
          ? (actual !== undefined) === expected
          : op === "$ne"
            ? !same(actual, expected)
            : op === "$lte"
              ? actual <= expected
              : false,
      );
    }
    return value === null ? actual == null : same(actual, value);
  });
}
function fixture(frontendUrl = () => "https://alumni.example.test") {
  let time = at;
  const records = { auth: [], users: [], magic_links: [] };
  const sent = [];
  let accept = true;
  let failProfile = false;
  const db = {
    collection(name) {
      return {
        async findOne(filter) {
          return records[name].find((doc) => matches(doc, filter)) || null;
        },
        async insertOne(doc) {
          if (name === "users" && failProfile)
            throw new Error("Private profile database failure");
          records[name].push(doc);
          return { insertedId: doc._id };
        },
        async deleteMany(filter) {
          records[name] = records[name].filter((doc) => !matches(doc, filter));
        },
        async deleteOne(filter) {
          const index = records[name].findIndex((doc) => matches(doc, filter));
          if (index >= 0) records[name].splice(index, 1);
        },
        async findOneAndUpdate(filter, update) {
          const doc = records[name].find((doc) => matches(doc, filter));
          if (!doc) return null;
          for (const [key, value] of Object.entries(update.$set)) {
            const parts = key.split(".");
            let target = doc;
            while (parts.length > 1) {
              const part = parts.shift();
              target = target[part] ||= {};
            }
            target[parts[0]] = value;
          }
          return { ...doc };
        },
        async updateOne(filter, update) {
          return this.findOneAndUpdate(filter, update);
        },
      };
    },
  };
  const service = createUserInvitations({
    db,
    frontendUrl,
    now: () => time,
    transaction: async (operation) => {
      const before = Object.fromEntries(
        Object.entries(records).map(([key, list]) => [key, [...list]]),
      );
      try {
        return await operation("fixture-session");
      } catch (error) {
        Object.assign(records, before);
        throw error;
      }
    },
    sendEmail: async (to, url) => {
      sent.push({ to, url });
      return { success: accept };
    },
  });
  return {
    service,
    records,
    sent,
    setAccept: (value) => {
      accept = value;
    },
    advance: () => {
      time = new Date(+time + 60_001);
    },
    failProfile: () => {
      failProfile = true;
    },
  };
}

test("manual registration creates linked passwordless records and emails a hashed single-use invitation", async () => {
  const { service, records, sent } = fixture();
  const result = await service.register(
    { ...row, password: "ignored", role: "admin", is_active: false },
    actor,
  );
  const [account] = records.auth;
  const [profile] = records.users;
  assert.equal(account.password, undefined);
  assert.equal(profile.password, undefined);
  assert.equal(account.role, "alumni");
  assert.equal(account.passwordSetupRequired, true);
  assert.equal(account.sourceIsActive, true);
  assert.equal(account.registeredBy, "admin");
  assert.equal(String(profile.authId), String(account._id));
  assert.equal(profile.name, "Ana Maria Cruz");
  assert.equal(profile.studentId, "2020-001");
  assert.match(profile.externalId, /^[1-9]\d{7}$/);
  assert.equal(result.externalId, profile.externalId);
  assert.equal(profile.address, row.address);
  assert.equal(profile.birthday, row.birthday);
  assert.equal(result.invitationDelivery, "accepted");
  assert.equal(sent[0].to, "ana@example.test");
  const token = new URL(sent[0].url).searchParams.get("token");
  assert.match(token, /^[a-f\d]{64}$/);
  assert.equal(records.magic_links[0].tokenHash, resetTokenHash(token));
  assert.equal(records.magic_links[0].token, undefined);
  assert.equal(+records.magic_links[0].expiresAt - +at, 24 * 60 * 60 * 1000);
  assert.equal(JSON.stringify(result).includes(token), false);
});

test("failed delivery keeps the account, removes the failed credential, and allows a later resend", async () => {
  const f = fixture();
  f.setAccept(false);
  const result = await f.service.register(row, actor);
  assert.equal(result.invitationDelivery, "failed");
  assert.equal(f.records.auth.length, 1);
  assert.equal(f.records.users.length, 1);
  assert.equal(f.records.magic_links.length, 0);
  await assert.rejects(
    f.service.resend(result.authId),
    (error) => error.status === 429,
  );
  f.advance();
  f.setAccept(true);
  assert.equal(
    (await f.service.resend(result.authId)).invitationDelivery,
    "accepted",
  );
  assert.equal(f.records.auth.length, 1);
  assert.equal(f.records.magic_links.length, 1);
});

test("invitation and resend URLs follow the server environment and allowed local UI origin", async () => {
  for (const production of [false, true]) {
    const env = {
      NODE_ENV: production ? "production" : "development",
      FRONTEND_URL: "https://sielalumnilink.onrender.com",
    };
    const f = fixture((origin) => frontendOrigin(env, origin));
    const result = await f.service.register(
      row,
      actor,
      "http://localhost:5173",
    );
    assert.equal(
      new URL(f.sent[0].url).origin,
      production ? env.FRONTEND_URL : "http://localhost:5173",
    );
    f.advance();
    await f.service.resend(result.authId, "http://localhost:5174");
    assert.equal(
      new URL(f.sent[1].url).origin,
      production ? env.FRONTEND_URL : "http://localhost:5174",
    );
    assert.equal(new URL(f.sent[1].url).pathname, "/verify-magic-link");
  }
});

test("duplicate registrations fail and a failed profile insert rolls the account back", async () => {
  const f = fixture();
  await f.service.register(row, actor);
  await assert.rejects(
    f.service.register(row, actor),
    (error) => error.status === 409,
  );
  assert.equal(f.sent.length, 1);
  const broken = fixture();
  broken.failProfile();
  await assert.rejects(broken.service.register(row, actor));
  assert.equal(broken.records.auth.length, 0);
  assert.equal(broken.records.users.length, 0);
  assert.equal(broken.sent.length, 0);
});

test("resending rotates only invitation tokens and refuses activated or disabled users", async () => {
  const f = fixture();
  const first = await f.service.register(row, actor);
  const oldHash = f.records.magic_links[0].tokenHash;
  f.records.magic_links.push({
    authId: f.records.auth[0]._id,
    purpose: "login",
    tokenHash: "separate-login",
  });
  f.advance();
  await f.service.resend(first.authId);
  assert.equal(
    f.records.magic_links.some((link) => link.tokenHash === oldHash),
    false,
  );
  assert.equal(
    f.records.magic_links.some((link) => link.tokenHash === "separate-login"),
    true,
  );
  f.records.auth[0].passwordSetupRequired = false;
  await assert.rejects(
    f.service.resend(first.authId),
    (error) => error.status === 409,
  );
  f.records.auth[0].passwordSetupRequired = true;
  f.records.auth[0].disabledAt = new Date();
  await assert.rejects(
    f.service.resend(first.authId),
    (error) => error.status === 404,
  );
});

test("registration validates required schema fields and cannot create elevated accounts", () => {
  for (const input of [
    null,
    {},
    { ...row, first_name: "" },
    { ...row, email: {} },
    { ...row, email: "invalid" },
    { ...row, source_user_type: "admin" },
    { ...row, contact_no: "1".repeat(21) },
    { ...row, last_name: "a".repeat(256) },
  ]) {
    assert.throws(
      () => invitationProfile(input),
      (error) => error.status === 400,
    );
  }
});

test("email template explains password setup and safely escapes the link", () => {
  const template = invitationEmail(
    'https://alumni.example.test/verify?token=test&x="value"',
  );
  assert.match(template.subject, /invited/);
  assert.match(template.text, /24 hours/);
  assert.match(template.text, /No password has been assigned/);
  assert.match(template.html, /&amp;x=&quot;value&quot;/);
});

test("the login email is protected by a unique database index", async () => {
  await ensureInvitationIndexes({
    collection(name) {
      assert.equal(name, "auth");
      return {
        async createIndex(fields, options) {
          assert.deepEqual(fields, { email: 1 });
          assert.equal(options.unique, true);
        },
      };
    },
  });
});

test("only administrators see invitation delivery and password-setup status in the directory", async () => {
  const profile = {
    _id: "profile",
    authId: "member",
    name: "Ana Cruz",
    email: "ana@example.test",
    role: "alumni",
  };
  const account = {
    _id: "member",
    email: profile.email,
    role: "alumni",
    registrationSource: "manual",
    passwordSetupRequired: true,
    invitation: { delivery: "failed", lastAttemptAt: at },
    password: "private-hash",
  };
  const list = createUserDirectory({
    collection(name) {
      return {
        find() {
          return {
            async toArray() {
              return name === "users" ? [profile] : [account];
            },
          };
        },
      };
    },
  });
  const [adminRow] = await list(actor);
  assert.equal(adminRow.invitationStatus, "failed");
  assert.equal(adminRow.password, undefined);
  account.passwordSetupRequired = false;
  assert.equal((await list(actor))[0].invitationStatus, "completed");
  const [memberRow] = await list({ _id: "other-member", role: "student" });
  assert.equal(memberRow.invitationStatus, undefined);
  assert.equal(memberRow.email, undefined);
});

test("registration requires complete personal details and rejects invalid dates and identifiers", () => {
  for (const key of ["address", "birthday"]) {
    assert.throws(
      () => invitationProfile({ ...row, [key]: " " }),
      (error) => error.status === 400,
    );
  }
  for (const birthday of [
    "2001-02-29",
    "2000-02-30",
    "2099-01-01",
    "2000-13-01",
    "yesterday",
  ]) {
    assert.throws(
      () => invitationProfile({ ...row, birthday }),
      (error) => error.status === 400,
    );
  }
  assert.throws(
    () => invitationProfile({ ...row, address: "x".repeat(1001) }),
    (error) => error.status === 400,
  );
});

test("manual registration automatically assigns distinct IDs and ignores client-provided identifiers", async () => {
  const f = fixture();
  const first = await f.service.register(
    { ...row, external_id: "123", externalId: "456" },
    actor,
  );
  const second = await f.service.register(
    { ...row, email: "another@example.test" },
    actor,
  );
  assert.match(first.externalId, /^[1-9]\d{7}$/);
  assert.match(second.externalId, /^[1-9]\d{7}$/);
  assert.notEqual(first.externalId, second.externalId);
  assert.notEqual(first.externalId, "123");
  assert.notEqual(first.externalId, "456");
  assert.equal(f.records.users[0].externalId, first.externalId);
  assert.equal(f.records.users[1].externalId, second.externalId);
});
