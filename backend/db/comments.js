import crypto from 'crypto';
import { pool, isDbConnected } from './index.js';
import { recordProjectActivity } from './activity.js';
import { extractMentions, isUuid } from './chat.js';
import { logger } from '../utils/logger.js';

// In-memory fallback: key = projectId/roomId -> Array<Comment>
export const inMemoryCodeComments = new Map();

/**
 * Fetch code comment threads for a project/file
 */
export async function getCodeComments({
  projectId = null,
  roomId = null,
  filePath = null,
  includeResolved = true
}) {
  const targetRoom = roomId || 'demo-room';
  const targetProject = isUuid(projectId) ? projectId : null;

  if (isDbConnected() && pool) {
    try {
      const conditions = [];
      const params = [];
      let idx = 1;

      if (targetProject) {
        conditions.push(`project_id = $${idx++}`);
        params.push(targetProject);
      } else {
        conditions.push(`room_id = $${idx++}`);
        params.push(targetRoom);
      }

      if (filePath) {
        conditions.push(`file_path = $${idx++}`);
        params.push(filePath);
      }

      if (!includeResolved) {
        conditions.push(`is_resolved = FALSE`);
      }

      const query = `
        SELECT id, project_id, room_id, file_path, line_number, line_content,
               author_id, author_name, author_color, content, is_resolved,
               resolved_by, resolved_at, parent_id, mentions, created_at, updated_at
        FROM project_code_comments
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at ASC
      `;

      const res = await pool.query(query, params);
      const allRows = res.rows.map((r) => ({
        id: r.id,
        projectId: r.project_id,
        roomId: r.room_id,
        filePath: r.file_path,
        lineNumber: r.line_number,
        lineContent: r.line_content,
        authorId: r.author_id,
        authorName: r.author_name,
        authorColor: r.author_color,
        content: r.content,
        isResolved: Boolean(r.is_resolved),
        resolvedBy: r.resolved_by,
        resolvedAt: r.resolved_at,
        parentId: r.parent_id,
        mentions: r.mentions || [],
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));

      // Group into root threads and nested replies
      const rootComments = allRows.filter((c) => !c.parentId);
      const replies = allRows.filter((c) => c.parentId);

      return rootComments.map((root) => ({
        ...root,
        replies: replies.filter((rep) => rep.parentId === root.id)
      }));
    } catch (err) {
      logger.error('[DB] Failed to fetch code comments:', err.message);
    }
  }

  // Fallback in-memory
  const storeKey = targetProject || targetRoom;
  const list = inMemoryCodeComments.get(storeKey) || [];
  let filtered = list;
  if (filePath) {
    filtered = filtered.filter((c) => c.filePath === filePath);
  }
  if (!includeResolved) {
    filtered = filtered.filter((c) => !c.isResolved);
  }

  const rootComments = filtered.filter((c) => !c.parentId);
  const replies = filtered.filter((c) => c.parentId);

  return rootComments.map((root) => ({
    ...root,
    replies: replies.filter((rep) => rep.parentId === root.id)
  }));
}

/**
 * Create a new code comment thread
 */
export async function createCodeComment({
  projectId = null,
  roomId = 'demo-room',
  filePath,
  lineNumber,
  lineContent = '',
  authorId = null,
  authorName = 'Collaborator',
  authorColor = '#6366f1',
  content,
  mentions = []
}) {
  const cleanContent = String(content || '').trim();
  if (!cleanContent) {
    throw new Error('Comment content cannot be empty');
  }

  const detectedMentions = mentions.length > 0 ? mentions : extractMentions(cleanContent);
  const now = new Date();

  const dbProjectId = isUuid(projectId) ? projectId : null;
  const dbAuthorId = typeof authorId === 'number' && authorId > 0 ? authorId : null;

  if (isDbConnected() && pool) {
    try {
      const res = await pool.query(
        `
        INSERT INTO project_code_comments (
          project_id, room_id, file_path, line_number, line_content,
          author_id, author_name, author_color, content, mentions, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $11)
        RETURNING *
      `,
        [
          dbProjectId,
          roomId,
          filePath,
          lineNumber,
          lineContent,
          dbAuthorId,
          authorName,
          authorColor,
          cleanContent,
          JSON.stringify(detectedMentions),
          now
        ]
      );

      const r = res.rows[0];

      // Record in activity log
      try {
        await recordProjectActivity({
          projectId,
          roomId,
          userId: authorId,
          userName: authorName,
          actionType: 'comment_create',
          targetName: `${filePath}:${lineNumber}`,
          summary: `${authorName} commented on line ${lineNumber} of ${filePath}`,
          details: { filePath, lineNumber, snippet: lineContent }
        });
      } catch {}

      return {
        id: r.id,
        projectId: r.project_id,
        roomId: r.room_id,
        filePath: r.file_path,
        lineNumber: r.line_number,
        lineContent: r.line_content,
        authorId: r.author_id,
        authorName: r.author_name,
        authorColor: r.author_color,
        content: r.content,
        isResolved: false,
        resolvedBy: null,
        resolvedAt: null,
        parentId: null,
        mentions: r.mentions || [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        replies: []
      };
    } catch (err) {
      logger.error('[DB] Failed to create code comment:', err.message);
    }
  }

  // Fallback in-memory
  const fallback = {
    id: `com-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    projectId,
    roomId,
    filePath,
    lineNumber,
    lineContent,
    authorId,
    authorName,
    authorColor,
    content: cleanContent,
    isResolved: false,
    resolvedBy: null,
    resolvedAt: null,
    parentId: null,
    mentions: detectedMentions,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    replies: []
  };

  const storeKey = projectId || roomId;
  if (!inMemoryCodeComments.has(storeKey)) {
    inMemoryCodeComments.set(storeKey, []);
  }
  inMemoryCodeComments.get(storeKey).push(fallback);

  return fallback;
}

/**
 * Reply to an existing code comment thread
 */
export async function replyCodeComment({
  projectId = null,
  roomId = 'demo-room',
  parentId,
  authorId = null,
  authorName = 'Collaborator',
  authorColor = '#6366f1',
  content,
  mentions = []
}) {
  const cleanContent = String(content || '').trim();
  if (!cleanContent) {
    throw new Error('Reply content cannot be empty');
  }

  const detectedMentions = mentions.length > 0 ? mentions : extractMentions(cleanContent);
  const now = new Date();

  const dbProjectId = isUuid(projectId) ? projectId : null;
  const dbAuthorId = typeof authorId === 'number' && authorId > 0 ? authorId : null;

  if (isDbConnected() && pool && isUuid(parentId)) {
    // Verify parent exists
    const parentRes = await pool.query(
      `SELECT * FROM project_code_comments WHERE id = $1 LIMIT 1`,
      [parentId]
    );
    if (parentRes.rows.length === 0) {
      throw new Error('Comment thread not found');
    }
    const parent = parentRes.rows[0];

    const res = await pool.query(
      `
      INSERT INTO project_code_comments (
        project_id, room_id, file_path, line_number, line_content,
        author_id, author_name, author_color, content, parent_id, mentions, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12)
      RETURNING *
    `,
      [
        dbProjectId,
        roomId,
        parent.file_path,
        parent.line_number,
        parent.line_content,
        dbAuthorId,
        authorName,
        authorColor,
        cleanContent,
        parentId,
        JSON.stringify(detectedMentions),
        now
      ]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      projectId: r.project_id,
      roomId: r.room_id,
      filePath: r.file_path,
      lineNumber: r.line_number,
      lineContent: r.line_content,
      authorId: r.author_id,
      authorName: r.author_name,
      authorColor: r.author_color,
      content: r.content,
      isResolved: Boolean(r.is_resolved),
      resolvedBy: r.resolved_by,
      resolvedAt: r.resolved_at,
      parentId: r.parent_id,
      mentions: r.mentions || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  // Fallback in-memory
  const storeKey = projectId || roomId;
  const list = inMemoryCodeComments.get(storeKey) || [];
  const parent = list.find((c) => c.id === parentId);
  if (!parent) throw new Error('Comment thread not found');

  const reply = {
    id: `rep-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    projectId,
    roomId,
    filePath: parent.filePath,
    lineNumber: parent.lineNumber,
    lineContent: parent.lineContent,
    authorId,
    authorName,
    authorColor,
    content: cleanContent,
    isResolved: false,
    resolvedBy: null,
    resolvedAt: null,
    parentId,
    mentions: detectedMentions,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  list.push(reply);
  return reply;
}

/**
 * Resolve or reopen a comment thread
 */
export async function resolveCodeComment({ commentId, userId = null, isResolved = true }) {
  const now = new Date();

  const dbUserId = typeof userId === 'number' && userId > 0 ? userId : null;

  if (isDbConnected() && pool && isUuid(commentId)) {
    const res = await pool.query(
      `
      UPDATE project_code_comments
      SET is_resolved = $1, resolved_by = $2, resolved_at = $3, updated_at = $3
      WHERE id = $4 OR parent_id = $4
      RETURNING *
    `,
      [Boolean(isResolved), isResolved ? dbUserId : null, isResolved ? now : null, commentId]
    );

    if (res.rows.length === 0) {
      throw new Error('Comment not found');
    }

    const r = res.rows[0];
    return {
      id: r.id,
      isResolved: Boolean(r.is_resolved),
      resolvedBy: r.resolved_by,
      resolvedAt: r.resolved_at
    };
  }

  // In-memory fallback
  for (const [, list] of inMemoryCodeComments.entries()) {
    const comment = list.find((c) => c.id === commentId);
    if (comment) {
      comment.isResolved = Boolean(isResolved);
      comment.resolvedBy = isResolved ? userId : null;
      comment.resolvedAt = isResolved ? now.toISOString() : null;
      return {
        id: comment.id,
        isResolved: comment.isResolved,
        resolvedBy: comment.resolvedBy,
        resolvedAt: comment.resolvedAt
      };
    }
  }

  throw new Error('Comment not found');
}

/**
 * Delete a comment thread
 */
export async function deleteCodeComment({ commentId, userId = null, isOwner = false }) {
  if (isDbConnected() && pool && isUuid(commentId)) {
    const existing = await pool.query(
      `SELECT * FROM project_code_comments WHERE id = $1 LIMIT 1`,
      [commentId]
    );
    if (existing.rows.length === 0) throw new Error('Comment not found');

    const row = existing.rows[0];
    const isAuthor = userId && row.author_id && Number(userId) === Number(row.author_id);
    if (!isAuthor && !isOwner) {
      throw new Error('You do not have permission to delete this comment');
    }

    await pool.query(
      `DELETE FROM project_code_comments WHERE id = $1 OR parent_id = $1`,
      [commentId]
    );
    return { id: commentId, success: true };
  }

  // In-memory fallback
  for (const [, list] of inMemoryCodeComments.entries()) {
    const idx = list.findIndex((c) => c.id === commentId);
    if (idx !== -1) {
      list.splice(idx, 1);
      return { id: commentId, success: true };
    }
  }

  throw new Error('Comment not found');
}

export default {
  getCodeComments,
  createCodeComment,
  replyCodeComment,
  resolveCodeComment,
  deleteCodeComment
};
