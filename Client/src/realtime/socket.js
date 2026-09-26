import { io } from 'socket.io-client';

// Singleton Socket.IO client. Auth rides the httpOnly `token` cookie,
// so we connect with credentials and never handle the JWT in JS.
let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io('http://localhost:3002', {
      autoConnect: false,
      withCredentials: true,
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
};

export const disconnectSocket = () => {
  if (socket?.connected) {
    socket.disconnect();
  }
};
