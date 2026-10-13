import {
  getProjectInvitations,
  createProjectInvitation,
  revokeProjectInvitation,
  getUserPendingInvitations,
  respondToInvitation as dbRespondToInvitation
} from '../db/invitations.js';
import { getProjectById } from '../db/projects.js';
import { ApiError } from '../utils/apiError.js';

export async function sendProjectInvitation({ projectId, invitedEmail, role, requester }) {
  if (!invitedEmail || typeof invitedEmail !== 'string' || !invitedEmail.includes('@')) {
    throw new ApiError(400, 'Please provide a valid email address.');
  }
  if (!['editor', 'viewer'].includes(role)) {
    throw new ApiError(400, 'Role must be either editor or viewer.');
  }

  const project = await getProjectById(projectId, requester.id);
  if (!project) {
    throw new ApiError(404, 'Project not found.');
  }
  if (project.owner_id !== requester.id) {
    throw new ApiError(403, 'Only the project owner can invite collaborators.');
  }

  const invitation = await createProjectInvitation({
    projectId: project.id,
    invitedById: requester.id,
    invitedEmail: invitedEmail.trim(),
    role
  });

  return { invitation, project };
}

export async function cancelProjectInvitation(projectId, invitationId, requesterId) {
  const project = await getProjectById(projectId, requesterId);
  if (!project) throw new ApiError(404, 'Project not found.');
  if (project.owner_id !== requesterId) {
    throw new ApiError(403, 'Only the project owner can revoke invitations.');
  }

  const revoked = await revokeProjectInvitation(invitationId, project.id);
  if (!revoked) {
    throw new ApiError(404, 'Invitation not found or already processed.');
  }
  return revoked;
}

export async function listUserInvitations(userEmail) {
  return getUserPendingInvitations(userEmail);
}

export async function handleInvitationResponse({ invitationId, userEmail, userId, action }) {
  if (!['accept', 'decline'].includes(action)) {
    throw new ApiError(400, 'Action must be either accept or decline.');
  }

  const result = await dbRespondToInvitation(invitationId, userEmail, userId, action);
  let project = null;
  if (action === 'accept' && result?.projectId) {
    project = await getProjectById(result.projectId, userId);
  }

  return { result, project };
}

export default {
  sendProjectInvitation,
  cancelProjectInvitation,
  listUserInvitations,
  handleInvitationResponse
};
