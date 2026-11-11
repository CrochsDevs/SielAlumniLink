import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthEmailSender } from './auth-email-delivery.js';

const message = { subject: 'Fixture sign-in', text: 'PRIVATE_LINK_TOKEN', html: '<img src="cid:clsu-logo@alumnilink">PRIVATE_LINK_TOKEN' };
const resendEnv = { EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 'PRIVATE_API_KEY', EMAIL_FROM: 'AlumniLink <login@example.test>' };
const fixture = options => {
  const logs = [];
  const send = createAuthEmailSender({
    env: resendEnv, readLogo: async () => Buffer.from('fixture-logo'),
    logger: { log: value => logs.push(value), error: value => logs.push(value) }, ...options,
  });
  return { send, logs };
};

test('HTTPS email uses the fixed provider, inline logo, and server-side credentials', async () => {
  let calls = 0;
  const { send, logs } = fixture({ fetchImpl: async (url, config) => {
    calls++;
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(config.method, 'POST');
    assert.equal(config.redirect, 'error');
    assert.equal(config.headers.Authorization, 'Bearer PRIVATE_API_KEY');
    const body = JSON.parse(config.body);
    assert.equal(body.from, resendEnv.EMAIL_FROM);
    assert.deepEqual(body.to, ['recipient@example.test']);
    assert.equal(body.text, message.text);
    assert.equal(body.attachments[0].content_id, 'clsu-logo@alumnilink');
    assert.equal(Buffer.from(body.attachments[0].content, 'base64').toString(), 'fixture-logo');
    return { ok: true, json: async () => ({ id: 'fixture-email-id' }) };
  } });
  assert.deepEqual(await send('recipient@example.test', message), { success: true });
  assert.equal(calls, 1);
  assert.equal(logs.join('').includes('PRIVATE_'), false);
});

test('provider rejection does not leak a body or retry through SMTP', async () => {
  let smtpCalls = 0;
  const { send, logs } = fixture({
    createTransport: () => { smtpCalls++; throw new Error('Unexpected SMTP'); },
    fetchImpl: async () => ({ ok: false, body: { cancel: async () => {} }, json: async () => { throw new Error('PRIVATE_PROVIDER_BODY'); } }),
  });
  assert.deepEqual(await send('recipient@example.test', message), { success: false });
  assert.equal(smtpCalls, 0);
  assert.match(logs.join(''), /EPROVIDER/);
  assert.doesNotMatch(logs.join(''), /PRIVATE_|recipient@example/);
});

test('a hanging HTTPS request is aborted before the client timeout', async () => {
  let signal;
  const { send, logs } = fixture({ timeoutMs: 20, fetchImpl: async (_url, options) => {
    signal = options.signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('PRIVATE_NETWORK_DETAIL')), { once: true }));
  } });
  assert.deepEqual(await send('recipient@example.test', message), { success: false });
  assert.equal(signal.aborted, true);
  assert.doesNotMatch(logs.join(''), /PRIVATE_|recipient@example/);
});

test('missing credentials, unknown providers, and malformed sender config fail closed', async () => {
  for (const env of [
    { ...resendEnv, RESEND_API_KEY: '' }, { ...resendEnv, EMAIL_FROM: '' },
    { ...resendEnv, EMAIL_FROM: 'sender\r\nBcc: attacker@example.test' },
    { EMAIL_PROVIDER: 'unknown' },
  ]) {
    let calls = 0;
    const { send } = fixture({ env, fetchImpl: async () => { calls++; } });
    assert.deepEqual(await send('recipient@example.test', message), { success: false });
    assert.equal(calls, 0);
  }
});

test('an invalid success response is never reported as accepted delivery', async () => {
  for (const value of [{}, { id: '' }, { id: null }]) {
    const { send } = fixture({ fetchImpl: async () => ({ ok: true, json: async () => value }) });
    assert.deepEqual(await send('recipient@example.test', message), { success: false });
  }
});

test('SMTP retains encrypted transport and closes a stalled connection at the deadline', async () => {
  let closed = 0;
  const { send, logs } = fixture({
    timeoutMs: 20, env: { EMAIL_PROVIDER: 'smtp', EMAIL_USER: 'sender@example.test', EMAIL_PASS: 'PRIVATE_SMTP_PASSWORD' },
    createTransport: options => {
      assert.equal(options.service, 'gmail');
      assert.equal(options.tls.rejectUnauthorized, true);
      assert.equal(options.tls.minVersion, 'TLSv1.2');
      assert.equal(options.connectionTimeout, 8000);
      return { sendMail: async () => new Promise(() => {}), close: () => { closed++; } };
    },
  });
  assert.deepEqual(await send('recipient@example.test', message), { success: false });
  assert.equal(closed, 1);
  assert.doesNotMatch(logs.join(''), /PRIVATE_|recipient@example/);
});

test('Gmail App Passwords copied with display spaces are normalized', async () => {
  const { send } = fixture({
    env: { EMAIL_PROVIDER: 'smtp', EMAIL_USER: ' sender@example.test ', EMAIL_PASS: 'test only fake pass' },
    createTransport: options => {
      assert.equal(options.auth.user, 'sender@example.test');
      assert.equal(options.auth.pass, 'testonlyfakepass');
      return { sendMail: async () => ({}), close() {} };
    },
  });
  assert.deepEqual(await send('recipient@example.test', message), { success: true });
});
