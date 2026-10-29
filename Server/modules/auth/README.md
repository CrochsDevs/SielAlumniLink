# Authentication security

Public signup is disabled. Existing imported profiles activate with the registered email's single-use link. A profile without a login must have an explicit `student` or `alumni` role; missing/invalid roles require administrator correction. First activation preserves that role and creates no password. Account role is read from the auth record during authorization.

## Sessions and account removal

Session JWTs carry the account ID and an integer `sv` matching `auth.sessionVersion` (missing database versions mean zero). HTTP and Socket.IO authentication reject disabled accounts, obsolete versions, wrong-purpose credentials, expired tokens, and unsupported token formats.

Password recovery, password changes, logout, role changes, email changes, and account disablement increment the version. Password recovery consumes its reset credential in the same write. Existing recovery/magic links are invalidated by credential cleanup or their bound session version. Password changes require sign-in again. First-time password setup issues a fresh session using the updated version.

First-time setup and authenticated password changes compare the request's authorized session version, password and setup state in the same database write. Concurrent or stale requests receive HTTP 409. Setup signs only the version produced by its successful write, so a later revocation cannot be adopted by re-reading the account.

Logout clears the cookie and reports success only after required session revocation completes. Storage/revocation failure returns a generic HTTP 503 and retains the cookie for retry. The shared client preserves auth state on that failure and the logout page displays the error; a successful retry returns to login. Invalid/expired cookies may still be cleared without a revocation write. Audit logging remains optional.

Deletion disables the auth record first, removes credentials/challenges, disconnects its sockets, and then deletes associated profiles. The disabled identity is retained as a tombstone so links or later profile imports cannot silently reactivate it. A cleanup failure still leaves access disabled. Administrators cannot delete their own account.

Socket revocation events disconnect sessions on the current server immediately. Each socket packet also rechecks the database, with a 30-second background check and a token-expiry timer. In a deployment with multiple Socket.IO servers, configure a shared Socket.IO adapter for immediate room-wide disconnects across processes; without it, idle sockets on another process are removed by the background check. HTTP authorization and incoming socket packets check current database state independently.

## Same-browser account synchronization

Normal tabs in one browser profile share the httpOnly login cookie. After successful password login, magic-link verification, first-password setup or logout, the client sends a nonce-only notice through BroadcastChannel and a storage-event fallback. Other tabs disconnect their old socket and navigate through the role-aware entry page, reloading the account from `/auth/me` and discarding previous page/chat state. A same-tab switch between different accounts also navigates afresh. Returning to a tab rechecks the server identity to recover from missed notifications. Separate browser profiles/private contexts remain independent.

The shared Axios client binds protected requests to the displayed account with `X-Account-Id`. Authenticated middleware and logout reject a mismatch with HTTP 409 / `SESSION_ACCOUNT_CHANGED` before a handler can modify or sign out the new cookie account. The client then reloads the session. The header does not grant access; cookie validation and role authorization remain mandatory. Session discovery/sign-in intentionally omit the binding, and delayed responses from a previous account are canceled. Auth responses always expose the authoritative auth ID even if no directory profile exists. Deploy the frontend/backend together so CORS permits the new header.

Verify with `npm run test:auth-security` and `node scripts/security-followup-review.mjs` in Server, plus `node scripts/session-sync-browser-check.mjs` in Client with the local dev server running. The browser check uses mocked HTTP/socket traffic with real isolated cookie jars, BroadcastChannel/storage events, two normal tabs, focus recovery, magic-link/setup transitions and a separate private context. No production account or provider operations are performed.

## Request and challenge limits

Limits use atomic MongoDB counters shared by server processes. They fail closed if storage is unavailable. Keys are HMACs; the collection does not store raw email/IP values. TTL cleanup is created during server startup.

