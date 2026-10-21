import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationHandlers, MAX_RESUME_BYTES } from './job-applications.controllers.js';

function fixture() {
  const records = [];
  const handlers = createApplicationHandlers({
    jobs: { findById: async id => id === 'open' ? { _id: 'open', title: 'Developer', company: 'Example', isActive: true } : { isActive: false } },
    applications: {
      create: async data => { if (records.length) throw Object.assign(new Error('Duplicate'), { code: 11000 }); records.push(data); const { resumeData, coverNoteData, ...summary } = data; return summary; },
      findMine: async id => records.filter(record => record.applicantAuthId === id).map(({ resumeData, coverNoteData, ...summary }) => summary),
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


test('optional PDF cover note persists separately from the resume without exposing binary in summaries', async () => {
  const f = fixture(), res = f.response();
  const coverNote = { originalname: 'cover-note.PDF', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nCover note') };
  await f.handlers.submit({ ...f.req, file: undefined, body: { ...f.req.body, note: '' }, files: { resume: [f.req.file], coverNote: [coverNote] } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(f.records[0].coverNoteName, 'cover-note.PDF');
  assert.equal(f.records[0].coverNoteData.toString(), '%PDF-1.7\nCover note');
  assert.equal(res.body.data.coverNoteData, undefined);
  assert.equal(res.body.data.resumeData, undefined);
  const mine = f.response(); await f.handlers.mine(f.req, mine);
  assert.equal(mine.body.data[0].coverNoteData, undefined);
});

test('cover-note uploads reject non-PDF, disguised, oversized files and ambiguous text plus PDF', async () => {
  for (const coverNote of [
    { originalname: 'cover.docx', buffer: Buffer.from('%PDF-1.7') },
    { originalname: 'cover.pdf', buffer: Buffer.from('not a PDF') },
    { originalname: 'cover.pdf', mimetype: 'text/plain', buffer: Buffer.from('%PDF-1.7') },
    { originalname: 'cover.pdf', buffer: Buffer.alloc(MAX_RESUME_BYTES + 1) },
  ]) {
    const f = fixture(), res = f.response();
    await f.handlers.submit({ ...f.req, body: { ...f.req.body, note: '' }, files: { resume: [f.req.file], coverNote: [coverNote] } }, res);
    assert.equal(res.statusCode, 400); assert.equal(f.records.length, 0);
  }
  const f = fixture(), res = f.response();
  await f.handlers.submit({ ...f.req, files: { resume: [f.req.file], coverNote: [f.req.file] } }, res);
  assert.equal(res.statusCode, 400); assert.equal(f.records.length, 0);
});

test('PDF cover-note downloads are limited to the applicant and admin; old applications return 404', async () => {
  const f = fixture();
  await f.handlers.submit({ ...f.req, body: { ...f.req.body, note: '' }, files: { resume: [f.req.file], coverNote: [{ ...f.req.file, originalname: 'cover.pdf' }] } }, f.response());
  for (const [user, code] of [[{ _id: 'other', role: 'alumni' }, 403], [f.req.user, 200], [{ _id: 'admin', role: 'admin' }, 200]]) {
    const res = f.response(); await f.handlers.coverNote({ ...f.req, user }, res);
    assert.equal(res.statusCode, code);
    if (code === 200) {
      assert.equal(res.data.toString(), '%PDF-1.7\nResume');
      assert.equal(res.headers['Content-Type'], 'application/pdf');
      assert.equal(res.headers['Content-Disposition'], 'attachment; filename="cover.pdf"');
      assert.equal(res.headers['Cache-Control'], 'no-store');
    }
  }
  const old = fixture(); await old.handlers.submit(old.req, old.response());
  const missing = old.response(); await old.handlers.coverNote(old.req, missing); assert.equal(missing.statusCode, 404);
});


test('optional contact number is saved and invalid numbers are rejected before storing applications', async () => {
  for (const phone of ['', '0917 123 4567', '+63 (917) 123-4567']) {
    const f = fixture(), res = f.response();
    await f.handlers.submit({ ...f.req, body: { ...f.req.body, phone } }, res);
    assert.equal(res.statusCode, 201); assert.equal(f.records[0].phone, phone);
  }
  for (const phone of ['abc', '123', '+1234567890123456', '0917<script>', '1234567;ext=12']) {
    const f = fixture(), res = f.response();
    await f.handlers.submit({ ...f.req, body: { ...f.req.body, phone } }, res);
    assert.equal(res.statusCode, 400); assert.equal(f.records.length, 0);
  }
});

test('admin contact actions use the applicant account email, separate from their application contact email', async () => {
  let lookups = 0;
  const handlers = createApplicationHandlers({ jobs: {}, applications: { findByJob: async () => [{ _id: 'app', applicantAuthId: 'member', email: 'contact@example.test' }] }, accounts: { findById: async id => { assert.equal(id, 'member'); lookups++; return { email: 'account@example.test', password: 'private', otp: 'private' }; } } });
  const f = fixture();
  for (const role of ['student', 'alumni']) {
    const res = f.response(); await handlers.list({ user: { role }, params: { id: 'job' } }, res); assert.equal(res.statusCode, 403);
  }
  assert.equal(lookups, 0);
  const res = f.response(); await handlers.list({ user: { role: 'admin' }, params: { id: 'job' } }, res);
  assert.deepEqual(res.body.data[0], { _id: 'app', applicantAuthId: 'member', email: 'contact@example.test', messageEmail: 'account@example.test' });
});

test('deleted applicant accounts retain the submitted contact email with messaging unavailable', async () => {
  const handlers = createApplicationHandlers({ jobs: {}, applications: { findByJob: async () => [{ applicantAuthId: 'deleted', email: 'contact@example.test' }] }, accounts: { findById: async () => null } });
  const f = fixture(), res = f.response(); await handlers.list({ user: { role: 'admin' }, params: { id: 'job' } }, res);
  assert.equal(res.body.data[0].email, 'contact@example.test'); assert.equal(res.body.data[0].messageEmail, null);
});
