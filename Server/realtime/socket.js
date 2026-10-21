import { Server } from 'socket.io';
import { frontendOrigins } from '../config/cors.js';
import jwt from 'jsonwebtoken';
import AuthModel from '../modules/auth/auth.models.js';
import PresenceStore from './presence.store.js';
import { initializeMeetings } from '../modules/meetings/meetings.socket.js';
import { createCallService } from './calls.js';
import ConnectionModel from '../modules/connections/connections.models.js';
import { ConversationModel, MessageModel } from '../modules/messages/messages.models.js';

const JWT_SECRET = process.env.JWT_SECRET;

let io = null;

const broadcastPresence = () => {
  if (io) {
    io.emit('presence:update', PresenceStore.snapshot());
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

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await AuthModel.findByEmail(decoded.email);

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid auth token'));
  }
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: frontendOrigins,
      credentials: true,
    },
  });

  io.use(authenticate);
  const meetings = initializeMeetings(io);
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
    meetings.attach(socket);
    const authId = String(socket.user._id);
    // Personal room so the server can push to all of a user's tabs.
    socket.join(`user:${authId}`);
    if (String(socket.user.role).toLowerCase() === 'admin') socket.join('role:admin');
    PresenceStore.markOnline(socket.user._id, socket.user.email);

    // Tell everyone (including the newcomer) who is online.
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
