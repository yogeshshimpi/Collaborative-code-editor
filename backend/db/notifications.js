import crypto from 'crypto';
import { pool, isDbConnected } from './index.js';
import { isUuid } from './chat.js';
import { logger } from '../utils/logger.js';

// In-memory fallback map: key = userId -> Array<Notification>
export const inMemoryNotifications = new Map();

/**
 * Fetch notifications for a user
 */
export async function getUserNotifications(userId, limit = 50) {
  if (!userId) return [];

  if (isDbConnected() && pool) {
    try {
      const res = await pool.query(
        `
        SELECT id, user_id, project_id, room_id, type, title, body,
               reference_id, metadata, is_read, created_at
        FROM user_notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
        [userId, limit]
      );

      return res.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        projectId: r.project_id,
        roomId: r.room_id,
        type: r.type,
        title: r.title,
        body: r.body,
        referenceId: r.reference_id,
        metadata: r.metadata || {},
        isRead: Boolean(r.is_read),
        createdAt: r.created_at
      }));
    } catch (err) {
      logger.error('[DB] Failed to fetch notifications:', err.message);
    }
  }

  // Fallback in-memory
  const list = inMemoryNotifications.get(Number(userId)) || [];
  return list.slice(0, limit);
}

/**
 * Create a single in-app notification
 */
export async function createNotification({
  userId,
  projectId = null,
  roomId = 'demo-room',
  type = 'chat_mention',
  title,
  body,
  referenceId = null,
  metadata = {}
}) {
  const dbUserId = typeof userId === 'number' && userId > 0 ? userId : null;
  const dbProjectId = isUuid(projectId) ? projectId : null;
  const now = new Date();

  if (isDbConnected() && pool && dbUserId) {
    try {
      const res = await pool.query(
        `
        INSERT INTO user_notifications (
          user_id, project_id, room_id, type, title, body,
          reference_id, metadata, is_read, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, FALSE, $9)
        RETURNING *
      `,
        [
          dbUserId,
          dbProjectId,
          roomId,
          type,
          title,
          body,
          referenceId,
          JSON.stringify(metadata),
          now
        ]
      );

      const r = res.rows[0];
      return {
        id: r.id,
        userId: r.user_id,
        projectId: r.project_id,
        roomId: r.room_id,
        type: r.type,
        title: r.title,
        body: r.body,
        referenceId: r.reference_id,
        metadata: r.metadata || {},
        isRead: false,
        createdAt: r.created_at
      };
    } catch (err) {
      logger.error('[DB] Failed to create notification:', err.message);
    }
  }

  // Fallback in-memory
  const notif = {
    id: `notif-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    userId: Number(userId),
    projectId,
    roomId,
    type,
    title,
    body,
    referenceId,
    metadata,
    isRead: false,
    createdAt: now.toISOString()
  };

  const key = Number(userId);
  if (!inMemoryNotifications.has(key)) {
    inMemoryNotifications.set(key, []);
  }
  inMemoryNotifications.get(key).unshift(notif);

  return notif;
}

/**
 * Find users mentioned in a text and create notifications for them
 */
export async function createMentionNotifications({
  mentions = [],
  senderId = null,
  senderName = 'Someone',
  projectId = null,
  roomId = 'demo-room',
  type = 'chat_mention',
  title = null,
  body = '',
  referenceId = null,
  metadata = {}
}) {
  if (!mentions || mentions.length === 0) return [];
  const created = [];

  if (isDbConnected() && pool) {
    try {
      // Find matching users in database
      const placeholders = mentions.map((_, i) => `$${i + 1}`).join(', ');
      const userRes = await pool.query(
        `
        SELECT id, name, email FROM users
        WHERE LOWER(name) IN (${placeholders}) OR LOWER(email) IN (${placeholders})
      `,
        mentions.map((m) => m.toLowerCase())
      );

      for (const u of userRes.rows) {
        // Do not notify self
        if (senderId && Number(senderId) === Number(u.id)) continue;

        const notifTitle =
          title ||
          (type === 'chat_mention'
            ? `${senderName} mentioned you in project chat`
            : `${senderName} mentioned you in a code comment`);

        const notif = await createNotification({
          userId: u.id,
          projectId,
          roomId,
          type,
          title: notifTitle,
          body,
          referenceId,
          metadata
        });
        if (notif) created.push(notif);
      }
    } catch (err) {
      logger.error('[DB] Failed to process mention notifications:', err.message);
    }
  }

  return created;
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(notificationId, userId) {
  if (isDbConnected() && pool) {
    await pool.query(
      `UPDATE user_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
    return true;
  }

  const list = inMemoryNotifications.get(Number(userId)) || [];
  const item = list.find((n) => n.id === notificationId);
  if (item) item.isRead = true;
  return true;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId) {
  if (isDbConnected() && pool) {
    await pool.query(
      `UPDATE user_notifications SET is_read = TRUE WHERE user_id = $1`,
      [userId]
    );
    return true;
  }

  const list = inMemoryNotifications.get(Number(userId)) || [];
  list.forEach((n) => (n.isRead = true));
  return true;
}

export default {
  getUserNotifications,
  createNotification,
  createMentionNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
