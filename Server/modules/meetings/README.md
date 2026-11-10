# SielAlumni Meetings

An in-app WebRTC room for online events, training, and seminars. This initial
implementation allows up to 100 participants, including administrators, using one
peer connection per participant pair. This is an admission limit, not a guarantee
of smooth audio/video at full capacity. Large seminars need an SFU media server
and a different client transport for predictable performance.

See [the 100-participant benchmark report](../../../docs/meeting-capacity-100.md)
for measured signaling/media results and their limitations.

## User flow

1. Admin opens `/admin/events`, creates an activity, chooses its type and **Online**
   participation, enters the organizer and schedule, and publishes it.
2. Student opens `/student/events` and registers from the activity card. The
   **View meeting** link appears only after registration succeeds and the scheduled
   start is within 15 minutes. Before then, the card shows the exact access opening
   time. Direct meeting details and socket join requests enforce the same time
   check, even if a host started the room early. Admins can prepare rooms earlier.
3. Admin opens the calendar entry, selects **Meeting & attendance**, and starts
   the room. Registered students can join after a host is actually connected.
4. Participants control microphone/camera, share a screen, raise a hand, or chat.
   Camera/mic start off. Joining without devices is supported.
5. Leaving, disconnection, host removal, or ending the meeting saves elapsed time
   computed by the server. The last host leaving ends the session for everyone.
6. After the meeting ends, admin reviews the **Attendance** panel and confirms
   participation. Only participants with recorded time can receive a certificate
   through this panel. The existing certificate service stores one immutable
   certificate in the student collection, portfolio, and resume.

Joining proves a connected browser session, not attention or learning. Admin
confirmation is deliberate; joining alone does not award a certificate. Do not
allow students to assert their own duration or certificate eligibility.

Registration settings apply to online and on-site activities. Admin can enable
**Set a registration period**, optionally set an opening time, and set the required
closing time. The server rejects new registrations before opening or at/after the
deadline, including when a meeting is live. Turning off the custom period opens
registration on publication and closes it at the activity's end (or start when
no end is set). Existing registrations remain eligible after the deadline, but
meeting access still opens only 15 minutes before the scheduled activity start.
An active session can continue past its scheduled end until the host ends it.
Ended meetings cannot be reopened by students; admins can still review attendance.

For on-site activities, registered students can open their registration reference
and venue details. Admin opens the calendar entry's **Registration & attendance**
page at `/admin/events/:eventId/attendance`, checks in registered participants,
then confirms completed participation after the activity ends. Check-in and
certificate endpoints reject unregistered participants. On-site attendance is
verified by the admin at the venue; the app does not verify physical presence.

## Deployment

The default configuration targets the existing localhost development app. For
other devices and the internet, serve the frontend and API over HTTPS/WSS, set
`FRONTEND_URL` on the server, and set `VITE_API_URL` and `VITE_SOCKET_URL` before
building the client. Existing cookie authentication must be configured for the
chosen frontend/API domains.

`WEBRTC_ICE_SERVERS` accepts a JSON array of RTCIceServer objects. Development
defaults to a public STUN server. Reliable calls across different networks need
an authenticated TURN relay; deploy your own or supply a provider's credentials.
Example shape (replace the placeholders; do not commit credentials):

```json
[
  { "urls": "stun:your-relay.example:3478" },
  { "urls": "turns:your-relay.example:5349", "username": "TEMPORARY_USERNAME", "credential": "TEMPORARY_PASSWORD" }
]
```

The protected config endpoint sends ICE credentials to meeting participants.
Use expiring TURN credentials for a public deployment. Media is peer-to-peer;
Socket.IO relays only room-scoped signaling and chat. Chat is memory-only, limited
to the last 100 messages, and clears when the room closes. Video recording,
breakout rooms, background effects, and large broadcast rooms are not included.
The live room registry is process-local: run one server instance for this version.
There is no automatic media reconnection; users explicitly rejoin after a network
drop. A server restart loses active room presence and unflushed visit duration.

## Checks

Run `node --test --test-isolation=none modules/meetings/meetings.test.js` in Server.
The tests use in-memory collections and a real isolated Socket.IO server. They
exercise registration ownership, host permissions, room capacity, same-room
signaling, removal, disconnect attendance, and certificate eligibility/retries.

For the browser integration check:

1. Run `node scripts/meetings-preview-server.mjs` in Server. It binds loopback port
   3003 and uses in-memory fixture identities, never the production database.
2. Run Vite on 5174 with `VITE_API_URL=http://localhost:3003/api` and
   `VITE_SOCKET_URL=http://localhost:3003`.
3. Start isolated headless Edge/Chrome on debug port 9236 with synthetic media
   devices, fake media permission, and auto-selection of a display capture source.
4. Run `node scripts/meetings-browser-check.mjs` in Client. This exercises actual
   media negotiation and checks received video frames/audio packets, screen share,
   controls, chat, mobile layout, attendance, and certificate issuance. Screenshots
   are written to the OS temp directory under `SielAlumni-meetings-check`.

References: [WebRTC specification](https://www.w3.org/TR/webrtc/),
[Socket.IO rooms](https://socket.io/docs/v4/rooms/),
[Socket.IO acknowledgements](https://socket.io/docs/v4/emitting-events/).
