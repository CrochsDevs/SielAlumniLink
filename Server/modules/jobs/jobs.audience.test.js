import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewJob, validateAudience } from './jobs.audience.js';
import { createApplicationHandlers } from './job-applications.controllers.js';

process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017';
const { listJobs, getJob, createJob, updateJob } = await import('./jobs.controllers.js');
const { default: jobs } = await import('./jobs.models.js');
const { default: notifications } = await import('../notifications/notifications.models.js');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('job audience accepts only all/alumni and preserves legacy community visibility', () => {
  for (const audience of [undefined, 'all', 'alumni']) assert.equal(validateAudience(audience), null);
  for (const audience of [null, '', 'student', [], {}]) assert.ok(validateAudience(audience));
  for (const role of ['student', 'alumni', 'admin']) {
    assert.equal(canViewJob({ isActive: true }, { role }), true);
    assert.equal(canViewJob({ isActive: true, audience: 'alumni' }, { role }), role !== 'student');
    assert.equal(canViewJob({ isActive: false, audience: 'all' }, { role }), role === 'admin');
  }
});

test('job list enforces audience and all=true cannot expose hidden jobs to members', async t => {
  const items = [{ _id: 'legacy', isActive: true }, { _id: 'all', isActive: true, audience: 'all' }, { _id: 'alumni', isActive: true, audience: 'alumni' }, { _id: 'hidden', isActive: false }];
  const find = t.mock.method(jobs, 'findAll', async () => items);
  for (const [role, expected] of [['student', ['legacy', 'all']], ['alumni', ['legacy', 'all', 'alumni']], ['admin', ['legacy', 'all', 'alumni', 'hidden']]]) {
    const res = response();
    await listJobs({ user: { role }, query: { all: 'true' } }, res);
    assert.deepEqual(res.body.data.map(item => item._id), expected);
    assert.deepEqual(find.mock.calls.at(-1).arguments[0], { activeOnly: role !== 'admin', role });
  }
});

test('students cannot fetch alumni-only opportunities by direct ID', async t => {
  t.mock.method(jobs, 'findById', async () => ({ isActive: true, audience: 'alumni' }));
  for (const role of ['student', 'alumni', 'admin']) {
    const res = response(); await getJob({ params: { id: 'job' }, user: { role } }, res);
    assert.equal(res.code, role === 'student' ? 404 : 200);
  }
});

test('publishing preserves audience and notifications target the same audience', async t => {
  t.mock.method(jobs, 'create', async data => ({ ...data, isActive: true }));
  const broadcast = t.mock.method(notifications, 'broadcast', async () => 1);
  for (const audience of ['all', 'alumni']) {
    const res = response();
    await createJob({ user: { _id: 'admin', role: 'admin' }, body: { title: 'Role', company: 'Company', audience } }, res);
    assert.equal(res.code, 201); assert.equal(res.body.data.audience, audience);
    assert.equal(broadcast.mock.calls.at(-1).arguments[0].audience, audience);
  }
});

test('invalid audience is rejected on create/update before writing; partial updates preserve audience', async t => {
  const create = t.mock.method(jobs, 'create', async data => data);
  const update = t.mock.method(jobs, 'updateById', async (_id, data) => ({ audience: 'alumni', ...data }));
  for (const handler of [createJob, updateJob]) {
    const res = response();
    await handler({ user: { _id: 'admin', role: 'admin' }, params: { id: 'job' }, body: { title: 'Title', company: 'Company', audience: 'students' } }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(create.mock.callCount(), 0); assert.equal(update.mock.callCount(), 0);
  const res = response(); await updateJob({ params: { id: 'job' }, body: { isActive: false } }, res);
  assert.equal(res.body.data.audience, 'alumni');
});

test('students cannot submit to alumni-only jobs even through a previously opened form', async () => {
  let writes = 0;
  const handlers = createApplicationHandlers({ jobs: { findById: async () => ({ _id: 'job', isActive: true, audience: 'alumni' }) }, applications: { create: async data => { writes++; return data; } } });
  for (const role of ['student', 'alumni']) {
    const res = response();
    await handlers.submit({ user: { _id: role, role }, params: { id: 'job' }, body: { name: 'Member', email: 'member@example.test' }, file: { originalname: 'resume.pdf', buffer: Buffer.from('%PDF-1.7') } }, res);
    assert.equal(res.code, role === 'student' ? 404 : 201);
  }
  assert.equal(writes, 1);
});
