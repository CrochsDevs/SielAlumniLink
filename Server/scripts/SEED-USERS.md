Run from `Server`:

```sh
npm run seed:users
```

This adds 20 alumni and 20 students to the `SielAlumni` database configured by
`MONGO_URI` in `Server/.env`. Names, businesses, and `.test` email addresses are
fictional demo data. Existing real users are preserved.

| Role | Login email range | Default password |
| --- | --- | --- |
| Alumni | `alumni01@demo.siel.test` through `alumni20@demo.siel.test` | `Demo@12345` |
| Student | `student01@demo.siel.test` through `student20@demo.siel.test` | `Demo@12345` |

Profiles include programs, skills, locations, and bios. Students also have year
levels and sections. Alumni have graduation batches, varied employment statuses,
and sample Tracer Study responses. Alumni 01–18 initially have current-quarter
responses; alumni 19–20 initially have previous-quarter responses to demonstrate
the mandatory quarterly update. No emails are sent.

Use alumni 01 to explore the dashboard immediately, alumni 19 to try the required
Tracer Study form, and student 01 to explore the student experience.

Rerunning the command skips existing seed records and preserves passwords,
profile edits, and submitted tracer updates. Set `SEED_PASSWORD` before the first
run to choose a different password for newly created accounts. Demo records are
identified by `seedGroup: "demo-users-v1"` in `auth`, `users`, and `tracer_responses`.
