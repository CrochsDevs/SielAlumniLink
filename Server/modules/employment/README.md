# Alumni employment tracking

Alumni manage their own current employment at `/alumni/employment`. Administrators view reports under the Employment Reports tab at `/admin/tracer`. The former `/admin/employment` URL redirects to that tab.

All API routes require a session. Alumni and administrators can read or update their own record with `GET /api/employment/me` and `PUT /api/employment/me`. The update accepts `employmentStatus`, `currentCompany`, `position`, `industry`, `location`, and `startDate` (`YYYY-MM`). Working statuses require company, position, industry, and start month. Available statuses: Employed, Self-employed, Unemployed, Studying.

Employment lives on the existing directory profile. A company or position change ends the previous current role and adds a new history entry. Industry, location, and start-month corrections update the same current role. Saving a non-working status ends current roles using the update month. Prior history remains available; concurrent profile writes return 409 instead of overwriting newer history.

`POST /api/employment/history` adds a past role with company, position, startDate, endDate, optional industry and location. `DELETE /api/employment/history/:index` removes a past entry and requires its fetched `historyRevision` as `revision` in the body. Current roles cannot be deleted directly.

`GET /api/employment/reports` is administrator-only, with optional exact `batch` and `program` filters. Reports use the login account's alumni role and include alumni without a directory profile as not reported. Employment rate is employed plus self-employed divided by all alumni with a reported status. Reporting coverage is reported divided by total alumni. Industry distribution includes working alumni only; missing industry is grouped as Not specified. Career progression shows recorded roles in chronological order and company/position changes without inferring promotions. Legacy current roles imply Employed when no valid status exists. Tracer-study responses remain a separate survey dataset.

Run checks without a database: `node --test --test-isolation=none modules/employment/employment.test.js` from Server. Model writes and account lookups require the configured MongoDB database at runtime.
