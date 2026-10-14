import { handleJoinRoom, handleDisconnecting, handleDisconnect } from './roomHandlers.js';
import { handleCodeChange } from './editorHandlers.js';
import {
  handleCreateFile,
  handleCreateFolder,
  handleRenameFile,
  handleRenameFolder,
  handleDeleteFile,
  handleDeleteFolder,
  handleMoveItem
} from './fileHandlers.js';
import { handleCursorChange, handleCursorClear } from './presenceHandlers.js';
import {
  handleChatMessage,
  handleEditChatMessage,
  handleDeleteChatMessage,
  handleChatTyping
} from './chatHandlers.js';
import {
  handleCreateComment,
  handleReplyComment,
  handleResolveComment,
  handleDeleteComment
} from './commentHandlers.js';
import { logger } from '../utils/logger.js';

export function registerSocketHandlers(io) {
  // Map<roomId, Map<socketId, { id, name, color, socketId, activeFile, role }>>
  const roomUsers = new Map();

  io.on('connection', (socket) => {
    logger.info(`[Socket Connected] ID: ${socket.id}`);

    // Join room
    socket.on('join-room', (payload) => handleJoinRoom(io, socket, roomUsers, payload));

    // Real-time code change
    socket.on('code-change', (data) => handleCodeChange(io, socket, data));

    // File & folder operations
    socket.on('create-file', (data) => handleCreateFile(io, socket, data));
    socket.on('create-folder', (data) => handleCreateFolder(io, socket, data));
    socket.on('rename-file', (data) => handleRenameFile(io, socket, data));
    socket.on('rename-folder', (data) => handleRenameFolder(io, socket, data));
    socket.on('delete-file', (data) => handleDeleteFile(io, socket, data));
    socket.on('delete-folder', (data) => handleDeleteFolder(io, socket, data));
    socket.on('move-item', (data) => handleMoveItem(io, socket, data));

    // Collaborator cursor & presence
    socket.on('cursor-change', (data) => handleCursorChange(io, socket, roomUsers, data));
    socket.on('cursor-clear', (data) => handleCursorClear(socket, data));

    // Real-time Project Chat
    socket.on('chat:send-message', (data) => handleChatMessage(io, socket, data));
    socket.on('chat:edit-message', (data) => handleEditChatMessage(io, socket, data));
    socket.on('chat:delete-message', (data) => handleDeleteChatMessage(io, socket, data));
    socket.on('chat:typing', (data) => handleChatTyping(io, socket, data));

    // Real-time Code Comments
    socket.on('comment:create', (data) => handleCreateComment(io, socket, data));
    socket.on('comment:reply', (data) => handleReplyComment(io, socket, data));
    socket.on('comment:resolve', (data) => handleResolveComment(io, socket, data));
    socket.on('comment:delete', (data) => handleDeleteComment(io, socket, data));

    // Disconnect events
    socket.on('disconnecting', () => handleDisconnecting(io, socket, roomUsers));
    socket.on('disconnect', () => handleDisconnect(socket));
  });
}

export default registerSocketHandlers;
