# Alumni feed

`/api/feed` uses the existing HTTP-only authentication cookie. Public posts are
visible to every signed-in portal user; connections-only posts are visible to
their author and currently accepted connections. Students can read, like,
comment, RSVP, and send; alumni and admins can publish and repost.

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
| GET / DELETE | `/:id` | Read / delete a post |
| GET | `/:id/images/:imageId` | Protected photo download |
| PUT | `/:id/like` | Set `{liked: boolean}` |
| PUT | `/:id/rsvp` | Set `{attending: boolean}` |
| GET / POST | `/:id/comments` | Read comments / add `{body}` |
| DELETE | `/:id/comments/:commentId` | Delete your comment |
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

The UI lives on `/alumni`, `/alumni/success`, `/student`, and the shared `/feed`
page. Shared links use `/feed?post=<id>` and open from message bubbles.

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
