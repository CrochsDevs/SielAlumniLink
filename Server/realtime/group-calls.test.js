import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as connect } from "../../Client/node_modules/socket.io-client/build/esm/index.js";
import { createGroupCallRuntime, GROUP_CALL_LIMIT } from "./group-calls.js";

async function fixture(t, options = {}) {
  const http = createServer(),
    io = new Server(http);
  const members = new Set(
    Array.from({ length: 12 }, (_, index) => `user${index}`),
  );
  const records = [],
    notices = [];
  const joins = [];
  const runtime = createGroupCallRuntime(io, {
    authorize: async (user, id) =>
      id === "group"
        ? {
            isGroup: true,
            name: "Alumni group",
            profilePicture: `https://example.test/profiles/${user._id}.jpg`,
            participants: [...members].map((authId) => ({ authId })),
          }
        : null,
    emitToUser: (...args) => notices.push(args),
    record: async (call) => records.push(call),
    recordJoin: async activity => joins.push(activity),
  }, options);
  io.on("connection", (socket) => {
    socket.user = {
      _id: socket.handshake.auth.id,
      email: `${socket.handshake.auth.id}@example.test`,
    };
    runtime.attach(socket);
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  const sockets = [];
  t.after(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => io.close(resolve));
  });
  const client = async (id) => {
    const socket = connect(`http://127.0.0.1:${http.address().port}`, {
      auth: { id },
      transports: ["websocket"],
      forceNew: true,
    });
    sockets.push(socket);
    await new Promise((resolve) => socket.once("connect", resolve));
    return socket;
  };
  const request = (socket, event, input = {}) =>
    new Promise((resolve, reject) =>
      socket
        .timeout(2000)
        .emit(`group-call:${event}`, input, (error, response) =>
          error ? reject(error) : resolve(response),
        ),
    );
  return { client, request, members, runtime, records, notices, joins };
}

test('unanswered group calls expire in 30 seconds and close for every member', async t => {
  let deadline;
  let delay;
  const f = await fixture(t, { schedule: (callback, ms) => { deadline = callback; delay = ms; return 1; }, cancel() {} });
  const a = await f.client('user0');
  await f.request(a, 'join', { conversationId: 'group', kind: 'voice' });
  assert.equal(delay, 30000);
  const invite = f.notices.find(([, event]) => event === 'group-call:invite')[2];
  assert.ok(invite.callId);
  assert.ok(invite.ringExpiresAt > Date.now());
  assert.equal(invite.callerProfilePicture, 'https://example.test/profiles/user0.jpg');
  const ended = new Promise(resolve => a.once('group-call:ended', resolve));
  deadline();
  assert.match((await ended).reason, /No answer/);
  assert.equal((await f.request(a, 'inspect', { conversationId: 'group' })).data.active, false);
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0].endReason, 'no-answer');
  assert.equal(f.records[0].acceptedAt, null);
});

test('a declined invitation keeps ringing for others, and an answer cancels expiry', async t => {
  let deadline;
  let cancelled = false;
  const f = await fixture(t, { schedule: callback => { deadline = callback; return 1; }, cancel: () => { cancelled = true; } });
  const a = await f.client('user0');
  const b = await f.client('user1');
  const c = await f.client('user2');
  await f.request(a, 'join', { conversationId: 'group' });
  const invite = f.notices.find(([, event]) => event === 'group-call:invite')[2];
  await f.request(b, 'decline', { conversationId: 'group', callId: invite.callId });
  assert.equal((await f.request(a, 'inspect', { conversationId: 'group' })).data.active, true);
  await f.request(c, 'join', { conversationId: 'group' });
  assert.equal(cancelled, true);
  deadline();
  assert.equal((await f.request(a, 'inspect', { conversationId: 'group' })).data.active, true);
  assert.equal(f.records.length, 0);
});

test('all invited members declining closes the call and records a declined result', async t => {
  const f = await fixture(t);
  f.members.clear();
  f.members.add('user0'); f.members.add('user1');
  const a = await f.client('user0');
  const b = await f.client('user1');
  await f.request(a, 'join', { conversationId: 'group' });
  const invite = f.notices.find(([, event]) => event === 'group-call:invite')[2];
  await f.request(b, 'decline', { conversationId: 'group', callId: 'stale-call' });
  assert.equal((await f.request(a, 'inspect', { conversationId: 'group' })).data.active, true);
  await f.request(b, 'decline', { conversationId: 'group', callId: invite.callId });
  assert.equal((await f.request(a, 'inspect', { conversationId: 'group' })).data.active, false);
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0].endReason, 'declined');
});

test('a new presenter replaces the previous one and stale status or stop messages cannot reclaim it', async t => {
  const f = await fixture(t);
  const a = await f.client('user0');
  const b = await f.client('user1');
  const outsider = await f.client('outsider');
  await f.request(a, 'join', { conversationId: 'group' });
  await f.request(b, 'join', { conversationId: 'group' });
  const first = await f.request(a, 'present', { sharing: true });
  assert.equal(first.data.presenterId, a.id);
  const changed = new Promise(resolve => a.once('group-call:presentation-changed', resolve));
  const second = await f.request(b, 'present', { sharing: true });
  assert.equal((await changed).presenterId, b.id);
  assert.ok(second.data.version > first.data.version);
  const status = new Promise(resolve => b.once('group-call:peer-updated', resolve));
  await f.request(a, 'status', { sharing: true, mic: true, camera: true });
  assert.equal((await status).sharing, false);
  const stale = await f.request(a, 'present', { sharing: false, version: first.data.version });
  assert.equal(stale.data.presenterId, b.id);
  assert.equal((await f.request(outsider, 'present', { sharing: true })).success, false);
  const c = await f.client('user2');
  const joined = await f.request(c, 'join', { conversationId: 'group' });
  assert.deepEqual(joined.data.peers.filter(peer => peer.sharing).map(peer => peer.id), [b.id]);
  const stopped = await f.request(b, 'present', { sharing: false, version: second.data.version });
  assert.equal(stopped.data.presenterId, null);
});

