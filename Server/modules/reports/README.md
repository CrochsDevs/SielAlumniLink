# Admin dashboard reports

GET /api/reports/dashboard?date=YYYY-MM-DD requires an authenticated admin.
The date defaults to today in Asia/Manila; valid dates are 2000-01-01 through
today. All daily, calendar-month, and calendar-year buckets use Philippine time.
Current periods stop at the report generation time.

Engagement counts retained logins, undeleted/unblocked posts, undeleted comments,
job applications, referral applications, event registrations, and initial survey
submissions from current student/alumni accounts. Active members are distinct
across the entire selected period, not the sum of bucket counts. Comments are
counted independently of parent-post visibility. No personal data leaves this
endpoint. Likes, messages, page views, and survey edits are not counted.

Mentorship is the current snapshot of student–alumni connection requests in
either direction: accepted, pending, and declined (displayed as Rejected).
Alumni–alumni connections, deleted requests, and unsent recommendations are
excluded. This snapshot is independent of the engagement date. Current account
roles and retained records are used; this is not a permanent historical audit.

The client supports date selection, daily/monthly/yearly chart selection, bar
details, accessible data tables, refresh/retry, empty states, and aggregate CSV
downloads. Database errors return an error rather than fabricated zero counts.

Validation:

- From Server: node --test --test-isolation=none modules/reports/reports.test.js
  (requires MONGO_URI; creates and drops only a randomly named reports test DB).
- From Client: npm run build.
- With Vite at localhost:5173 and an isolated headless Edge instance listening
  on debugging port 9235: node Client/scripts/admin-dashboard-browser-check.mjs
  from the repository root. Uses API fixtures and closes that browser afterward.
