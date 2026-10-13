import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationHandlers, MAX_RESUME_BYTES } from './job-applications.controllers.js';

function fixture() {
  const records = [];
  const handlers = createApplicationHandlers({
    jobs: { findById: async id => id === 'open' ? { _id: 'open', title: 'Developer', company: 'Example', isActive: true } : { isActive: false } },
    applications: {
      create: async data => { if (records.length) throw Object.assign(new Error('Duplicate'), { code: 11000 }); records.push(data); const { resumeData, ...summary } = data; return summary; },
      findMine: async id => records.filter(record => record.applicantAuthId === id).map(({ resumeData, ...summary }) => summary),
      findByJob: async () => [],
      findById: async () => records[0],
    },
  });
  const req = { user: { _id: 'member', role: 'alumni' }, params: { id: 'open', applicationId: 'application' }, body: { name: 'Applicant', email: 'member@example.com', note: 'Interested' }, file: { originalname: 'resume.pdf', buffer: Buffer.from('%PDF-1.7\nResume') } };
  const response = () => ({ statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader(key, value) { this.headers[key] = value; }, send(data) { this.data = data; } });
  return { handlers, req, response, records };
}

test('resume submission persists authenticated ownership and excludes binary from response', async () => {
  const f = fixture(), res = f.response();
  await f.handlers.submit(f.req, res);
  assert.equal(res.statusCode, 201); assert.equal(f.records[0].applicantAuthId, 'member');
  assert.equal(res.body.data.resumeData, undefined); assert.equal(f.records[0].resumeData.toString(), '%PDF-1.7\nResume');
  const mine = f.response(); await f.handlers.mine(f.req, mine); assert.equal(mine.body.data.length, 1);
});
test('closed jobs, admin applicants and invalid contact details are rejected', async () => {
  for (const [change, code] of [[{ params: { id: 'closed' } }, 404], [{ user: { role: 'admin' } }, 403], [{ body: { name: 'Name', email: 'invalid' } }, 400]]) {
    const f = fixture(), res = f.response(); await f.handlers.submit({ ...f.req, ...change }, res); assert.equal(res.statusCode, code); assert.equal(f.records.length, 0);
  }
});
test('missing, disguised, and oversized resumes cannot be submitted', async () => {
  for (const file of [undefined, { originalname: 'resume.pdf', buffer: Buffer.from('not a PDF') }, { originalname: 'resume.exe', buffer: Buffer.from('%PDF-1.7') }, { originalname: 'resume.pdf', buffer: Buffer.alloc(MAX_RESUME_BYTES + 1) }]) {
    const f = fixture(), res = f.response(); await f.handlers.submit({ ...f.req, file }, res); assert.equal(res.statusCode, 400); assert.equal(f.records.length, 0);
  }
});
test('duplicate applications return a conflict', async () => {
  const f = fixture(); await f.handlers.submit(f.req, f.response()); const res = f.response(); await f.handlers.submit(f.req, res); assert.equal(res.statusCode, 409); assert.equal(f.records.length, 1);
});
test('only the applicant or admin can download a resume', async () => {
  const f = fixture(); await f.handlers.submit(f.req, f.response());
  for (const [user, code] of [[{ _id: 'other', role: 'alumni' }, 403], [f.req.user, 200], [{ _id: 'admin', role: 'admin' }, 200]]) {
    const res = f.response(); await f.handlers.resume({ ...f.req, user }, res); assert.equal(res.statusCode, code);
    if (code === 200) { assert.ok(Buffer.isBuffer(res.data)); assert.equal(res.headers['Cache-Control'], 'no-store'); }
  }
});
test('applicant lists are admin only', async () => {
  const f = fixture(), res = f.response(); await f.handlers.list(f.req, res); assert.equal(res.statusCode, 403);
});
