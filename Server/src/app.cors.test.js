import assert from 'node:assert/strict';
import test from 'node:test';
import app from './app.js';
import { frontendOrigins } from '../config/cors.js';
import { Collection } from 'mongodb';

test('browser preflight allows credentialed group-name PATCH requests', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const origin of new Set(frontendOrigins)) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/conversations/aaaaaaaaaaaaaaaaaaaaaaaa/name`, {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'PATCH',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      assert.ok(response.headers.get('access-control-allow-methods').split(',').includes('PATCH'));
      assert.match(response.headers.get('access-control-allow-headers'), /content-type/i);
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('auth rate-limit responses preserve credentialed CORS and expose Retry-After', async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'cors-rate-limit-fixture-only';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  t.mock.method(Collection.prototype, 'findOneAndUpdate', async () => ({ count: 100000 }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const origin of new Set(frontendOrigins)) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/magic-link/send`, {
        method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'fixture@example.test' }),
      });
      assert.equal(response.status, 429);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      assert.match(response.headers.get('access-control-expose-headers'), /Retry-After/i);
      assert.ok(Number(response.headers.get('retry-after')) > 0);
      assert.ok(response.headers.get('x-request-id'));
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
