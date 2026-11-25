import test from "node:test";
import assert from "node:assert/strict";
import { contactUpdates } from "./profile-contact.js";

test("contact fields and repeatable links are normalized without changing login identity", () => {
  assert.deepEqual(
    contactUpdates({
      email: "login@example.test",
      role: "admin",
      contactEmail: " contact@example.test ",
      contactNumber: " +63 912 345 6789 ",
      profileLinks: [
        { type: "website", url: "myportfolio.example.test/work" },
        { type: "github", url: "https://github.com/student" },
        { type: "github", url: "https://github.com/student/project" },
      ],
    }),
    {
      contactEmail: "contact@example.test",
      contactNumber: "+63 912 345 6789",
      profileLinks: [
        { type: "website", url: "https://myportfolio.example.test/work" },
        { type: "github", url: "https://github.com/student" },
        { type: "github", url: "https://github.com/student/project" },
      ],
    },
  );
});

test("removing all contact fields and links is persisted explicitly", () => {
  assert.deepEqual(
    contactUpdates({ contactEmail: "", contactNumber: "", profileLinks: [] }),
    {
      contactEmail: "",
      contactNumber: "",
      profileLinks: [],
    },
  );
  assert.deepEqual(contactUpdates({ bio: "Existing profile update" }), {});
});

test("malformed fields, unsupported types, and unsafe URLs are rejected", () => {
  for (const body of [
    { contactEmail: "not-an-email" },
    { contactNumber: {} },
    { contactNumber: "1".repeat(61) },
    { profileLinks: {} },
    {
      profileLinks: Array(21).fill({
        type: "website",
        url: "https://example.test",
      }),
    },
    { profileLinks: [null] },
    { profileLinks: [{ type: "unknown", url: "https://example.test" }] },
    ...[
      "javascript:alert(1)",
      "data:text/html,test",
      "ftp://example.test",
      "https://user:pass@example.test",
      "",
      "invalid",
      "x".repeat(2049),
    ].map((url) => ({ profileLinks: [{ type: "website", url }] })),
  ])
    assert.throws(() => contactUpdates(body));
});


test('account personal details normalize to the fields used by the admin directory', () => {
  assert.deepEqual(contactUpdates({ address: '  Manila  ', birthday: '2000-02-29', externalId: '123' }),
    { address: 'Manila', birthday: '2000-02-29' });
  assert.deepEqual(contactUpdates({ address: '', birthday: '' }), { address: null, birthday: null });
  for (const body of [{ address: {} }, { address: 'x'.repeat(1001) }, { birthday: 2000 },
    { birthday: '2001-02-29' }, { birthday: '2099-01-01' }, { birthday: 'invalid' }]) {
    assert.throws(() => contactUpdates(body));
  }
});
