# Mentorship

## AI Mentor Matching

Students open **AI Mentor Matching** on the mentorship page. Matching uses portfolio skills (falling back to profile skills), profile program, saved career interests, and career goals. Preferences are saved per authenticated student in `mentor_match_preferences`; profile interests provide the initial defaults. Saving an empty list clears that default for matching without changing the profile.

`GET /api/mentorship/matches` returns preferences, matching inputs, candidate count, and up to 12 ranked alumni. `PUT /api/mentorship/matches/preferences` accepts `{ interests: string[], careerGoals: string }` and returns refreshed matches. Both endpoints require a student session; client-supplied account IDs are ignored. Interests are limited to 20 entries of 80 characters each, and goals to 1,000 characters.

The local content-based recommender uses exact, case-insensitive skill overlap (weight 45), TF-IDF cosine similarity for interests (30) and goals (20), and exact program overlap (5). Weights are normalized over the student's available inputs. Scores are rounded to 0–100, represent similarity rather than confidence or likelihood of success, and can be based on limited profile information. Only positive scores are shown, with factual shared-skill, keyword, and program explanations. Ties use profile IDs for stable ordering. This is a deterministic text recommender, not an LLM or semantic embedding service; it needs no API key, sends no profiles externally, and does not infer synonyms or verify mentor availability.

Candidate roles come from alumni auth accounts, with one profile per account. Responses expose only the mentor identity, public card fields, score, and reasons. Connection requests, incoming requests, accepted connections, messaging, and progress tracking keep using the existing flows.

Validation: `node --test --test-isolation=none modules/mentorship/matching.test.js modules/mentorship/mentorship.test.js`. The browser fixture is `Client/scripts/mentor-matching-browser-check.mjs` (local Vite on port 5173 and isolated Edge/Chrome debugging on port 9233). It checks desktop/mobile layouts, errors/retry, saved preferences, connection states, and empty results without accessing real member data.

## Mentorship progress tracker

Students and alumni open **Progress tracker** on their existing mentorship page. Each accepted student–alumni connection has three fixed goals: Resume Building, Interview Preparation, and Career Planning. Saved activities automatically move goals to In Progress; only the connected mentor confirms Completed or reopens a confirmed goal. Students save activity notes rather than selecting statuses.

Resume Building detects a saved profile summary or portfolio skills/experience. Career Planning detects saved mentor-matching career goals or interests (an explicitly cleared interests list overrides profile interests). Interview Preparation starts when either participant logs practice in that connection's note. Notes also count as activity for the other goals. Each card shows the detected sources; opening a page or sending a chat does not count as activity.

Detection is calculated from current saved records when the tracker is read, without creating goal records. The open tracker refreshes every 30 seconds and on window focus, pausing automatic refresh while notes or reviews are unsaved. General portfolio/career activity applies across the student's accepted mentorships; practice notes and confirmations stay connection-specific. Confirmations survive student follow-up notes and portfolio edits. Historic student-reported completion displays In Progress until confirmed by a mentor.

`GET /api/mentorship/me` lists the signed-in participant's accepted mentorships. `GET /api/mentorship/:connectionId` reads one tracker. `PUT /api/mentorship/:connectionId/goals/:key` updates `status` (`not_started`, `in_progress`, `completed`), optional `note` (max 1000 characters), and the last fetched integer `revision`.

All routes require a student or alumni session. Account roles and accepted connection membership are verified on the server for reads and writes. Body-supplied participant IDs are ignored. Student progress is separate for every mentor connection; ordinary alumni-to-alumni connections are excluded. Declining or removing a connection revokes access without erasing the stored goals.

Goals are stored in `mentorship_goals` with a deterministic ID per connection and goal, atomic revision checks, the editing participant, and start/completion timestamps. Mentor confirmations also record `confirmedByAuthId`. A stale or concurrent edit returns 409 instead of overwriting a partner's update. Reading a new tracker does not create records. Completion percentage is mentor-confirmed goals divided by three; In Progress is counted separately.

Run `node --test --test-isolation=none modules/mentorship/mentorship.test.js` from Server. The tests exercise persistence, participants, isolation, timestamps, validation, revoked access, and simultaneous updates using an in-memory database fixture. Browser fixtures use `Client/scripts/mentorship-progress-browser-check.mjs`.
