import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017';
const { default: careerRoutes } = await import('./career-posts.routes.js');
const { default: jobRoutes } = await import('../jobs/jobs.routes.js');
const { createPost } = await import('./career-posts.controllers.js');

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

for (const [name, router] of [['career guides', careerRoutes], ['jobs', jobRoutes]]) {
  for (const method of ['post', 'put', 'delete']) {
    const path = method === 'post' ? '/' : '/:id';
    test(`${name}: ${method} ${path} requires admin access`, () => {
      const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
      const guard = route.stack[0].handle;
      for (const role of ['alumni', 'student', 'admin']) {
        const res = response();
        let allowed = false;
        guard({ user: { role } }, res, () => { allowed = true; });
        assert.equal(allowed, role === 'admin');
        assert.equal(res.statusCode, role === 'admin' ? 200 : 403);
      }
    });
  }
}

test('career guide creation rejects alumni before any database operation', async () => {
  const res = response();
  await createPost({ user: { role: 'alumni' }, body: { title: 'Example' } }, res);
  assert.equal(res.statusCode, 403);
});
