import express from 'express';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { getProjectById } from '../db/projects.js';
import {
  getCodeComments,
  createCodeComment,
  replyCodeComment,
  resolveCodeComment,
  deleteCodeComment
} from '../db/comments.js';
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
        name: req.body?.authorName || 'Demo Collaborator',
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
 * GET /api/projects/:id/comments
 * Fetch code comments for project (optionally filtered by ?file=)
 */
router.get('/:id/comments', resolveProject, async (req, res) => {
  try {
    const project = req.project;
    const { file, includeResolved } = req.query;
    const comments = await getCodeComments({
      projectId: project.id,
      roomId: project.room_id,
      filePath: file || null,
      includeResolved: includeResolved !== 'false'
    });

    res.json({ comments });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch comments' });
  }
});

/**
 * POST /api/projects/:id/comments
 * Add a code comment thread on a file and line
 */
router.post('/:id/comments', resolveProject, async (req, res) => {
  try {
    const project = req.project;

    if (project.role === 'viewer') {
      return res.status(403).json({ error: 'Viewer permission: code comments are disabled.' });
    }

    const { filePath, lineNumber, lineContent, mentions, selectedText } = req.body;
    const rawContent = req.body?.content ?? req.body?.message ?? req.body?.text ?? (typeof req.body === 'string' ? req.body : '');
    const cleanContent = typeof rawContent === 'string' ? rawContent.trim() : String(rawContent || '').trim();
    if (!filePath || !lineNumber || !cleanContent) {
      return res.status(400).json({ error: 'Missing required comment fields' });
    }

    const newComment = await createCodeComment({
      projectId: project.id,
      roomId: project.room_id,
      filePath,
      lineNumber: Number(lineNumber),
      lineContent: lineContent || selectedText || '',
      authorId: req.user.id,
      authorName: req.user.name,
      authorColor: req.body?.authorColor || '#6366f1',
      content: cleanContent,
      mentions: mentions || []
    });

    // Notify mentioned users
    if (newComment.mentions && newComment.mentions.length > 0) {
      try {
        const notifs = await createMentionNotifications({
          mentions: newComment.mentions,
          senderId: req.user.id,
          senderName: req.user.name,
          projectId: project.id,
          roomId: project.room_id,
          type: 'comment_mention',
          body: content.slice(0, 150),
          referenceId: newComment.id,
          metadata: { commentId: newComment.id, filePath, lineNumber }
        });

        const io = req.app.get('io');
        if (io) {
          for (const n of notifs) {
            io.to(`user:${n.userId}`).emit('notification:new', { notification: n });
          }
        }
      } catch (e) {
        console.warn('[Comments] Mention notification failed:', e.message);
      }
    }

    // Broadcast new comment to Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(project.room_id).emit('comment:new', newComment);
      if (project.id !== project.room_id) {
        io.to(project.id).emit('comment:new', newComment);
      }
    }

    res.status(201).json({ comment: newComment });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create comment' });
  }
});

/**
 * POST /api/projects/:id/comments/:commentId/replies
 * Add reply to comment thread
 */
router.post('/:id/comments/:commentId/replies', resolveProject, async (req, res) => {
  try {
    const project = req.project;

    if (project.role === 'viewer') {
      return res.status(403).json({ error: 'Viewer permission: comment replies are disabled.' });
    }

    const rawContent = req.body?.content ?? req.body?.message ?? req.body?.text ?? (typeof req.body === 'string' ? req.body : '');
    const cleanContent = typeof rawContent === 'string' ? rawContent.trim() : String(rawContent || '').trim();
    if (!cleanContent) {
      return res.status(400).json({ error: 'Reply content cannot be empty' });
    }

    const reply = await replyCodeComment({
      projectId: project.id,
      roomId: project.room_id,
      parentId: req.params.commentId,
      commentId: req.params.commentId,
      authorId: req.user.id,
      authorName: req.user.name,
      authorColor: req.body?.authorColor || '#6366f1',
      content: cleanContent,
      mentions: req.body?.mentions || []
    });

    // Broadcast reply to Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(project.room_id).emit('comment:reply-added', {
        commentId: req.params.commentId,
        reply
      });
      if (project.id !== project.room_id) {
        io.to(project.id).emit('comment:reply-added', {
          commentId: req.params.commentId,
          reply
        });
      }
    }

    res.status(201).json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to post reply' });
  }
});

/**
 * PATCH /api/projects/:id/comments/:commentId
 * Resolve or re-open comment thread
 */
router.patch('/:id/comments/:commentId', resolveProject, async (req, res) => {
  try {
    const project = req.project;

    if (project.role === 'viewer') {
      return res.status(403).json({ error: 'Viewer permission: cannot modify comment status.' });
    }

    const { isResolved } = req.body;
    const updated = await resolveCodeComment({
      commentId: req.params.commentId,
      isResolved: Boolean(isResolved)
    });

    // Broadcast resolution to Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(project.room_id).emit('comment:status-changed', {
        commentId: updated.id,
        status: updated.status,
        isResolved: updated.isResolved
      });
      if (project.id !== project.room_id) {
        io.to(project.id).emit('comment:status-changed', {
          commentId: updated.id,
          status: updated.status,
          isResolved: updated.isResolved
        });
      }
    }

    res.json({ comment: updated });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update comment status' });
  }
});

/**
 * DELETE /api/projects/:id/comments/:commentId
 * Delete comment thread (author or project owner)
 */
router.delete('/:id/comments/:commentId', resolveProject, async (req, res) => {
  try {
    const project = req.project;
    const isOwner = project.role === 'owner';

    const deleted = await deleteCodeComment({
      commentId: req.params.commentId,
      userId: req.user.id,
      isOwner
    });

    // Broadcast deletion to Socket.IO room
    const io = req.app.get('io');
    if (io) {
      io.to(project.room_id).emit('comment:deleted', {
        commentId: deleted.id
      });
      if (project.id !== project.room_id) {
        io.to(project.id).emit('comment:deleted', {
          commentId: deleted.id
        });
      }
    }

    res.json({ success: true, deletedId: deleted.id });
  } catch (err) {
    const status = err.message.includes('permission') ? 403 : 500;
    res.status(status).json({ error: err.message });
  }
});

export default router;
