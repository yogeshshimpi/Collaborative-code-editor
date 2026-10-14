import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from '../db/notifications.js';

const router = express.Router();
router.use(requireAuth);

/**
 * GET /api/notifications
 * Fetch user notifications and count
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const notifications = await getUserNotifications(req.user.id, limit);
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch notifications' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark single notification as read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    await markNotificationRead(req.params.id, req.user.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update notification' });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all user notifications as read
 */
router.patch('/read-all', async (req, res) => {
  try {
    await markAllNotificationsRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to mark all as read' });
  }
});

export default router;
