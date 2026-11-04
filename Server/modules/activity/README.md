# Activity

The admin-only `GET /api/activity` endpoint is a read-only view of student/alumni login and logout history. The **Audit Logs** sidebar page at `/admin/audit-logs` shows the latest 200 matching user-access events with four columns: actor, event, target account, and time. Admin logins, logouts, and management actions are excluded on the server before the result limit, and the UI also excludes explicitly tagged admin records. Filters are All events, Login, and Logout. New access records preserve the actor's role. Older records resolve roles from the auth account (using auth ID, or email when no ID exists); unclassified records are omitted. There are no audit edit/delete endpoints or buttons.

Admin events include user creation, changed name/email fields, role changes, graduation, directory sync summaries, account disabling/profile removal, post/comment removal, post blocking/restoration, comment controls, and feed participation restrictions. Events are appended after the relevant operation succeeds. Account disabling is recorded before directory cleanup, so a cleanup failure still leaves a truthful record of the completed disable action. Recording is best-effort: database logging failures are reported to the server console and do not reverse completed operations. Older admin actions are not backfilled. Personal member activity and password events remain owner-only and are not read by this endpoint. Admin action records remain stored for the acting admin's personal Activity Logs; they are not returned in the user-access view.

Students and alumni use **Settings → Activity Logs** (`/student/accounts?tab=activity` or `/alumni/accounts?tab=activity`). The former `/student/activity-logs` and `/alumni/activity-logs` routes redirect there. Logs are absent from profile pages and visible only to their owner.

Admins also have their own **Settings > Activity Logs** (`/admin/settings?tab=activity`). It combines only that admin's existing audit records, own shared content, and private security events. Admin actions and login/logout have dedicated filters; existing audit records are reused without copying. Admin accounts without a directory profile can use their own history. Ownership checks still prevent access to another user's personal history, including another admin's. User Audit Logs exclude admin records and private member/security history.

`GET /api/users/:id/activity` provides the signed-in user's own history. The UI always uses `me`. A directory profile ID or authentication ID is accepted only when it belongs to the viewer. Requests for anyone else's history return 404, including requests by administrators. Filters: `all`, `posts`, `comments`, `stories`, `profile`, `security`; admins also have `admin` and `access`. `limit` is 1–30 (default 6); pass `nextCursor` as `before` for the next page.

Personal Activity Logs use numbered server pages, Previous/Next controls, totals, and a 5/10/20/30 page-size selector (default 10). Send `page` and `limit` to receive `items`, `page`, `limit`, `total`, and `totalPages`. Counts include only visible records belonging to the signed-in account. The existing cursor format remains supported when `page` is omitted; `page` and `before` cannot be combined. Changing filters, refreshing, or receiving content invalidations returns to page 1. Each page replaces the displayed records and rechecks permissions.

Posts, reposts, stories, and comments are read from existing feed records. Both a repost and its original must be visible to the viewer. Deleted or blocked posts, their comments/reposts, and deleted comments are excluded before pagination. Connection access is evaluated on every request. Disabled and missing accounts are unavailable.

New edits through the profile and experience forms record changed public section names in `member_activity`. Successful student/alumni/admin password changes and recovery resets record a security event with an action and timestamp; passwords, hashes, and reset tokens are never included. Failed password changes do not create success events. The Security filter and All activity show these events only to the account owner. Previous values, login information, contact details, and private employment metadata are not stored. No historical changes are fabricated. Current publishing permissions still apply: students can review their comments and profile updates; alumni can also review published posts and stories.

Validation:

```sh
cd Server
node --test --test-isolation=none modules/activity/member-activity.test.js
node --test --test-isolation=none --test-force-exit modules/activity/admin-audit.test.js modules/feed/feed.test.js modules/auth/auth.security.test.js
```

The database integration test uses a randomly named isolated database and removes only that database afterward. It requires `MONGO_URI`. The browser fixture at `Client/scripts/member-activity-browser-check.mjs` intercepts APIs and sockets and requires a local Vite preview on port 5173.

`Client/scripts/admin-audit-browser-check.mjs` verifies the admin audit view on desktop and mobile with intercepted APIs: legacy access events, admin actors, target/details, search, filters, pagination, refresh recovery, and absence of edit/delete controls and write requests.
