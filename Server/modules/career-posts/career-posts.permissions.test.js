import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017';
const { default: careerRoutes } = await import('./career-posts.routes.js');
const { default: jobRoutes } = await import('../jobs/jobs.routes.js');
const { createPost, updatePost, deletePost, listPosts, getSavedPosts, toggleSavePost } = await import('./career-posts.controllers.js');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

for (const [name, router] of [['career guides', careerRoutes], ['jobs', jobRoutes]]) {
  for (const method of ['post', 'put', 'delete']) {
    const path = method === 'post' ? '/' : '/:id';
    test(`${name}: ${method} ${path} enforces publishing roles`, () => {
      const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
      const guard = route.stack[0].handle;
      for (const role of ['alumni', 'student', 'admin']) {
        const res = response();
        let allowed = false;
        guard({ user: { role } }, res, () => { allowed = true; });
        const expected = role === 'admin' || (name === 'career guides' && role === 'alumni');
        assert.equal(allowed, expected);
        assert.equal(res.statusCode, expected ? 200 : 403);
      }
    });
  }
}

test('career guide creation rejects students before any database operation', async () => {
  const res = response();
  await createPost({ user: { role: 'student' }, body: { title: 'Example' } }, res);
  assert.equal(res.statusCode, 403);
});

const { default: CareerPostModel } = await import('./career-posts.models.js');
const { default: UserModel } = await import('../users/users.models.js');

for (const type of ['advice', 'insight', 'roadmap']) {
  test(`alumni can publish ${type} with server-owned author identity`, async t => {
    t.mock.method(UserModel, 'findByAuthId', async () => ({ name: 'Alumni Author' }));
    t.mock.method(CareerPostModel, 'create', async data => ({ ...data, _id: 'guide1' }));
    const res = response();
    await createPost({ user: { _id: 'author1', role: 'alumni', email: 'author@example.test' }, body: { title: ' A guide ', body: ' Helpful content ', type, authorAuthId: 'spoofed' } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.data.authorAuthId, 'author1');
    assert.equal(res.body.data.title, 'A guide');
    assert.equal(res.body.data.type, type);
  });
}

for (const handler of [updatePost, deletePost]) {
  test(`${handler.name} permits only the owner or administrator`, async t => {
    t.mock.method(CareerPostModel, 'findById', async () => ({ authorAuthId: 'owner' }));
    const update = t.mock.method(CareerPostModel, 'updateById', async (_id, data) => data);
    const remove = t.mock.method(CareerPostModel, 'deleteById', async () => true);
    for (const [role, id, status] of [['alumni', 'other', 403], ['alumni', 'owner', 200], ['admin', 'admin1', 200]]) {
      const res = response();
      await handler({ user: { role, _id: id }, params: { id: 'guide1' }, body: { title: 'Updated guide' } }, res);
      assert.equal(res.statusCode, status);
    }
    assert.equal(update.mock.callCount() + remove.mock.callCount(), 2);
  });
}

test('rejects empty or malformed guide content before creating records', async () => {
  for (const body of [{ title: ' ', body: 'Content' }, { title: 'Title', body: '' }, { title: {}, body: 'Content' }, { title: 'Title', body: 'Content', type: 'invalid' }, { title: 'Title', body: 'Content', tags: [{}] }]) {
    const res = response();
    await createPost({ user: { role: 'alumni' }, body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test('student saves, lists, and unsaves a guide without exposing other savers', async t => {
  const post = { _id: 'guide1', savedBy: ['another-user'] };
  t.mock.method(CareerPostModel, 'toggleSave', async (_id, authId) => {
    const saved = !post.savedBy.includes(authId);
    post.savedBy = saved ? [...post.savedBy, authId] : post.savedBy.filter(id => id !== authId);
    return { saved };
  });
  t.mock.method(CareerPostModel, 'findAll', async () => [post]);
  t.mock.method(CareerPostModel, 'findSavedBy', async authId => post.savedBy.includes(authId) ? [post] : []);
  const req = { user: { _id: 'student1', role: 'student' }, params: { id: 'guide1' }, query: {} };
  let res = response();
  await toggleSavePost(req, res);
  assert.equal(res.body.data.saved, true);
  res = response();
  await listPosts(req, res);
  assert.equal(res.body.data[0].savedByMe, true);
  assert.equal(res.body.data[0].savesCount, 2);
  assert.equal(res.body.data[0].savedBy, undefined);
  res = response();
  await getSavedPosts(req, res);
  assert.equal(res.body.data.length, 1);
  res = response();
  await toggleSavePost(req, res);
  assert.equal(res.body.data.saved, false);
  res = response();
  await getSavedPosts(req, res);
  assert.deepEqual(res.body.data, []);
});

test('student career interests persist to their own profile and can be cleared', async t => {
  const { updateMyProfile } = await import('../users/users.controllers.js');
  const profile = { _id: 'profile1', authId: 'student1', interests: [] };
  t.mock.method(UserModel, 'findByAuthId', async authId => {
    assert.equal(authId, 'student1');
    return profile;
  });
  t.mock.method(UserModel, 'updateById', async (id, data) => {
    assert.equal(id, 'profile1');
    Object.assign(profile, data);
    return true;
  });
  t.mock.method(UserModel, 'findById', async () => ({ ...profile }));
  for (const interests of [['Software Development', 'Design'], []]) {
    const res = response();
    await updateMyProfile({ user: { _id: 'student1', role: 'student' }, body: { interests } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(profile.interests, interests);
    assert.deepEqual(res.body.data.interests, interests);
  }
});
