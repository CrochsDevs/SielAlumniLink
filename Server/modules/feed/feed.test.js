import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createFeedService } from './feed.service.js';
import { validatePost } from './feed.policy.js';
import { createFeedImageDelete, createFeedImageDownload, createFeedImageUpload } from './feed.images.js';

// A small Mongo collection double runs the service's query/permission paths
// without connecting to or mutating the user's database.
const at = (object, path) => path.split('.').reduce((value, part) => value?.[part], object);
const equal = (a, b) => a == null || b == null ? a == null && b == null : String(a) === String(b);
const matches = (doc, filter) => Object.entries(filter).every(([key, expected]) => {
  if (key === '$or') return expected.some(f => matches(doc, f));
  if (key === '$and') return expected.every(f => matches(doc, f));
  const actual = at(doc, key);
  if (expected && typeof expected === 'object' && !(expected instanceof ObjectId) && !(expected instanceof Date)) {
    return Object.entries(expected).every(([op, value]) => {
      if (op === '$in') return value.some(v => equal(actual, v));
      if (op === '$ne') return !equal(actual, value);
      if (op === '$lt') return String(actual) < String(value);
      if (op === '$exists') return (actual !== undefined) === value;
      if (op === '$regex') return new RegExp(value, expected.$options || '').test(String(actual || ''));
      if (op === '$options') return true;
      throw new Error(`Unsupported operator ${op}`);
    });
  }
  return equal(actual, expected);
});
const cursor = (rows) => ({
  sort(order) { const [key, dir] = Object.entries(order)[0]; rows.sort((a, b) => String(at(a, key)).localeCompare(String(at(b, key))) * dir); return this; },
  limit(n) { rows = rows.slice(0, n); return this; },
  async toArray() { return rows; },
});
const memoryDb = () => {
  const tables = new Map();
  const collection = name => {
    if (!tables.has(name)) tables.set(name, []);
    const rows = tables.get(name);
    const update = (filter, changes, upsert = false) => {
      let doc = rows.find(r => matches(r, filter));
      if (!doc && upsert) { doc = { ...filter }; rows.push(doc); }
      if (!doc) return null;
      for (const [op, fields] of Object.entries(changes)) {
        for (const [field, value] of Object.entries(fields)) {
          if (op === '$set') {
            const parts = field.split('.');
            const key = parts.pop();
            const parent = parts.reduce((current, part) => current[part] ??= {}, doc);
            parent[key] = value;
          }
          if (op === '$push') (doc[field] ??= []).push(value);
          if (op === '$addToSet' && !(doc[field] || []).some(v => equal(v, value))) (doc[field] ??= []).push(value);
          if (op === '$pull') doc[field] = (doc[field] || []).filter(v => !equal(v, value));
        }
      }
      return { ...doc };
    };
    return {
      find: filter => cursor(rows.filter(r => matches(r, filter))),
      findOne: async filter => rows.find(r => matches(r, filter)) || null,
      countDocuments: async filter => rows.filter(r => matches(r, filter)).length,
      insertOne: async doc => { doc._id ??= new ObjectId(); rows.push(doc); return { insertedId: doc._id }; },
      deleteOne: async filter => { const index = rows.findIndex(r => matches(r, filter)); if (index !== -1) rows.splice(index, 1); return { deletedCount: index === -1 ? 0 : 1 }; },
      updateOne: async (filter, change, options = {}) => ({ matchedCount: update(filter, change, options.upsert) ? 1 : 0 }),
      findOneAndUpdate: async (filter, change) => update(filter, change),
      aggregate: stages => {
        let result = rows.map(r => ({ ...r }));
        for (const stage of stages) {
          if (stage.$match) result = result.filter(r => matches(r, stage.$match));
          if (stage.$sort) { const dir = stage.$sort._id; result.sort((a, b) => String(a._id).localeCompare(String(b._id)) * dir); }
          if (stage.$lookup) result = result.map(r => ({ ...r, original: rows.filter(o => equal(o._id, r.originalPostId)) }));
          if (stage.$limit) result = result.slice(0, stage.$limit);
          if (stage.$project) result = result.map(({ original, ...rest }) => rest);
        }
        return cursor(result);
      },
    };
  };
  return { collection };
};