test('simultaneous presentation requests produce one winner and leaving clears the presenter', async t => {
  const f = await fixture(t);
  const a = await f.client('user0');
  const b = await f.client('user1');
  await f.request(a, 'join', { conversationId: 'group' });
  await f.request(b, 'join', { conversationId: 'group' });
  const results = await Promise.all([f.request(a, 'present', { sharing: true }), f.request(b, 'present', { sharing: true })]);
  const winner = results.map(result => result.data).sort((left, right) => right.version - left.version)[0];
  const winnerSocket = winner.presenterId === a.id ? a : b;
  const otherSocket = winnerSocket === a ? b : a;
  const changed = new Promise(resolve => otherSocket.once('group-call:presentation-changed', resolve));
  await f.request(winnerSocket, 'leave', { conversationId: 'group' });
  assert.equal((await changed).presenterId, null);
});

test("group members start, join, signal, leave and record one shared call", async (t) => {
  const f = await fixture(t),
    a = await f.client("user0"),
    b = await f.client("user1"),
    c = await f.client("user2");
  const first = await f.request(a, "join", {
    conversationId: "group",
    kind: "video",
  });
  assert.equal(first.success, true);
  assert.equal(first.data.self.profilePicture, 'https://example.test/profiles/user0.jpg');
  assert.equal(
    f.notices.filter(([, event]) => event === "group-call:invite").length,
    11,
  );
  const second = await f.request(b, "join", { conversationId: "group" });
  assert.equal(second.data.peers.length, 1);
  assert.equal(second.data.peers[0].profilePicture, 'https://example.test/profiles/user0.jpg');
  const third = await f.request(c, "join", { conversationId: "group" });
  assert.equal(third.data.peers.length, 2);
  assert.deepEqual(f.joins.map(activity => activity.member._id), ['user0', 'user1', 'user2']);
  assert.ok(f.joins.every(activity => activity.callId === f.joins[0].callId && activity.conversationId === 'group'));
  const signal = new Promise((resolve) => b.once("group-call:signal", resolve));
  a.emit("group-call:signal", {
    to: b.id,
    description: { type: "offer", sdp: "fixture" },
    unwanted: "ignored",
  });
  assert.equal((await signal).description.sdp, "fixture");
  await f.request(a, "leave");
  assert.equal(
    (await f.request(b, "inspect", { conversationId: "group" })).data.count,
    2,
    "starter leaving keeps other members connected",
  );
  await f.request(b, "leave");
  await f.request(c, "leave");
  assert.equal(f.records.length, 1);
  assert.equal(f.records[0].kind, "video");
  assert.equal(
    (await f.request(a, "inspect", { conversationId: "group" })).data.active,
    false,
  );
});

test("nonmembers, direct messages, duplicate tabs and full calls cannot join", async (t) => {
  const f = await fixture(t),
    outsider = await f.client("outsider");
  assert.equal(
    (await f.request(outsider, "join", { conversationId: "group" })).success,
    false,
  );
  const a = await f.client("user0");
  assert.equal(
    (await f.request(a, "join", { conversationId: "direct" })).success,
    false,
  );
  assert.equal(
    (await f.request(a, "join", { conversationId: "group" })).success,
    true,
  );
  const duplicate = await f.client("user0");
  assert.equal(
    (await f.request(duplicate, "join", { conversationId: "group" })).success,
    false,
  );
  for (let index = 1; index < GROUP_CALL_LIMIT; index++)
    assert.equal(
      (
        await f.request(await f.client(`user${index}`), "join", {
          conversationId: "group",
        })
      ).success,
      true,
    );
  assert.equal(
    (
      await f.request(await f.client("user9"), "join", {
        conversationId: "group",
      })
    ).success,
    false,
  );
});

test("removed members lose call access and cannot rejoin or relay signaling", async (t) => {
  const f = await fixture(t),
    a = await f.client("user0"),
    b = await f.client("user1");
  await f.request(a, "join", { conversationId: "group" });
  await f.request(b, "join", { conversationId: "group" });
  const removed = new Promise((resolve) => b.once("group-call:ended", resolve));
  f.members.delete("user1");
  await f.runtime.removeMember("group", "user1");
  assert.match((await removed).reason, /no longer a member/);
  assert.equal(
    (await f.request(b, "join", { conversationId: "group" })).success,
    false,
  );
  assert.equal((await f.request(b, "status", { mic: true })).success, false);
  assert.equal(
    (await f.request(a, "inspect", { conversationId: "group" })).data.count,
    1,
  );
  await f.request(a, "leave");
});

test("disconnect removes peers and closes an empty call", async (t) => {
  const f = await fixture(t),
    a = await f.client("user0"),
    b = await f.client("user1");
  await f.request(a, "join", { conversationId: "group" });
  await f.request(b, "join", { conversationId: "group" });
  const left = new Promise((resolve) =>
    a.once("group-call:peer-left", resolve),
  );
  b.disconnect();
  await left;
  assert.equal(
    (await f.request(a, "inspect", { conversationId: "group" })).data.count,
    1,
  );
  await f.request(a, "leave");
  assert.equal(f.records.length, 1);
});
