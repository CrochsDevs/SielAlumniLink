import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { createMessageAttachmentDownload, messageAttachmentDownloadUrl } from './message-attachments.js';

test('files use a short-lived authenticated download API URL and images retain signed delivery', () => {
  const cloudinary = { utils: { private_download_url(id, format, options) {
    assert.equal(id, 'messages/archive.zip');
    assert.equal(format, undefined);
    assert.deepEqual(options, { resource_type: 'raw', type: 'authenticated', expires_at: 1120, attachment: true });
    return 'https://storage.example.test/private-download';
  } }, url(id, options) {
    assert.equal(id, 'messages/photo');
    assert.deepEqual(options, { resource_type: 'image', type: 'authenticated', format: 'png', secure: true, sign_url: true });
    return 'https://storage.example.test/signed-image';
  } };
  assert.equal(messageAttachmentDownloadUrl({ kind: 'file', publicId: 'messages/archive.zip' }, cloudinary, 1000000), 'https://storage.example.test/private-download');
  assert.equal(messageAttachmentDownloadUrl({ kind: 'image', publicId: 'messages/photo', format: 'png' }, cloudinary), 'https://storage.example.test/signed-image');
});

const fixture = () => {
  const conversationId = new ObjectId(), messageId = new ObjectId(), userId = new ObjectId();
  let member = true, unsent = false, cleared = false, upstreamOk = true, fetched = 0;
  const bytes = Buffer.from('PK\u0003\u0004ZIP fixture');
  const db = { collection: name => ({ findOne: async filter => {
    if (name === 'conversations') return member && filter['participants.authId'] === String(userId) ? { _id: conversationId } : null;
    if (name === 'conversation_preferences') return cleared ? { clearedAt: new Date() } : null;
    if (name === 'messages') return unsent || filter.createdAt ? null : { attachment: { kind: 'file', publicId: 'archive.zip', name: 'A file (1).zip' } };
  } }) };
  const handler = createMessageAttachmentDownload(db, () => 'https://fixture.example.test/download', async () => {
    fetched++;
    return new Response(upstreamOk ? bytes : 'provider secret must not escape', { status: upstreamOk ? 200 : 401 });
  });
  const get = async () => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, set(headers) { this.headers = headers; return this; }, send(body) { this.bytes = body; return this; } };
    await handler({ user: { _id: userId }, params: { id: String(conversationId), messageId: String(messageId) } }, res);
    return res;
  };
  return { get, bytes, fetched: () => fetched, member: value => { member = value; }, unsent: value => { unsent = value; }, cleared: value => { cleared = value; }, upstreamOk: value => { upstreamOk = value; } };
};

test('authorized file downloads return exact bytes and an encoded attachment filename', async () => {
  const f = fixture(), res = await f.get();
  assert.equal(res.code, 200);
  assert.deepEqual(res.bytes, f.bytes);
  assert.equal(res.headers['Content-Type'], 'application/octet-stream');
  assert.equal(res.headers['Content-Disposition'], "attachment; filename*=UTF-8''A%20file%20%281%29.zip");
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});

test('nonmembers, unsent messages and cleared history cannot fetch file bytes', async () => {
  for (const restriction of ['member', 'unsent', 'cleared']) {
    const f = fixture();
    f[restriction](restriction !== 'member');
    assert.equal((await f.get()).code, 404);
    assert.equal(f.fetched(), 0);
  }
});

test('storage failures return a retryable error without leaking provider responses', async () => {
  const f = fixture(); f.upstreamOk(false);
  const res = await f.get();
  assert.equal(res.code, 502);
  assert.equal(res.bytes, undefined);
  assert.equal(JSON.stringify(res.body).includes('provider secret'), false);
});