const fixture = async () => {
  const db = memoryDb();
  const people = ['author', 'friend', 'stranger', 'student', 'admin'].map((name, i) => ({
    _id: new ObjectId(), email: `${name}@example.test`, name, role: i === 4 ? 'admin' : i === 3 ? 'student' : 'alumni',
  }));
  for (const p of people) {
    await db.collection('auth').insertOne(p);
    await db.collection('users').insertOne({ ...p, _id: new ObjectId(), authId: String(p._id) });
  }
  const connect = async (a, b, status = 'accepted') => {
    const c = { requesterAuthId: a._id, recipientAuthId: b._id, requesterEmail: a.email, recipientEmail: b.email, status };
    await db.collection('connections').insertOne(c);
    return c;
  };
  const connection = await connect(people[0], people[1]);
  const invalidations = [];
  const feed = createFeedService(db, () => invalidations.push('changed'));
  return { db, feed, author: people[0], friend: people[1], stranger: people[2], student: people[3], admin: people[4], connect, connection, invalidations };
};
const post = (overrides = {}) => ({ body: 'A meaningful update', ...overrides });
const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);

test('student dashboard filters all five types, paginates search, and protects private or blocked posts', async () => {
  const f = await fixture();
  const inputs = [
    { type: 'update', body: 'Community C++ update' },
    { type: 'hiring', title: 'C++ developer', body: 'Build useful tools', details: { organization: 'Campus Labs' } },
    { type: 'referral', title: 'Research referral', body: 'Join the team', details: { organization: 'Campus Labs' } },
    { type: 'event', title: 'Career workshop', body: 'Career planning', details: { location: 'Campus Hall', startAt: '2027-01-01T08:00:00Z' } },
    { type: 'story', title: 'From student to engineer', body: 'My C++ career journey' },
  ];
  const created = await Promise.all(inputs.map(input => f.feed.create(f.author, input)));
  assert.equal((await f.feed.list(f.student, { type: 'all' })).posts.length, 5);
  for (const type of ['hiring', 'referral', 'event', 'story']) {
    const page = await f.feed.list(f.student, { type });
    assert.equal(page.posts.length, 1); assert.equal(page.posts[0].type, type);
  }
  assert.equal((await f.feed.list(f.student, { q: 'campus' })).posts.length, 3);
  const first = await f.feed.list(f.student, { q: 'C++', limit: 1 });
  const second = await f.feed.list(f.student, { q: 'C++', limit: 1, before: first.nextCursor });
  assert.equal(first.posts.length, 1); assert.ok(first.nextCursor);
  assert.equal(second.posts.length, 1); assert.notEqual(String(first.posts[0]._id), String(second.posts[0]._id));
  assert.equal((await f.feed.list(f.student, { type: 'referral', q: 'C++' })).posts.length, 0);
  const privatePost = await f.feed.create(f.author, { type: 'hiring', title: 'Private C++ job', body: 'Private', audience: 'connections', details: { organization: 'Private Labs' } });
  await f.feed.share(f.friend, privatePost._id, { audience: 'connections' });
  await f.feed.moderate(f.admin, created[1]._id, { action: 'block', enabled: true, reason: 'Review' });
  const visible = await f.feed.list(f.student, { q: 'C++' });
  assert.equal(visible.posts.length, 2);
  assert.ok(visible.posts.every(post => post.audience === 'public' && post.type !== 'hiring'));
  const repost = await f.feed.share(f.friend, created[2]._id, { audience: 'public', body: 'An opportunity worth sharing' });
  assert.ok((await f.feed.list(f.student, { q: 'Research referral' })).posts.some(post => String(post._id) === String(repost._id)));
  for (const q of ['x'.repeat(201), ['text'], { $ne: '' }]) await rejects(f.feed.list(f.student, { q }), 400);
});

