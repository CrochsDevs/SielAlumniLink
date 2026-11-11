import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { logAuthRequests } from './auth-request-log.js';
import { logAccountAuth, authDeliveryContext } from '../modules/auth/auth-account-log.js';

test('auth diagnostics correlate requests without logging credentials or identifiers', async () => {
  const lines = [];
  const app = express();
  app.use(logAuthRequests({ log: line => lines.push(JSON.parse(line)) }));
  app.use(express.json());
  app.post('/api/auth/magic-link/send', (_req, res) => res.status(429).json({ success: false }));
  app.get('/api/auth/magic-link/verify', (_req, res) => res.json({ success: false }));
  app.get('/api/auth/me', (_req, res) => res.json({ success: true, data: null }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(origin + '/api/auth/magic-link/send?token=PRIVATE_QUERY_TOKEN', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.0.2.1',
        Cookie: 'token=PRIVATE_COOKIE', Authorization: 'Bearer PRIVATE_HEADER' },
      body: JSON.stringify({ email: 'private@example.test', password: 'PRIVATE_PASSWORD' }),
    });
    assert.equal(response.status, 429);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].requestId, response.headers.get('x-request-id'));
    assert.equal(lines[0].operation, 'magic_link_send');
    assert.equal(lines[0].maskedEmail, 'pr***@example.test');
    assert.equal(lines[0].identityType, 'submitted');
    assert.equal(lines[0].authId, undefined);
    assert.equal(lines[0].phase, 'finished');
    assert.equal(lines[0].status, 429);
    assert.ok(lines[0].durationMs >= 0);
    await fetch(origin + '/api/auth/magic-link/verify?token=PRIVATE_QUERY_TOKEN');
    assert.equal(lines.length, 2);
    assert.equal(lines[1].operation, 'magic_link_verify');
    assert.equal(lines[1].outcome, 'rejected', 'HTTP 200 with success=false must not appear as a successful action');
    await fetch(origin + '/api/auth/me');
    assert.equal(lines.length, 2, 'background session lookups do not flood logs');
    assert.doesNotMatch(JSON.stringify(lines), /PRIVATE_|private@example|192\.0\.2\.1|\?token/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('login, logout and recovery each emit a single complete event with verified or target identity', async () => {
  const lines = [], app = express();
  app.use(logAuthRequests({ log: line => lines.push(JSON.parse(line)) }));
  const user = { _id: 'fixture-account', email: 'private@example.test', password: 'PRIVATE_PASSWORD' };
  for (const [path, operation, outcome] of [['login', 'password_login', 'signed_in'], ['logout', 'logout', 'signed_out'],
    ['forgot-password', 'password_recovery', 'accepted_for_delivery']]) {
    app.post('/api/auth/' + path, (_req, res) => {
      logAccountAuth(res, { operation, outcome, user });
      if (operation === 'password_recovery') authDeliveryContext(res).onDelivery({ emailProvider: 'brevo', emailDelivery: 'accepted', providerStatus: 201 });
      res.json({ success: true });
    });
  }
  app.get('/api/auth/magic-link/verify', (_req, res) => res.destroy());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['login', 'logout', 'forgot-password']) await fetch(origin + '/api/auth/' + path, { method: 'POST' });
    assert.equal(lines.length, 3);
    assert.ok(lines.every(line => line.authId === user._id && line.maskedEmail === 'pr***@example.test'));
    assert.equal(lines[0].identityType, 'authenticated');
    assert.equal(lines[1].outcome, 'signed_out');
    assert.equal(lines[2].identityType, 'target_account');
    assert.equal(lines[2].emailDelivery, 'accepted');
    assert.equal(lines[2].providerStatus, 201);
    await assert.rejects(fetch(origin + '/api/auth/magic-link/verify?token=PRIVATE_TOKEN'));
    assert.equal(lines.length, 4);
    assert.equal(lines[3].phase, 'closed');
    assert.doesNotMatch(JSON.stringify(lines), /PRIVATE_|private@example/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
