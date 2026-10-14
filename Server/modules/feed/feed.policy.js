export const POST_TYPES = ['update', 'referral', 'hiring', 'event', 'story'];
export const AUDIENCES = ['public', 'connections'];
export const STORY_TOPICS = ['career_journey', 'achievement', 'advice'];

export const storyBody = story => [
  ['Career journey', story.journey], ['Professional achievements', story.achievements], ['Advice for students', story.advice],
].filter(([, content]) => content).map(([label, content]) => `${label}\n${content}`).join('\n\n');

export const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};

const text = (value, name, max, required = false) => {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') fail(400, `${name} must be text`);
  const result = value.trim();
  if (required && !result) fail(400, `Please provide ${name.toLowerCase()}`);
  if (result.length > max) fail(400, `${name} must be at most ${max} characters`);
  return result;
};

export const validatePost = (input) => {
  const type = input.type ?? 'update';
  const audience = input.audience ?? 'public';
  if (!POST_TYPES.includes(type)) fail(400, 'Invalid post type');
  if (!AUDIENCES.includes(audience)) fail(400, 'Choose public or connections only');
  const title = text(input.title, 'Title', 200, type !== 'update');
  const suppliedImages = input.images ?? [];
  if (!Array.isArray(suppliedImages) || suppliedImages.length > 9) fail(400, 'Attach up to 9 photos per post');
  const images = suppliedImages.map(image => {
    if (!image || typeof image.id !== 'string' || !/^[a-f\d]{24}$/i.test(image.id)) fail(400, 'Invalid post image');
    return { id: image.id.toLowerCase(), alt: text(image.alt, 'Image description', 300) };
  });
  if (new Set(images.map(image => image.id)).size !== images.length) fail(400, 'Remove duplicate image attachments');
  let body = text(input.body, 'Post', 10000, !(type === 'story' && input.details?.story !== undefined) && (type !== 'update' || images.length === 0));
  const details = {
    organization: text(input.details?.organization, 'Organization', 200, ['referral', 'hiring'].includes(type)),
    location: text(input.details?.location, 'Location', 200, type === 'event'),
    link: text(input.details?.link, 'Link', 2000),
  };
  if (type === 'story' && input.details?.story !== undefined) {
    const story = input.details.story;
    if (!story || typeof story !== 'object' || Array.isArray(story)) fail(400, 'Provide valid story sections');
    if (!STORY_TOPICS.includes(story.topic)) fail(400, 'Choose Career Journey, Professional Achievement, or Advice');
    details.story = { topic: story.topic, journey: text(story.journey, 'Career journey', 5000),
      achievements: text(story.achievements, 'Professional achievements', 5000), advice: text(story.advice, 'Advice', 5000) };
    body = text(storyBody(details.story), 'Story', 10000, true);
  }
  if (details.link) {
    let url;
    try { url = new URL(details.link); } catch { fail(400, 'Enter a valid opportunity or registration link'); }
    if (!['https:', 'http:'].includes(url.protocol)) fail(400, 'Links must start with https:// or http://');
    details.link = url.href;
  }
  if (type === 'event') {
    const start = new Date(text(input.details?.startAt, 'Event start', 100, true));
    const end = input.details?.endAt ? new Date(input.details.endAt) : null;
    if (Number.isNaN(start.getTime())) fail(400, 'Choose an event start date and time');
    if (end && (Number.isNaN(end.getTime()) || end <= start)) fail(400, 'Event end must be after its start');
    details.startAt = start;
    details.endAt = end;
  }
  return { type, audience, title, body, details, images };
};

export const isFeedAdmin = user => String(user?.role).toLowerCase() === 'admin';

export const ensureFeedParticipation = async (db, user) => {
  if (isFeedAdmin(user)) return;
  const restriction = await db.collection('feed_restrictions').findOne({ _id: String(user._id), blocked: true });
  if (restriction) fail(403, 'Your feed participation is restricted by an administrator. You can still read available posts.');
};

export const validateModeration = input => {
  if (typeof input.enabled !== 'boolean') fail(400, 'Provide a true or false action');
  const reason = text(input.reason, 'Moderation reason', 500, input.enabled);
  return { enabled: input.enabled, reason };
};

export const canViewPost = (post, authId, connectedIds) => !!post && !post.deletedAt && !post.moderation?.blocked && (
  post.audience === 'public' || String(post.authorAuthId) === String(authId) ||
  connectedIds.map(String).includes(String(post.authorAuthId))
);

// Explicit desired state makes retries idempotent. MongoDB set operators make
// concurrent likes from several tabs count once for the same authenticated user.
export const membershipUpdate = (field, authId, enabled) => ({
  [enabled ? '$addToSet' : '$pull']: { [field]: String(authId) },
  $set: { updatedAt: new Date() },
});

export const validateComment = (value) => text(value, 'Comment', 2000, true);
