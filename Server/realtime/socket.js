import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import AuthModel from '../modules/auth/auth.models.js';
import PresenceStore from './presence.store.js';

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

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
      origin: FRONTEND_URL,
      credentials: true,
    },
  });

  io.use(authenticate);

  io.on('connection', (socket) => {
    const authId = String(socket.user._id);
    PresenceStore.markOnline(socket.user._id, socket.user.email);

    // Tell everyone (including the newcomer) who is online.
    broadcastPresence();

    socket.on('disconnect', () => {
      PresenceStore.markOffline(authId);
      broadcastPresence();
    });
  });

  return io;
};

export const getIO = () => io;

export default { initSocket, getIO };
