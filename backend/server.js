import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// CORS configuration for local development
app.use(cors({
  origin: CLIENT_URL,
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Keep the existing health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running successfully!',
    timestamp: new Date().toISOString()
  });
});

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Supported files for validation
const ALLOWED_FILES = new Set(['main.js', 'index.html', 'styles.css']);

// Temporary in-memory room code state for active sessions
// Map<roomId, { [fileName]: string }>
const activeRooms = new Map();

// Temporary in-memory collaborator presence per room
// Map<roomId, Map<socketId, { id, name, color, socketId }>>
const roomUsers = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Handle joining a room with user presence details
  socket.on('join-room', (payload) => {
    const rawRoomId = typeof payload === 'object' && payload !== null ? payload.roomId : payload;
    const rawUser = typeof payload === 'object' && payload !== null ? payload.user : null;
    
    // Validation: room ID must be a non-empty short string
    if (typeof rawRoomId !== 'string' || !rawRoomId.trim() || rawRoomId.trim().length > 64) {
      console.warn(`[Invalid Room ID] Socket ${socket.id} attempted to join with:`, rawRoomId);
      return;
    }

    const roomId = rawRoomId.trim();
    socket.join(roomId);
    socket.data.currentRoom = roomId;

    // Validate and sanitize user identity
    const sanitizedUser = {
      id: typeof rawUser?.id === 'string' && rawUser.id.trim() ? rawUser.id.trim().slice(0, 64) : socket.id,
      name: typeof rawUser?.name === 'string' && rawUser.name.trim() ? rawUser.name.trim().slice(0, 32) : `Guest ${Math.floor(1000 + Math.random() * 9000)}`,
      color: typeof rawUser?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawUser.color) ? rawUser.color : '#6366f1',
      socketId: socket.id
    };

    socket.data.currentUser = sanitizedUser;

    // Track user presence in this room
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Map());
    }
    const usersInRoom = roomUsers.get(roomId);
    usersInRoom.set(socket.id, sanitizedUser);

    // Send latest room code if already modified in this session
    if (activeRooms.has(roomId)) {
      socket.emit('room-sync', activeRooms.get(roomId));
    }

    // Broadcast updated presence list & count to everyone in the room
    const currentUsers = Array.from(usersInRoom.values());
    io.to(roomId).emit('room-users', { users: currentUsers });
    io.to(roomId).emit('room-participants', { count: currentUsers.length });

    console.log(`[Room: ${roomId}] ${sanitizedUser.name} (${socket.id}) joined. Total online: ${currentUsers.length}`);
  });

  // Handle real-time code changes
  socket.on('code-change', (data) => {
    if (!data || typeof data !== 'object') {
      return;
    }

    const { roomId, fileName, content } = data;

    // Validation:
    // 1. roomId must be a valid non-empty string
    // 2. fileName must only be one of the supported files
    // 3. content must be a string
    if (
      typeof roomId !== 'string' ||
      !roomId.trim() ||
      roomId.trim().length > 64 ||
      !ALLOWED_FILES.has(fileName) ||
      typeof content !== 'string'
    ) {
      console.warn(`[Rejected Invalid code-change] Socket ${socket.id}`, { roomId, fileName, contentType: typeof content });
      return;
    }

    const cleanRoomId = roomId.trim();

    // Update temporary in-memory room session state
    if (!activeRooms.has(cleanRoomId)) {
      activeRooms.set(cleanRoomId, {});
    }
    activeRooms.get(cleanRoomId)[fileName] = content;

    // Broadcast update to all other sockets in the room (not back to sender)
    socket.to(cleanRoomId).emit('code-change', {
      fileName,
      content
    });
  });

  // Handle socket disconnecting to accurately update presence and participant counts
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id && roomUsers.has(room)) {
        const usersInRoom = roomUsers.get(room);
        usersInRoom.delete(socket.id);

        const remainingUsers = Array.from(usersInRoom.values());
        if (remainingUsers.length === 0) {
          roomUsers.delete(room);
        } else {
          socket.to(room).emit('room-users', { users: remainingUsers });
          socket.to(room).emit('room-participants', { count: remainingUsers.length });
        }
        console.log(`[Room: ${room}] User left (${socket.id}). Remaining: ${remainingUsers.length}`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 CodeCollab Backend running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO listening with CORS allowed for ${CLIENT_URL}`);
});
