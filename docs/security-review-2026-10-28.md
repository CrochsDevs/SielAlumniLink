# AlumniLink security review — 28 October 2026

The original review identified an unauthenticated account takeover path affecting password-enabled accounts, including administrators. The original ten findings and the five additional follow-up findings now have targeted fixes and isolated regression coverage. This is not a guarantee that the application has no other vulnerabilities. Production infrastructure was not assessed. Dependency audits alone do not detect application logic flaws.

## Current follow-up: S11-S15 addressed

Implemented the five requested fixes on 28 October 2026 in the current working tree:

| ID | Fix | Regression evidence |
| --- | --- | --- |
| S11 | Setup/password changes condition the write on the request's session version and original password/setup state. Setup signs only the resulting version, without adopting a later account re-read. | Controlled overlapping setup returns 409 for the stale request, preserves the winner's password, issues no stale cookie, and rejects the old session. Unit checks cover later revocation and conflicting password changes. |
| S12 | Presence is broadcast only to the authenticated administrator room. Presence state/snapshots contain no login email. | Administrator still receives account-ID status; unrelated student receives no global presence event. |
| S13 | General profile updates reject raw operators and dotted paths. Explicit, validated `addEducation`, `addSkill`, `removeSkill` actions replace the client's operator payloads. | Unsafe/direct links and excess links are rejected; 20 valid links succeed. Skill/education edits work, including concurrent skill-limit enforcement and mobile/desktop profile controls. |
| S14 | Unknown, disabled, passwordless and wrong-password logins receive the same 401/message and perform bcrypt verification. Recovery/send responses are generic even when email delivery fails; failed credentials are still invalidated. | Response equality across account states, unknown/known recovery and failed delivery; existing secret-redaction and failed-challenge cleanup tests remain passing. |
| S15 | Revocation errors return generic 503, preserve the cookie for retry and never report successful logout. Audit logging is separate. The shared client propagates failure and the logout page shows an error. | Simulated revocation/read failure does not clear cookies. Successful retry invalidates the copied session and disconnects sockets. Browser checks verify failed logout remains authenticated and retry succeeds for student, alumni and admin. |

Validation: 50 authentication/profile security tests, 103 selected existing server tests, 13 earlier actual-route checks, and six follow-up actual-route checks all passed. The follow-up browser check passed at 375px and 1440px for all three roles' logout flow and student/alumni education/skill editing. Targeted frontend lint and production build passed; the existing large-bundle warning remains. Tests use isolated fixtures and mocked external services; no real database, account, email or storage-provider operations were performed. No production deployment or bulk migration was performed.

Commands from `Server`: `npm run test:auth-security`, `node scripts/security-review-check.mjs`, `node scripts/security-followup-review.mjs`. From `Client`, with the local dev server on port 5173: `node scripts/security-followup-browser-check.mjs` (uses the existing local Playwright validation installation and headless Edge).

The follow-up script has been converted from reproducing unsafe behavior to asserting the fixed outcomes. External clients that sent raw MongoDB operators must migrate to the explicit profile actions. Send endpoints intentionally do not confirm mail delivery; failures remain observable only on the server and generated credentials are invalidated. Network/provider timing is not guaranteed identical. Earlier infrastructure, multi-instance adapter and historical-account review limitations still apply. The sections below retain the chronological evidence and do not describe the current status where superseded by this section.

## Previous rescan: five additional findings (historical)

Rechecked the working tree on 28 October 2026 after the S05-S10 fixes. All 37 authentication security tests and the 13 earlier actual-route security checks still pass. Fresh Server and Client dependency audits each report zero known vulnerabilities (157 and 426 dependencies respectively). These results do not cover the additional cases below.

| ID | Severity | Confirmed finding | Source |
| --- | --- | --- | --- |
| S11 | High | Overlapping first-password setup can overwrite the password just saved, after the old session has been revoked | `Server/modules/auth/auth.controllers.js:118`, `Server/modules/auth/auth.models.js:133` |
| S12 | Medium | Global presence broadcasts disclose online accounts' registered login emails to unrelated members | `Server/realtime/socket.js:20`, `Server/realtime/presence.store.js:35` |
| S13 | Medium | Raw profile update operators bypass URL validation and the profile-link count limit | `Server/modules/users/users.controllers.js:474`, `Server/modules/users/users.models.js:39` |
| S14 | Medium | Distinct login responses disclose whether an email is registered | `Server/modules/auth/auth.controllers.js:41`, `Server/modules/auth/auth.controllers.js:56` |
| S15 | Medium | Logout reports success when server-side session revocation fails, leaving a copied cookie usable | `Server/modules/auth/auth.controllers.js:372` |