test('structured success stories preserve journey, achievements and advice with canonical feed content', async () => {
  const f = await fixture();
  const sections = { topic: 'career_journey', journey: 'I started as an intern.', achievements: 'Led a community software project.', advice: 'Build useful projects and ask for feedback.' };
  const story = await f.feed.create(f.author, { type: 'story', title: 'A career in community technology', body: 'This text is replaced by the story sections', details: { story: sections } });
  assert.deepEqual(story.details.story, sections);
  assert.ok(story.body.includes('Career journey\nI started as an intern.'));
  assert.ok(story.body.includes('Professional achievements\nLed a community software project.'));
  assert.ok(story.body.includes('Advice for students\nBuild useful projects'));
  assert.equal((await f.feed.get(f.student, story._id)).title, story.title);
  await rejects(f.feed.create(f.student, { type: 'story', title: 'Student story', details: { story: sections } }), 403);
});

test('story gallery respects student visibility, author ownership, topics, keyword search and original posts', async () => {
  const f = await fixture();
  const visible = await f.feed.create(f.author, { type: 'story', title: 'Learning C++', details: { story: { topic: 'advice', advice: 'Practice C++ with useful projects.' } } });
  await f.feed.create(f.author, post({ type: 'story', title: 'Private journey', audience: 'connections' }));
  await f.feed.create(f.friend, { type: 'story', title: 'A professional milestone', details: { story: { topic: 'achievement', achievements: 'Earned a professional award.' } } });
  await f.feed.create(f.author, post({ type: 'update' }));
  await f.feed.share(f.friend, visible._id, { body: 'A useful story.', audience: 'public' });
  const result = await f.feed.listStories(f.student);
  assert.equal(result.posts.length, 2);
  assert.ok(result.posts.every(story => story.type === 'story' && !story.originalPost));
  assert.equal((await f.feed.listStories(f.student, { topic: 'advice', q: 'C++' })).posts[0].title, 'Learning C++');
  assert.equal((await f.feed.listStories(f.author, { mine: 'true' })).posts.length, 2);
  assert.equal((await f.feed.listStories(f.student, { mine: 'true' })).posts.length, 0);
  await rejects(f.feed.listStories(f.student, { topic: 'invalid' }), 400);
  await rejects(f.feed.listStories(f.student, { q: { $ne: '' } }), 400);
});

test('story sections validate content without weakening ordinary post validation', () => {
  const data = { type: 'story', title: 'Advice', details: { story: { topic: 'advice', advice: 'Keep learning.' } } };
  assert.equal(validatePost(data).body, 'Advice for students\nKeep learning.');
  for (const story of [{ topic: 'invalid', advice: 'Text' }, { topic: 'advice' }, { topic: 'advice', advice: {} }, { topic: 'advice', advice: 'x'.repeat(5001) }, []]) {
    assert.throws(() => validatePost({ ...data, details: { story } }), error => error.status === 400);
  }
  assert.throws(() => validatePost({ type: 'update', details: { story: {} } }), error => error.status === 400);
  assert.equal(validatePost({ type: 'story', title: 'Legacy story', body: 'My career journey.' }).body, 'My career journey.');
});

