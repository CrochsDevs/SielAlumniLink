import { Server } from 'socket.io';
import { frontendOrigins, allowedSocketOrigin } from '../config/cors.js';
import { verifySessionToken, sessionMatches } from '../modules/auth/session-token.js';
import { sessionEvents } from '../modules/auth/session-events.js';
import AuthModel from '../modules/auth/auth.models.js';
import PresenceStore from './presence.store.js';
import { initializeMeetings } from '../modules/meetings/meetings.socket.js';
import { createCallService } from './calls.js';
import { createGroupCallRuntime } from './group-calls.js';
import UserModel from '../modules/users/users.models.js';
import ConnectionModel from '../modules/connections/connections.models.js';
import { ConversationModel, MessageModel } from '../modules/messages/messages.models.js';

let io = null;
let groupCalls = null;
export const removeGroupCallMember = (id, authId) => groupCalls?.removeMember(id, authId);

const broadcastPresence = () => {
  if (io) {
    io.to('role:admin').emit('presence:update', PresenceStore.snapshot());
  }
};

// We only need one cookie (`token`), so a tiny parser beats a dependency.
const getTokenFromHeader = (header) => {
  if (!header) return null;
  const match = header.split(';').find((part) => part.trim().startsWith('token='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=').trim()) : null;
};
const authenticate = async (socket, next) => {
  try {
    const token = getTokenFromHeader(socket.handshake.headers.cookie);

    if (!token) {
      return next(new Error('Missing auth token'));
    }

    const decoded = verifySessionToken(token);
    const user = await AuthModel.findById(decoded.sub);

    if (!sessionMatches(decoded, user)) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    socket.sessionToken = token;
    socket.sessionExpiresAt = decoded.exp * 1000;
    next();
  } catch {
    next(new Error('Invalid auth token'));
  }
};

export const initSocket = (server) => {
  io = new Server(server, {
    allowRequest: (req, callback) => callback(null, allowedSocketOrigin(req.headers.origin)),
    cors: {
      origin: frontendOrigins,
      credentials: true,
    },
  });

  io.use(authenticate);
  const revoke = authId => {
    io.to(`user:${authId}`).emit('auth:revoked');
    io.in(`user:${authId}`).disconnectSockets(true);
  };
  sessionEvents.on('revoked', revoke);
  server.once('close', () => sessionEvents.off('revoked', revoke));
  const meetings = initializeMeetings(io);
  groupCalls = createGroupCallRuntime(io, {
    emitToUser,
    authorize: async (user, id) => {
      const group = await ConversationModel.findById(id);
      if (!group?.isGroup || !group.participants.some(member => String(member.authId) === String(user._id))) return null;
      const profile = await UserModel.findByAuthId(user._id);
      return { ...group, displayName: profile?.name || user.email };
    },
    record: async call => {
      const group = await ConversationModel.findById(call.id);
      if (!group) return;
      const label = `Group ${call.kind === 'video' ? 'video' : 'voice'} call`;
      const text = call.acceptedAt == null ? `${label} ended without other participants` : `${label} ended - ${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}`;
      const message = await MessageModel.create({ conversationId: call.id, senderAuthId: call.caller._id, senderEmail: call.caller.email, text, call: { id: call.callId, kind: call.kind, status: call.acceptedAt == null ? 'missed' : 'completed', duration: call.duration, group: true } });
      const lastMessage = { text, at: message.createdAt, by: String(call.caller._id) };
      await ConversationModel.touch(call.id, lastMessage);
      for (const participant of group.participants) emitToUser(participant.authId, 'message:new', { conversationId: call.id, message: { ...message, at: message.createdAt }, lastMessage });
    },
  });
  const calls = createCallService({
    emit: emitToUser,
    authorize: async (caller, recipientId) => {
      const recipient = await AuthModel.findById(recipientId);
      if (!recipient) return null;
      if (caller.role !== 'admin') {
        const connections = await ConnectionModel.findMine(caller._id);
        if (!connections.some(c => c.status === 'accepted' &&
          [String(c.requesterAuthId), String(c.recipientAuthId)].includes(String(recipientId)))) return null;
      }
      return recipient;
    },
    record: async (call) => {
      const convo = await ConversationModel.getOrCreate(call.caller._id, call.caller.email, call.recipient._id, call.recipient.email);
      const label = call.kind === 'video' ? 'Video call' : 'Voice call';
      const duration = `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}`;
      const text = call.status === 'completed' ? `${label} ended - ${duration}` :
        call.status === 'declined' ? `${label} declined` : `Missed ${label.toLowerCase()}`;
      const message = await MessageModel.create({
        conversationId: convo._id, senderAuthId: call.caller._id, senderEmail: call.caller.email,
        text, call: { id: call.id, kind: call.kind, status: call.status, duration: call.duration },
      });
      const lastMessage = { text, at: message.createdAt, by: String(call.caller._id) };
      await ConversationModel.touch(convo._id, lastMessage);
      for (const participant of convo.participants)
        emitToUser(participant.authId, 'message:new', { conversationId: String(convo._id), message: { ...message, at: message.createdAt }, lastMessage });
    },
  });

  io.on('connection', (socket) => {
    if (socket.sessionExpiresAt <= Date.now()) { socket.disconnect(true); return; }
    const validate = async () => {
      try {
        const claims = verifySessionToken(socket.sessionToken);
        const current = await AuthModel.findById(claims.sub);
        if (!sessionMatches(claims, current) || current.role !== socket.user.role) throw new Error('Session revoked');
        socket.user = current;
        return true;
      } catch {
        socket.emit('auth:revoked'); socket.disconnect(true); return false;
      }
    };
    socket.use(async (_packet, next) => {
      if (await validate()) next();
      else next(new Error('Authentication required'));
    });
    const timer = setInterval(() => { void validate(); }, 30000);
    timer.unref();
    const expires = socket.sessionExpiresAt;
    const expiryTimer = setTimeout(() => { void validate(); }, Math.max(1, expires - Date.now() + 1));
    expiryTimer.unref();
    socket.on('disconnect', () => { clearInterval(timer); clearTimeout(expiryTimer); });
    meetings.attach(socket);
    groupCalls.attach(socket);
    const authId = String(socket.user._id);
    // Personal room so the server can push to all of a user's tabs.
    socket.join(`user:${authId}`);
    if (String(socket.user.role).toLowerCase() === 'admin') socket.join('role:admin');
    PresenceStore.markOnline(socket.user._id);

    // Only the administrator directory consumes the global presence list.
    broadcastPresence();

    // WebRTC call signaling relay (voice/video). The server never
    // touches media — it only forwards envelopes between users.
    // Payload: { toAuthId, kind: 'invite'|'accept'|'decline'|'signal'|'end', data }
    socket.on('call:signal', payload => {
      void calls.signal(socket, payload).catch(error => console.error('Call signaling failed', error));
    });

    socket.on('disconnect', () => {
      calls.disconnect(socket);
      PresenceStore.markOffline(authId);
      broadcastPresence();
    });
  });

  return io;
};

export const getIO = () => io;

// Push an event to every connected socket of one user.
export const emitToUser = (authId, event, payload) => {
  if (io) {
    io.to(`user:${String(authId)}`).emit(event, payload);
  }
};

// Admin directory invalidations contain IDs only; clients reload through protected APIs.
export const emitConnectionsChanged = (connection) => {
  if (!io) return;
  io.emit('feed:changed');
  io.to('role:admin').emit('connections:changed', {
    authIds: [connection.requesterAuthId, connection.recipientAuthId].filter(Boolean).map(String),
  });
};

export default { initSocket, getIO, emitToUser };
