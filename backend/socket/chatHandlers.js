import {
  createChatMessage,
  editChatMessage,
  deleteChatMessage
} from '../db/chat.js';
import { createMentionNotifications } from '../db/notifications.js';
import { logger } from '../utils/logger.js';

export async function handleChatMessage(io, socket, data) {
  try {
    const { roomId, projectId, message, mentions } = data || {};
    const targetRoom = roomId || socket.data.currentRoom || 'demo-room';

    // Viewer role check: Viewers cannot send chat messages
    if (socket.data?.role === 'viewer') {
      socket.emit('chat:error', {
        message: 'Viewer permission: chat messages are disabled.'
      });
      return;
    }

    if (!message || !message.trim()) return;

    const user = socket.user || socket.data.currentUser || { name: 'Anonymous', color: '#6366f1' };
    const senderId = socket.user?.id || null;
    const senderName = user.name || 'Anonymous';
    const senderColor = user.color || '#6366f1';

    // Generate immediate broadcast payload with unique client-safe ID
    const immediateId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const immediateMsg = {
      id: immediateId,
      projectId,
      roomId: targetRoom,
      senderId,
      senderName,
      senderColor,
      sender_id: senderId,
      sender_name: senderName,
      sender_color: senderColor,
      message,
      mentions: mentions || [],
      createdAt: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // 1. Broadcast to room immediately (~10ms delivery)
    socket.to(targetRoom).emit('chat:new-message', { message: immediateMsg });
    if (projectId && projectId !== targetRoom) {
      socket.to(projectId).emit('chat:new-message', { message: immediateMsg });
    }

    // 2. Persist to PostgreSQL in background asynchronously
    createChatMessage({
      projectId,
      roomId: targetRoom,
      senderId,
      senderName,
      senderColor,
      message,
      mentions
    }).then(async (persistedMsg) => {
      // Confirm persistence to sender socket
      socket.emit('chat:message-confirmed', {
        tempId: immediateId,
        message: persistedMsg
      });

      // Dispatch mention notifications if needed
      if (persistedMsg.mentions && persistedMsg.mentions.length > 0) {
        try {
          const notifs = await createMentionNotifications({
            mentions: persistedMsg.mentions,
            senderId,
            senderName,
            projectId,
            roomId: targetRoom,
            type: 'chat_mention',
            body: message.slice(0, 150),
            referenceId: persistedMsg.id,
            metadata: { messageId: persistedMsg.id }
          });

          for (const n of notifs) {
            io.to(`user:${n.userId}`).emit('notification:new', { notification: n });
          }
        } catch (err) {
          logger.warn('[Socket Chat] Mention dispatch error:', err.message);
        }
      }
    }).catch((err) => {
      logger.error('[Socket Chat] Background persist error:', err.message);
      socket.emit('chat:error', { message: 'Failed to persist message' });
    });
  } catch (err) {
    logger.error('[Socket Chat] Error handling chat message:', err.message);
    socket.emit('chat:error', { message: err.message });
  }
}

export async function handleEditChatMessage(io, socket, data) {
  try {
    const { roomId, projectId, messageId, newMessage } = data || {};
    const targetRoom = roomId || socket.data.currentRoom || 'demo-room';
    const isOwner = socket.data?.role === 'owner';
    const senderId = socket.user?.id || null;

    const updated = await editChatMessage({
      messageId,
      senderId,
      newMessage,
      isOwner
    });

    io.to(targetRoom).emit('chat:message-edited', {
      messageId: updated.id,
      newMessage: updated.message,
      editedAt: updated.editedAt,
      mentions: updated.mentions
    });
    if (projectId && projectId !== targetRoom) {
      io.to(projectId).emit('chat:message-edited', {
        messageId: updated.id,
        newMessage: updated.message,
        editedAt: updated.editedAt,
        mentions: updated.mentions
      });
    }
  } catch (err) {
    logger.error('[Socket Chat] Error editing chat message:', err.message);
    socket.emit('chat:error', { message: err.message });
  }
}

export async function handleDeleteChatMessage(io, socket, data) {
  try {
    const { roomId, projectId, messageId } = data || {};
    const targetRoom = roomId || socket.data.currentRoom || 'demo-room';
    const isOwner = socket.data?.role === 'owner';
    const userId = socket.user?.id || null;
    const userName = socket.user?.name || socket.data?.currentUser?.name || 'User';

    const deleted = await deleteChatMessage({
      messageId,
      userId,
      userName,
      isOwner,
      projectId,
      roomId: targetRoom
    });

    io.to(targetRoom).emit('chat:message-deleted', {
      messageId: deleted.id,
      deletedAt: deleted.deletedAt
    });
    if (projectId && projectId !== targetRoom) {
      io.to(projectId).emit('chat:message-deleted', {
        messageId: deleted.id,
        deletedAt: deleted.deletedAt
      });
    }
  } catch (err) {
    logger.error('[Socket Chat] Error deleting chat message:', err.message);
    socket.emit('chat:error', { message: err.message });
  }
}

export function handleChatTyping(io, socket, data) {
  const { roomId, isTyping } = data || {};
  const targetRoom = roomId || socket.data.currentRoom || 'demo-room';
  const user = socket.user || socket.data.currentUser || { name: 'Collaborator' };

  socket.to(targetRoom).emit('chat:user-typing', {
    userId: user.id || socket.id,
    userName: user.name,
    isTyping: Boolean(isTyping)
  });
}

export default {
  handleChatMessage,
  handleEditChatMessage,
  handleDeleteChatMessage,
  handleChatTyping
};