test('only administrators can access moderation, restrictions, and private post review', async () => {
  const f = await fixture();
  const p = await f.feed.create(f.author, post({ audience: 'connections' }));
  for (const user of [f.author, f.friend, f.stranger, f.student]) {
    await rejects(f.feed.moderate(user, p._id, { action: 'block', enabled: true, reason: 'Test' }), 403);
    await rejects(f.feed.restrictAuthor(user, f.friend._id, { enabled: true, reason: 'Test' }), 403);
    await rejects(f.feed.listRestrictions(user), 403);
    await rejects(f.feed.list(user, { moderation: 'all' }), 403);
  }
  assert.equal((await f.feed.get(f.admin, p._id)).body, p.body);
  assert.equal((await f.feed.list(f.admin)).posts.length, 1);
  assert.equal((await f.feed.list(f.stranger)).posts.length, 0);
  await rejects(f.feed.moderate(f.admin, p._id, { action: 'block', enabled: true, reason: ' ' }), 400);
  await rejects(f.feed.moderate(f.admin, p._id, { action: 'unknown', enabled: false }), 400);
});

test('blocking hides original posts, reposts, comments, and photos; restoring preserves privacy', async () => {
  const f = await fixture();
  const image = { _id: new ObjectId(), ownerAuthId: String(f.author._id), url: 'https://example.test/photo.jpg' };
  await f.db.collection('feed_images').insertOne(image);
  const p = await f.feed.create(f.author, post({ audience: 'connections', images: [{ id: String(image._id) }] }));
  const repost = await f.feed.share(f.friend, p._id, { audience: 'connections' });
  await f.feed.comment(f.friend, p._id, 'Comment before block');
  const blocked = await f.feed.moderate(f.admin, p._id, { action: 'block', enabled: true, reason: 'Spam' });
  assert.equal(blocked.moderation.blocked, true);
  for (const user of [f.author, f.friend]) {
    assert.equal((await f.feed.list(user)).posts.length, 0);
    await rejects(f.feed.get(user, p._id), 404);
    await rejects(f.feed.get(user, repost._id), 404);
    await rejects(f.feed.listComments(user, p._id), 404);
    await rejects(f.feed.getImage(user, p._id, image._id), 404);
    await rejects(f.feed.setMembership(user, p._id, 'likedBy', true), 404);
    await rejects(f.feed.share(user, p._id, {}), 404);
    await rejects(f.feed.recipients(user, p._id), 404);
  }
  assert.equal((await f.feed.list(f.admin, { moderation: 'blocked' })).posts.length, 1);
  assert.equal((await f.feed.getImage(f.admin, p._id, image._id)).url, image.url);
  await f.feed.moderate(f.admin, p._id, { action: 'block', enabled: false });
  assert.equal((await f.feed.list(f.friend)).posts.length, 2);
  assert.equal((await f.feed.list(f.stranger)).posts.length, 0);
  assert.equal((await f.feed.get(f.friend, p._id)).audience, 'connections');
  const stored = await f.db.collection('feed_posts').findOne({ _id: p._id });
  assert.equal(stored.moderationHistory.length, 2);
  assert.equal(stored.moderationHistory[0].by, String(f.admin._id));
  assert.ok(f.invalidations.length >= 5);
});

test('admin can delete another member’s private post and comment without granting other members deletion rights', async () => {
  const f = await fixture();
  const p = await f.feed.create(f.author, post({ audience: 'connections' }));
  const c = await f.feed.comment(f.friend, p._id, 'A comment');
  await rejects(f.feed.removeComment(f.author, p._id, c._id), 404);
  assert.equal((await f.feed.listComments(f.admin, p._id)).comments[0].canDelete, true);
  await f.feed.removeComment(f.admin, p._id, c._id);
  assert.equal((await f.feed.listComments(f.friend, p._id)).comments.length, 0);
  await rejects(f.feed.remove(f.friend, p._id), 403);
  await f.feed.remove(f.admin, p._id);
  await rejects(f.feed.get(f.admin, p._id), 404);
  assert.equal((await f.db.collection('feed_posts').findOne({ _id: p._id })).deletedBy, String(f.admin._id));
});

