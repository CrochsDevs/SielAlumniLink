# Alumni feed

`/api/feed` uses the existing HTTP-only authentication cookie. Public posts are
visible to every signed-in portal user; connections-only posts are visible to
their author and currently accepted connections. Students can read, like,
comment, RSVP, and send; alumni and admins can publish and repost.

Administrators can review public and connections-only posts through the shared
feed. They can block/restore posts, turn comments off/on, delete any post or
comment, and restrict/restore a member's feed participation. Blocked posts,
their photos, and dependent reposts are unavailable to ordinary members through
every feed endpoint. Restoring preserves the original audience. Admin listing
accepts `moderation=published|blocked|all`; ordinary users cannot use this filter.
Blocking and comment settings retain an atomic moderation history with actor,
reason, and timestamp. Deletions record the administrator's ID.

Restrictions prevent publishing, reposting, commenting, likes, RSVP, and photo
uploads. Members can still read available posts and use other portal features.
Administrators cannot restrict another administrator. Existing posts are not
removed automatically; content blocking is a separate moderation action.

Post types are `update`, `referral`, `hiring`, `event`, and `story`. Referral and
hiring posts contain an organization, optional location and application link.
Events contain a location, start time, optional end time and registration link,
and an idempotent RSVP. These feed opportunities are separate from the existing
admin-managed jobs/calendar and the referral application's listings.

Posts also accept up to nine uploaded images, each up to 10 MB (JPG, PNG, GIF,
WebP). `POST /api/upload/feed-image` accepts multipart `image` and returns an
attachment ID. Publish with `images: [{id, alt}]`; only your own uploads can be
attached. Updates may contain images without text. Images persist with the post
and render in reposts, a responsive collage, and a viewer with keyboard/touch
navigation. Requests to `/api/feed/:id/images/:imageId` check current post access
and disable shared caching. Raw image-provider URLs are never sent to clients.
The composer uploads each photo to Cloudinary as soon as it is selected, shows
progress and retry controls, and enables publishing after all uploads complete.
Publishing reuses attachment IDs. Removing a completed draft photo deletes its
unused Cloudinary asset through `DELETE /api/upload/feed-image/:id`; ownership
is required, and published assets cannot be removed through this draft endpoint.

Routes:

| Method | Path | Action |
| --- | --- | --- |
| GET | `/` | Visible posts, optional `type`, `before`, `limit` |
| POST | `/` | Publish `{type, title, body, audience, details}` |
| GET | `/status` | Own feed participation status |
| GET | `/restrictions` | Admin: restricted members |
| PUT | `/restrictions/:authId` | Admin: restrict/restore `{enabled, reason}` |
| PUT | `/:id/moderation` | Admin: `{action: 'block'|'comments', enabled, reason}` |
| GET / DELETE | `/:id` | Read / delete a post |
| GET | `/:id/images/:imageId` | Protected photo download |
| PUT | `/:id/like` | Set `{liked: boolean}` |
| PUT | `/:id/rsvp` | Set `{attending: boolean}` |
| GET / POST | `/:id/comments` | Read comments / add `{body}` |
| DELETE | `/:id/comments/:commentId` | Delete your comment; admin can delete any comment |
| POST | `/:id/share` | Repost `{audience, body}` |
| GET | `/:id/recipients` | Connected alumni who can view the post |
| POST | `/:id/send` | Send link to `{recipientAuthId}` and return conversation |

Likes and RSVPs use atomic `$addToSet` / `$pull` operations with the authenticated
account ID. Retrying the same desired state never adds a second like or RSVP.
Reposts retain an original post reference and require access to both posts.
Private originals cannot be reposted publicly. Removing a connection or deleting
an original removes access to dependent reposts. Messages contain a link rather
than a permanent copy of private content; access is checked when opening it.

The existing authenticated Socket.IO connection broadcasts `feed:changed`
without post IDs or content. Clients debounce it and reload through protected
endpoints; reconnects also reload. Likes, comments, RSVPs, reposts, post deletion,
and connection changes trigger this event.
Moderation changes and participation restrictions also trigger this event,
refreshing both member feeds and the admin restricted-members panel.

