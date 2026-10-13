import {
  getUserProjects,
  createProject as dbCreateProject,
  getProjectById,
  getProjectRole,
  updateProject as dbUpdateProject,
  deleteProject as dbDeleteProject,
  getProjectMembers as dbGetProjectMembers,
  updateProjectMemberRole,
  removeProjectMember,
  updateProjectApprovalMode
} from '../db/projects.js';
import { getRoomFiles } from '../db/workspace.js';
import { getProjectInvitations } from '../db/invitations.js';
import { findUserById } from '../db/users.js';
import { ApiError } from '../utils/apiError.js';

export async function listUserProjects(userId) {
  return getUserProjects(userId);
}

export async function createNewProject({ name, roomId, userId }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Project name is required.');
  }

  const targetRoomId = (roomId && typeof roomId === 'string' && roomId.trim())
    ? roomId.trim().slice(0, 64)
    : `project-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

  const project = await dbCreateProject({
    id: targetRoomId,
    name: name.trim().slice(0, 100),
    ownerId: userId
  });

  // Ensure default starter files exist for this project room
  await getRoomFiles(targetRoomId);

  return project;
}

export async function getProjectDetails(projectIdOrRoomId, userId) {
  const project = await getProjectById(projectIdOrRoomId, userId);
  if (!project) {
    throw new ApiError(404, 'Project not found.');
  }
  return project;
}

export async function updateProjectSettings(projectIdOrRoomId, { name, roomId }, userId) {
  if ((!name || typeof name !== 'string' || !name.trim()) && (!roomId || typeof roomId !== 'string' || !roomId.trim())) {
    throw new ApiError(400, 'Project name or room ID is required.');
  }

  const updated = await dbUpdateProject(projectIdOrRoomId, { name, roomId }, userId);
  if (!updated) {
    throw new ApiError(404, 'Project not found or not owned by you.');
  }
  return updated;
}

export async function removeProject(projectIdOrRoomId, userId) {
  const deleted = await dbDeleteProject(projectIdOrRoomId, userId);
  if (!deleted) {
    throw new ApiError(404, 'Project not found or not owned by you.');
  }
  return deleted;
}

export async function getProjectCollaborators(projectIdOrRoomId, userId) {
  const project = await getProjectById(projectIdOrRoomId, userId);
  if (!project) {
    throw new ApiError(404, 'Project not found.');
  }
  if (!project.role) {
    throw new ApiError(403, 'You do not have access to this project.');
  }

  const members = await dbGetProjectMembers(project.id);
  const invitations = project.role === 'owner' ? await getProjectInvitations(project.id) : [];

  return {
    owner: { id: project.owner_id, name: project.owner_name, email: project.owner_email },
    members,
    invitations,
    userRole: project.role
  };
}

export async function changeMemberRole(projectIdOrRoomId, targetUserId, newRole, requesterId) {
  if (!['editor', 'viewer'].includes(newRole)) {
    throw new ApiError(400, 'Role must be either editor or viewer.');
  }

  const project = await getProjectById(projectIdOrRoomId, requesterId);
  if (!project) throw new ApiError(404, 'Project not found.');
  if (project.owner_id !== requesterId) {
    throw new ApiError(403, 'Only the project owner can change member roles.');
  }

  const numTargetId = parseInt(targetUserId, 10);
  if (numTargetId === requesterId) {
    throw new ApiError(400, 'Cannot modify the owner role.');
  }

  const targetUser = await findUserById(numTargetId);
  const updated = await updateProjectMemberRole(project.id, numTargetId, newRole);
  if (!updated) {
    throw new ApiError(404, 'Project member not found.');
  }

  return { updated, project, targetUser };
}

export async function removeMemberFromProject(projectIdOrRoomId, targetUserId, requester) {
  const project = await getProjectById(projectIdOrRoomId, requester.id);
  if (!project) throw new ApiError(404, 'Project not found.');

  const numTargetId = parseInt(targetUserId, 10);
  const isOwner = project.owner_id === requester.id;
  const isSelf = numTargetId === requester.id;

  if (!isOwner && !isSelf) {
    throw new ApiError(403, 'You do not have permission to remove this member.');
  }
  if (numTargetId === project.owner_id) {
    throw new ApiError(400, 'Project owner cannot be removed.');
  }

  const targetUser = await findUserById(numTargetId);
  const removed = await removeProjectMember(project.id, numTargetId);
  if (!removed) {
    throw new ApiError(404, 'Project member not found.');
  }

  return { removed, project, targetUser, isSelf };
}

export async function setApprovalMode(projectIdOrRoomId, requiresApproval, userId) {
  const project = await getProjectById(projectIdOrRoomId, userId);
  if (!project) throw new ApiError(404, 'Project not found.');

  const role = await getProjectRole(projectIdOrRoomId, userId);
  if (role !== 'owner' && project.owner_id !== userId) {
    throw new ApiError(403, 'Only the project owner can toggle approval mode.');
  }

  const updated = await updateProjectApprovalMode(projectIdOrRoomId, requiresApproval, userId);
  if (!updated) {
    throw new ApiError(500, 'Failed to update approval mode.');
  }

  return { project: updated };
}

export default {
  listUserProjects,
  createNewProject,
  getProjectDetails,
  updateProjectSettings,
  removeProject,
  getProjectCollaborators,
  changeMemberRole,
  removeMemberFromProject,
  setApprovalMode
};
