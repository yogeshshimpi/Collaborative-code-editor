import {
  listUserProjects,
  createNewProject,
  getProjectDetails,
  updateProjectSettings,
  removeProject,
  getProjectCollaborators,
  changeMemberRole,
  removeMemberFromProject,
  setApprovalMode
} from '../services/projectService.js';
import { sendProjectInvitation, cancelProjectInvitation } from '../services/invitationService.js';
import { logActivity } from '../services/activityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProjects = asyncHandler(async (req, res) => {
  const projects = await listUserProjects(req.user.id);
  res.json({ projects });
});

export const createProject = asyncHandler(async (req, res) => {
  const { name, roomId } = req.body;
  const project = await createNewProject({ name, roomId, userId: req.user.id });
  res.status(201).json({ project });
});

export const getProject = asyncHandler(async (req, res) => {
  const project = await getProjectDetails(req.params.id, req.user.id);
  res.json({ project });
});

export const updateProject = asyncHandler(async (req, res) => {
  const { name, roomId } = req.body || {};
  const updated = await updateProjectSettings(req.params.id, { name, roomId }, req.user.id);

  const io = req.app.get('io');
  if (io) {
    const oldRoom = updated.old_room_id || req.params.id;
    io.to(oldRoom).emit('project-renamed', {
      projectId: updated.id,
      oldRoomId: oldRoom,
      newRoomId: updated.room_id,
      newName: updated.name
    });
    if (updated.room_id && updated.room_id !== oldRoom) {
      io.to(updated.room_id).emit('project-renamed', {
        projectId: updated.id,
        oldRoomId: oldRoom,
        newRoomId: updated.room_id,
        newName: updated.name
      });
    }
  }

  res.json({ project: updated });
});

export const deleteProject = asyncHandler(async (req, res) => {
  await removeProject(req.params.id, req.user.id);
  res.json({ message: 'Project deleted successfully.', id: req.params.id });
});

export const getMembers = asyncHandler(async (req, res) => {
  const data = await getProjectCollaborators(req.params.id, req.user.id);
  res.json(data);
});

export const createInvitation = asyncHandler(async (req, res) => {
  const { email, role = 'editor' } = req.body;
  const { invitation, project } = await sendProjectInvitation({
    projectId: req.params.id,
    invitedEmail: email,
    role,
    requester: req.user
  });

  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  logActivity({
    roomId: project.room_id,
    projectId: project.id,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'member_invite',
    targetName: email.trim(),
    details: { role: roleDisplay },
    summary: `${req.user.name} invited ${email.trim()} as ${roleDisplay}`
  }).then((act) => {
    const io = req.app.get('io');
    if (act && io) io.to(project.room_id).emit('activity-log-entry', act);
  }).catch(() => {});

  res.status(201).json({ invitation });
});

export const revokeInvitation = asyncHandler(async (req, res) => {
  await cancelProjectInvitation(req.params.id, req.params.invitationId, req.user.id);
  res.json({ message: 'Invitation revoked successfully.', invitationId: req.params.invitationId });
});

export const updateMemberRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const { updated, project, targetUser } = await changeMemberRole(
    req.params.id,
    req.params.userId,
    role,
    req.user.id
  );

  const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  const targetName = targetUser?.name || `User #${req.params.userId}`;
  logActivity({
    roomId: project.room_id,
    projectId: project.id,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'member_role_change',
    targetName,
    details: { newRole: roleDisplay },
    summary: `${req.user.name} changed ${targetName}’s role to ${roleDisplay}`
  }).then((act) => {
    const io = req.app.get('io');
    if (act && io) io.to(project.room_id).emit('activity-log-entry', act);
  }).catch(() => {});

  res.json({ member: updated });
});

export const removeMember = asyncHandler(async (req, res) => {
  const { project, targetUser, isSelf } = await removeMemberFromProject(
    req.params.id,
    req.params.userId,
    req.user
  );

  const targetName = targetUser?.name || `User #${req.params.userId}`;
  const summary = isSelf
    ? `${req.user.name} left the project`
    : `${req.user.name} removed ${targetName} from the project`;

  logActivity({
    roomId: project.room_id,
    projectId: project.id,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: isSelf ? 'member_leave' : 'member_remove',
    targetName,
    details: { targetUserId: parseInt(req.params.userId, 10) },
    summary
  }).then((act) => {
    const io = req.app.get('io');
    if (act && io) io.to(project.room_id).emit('activity-log-entry', act);
  }).catch(() => {});

  res.json({
    message: isSelf ? 'You have left the project.' : 'Member removed successfully.',
    userId: parseInt(req.params.userId, 10)
  });
});

export const toggleApprovalMode = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { requiresApproval } = req.body;
  const { project } = await setApprovalMode(id, Boolean(requiresApproval), req.user.id);

  const io = req.app.get('io');
  if (io && project.room_id) {
    io.to(project.room_id).emit('approval-mode-updated', {
      roomId: project.room_id,
      requiresApproval: project.requires_approval,
      updatedBy: req.user.name
    });
  }

  logActivity({
    roomId: project.room_id,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'approval_mode_toggle',
    targetName: project.name,
    details: { requiresApproval: project.requires_approval },
    summary: `${req.user.name} ${project.requires_approval ? 'enabled' : 'disabled'} approval mode for ${project.name}`
  }).then((act) => {
    if (act && io) io.to(project.room_id).emit('activity-log-entry', act);
  }).catch(() => {});

  res.json({
    message: `Approval mode ${project.requires_approval ? 'enabled' : 'disabled'} successfully.`,
    project
  });
});

export default {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getMembers,
  createInvitation,
  revokeInvitation,
  updateMemberRole,
  removeMember,
  toggleApprovalMode
};