The UI lives on `/alumni`, `/alumni/success`, `/student`, and the shared `/feed`
page. Shared links use `/feed?post=<id>` and open from message bubbles.
Alumni see their dashboard layout on `/feed`. Administrators see the same post
cards with moderation menus, published/blocked/all filters, and a restricted
members panel. Admins can create all five post types directly from the composer.

Validation:

```sh
npm run test:feed
npm run test:feed:integration
```

The integration test uses `MONGO_URI` from the server environment and creates a
randomly named `SielAlumni_feed_test_*` database, which it removes after testing.
It does not write to the application's database. On sandboxed Windows systems
that prevent the test runner spawning a child process, use
`node --test --test-isolation=none modules/feed/feed.test.js` instead.
When image-provider credentials are configured, the integration test also
uploads a test logo, downloads it through the protected handler, and removes
the test image afterwards.

`Client/scripts/feed-browser-check.mjs` uses a separate headless browser on
port 9228 and browser-only API fixtures to check selecting/removing photos,
image-only publishing, gallery navigation, likes, and layouts at 320, 390, 768,
1024, and 1440 pixels. It never modifies application users or posts.
`Client/scripts/feed-moderation-browser-check.mjs` checks the admin menus,
failure/retry, block/restore, comments off/on, deleting comments, member
restrictions/restoration, the alumni view, socket invalidation, and both themes
at 320–1440 pixels using fixture responses.

## Module 14: success stories

The dedicated story gallery lives at `/alumni/success` and `/student/success`. `/stories?story=<postId>` opens the same reader using the signed-in user's layout. Students can read permitted stories; publishing remains alumni/admin-only. Existing feed restrictions, moderation, image authorization, and public/connections audiences apply.

`GET /api/feed/stories` returns original success stories with the existing cursor pagination and visibility rules. It supports `topic` (`career_journey`, `achievement`, `advice`, or `all`), optional text `q` (max 200 characters), and `mine=true`. Filtering and keyword search run on the server across all stories, including unloaded pages. Older unstructured stories remain readable in All stories without guessing their category.

Alumni publish through the existing `POST /api/feed` with `type: story`, title, audience, and optional `details.story` containing `topic`, `journey`, `achievements`, and `advice`. The sections are optional individually, but at least one must contain text. Each section permits up to 5000 characters; the combined canonical feed body must fit within 10000 characters. This preserves compatibility with the general feed and its moderation tools. The guided form supports one optional cover photo, while the reader supports all existing feed attachments.

`Client/scripts/success-stories-browser-check.mjs` verifies gallery filters and pagination, publishing with a photo, failure/retry, duplicate submission protection, student reading, private-story denial, deep links, author deletion, restrictions, and responsive layouts using browser-only API fixtures.

## Student dashboard

`/student` offers All updates, Hiring, Referrals, Events, and Success stories. Tabs and search are retained in the URL (`tab` and `q`). All updates shows community feed posts only. Active job, referral, and university event listings appear in their respective Hiring, Referrals, and Events tabs alongside the selected community posts. Applications reuse the career and referral dialogs, including PDF resumes, persisted application status, and duplicate submission guards. University event registration uses the existing registration/meeting permissions; community event posts retain their separate RSVP action. Success stories open the shared story reader.

The dashboard loads each listing source and the student's applications independently. A failed source shows its own retry action while other sources remain available; applying is disabled when existing application status cannot be checked. Listing data reloads on focus, manual refresh, and every minute while visible. Community posts also refresh through existing socket invalidations. Old feed requests are discarded when switching filters or accounts.

`GET /api/feed` accepts optional `q` (text up to 200 characters). Search treats regular expression characters literally, filters before cursor pagination, and checks title, body, organization, location, and accessible original posts in reposts. Existing audience and moderation rules remain enforced. Post cards support comments, likes, share-link copying, sending to permitted connections, long-text expansion, and category-specific actions and empty states.

`Client/scripts/student-dashboard-browser-check.mjs` uses API fixtures with local Vite on port 5173 and isolated headless Edge/Chrome on debugging port 9234. It exercises all dashboard tabs, applications, registration, RSVP, search/pagination, failure/retry, comments/likes, sharing/sending, story reading, persisted navigation, unavailable post links, and mobile/desktop layouts. Server tests cover real feed filtering and permissions; the isolated MongoDB integration test also checks search and repost visibility.
