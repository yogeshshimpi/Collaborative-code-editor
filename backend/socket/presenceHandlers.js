import { isValidFilePath } from '../utils/filePath.js';

export function handleCursorChange(io, socket, roomUsers, data) {
  if (!data || typeof data !== 'object') {
    return;
  }

  const { roomId, fileName, cursor, selection } = data;

  // Validate roomId and active file
  if (
    typeof roomId !== 'string' ||
    !roomId.trim() ||
    socket.data.currentRoom !== roomId.trim() ||
    !isValidFilePath(fileName)
  ) {
    return;
  }

  const cleanRoomId = roomId.trim();
  const currentUser = socket.data.currentUser;
  if (!currentUser) {
    return;
  }

  // Update activeFile in room presence
  const oldFile = currentUser.activeFile;
  currentUser.activeFile = fileName;
  const usersInRoom = roomUsers.get(cleanRoomId);
  if (usersInRoom && usersInRoom.has(socket.id)) {
    usersInRoom.set(socket.id, currentUser);
    if (oldFile !== fileName) {
      io.to(cleanRoomId).emit('room-users', { users: Array.from(usersInRoom.values()) });
    }
  }

  // Broadcast cursor position and selection range to all other users in the room
  socket.to(cleanRoomId).emit('cursor-change', {
    socketId: socket.id,
    userId: currentUser.id,
    userName: currentUser.name,
    userColor: currentUser.color,
    fileName,
    cursor: cursor && typeof cursor === 'object'
      ? {
          line: Math.max(1, Number(cursor.line) || 1),
          column: Math.max(1, Number(cursor.column) || 1)
        }
      : null,
    selection: selection && typeof selection === 'object'
      ? {
          startLineNumber: Math.max(1, Number(selection.startLineNumber) || 1),
          startColumn: Math.max(1, Number(selection.startColumn) || 1),
          endLineNumber: Math.max(1, Number(selection.endLineNumber) || 1),
          endColumn: Math.max(1, Number(selection.endColumn) || 1)
        }
      : null
  });
}

export function handleCursorClear(socket, data) {
  const rawRoomId = typeof data === 'object' && data !== null ? data.roomId : socket.data.currentRoom;
  if (typeof rawRoomId === 'string' && rawRoomId.trim()) {
    const cleanRoomId = rawRoomId.trim();
    socket.to(cleanRoomId).emit('cursor-clear', {
      socketId: socket.id,
      userId: socket.data.currentUser?.id
    });
  }
}

export default {
  handleCursorChange,
  handleCursorClear
};
