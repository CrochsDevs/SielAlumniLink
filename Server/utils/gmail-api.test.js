import test from 'node:test';
import assert from 'node:assert/strict';
import MailComposer from 'nodemailer/lib/mail-composer';
import { createAuthEmailSender } from './auth-email-delivery.js';
import { GOOGLE_TOKEN_URL } from './gmail-api.js';

const env = { EMAIL_PROVIDER: 'gmail_api', EMAIL_USER: 'sender@example.test',
  GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'PRIVATE_CLIENT_SECRET',
  GOOGLE_REFRESH_TOKEN: 'PRIVATE_REFRESH_TOKEN' };
const message = { subject: 'Fixture sign-in', text: 'PRIVATE_LOGIN_TOKEN',
  html: '<img src="cid:clsu-logo@alumnilink">PRIVATE_LOGIN_TOKEN' };
const fixture = overrides => {
  const logs = [];
  const createTransport = options => {
    assert.equal(options.streamTransport, true, 'Gmail API must never use an SMTP transport');
    assert.equal(options.disableUrlAccess, true);
    assert.equal(options.disableFileAccess, true);
    return { sendMail: async data => ({ message: await new MailComposer({ ...data,
      disableFileAccess: true, disableUrlAccess: true }).compile().build() }), close() {} };
  };
  return { logs, send: createAuthEmailSender({ env, createTransport,
    readLogo: async () => Buffer.from('fixture-logo'),
    logger: { log: value => logs.push(value), error: value => logs.push(value) }, ...overrides }) };
};

test('Gmail uses OAuth refresh and HTTPS with correctly encoded MIME and inline logo', async () => {
  const calls = [];
  const { send, logs } = fixture({ fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'error');
    assert.equal(options.method, 'POST');
    if (url === GOOGLE_TOKEN_URL) {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('grant_type'), 'refresh_token');
      assert.equal(form.get('client_secret'), env.GOOGLE_CLIENT_SECRET);
      assert.equal(form.get('refresh_token'), env.GOOGLE_REFRESH_TOKEN);
      return { ok: true, json: async () => ({ access_token: 'PRIVATE_ACCESS_TOKEN', token_type: 'Bearer' }) };
    }
    assert.equal(url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    assert.equal(options.headers.Authorization, 'Bearer PRIVATE_ACCESS_TOKEN');
    const { raw } = JSON.parse(options.body);
    assert.match(raw, /^[A-Za-z0-9_-]+$/);
    const mime = Buffer.from(raw, 'base64url').toString();
    assert.match(mime, /From: SielAlumni <sender@example.test>/);
    assert.match(mime, /To: recipient@example.test/);
    assert.match(mime, /Subject: Fixture sign-in/);
    assert.match(mime, /PRIVATE_LOGIN_TOKEN/);
    assert.match(mime, /Content-ID: <clsu-logo@alumnilink>/);
    return { ok: true, json: async () => ({ id: 'gmail-fixture-id' }) };
  } });
  assert.deepEqual(await send('recipient@example.test', message), { success: true });
  assert.equal(calls.length, 2);
  assert.doesNotMatch(logs.join(''), /PRIVATE_|sender@example|recipient@example/);
});

test('Gmail OAuth rejection prevents sending and does not log Google error bodies', async () => {
  let calls = 0;
  const { send, logs } = fixture({ fetchImpl: async url => {
    calls++;
    assert.equal(url, GOOGLE_TOKEN_URL);
    return { ok: false, status: 400, body: { cancel: async () => {} },
      json: async () => ({ error: 'PRIVATE_GOOGLE_ERROR_BODY' }) };
  } });
  assert.deepEqual(await send('recipient@example.test', message), { success: false });
  assert.equal(calls, 1);
  assert.match(logs.join(''), /EAUTH/);
  assert.doesNotMatch(logs.join(''), /PRIVATE_|recipient@example/);
});

test('Gmail refuses incomplete configuration before composition or network requests', async () => {
  for (const key of ['EMAIL_USER', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']) {
    let calls = 0;
    const { send, logs } = fixture({ env: { ...env, [key]: '' },
      createTransport: () => { calls++; }, fetchImpl: async () => { calls++; } });
    assert.deepEqual(await send('recipient@example.test', message), { success: false });
    assert.equal(calls, 0);
    assert.match(logs.join(''), /ECONFIG/);
  }
});

test('Gmail quota/permission failures are categorized without retrying the message', async () => {
  for (const [status, code] of [[401, 'EAUTH'], [403, 'EPERMISSION'], [429, 'EQUOTA'], [503, 'EPROVIDER']]) {
    let calls = 0;
    const { send, logs } = fixture({ fetchImpl: async url => {
      calls++;
      return url === GOOGLE_TOKEN_URL
        ? { ok: true, json: async () => ({ access_token: 'PRIVATE_ACCESS_TOKEN', token_type: 'Bearer' }) }
        : { ok: false, status, body: { cancel: async () => {} } };
    } });
    assert.deepEqual(await send('recipient@example.test', message), { success: false });
    assert.equal(calls, 2);
    assert.match(logs.join(''), new RegExp(code));
  }
});

test('Gmail aborts a stalled HTTPS request within the shared delivery deadline', async () => {
  let signal;
  const { send } = fixture({ timeoutMs: 40, fetchImpl: async (_url, options) => {
    signal = options.signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } });
  assert.deepEqual(await send('recipient@example.test', message), { success: false });
  assert.equal(signal.aborted, true);
});
