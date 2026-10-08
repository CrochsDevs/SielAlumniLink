import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { MongoClient, ObjectId } from 'mongodb';
import express from 'express';
import cookieParser from 'cookie-parser';
import { buildPeoplePipeline, buildPostsPipeline, parseSearch, escapeRegex } from './search.query.js';
import { createSearchHandler } from './search.controllers.js';
import searchRoutes from './search.routes.js';
import { ensureSearchIndexes } from './search.indexes.js';
import { nameGrams, queryGrams } from './search.names.js';
import { createConnection } from '../connections/connections.controllers.js';
import AuthModel from '../auth/auth.models.js';

// Only this uniquely named temporary database is ever written or dropped.
const dbName = `alumnilink_search_test_${process.pid}_${Date.now()}`;
const mongo = new MongoClient(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
const db = mongo.db(dbName);
const viewer = { _id: new ObjectId(), role: 'student' };
const alumniId = new ObjectId();
const studentId = new ObjectId();
let server;
let baseUrl;

before(async () => {
  await mongo.connect();
  await ensureSearchIndexes(db);
  await db.collection('auth').insertMany([
    { _id: alumniId, role: 'alumni', password: 'NEVER_RETURN', resetOTP: 'SECRET', email: 'private@example.test' },
    { _id: studentId, role: 'student' },
    { _id: viewer._id, role: 'student' },
  ]);
  await db.collection('users').insertMany([
    { authId: alumniId, name: 'Lester Rodriguez', role: 'student', program: 'Computer Science', batch: '2020', updatedAt: new Date('2025-01-01'), email: 'private@example.test', bio: 'PRIVATE', employmentHistory: [{ current: true, position: 'Engineer', company: 'Example' }] },
    { authId: String(alumniId), name: 'Lester Rodriguez', updatedAt: new Date('2024-01-01') },
    { authId: String(studentId), name: 'Lester Rodriguez Jr', updatedAt: new Date('2026-01-01') },
    { authId: viewer._id, name: 'Lester Tester', updatedAt: new Date('2026-02-01') },
    { authId: new ObjectId(), name: 'Lester Deleted Account' },
  ]);
  await db.collection('activity_logs').insertMany([
    { authId: String(alumniId), action: 'login', createdAt: new Date('2026-10-08') },
    { authId: String(studentId), action: 'login', createdAt: new Date('2026-01-01') },
  ]);
  await db.collection('career_posts').insertMany([
    { authorAuthId: String(alumniId), authorName: 'Old author name', title: 'A guide to engineering', body: 'Career advice', isActive: true, createdAt: new Date('2025-01-01'), savedBy: [String(viewer._id)], authorEmail: 'PRIVATE' },
    { authorAuthId: String(studentId), authorName: 'Stale name', title: 'Lester Rodriguez', body: 'Complete phrase', tags: ['career'], isActive: true, createdAt: new Date('2026-01-01') },
    { authorAuthId: String(viewer._id), authorName: 'Lester Tester', title: 'Rodriguez tips', body: 'Single keyword', isActive: true, createdAt: new Date('2026-10-01') },
    { authorAuthId: String(alumniId), title: 'Hidden guide', body: 'Lester Rodriguez', isActive: false },
  ]);
  await ensureSearchIndexes(db);
  const app = express();
  app.use(cookieParser());
  app.use('/protected', searchRoutes);
  app.get('/test', (req, res, next) => { req.user = viewer; next(); }, createSearchHandler(db));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (dbName.startsWith('alumnilink_search_test_')) await db.dropDatabase();
  await mongo.close();
});

const people = async (input, person = viewer) => (await db.collection('users').aggregate(buildPeoplePipeline(parseSearch(input), person)).toArray())[0];
const posts = async input => (await db.collection('career_posts').aggregate(buildPostsPipeline(parseSearch(input))).toArray())[0];

test('validates length, structured input, categories and bounded integer pages', () => {
  for (const input of [{ q: { $ne: '' } }, { q: ['Lester'] }, { q: 'x'.repeat(121) }, { page: -1 }, { page: '1.5' }, { page: 1001 }, { category: 'auth' }, { sort: '$where' }]) assert.throws(() => parseSearch(input));
  assert.equal(parseSearch({ q: '  Lester   Rodriguez  ' }).q, 'Lester Rodriguez');
  assert.equal(parseSearch({ q: 'Lester' }, true).limit, 6);
  assert.equal(new RegExp(escapeRegex('.*[a]+?')).test('.*[a]+?'), true);
});

test('name fragments support short and Unicode substrings and use the database index', async () => {
  const grams = nameGrams('José Rodriguez');
  for (const query of ['j', 'jo', 'José', 'rod', 'riguez']) {
    assert.ok(queryGrams(query).every(gram => grams.includes(gram)));
  }
  const plan = await db.collection('users').find(buildPeoplePipeline(parseSearch({ q: 'Lester' }), viewer)[0].$match).explain('queryPlanner');
  assert.ok(JSON.stringify(plan.queryPlanner.winningPlan).includes('searchNameGrams_1'));
});

test('finds partial, full, case-insensitive and reordered names; exact match first', async () => {
  const result = await people({ q: 'lEsTeR roDRigueZ' });
  assert.equal(result.count[0].total, 2);
  assert.equal(result.items[0].name, 'Lester Rodriguez');
  assert.equal(result.items[0].role, 'alumni');
  assert.equal(result.items[0].position, 'Engineer');
  assert.equal((await people({ q: 'Rodriguez Lester' })).count[0].total, 2);
  assert.equal((await people({ q: 'lest' })).count[0].total, 3);
  assert.equal((await people({ q: '.*' })).items.length, 0);
});

test('deduplicates accounts and excludes credentials, contact fields and orphan profiles', async () => {
  const result = await people({ q: 'Lester' });
  assert.equal(new Set(result.items.map(item => item.authId)).size, 3);
  for (const person of result.items) {
    for (const key of ['password', 'resetOTP', 'email', 'bio', 'account', 'activity', 'lastActive']) assert.equal(key in person, false);
  }
});

test('role filters and recently active sorting use authoritative database records', async () => {
  assert.equal((await people({ q: 'Lester', category: 'alumni' })).count[0].total, 1);
  assert.equal((await people({ q: 'Lester', category: 'students' })).count[0].total, 2);
  assert.equal((await people({ q: 'Lester', sort: 'active' })).items[0].authId, String(alumniId));
});

test('connection state respects role, self, and both relationship directions', async () => {
  let result = await people({ q: 'Lester' });
  assert.equal(result.items.find(person => person.authId === String(alumniId)).canConnect, true);
  assert.ok(result.items.filter(person => person.role === 'student').every(person => !person.canConnect));
  const connection = await db.collection('connections').insertOne({ requesterAuthId: alumniId, recipientAuthId: viewer._id, status: 'pending' });
  result = await people({ q: 'Lester' });
  assert.equal(result.items.find(person => person.authId === String(alumniId)).connectionStatus, 'pending');
  await db.collection('connections').updateOne({ _id: connection.insertedId }, { $set: { status: 'accepted' } });
  result = await people({ q: 'Lester' });
  assert.equal(result.items.find(person => person.authId === String(alumniId)).connectionStatus, 'accepted');
  assert.equal(result.items.find(person => person.authId === String(alumniId)).canConnect, false);
});

test('ranks posts by current author name, phrase, keywords and date; excludes inactive posts', async () => {
  const result = await posts({ q: 'Lester Rodriguez' });
  assert.equal(result.count[0].total, 3);
  assert.equal(result.items[0].title, 'A guide to engineering');
  assert.equal(result.items[0].authorName, 'Lester Rodriguez');
  assert.equal(result.items[0].savesCount, 1);
  assert.equal(result.items[1].title, 'Lester Rodriguez');
  assert.equal((await posts({ q: 'Lester Rodriguez', sort: 'newest' })).items[0].title, 'Rodriguez tips');
  for (const post of result.items) for (const key of ['savedBy', 'authorEmail', 'account', 'profile']) assert.equal(key in post, false);
});

test('server pagination has stable non-overlapping pages and accurate counts', async () => {
  const ids = Array.from({ length: 14 }, () => new ObjectId());
  await db.collection('auth').insertMany(ids.map(_id => ({ _id, role: 'alumni' })));
  await db.collection('users').insertMany(ids.map((authId, index) => ({ authId, name: `Pagination Person ${String(index).padStart(2, '0')}` })));
  await ensureSearchIndexes(db);
  const first = await people({ q: 'Pagination' });
  const second = await people({ q: 'Pagination', page: 2 });
  assert.equal(first.count[0].total, 14);
  assert.equal(first.items.length, 10);
  assert.equal(second.items.length, 4);
  assert.equal(new Set([...first.items, ...second.items].map(item => String(item._id))).size, 14);
});

test('HTTP denies guests and invalid cookies, validates input, and handles empty/category searches', async () => {
  assert.equal((await fetch(`${baseUrl}/protected/all?q=Lester`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/protected/suggestions?q=Lester`, { headers: { cookie: 'token=invalid' } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/test?q[x]=bad`)).status, 200); // Express simple parser treats this as an unrelated key.
  assert.equal((await fetch(`${baseUrl}/test?q=Lester&q=Rodriguez`)).status, 400);
  const empty = await (await fetch(`${baseUrl}/test?q=`)).json();
  assert.equal(empty.data.people.total, 0);
  const result = await (await fetch(`${baseUrl}/test?q=Lester&category=posts`)).json();
  assert.equal(result.data.people.total, 0);
  assert.equal(result.data.posts.total, 3);
});

test('connection API rejects student-to-student requests before any database write', async () => {
  const original = AuthModel.findById;
  AuthModel.findById = async () => ({ _id: studentId, role: 'student' });
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await createConnection({ body: { recipientAuthId: String(studentId) }, user: viewer }, res);
    assert.equal(res.code, 403);
    await createConnection({ body: { recipientAuthId: { $ne: null }, email: 'valid@example.test' }, user: viewer }, res);
    assert.equal(res.code, 400);
  } finally { AuthModel.findById = original; }
});
