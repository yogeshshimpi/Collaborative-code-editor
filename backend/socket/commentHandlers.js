import {
  createCodeComment,
  replyCodeComment,
  resolveCodeComment,
  deleteCodeComment
} from '../db/comments.js';
import { createMentionNotifications } from '../db/notifications.js';
import { logger } from '../utils/logger.js';

export async function handleCreateComment(io, socket, data) {
  try {
    const { roomId, projectId, filePath, lineNumber, endLineNumber, lineContent, content, mentions } = data || {};
    const targetRoom = roomId || socket.data.currentRoom || 'demo-room';

    if (socket.data?.role === 'viewer') {
      socket.emit('comment:error', {
        message: 'Viewer permission: code comments are disabled.'
      });
      return;
    }

    if (!filePath || !lineNumber || !content || !content.trim()) return;

    const user = socket.user || socket.data.currentUser || { name: 'Collaborator', color: '#6366f1' };
    const authorId = socket.user?.id || null;
    const authorName = user.name || 'Collaborator';
    const authorColor = user.color || '#6366f1';

    const newComment = await createCodeComment({
      projectId,
      roomId: targetRoom,
      filePath,
      lineNumber: Number(lineNumber),
      endLineNumber: endLineNumber ? Number(endLineNumber) : null,
      lineContent,
      authorId,
      authorName,
      authorColor,
      content,
      mentions
    });

    if (newComment.mentions && newComment.mentions.length > 0) {
      try {
        const notifs = await createMentionNotifications({
          mentions: newComment.mentions,
          senderId: authorId,
          senderName: authorName,
          projectId,
          roomId: targetRoom,
          type: 'comment_mention',
          body: `Line ${lineNumber} in ${filePath}: ${content.slice(0, 100)}`,
          referenceId: newComment.id,
          metadata: { filePath, lineNumber, commentId: newComment.id }
        });

        for (const n of notifs) {
          io.to(`user:${n.userId}`).emit('notification:new', { notification: n });
        }
      } catch (err) {
        logger.warn('[Socket Comments] Mention dispatch error:', err.message);
      }
    }

    io.to(targetRoom).emit('comment:new', { comment: newComment });
    if (projectId && projectId !== targetRoom) {
      io.to(projectId).emit('comment:new', { comment: newComment });
    }
  } catch (err) {
    logger.error('[Socket Comments] Error creating comment:', err.message);
    socket.emit('comment:error', { message: err.message });
  }
}

export async function handleReplyComment(io, socket, data) {
  try {
    const { roomId, projectId, parentId, content, mentions } = data || {};
    const targetRoom = roomId || socket.data.currentRoom || 'demo-room';

    if (socket.data?.role === 'viewer') {
      socket.emit('comment:error', {
        message: 'Viewer permission: code comments are disabled.'
      });
      return;
    }

    const user = socket.user || socket.data.currentUser || { name: 'Collaborator', color: '#6366f1' };
    const authorId = socket.user?.id || null;
    const authorName = user.name || 'Collaborator';
    const authorColor = user.color || '#6366f1';

    const reply = await replyCodeComment({
      projectId,
      roomId: targetRoom,
      parentId,
      authorId,
      authorName,
      authorColor,
      content,
      mentions
    });

    io.to(targetRoom).emit('comment:reply-added', { parentId, reply });
    if (projectId && projectId !== targetRoom) {
      io.to(projectId).emit('comment:reply-added', { parentId, reply });
    }
  } catch (err) {
    logger.error('[Socket Comments] Error replying to comment:', err.message);
    socket.emit('comment:error', { message: err.message });
  }
}

export async function handleResolveComment(io, socket, data) {
  try {
    const { roomId, projectId, commentId, isResolved } = data || {};
    const targetRoom = roomId || socket.data.currentRoom || 'demo-room';

    if (socket.data?.role === 'viewer') {
      socket.emit('comment:error', {
        message: 'Viewer permission: comment resolution is disabled.'
      });
      return;
    }

    const userId = socket.user?.id || null;
    const user = socket.user || socket.data.currentUser || { name: 'Collaborator' };

    const resolved = await resolveCodeComment({
      commentId,
      userId,
      isResolved: Boolean(isResolved)
    });

    io.to(targetRoom).emit('comment:status-changed', {
      commentId,
      isResolved: resolved.isResolved,
      resolvedBy: user.name
    });
    if (projectId && projectId !== targetRoom) {
      io.to(projectId).emit('comment:status-changed', {
        commentId,
        isResolved: resolved.isResolved,
        resolvedBy: user.name
      });
    }
  } catch (err) {
    logger.error('[Socket Comments] Error resolving comment:', err.message);
    socket.emit('comment:error', { message: err.message });
  }
}

export async function handleDeleteComment(io, socket, data) {
  try {
    const { roomId, projectId, commentId } = data || {};
    const targetRoom = roomId || socket.data.currentRoom || 'demo-room';
    const isOwner = socket.data?.role === 'owner';
    const userId = socket.user?.id || null;

    await deleteCodeComment({
      commentId,
      userId,
      isOwner
    });

    io.to(targetRoom).emit('comment:deleted', { commentId });
    if (projectId && projectId !== targetRoom) {
      io.to(projectId).emit('comment:deleted', { commentId });
    }
  } catch (err) {
    logger.error('[Socket Comments] Error deleting comment:', err.message);
    socket.emit('comment:error', { message: err.message });
  }
}

export default {
  handleCreateComment,
  handleReplyComment,
  handleResolveComment,
  handleDeleteComment
};
