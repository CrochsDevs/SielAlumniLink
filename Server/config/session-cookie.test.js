import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionCookieOptions, protectSessionOrigin } from './session-cookie.js';

function environment(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

test('production sessions use secure cross-site cookies and clear the same cookie scope', t => {
  environment(t, { NODE_ENV: 'production', COOKIE_SAME_SITE: undefined });
  const options = sessionCookieOptions();
  assert.deepEqual(options, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 604800000 });
  const { maxAge: _maxAge, ...scope } = options;
  assert.deepEqual(sessionCookieOptions({ persistent: false }), scope);
  assert.equal(Object.hasOwn(options, 'domain'), false);
});

test('local HTTP development keeps strict cookies without requiring HTTPS', t => {
  environment(t, { NODE_ENV: 'development', COOKIE_SAME_SITE: undefined });
  assert.equal(sessionCookieOptions().sameSite, 'strict');
  assert.equal(sessionCookieOptions().secure, false);
});

test('explicit cookie configuration requires valid values and secures SameSite=None', t => {
  environment(t, { NODE_ENV: 'development', COOKIE_SAME_SITE: 'none' });
  assert.equal(sessionCookieOptions().secure, true);
  process.env.COOKIE_SAME_SITE = 'lax';
  assert.equal(sessionCookieOptions().sameSite, 'lax');
  process.env.COOKIE_SAME_SITE = 'invalid';
  assert.throws(() => sessionCookieOptions(), /COOKIE_SAME_SITE/);
});

test('cross-site sessions accept the configured frontend and reject foreign mutation origins', t => {
  environment(t, { NODE_ENV: 'production', COOKIE_SAME_SITE: 'none' });
  const guard = protectSessionOrigin(['https://sielalumnilink.onrender.com']);
  const run = (method, headers = {}, cookies = {}) => {
    let accepted = false;
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    guard({ method, headers, cookies }, res, () => { accepted = true; });
    return { accepted, status: res.statusCode };
  };
  assert.equal(run('POST', { origin: 'https://sielalumnilink.onrender.com' }, { token: 'session' }).accepted, true);
  assert.equal(run('POST', { referer: 'https://sielalumnilink.onrender.com/login' }, { token: 'session' }).accepted, true);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const origin of ['https://untrusted.example', 'null', 'https://sielalumnilink.onrender.com.untrusted.example']) {
      assert.deepEqual(run(method, { origin }), { accepted: false, status: 403 });
    }
    assert.equal(run(method, {}, { token: 'session' }).status, 403);
    assert.equal(run(method, { 'sec-fetch-site': 'cross-site' }).status, 403);
  }
  assert.equal(run('OPTIONS', { origin: 'https://untrusted.example' }).accepted, true);
  assert.equal(run('GET').accepted, true);
  assert.equal(run('POST').accepted, true); // Non-browser login clients without cookies.
});
