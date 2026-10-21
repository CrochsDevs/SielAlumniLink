import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { Collection } from 'mongodb';
import { createApplicationHandlers, MAX_RESUME_BYTES } from './job-applications.controllers.js';

process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017';
const { default: routes } = await import('./jobs.routes.js');
const { default: model } = await import('./job-applications.models.js');

test('multipart uploads accept resume plus PDF cover note and reject extra/disguised/oversized attachments', async t => {
  const records = [];
  const handlers = createApplicationHandlers({ jobs: { findById: async () => ({ _id: 'job', isActive: true }) }, applications: { create: async doc => { records.push(doc); const { resumeData, coverNoteData, ...summary } = doc; return summary; } } });
  const upload = routes.stack.find(layer => layer.route?.path === '/:id/apply').route.stack[1].handle;
  const app = express();
  app.post('/:id/apply', (req, _res, next) => { req.user = { _id: 'member', role: 'alumni' }; next(); }, upload, handlers.submit);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const submit = async attachments => {
    const body = new FormData(); body.set('name', 'Member'); body.set('email', 'member@example.test'); body.set('note', ''); body.set('phone', '+63 917 123 4567');
    for (const [field, name, content, type = 'application/pdf'] of attachments) body.append(field, new Blob([content], { type }), name);
    return fetch(`http://127.0.0.1:${server.address().port}/job/apply`, { method: 'POST', body });
  };
  const resume = ['resume', 'resume.pdf', '%PDF-1.7 Resume'];
  const cover = ['coverNote', 'cover.pdf', '%PDF-1.7 Cover note'];
  const valid = await submit([resume, cover]); assert.equal(valid.status, 201);
  const data = (await valid.json()).data;
  assert.equal(data.phone, '+63 917 123 4567'); assert.equal(data.coverNoteName, 'cover.pdf'); assert.equal(data.coverNoteData, undefined); assert.equal(data.resumeData, undefined);
  assert.equal(records[0].coverNoteData.toString(), cover[2]);
  for (const attachments of [[resume, ['coverNote', 'cover.pdf', 'not a pdf']], [resume, ['coverNote', 'cover.docx', '%PDF-1.7']], [resume, cover, cover], [resume, ['unknown', 'cover.pdf', '%PDF-1.7']], [cover], [resume, ['coverNote', 'cover.pdf', Buffer.alloc(MAX_RESUME_BYTES + 1)]]]) {
    const result = await submit(attachments); assert.equal(result.status, 400); await result.text();
  }
  assert.equal(records.length, 1);
  assert.equal((await submit([resume])).status, 201);
});

test('application model excludes both document buffers from create and list responses', async t => {
  let stored;
  const projections = [];
  t.mock.method(Collection.prototype, 'insertOne', async function (doc) { assert.equal(this.collectionName, 'job_applications'); stored = doc; return { insertedId: doc._id }; });
  t.mock.method(Collection.prototype, 'find', function (_filter, options) { projections.push(options.projection); return { sort: () => ({ toArray: async () => [] }) }; });
  const summary = await model.create({ jobId: 'job', applicantAuthId: 'member', resumeName: 'resume.pdf', resumeData: Buffer.from('%PDF-1.7'), coverNoteName: 'cover.pdf', coverNoteData: Buffer.from('%PDF-1.7 Cover') });
  assert.ok(Buffer.isBuffer(stored.coverNoteData)); assert.ok(Buffer.isBuffer(stored.resumeData));
  assert.equal(summary.coverNoteData, undefined); assert.equal(summary.resumeData, undefined); assert.equal(summary.coverNoteName, 'cover.pdf');
  await model.findMine('member'); await model.findByJob('job');
  assert.deepEqual(projections, [{ resumeData: 0, coverNoteData: 0 }, { resumeData: 0, coverNoteData: 0 }]);
});
