# Post actions and reporting

The existing `/api/feed` service remains the source of truth. Every endpoint
uses the existing cookie-session `protect` middleware. Ownership comes from
the authenticated account; administrator checks run in the service, including
for report images. No new dependencies or environment variables are required.

## Data and startup

Restart the API after deployment. Its existing `ensureFeedIndexes` startup hook
creates the new collections and indexes before accepting traffic:

- `feed_post_states`: one private document per account/post, keyed by
  `${authId}:${postId}`; contains `saved`, `preference`, and timestamps. A single
  preference can be `interested`, `not_interested`, or null. Account-specific
  saved/preference indexes support collection filters.
- `feed_post_reports`: reporter/post/owner identifiers, reason, sanitized plain
  explanation, status, administrator notes, reviewer and review timestamps,
  immutable submission snapshot, and an append-only transition history. A
  partial unique index prevents two active reports per reporter/post. Terminal
  reports allow a later submission. Status and reporter/date indexes support
  review and the 20-reports/hour submission policy.
- `feed_posts.isPinned`: a partial unique index allows one active pinned post
  per author. Missing values behave as false. Existing `deletedAt`, `updatedAt`,
  moderation history, images, comments, reactions, and reposts are reused.
- `activity_logs`: `post_report_reviewed` records administrator transitions;
  public-visibility changes also use the existing `post_blocked` audit event.

No document backfill is required. No production data is changed by the tests.
New report records and their snapshots are accessible only to administrators.
Report submissions never change post visibility. Snapshot images are retained
for review, including after an edit or soft deletion.

## API

All responses use the existing `{ success, data }` / `{ success, message }`
format. Paths below are relative to `/api/feed`.

| Method | Path | Input or behavior |
| --- | --- | --- |
| GET | `/` | Existing filters plus `collection=all\|saved\|hidden`, `author=<authId>`, and existing `before`/`limit` pagination |
| PUT | `/:id/state` | `{ saved: boolean }` and/or `{ preference: 'interested'\|'not_interested'\|null }`; preferences apply only to other authors |
| PUT | `/:id/pin` | `{ pinned: boolean }`; author only, limit one active pin |
| PUT | `/:id` | Extends existing editing to all post types, validates attachments and preserves unchanged content and engagement |
| DELETE | `/:id` | Existing owner/admin soft deletion |
| POST | `/:id/report` | `{ reason, description? }`; explanation required for Other; rejects self-reports, invalid reasons, and duplicate active reports |
| GET | `/post-reports` | Admin only; optional `status` and `before`; returns counts and up to 30 reports with previews |
| GET | `/post-reports/:reportId` | Admin only; content, submission snapshot, attachments, people, and moderation history |
| PATCH | `/post-reports/:reportId` | Admin only; `{ status, adminNotes?, removePost? }` |
| GET | `/post-reports/:reportId/images/:imageId` | Admin only; protected submission-snapshot image download |

Review transitions are `pending -> under_review -> resolved`, or dismissal
from either active status. Resolution requires notes. `removePost: true` during
resolution blocks public visibility using existing moderation; administrators
can later restore visibility with the existing controls. A short database lock
and conditional status update protect concurrent review. Each transition
retains the administrator, timestamp, notes, and visibility action.

## UI

- `PostActions.jsx`: ownership-specific four-option menu, outside-click and
  Escape dismissal, loading/error/success feedback, report and trash dialogs.
- `FeedComposer.jsx`: reused for editing; supports existing photos, replacement
  uploads, removal from the edited post, structured stories, and event dates.
- `AlumniFeed.jsx`: private Saved posts and Not interested posts views; the
  latter lets members reverse hidden preferences. Hidden posts are excluded
  from the normal feed. Interest is persisted for future personalization;
  this change retains the chronological feed order.
- `FeedPost.jsx`: pin indicator and shared post actions. Existing administrator
  moderation controls remain separately available through the shield button.
- The API supports author-filtered posts with pins first, audience restrictions,
  and pagination. The profile page does not display a Posts section.
- `CommunityModeration.jsx`: `/admin/community` provides report review,
  restrictions, appeals, and moderation history. The former `/admin/post-reports`
  and `/admin/feed` pages redirect here; the separate Post Reports menu is removed.

The existing moderation system supports blocking/restriction, but has no
dedicated warning workflow; no new warning mechanism is introduced.

## Validation

```text
cd Server
npm run test:feed
node --test --test-force-exit modules/feed/feed.integration.test.js
cd ../Client
npm run lint
npm run build
node scripts/post-actions-browser-check.mjs
```

Integration tests use the existing `MONGO_URI` and optional Cloudinary settings,
random isolated `feed_<uuid>` databases, and clean up their own assets/data.
The browser script uses the repository's existing local Playwright installation
and headless Edge with isolated HTTP fixtures; it verifies UI interaction and
desktop/mobile layout independently of the real MongoDB integration checks.

Verified: 38 feed regression tests, three real MongoDB/image integration tests,
production build, and Edge checks at 1440px and 390px. Changed feature components
pass targeted lint. Repository-wide lint still reports 24 existing errors and
17 warnings in unrelated code (including the existing route-loading effect in
`App.jsx`); those are outside this feature's changes. The production build also
retains its bundle-size warning.

## Changed files

Created:

- `Server/modules/feed/post-actions.js`
- `Server/modules/feed/POST-ACTIONS.md`
- `Client/src/components/feed/PostActions.jsx`
- `Client/src/pages/admin/adminPostReports.jsx`
- `Client/scripts/post-actions-browser-check.mjs`

Extended:

- `Server/modules/feed/feed.service.js`, `feed.routes.js`, `feed.images.js`,
  `feed.integration.test.js`, and `README.md`
- `Server/modules/activity/admin-audit.js`
- `Client/src/components/feed/AlumniFeed.jsx`, `FeedPost.jsx`,
  `FeedComposer.jsx`, and `AdminFeedTools.jsx`
- `Client/src/layout/sidebar/admin/adminSidebar.jsx`
- `Client/src/utils/auditActions.js`
- `Client/src/App.jsx`
