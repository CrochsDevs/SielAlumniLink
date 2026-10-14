# Tracer Study: program–job alignment

The default admin view at `/admin/tracer` measures whether graduates' reported work relates to their graduation program. The existing response table and employment reports remain tabs on the same page.

Employed and self-employed respondents provide employer/business, position/line of work, `jobAlignment` (`directly_related`, `partly_related`, `unrelated`, `unsure`), and `alignmentExplanation` (main duties and relationship to their program, max 1000 characters). These questions apply to every graduation program. Classification is self-reported; titles and courses are never automatically matched. Non-working statuses clear alignment fields; old responses have Not reported alignment.

Every successful submission atomically appends a server-dated snapshot to `tracer_responses.responseHistory` and updates the latest fields used by the alumni form. The first update to a legacy response also preserves its old observation. No historical work is fabricated from current employment. Reading ordinary responses excludes the history array.

`GET /api/tracer/alignment` requires an admin session and considers accounts whose current authoritative role is alumni. It supports `followUp` (default `3-5`, also `0-2`, `6+`, `all`), exact `program` and `batch`, `alignment`, and text `query`. All filters apply to summaries and exported rows. Programs and batches are discovered from the recorded data.

Follow-up years are the Manila calendar year of submission minus graduation year. This is an estimate from the graduation year, not exact graduation anniversaries. The report selects the latest observation within the selected window per alumnus/program/batch. A response from year one does not become year-four evidence as time passes. All periods selects the latest observation. Missing or invalid dates cannot enter a specific follow-up window.

Direct alignment rate = directly related / (directly related + partly related + unrelated). Related-work rate includes directly and partly related in the numerator. Not sure, Not reported, and non-working answers are shown separately and excluded from the denominator. No assessed answers displays N/A instead of a misleading 0%.

Run `node --test --test-isolation=none modules/tracer/tracer.alignment.test.js` from Server. Browser fixtures are in `Client/scripts/tracer-browser-check.mjs` and `Client/scripts/tracer-alignment-browser-check.mjs`.
