import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { logAuthRequests } from './auth-request-log.js';

test('auth diagnostics correlate requests without logging credentials or identifiers', async () => {
  const lines = [];
  const app = express();
  app.use(logAuthRequests({ log: line => lines.push(JSON.parse(line)) }));
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
    assert.equal(lines.length, 2);
    assert.equal(lines[0].requestId, response.headers.get('x-request-id'));
    assert.equal(lines[0].requestId, lines[1].requestId);
    assert.equal(lines[0].operation, 'magic_link_send');
    assert.equal(lines[0].forwardedAddressPresent, true);
    assert.equal(lines[0].proxyConfigured, false);
    assert.equal(lines[1].phase, 'finished');
    assert.equal(lines[1].status, 429);
    assert.ok(lines[1].durationMs >= 0);
    await fetch(origin + '/api/auth/magic-link/verify?token=PRIVATE_QUERY_TOKEN');
    assert.equal(lines.length, 4);
    assert.equal(lines[2].operation, 'magic_link_verify');
    await fetch(origin + '/api/auth/me');
    assert.equal(lines.length, 4, 'background session lookups do not flood logs');
    assert.doesNotMatch(JSON.stringify(lines), /PRIVATE_|private@example|192\.0\.2\.1|\?token/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
