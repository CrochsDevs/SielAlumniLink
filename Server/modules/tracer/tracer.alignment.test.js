import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAlignmentReport, validateTracerResponse } from './tracer.alignment.js';

const now = new Date('2026-10-14T08:00:00Z');
const response = { batch: '2022', program: 'Bachelor of Science in Information Technology', status: 'Employed', company: 'Example', position: 'Developer', employmentDate: '2025-01', jobAlignment: 'directly_related', alignmentExplanation: 'I build web applications using programming and database skills.' };
const observation = (year, alignment, overrides = {}) => ({ ...response, recordedAt: `${year}-10-14T08:00:00Z`, jobAlignment: alignment, ...overrides });
const graduate = (id, observations) => ({ _id: id, authId: id, email: `${id}@example.test`, responseHistory: observations });

test('working graduates provide job details, an explicit alignment answer and duties', () => {
  assert.equal(validateTracerResponse(response, now).jobAlignment, 'directly_related');
  for (const changed of [{ company: '' }, { position: '' }, { jobAlignment: '' }, { jobAlignment: 'yes' }, { alignmentExplanation: '' }, { batch: '2027' }, { batch: 'abcd' }, { program: {} }, { employmentDate: '2026-13' }, { employmentDate: '2027-01' }, { alignmentExplanation: 'x'.repeat(1001) }]) {
    assert.throws(() => validateTracerResponse({ ...response, ...changed }, now), error => error.status === 400);
  }
});

test('all courses and self-employed roles can report alignment; non-working answers clear stale work alignment', () => {
  for (const program of ['BS Nursing', 'BS Agriculture', 'Bachelor of Education', 'Another graduation program']) {
    assert.equal(validateTracerResponse({ ...response, program, status: 'Self-employed' }, now).program, program);
  }
  for (const status of ['Unemployed', 'Studying']) {
    const data = validateTracerResponse({ ...response, status }, now);
    assert.equal(data.jobAlignment, '');
    assert.equal(data.alignmentExplanation, '');
  }
});

test('3–5-year report uses observation year, includes boundaries, and counts the latest observation per graduate once', () => {
  const docs = [graduate('a', [observation(2024, 'unrelated'), observation(2025, 'partly_related'), observation(2027, 'directly_related'), observation(2028, 'unrelated')]), graduate('b', [observation(2026, 'unrelated')])];
  const report = buildAlignmentReport(docs);
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows.find(row => row.authId === 'a').yearsAfterGraduation, 5);
  assert.equal(report.rows.find(row => row.authId === 'a').alignment, 'directly_related');
  assert.equal(report.summary.directAlignmentRate, 50);
  assert.equal(buildAlignmentReport(docs, { followUp: '6+' }).rows[0].alignment, 'unrelated');
  assert.equal(buildAlignmentReport(docs, { followUp: '0-2' }).rows[0].yearsAfterGraduation, 2);
});

test('old early-career responses never become 3–5-year evidence just because time passes', () => {
  const doc = { ...response, authId: 'a', batch: '2020', updatedAt: '2021-06-01', jobAlignment: 'directly_related' };
  assert.equal(buildAlignmentReport([doc]).rows.length, 0);
  assert.equal(buildAlignmentReport([doc], { followUp: 'all' }).rows[0].yearsAfterGraduation, 1);
});

test('rates exclude unsure, unanswered, and non-working responses without inferring alignment from job titles', () => {
  const docs = [
    graduate('direct', [observation(2026, 'directly_related')]), graduate('partial', [observation(2026, 'partly_related')]), graduate('unrelated', [observation(2026, 'unrelated')]),
    graduate('unsure', [observation(2026, 'unsure')]), graduate('legacy', [observation(2026, undefined)]), graduate('studying', [observation(2026, 'directly_related', { status: 'Studying' })]),
  ];
  const { summary, rows } = buildAlignmentReport(docs);
  assert.equal(summary.assessed, 3);
  assert.equal(summary.directAlignmentRate, 33.3);
  assert.equal(summary.relatedWorkRate, 66.7);
  assert.equal(summary.unsure, 1);
  assert.equal(summary.notReported, 1);
  assert.equal(summary.notWorking, 1);
  assert.equal(rows.find(row => row.authId === 'legacy').alignment, 'not_reported');
  assert.equal(buildAlignmentReport([]).summary.directAlignmentRate, null);
});

test('program, graduation batch, alignment and search filters match both details and summaries', () => {
  const docs = [graduate('it', [observation(2026, 'directly_related')]), graduate('agri', [observation(2026, 'partly_related', { program: 'BS Agriculture', batch: '2021', company: 'Farm' })])];
  const report = buildAlignmentReport(docs, { program: 'BS Agriculture', batch: '2021', alignment: 'partly_related', query: 'farm' });
  assert.equal(report.rows.length, 1);
  assert.equal(report.programs[0].program, 'BS Agriculture');
  assert.equal(report.summary.relatedWorkRate, 100);
  assert.equal(report.options.programs.length, 2);
  assert.throws(() => buildAlignmentReport(docs, { followUp: 'invalid' }), error => error.status === 400);
  assert.throws(() => buildAlignmentReport(docs, { program: {} }), error => error.status === 400);
});

process.env.MONGO_URI ||= 'mongodb://127.0.0.1:27017';
const { default: TracerModel } = await import('./tracer.models.js');
const { submitResponse, getAlignmentReport } = await import('./tracer.controllers.js');
const { default: routes } = await import('./tracer.routes.js');
const res = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('alignment reports require an authenticated administrator', () => {
  assert.equal(routes.stack[0].handle.name, 'protect');
  const guard = routes.stack.find(layer => layer.route?.path === '/alignment').route.stack[0].handle;
  for (const role of ['student', 'alumni', 'admin']) {
    let allowed = false;
    const output = res(); guard({ user: { role } }, output, () => { allowed = true; });
    assert.equal(allowed, role === 'admin');
  }
});

test('submissions persist alignment against the authenticated account and reject missing answers', async t => {
  t.mock.method(TracerModel, 'findByAuthId', async () => null);
  const save = t.mock.method(TracerModel, 'upsertByAuthId', async (authId, data) => ({ authId, ...data }));
  let output = res();
  await submitResponse({ user: { _id: 'owner', email: 'owner@example.test' }, body: { ...response, authId: 'other' } }, output);
  assert.equal(output.statusCode, 200);
  assert.equal(output.body.data.authId, 'owner');
  assert.equal(output.body.data.jobAlignment, 'directly_related');
  assert.equal(output.body.data.alignmentExplanation, response.alignmentExplanation);
  output = res(); await submitResponse({ user: { _id: 'owner' }, body: { ...response, jobAlignment: undefined } }, output);
  assert.equal(output.statusCode, 400);
  assert.equal(save.mock.callCount(), 1);
});

test('admin report uses alumni-only observations and returns period metadata', async t => {
  t.mock.method(TracerModel, 'findAlumniResponses', async () => [graduate('a', [observation(2026, 'directly_related')])]);
  const output = res(); await getAlignmentReport({ query: {} }, output);
  assert.equal(output.statusCode, 200);
  assert.equal(output.body.data.followUp, '3-5');
  assert.equal(output.body.data.summary.directAlignmentRate, 100);
});
