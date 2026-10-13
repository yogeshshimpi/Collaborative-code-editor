import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { corsOriginValidator } from './cors.js';
import { JWT_SECRET, COOKIE_NAME } from './env.js';

export function configureSocketIO(server) {
  const io = new Server(server, {
    cors: {
      origin: corsOriginValidator,
      credentials: true,
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Socket.IO authentication middleware via HttpOnly cookie or auth handshake token
  io.use((socket, next) => {
    try {
      let token = null;
      const rawCookie = socket.handshake.headers.cookie;
      if (rawCookie) {
        const parsed = parseCookie(rawCookie);
        token = parsed[COOKIE_NAME];
      }
      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
      }
    } catch {
      // If token is invalid or expired, continue as guest
      socket.user = null;
    }
    next();
  });

  return io;
}

export default configureSocketIO;
