Notifications expire three calendar months after `createdAt`, using Asia/Manila
time and clamping month-end dates to the last valid day. This applies to every
notification kind and recipient, whether read or unread.

At backend startup, `ensureNotificationRetention` backfills `expiresAt` on existing
dated records, permanently deletes the expired backlog with `deleteMany`, and
installs a MongoDB TTL index on `expiresAt`. New personal and broadcast
notifications include the same expiry. Marking notifications read does not extend
their lifetime.

MongoDB performs subsequent physical deletions in its background TTL passes, so
deletion may happen shortly after expiry rather than at the exact millisecond.
Inbox lists and unread counts exclude expired records immediately, including
while a TTL pass is pending. TTL remains active while the API is stopped.

Restart the backend to install the index and clean existing notifications. This
only deletes documents from `notifications`; linked jobs, events, announcements,
connections, and user accounts are retained.

Validation:

- `npm run test:notifications` uses in-memory fixtures.
- `npm run test:notifications:integration` uses `MONGO_URI` and a randomly named,
  isolated test database, verifies backfill, hard deletion and the TTL index, then
  drops only that test database.
