import { client } from '../../config/db.js';
import { createMeetingService, MEETING_LIMIT } from './meetings.service.js';
import { fail } from '../development/development.policy.js';

let runtime;
export const endMeetingRoom = (id, user) => runtime ? runtime.end(String(id), user) : Promise.resolve();
export function createMeetingRuntime(io, service, { now = () => Date.now() } = {}) {
  const rooms = new Map(), queues = new Map();
  const roomKey = id => `meeting:${id}`;
  const serialized = (id, job) => {
    const result = (queues.get(id) || Promise.resolve()).catch(() => {}).then(job);
    queues.set(id, result); result.finally(() => { if (queues.get(id) === result) queues.delete(id); }).catch(() => {});
    return result;
  };
  const publicPeer = peer => ({ id: peer.socket.id, authId: String(peer.user._id), name: peer.name, host: peer.user.role === 'admin', ...peer.status });
  const save = async (room, peer) => service.recordVisit(peer.user, room.event, room.sessionId, peer.joinedAt, now());
  const end = (id, user) => serialized(id, async () => {
    if (user.role !== 'admin') fail(403, 'Only administrators can end meetings');
    const room = rooms.get(id);
    await service.end(user, id);
    if (!room) return;
    // Stop accepting signaling immediately; attendance is persisted before closing.
    rooms.delete(id);
    await Promise.all([...room.peers.values()].map(async peer => {
      try { await save(room, peer); } finally { peer.socket.data.meetingId = null; peer.socket.leave(roomKey(id)); peer.socket.emit('meeting:ended', { reason: 'The host ended this meeting.' }); }
    }));
  });
  const leave = socket => {
    const id = socket.data.meetingId;
    if (!id) return Promise.resolve();
    return serialized(id, async () => {
      const room = rooms.get(id), peer = room?.peers.get(socket.id);
      socket.data.meetingId = null;
      if (!peer) return;
      room.peers.delete(socket.id); socket.leave(roomKey(id));
      await save(room, peer);
      io.to(roomKey(id)).emit('meeting:peer-left', { id: socket.id });
      // A host disconnect ends the room so nobody accrues unattended meeting time.
      if (peer.user.role === 'admin' && ![...room.peers.values()].some(item => item.user.role === 'admin')) {
        await service.end(peer.user, id); rooms.delete(id);
        await Promise.all([...room.peers.values()].map(async item => {
          try { await save(room, item); } finally { item.socket.data.meetingId = null; item.socket.leave(roomKey(id)); item.socket.emit('meeting:ended', { reason: 'The host left the meeting.' }); }
        }));
      }
    });
  };
  const attach = socket => {
    const user = socket.user;
    let busy = false, signalCount = 0, signalWindow = Date.now(), lastChat = 0;
    const action = handler => async (input = {}, ack = () => {}) => {
      try { const data = await handler(input); if (typeof ack === 'function') ack({ success: true, data }); }
      catch (error) { if (typeof ack === 'function') ack({ success: false, message: error.status ? error.message : 'Meeting request failed. Please try again.' }); }
    };
    socket.on('meeting:join', action(async ({ eventId }) => {
      if (busy) fail(409, 'A join request is already in progress');
      busy = true;
      try {
        await leave(socket);
        return await serialized(String(eventId), async () => {
          if (!socket.connected) fail(409, 'Connection closed');
          const info = await service.join(user, eventId);
          let room = rooms.get(String(eventId));
          if (!room) { room = { event: info.event, sessionId: info.meeting.sessionId, peers: new Map(), messages: [] }; }
          if (user.role !== 'admin' && ![...room.peers.values()].some(peer => peer.user.role === 'admin')) fail(409, 'The host has not joined yet. Please try again shortly.');
          if (room.peers.size >= MEETING_LIMIT) fail(409, `This meeting is full (${MEETING_LIMIT} participants)`);
          if ([...room.peers.values()].some(peer => String(peer.user._id) === String(user._id))) fail(409, 'You are already in this meeting in another tab');
          if (!socket.connected) fail(409, 'Connection closed');
          const peers = [...room.peers.values()].map(publicPeer);
          const peer = { socket, user, name: info.name, joinedAt: now(), status: { mic: false, camera: false, sharing: false, hand: false } };
          rooms.set(String(eventId), room); room.peers.set(socket.id, peer);
          socket.data.meetingId = String(eventId); await socket.join(roomKey(eventId));
          socket.to(roomKey(eventId)).emit('meeting:peer-joined', publicPeer(peer));
          return { self: publicPeer(peer), peers, messages: room.messages };
        });
      } finally { busy = false; }
    }));
    socket.on('meeting:leave', action(() => leave(socket)));
    socket.on('meeting:signal', input => {
      if (!input || typeof input !== 'object') return;
      const { to, description, candidate } = input;
      if (Date.now() - signalWindow > 10000) { signalCount = 0; signalWindow = Date.now(); }
      if (++signalCount > 300) return;
      const room = rooms.get(socket.data.meetingId), target = room?.peers.get(to);
      if (!room?.peers.has(socket.id) || !target || target.socket.id === socket.id) return;
      if (description && (!['offer', 'answer'].includes(description.type) || typeof description.sdp !== 'string' || description.sdp.length > 100000)) return;
      if (candidate && (typeof candidate.candidate !== 'string' || candidate.candidate.length > 4096)) return;
      if (!description && !candidate) return;
      target.socket.emit('meeting:signal', { from: socket.id, description: description ? { type: description.type, sdp: description.sdp } : undefined, candidate: candidate ? { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex, usernameFragment: candidate.usernameFragment } : undefined });
    });
    socket.on('meeting:status', action(status => {
      const room = rooms.get(socket.data.meetingId), peer = room?.peers.get(socket.id);
      if (!peer) fail(403, 'Join the meeting first');
      peer.status = Object.fromEntries(['mic', 'camera', 'sharing', 'hand'].map(key => [key, status[key] === true]));
      io.to(roomKey(socket.data.meetingId)).emit('meeting:peer-updated', publicPeer(peer));
    }));
    socket.on('meeting:chat', action(({ text }) => {
      const id = socket.data.meetingId, room = rooms.get(id), peer = room?.peers.get(socket.id);
      if (!peer) fail(403, 'Join the meeting first');
      if (typeof text !== 'string' || !text.trim() || text.length > 1000) fail(400, 'Write a message of up to 1,000 characters');
      if (Date.now() - lastChat < 1000) fail(429, 'Please wait a moment before sending again');
      lastChat = Date.now();
      const message = { id: `${socket.id}:${lastChat}`, name: peer.name, text: text.trim(), sentAt: new Date().toISOString() };
      room.messages.push(message); room.messages = room.messages.slice(-100);
      io.to(roomKey(id)).emit('meeting:chat', message);
    }));
    socket.on('meeting:remove', action(async ({ peerId }) => {
      const id = socket.data.meetingId;
      if (user.role !== 'admin' || !id) fail(403, 'Only the host can remove participants');
      const peer = rooms.get(id)?.peers.get(peerId);
      if (!peer || peer.user.role === 'admin') fail(400, 'Choose a student participant');
      await service.block(user, id, peer.user._id);
      await leave(peer.socket); peer.socket.emit('meeting:ended', { reason: 'The host removed you from this meeting.' });
    }));
    socket.on('disconnect', () => { leave(socket).catch(error => console.error('Unable to save meeting attendance:', error.message)); });
  };
  return { attach, end };
}
export function initializeMeetings(io) {
  runtime = createMeetingRuntime(io, createMeetingService(client.db('SielAlumni')));
  return runtime;
}
