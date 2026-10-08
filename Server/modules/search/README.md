# Global search

Restart the server after pulling these changes. Startup backfills `users.searchNameGrams` in batches of 500 and creates non-unique indexes for name fragments, profile/account joins, active career posts, connections, and login activity. Existing profile records remain intact. Profile creation, sync, and name edits through `UserModel` maintain the name index. Direct database name edits must also refresh `searchNameGrams` (or unset that field and restart to backfill it).

## API

Both endpoints require the existing authentication cookie and a student, alumni, or admin role:

- `GET /api/search/suggestions?q=Lester`: up to six matching people.
- `GET /api/search/all?q=Lester&category=all&sort=relevant&page=1`: ten people and/or ten career posts per page, with independent totals and page counts. In All, a page advances both sections; exhausted sections disappear.

Categories: `all`, `people`, `students`, `alumni`, `posts`. Sorts: `relevant`, `active`, `newest`. The active sort orders people by their most recent recorded login, falling back to profile update time. Login timestamps and audit records are not included in responses. Newest sorts posts by publication date.

Search text is normalized, limited to 120 characters, and treated as literal text, including regex punctuation. Names must contain all query words; exact names rank first. Career posts match any word in the current author's name, title, body, or tags. Exact author names outrank full content phrases, followed by keyword matches and publication date. Account IDs deduplicate people; post IDs identify distinct posts. Page numbers are integers from 1 to 1000. Aggregations have a five-second deadline and return a generic retryable error on failure.

Name substring queries use an indexed n-gram prefilter and escaped regex verification. Career-post relevance currently scans active posts and joins current authors, bounded by the query deadline. For very large post collections, measure this query and introduce a dedicated search index before increasing the deadline or page cap.

## Visibility and supported records

Search returns an explicit field allowlist, never auth credentials, reset codes, email addresses, audit details, or save-member lists. Existing career-post visibility is `isActive: true` for authenticated members; there are no per-post audience settings in this repository. Profile roles come from auth records. Deleted accounts are excluded from people discovery.

The actual post collection is `career_posts`. It supports title, body, tags, authors, dates, and saves. It does not currently store social-feed images, likes, or comments; search shows real save counts and full expandable post bodies rather than inventing engagement. The dashboard's sample posts are not indexed. Profile pictures and current employment appear when those fields exist on the profile.

Connections reuse `POST /api/connections`, which now also accepts `recipientAuthId` so search need not expose email addresses. It enforces the student-to-student restriction on the server. Self/duplicate checks remain in the existing model. Existing accepted, pending, and declined relationships are displayed without offering duplicate requests. Results refresh after a connection action, on window focus, and every 30 seconds.

## Checks

From `Server`, run `npm run test:search`. Tests use `TEST_MONGO_URI`, falling back to the existing `MONGO_URI`; the account must be able to create a temporary database. They write only to a unique `alumnilink_search_test_*` database and remove it afterward. No application records are changed.

For browser checks, start the client on port 5173. From `Client`:

```powershell
npm install --prefix node_modules/.search-validation --no-save --package-lock=false playwright
node scripts/search.smoke.mjs
```

These optional checks use installed Microsoft Edge, intercept API calls with isolated fixtures, and verify the student, alumni, and admin interfaces at 320, 375, 768, and 1280 pixels. They cover suggestions, Escape/Enter/Arrow Down, outside clicks, filtering, connection state, full-post expansion, and profile navigation. MongoDB/API tests separately verify actual aggregation behavior, field filtering, authorization, relevance, duplicate suppression, and pagination.
