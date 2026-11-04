# Activity

The admin `/api/activity` endpoint remains a login/logout audit trail.

Students and alumni use **Settings → Activity Logs** (`/student/accounts?tab=activity` or `/alumni/accounts?tab=activity`). The former `/student/activity-logs` and `/alumni/activity-logs` routes redirect there. Logs are absent from profile pages and visible only to their owner.

`GET /api/users/:id/activity` provides the signed-in user's own history. The UI always uses `me`. A directory profile ID or authentication ID is accepted only when it belongs to the viewer. Requests for anyone else's history return 404, including requests by administrators. Filters: `all`, `posts`, `comments`, `stories`, `profile`. `limit` is 1–30 (default 6); pass `nextCursor` as `before` for the next page.

Posts, reposts, stories, and comments are read from existing feed records. Both a repost and its original must be visible to the viewer. Deleted or blocked posts, their comments/reposts, and deleted comments are excluded before pagination. Connection access is evaluated on every request. Disabled and missing accounts are unavailable.

New edits through the profile and experience forms record changed public section names in `member_activity`. Successful student/alumni password changes and recovery resets record a security event with an action and timestamp; passwords, hashes, and reset tokens are never included. Failed password changes do not create success events. The Security filter and All activity show these events only to the account owner. Previous values, login information, contact details, and private employment metadata are not stored. No historical changes are fabricated. Current publishing permissions still apply: students can review their comments and profile updates; alumni can also review published posts and stories.

Validation:

```sh
cd Server
node --test --test-isolation=none modules/activity/member-activity.test.js
```

The database integration test uses a randomly named isolated database and removes only that database afterward. It requires `MONGO_URI`. The browser fixture at `Client/scripts/member-activity-browser-check.mjs` intercepts APIs and sockets and requires a local Vite preview on port 5173.