| Operation | Per IP | Per normalized email | Fixed window |
| --- | --- | --- | --- |
| Password login | 60 | 10 | 15 minutes |
| Magic-link or OTP send (shared quota) | 10 | 1 | 1 minute |
| OTP or magic-link verification | 60 | 20 when email is present | 15 minutes |
| Password reset | 20 | — | 15 minutes |

A particular OTP challenge also allows at most five verification attempts, enforced atomically on the auth record across IPs and server processes. A new code resets the challenge budget. A limited request receives HTTP 429 and `Retry-After`; the UI displays the server response. Requesting a new OTP invalidates outstanding reset credentials.

All invalid password logins return the same HTTP 401 and message, including unknown, disabled and passwordless accounts. Those paths still perform bcrypt verification using a timing-placeholder hash when no usable credential exists. Recovery and magic-link sends use generic HTTP 200 responses for eligible/ineligible accounts and mail-delivery failures. Failed delivery still invalidates the generated secret; delivery failure is logged only on the server. The response intentionally does not confirm delivery. Rate-limit and service-storage failures remain separate operational errors; network/mail timing is not claimed to be identical.

## Deployment

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, and the exact frontend URL in `FRONTEND_URL`.
- For a reverse proxy, set `TRUST_PROXY` to its actual trusted IP/CIDR entries, comma-separated (for example `loopback` for a local proxy). Ensure the proxy replaces untrusted forwarded headers. The default does not trust forwarded headers.
- The proxy must support WebSocket upgrades and preserve Origin. Browser socket clients use WebSocket transport. Handshakes require an exact configured Origin; foreign, `null`, and missing Origins are rejected. Non-browser clients must explicitly send the configured Origin and authenticate normally.
- `src/index.js` creates the TTL index on `auth_rate_limits.expiresAt`. Counters work before cleanup; delayed TTL removal never extends a limit because each time window has its own key.
- No bulk account migration is run by these fixes. Previously misclassified roles and identities created before signup was closed should be reviewed against the authoritative import source separately. Existing old-format sessions and old unbound magic links require a new sign-in/link.

## Stored security metadata

- `auth.sessionVersion`: integer revocation counter, added when an account's sessions are revoked.
- `auth.disabledAt`: date, present only on disabled identity tombstones.
- `auth.resetOTPAttempts`: integer challenge counter, reset on resend and removed after successful exchange/deletion.
- Recovery token hash/expiry: temporary fields removed on use or subsequent credential changes. Expired unused credentials are rejected even if their fields remain stored.
- `auth_rate_limits`: hashed `_id`, integer `count`, date `expiresAt`.

## Verification

Run `npm run test:auth-security`, `node scripts/security-review-check.mjs` and `node scripts/security-followup-review.mjs` from `Server`. They use isolated fixtures and mocked mail/storage providers. The two scripts check actual Express and Socket.IO endpoints against in-memory database fixtures; neither connects to the configured database. The follow-up script asserts safe outcomes for all five additional findings, including a controlled overlapping setup write and a failed logout followed by successful retry.

Member directory/profile responses use the allowlist in `../users/profile-visibility.js`. Login email, imported student/contact data, asset IDs, and internal metadata are restricted to the owner/administrator. Explicit public contact email and portfolio content remain available on detailed profiles. Connect/Message actions use account IDs rather than requiring directory login emails.

Global presence updates are sent only to the authenticated administrator room for the admin directory. Online payload entries contain only account IDs; login emails are neither stored in presence state nor sent in snapshots. Student/alumni sockets receive no global presence list.

`PUT /api/users/me` rejects raw MongoDB operators and dotted top-level paths. Standard contact/profile fields still pass their validators, including safe URLs and the 20-link limit. Append education with `addEducation: { school, degree, year, location }`; add/remove a skill with `addSkill: string` / `removeSkill: string`. Only the server translates these actions to database operators. The shared profile client uses these actions, and concurrent skill additions still enforce the ten-skill limit atomically. Other external clients using the former raw-operator payloads must migrate to these explicit actions.
