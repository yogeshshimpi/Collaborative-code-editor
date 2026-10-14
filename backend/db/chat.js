import crypto from 'crypto';
import { pool, isDbConnected } from './index.js';
import { recordProjectActivity } from './activity.js';
import { logger } from '../utils/logger.js';

// In-memory fallback map: key = projectId or roomId -> Array<ChatMessage>
export const inMemoryChatMessages = new Map();

export const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

/**
 * Extract @mentions from text.
 * e.g. "@Yogesh please review" -> ["Yogesh"]
 */
export function extractMentions(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/@([a-zA-Z0-9_\-.]+)/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
}

/**
 * Fetch project chat messages
 */
export async function getProjectChatMessages({ projectId = null, roomId = null, limit = 100 }) {
  const targetRoom = roomId || 'demo-room';
  const targetProject = isUuid(projectId) ? projectId : null;

  if (isDbConnected() && pool) {
    try {
      let query = '';
      let params = [];

      if (targetProject) {
        query = `
          SELECT id, project_id, room_id, sender_id, sender_name, sender_color,
                 message, is_edited, edited_at, is_deleted, deleted_at, mentions, created_at
          FROM project_chat_messages
          WHERE project_id = $1
          ORDER BY created_at ASC
          LIMIT $2
        `;
        params = [targetProject, limit];
      } else {
        query = `
          SELECT id, project_id, room_id, sender_id, sender_name, sender_color,
                 message, is_edited, edited_at, is_deleted, deleted_at, mentions, created_at
          FROM project_chat_messages
          WHERE room_id = $1
          ORDER BY created_at ASC
          LIMIT $2
        `;
        params = [targetRoom, limit];
      }

      const res = await pool.query(query, params);
      return res.rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        roomId: row.room_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        senderColor: row.sender_color,
        message: row.message,
        isEdited: Boolean(row.is_edited),
        editedAt: row.edited_at,
        isDeleted: Boolean(row.is_deleted),
        deletedAt: row.deleted_at,
        mentions: row.mentions || [],
        createdAt: row.created_at
      }));
    } catch (err) {
      logger.error('[DB] Failed to fetch chat messages:', err.message);
    }
  }

  // Fallback to in-memory store
  const storeKey = targetProject || targetRoom;
  const messages = inMemoryChatMessages.get(storeKey) || [];
  return messages.slice(-limit);
}

/**
 * Create and persist a new chat message
 */
