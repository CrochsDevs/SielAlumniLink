import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { serveClient } from './client-app.js';

test('combined hosting preserves API routes, SPA deep links and real asset 404s', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'alumnilink-client-'));
  mkdirSync(path.join(directory, 'assets'));
  writeFileSync(path.join(directory, 'index.html'), '<html>client fixture</html>');
  writeFileSync(path.join(directory, 'assets/app-hash.js'), 'window.fixture = true;');
  const app = express();
  app.get('/api/auth/me', (_req, res) => res.json({ success: true, data: null }));
  serveClient(app, directory);
  app.use((_req, res) => res.status(404).json({ success: false }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ['/', '/login', '/alumni', '/student/profile/person']) {
      const response = await fetch(base + route, { headers: { Accept: 'text/html' } });
      assert.equal(response.status, 200, route);
      assert.match(await response.text(), /client fixture/);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    const session = await fetch(base + '/api/auth/me');
    assert.deepEqual(await session.json(), { success: true, data: null });
    const asset = await fetch(base + '/assets/app-hash.js');
    assert.match(asset.headers.get('cache-control'), /immutable/);
    for (const route of ['/api/unknown', '/socket.io/unknown', '/assets/missing.js', '/missing.png']) {
      assert.equal((await fetch(base + route, { headers: { Accept: 'text/html' } })).status, 404, route);
    }
    assert.equal((await fetch(base + '/login', { method: 'POST' })).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('combined hosting refuses to start without a client build', () => {
  assert.throws(() => serveClient(express(), path.join(tmpdir(), 'missing-alumnilink-build', 'dist')), /Client build missing/);
});
