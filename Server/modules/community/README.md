# Community moderation and account enforcement

This module extends the existing feed reporting, session authentication,
notifications, messaging, connections, Socket.IO, and administrator dashboard.
It uses the existing MongoDB driver and native `fetch`; no dependencies were
added. The API, rather than React state, controls permitted activity.

## Deployment and provider configuration

1. Deploy the server and client changes together, then restart the API.
   `src/index.js` creates moderation indexes before accepting traffic. Existing
   user accounts, posts, and messages need no backfill or destructive migration.
2. For AI classification, configure **server-only** `OPENAI_API_KEY` in
   `Server/.env` or the server's secret store. Never use a `VITE_` variable.
3. Open `/admin/community`, inspect the provider status, and calibrate policy
   thresholds with representative alumni content. The UI distinguishes a key
   being configured from an actual successful analysis. No live AI verification
   was possible in this checkout because no key is configured.
4. Review categories, thresholds, malicious-domain entries, strike policies,
   notifications, appeals, and retention under Settings.

The adapter calls the fixed HTTPS OpenAI `/v1/moderations` endpoint with
`omni-moderation-latest`, using text and supported image inputs. See the
[official moderation guide](https://developers.openai.com/api/docs/guides/moderation).
Requests time out after seven seconds; successful classifications are cached
by a content fingerprint for one minute, with a 500-entry bound. API response
bodies, credentials, and private content are never written to operational logs.
Provider failures and missing credentials are logged as unavailable, rather
than treated as proof of a violation. Legitimate content can proceed while
independent deterministic checks remain active. There are no automatic retries
or generated-text API calls. A thirty-second outage cooldown prevents repeated
failed requests from overwhelming the provider.

## Decisions and safeguards

- Normal content is allowed. Each analysis records its outcome and whether the
  provider was available.
- Uncertain signals hold the candidate before publication/delivery and create
  a pending case, without adding a strike. Existing content remains unchanged
  when an edited candidate is held.
- High-confidence flagged categories and administrator-verified malicious
  domains can reject content and create confirmed cases. Confirmation can
  trigger configurable warnings or temporary restrictions. Critical cases have
  priority in the queue and still require administrator review.
- Provider scores are classification signals, not calibrated probabilities or
  proof of intent. Every decision can be reviewed and overturned. Unreviewed
  automatic confirmations remain included in Pending Reviews.
- Default minor escalation is a warning, then one day, three days, seven days,
  and fourteen days. First critical violations can receive a one-day protective
  communication restriction. Automatic policies are capped at level 4 and
  thirty days. Only administrators can suspend an account or define a longer
  finite duration (up to 365 days).
- Confirmed cases count as strikes; dismissed and overturned cases do not.
  One candidate creates one case per ten-minute window. Account-scoped database
  locks serialize review, strike enforcement, and appeal decisions. Confirmation
  of an existing automatic decision does not add another strike.
- A user report creates a pending case only. Report volume never proves a
  violation or automatically restricts the reported account. Both Post Reports
  and Community Moderation use the same review and appeal lifecycle.
- Dismissed held candidates can be resubmitted unchanged for thirty days.
  Held content is **not** automatically published after dismissal; the member
  retries the original form. Previously removed content stays under its
  existing moderation/trash controls and requires explicit administrator
  restoration where supported.

Deterministic signals combine repetition/frequency with content characteristics,
credential requests with disguised/numeric-host links, executable links with
installation instructions, financial solicitation with links, and directed
future threats with additional timing/location/weapon context. Quotation/reporting/educational cues downgrade uncertain detections to human
review rather than automatic strikes. Short repeated
acknowledgements are not considered spam by repetition alone. Uncertain rule
signals require review and never directly add strikes. Only explicitly verified
domains entered by an administrator produce high-confidence domain verdicts.

## Restriction enforcement

| Level | Server-enforced restrictions |
| --- | --- |
| 1 | Warning only; features remain available |
| 2 | New/edited posts, comments, replies, and publishing interactions |
| 3 | Level 2 plus sending messages, calls, and initiating connections |
| 4 | Community interactions, incoming messages, accepting connections, and public profile changes; notice/appeals/account settings remain available |
| 5 | Suspension of normal community access; authenticated notice, appeals, password setup, and permitted account settings remain available |

`protect` invokes the centralized request boundary after verifying the actual
cookie session. No client-supplied role, account ID, restriction state, or expiry
is accepted. Active restrictions are queried by start/expiry/revocation dates on
each request; expiration does not depend on a scheduler, logout, or JWT refresh.
An associated dismissed case never blocks access, even if a stale concurrent
write left an unreconciled restriction record.
The guard returns a 403 response containing the restriction reason, level,
features, expiry, and `/community-status` appeal link. Level 3 users can still
accept existing requests; levels 4/5 cannot.

New restrictions made through the older feed controls now use central cases and
finite posting restrictions (the configured fourth escalation duration, seven
days by default). Their existing restore control remains available. Previous
legacy flags remain readable; an explicit administrator change for that author
converts the old flag to the central policy.

Feed creation, edits, reposts, comments, and replies are checked in the feed
service before persistence. Message creation/editing checks the sender and
recipients in the shared message model, covering HTTP sends, shared-post sends,
and other model callers. Multipart images are checked before upload/delivery;
executable attachments are held for review. A final sender check follows slow
upload/provider work. Incoming restrictions stop new direct and group delivery;
a send to a group containing an unavailable member is rejected as a whole.

Public profile updates and supported image uploads are inspected, along with
career guides, referrals, jobs, activities/events, and announcements. Connection
requests use an atomic frequency counter. Private account credentials and
unrelated application bodies are never sent to the moderation provider.

Every socket packet passes the session check and centralized community guard.
Call invites, signaling, group calls, meeting interactions, and meeting chat
cannot bypass restrictions. Meeting chat is analyzed before entering a room's
history or reaching peers. Restriction changes terminate established calls;
periodic checks provide a thirty-second fallback. No private evidence is sent in
realtime invalidations.

## APIs

Paths are relative to `/api/community`; all require authentication. Every
`/admin` endpoint additionally requires the existing administrator role, and
service methods repeat the authorization checks.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | Own active restrictions, cases, appeal history, and appeal availability |
| GET | `/cases/:id` | Owner-visible case details; administrator-only confidential details |
| POST | `/cases/:id/appeals` | One owner appeal per case; requires explanation |
| GET | `/admin/stats` | Reports, detections, pending reviews, active restricted users, suspensions, appeals, resolved cases, provider status |
| GET / PUT | `/admin/settings` | Read/update validated policy settings |
| GET | `/admin/cases` | Queue; status/user filters, priority/date pagination |
| GET / PATCH | `/admin/cases/:id` | Evidence and review transitions with required notes |
| POST | `/admin/cases/:id/restrictions` | Apply/change a restriction on a confirmed case |
| PATCH | `/admin/restrictions/:id/restore` | Revoke a restriction with an administrator explanation |
| GET | `/admin/users/:id` | Confidential account moderation history |
| GET | `/admin/appeals` | Paginated appeals |
| PATCH | `/admin/appeals/:id` | Pending → under review → approved/rejected |
| GET | `/admin/audit` | Paginated administrator/system audit events |
| GET | `/admin/cases/:id/images/:index` | Protected evidence image access, with access auditing |

Approving an appeal dismisses the associated case, removes its active strike,
revokes that case's restrictions, synchronizes any post report, and notifies the
member. Unrelated restrictions remain intact. Rejecting an appeal never extends
the original expiry. Administrators can separately lift a restriction without
overturning the underlying violation.

## Database and privacy

- `community_settings`: validated policy and administrator change history.
- `community_cases`: category, severity, method, score, target reference,
  decision/status, priority, strike metadata, reviewer, and decision history.
- `community_restrictions`: user/case, level, reason, issuer, start, expiry,
  revocation, and automatic/manual source.
- `community_appeals`: owner explanation, status, reviewer, notes, and history;
  case primary key prevents duplicate appeals.
- `community_audit`: append-only actions and evidence/history access events.
- `community_checks`: content fingerprint and analysis results; fourteen-day TTL.
- `community_activity`: atomic attempt counters with short-lived TTL.
- `community_evidence` / `community_assets`: case-specific submitted text and
  image evidence, retained for the configured period (default ninety days).
  Expired evidence is denied at read time even before MongoDB's TTL cleanup.
  Metadata and audit history remain after evidence expiration.
- `community_locks`: expiring ownership tokens for serialized account decisions.

Indexes support user/status histories, fingerprints, queue priority/date order,
active restriction lookups, case restrictions, appeal status, audit targets, and
TTL cleanup. A private-message case reveals only its retained submitted content,
not the member's entire conversation history. The case owner never receives
the reporter identity or confidential report description. Evidence images require
administrator authorization; user-supplied URLs are never fetched by the server.
Protected image proxying is limited to stored Cloudinary asset URLs.

## UI

`/community-status` provides restriction notices, expiry, details, and appeals.
Global account guarding shows notices after login, responds to restricted API
responses, redirects severe restrictions to Account Status, and preserves
password setup, appeals, and permitted account settings. Member sidebars include
Account Status. Quarterly tracer gating does not obstruct appeals/settings.

`/admin/community` is the Community Moderation Center in the existing admin
sidebar. It includes statistics, a queue with critical priority, confidential
case details, strike/account history, configurable restrictions, appeals,
settings, provider health, and an audit log. It follows the existing responsive
layout, dialogs, colors, and session context.

## Files

New backend files are in `Server/modules/community/`: `community.policy.js`,
`community.provider.js`, `community.service.js`, `community.runtime.js`,
`community.events.js`, `community.routes.js`, the unit/integration tests, and this
README. New frontend files are `CommunityGuard.jsx`, `CommunityStatus.jsx`,
`pages/admin/CommunityModeration.jsx`, and `scripts/community-browser-check.mjs`.

Extended existing files: server authentication middleware; feed service/routes,
post actions and image handling; messages model/controllers; connection and user
controllers; upload routes; socket and meeting runtimes; app/startup; `.env.example`;
client `App.jsx`, Axios feedback, quarterly gate, and the three role sidebars.

## Verification

```text
cd Server
node --test --test-isolation=none modules/community/community.test.js modules/feed/feed.test.js
npm run test:security
node --test --test-force-exit modules/community/community.integration.test.js modules/community/community.delivery.integration.test.js modules/messages/messaging.integration.test.js modules/feed/feed.integration.test.js
cd ../Client
npm run lint
npm run build
node scripts/community-browser-check.mjs
```

Tests use isolated randomly named databases and remove only their own fixtures.
The delivery test exercises real cookie authentication, HTTP controllers, and
Socket.IO. The browser script runs the actual backend/database at desktop and
mobile widths with fixture accounts, rather than replacing moderation responses
with frontend mocks. Provider protocol/error tests use an injected transport;
they do not constitute live AI-provider verification.

Verified in this workspace: 44 policy/feed unit tests, 84 existing security tests,
11 moderation/database/authenticated HTTP/socket checks, 14 existing messaging
integration checks, and three existing feed/image integration checks. The final
production build passed, as did the real-backend browser workflow at 1440px and
390px. Changed feature components pass targeted ESLint checks. Repository-wide
lint still reports the existing 24 errors and 17 warnings outside these feature
changes, including the pre-existing route-loading effect in `App.jsx`. The build
retains its existing large-bundle warning.

## Limits

AI classification is not operational until a valid backend key is configured;
there was no live-provider verification in this environment. Model scores need
ongoing evaluation and threshold calibration. Identity impersonation, ownership
of content, novel phishing sites, and fraud cannot be conclusively determined by
these classifiers; uncertain cases require human review. This is not an antivirus
scanner or a comprehensive URL-reputation service. Raw documents, audio/video,
and unsupported legacy profile image formats are not semantically scanned.
Supported new JPEG/PNG/GIF/WebP uploads can receive image moderation. Evidence
attachments to appeals are not added because there is no existing secure appeal
upload workflow; appeals support text explanations. Held submissions require
resubmission after clearance; removed content is not automatically restored.
