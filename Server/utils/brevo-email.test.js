import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthEmailSender } from './auth-email-delivery.js';
import { magicLinkEmail, passwordResetEmail } from './email-templates.js';

const env = { EMAIL_PROVIDER: 'brevo', EMAIL_USER: ' sender@example.test ',
  BREVO_API_KEY: ' PRIVATE_API_KEY ', FRONTEND_URL: 'https://frontend.example.test' };
const recipient = 'recipient@example.test';
const link = 'https://frontend.example.test/verify?token=PRIVATE_LOGIN_TOKEN';
const fixture = overrides => {
  const logs = [];
  return { logs, send: createAuthEmailSender({ env,
    createTransport: () => assert.fail('Brevo must never connect to SMTP'),
    logger: { log: value => logs.push(value), error: value => logs.push(value) }, ...overrides }) };
};
const assertPrivate = logs => assert.doesNotMatch(logs.join(''), /PRIVATE_|recipient@|sender@|fixture-message/);

test('Brevo sends magic links and OTPs over fixed HTTPS with a backend-only API key', async () => {
  for (const message of [magicLinkEmail(link), passwordResetEmail('PRIVATE_OTP')]) {
    let calls = 0;
    const { send, logs } = fixture({ fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers['api-key'], 'PRIVATE_API_KEY');
      assert.ok(options.signal instanceof AbortSignal);
      const body = JSON.parse(options.body);
      assert.deepEqual(body.sender, { name: 'SielAlumni', email: 'sender@example.test' });
      assert.deepEqual(body.to, [{ email: recipient, removeTrackingPixel: true }]);
      assert.equal(body.subject, message.subject);
      assert.match(body.htmlContent, /PRIVATE_/);
      assert.match(body.htmlContent, /https:\/\/frontend.example.test\/clsu_favicon.png/);
      assert.doesNotMatch(body.htmlContent, /cid:/);
      assert.equal(body.scheduledAt, undefined);
      return Response.json({ messageId: '<fixture-message>' }, { status: 201 });
    } });
    assert.deepEqual(await send(recipient, message), { success: true });
    assert.equal(calls, 1);
    assert.match(logs.join(''), /accepted for delivery \(brevo\)/);
    assertPrivate(logs);
  }
});

test('Brevo rejections, quota exhaustion, and failures never retry or disclose provider bodies', async () => {
  for (const [status, code] of [[400, 'EREQUEST'], [401, 'EAUTH'], [403, 'EAUTH'],
    [429, 'ERATELIMIT'], [500, 'EPROVIDER']]) {
    let calls = 0;
    const { send, logs } = fixture({ fetchImpl: async () => {
      calls++;
      return Response.json({ message: `PRIVATE_API_KEY PRIVATE_LOGIN_TOKEN ${recipient}` }, { status });
    } });
    assert.deepEqual(await send(recipient, magicLinkEmail(link)), { success: false });
    assert.equal(calls, 1);
    assert.match(logs.join(''), new RegExp(`${code}; provider=brevo`));
    assert.match(logs.join(''), new RegExp(`status=${status}`));
    assertPrivate(logs);
  }
});

test('Brevo requires message acceptance rather than trusting an arbitrary successful HTTP response', async () => {
  for (const body of [{}, { messageId: '' }, null]) {
    const { send, logs } = fixture({ fetchImpl: async () => Response.json(body) });
    assert.deepEqual(await send(recipient, magicLinkEmail(link)), { success: false });
    assertPrivate(logs);
  }
  const { send, logs } = fixture({ fetchImpl: async () => { throw new Error('PRIVATE_API_KEY'); } });
  assert.deepEqual(await send(recipient, magicLinkEmail(link)), { success: false });
  assertPrivate(logs);
});

test('Brevo timeout aborts the request, including a response body that never completes', async () => {
  for (const stallBody of [false, true]) {
    let signal;
    const { send, logs } = fixture({ timeoutMs: 20, fetchImpl: async (_url, options) => {
      signal = options.signal;
      if (stallBody) return { ok: true, json: async () => new Promise(() => {}) };
      return new Promise(() => {});
    } });
    assert.deepEqual(await send(recipient, magicLinkEmail(link)), { success: false });
    assert.equal(signal.aborted, true);
    assert.match(logs.join(''), /ETIMEDOUT; provider=brevo/);
    assertPrivate(logs);
  }
});

test('Brevo fails closed for missing credentials and never falls back to SMTP', async () => {
  for (const invalid of [{ ...env, BREVO_API_KEY: '' }, { ...env, EMAIL_USER: '' },
    { ...env, EMAIL_USER: 'sender@example.test\r\nBcc: other@example.test' },
    { ...env, BREVO_API_KEY: 'PRIVATE_KEY\r\nInjected: true' }]) {
    const { send, logs } = fixture({ env: invalid, fetchImpl: () => assert.fail('must not connect') });
    assert.deepEqual(await send(recipient, magicLinkEmail(link)), { success: false });
    assert.match(logs.join(''), /ECONFIG/);
    assertPrivate(logs);
  }
});

test('Brevo retains usable branding without an HTTPS frontend origin', async () => {
  const { send } = fixture({ env: { ...env, FRONTEND_URL: 'invalid' }, fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.doesNotMatch(body.htmlContent, /cid:|<img/);
    assert.match(body.htmlContent, /AlumniLink/);
    assert.match(body.htmlContent, /PRIVATE_LOGIN_TOKEN/);
    return Response.json({ messageId: '<fixture-message>' }, { status: 201 });
  } });
  assert.deepEqual(await send(recipient, magicLinkEmail(link)), { success: true });
});


test('request-scoped delivery diagnostics merge into one request event without separate console messages', async () => {
  for (const status of [201, 401, 429]) {
    const events = [];
    const { send, logs } = fixture({ fetchImpl: async () => Response.json(status === 201 ? { messageId: '<fixture-message>' } : { message: 'PRIVATE_PROVIDER_ERROR' }, { status }) });
    const result = await send(recipient, magicLinkEmail(link), { onDelivery: value => events.push(value) });
    assert.equal(result.success, status === 201);
    assert.equal(logs.length, 0);
    assert.equal(events.length, 1);
    assert.equal(events[0].emailProvider, 'brevo');
    assert.equal(events[0].emailDelivery, status === 201 ? 'accepted' : 'failed');
    assert.equal(events[0].providerStatus, status);
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE_|recipient@|sender@/);
  }
});