test('turning comments off retains existing comments and can be reversed independently of blocking', async () => {
  const f = await fixture();
  const p = await f.feed.create(f.author, post());
  await f.feed.comment(f.friend, p._id, 'Existing comment');
  await Promise.all([
    f.feed.moderate(f.admin, p._id, { action: 'comments', enabled: true, reason: 'Pause discussion' }),
    f.feed.moderate(f.admin, p._id, { action: 'block', enabled: true, reason: 'Review content' }),
  ]);
  assert.equal((await f.feed.get(f.admin, p._id)).commentsDisabled, true);
  await f.feed.moderate(f.admin, p._id, { action: 'block', enabled: false });
  await rejects(f.feed.comment(f.friend, p._id, 'New comment'), 403);
  assert.equal((await f.feed.listComments(f.friend, p._id)).comments.length, 1);
  await f.feed.moderate(f.admin, p._id, { action: 'comments', enabled: false });
  await f.feed.comment(f.friend, p._id, 'New comment');
  assert.equal((await f.feed.get(f.friend, p._id)).commentsCount, 2);
});

test('restricted members cannot publish, repost, comment, like, RSVP, or upload photos; admins can restore participation', async () => {
  const f = await fixture();
  const p = await f.feed.create(f.friend, post());
  await f.feed.restrictAuthor(f.admin, f.author._id, { enabled: true, reason: 'Repeated spam' });
  assert.deepEqual(await f.feed.status(f.author), { restricted: true, reason: 'Repeated spam' });
  assert.equal((await f.feed.listRestrictions(f.admin))[0].author.authId, String(f.author._id));
  assert.equal((await f.feed.get(f.author, p._id)).body, p.body);
  await rejects(f.feed.create(f.author, post()), 403);
  await rejects(f.feed.share(f.author, p._id, {}), 403);
  await rejects(f.feed.comment(f.author, p._id, 'Spam'), 403);
  await rejects(f.feed.setMembership(f.author, p._id, 'likedBy', true), 403);
  await rejects(f.feed.setMembership(f.author, p._id, 'attending', true), 403);
  const response = imageResponse();
  let uploaded = false;
  await createFeedImageUpload(f.db, async () => { uploaded = true; })({ user: f.author, file: { buffer: png } }, response);
  assert.equal(response.statusCode, 403); assert.equal(uploaded, false);
  await rejects(f.feed.restrictAuthor(f.admin, f.admin._id, { enabled: true, reason: 'Not allowed' }), 403);
  await f.feed.restrictAuthor(f.admin, f.author._id, { enabled: false });
  assert.equal((await f.feed.status(f.author)).restricted, false);
  assert.equal((await f.feed.listRestrictions(f.admin)).length, 0);
  await f.feed.create(f.author, post());
  assert.equal((await f.db.collection('feed_restrictions').findOne({ _id: String(f.author._id) })).history.length, 2);
});

test('public posts are visible and interactive to nonconnections and students', async () => {
  const f = await fixture();
  const p = await f.feed.create(f.author, post());
  assert.equal((await f.feed.list(f.stranger)).posts[0]._id, p._id);
  assert.equal((await f.feed.get(f.student, p._id)).body, p.body);
  const c = await f.feed.comment(f.student, p._id, 'Congratulations!');
  assert.equal(c.author.authId, String(f.student._id));
  assert.equal((await f.feed.get(f.author, p._id)).commentsCount, 1);
  await rejects(f.feed.create(f.student, post()), 403);
});

test('private post access is enforced for feed, detail, like, comments, and RSVP', async () => {
  const f = await fixture();
  const p = await f.feed.create(f.author, post({ audience: 'connections' }));
  assert.equal((await f.feed.list(f.stranger)).posts.length, 0);
  assert.equal((await f.feed.list(f.friend)).posts.length, 1);
  await rejects(f.feed.get(f.stranger, p._id), 404);
  await rejects(f.feed.setMembership(f.stranger, p._id, 'likedBy', true), 404);
  await rejects(f.feed.comment(f.stranger, p._id, 'hidden'), 404);
  await rejects(f.feed.listComments(f.stranger, p._id), 404);
  await rejects(f.feed.setMembership(f.stranger, p._id, 'attending', true), 404);
  await f.db.collection('connections').updateOne({ _id: f.connection._id }, { $set: { status: 'pending' } });
  await rejects(f.feed.get(f.friend, p._id), 404);
});

