import { randomUUID } from 'node:crypto';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export const GROUP_CALL_LIMIT = 8;

// Rooms and signaling are separate from event meetings: no attendance or host role.
export function createGroupCallRuntime(io, { authorize, emitToUser, record = async () => {} }, { now = Date.now, onError = console.error } = {}) {
  const rooms = new Map(), queues = new Map();
  const roomKey = id => `group-call:${id}`;
  const serial = (id, job) => {
    const result = (queues.get(id) || Promise.resolve()).catch(() => {}).then(job);
    queues.set(id, result);
    result.finally(() => { if (queues.get(id) === result) queues.delete(id); }).catch(() => {});
    return result;
  };
  const groupFor = async (user, id) => {
    if (typeof id !== 'string' || !id || id.length > 100) fail(404, 'Group conversation not found');
    const group = await authorize(user, id);
    if (!group?.isGroup || !group.participants?.some(member => String(member.authId) === String(user._id))) fail(404, 'Group conversation not found');
    return group;
  };
  const publicPeer = peer => ({ id: peer.socket.id, authId: String(peer.user._id), name: peer.name, ...peer.status });
  const availability = room => {
    const data = { conversationId: room.id, name: room.name, kind: room.kind, active: room.peers.size > 0, count: room.peers.size };
    for (const id of room.members) emitToUser(id, 'group-call:availability', data);
  };
  const finish = async room => {
    rooms.delete(room.id);
    availability(room);
    for (const id of room.members) emitToUser(id, 'group-call:closed', { conversationId: room.id });
    try { await record({ ...room, duration: room.acceptedAt == null ? 0 : Math.max(0, Math.floor((now() - room.acceptedAt) / 1000)) }); }
    catch (error) { onError('Unable to save group call history', error); }
  };
  const removePeer = (room, peer) => {
    room.peers.delete(peer.socket.id);
    peer.socket.data.groupCallId = null;
    peer.socket.leave(roomKey(room.id));
    io.to(roomKey(room.id)).emit('group-call:peer-left', { id: peer.socket.id });
  };
  const leave = socket => {
    const id = socket.data.groupCallId;
    if (!id) return Promise.resolve();
    return serial(id, async () => {
      const room = rooms.get(id), peer = room?.peers.get(socket.id);
      if (!peer) { socket.data.groupCallId = null; return; }
      removePeer(room, peer);
      if (!room.peers.size) await finish(room); else availability(room);
    });
  };
  const removeMember = (id, authId) => serial(String(id), async () => {
    const room = rooms.get(String(id));
    if (!room) return;
    room.members.delete(String(authId));
    emitToUser(authId, 'group-call:closed', { conversationId: room.id });
    for (const peer of [...room.peers.values()]) {
      if (String(peer.user._id) !== String(authId)) continue;
      removePeer(room, peer);
      peer.socket.emit('group-call:ended', { reason: 'You are no longer a member of this group.' });
    }
    if (!room.peers.size) await finish(room); else availability(room);
  });
  const attach = socket => {
    socket.data ||= {};
    let joining = false, signals = 0, signalWindow = now();
    const action = handler => async (input = {}, ack = () => {}) => {
      try { const data = await handler(input); if (typeof ack === 'function') ack({ success: true, data }); }
      catch (error) { if (typeof ack === 'function') ack({ success: false, message: error.status ? error.message : 'Unable to connect to the group call. Please retry.' }); }
    };
    socket.on('group-call:inspect', action(async ({ conversationId }) => {
      await groupFor(socket.user, conversationId);
      const room = rooms.get(conversationId);
      return { conversationId, active: !!room?.peers.size, kind: room?.kind, count: room?.peers.size || 0 };
    }));
    socket.on('group-call:join', action(async ({ conversationId, kind }) => {
      if (joining) fail(409, 'A join request is already in progress');
      joining = true;
      try {
        const group = await groupFor(socket.user, conversationId);
        if (group.participants.length < 2) fail(400, 'Add another group member before starting a call');
        await leave(socket);
        return await serial(conversationId, async () => {
          // Recheck membership inside the queue, after concurrent removals.
          const current = await groupFor(socket.user, conversationId);
          if (!socket.connected) fail(409, 'Connection closed');
          let room = rooms.get(conversationId);
          if (room?.peers.size >= GROUP_CALL_LIMIT) fail(409, `This call is full (${GROUP_CALL_LIMIT} participants)`);
          if (room && [...room.peers.values()].some(peer => String(peer.user._id) === String(socket.user._id))) fail(409, 'You are already in this call in another tab');
          const fresh = !room;
          if (!room) room = { id: conversationId, callId: randomUUID(), name: current.name || 'Group chat', kind: kind === 'video' ? 'video' : 'voice', caller: socket.user, startedAt: now(), acceptedAt: null, members: new Set(), peers: new Map() };
          room.members = new Set(current.participants.map(member => String(member.authId)));
          const peers = [...room.peers.values()].map(publicPeer);
          const peer = { socket, user: socket.user, name: current.displayName || socket.user.email, status: { mic: false, camera: false, sharing: false, hand: false } };
          await socket.join(roomKey(conversationId));
          rooms.set(conversationId, room); room.peers.set(socket.id, peer); socket.data.groupCallId = conversationId;
          if (room.peers.size > 1 && room.acceptedAt == null) room.acceptedAt = now();
          socket.to(roomKey(conversationId)).emit('group-call:peer-joined', publicPeer(peer));
          if (fresh) for (const id of room.members) if (id !== String(socket.user._id)) emitToUser(id, 'group-call:invite', { conversationId, name: room.name, kind: room.kind, callerName: peer.name });
          availability(room);
          return { self: publicPeer(peer), peers, messages: [] };
        });
      } finally { joining = false; }
    }));
    socket.on('group-call:leave', action(({ conversationId } = {}) => {
      if (conversationId && conversationId !== socket.data.groupCallId) return;
      return leave(socket);
    }));
    socket.on('group-call:status', action(status => {
      const room = rooms.get(socket.data.groupCallId), peer = room?.peers.get(socket.id);
      if (!peer) fail(403, 'Join the call first');
      peer.status = Object.fromEntries(['mic', 'camera', 'sharing', 'hand'].map(key => [key, status[key] === true]));
      io.to(roomKey(room.id)).emit('group-call:peer-updated', publicPeer(peer));
    }));
    socket.on('group-call:signal', (input = {}) => {
      if (now() - signalWindow > 10000) { signals = 0; signalWindow = now(); }
      if (++signals > 300 || !input || typeof input !== 'object') return;
      const room = rooms.get(socket.data.groupCallId), target = room?.peers.get(input.to);
      if (!room?.peers.has(socket.id) || !target || target.socket.id === socket.id) return;
      const { description, candidate } = input;
      if (description && (!['offer', 'answer'].includes(description.type) || typeof description.sdp !== 'string' || description.sdp.length > 100000)) return;
      if (candidate && (typeof candidate.candidate !== 'string' || candidate.candidate.length > 4096)) return;
      if (!description && !candidate) return;
      target.socket.emit('group-call:signal', { from: socket.id, description: description ? { type: description.type, sdp: description.sdp } : undefined, candidate: candidate ? { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex, usernameFragment: candidate.usernameFragment } : undefined });
    });
    socket.on('disconnect', () => { void leave(socket).catch(onError); });
  };
  return { attach, removeMember };
}
