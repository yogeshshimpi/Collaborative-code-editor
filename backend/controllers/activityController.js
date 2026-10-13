import { fetchProjectActivityTimeline } from '../services/activityService.js';
import { getCurrentUser } from '../services/authService.js';
import { COOKIE_NAME } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getActivityLogs = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50, offset = 0, filter = 'all' } = req.query;

  let user = req.user || null;
  if (!user && id !== 'demo-room') {
    const token = req.cookies?.[COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
    if (token) {
      user = await getCurrentUser(token);
    }
  }

  const data = await fetchProjectActivityTimeline({
    id,
    user,
    limit,
    offset,
    filter
  });

  res.json(data);
});

export default {
  getActivityLogs
};