test('concurrent likes and retries count once per authenticated user; unlike is idempotent', async () => {
  const f = await fixture();
  const p = await f.feed.create(f.author, post());
  await Promise.all(Array.from({ length: 20 }, () => f.feed.setMembership(f.friend, p._id, 'likedBy', true)));
  let visible = await f.feed.get(f.friend, p._id);
  assert.equal(visible.likesCount, 1); assert.equal(visible.likedByMe, true);
  assert.equal(visible.likedBy, undefined);
  await f.feed.setMembership(f.stranger, p._id, 'likedBy', true);
  assert.equal((await f.feed.get(f.author, p._id)).likesCount, 2);
  await Promise.all([false, false].map(liked => f.feed.setMembership(f.friend, p._id, 'likedBy', liked)));
  visible = await f.feed.get(f.friend, p._id);
  assert.equal(visible.likesCount, 1); assert.equal(visible.likedByMe, false);
  await rejects(f.feed.setMembership(f.friend, p._id, 'likedBy', 'true'), 400);
  assert.ok(f.invalidations.length >= 24);
});

test('a repost cannot widen the original private audience', async () => {
  const f = await fixture();
  await f.connect(f.friend, f.stranger);
  const p = await f.feed.create(f.author, post({ audience: 'connections' }));
  await rejects(f.feed.share(f.friend, p._id, { audience: 'public' }), 403);
  const repost = await f.feed.share(f.friend, p._id, { audience: 'connections', body: 'Wonderful news' });
  assert.equal((await f.feed.get(f.author, repost._id)).originalPost.body, p.body);
  assert.equal((await f.feed.list(f.stranger)).posts.length, 0);
  await rejects(f.feed.get(f.stranger, repost._id), 404);
  await f.connect(f.author, f.stranger);
  assert.equal((await f.feed.list(f.stranger)).posts.length, 2);
  await f.feed.remove(f.author, p._id);
  assert.equal((await f.feed.list(f.friend)).posts.length, 0);
  await rejects(f.feed.get(f.friend, repost._id), 404);
});

test('send recipients must be accepted alumni connections with original post access', async () => {
  const f = await fixture();
  await f.connect(f.author, f.student);
  await f.connect(f.author, f.stranger, 'pending');
  const p = await f.feed.create(f.author, post());
  assert.deepEqual((await f.feed.recipients(f.author, p._id)).map(p => p.authId), [String(f.friend._id)]);
  await f.connect(f.friend, f.stranger);
  const privatePost = await f.feed.create(f.author, post({ audience: 'connections' }));
  assert.deepEqual((await f.feed.recipients(f.friend, privatePost._id)).map(p => p.authId), [String(f.author._id)]);
});

test('comment and post deletion require ownership; deleted comments stay absent', async () => {
  const f = await fixture();
  const p = await f.feed.create(f.author, post());
  const c = await f.feed.comment(f.friend, p._id, 'My comment');
  await rejects(f.feed.removeComment(f.stranger, p._id, c._id), 404);
  await rejects(f.feed.remove(f.friend, p._id), 403);
  await f.feed.removeComment(f.friend, p._id, c._id);
  assert.equal((await f.feed.listComments(f.author, p._id)).comments.length, 0);
  assert.equal((await f.feed.get(f.author, p._id)).commentsCount, 0);
});

