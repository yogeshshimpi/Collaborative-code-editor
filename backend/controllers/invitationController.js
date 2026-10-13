import { listUserInvitations, handleInvitationResponse } from '../services/invitationService.js';
import { logActivity } from '../services/activityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getUserInvitations = asyncHandler(async (req, res) => {
  const invitations = await listUserInvitations(req.user.email);
  res.json({ invitations });
});

export const respondInvitation = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const { result, project } = await handleInvitationResponse({
    invitationId: req.params.id,
    userEmail: req.user.email,
    userId: req.user.id,
    action
  });

  if (action === 'accept' && project) {
    logActivity({
      roomId: project.room_id,
      projectId: project.id,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'member_join',
      targetName: req.user.name,
      details: { role: result.role || 'editor' },
      summary: `${req.user.name} joined the project as ${result.role || 'editor'}`
    }).then((act) => {
      const io = req.app.get('io');
      if (act && io) io.to(project.room_id).emit('activity-log-entry', act);
    }).catch(() => {});
  }

  res.json(result);
});

export default {
  getUserInvitations,
  respondInvitation
};
