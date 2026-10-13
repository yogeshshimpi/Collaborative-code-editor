import { getProjectById } from '../db/projects.js';
import { getRoomWorkspace } from '../db/workspace.js';
import { isValidFilePath } from '../utils/filePath.js';
import { logger } from '../utils/logger.js';

export async function handleJoinRoom(io, socket, roomUsers, payload) {
  const rawRoomId = typeof payload === 'object' && payload !== null ? payload.roomId : payload;
  const rawUser = typeof payload === 'object' && payload !== null ? payload.user : null;

  // Validation: room ID must be a non-empty short string
  if (typeof rawRoomId !== 'string' || !rawRoomId.trim() || rawRoomId.trim().length > 64) {
    logger.warn(`[Invalid Room ID] Socket ${socket.id} attempted to join with:`, rawRoomId);
    return;
  }

  const roomId = rawRoomId.trim();
  socket.join(roomId);
  socket.data.currentRoom = roomId;

  // Determine user identity: Use authenticated user if session cookie is present, else guest identity
  const authUser = socket.user || socket.data.authenticatedUser;
  const initialActiveFile = typeof rawUser?.activeFile === 'string' && isValidFilePath(rawUser.activeFile) ? rawUser.activeFile : 'main.js';
  const sanitizedUser = authUser
    ? {
        id: `auth-${authUser.id}`,
        name: authUser.name,
        color: rawUser?.color || '#6366f1',
        isAuthenticated: true,
        socketId: socket.id,
        activeFile: initialActiveFile
      }
    : {
        id: typeof rawUser?.id === 'string' && rawUser.id.trim() ? rawUser.id.trim().slice(0, 64) : socket.id,
        name: typeof rawUser?.name === 'string' && rawUser.name.trim() ? rawUser.name.trim().slice(0, 32) : `Guest ${Math.floor(1000 + Math.random() * 9000)}`,
        color: typeof rawUser?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawUser.color) ? rawUser.color : '#6366f1',
        isAuthenticated: false,
        socketId: socket.id,
        activeFile: initialActiveFile
      };

  // Determine project access and user role
  let userRole = 'editor';
  let matchedProject = null;
  if (authUser) {
    try {
      matchedProject = await getProjectById(roomId, authUser.id);
      if (matchedProject?.role) {
        userRole = matchedProject.role;
      }
    } catch (err) {
      logger.warn(`[Role Check Error] Could not retrieve role for ${authUser.id}:`, err.message);
    }
  }
  socket.data.role = userRole;
  sanitizedUser.role = userRole;
  socket.data.currentUser = sanitizedUser;

  // Send user their role and project info in this workspace
  socket.emit('user-role', { role: userRole });
  if (matchedProject) {
    socket.emit('project-info', {
      id: matchedProject.id,
      name: matchedProject.name,
      roomId: matchedProject.room_id,
      role: userRole
    });
    // Also join canonical room if rawRoomId was project name or UUID
    if (matchedProject.room_id && matchedProject.room_id !== roomId) {
      socket.join(matchedProject.room_id);
    }
  }

  // Target room for presence & workspace (prefer project's canonical room_id)
  const targetRoom = matchedProject?.room_id || roomId;

  // Track user presence in this room
  if (!roomUsers.has(targetRoom)) {
    roomUsers.set(targetRoom, new Map());
  }
  const usersInRoom = roomUsers.get(targetRoom);
  usersInRoom.set(socket.id, sanitizedUser);

  // Retrieve persisted room workspace (files and folders) from PostgreSQL
  const workspace = await getRoomWorkspace(targetRoom);
  socket.emit('room-sync', workspace);

  // Broadcast updated presence list & count to everyone in the room
  const currentUsers = Array.from(usersInRoom.values());
  io.to(targetRoom).emit('room-users', { users: currentUsers });
  io.to(targetRoom).emit('room-participants', { count: currentUsers.length });
  if (targetRoom !== roomId) {
    io.to(roomId).emit('room-users', { users: currentUsers });
    io.to(roomId).emit('room-participants', { count: currentUsers.length });
  }

  logger.info(`[Room: ${targetRoom}] ${sanitizedUser.name} (${socket.id}) joined as ${userRole}. Total online: ${currentUsers.length}`);
}

export function handleDisconnecting(io, socket, roomUsers) {
  for (const room of socket.rooms) {
    if (room !== socket.id && roomUsers.has(room)) {
      // Emit cursor-clear to room immediately
      socket.to(room).emit('cursor-clear', {
        socketId: socket.id,
        userId: socket.data.currentUser?.id
      });

      const usersInRoom = roomUsers.get(room);
      usersInRoom.delete(socket.id);

      const remainingUsers = Array.from(usersInRoom.values());
      if (remainingUsers.length === 0) {
        roomUsers.delete(room);
      } else {
        socket.to(room).emit('room-users', { users: remainingUsers });
        socket.to(room).emit('room-participants', { count: remainingUsers.length });
      }
      logger.info(`[Room: ${room}] User left (${socket.id}). Remaining: ${remainingUsers.length}`);
    }
  }
}

export function handleDisconnect(socket) {
  logger.info(`[Socket Disconnected] ID: ${socket.id}`);
}

export default {
  handleJoinRoom,
  handleDisconnecting,
  handleDisconnect
};
