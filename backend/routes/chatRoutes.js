import express from 'express';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { getProjectById } from '../db/projects.js';
import {
  getProjectChatMessages,
  createChatMessage,
  editChatMessage,
  deleteChatMessage
} from '../db/chat.js';
import { createMentionNotifications } from '../db/notifications.js';

const router = express.Router();
router.use(optionalAuth);

async function resolveProject(req, res, next) {
  const projectId = req.params.id;
  const isDemo = projectId === 'demo-room' || projectId === 'default';

  if (!req.user) {
    if (isDemo) {
      req.user = {
        id: 0,
        name: req.body?.senderName || 'Demo Collaborator',
        email: 'demo@codecollab.dev'
      };
    } else {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }
  }

  let project = await getProjectById(projectId, req.user?.id);
  if (!project) {
    project = {
      id: projectId,
      room_id: projectId,
      name: isDemo ? 'Demo Project' : `Room ${projectId}`,
      role: 'editor',
      requires_approval: false,
      protected_files: []
    };
  }

  req.project = project;
  next();
}

/**
 * GET /api/projects/:id/chat
 * Fetch chat message history for project
 */
router.get('/:id/chat', resolveProject, async (req, res) => {
  try {
    const project = req.project;
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const messages = await getProjectChatMessages({
      projectId: project.id,
      roomId: project.room_id,
      limit
    });

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch chat messages' });
  }
});

/**
 * POST /api/projects/:id/chat
 * Send a chat message (Owner & Editor only. Viewer blocked.)
 */
router.post('/:id/chat', resolveProject, async (req, res) => {
  try {
    const project = req.project;

    // Role enforcement: Viewer cannot send messages
    if (project.role === 'viewer') {
      return res.status(403).json({
        error: 'Viewer permission: chat messages are disabled.'
      });
    }

    const raw = req.body?.message ?? req.body?.text ?? req.body?.content ?? (typeof req.body === 'string' ? req.body : '');
    const cleanMsg = typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
    if (!cleanMsg) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    const mentions = req.body?.mentions || [];

    const newMsg = await createChatMessage({
      projectId: project.id,
      roomId: project.room_id,
      senderId: req.user.id,
      senderName: req.user.name,
      senderColor: req.body.senderColor || '#6366f1',
      message: cleanMsg,
      mentions
    });

    // Create notifications for @mentions
    if (newMsg.mentions && newMsg.mentions.length > 0) {
      try {
        const notifs = await createMentionNotifications({
          mentions: newMsg.mentions,
          senderId: req.user.id,
          senderName: req.user.name,
          projectId: project.id,
          roomId: project.room_id,
          type: 'chat_mention',
          body: cleanMsg.slice(0, 150),
          referenceId: newMsg.id,
          metadata: { messageId: newMsg.id }
        });

        // Broadcast notifications to mentioned users via Socket.IO
        const io = req.app.get('io');
        if (io) {
          for (const n of notifs) {
            io.to(`user:${n.userId}`).emit('notification:new', { notification: n });
          }
        }
      } catch (e) {
        console.warn('[Chat] Mention notification failed:', e.message);
      }
    }

    // Broadcast new message to the Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(project.room_id).emit('chat:new-message', newMsg);
      if (project.id !== project.room_id) {
        io.to(project.id).emit('chat:new-message', newMsg);
      }
    }

    res.status(201).json({ message: newMsg });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send message' });
  }
});

/**
 * PATCH /api/projects/:id/chat/:messageId
 * Edit chat message (own message within 15 mins)
 */
router.patch('/:id/chat/:messageId', resolveProject, async (req, res) => {
  try {
    const project = req.project;
    const isOwner = project.role === 'owner';
    const raw = req.body?.message ?? req.body?.text ?? req.body?.content ?? (typeof req.body === 'string' ? req.body : '');
    const cleanMsg = typeof raw === 'string' ? raw.trim() : String(raw || '').trim();
    if (!cleanMsg) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const updated = await editChatMessage({
      messageId: req.params.messageId,
      senderId: req.user.id,
      newMessage: cleanMsg,
      isOwner
    });

    // Broadcast edit to Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(project.room_id).emit('chat:message-edited', {
        messageId: updated.id,
        newMessage: updated.message,
        editedAt: updated.editedAt,
        mentions: updated.mentions
      });
      if (project.id !== project.room_id) {
        io.to(project.id).emit('chat:message-edited', {
          messageId: updated.id,
          newMessage: updated.message,
          editedAt: updated.editedAt,
          mentions: updated.mentions
        });
      }
    }

    res.json({ message: updated });
  } catch (err) {
    const status = err.message.includes('permission')
      ? 403
      : err.message.includes('15 minutes')
      ? 400
      : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * DELETE /api/projects/:id/chat/:messageId
 * Soft-delete message (sender or owner)
 */
router.delete('/:id/chat/:messageId', resolveProject, async (req, res) => {
  try {
    const project = req.project;
    const isOwner = project.role === 'owner';
    const deleted = await deleteChatMessage({
      messageId: req.params.messageId,
      userId: req.user.id,
      userName: req.user.name,
      isOwner,
      projectId: project.id,
      roomId: project.room_id
    });

    // Broadcast deletion to Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(project.room_id).emit('chat:message-deleted', {
        messageId: deleted.id,
        deletedAt: deleted.deletedAt
      });
      if (project.id !== project.room_id) {
        io.to(project.id).emit('chat:message-deleted', {
          messageId: deleted.id,
          deletedAt: deleted.deletedAt
        });
      }
    }

    res.json({ message: deleted });
  } catch (err) {
    const status = err.message.includes('permission') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
