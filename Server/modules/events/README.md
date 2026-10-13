# Activity registration and attendance

Published events, training, and seminars all require registration before online
meeting access or on-site registration details. Only the authenticated account
can register itself. Registrations use a deterministic unique ID per activity
and account; duplicate requests return the same registration even after closing.

Admin can configure `registrationLimited: true`, an optional
`registrationOpensAt`, and the required `registrationClosesAt`. Dates are stored
as Mongo dates and sent as UTC instants; the UI converts local date/time inputs
to ISO strings. Opening must precede closing, and closing cannot exceed the
activity's end. With the custom period disabled, registration opens on
publication and closes at `endAt`, or `startAt` for activities without an end.
The cutoff is exclusive: new registrations at the closing instant are rejected.
Already registered participants remain eligible after registration closes.
The **View meeting** link unlocks 15 minutes before the scheduled activity start.
Registered students attempting HTTP meeting details or a socket join before that
instant are rejected. An early admin-hosted session does not bypass the time gate.
Admins can prepare rooms earlier; students see the opening date/time on the card.

| Method | `/api/events` path | Access / purpose |
| --- | --- | --- |
| GET | `/` | Published activities, own registration and window status; venue hidden until registered. Admin `?all=true` includes drafts. |
| GET | `/:id` | Registered participant or admin; activity and venue details. |
| POST | `/:id/register` | Student/alumni; server-controlled time window and account ownership. |
| GET | `/:id/participants` | Admin; registered participant roster. |
| POST | `/:id/participants/:authId/check-in` | Admin; registered on-site participant, after the activity starts. |
| POST | `/:id/participants/:authId/certificate` | Admin; confirms participation from recorded online attendance or on-site check-in after completion. |

The online meeting service and its compatibility registration endpoint use the
same registration policy. Room signaling also verifies registration independently;
knowing a meeting URL does not admit an unregistered account. Custom deadlines
never extend merely because a host started a meeting.

On-site admission uses the admin's roster and check-in. The registration reference
can be shown to the organizer; it is not a security token or proof of attendance.
Check-in does not issue a certificate by itself. Admin confirms completed
participation after the activity ends. Certificates retain the recorded activity
metadata and are automatically exposed in the student's portfolio and resume.

Run `node --test --test-isolation=none modules/events/events.registration.test.js
modules/meetings/meetings.test.js modules/development/certificates.test.js` in Server.
The tests cover registration boundaries, idempotency, account isolation, protected
meeting/venue details, on-site eligibility, and certificate issuance. The shared
meeting browser check also verifies the activity-card flow and on-site check-in.
