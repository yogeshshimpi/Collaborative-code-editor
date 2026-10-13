import {
  recordProjectActivity,
  getProjectActivityLogs
} from '../db/activity.js';
import { getProjectById, getProjectRole } from '../db/projects.js';
import { ApiError } from '../utils/apiError.js';

export async function logActivity(params) {
  return recordProjectActivity(params);
}

export async function fetchProjectActivityTimeline({ id, user, limit = 50, offset = 0, filter = 'all' }) {
  // Direct access for demo-room
  if (id === 'demo-room') {
    return getProjectActivityLogs({ roomId: 'demo-room', limit, offset, filter });
  }

  if (!user) {
    throw new ApiError(401, 'Authentication required to view project activity.');
  }

  const project = await getProjectById(id, user.id);
  const projectRole = await getProjectRole(id, user.id);
  if (project && !projectRole) {
    throw new ApiError(403, 'You do not have access to view this project activity.');
  }

  const targetRoom = project?.room_id || id;
  const targetProjectId = project?.id || null;

  return getProjectActivityLogs({
    roomId: targetRoom,
    projectId: targetProjectId,
    limit,
    offset,
    filter
  });
}

export default {
  logActivity,
  fetchProjectActivityTimeline
};