export async function createChatMessage({
  projectId = null,
  roomId = 'demo-room',
  senderId = null,
  senderName = 'Anonymous',
  senderColor = '#6366f1',
  message,
  mentions = []
}) {
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) {
    throw new Error('Message cannot be empty');
  }

  const detectedMentions = mentions.length > 0 ? mentions : extractMentions(cleanMessage);
  const mentionsJson = JSON.stringify(detectedMentions);
  const now = new Date();

  const dbProjectId = isUuid(projectId) ? projectId : null;
  const dbSenderId = typeof senderId === 'number' && senderId > 0 ? senderId : null;

  if (isDbConnected() && pool) {
    try {
      const res = await pool.query(
        `
        INSERT INTO project_chat_messages (
          project_id, room_id, sender_id, sender_name, sender_color,
          message, mentions, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
        RETURNING *
      `,
        [dbProjectId, roomId, dbSenderId, senderName, senderColor, cleanMessage, mentionsJson, now]
      );

      const row = res.rows[0];
      return {
        id: row.id,
        projectId: row.project_id,
        roomId: row.room_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        senderColor: row.sender_color,
        message: row.message,
        isEdited: Boolean(row.is_edited),
        editedAt: row.edited_at,
        isDeleted: Boolean(row.is_deleted),
        deletedAt: row.deleted_at,
        mentions: row.mentions || [],
        createdAt: row.created_at
      };
    } catch (err) {
      logger.error('[DB] Failed to create chat message:', err.message);
    }
  }

  // In-memory fallback
  const fallbackMessage = {
    id: `msg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    projectId,
    roomId,
    senderId,
    senderName,
    senderColor,
    message: cleanMessage,
    isEdited: false,
    editedAt: null,
    isDeleted: false,
    deletedAt: null,
    mentions: detectedMentions,
    createdAt: now.toISOString()
  };

  const storeKey = projectId || roomId;
  if (!inMemoryChatMessages.has(storeKey)) {
    inMemoryChatMessages.set(storeKey, []);
  }
  inMemoryChatMessages.get(storeKey).push(fallbackMessage);

  return fallbackMessage;
}

/**
 * Edit an existing chat message (15-minute window for sender, owner allowed)
 */
export async function editChatMessage({ messageId, senderId = null, newMessage, isOwner = false }) {
  const cleanMessage = String(newMessage || '').trim();
  if (!cleanMessage) {
    throw new Error('Edited message cannot be empty');
  }

  const detectedMentions = extractMentions(cleanMessage);
  const now = new Date();

  if (isDbConnected() && pool && isUuid(messageId)) {
    // 1. Fetch existing message to verify ownership & timing
    const existingRes = await pool.query(
      `SELECT * FROM project_chat_messages WHERE id = $1 LIMIT 1`,
      [messageId]
    );

    if (existingRes.rows.length === 0) {
      throw new Error('Message not found');
    }

    const row = existingRes.rows[0];
    if (row.is_deleted) {
      throw new Error('Cannot edit a deleted message');
    }

    // Permission check
    const isSender = senderId && row.sender_id && Number(senderId) === Number(row.sender_id);
    if (!isSender && !isOwner) {
      throw new Error('You do not have permission to edit this message');
    }

    // 15-minute window check for non-owners
    if (!isOwner) {
      const createdTime = new Date(row.created_at).getTime();
      const diffMinutes = (Date.now() - createdTime) / (1000 * 60);
      if (diffMinutes > 15) {
        throw new Error('Messages can only be edited within 15 minutes of sending');
      }
    }

    const updateRes = await pool.query(
      `
      UPDATE project_chat_messages
      SET message = $1, is_edited = TRUE, edited_at = $2, mentions = $3::jsonb
      WHERE id = $4
      RETURNING *
    `,
      [cleanMessage, now, JSON.stringify(detectedMentions), messageId]
    );

    const updated = updateRes.rows[0];
    return {
      id: updated.id,
      projectId: updated.project_id,
      roomId: updated.room_id,
      senderId: updated.sender_id,
      senderName: updated.sender_name,
      senderColor: updated.sender_color,
      message: updated.message,
      isEdited: true,
      editedAt: updated.edited_at,
      isDeleted: Boolean(updated.is_deleted),
      deletedAt: updated.deleted_at,
      mentions: updated.mentions || [],
      createdAt: updated.created_at
    };
  }

  // In-memory fallback
  for (const [, messages] of inMemoryChatMessages.entries()) {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      const msg = messages[idx];
      if (msg.isDeleted) throw new Error('Cannot edit a deleted message');
      msg.message = cleanMessage;
      msg.isEdited = true;
      msg.editedAt = now.toISOString();
      msg.mentions = detectedMentions;
      return msg;
    }
  }

  throw new Error('Message not found');
}

/**
 * Delete a chat message (soft-delete, replaces content with placeholder, records in activity log)
 */
export async function deleteChatMessage({
  messageId,
  userId = null,
  userName = 'User',
  isOwner = false,
  projectId = null,
  roomId = null
}) {
  const placeholder = 'This message was deleted.';
  const now = new Date();

  if (isDbConnected() && pool && isUuid(messageId)) {
    const existingRes = await pool.query(
      `SELECT * FROM project_chat_messages WHERE id = $1 LIMIT 1`,
      [messageId]
    );

    if (existingRes.rows.length === 0) {
      throw new Error('Message not found');
    }

    const row = existingRes.rows[0];
    const isSender = userId && row.sender_id && Number(userId) === Number(row.sender_id);
    if (!isSender && !isOwner) {
      throw new Error('You do not have permission to delete this message');
    }

    const updateRes = await pool.query(
      `
      UPDATE project_chat_messages
      SET message = $1, is_deleted = TRUE, deleted_at = $2
      WHERE id = $3
      RETURNING *
    `,
      [placeholder, now, messageId]
    );

    const updated = updateRes.rows[0];

    // Record message deletion in Project Activity Log without storing deleted content
    try {
      await recordProjectActivity({
        projectId: updated.project_id || projectId,
        roomId: updated.room_id || roomId || 'demo-room',
        userId,
        userName,
        actionType: 'chat_message_delete',
        summary: `${userName} deleted a message in project chat`,
        details: { messageId }
      });
    } catch (e) {
      logger.warn('[Chat] Could not log deletion activity:', e.message);
    }

    return {
      id: updated.id,
      projectId: updated.project_id,
      roomId: updated.room_id,
      senderId: updated.sender_id,
      senderName: updated.sender_name,
      senderColor: updated.sender_color,
      message: placeholder,
      isEdited: Boolean(updated.is_edited),
      editedAt: updated.edited_at,
      isDeleted: true,
      deletedAt: updated.deleted_at,
      mentions: [],
      createdAt: updated.created_at
    };
  }

  // In-memory fallback
  for (const [, messages] of inMemoryChatMessages.entries()) {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      const msg = messages[idx];
      msg.message = placeholder;
      msg.isDeleted = true;
      msg.deletedAt = now.toISOString();
      msg.mentions = [];

      try {
        await recordProjectActivity({
          projectId: msg.projectId || projectId,
          roomId: msg.roomId || roomId || 'demo-room',
          userId,
          userName,
          actionType: 'chat_message_delete',
          summary: `${userName} deleted a message in project chat`,
          details: { messageId }
        });
      } catch {}

      return msg;
    }
  }

  throw new Error('Message not found');
}

export default {
  extractMentions,
  getProjectChatMessages,
  createChatMessage,
  editChatMessage,
  deleteChatMessage
};
