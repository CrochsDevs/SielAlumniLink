import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
import { client } from '../../config/db.js';
import { Writable } from 'node:stream';

test('conversation controls and read receipts use isolated, per-member data', { timeout: 120000 }, async t => {
  const connection = new MongoClient(process.env.TEST_MONGO_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const name = `Siel_msg_test_${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  const db = connection.db(name), originalDb = client.db;
  let connected = false;
  try {
    await connection.connect(); connected = true;
    // Import every bound model only after redirecting it to the exact fixture DB.
    client.db = () => db;
    const { ConversationModel: conversations, MessageModel: messages } = await import('./messages.models.js');
    const { ConversationControls: controls } = await import('./conversation-controls.js');
    const actions = await import('./messages.controllers.js');
    const a = { _id: new ObjectId(), role: 'admin', email: 'a@example.test' };
    const b = { _id: new ObjectId(), role: 'student', email: 'b@example.test' };
    const c = { _id: new ObjectId(), role: 'alumni', email: 'c@example.test' };
    await db.collection('auth').insertMany([a, b, c]);
    await db.collection('users').insertMany([a, b, c].map(user => ({ authId: user._id, name: user.email, email: user.email })));
    const direct = await conversations.getOrCreate(a._id, a.email, b._id, b.email);
    const group = await conversations.createGroup({ name: 'Fixture group', members: [a, b, c].map(user => ({ authId: user._id, email: user.email })) });
    const invoke = async (action, user, id, body = {}, extra = {}) => {
      const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
      await action({ user, params: { id: String(id), ...extra }, body }, res);
      return res;
    };
    const incoming = await messages.create({ conversationId: direct._id, senderAuthId: a._id, senderEmail: a.email, text: 'Hello fixture' });
    await t.test('historical and new messages resolve current names/photos without exposing private profile fields', async () => {
      const photo = 'https://example.test/avatar-a.png';
      await db.collection('users').updateOne({ authId: a._id }, { $set: { name: 'Alex Fixture', profilePicture: photo, contactNumber: 'NEVER_RETURN' } });
      // No profile snapshots are stored in the original message document.
      const history = (await invoke(actions.listMessages, b, direct._id)).body.data[0];
      assert.equal(history.senderName, 'Alex Fixture');
      assert.equal(history.senderProfilePicture, photo);
      assert.equal(history.senderAuthId, String(a._id));
      assert.equal(history.contactNumber, undefined);
      const { default: users } = await import('../users/users.models.js');
      assert.deepEqual(Object.keys((await users.findChatProfilesByAuthIds([a._id]))[0]).sort(), ['authId', 'name', 'profilePicture']);
      // Support legacy string links and resolve the latest profile, not old email text.
      await db.collection('users').updateOne({ authId: a._id }, { $set: { authId: String(a._id), name: 'Updated Alex' } });
      const sent = await invoke(actions.sendMessage, a, group._id, { text: 'Profile identity fixture' });
      assert.equal(sent.code, 201);
      assert.equal(sent.body.data.senderName, 'Updated Alex');
      assert.equal(sent.body.data.senderProfilePicture, photo);
      assert.equal((await invoke(actions.listMessages, b, group._id)).body.data[0].senderName, 'Updated Alex');
      // Keep the receipt tests' fixture histories unchanged.
      await db.collection('messages').deleteOne({ _id: sent.body.data._id });
    });
    await t.test('history fetch does not claim a read; only recipient acknowledgements change status', async () => {
      assert.equal((await invoke(actions.listMessages, a, direct._id)).body.data[0].read, false);
      await invoke(actions.listMessages, b, direct._id);
      assert.equal((await db.collection('messages').findOne({ _id: incoming._id })).read, false);
      assert.equal((await invoke(actions.markMessagesRead, a, direct._id, { messageIds: [String(incoming._id)] })).body.data.messageIds.length, 0);
      const read = await invoke(actions.markMessagesRead, b, direct._id, { messageIds: [String(incoming._id)] });
      assert.equal(read.code, 200);
      assert.deepEqual(read.body.data.messageIds, [String(incoming._id)]);
      assert.equal((await invoke(actions.listMessages, a, direct._id)).body.data[0].read, true);
      assert.equal((await invoke(actions.listMessages, b, direct._id)).body.data[0].readByMe, true);
    });
    await t.test('outsiders, injected IDs and messages from other conversations cannot acknowledge reads', async () => {
      assert.equal((await invoke(actions.markMessagesRead, c, direct._id, { messageIds: [String(incoming._id)] })).code, 404);
      for (const messageIds of [[{}], ['bad-id'], [], { $ne: null }, Array(101).fill(String(incoming._id))]) {
        assert.equal((await invoke(actions.markMessagesRead, b, direct._id, { messageIds })).code, 400);
      }
      const foreign = await messages.create({ conversationId: group._id, senderAuthId: a._id, text: 'Group message' });
      assert.deepEqual((await invoke(actions.markMessagesRead, b, direct._id, { messageIds: [String(foreign._id)] })).body.data.messageIds, []);
      assert.equal((await db.collection('messages').findOne({ _id: foreign._id })).read, false);
    });
    await t.test('group receipts track each reader independently and keep other member badges unread', async () => {
      const message = (await messages.listByConversation(group._id))[0];
      await invoke(actions.markMessagesRead, b, group._id, { messageIds: [String(message._id)] });
      assert.equal(await messages.unreadCount(group._id, b._id), 0);
      assert.equal(await messages.unreadCount(group._id, c._id), 1);
      assert.equal((await invoke(actions.listMessages, a, group._id)).body.data[0].read, true);
      assert.equal((await invoke(actions.listMessages, c, group._id)).body.data[0].readByMe, false);
      await invoke(actions.markMessagesRead, c, group._id, { messageIds: [String(message._id)] });
      assert.equal((await db.collection('messages').findOne({ _id: message._id })).readBy.length, 2);
    });
    await t.test('block prevents both directions, including admin sends, opens and message edits', async () => {
      assert.equal((await invoke(actions.blockConversation, c, direct._id)).code, 404);
      assert.equal((await invoke(actions.blockConversation, a, group._id)).code, 400);
      assert.equal((await invoke(actions.blockConversation, a, direct._id)).body.data.blockedByMe, true);
      for (const user of [a, b]) assert.equal((await invoke(actions.sendMessage, user, direct._id, { text: 'blocked' })).code, 403);
      assert.equal((await invoke(actions.openConversation, a, direct._id, { recipientAuthId: String(b._id) })).code, 403);
      assert.equal(await messages.editMessage(incoming._id, a._id, 'blocked edit'), null);
      await controls.setBlocked(b._id, a._id, true);
      await invoke(actions.unblockConversation, a, direct._id);
      assert.equal(await controls.isBlocked(a._id, b._id), true, 'unblocking does not remove the other member’s block');
      await invoke(actions.unblockConversation, b, direct._id);
      assert.equal(await controls.isBlocked(a._id, b._id), false);
      const sent = await invoke(actions.sendMessage, a, direct._id, { text: 'Allowed', clientMessageId: 'fixture-send-1' });
      assert.equal(sent.code, 201);
      assert.equal(sent.body.data.clientMessageId, 'fixture-send-1');
      assert.equal(sent.body.data.read, false);
    });
    await t.test('delete hides and clears only the member copy, preserving history and group membership', async () => {
      const before = await db.collection('messages').countDocuments();
      assert.equal((await invoke(actions.deleteConversation, c, direct._id)).code, 404);
      await invoke(actions.deleteConversation, a, direct._id);
      assert.equal((await conversations.findMine(a._id)).some(row => String(row._id) === String(direct._id)), false);
      assert.equal((await invoke(actions.listMessages, a, direct._id)).body.data.length, 0);
      assert.ok((await invoke(actions.listMessages, b, direct._id)).body.data.length > 0);
      assert.equal(await db.collection('messages').countDocuments(), before);
      await controls.show(direct._id, a._id);
      assert.equal((await invoke(actions.listMessages, a, direct._id)).body.data.length, 0, 'reopening does not resurrect cleared history');
      await invoke(actions.deleteConversation, b, group._id);
      assert.equal((await conversations.findById(group._id)).participants.length, 3);
      const [one, two] = await Promise.all([controls.clear(direct._id, a._id), controls.clear(direct._id, a._id)]);
      const saved = await controls.preference(direct._id, a._id);
      assert.ok(saved.clearedAt >= one.clearedAt && saved.clearedAt >= two.clearedAt);
      await db.collection('messages').updateOne({ _id: incoming._id }, { $set: { createdAt: new Date(saved.clearedAt.getTime() + 10), read: false, readBy: [] } });
      await conversations.touch(direct._id, { text: 'new message', at: new Date(saved.clearedAt.getTime() + 10) });
      assert.ok((await conversations.findMine(a._id)).some(row => String(row._id) === String(direct._id)));
      assert.equal((await invoke(actions.listMessages, a, direct._id)).body.data.length, 1);
    });
    await t.test('conversation previews show the latest visible message from someone else instead of the viewer’s own reply', async () => {
      const thread = await conversations.createGroup({ name: 'Preview fixture', members: [a, b, c].map(user => ({ authId: user._id, email: user.email })) });
      const first = await messages.create({ conversationId: thread._id, senderAuthId: a._id, text: 'Incoming from Alex' });
      await messages.create({ conversationId: thread._id, senderAuthId: b._id, text: 'My later reply' });
      const preview = async user => (await invoke(actions.listConversations, user)).body.data.find(row => String(row._id) === String(thread._id));
      assert.equal((await preview(b)).preview, 'Incoming from Alex');
      assert.equal((await preview(b)).previewMessageId, String(first._id));
      assert.deepEqual((await preview(b)).previewAt, first.createdAt);
      assert.equal((await preview(a)).preview, 'My later reply');
      await messages.create({ conversationId: thread._id, senderAuthId: c._id, text: 'Another member’s message' });
      assert.equal((await preview(b)).preview, 'Another member’s message');
      assert.equal((await preview(c)).preview, 'My later reply');
      const photo = await messages.create({ conversationId: thread._id, senderAuthId: a._id, attachment: {
        kind: 'image', url: 'https://res.cloudinary.com/fixture/image/authenticated/photo.png', publicId: 'fixture/photo', deliveryType: 'authenticated' } });
      assert.equal((await preview(b)).preview, '📷 Photo');
      assert.equal((await preview(a)).preview, 'Another member’s message');
      await messages.unsendMessage(photo._id, a._id);
      assert.equal((await preview(b)).preview, 'Message deleted');
      await controls.show(thread._id, b._id);
      await controls.clear(thread._id, b._id);
      // Reopen to inspect the empty preview without resurrecting cleared messages.
      await controls.show(thread._id, b._id);
      assert.equal((await preview(b)).preview, '');
      assert.equal((await preview(b)).previewMessageId, null);
      assert.equal((await preview(b)).previewAt, null);
    });
    await t.test('membership activity previews include the actor and survive reload without exposing cleared history', async () => {
      const thread = await conversations.createGroup({ name: 'Activity preview fixture', members: [a, b, c].map(user => ({ authId: user._id, email: user.email })) });
      const preview = async user => (await invoke(actions.listConversations, user)).body.data.find(row => String(row._id) === String(thread._id));
      await messages.create({ conversationId: thread._id, senderAuthId: c._id, text: 'Older call activity' });
      for (const [type, text] of [['members_added', 'Alex added Bea to the group'], ['member_removed', 'Alex removed Chris from the group']]) {
        const activity = await messages.create({ conversationId: thread._id, senderAuthId: a._id, text, activity: { type } });
        await conversations.touch(thread._id, { text, at: activity.createdAt, by: String(a._id) });
        for (const user of [a, b]) {
          const row = await preview(user);
          assert.equal(row.preview, text);
          assert.equal(row.previewMessageId, String(activity._id));
          assert.deepEqual(row.previewAt, activity.createdAt);
        }
        await messages.create({ conversationId: thread._id, senderAuthId: a._id, text: 'My ordinary reply' });
        assert.equal((await preview(a)).preview, text, 'Own replies do not replace the group activity preview');
      }
      await controls.clear(thread._id, a._id);
      await controls.show(thread._id, a._id);
      assert.equal((await preview(a)).preview, '');
    });
    await t.test('renaming a group records centered activity metadata and updates previews for the actor and members', async () => {
      const thread = await conversations.createGroup({ name: 'Rename fixture', members: [a, b, c].map(user => ({ authId: user._id, email: user.email })) });
      const renamed = await invoke(actions.renameGroup, a, thread._id, { name: 'New project name' });
      assert.equal(renamed.code, 200);
      const history = (await invoke(actions.listMessages, b, thread._id)).body.data;
      assert.equal(history.length, 1);
      const activity = history[0];
      assert.equal(activity.text, 'Updated Alex changed the group name to New project name');
      assert.deepEqual(activity.activity, { type: 'group_renamed', actorName: 'Updated Alex', groupName: 'New project name' });
      for (const user of [a, b]) {
        const row = (await invoke(actions.listConversations, user)).body.data.find(row => String(row._id) === String(thread._id));
        assert.equal(row.name, 'New project name');
        assert.equal(row.preview, activity.text);
        assert.equal(row.previewMessageId, String(activity._id));
      }
      assert.equal(await messages.editMessage(activity._id, a._id, 'Changed activity'), null);
      assert.equal(await messages.unsendMessage(activity._id, a._id), null);
      await invoke(actions.renameGroup, a, thread._id, { name: '  New project name  ' });
      assert.equal((await messages.listByConversation(thread._id)).length, 1);
      assert.equal((await invoke(actions.renameGroup, b, thread._id, { name: 'Blocked name' })).code, 403);
      assert.equal((await messages.listByConversation(thread._id)).length, 1);
    });
    await t.test('group activity stays unread for each member including its actor until that member sees it', async () => {
      const thread = await conversations.createGroup({ name: 'Unread activity fixture', members: [a, b, c].map(user => ({ authId: user._id, email: user.email })) });
      const activities = [];
      for (const type of ['members_added', 'member_removed', 'group_renamed']) {
        activities.push(await messages.create({ conversationId: thread._id, senderAuthId: a._id, text: type, activity: { type } }));
      }
      const ownReply = await messages.create({ conversationId: thread._id, senderAuthId: a._id, text: 'Own ordinary message' });
      const preview = async user => (await invoke(actions.listConversations, user)).body.data.find(row => String(row._id) === String(thread._id));
      assert.equal((await preview(a)).unread, 3);
      assert.equal((await preview(b)).unread, 4);
      await invoke(actions.listMessages, a, thread._id);
      assert.equal((await preview(a)).unread, 3, 'Fetching history alone does not mark activity as seen');
      const ids = activities.map(message => String(message._id));
      const seen = await invoke(actions.markMessagesRead, a, thread._id, { messageIds: [...ids, String(ownReply._id)] });
      assert.deepEqual(seen.body.data.messageIds.sort(), ids.sort());
      assert.equal(seen.body.data.unread, 0);
      assert.equal((await preview(a)).unread, 0, 'Seen status persists across reloads');
      assert.equal((await preview(b)).unread, 4, 'The actor seeing activity does not mark it as seen for other members');
      const history = (await invoke(actions.listMessages, a, thread._id)).body.data;
      assert.ok(history.filter(message => message.activity).every(message => message.readByMe));
      assert.equal((await invoke(actions.markMessagesRead, b, thread._id, { messageIds: [...ids, String(ownReply._id)] })).body.data.unread, 0);
      assert.equal((await preview(c)).unread, 4);
    });
    await t.test('history returns the newest 100 messages in chronological order', async () => {
      const baseline = Date.now() + 1000;
      await db.collection('messages').insertMany(Array.from({ length: 110 }, (_, i) => ({ conversationId: group._id, senderAuthId: String(a._id), text: `history-${i}`, createdAt: new Date(baseline + i), read: false, readBy: [] })));
      const history = await messages.listByConversation(group._id);
      assert.equal(history.length, 100);
      assert.equal(history[0].text, 'history-10');
      assert.equal(history.at(-1).text, 'history-109');
    });
    await t.test('multipart messages store authenticated Cloudinary assets and enforce member-only downloads', async context => {
      const { cloudinary } = await import('../../config/cloudinary.js');
      const { createMessageAttachmentDownload } = await import('./message-attachments.js');
      const { signSessionToken } = await import('../auth/session-token.js');
      const { default: express } = await import('express');
      const { default: cookieParser } = await import('cookie-parser');
      const { default: router } = await import('./messages.routes.js');
      const uploads = [];
      context.mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => new Writable({
        write(_chunk, _encoding, done) { done(); },
        final(done) {
          uploads.push(options);
          callback(null, { public_id: `${options.folder}/fixture-${uploads.length}`, secure_url: 'https://res.cloudinary.com/fixture/image/authenticated/fixture.png', format: 'png', width: 1, height: 1 });
          done();
        },
      }));
      const app = express(); app.use(express.json(), cookieParser()); app.use('/api/conversations', router);
      const server = app.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      try {
        const base = `http://127.0.0.1:${server.address().port}/api/conversations`;
        const cookie = { cookie: `token=${signSessionToken(a)}` };
        const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZYsAAAAASUVORK5CYII=', 'base64');
        const fresh = await conversations.createGroup({ name: 'Private photos', members: [a, b, c].map(user => ({ authId: user._id, email: user.email })) });
        const form = (bytes = image) => { const data = new FormData(); data.set('text', 'Photo caption'); data.set('file', new Blob([bytes], { type: 'image/png' }), 'clipboard.png'); return data; };
        assert.equal((await fetch(`${base}/${fresh._id}/messages`, { method: 'POST', body: form() })).status, 401);
        assert.equal((await fetch(`${base}/${fresh._id}/messages`, { method: 'POST', headers: cookie, body: form(Buffer.from('not an image')) })).status, 400);
        assert.equal((await fetch(`${base}/${fresh._id}/messages`, { method: 'POST', headers: cookie, body: form(Buffer.alloc(10 * 1024 * 1024 + 1)) })).status, 413);
        assert.equal(uploads.length, 0);
        const response = await fetch(`${base}/${fresh._id}/messages`, { method: 'POST', headers: cookie, body: form() });
        assert.equal(response.status, 201);
        const saved = (await response.json()).data;
        assert.equal(uploads.length, 1);
        assert.equal(uploads[0].type, 'authenticated');
        assert.equal(uploads[0].resource_type, 'image');
        assert.ok(saved.attachment.url.startsWith(`/api/conversations/${fresh._id}/messages/`));
        assert.equal(saved.attachment.publicId, undefined);
        const stored = await db.collection('messages').findOne({ _id: new ObjectId(saved._id) });
        assert.ok(stored.attachment.url.startsWith('https://res.cloudinary.com/'));
        assert.ok(stored.attachment.publicId);
        assert.equal(JSON.stringify(stored).includes('data:image/'), false);
        await controls.setBlocked(a._id, b._id, true);
        assert.equal((await fetch(`${base}/${direct._id}/messages`, { method: 'POST', headers: cookie, body: form() })).status, 403);
        await controls.setBlocked(a._id, b._id, false);
        assert.equal(uploads.length, 1, 'blocked sends must not upload assets');
        assert.equal((await fetch(`${base}/${fresh._id}/messages`, { method: 'POST', headers: { ...cookie, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Forged asset', attachment: { url: 'data:image/png;base64,xxx' } }) })).status, 400);
        let fetched = 0;
        const download = createMessageAttachmentDownload(db, attachment => { assert.equal(attachment.publicId, stored.attachment.publicId); return 'https://fixture.example.test/photo'; }, async () => { fetched++; return new Response(image, { headers: { 'content-type': 'image/png' } }); });
        const get = async (user, conversationId = fresh._id) => {
          const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, set(headers) { this.headers = headers; return this; }, send(bytes) { this.bytes = bytes; return this; } };
          await download({ user, params: { id: String(conversationId), messageId: saved._id } }, res); return res;
        };
        assert.equal((await get({ _id: new ObjectId() })).code, 404);
        assert.equal((await get(b, direct._id)).code, 404);
        assert.equal(fetched, 0);
        const visible = await get(b); assert.equal(visible.code, 200); assert.equal(visible.headers['Cache-Control'], 'private, no-store'); assert.deepEqual(visible.bytes, image);
        await controls.clear(fresh._id, b._id);
        assert.equal((await get(b)).code, 404);
        assert.equal((await get(c)).code, 200);
        await invoke(actions.unsendMessage, a, fresh._id, {}, { msgId: saved._id });
        assert.equal((await get(c)).code, 404);
      } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    });
    await t.test('legacy image migration verifies uploads, preserves messages, and safely handles retries and concurrent deletion', async () => {
      const { migrateInlineImages } = await import('./migrate-inline-images.js');
      const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZYsAAAAASUVORK5CYII=', 'base64');
      const url = `data:image/png;base64,${bytes.toString('base64')}`;
      await assert.rejects(messages.create({ conversationId: group._id, senderAuthId: a._id, text: '', attachment: { kind: 'image', url } }), /Cloudinary/);
      const base = { conversationId: group._id, senderAuthId: String(a._id), text: 'Preserve caption', read: true, readBy: [String(b._id)],
        createdAt: new Date('2026-10-29T06:00:00Z'), attachment: { kind: 'image', name: 'old.png', url } };
      const first = new ObjectId(), raced = new ObjectId(), failed = new ObjectId();
      const historicalConversationId = new ObjectId();
      await db.collection('messages').insertMany([{ ...base, conversationId: historicalConversationId, _id: first }, { ...base, _id: raced }, { ...base, _id: failed }]);
      const removed = []; let uploaded = 0;
      const upload = async (buffer, options) => { assert.deepEqual(buffer, bytes); assert.equal(options.type, 'authenticated'); return {
        secure_url: 'https://res.cloudinary.com/fixture/image/authenticated/photo.png', public_id: `${options.folder}/migration-${++uploaded}`, format: 'png', width: 1, height: 1 }; };
      const report = await migrateInlineImages(db, { upload, remove: async asset => removed.push(asset.publicId), verify: async (_asset, original) => {
        assert.deepEqual(original, bytes);
        if (uploaded === 2) await db.collection('messages').updateOne({ _id: raced }, { $set: { unsent: true } });
        if (uploaded === 3) throw new Error('Remote verification failed');
      } });
      assert.deepEqual(report.migrated, [String(first)]);
      assert.deepEqual(report.skipped, [String(raced)]);
      assert.equal(report.failed.length, 1);
      assert.equal(removed.length, 2, 'unlinked and unverified uploads are cleaned up');
      const saved = await db.collection('messages').findOne({ _id: first });
      assert.deepEqual(saved.conversationId, historicalConversationId, 'historical references are preserved without recreating deleted conversations');
      for (const field of ['text', 'senderAuthId', 'read', 'readBy', 'createdAt']) assert.deepEqual(saved[field], base[field]);
      assert.ok(saved.attachment.publicId);
      assert.equal((await db.collection('messages').findOne({ _id: failed })).attachment.url, url);
      const retry = await migrateInlineImages(db, { upload, verify: async () => {}, remove: async () => assert.fail('No cleanup should be necessary') });
      assert.deepEqual(retry.migrated, [String(failed)]);
      const repeated = await migrateInlineImages(db, { upload: async () => assert.fail('Migration must be idempotent') });
      assert.deepEqual(repeated, { migrated: [], skipped: [], failed: [] });
    });
  } finally {
    client.db = originalDb;
    try { if (connected && db.databaseName === name && name.startsWith('Siel_msg_test_')) await db.dropDatabase(); }
    finally { await connection.close(); await client.close(); }
  }
});
