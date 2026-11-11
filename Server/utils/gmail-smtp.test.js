import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { createAuthEmailSender } from './auth-email-delivery.js';

const env = { EMAIL_PROVIDER: 'smtp', EMAIL_USER: ' sender@example.test ', EMAIL_PASS: 'test only fake pass' };
const message = { subject: 'Fixture sign-in', text: 'PRIVATE_LOGIN_TOKEN', html: '<p>PRIVATE_LOGIN_TOKEN</p>' };
const fixture = overrides => {
  const logs = [];
  return { logs, send: createAuthEmailSender({ env,
    logger: { log: value => logs.push(value), error: value => logs.push(value) }, ...overrides }) };
};

test('Gmail SMTP sends with App Password normalization, TLS, and the local inline logo', async () => {
  let closed = 0;
  const { send, logs } = fixture({ createTransport: options => {
    assert.equal(options.service, 'gmail');
    assert.deepEqual(options.auth, { user: 'sender@example.test', pass: 'testonlyfakepass' });
    assert.equal(options.tls.rejectUnauthorized, true);
    assert.equal(options.tls.minVersion, 'TLSv1.2');
    assert.equal(options.connectionTimeout, 8000);
    return { sendMail: async mail => {
      assert.deepEqual(mail.from, { name: 'SielAlumni', address: 'sender@example.test' });
      assert.equal(mail.to, 'recipient@example.test');
      assert.equal(mail.text, message.text);
      assert.equal(mail.attachments[0].cid, 'clsu-logo@alumnilink');
      await access(mail.attachments[0].path);
    }, close: () => { closed++; } };
  } });
  assert.deepEqual(await send('recipient@example.test', message), { success: true });
  assert.equal(closed, 1);
  assert.match(logs.join(''), /accepted for delivery \(smtp\)/);
  assert.doesNotMatch(logs.join(''), /PRIVATE_|testonlyfakepass|sender@example|recipient@example/);
});

test('a stalled SMTP connection is closed at the hard delivery deadline', async () => {
  let closed = 0;
  const { send, logs } = fixture({ timeoutMs: 20, createTransport: () => ({
    sendMail: async () => new Promise(() => {}), close: () => { closed++; },
  }) });
  assert.deepEqual(await send('recipient@example.test', message), { success: false });
  assert.equal(closed, 1);
  assert.match(logs.join(''), /ETIMEDOUT; provider=smtp/);
});

test('SMTP failures are categorized without leaking provider details or retrying', async () => {
  for (const code of ['EAUTH', 'ECONNECTION', 'ESOCKET', 'UNTRUSTED_PRIVATE_DETAIL']) {
    let calls = 0;
    const { send, logs } = fixture({ createTransport: () => ({ sendMail: async () => {
      calls++;
      throw Object.assign(new Error('PRIVATE_LOGIN_TOKEN PRIVATE_PASSWORD recipient@example.test'), { code });
    }, close() {} }) });
    assert.deepEqual(await send('recipient@example.test', message), { success: false });
    assert.equal(calls, 1);
    assert.doesNotMatch(logs.join(''), /PRIVATE_|recipient@example/);
    assert.match(logs.join(''), new RegExp(code === 'UNTRUSTED_PRIVATE_DETAIL' ? 'EDELIVERY' : code));
  }
});

test('unsupported transports and incomplete Gmail configuration fail before any connection', async () => {
  for (const invalid of [
    { ...env, EMAIL_PROVIDER: 'gmail_api' }, { ...env, EMAIL_PROVIDER: 'resend' },
    { ...env, EMAIL_USER: '' }, { ...env, EMAIL_PASS: '' },
    { ...env, EMAIL_USER: 'sender@example.test\r\nBcc: other@example.test' },
  ]) {
    let calls = 0;
    const { send, logs } = fixture({ env: invalid, createTransport: () => { calls++; } });
    assert.deepEqual(await send('recipient@example.test', message), { success: false });
    assert.equal(calls, 0);
    assert.match(logs.join(''), /ECONFIG/);
  }
});

test('Gmail SMTP is the default even if unused legacy API variables remain', async () => {
  let calls = 0;
  const { send } = fixture({ env: { ...env, EMAIL_PROVIDER: undefined, GOOGLE_REFRESH_TOKEN: 'PRIVATE_UNUSED', RESEND_API_KEY: 'PRIVATE_UNUSED' },
    createTransport: options => {
      calls++;
      assert.equal(options.service, 'gmail');
      return { sendMail: async () => ({}), close() {} };
    } });
  assert.deepEqual(await send('recipient@example.test', message), { success: true });
  assert.equal(calls, 1);
});
