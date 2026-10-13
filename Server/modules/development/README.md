# Student development modules

All routes use the authenticated account ID. Request bodies cannot select another
student. Student, alumni, and admin accounts manage their own records; account
conversion to alumni preserves records under the same account ID.

| Method | `/api/development` path | Purpose |
| --- | --- | --- |
| GET | `/me` | Journey, internship records, portfolio, attendance, and readiness |
| PUT | `/academic` | Record `{key: 'enrolled'|'semester', date: 'YYYY-MM-DD'}` |
| POST / DELETE | `/events` / `/events/:id` | Record/remove self-reported attendance |
| POST / PUT / DELETE | `/internships` / `/internships/:id` | Internship company, supervisor, hours, dates, location, evaluation |
| PUT | `/portfolio/:section` | Save `{entries}` for one portfolio section |

Enrollment, semester dates, attendance, portfolio entries, internship hours, and
evaluations are self-reported. The interface states this explicitly. There is
no invented enrollment date and no sample student progress. Mentorship uses an
accepted connection with an alumni account; graduation uses the university's
graduation record. Employment uses a saved tracer response or dated profile
employment record. Completed milestones retain their first recorded dates as
historical entries; readiness uses current saved attendance, portfolio, and
internship records. A historical mentorship milestone continues to count even
after the connection ends.

Internship completion requires completed hours to reach required hours. Negative,
non-finite, excessive hours and future/invalid dates are rejected. Students can
edit and delete their own records. Evaluations are student-entered, not verified
supervisor assessments. Enrollment must not be after first semester completion.
Attendance deduplicates account + normalized title + date with a deterministic
unique ID, including simultaneous submissions.

Readiness formula version 1 uses five factors, each worth 20 points:

- Mentorship: one accepted alumni connection (or a saved historic milestone).
- Events: three self-reported attended events.
- Certifications: three portfolio certifications.
- Portfolio: content in six sections (skills, certifications, seminars, projects,
  research, awards).
- Internship: the highest fraction of completed/required hours in a saved record.

Partial progress earns proportional points, rounded per factor, capped at 100.
80–100 is Highly Prepared, 60–79 Prepared, 40–59 Developing, 0–39 Getting Started.
This is an explainable progress heuristic, not an employment prediction or an
institutionally validated assessment. The page displays the formula and targets.

Referral jobs, internships, and scholarships use the existing referral APIs.
New applications use a deterministic unique ID per account + referral, protecting
against double submissions and concurrent tabs. Legacy applications are checked
before insertion. Referrers/admins review applicants and update statuses; own
applications include opportunity titles and organizations.

Frontend pages: `/student/journey`, `/student/internship`, `/student/portfolio`,
`/student/referrals`, `/student/readiness`, and `/alumni/referral`. Alumni can also
access `/alumni/journey` and `/alumni/readiness` after graduation.

Validation:

```sh
node --test --test-isolation=none modules/development/development.test.js
node --test --test-isolation=none modules/development/development.integration.test.js
```

The integration test creates and removes only a randomly named
`SielAlumni_development_test_*` database. It covers saved history, account ownership,
reload through a fresh service, scoring, validation, and concurrent applications
for all three referral types. It does not alter application accounts or records.