test('typed stories, referrals, hiring, and events persist validated fields', async () => {
  const f = await fixture();
  for (const type of ['story', 'referral', 'hiring', 'event']) {
    const p = await f.feed.create(f.author, post({ type, title: `${type} title`, details: {
      organization: 'Company', location: 'Campus', startAt: '2026-11-01T10:00:00+08:00', link: 'https://example.test/apply',
    } }));
    assert.equal((await f.feed.list(f.friend, { type })).posts[0].type, type);
    if (type === 'event') {
      await f.feed.setMembership(f.friend, p._id, 'attending', true);
      await f.feed.setMembership(f.friend, p._id, 'attending', true);
      assert.equal((await f.feed.get(f.friend, p._id)).attendingCount, 1);
      await f.feed.setMembership(f.friend, p._id, 'attending', false);
      assert.equal((await f.feed.get(f.friend, p._id)).attendingCount, 0);
    } else await rejects(f.feed.setMembership(f.friend, p._id, 'attending', true), 400);
  }
});

test('validation rejects invalid types, audience, empty text, unsafe links, and invalid event dates', () => {
  for (const data of [post({ type: 'fake' }), post({ audience: 'fake' }), post({ body: '  ' }), post({ body: {} }),
    post({ details: { link: 'javascript:alert(1)' } }), post({ type: 'story' }),
    post({ type: 'event', title: 'Event', details: { location: 'Campus', startAt: null } }),
    post({ type: 'event', title: 'Event', details: { location: 'Campus', startAt: '2026-10-12', endAt: '2026-10-11' } })]) {
    assert.throws(() => validatePost(data), error => error.status === 400);
  }
});

test('pagination is stable and never includes hidden posts', async () => {
  const f = await fixture();
  for (let i = 0; i < 5; i++) await f.feed.create(f.author, post({ body: `Post ${i}`, audience: i % 2 ? 'connections' : 'public' }));
  const page = await f.feed.list(f.stranger, { limit: 2 });
  assert.equal(page.posts.length, 2); assert.ok(page.nextCursor);
  const next = await f.feed.list(f.stranger, { limit: 2, before: page.nextCursor });
  assert.equal(next.posts.length, 1); assert.equal(next.nextCursor, null);
  assert.equal(new Set([...page.posts, ...next.posts].map(p => String(p._id))).size, 3);
});

test('photo posts persist attachments, validate ownership, and protect image access', async () => {
  const f = await fixture();
  const image = { _id: new ObjectId(), ownerAuthId: String(f.author._id), width: 1200, height: 800,
    url: 'https://example.test/private-photo.jpg', publicId: 'private-asset' };
  await f.db.collection('feed_images').insertOne(image);
  const p = await f.feed.create(f.author, { audience: 'connections', images: [{ id: String(image._id), alt: 'Celebrating graduation' }] });
  assert.equal(p.body, ''); assert.equal(p.images.length, 1); assert.equal(p.images[0].width, 1200);
  assert.equal(p.images[0].alt, 'Celebrating graduation');
  assert.equal(p.images[0].url, `/api/feed/${p._id}/images/${image._id}`);
  assert.equal(JSON.stringify(p).includes(image.url), false);
  assert.equal((await f.feed.getImage(f.friend, p._id, image._id)).url, image.url);
  await rejects(f.feed.getImage(f.stranger, p._id, image._id), 404);
  await rejects(f.feed.getImage(f.friend, p._id, new ObjectId()), 404);
  await rejects(f.feed.create(f.friend, { images: [{ id: String(image._id) }] }), 400);
  const share = await f.feed.share(f.friend, p._id, { audience: 'connections' });
  assert.equal(share.originalPost.images[0].url, p.images[0].url);
  await f.db.collection('connections').updateOne({ _id: f.connection._id }, { $set: { status: 'declined' } });
  await rejects(f.feed.getImage(f.friend, p._id, image._id), 404);
  await f.feed.remove(f.author, p._id);
  await rejects(f.feed.getImage(f.author, p._id, image._id), 404);
});