**S11 evidence and conditions.** The attacker must already possess a valid session for an account whose password has not been set. Two setup requests can pass the initial password/session checks. The fixture pauses the older request immediately before its database write; the owner's other request saves a password and increments the session version. Resuming the older request overwrites that password, increments the version again, and receives a fresh session. Login with its chosen password then succeeds. The model's write filter checks only account ID and disabled state, so the earlier authorization is not rechecked atomically. Fix with a conditional first-setup write requiring the expected session version and unset-password state; only the winning write may issue a new session. This is distinct from the already-fixed single-use recovery-token race.

**S12 evidence and conditions.** With no connection records, an ordinary student socket receives a `presence:update` containing an online administrator's registered email. The member directory DTO checks still pass; this is a separate realtime disclosure path. Remove registered emails from presence payloads, and restrict presence/activity to recipients authorized to see it where the product requires that restriction.

**S13 evidence and conditions.** A direct profile update containing a `javascript:` profile-link URL receives HTTP 400. Submitting 21 such entries through `$push.profileLinks.$each` receives HTTP 200 and stores all 21. This confirms validation and array-limit bypass, not JavaScript execution or role escalation. Replace raw MongoDB operators from request bodies with explicitly allowed field operations, validate every addition, and enforce the resulting array limit atomically. The model overwrites supplied `$set` data, so arbitrary `$set` privilege escalation is not claimed.

**S14 evidence and conditions.** An unauthenticated wrong-password login receives different messages for an unknown email and a registered email. Existing throttling reduces query volume but does not remove this disclosure. Use a uniform failure status/message for unknown users, invalid passwords and unavailable local credentials, with consistent timing where feasible. Recovery responses should likewise avoid distinguishing account eligibility.

**S15 evidence and conditions.** The fixture makes the revocation write fail before any update. Logout still returns HTTP 200 because its inner catch suppresses the failure. After storage functionality is restored, replaying the original copied cookie accesses `/api/users/me` successfully. This finding is conditional on revocation/storage failure; ordinary successful logout revocation remains covered by the earlier tests. Separate optional audit logging from mandatory revocation, surface revocation failure truthfully, and provide a retry path without falsely claiming server-side logout completed.

At the time of this rescan, `node scripts/security-followup-review.mjs` deliberately asserted the unsafe outcomes above using actual Express/Socket.IO handlers with in-memory fixtures, simulated revocation failure and stubbed mail. No real database, account, email or storage-provider operations were performed. The subsequent fix described at the top converted that script to assert safe regression outcomes.

