import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { startGmailOAuthSetup } from './gmail-oauth-setup.js';
import { GMAIL_SEND_SCOPE, GOOGLE_TOKEN_URL } from './gmail-api.js';

const options = { clientId: 'fixture.apps.googleusercontent.com', clientSecret: 'PRIVATE_CLIENT_SECRET', sender: 'sender@example.test', port: 0 };

test('local setup validates state/PKCE, saves tokens privately, and preserves existing environment', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gmail-setup-'));
  const envFile = path.join(directory, '.env');
  await writeFile(envFile, 'MONGO_URI="PRIVATE_DATABASE"\nEMAIL_PROVIDER=smtp\nEMAIL_PROVIDER=smtp\n');
  let calls = 0, setup;
  try {
    setup = await startGmailOAuthSetup({ ...options, envFile, fetchImpl: async (url, config) => {
      calls++;
      assert.equal(url, GOOGLE_TOKEN_URL);
      assert.equal(config.redirect, 'error');
      const form = new URLSearchParams(config.body);
      assert.equal(form.get('grant_type'), 'authorization_code');
      assert.equal(form.get('client_secret'), 'PRIVATE_CLIENT_SECRET');
      assert.equal(form.get('redirect_uri'), setup.redirectUri);
      assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'), new URL(setup.authorizationUrl).searchParams.get('code_challenge'));
      return { ok: true, json: async () => ({ refresh_token: 'PRIVATE_REFRESH_TOKEN', scope: GMAIL_SEND_SCOPE }) };
    } });
    const authorization = new URL(setup.authorizationUrl);
    assert.equal(authorization.origin, 'https://accounts.google.com');
    assert.equal(authorization.searchParams.get('scope'), GMAIL_SEND_SCOPE);
    assert.equal(authorization.searchParams.get('access_type'), 'offline');
    assert.equal(authorization.searchParams.get('prompt'), 'consent');
    assert.equal(authorization.searchParams.has('client_secret'), false);
    const invalid = await fetch(setup.redirectUri + '?state=wrong&code=PRIVATE_CODE');
    assert.equal(invalid.status, 400);
    assert.equal(calls, 0);
    const callback = new URL(setup.redirectUri);
    callback.search = new URLSearchParams({ state: authorization.searchParams.get('state'), code: 'PRIVATE_CODE' });
    const response = await fetch(callback);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.doesNotMatch(await response.text(), /PRIVATE_|sender@example/);
    assert.deepEqual(await setup.done, { success: true });
    const saved = await readFile(envFile, 'utf8');
    const parsed = dotenv.parse(saved);
    assert.equal(parsed.MONGO_URI, 'PRIVATE_DATABASE');
    assert.equal(parsed.EMAIL_PROVIDER, 'gmail_api');
    assert.equal(parsed.GOOGLE_REFRESH_TOKEN, 'PRIVATE_REFRESH_TOKEN');
    assert.equal(saved.match(/^EMAIL_PROVIDER=/gm).length, 1);
    assert.equal(calls, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('declined consent or missing send permission never overwrites environment', async () => {
  for (const kind of ['declined', 'missing-scope']) {
    const directory = await mkdtemp(path.join(tmpdir(), 'gmail-setup-'));
    const envFile = path.join(directory, '.env');
    await writeFile(envFile, 'EMAIL_PROVIDER=smtp\n');
    try {
      const setup = await startGmailOAuthSetup({ ...options, envFile, fetchImpl: async () => ({ ok: true,
        json: async () => ({ refresh_token: 'PRIVATE_REFRESH_TOKEN', scope: 'openid' }) }) });
      const rejected = assert.rejects(setup.done, /Google/);
      const callback = new URL(setup.redirectUri);
      callback.searchParams.set('state', new URL(setup.authorizationUrl).searchParams.get('state'));
      callback.searchParams.set(kind === 'declined' ? 'error' : 'code', kind === 'declined' ? 'access_denied' : 'PRIVATE_CODE');
      assert.equal((await fetch(callback)).status, 400);
      await rejected;
      assert.equal(await readFile(envFile, 'utf8'), 'EMAIL_PROVIDER=smtp\n');
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
});