test('photo validation rejects duplicate, excessive, arbitrary URL, or malformed attachments', () => {
  const id = String(new ObjectId());
  for (const images of [[{ id }, { id }], Array.from({ length: 10 }, () => ({ id: String(new ObjectId()) })),
    [{ url: 'https://example.test/image.jpg' }], ['image'], {}, [{ id, alt: 'x'.repeat(301) }]]) {
    assert.throws(() => validatePost({ images }), error => error.status === 400);
  }
  assert.throws(() => validatePost({ type: 'story', title: 'Story', images: [{ id }] }), error => error.status === 400);
});

const imageResponse = () => ({
  statusCode: 200, status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }, set(headers) { this.headers = headers; return this; }, send(body) { this.body = body; return this; },
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

test('image upload validates real file content, rejects students, and conceals storage URLs', async () => {
  const f = await fixture();
  let uploads = 0;
  const upload = createFeedImageUpload(f.db, async () => { uploads++; return {
    secure_url: 'https://example.test/photo.png', public_id: 'asset-id', width: 1, height: 1, format: 'png',
  }; });
  const res = imageResponse();
  await upload({ user: f.author, file: { buffer: png } }, res);
  assert.equal(res.statusCode, 201); assert.ok(res.body.data.id); assert.equal(res.body.data.url, undefined);
  assert.equal((await f.db.collection('feed_images').findOne({ _id: new ObjectId(res.body.data.id) })).ownerAuthId, String(f.author._id));
  for (const req of [{ user: f.student, file: { buffer: png } }, { user: f.author },
    { user: f.author, file: { buffer: Buffer.from('<svg>Not a supported image</svg>') } },
    { user: f.author, file: { buffer: Buffer.alloc(10 * 1024 * 1024 + 1) } }]) {
    const denied = imageResponse(); await upload(req, denied); assert.ok(denied.statusCode >= 400);
  }
  assert.equal(uploads, 1);
});

test('image download denies outsiders before fetching and disables shared caching', async () => {
  const f = await fixture();
  const image = { _id: new ObjectId(), ownerAuthId: String(f.author._id), url: 'https://example.test/photo.png', width: 1, height: 1 };
  await f.db.collection('feed_images').insertOne(image);
  const p = await f.feed.create(f.author, { audience: 'connections', images: [{ id: String(image._id) }] });
  let downloads = 0;
  const serve = createFeedImageDownload(f.feed, async () => { downloads++; return new Response(png, { headers: { 'Content-Type': 'image/png' } }); });
  const allowed = imageResponse();
  await serve({ user: f.friend, params: { id: p._id, imageId: image._id } }, allowed);
  assert.deepEqual(allowed.body, png); assert.equal(allowed.headers['Cache-Control'], 'private, no-store');
  const denied = imageResponse();
  await serve({ user: f.stranger, params: { id: p._id, imageId: image._id } }, denied);
  assert.equal(denied.statusCode, 404); assert.equal(downloads, 1);
});

test('removing a draft photo deletes only the owner’s unused Cloudinary asset', async () => {
  const f = await fixture();
  const asset = { _id: new ObjectId(), ownerAuthId: String(f.author._id), publicId: 'alumnilink/feed/test/unused-photo' };
  await f.db.collection('feed_images').insertOne(asset);
  const removed = [];
  const remove = createFeedImageDelete(f.db, async id => removed.push(id));
  const forbidden = imageResponse();
  await remove({ user: f.friend, params: { id: String(asset._id) } }, forbidden);
  assert.equal(forbidden.statusCode, 404); assert.equal(removed.length, 0);
  const allowed = imageResponse();
  await remove({ user: f.author, params: { id: String(asset._id) } }, allowed);
  assert.equal(allowed.statusCode, 200); assert.deepEqual(removed, [asset.publicId]);
  assert.equal(await f.db.collection('feed_images').findOne({ _id: asset._id }), null);
});