Recommended implementation references: [MongoDB conditional single-document writes](https://www.mongodb.com/docs/v8.0/core/write-operations-atomicity/), [OWASP authentication responses](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), and [OWASP allowlisted assignment](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html). Earlier sections retain the historical findings and validation; their completion statements refer to those scoped checks, not these open findings.

## Final follow-up: all six remaining findings addressed

The user's requested fixes for S05-S10 are implemented in shared backend services and the affected clients:

| ID | Fix | Verification |
| --- | --- | --- |
| S05 | Profile-only activation preserves an explicit imported student/alumni role; unknown/admin roles are not guessed | Role-preservation/rejection unit tests and actual-route student activation |
| S06 | Delete disables the linked auth identity first, removes credentials and pending login links, revokes sockets, then removes profiles; later sync skips the disabled tombstone | Deleted login/session rejection, cleanup failure, self-delete protection, and reimport tests |
| S07 | JWT session version is compared to current auth state; recovery/password/logout/role/email changes revoke old sessions; password recovery disconnects a connected socket | Version, HTTP rejection, live fixture Socket.IO disconnect, and all-role client revocation checks |
| S08 | Member directory/profile and mentor matches omit registered login emails, imported private contact/student fields, internal metadata and nested private fields; owner/admin fields are explicitly allowed | DTO/API regressions and mobile/desktop Connect/Message checks using account IDs |
| S09 | MongoDB-backed per-IP/per-email fixed-window limits, shared resend quotas, and a five-attempt OTP challenge budget | Concurrent/shared-store tests, HTTP 429/Retry-After checks, and challenge lockout |
| S10 | Socket.IO handshakes require an exact allowed Origin; missing, null and foreign Origins are rejected even with a valid cookie | Policy tests and actual WebSocket handshake rejection/acceptance checks |

Authentication security tests cover 37 cases; selected existing server tests cover 124 cases; mentor connection-state tests cover four cases. All passed. The actual-route diagnostic checks 13 security behaviors across all ten findings. Frontend production build passed with the existing bundle-size warning. Mobile/desktop browser fixtures verified mentor Connect and profile Message without public login emails, plus revocation returning student/alumni/admin to login. No real account or provider writes were performed by these checks.

The targeted frontend lint subset passed. Four pre-existing lint errors remain in `ChatContext.jsx` and `studentMentorship.jsx`; the same errors were verified against HEAD, and no new lint errors were introduced in those files. No global lint pass is claimed.

See `Server/modules/auth/README.md` for the concrete limits, security-field datatypes, reverse-proxy configuration and WebSocket requirements. Existing sessions without the version claim and older unbound magic links require a new sign-in/link. No bulk account migration, historical-role rewrite, or production deployment was performed. For multiple Socket.IO processes, immediate cross-process disconnects require a shared adapter; database checks on HTTP/incoming packets and a background socket check still enforce revocation. Earlier sections below preserve the original evidence and intermediate rescans.

## Latest rescan after recovery and signup fixes

Rechecked the current working tree on 28 October 2026 after the S03/S04 fixes. All 24 authentication security tests passed again. The isolated actual-route HTTP/Socket.IO diagnostic verified seven safe behaviors covering S01-S04 and reproduced the six remaining findings below. Both fresh dependency audits returned zero known vulnerabilities (Server: 157 dependencies; Client: 426).

| ID | Severity | Current finding | Current source |
| --- | --- | --- | --- |
| S05 | High | First magic-link activation assigns alumni access to an imported student without an auth record | `Server/modules/magic/magic.controllers.js:45` |
| S06 | High | Deleting a profile leaves its linked login account usable | `Server/modules/users/users.controllers.js:309` |
| S07 | High | Sessions issued under the new format remain valid after password recovery | `Server/middlewares/auth.middleware.js:41`, `Server/modules/auth/auth.models.js:108` |
| S08 | High | Member directory returns full other-user profiles apart from a top-level password | `Server/modules/users/users.controllers.js:121` |
| S09 | Medium | Recovery/login lack application-level request limits and OTP attempt lockout | `Server/modules/auth/auth.routes.js:21` |
| S10 | Medium | Authenticated WebSocket handshakes accept a foreign Origin; browser exploitation depends on cookie delivery | `Server/realtime/socket.js:52` |

The earlier session-format change invalidates legacy tokens once, but does not revoke sessions issued afterward when a user recovers their account. S07 therefore remains open. Source inspection also reconfirmed that raw profile-update operators, inconsistent password policies, and exception-message exposure remain hardening items; no additional independently reproduced vulnerability was added to the six findings in this rescan.

A focused recheck found rich opportunity HTML still sanitized and profile-image deletion still enforcing owner folders. The tracked-secret pattern scan found no matches. These checks do not prove all rendering/upload/secret paths safe. This rescan updated only this report: no production fixes, real account/database mutations, emails, or storage-provider operations were performed. Deployed infrastructure was not assessed.

## Latest follow-up: recovery tokens separated and public signup closed

- S03 is fixed. OTP verification atomically consumes the matching unexpired OTP and exchanges it for a random 32-byte recovery token. Only its SHA-256 hash and ten-minute expiry are stored on the auth document. A successful password reset changes the password and removes that recovery credential in the same conditional database write. Parallel requests, replay, and expiry during password hashing cannot produce a second successful reset.
- New OTP requests and normal password changes remove any outstanding recovery-token hash/expiry. Recovery fields are added for a recovery operation and removed after use or a subsequent OTP/password change; an unused expired credential is rejected even if its fields remain stored. There is no new collection or migration.
- Session issuance and verification are shared by password login, first-time password setup, magic-link login, HTTP guards, logout audit lookup, and Socket.IO. Login JWTs require the session purpose, expected issuer/audience, HS256, and an immutable account subject. Recovery tokens and legacy reset JWTs cannot authenticate, and login JWTs cannot satisfy password reset.
- Legacy session JWTs lack these required claims and are intentionally rejected. Users must sign in again once after this change. Existing pending reset JWTs require a fresh recovery request. This is a format migration, not ongoing session revocation: S07 still remains open for sessions issued under the new format.
- S04 is fixed. `POST /api/auth/signup` always rejects with HTTP 403 without database reads/writes or cookies, including requests asking for student/alumni/admin roles. The frontend `/signup` route redirects to login, and the old registration action was removed from the auth context. Registered users continue using the existing email-link activation and first-password setup flow. No existing account records were deleted or changed by a migration.
- Validation: 24 authentication security tests and 114 selected existing tests passed. The actual-route HTTP/Socket.IO diagnostic reported seven verified safe behaviors across the four fixed findings and six remaining unsafe behaviors. Frontend build and targeted ESLint passed; the existing bundle-size warning remains. A browser check verified `/signup` redirects to login with mocked API calls and zero writes.
- Remaining scope: S05 first-activation roles, S06 user deletion/access, S07 session revocation, S08 profile disclosure, S09 throttling, and S10 WebSocket Origin enforcement are not fixed by this follow-up. Earlier sections below retain the historical evidence from the original review and the first rescan.

## Rescan after the OTP fixes

Rechecked the current working tree on 28 October 2026. The 13 authentication security regression tests passed again. The actual-route fixture diagnostic reconfirmed S01 and S02 fixed, and reproduced ten unsafe behaviors grouped into eight remaining findings (S03-S10). Neither those findings nor deployment security should be considered resolved by the OTP fixes.

Current source locations for the remaining findings:

| Finding | Current source | Result |
| --- | --- | --- |
| S03 — Recovery/session token confusion and replay | `Server/modules/auth/auth.controllers.js:384`, `Server/modules/auth/auth.controllers.js:423`, `Server/middlewares/auth.middleware.js:43` | Reset tokens authenticate; login tokens reset passwords; reset tokens remain reusable |
| S04 — Unrestricted signup | `Server/modules/auth/auth.controllers.js:22` | An email absent from both collections obtains an alumni session without email verification |
| S05 — Incorrect first-activation role | `Server/modules/magic/magic.controllers.js:47` | A profile-only student gets an alumni auth record |
| S06 — Deletion leaves access active | `Server/modules/users/users.controllers.js:309` | Removing the profile leaves the linked login usable |
| S07 — Existing sessions survive password recovery | `Server/modules/auth/auth.models.js:75`, `Server/middlewares/auth.middleware.js:43` | A previously issued session still accesses protected APIs after recovery |
| S08 — Excessive profile disclosure | `Server/modules/users/users.controllers.js:121`, `Server/modules/users/users.controllers.js:170` | A student receives another profile's private fixture fields |
| S09 — No application-level throttling | `Server/modules/auth/auth.routes.js:21` | Thirty consecutive wrong OTP submissions receive no throttling or attempt lockout |
| S10 — WebSocket Origin enforcement | `Server/realtime/socket.js:54` | Foreign Origin accepted with an explicitly supplied valid cookie; browser exploitation still depends on cookie delivery |

Both dependency audits again reported zero known vulnerabilities (Server: 157 dependencies; Client: 426). A focused recheck of upload ownership/download restrictions and rich HTML sanitization found no additional confirmed exploit in those inspected paths. The focused tracked-secret pattern scan found no matches. No real database, email, or storage-provider operations were performed by the fixture diagnostic. This rescan changed only the review report; it did not apply further production fixes or retest deployed infrastructure.

## Follow-up: OTP input validation and email disclosure fixed

- S01: recovery controllers reject object/array email values and anything other than an exact six-digit string OTP before querying. The recovery model independently validates inputs. Valid email strings are trimmed without rewriting the stored email's case.
- S02: authentication email failures no longer return `devOTP` or log codes, links, or raw provider errors in any environment. Failed delivery returns HTTP 503 and invalidates that request's OTP. Cleanup matches the failed code to avoid blindly clearing a different concurrent resend.
- Applied the shared email validation and secret-redaction rules to magic-link sends. Failed magic-link delivery deletes only the newly issued token, returns HTTP 503, and does not log the link. Verification errors also redact token-bearing details.
- OTP generation now uses `crypto.randomInt` instead of `Math.random`.
- `npm run test:auth-security`: 13 regression tests passed with mocked database/mail operations. The isolated HTTP diagnostic confirmed two fixes and ten remaining unsafe behaviors across the other eight finding groups.
- This follow-up changes production authentication/email code. It does not fix S03-S10 or migrate any real account records. The sections below preserve the original review evidence and original source line references.

## Original review scope and method

Reviewed the Express route guards, authentication and recovery controllers/models, user profiles and role assignment, messaging and Socket.IO authentication, file upload/download controls, feed visibility, opportunities, surveys, events/meetings, mentorship, development/certificates, frontend HTML rendering, dependency lockfiles, and tracked secret handling.

Confirmed the findings below using source inspection and a local HTTP/Socket.IO diagnostic against the actual application routes with in-memory database fixtures and a mocked mail transport. No real accounts, database records, emails, or Cloudinary assets were changed. Production code was not modified during the original review; the follow-up fixes above do modify authentication/email code.

This is a repository review with focused reproductions, not a complete penetration test. Deployed TLS/proxy headers, database network rules and grants, secret strength/history beyond the named environment paths, infrastructure monitoring, backups, and production traffic were not inspected. Runtime reproduction uses an intentionally small MongoDB fixture supporting the relevant query operators; it does not run against a real MongoDB server.

## Prioritized findings

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| S01 | Critical — fixed in follow-up | MongoDB operator injection bypassed password-reset OTP verification | Original exploit reproduced; rejection now verified |
| S02 | Critical — fixed in follow-up | Failed email delivery returned the reset OTP to the requester in production | Original disclosure reproduced; failure response and cleanup now verified |
| S03 | High — fixed in latest follow-up | Reset and session JWTs were interchangeable; reset tokens could be replayed | Rejection and single-use recovery verified through HTTP/Socket.IO and concurrency tests |
| S04 | High — fixed in latest follow-up | Unrestricted signup bypassed the imported-user eligibility model | API rejection/no writes and frontend redirect verified |
| S05 | High — fixed | First magic-link activation promoted profile-only students to alumni | Correct role verified |
| S06 | High — fixed | Deleting a user left their login account active | Disabled login/session and cleanup-failure tests passed |
| S07 | High — fixed | Password recovery did not invalidate existing sessions | HTTP rejection and socket disconnect verified |
| S08 | High — fixed | Member directory returned complete other-user profiles | Explicit public fields and ID-based actions verified |
| S09 | Medium — fixed | Authentication/recovery lacked attempt limits and throttling | Shared counters, HTTP limits, resend cooldown and OTP lockout verified |
| S10 | Medium — fixed | WebSocket connections did not enforce the Origin allowlist | Foreign/null/missing Origin rejection verified |

### S01 — OTP query operator injection

Locations: `Server/modules/auth/auth.controllers.js:355`, `Server/modules/auth/auth.models.js:53`.

`verifyOTP` only checks that `email` and `otp` are truthy. `findByOTP` embeds both directly into a MongoDB filter. An object in the OTP field is interpreted as a query operator instead of an exact six-digit value.

The isolated test submitted a non-null comparison object for an administrator with a pending unexpired OTP. The application issued that administrator's reset token without receiving the real OTP. An attacker can initiate password recovery to create the pending OTP; knowing the target email and receiving a valid pending OTP are different requirements.

Impact: reset a password-enabled victim's password without mailbox access. In combination with S03, the returned token also directly authenticates to protected APIs with the victim's current database role. Accounts still requiring first-time password setup are rejected by this recovery branch; that does not protect existing administrators or members with passwords.

Fix: require a normalized, bounded email string and an exact six-digit OTP string before querying; reject objects/arrays. Construct filters only from validated scalar values. Atomically consume a hashed OTP with an expiry and attempt budget. Apply equivalent scalar validation to every auth and magic-link input. Do not rely on blocking a few operator names.

### S02 — Production OTP disclosure on SMTP failure

Location: `Server/modules/auth/auth.controllers.js:338`.

When `sendOTPEmail` fails, `forgotPassword` responds with success and `devOTP: otp`, and writes the OTP to the application log. This branch has no development-environment guard. The diagnostic set `NODE_ENV=production`, simulated a mail failure, and received the actual reset OTP in the response.

Impact: any requester can recover an existing password-enabled account when its email delivery fails, independently of S01. Mail failure may result from configuration, provider availability, or delivery rejection; no claim is made that an attacker can always cause it.

Fix: never return or log authentication secrets, including in a browser-visible development fallback. Fail closed when delivery fails and invalidate the undelivered challenge. Return a generic response that does not disclose account existence or provider details. Apply the same no-secret-logging rule to the magic-link fallback at `Server/modules/magic/magic.controllers.js:67`.

### S03 — Interchangeable and reusable JWTs

Locations: `Server/modules/auth/auth.controllers.js:381`, `Server/modules/auth/auth.controllers.js:420`, `Server/middlewares/auth.middleware.js:43`, `Server/realtime/socket.js:39`.

OTP verification signs a JWT containing an email with the same secret used for session tokens. Authentication middleware verifies the signature and looks up that email without checking token purpose, subject/ID binding, issuer, or audience. The reset endpoint likewise accepts any JWT signed by that key. Reset tokens have no stored single-use identifier and are not consumed after use.

Confirmed behaviors: a reset JWT in the session cookie authenticated as an administrator; a normal login JWT reset the password without an OTP/current password; the same reset JWT reset the password twice after the underlying OTP was cleared.

Fix: prefer opaque, random, hashed, expiring reset tokens stored server-side and consumed atomically. If JWTs remain, strictly separate purposes and validation rules, bind `sub` to an immutable auth ID, validate issuer/audience/algorithm, and maintain server-side single-use reset state. Recovery tokens must never satisfy session authentication. Refreshing the signing key alone does not repair this logic.

### S04 — Signup bypasses imported identity and email ownership

Locations: `Server/modules/auth/auth.routes.js:24`, `Server/modules/auth/auth.controllers.js:20`, `Server/modules/auth/auth.models.js:26`.

Public signup accepts an arbitrary name/email/password and a caller-selected student/alumni role, immediately marks the auth record verified, creates a profile, and issues a session. It does not require an existing eligible university profile or proof of mailbox ownership. The diagnostic registered an email absent from both collections and received an alumni session.

Impact: outsiders obtain member access and alumni-only capabilities. Source inspection also shows an account pre-hijacking risk: later sync finds accounts by email and intentionally preserves their password (`Server/modules/users/users.controllers.js:87`), potentially attaching official profile data to an account registered earlier by somebody else. That later-sync scenario was identified from source, rather than executed against real imported data.

Fix: disable public account creation for this imported-user system. Resolve a pre-existing approved profile by normalized email, verify possession using a single-use link, and derive roles from the authoritative university record. Protect onboarding with unique normalized identity indexes after resolving legacy duplicates.

### S05 — Imported student becomes alumni during first activation

Location: `Server/modules/magic/magic.controllers.js:39`.

When an email exists in `users` but not `auth`, `sendMagicLink` always calls `createSyncedUser` with `Roles.ALUMNI`. It ignores the existing profile's student role. The diagnostic inserted a profile-only student, requested a magic link, and found a newly created alumni auth record.

Impact: the person who completes activation receives alumni capabilities despite a student profile. This affects the profile-only import path; accounts already correctly synced into `auth` do not enter this branch.

Fix: validate and preserve the authoritative profile role, permit only explicit eligible roles, and handle missing/ambiguous roles without guessing. Create/link the auth identity idempotently using unique indexes and concurrency-safe onboarding.

### S06 — User deletion does not remove access

Locations: `Server/modules/users/users.controllers.js:309`, `Server/modules/users/users.models.js:75`.

The admin delete endpoint removes only the `users` document. Its linked `auth` record remains, and authentication checks that record. The diagnostic deleted a student profile with an admin session and then successfully logged in again with the student's original password.

Impact: a supposedly removed member continues accessing protected APIs. Existing data and sockets are not revoked by deleting only the directory profile.

Fix: define account deletion/disable semantics explicitly. Atomically disable the auth identity, revoke sessions and reset/magic challenges, disconnect sockets, and remove or retain profile/content records according to the selected retention rules. Do not treat profile deletion as access revocation.

### S07 — Password changes do not revoke sessions

Locations: `Server/modules/auth/auth.models.js:61`, `Server/modules/auth/auth.models.js:76`, `Server/middlewares/auth.middleware.js:43`, `Server/realtime/socket.js:46`.

Sessions last up to seven days and are validated by signature/expiry and email lookup. Password updates do not increment a session version or invalidate prior JWTs. The diagnostic reused a previously issued session successfully after password recovery. Logout clears the browser cookie but does not revoke a copied token server-side. Sockets retain the user/role loaded at connection time.

Impact: somebody holding a stolen session can retain access after the owner recovers the account. Source inspection indicates long-lived socket permissions can also lag an administrative role change; that role-change scenario was not separately reproduced.

Fix: maintain revocable server-side sessions or a per-account token version checked against an immutable auth ID. Rotate/revoke after recovery, sensitive account changes, disablement, and explicit session logout. Disconnect or reauthenticate active sockets as part of those actions. Decide whether ordinary password changes keep only the current session or revoke all sessions.

### S08 — Excessive profile data returned to members

Locations: `Server/modules/users/users.routes.js:25`, `Server/modules/users/users.controllers.js:121`, `Server/modules/users/users.controllers.js:170`, `Server/modules/users/users.models.js:34`.

Every authenticated role can enumerate the entire users collection. The directory and individual profile handlers remove only a top-level password and return all remaining fields. This includes registered login emails, stored contact/student information, internal search metadata, and any future fields added to the profile. The diagnostic confirmed that a student received another profile's explicitly private fixture field.

Impact: broad scraping and exposure of fields that have no explicit public visibility decision. S04 permits an outsider to acquire the member access needed to invoke this API. Whether specific contact fields are intentionally public must be decided, but returning every database field by default remains unsafe.

Fix: create explicit public/member/admin/self response schemas and MongoDB projections. Keep login identity separate from user-selected public contact details. Add bounded pagination and enforce visibility in the API. UI hiding does not limit the JSON response.

### S09 — Recovery and login abuse controls

Locations: `Server/modules/auth/auth.routes.js:21`, `Server/modules/auth/auth.controllers.js:16`, `Server/modules/auth/auth.models.js:40`, `Server/modules/magic/magic.controllers.js:55`.

No application-level login/recovery throttling, OTP attempt counter, or challenge lockout is configured. Thirty consecutive wrong OTP submissions all received the ordinary validation response. OTPs use `Math.random` and are stored in plaintext. Different responses reveal whether an account exists or has a password; magic-link sends also delete previous links without a resend limit. Password setup/change/reset allow six-character passwords; signup lacks an equivalent length check.

Impact: guessing, account enumeration, mail flooding, repeated invalidation of legitimate login links, and avoidable resource usage. An unseen reverse proxy could mitigate some request volume, but no such control was verified here. Thirty requests confirm behavior at that volume, not an exhaustive load test.

Fix: layered per-account and per-IP limits with a shared store, bounded failed attempts and resend cooldowns, `crypto.randomInt`, hashed short-lived challenges, generic responses, and one shared server-side password policy. Configure trusted proxy handling to match the real deployment before depending on IP-based controls.

### S10 — WebSocket Origin allowlist is not enforced

Location: `Server/realtime/socket.js:54`.

Socket.IO has a CORS allowlist, but no handshake `allowRequest`/Origin rejection. The diagnostic connected using the WebSocket transport, a foreign Origin header, and an explicitly supplied valid fixture cookie.

Impact: the configured allowlist does not actually restrict WebSocket handshakes. Browser exploitability depends on whether cookies are sent: SameSite strict/lax cookies reduce ordinary cross-site exposure, while same-site untrusted origins or future cookie changes may create exposure. The test does not demonstrate automatic cookie theft or an arbitrary cross-site browser attack. Socket.IO documents that WebSocket connections are not governed by CORS.

Fix: reject unexpected handshake Origins explicitly, use a narrow documented policy for missing Origin/non-browser clients, and retain cookie/session protections. Combine this with session revocation and ongoing authorization for socket actions.

## Additional hardening and unresolved checks

- Profile mutation accepts raw `$push`, `$addToSet`, `$pull`, and `$set` objects (`Server/modules/users/users.controllers.js:465`). Identity/employment restrictions exist, and the current model overwrites the supplied `$set`; this review did not demonstrate an admin-role escalation through that path. Replace the exposed MongoDB operator interface with field-specific validated actions so links, education, image fields, and future protected fields cannot bypass their intended validation.
- Chat attachments accept arbitrary URL strings (`Server/modules/messages/messages.models.js:111`). Validate supported URL schemes, approved storage origins, data-URL MIME types, and sizes server-side. React's rendering protections mean this is not being reported as a confirmed JavaScript XSS exploit.
- Profile/cover uploads check extension/size and rely on Cloudinary's image decoder. Feed images additionally check file signatures. Add consistent content checks, multipart part/field limits, upload quotas, and orphan cleanup. No arbitrary-file execution was established.
- API controllers often return raw exception messages; the app has no central production error handler or comprehensive security-header middleware. Verify production error redaction, auth-response `Cache-Control: no-store`, frontend CSP/frame protections, HSTS at the TLS terminator, and an explicit CSRF strategy alongside SameSite cookies. No deployed-header or CSRF exploit claim is made.
- Magic tokens are random 32-byte values and are atomically claimed once, but stored unhashed; expired records have no visible TTL setup. Store token hashes and configure expiry cleanup. First-time password setup is enforced in the client flow, not as a restricted server session; decide whether pre-setup sessions should reach ordinary APIs.
- No tracked credential/private-key matches were found by the focused pattern scan. Environment files are ignored, and the named `.env` paths had no commits in the checked local Git history. This is not a full historical secret scan and does not verify credential rotation, production secret strength, or provider permissions. No secret values were printed.

## Original review validation results

- `cd Server; node scripts/security-review-check.mjs`: completed 12 isolated evidence checks covering the ten grouped findings above. The script is a diagnostic of current vulnerable behavior, not a passing security regression suite. After fixes, convert the checks to assert rejection/safe behavior.
- Server `npm audit --json --ignore-scripts`: zero reported vulnerabilities (157 dependencies in audit metadata).
- Client `npm audit --json --ignore-scripts`: zero reported vulnerabilities (426 dependencies in audit metadata).
- Selected existing fixture-based tests: 114 passed, zero failed. Coverage included publisher roles/ownership, job audiences and private application downloads, multipart attachment validation, feed privacy/moderation/image ownership, group membership/admin permissions, event/meeting access, mentorship ownership, and certificate ownership/markup escaping.
- A focused frontend review found rich opportunity HTML sanitized by DOMPurify and ordinary content rendered through React. No confirmed stored HTML-script execution was found in the inspected paths.
- `git diff --check` passed. No production runtime files were edited. No build was needed for a documentation/diagnostic-only change.

## Original remediation order (S01-S02 now fixed)

1. Repair S01–S03 together: validate recovery inputs, remove secret fallbacks, separate token purposes, and make challenges single-use. Revoke existing sessions/recovery tokens if an exposed deployment may have been affected.
2. Close signup eligibility and student role assignment (S04–S05); inspect existing role/account mappings and duplicates before migrating identities.
3. Implement account disablement/session revocation (S06–S07), including sockets, and restrict directory responses (S08).
4. Add shared authentication abuse controls and WebSocket Origin enforcement (S09–S10), then address the hardening items and validate the actual deployment.

## Primary references

- [OWASP NoSQL Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/NoSQL_Security_Cheat_Sheet.html): validate scalar inputs and avoid untrusted query operators.
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html): single-use recovery challenges, expiration, rate limits, generic responses, and session handling.
- [Socket.IO handling CORS](https://socket.io/docs/v4/handling-cors/): CORS applies to HTTP polling; WebSocket restrictions require separate handshake controls.
- [MongoDB atomicity and transactions](https://www.mongodb.com/docs/v8.0/core/write-operations-atomicity/): single-document conditional updates make password change and token consumption atomic.
- [jsonwebtoken documentation](https://github.com/auth0/node-jsonwebtoken/blob/master/README.md): session verification can explicitly constrain the signing algorithm, issuer, audience, and subject.
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): session invalidation must be enforced server-side.
