import {
  createChangeRequest,
  getProjectChangeRequests,
  getChangeRequestById,
  updateChangeRequestReview
} from '../db/changeRequests.js';
import { getProjectById, getProjectRole } from '../db/projects.js';
import {
  saveFileContent,
  createFileInRoom,
  renameFileInRoom,
  deleteFileInRoom,
  createFolderInRoom,
  renameFolderInRoom,
  deleteFolderInRoom
} from '../db/workspace.js';
import { createFileVersion, restoreFileVersion } from '../db/versions.js';
import { logActivity } from './activityService.js';
import { ApiError } from '../utils/apiError.js';

export async function listProjectChangeRequests(projectIdOrRoomId, userId, status = 'all') {
  const project = await getProjectById(projectIdOrRoomId, userId);
  const role = await getProjectRole(projectIdOrRoomId, userId);
  if (!project || !role) {
    throw new ApiError(403, 'You do not have access to this project.');
  }

  const allRequests = await getProjectChangeRequests(project.id, status);
  const pendingRequests = await getProjectChangeRequests(project.id, 'pending');

  return {
    changeRequests: allRequests,
    pendingCount: pendingRequests.length,
    userRole: role,
    requiresApproval: Boolean(project.requires_approval)
  };
}

export async function submitChangeRequest({
  projectIdOrRoomId,
  userId,
  userName,
  userEmail = '',
  requestType = 'code_change',
  targetPath,
  oldPath = null,
  proposedContent = null,
  originalContent = null,
  title,
  description = ''
}) {
  const project = await getProjectById(projectIdOrRoomId, userId);
  const role = await getProjectRole(projectIdOrRoomId, userId);

  if (!project || !role) {
    throw new ApiError(403, 'You do not have access to this project.');
  }

  if (role === 'viewer') {
    throw new ApiError(403, 'Viewer permission: editing is disabled.');
  }

  if (!targetPath || typeof targetPath !== 'string') {
    throw new ApiError(400, 'Target file or folder path is required.');
  }

  const cleanTitle = (title && typeof title === 'string' && title.trim())
    ? title.trim().slice(0, 150)
    : `Proposal: ${requestType.replace('_', ' ')} on ${targetPath}`;

  const changeRequest = await createChangeRequest({
    projectId: project.id,
    roomId: project.room_id,
    authorId: userId,
    authorName: userName,
    authorEmail: userEmail,
    requestType,
    targetPath: targetPath.trim(),
    oldPath: oldPath?.trim() || null,
    proposedContent,
    originalContent,
    title: cleanTitle,
    description: description || ''
  });

  // Log activity
  logActivity({
    roomId: project.room_id,
    userId,
    userName,
    userEmail,
    actionType: 'change_request_create',
    targetName: targetPath,
    details: {
      requestId: changeRequest.id,
      requestType,
      title: cleanTitle
    },
    summary: `${userName} submitted change request "${cleanTitle}" for ${targetPath}`
  }).catch(() => {});

  return changeRequest;
}

export async function reviewChangeRequest({
  projectIdOrRoomId,
  requestId,
  userId,
  userName,
  userEmail = '',
  status,
  rejectionReason = null
}) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new ApiError(400, 'Invalid status. Must be "approved" or "rejected".');
  }

  const project = await getProjectById(projectIdOrRoomId, userId);
  const role = await getProjectRole(projectIdOrRoomId, userId);

  if (!project) {
    throw new ApiError(404, 'Project not found.');
  }

  if (role !== 'owner' && project.owner_id !== userId) {
    throw new ApiError(403, 'Only the project owner can approve or reject change requests.');
  }

  const cr = await getChangeRequestById(requestId);
  if (!cr) {
    throw new ApiError(404, 'Change request not found.');
  }

  if (cr.status !== 'pending') {
    throw new ApiError(400, `Change request has already been ${cr.status}.`);
  }

  let appliedResult = null;

  if (status === 'approved') {
    const roomId = project.room_id || cr.room_id;

    switch (cr.request_type) {
      case 'code_change': {
        await saveFileContent(roomId, cr.target_path, cr.proposed_content || '');
        // Record version snapshot with label
        await createFileVersion({
          roomId,
          fileName: cr.target_path,
          content: cr.proposed_content || '',
          authorId: cr.author_id,
          versionType: 'manual',
          label: `Approved change request: ${cr.title}`
        });
        appliedResult = {
          type: 'code_change',
          filePath: cr.target_path,
          content: cr.proposed_content
        };
        break;
      }

      case 'file_create': {
        const created = await createFileInRoom({
          roomId,
          filePath: cr.target_path,
          content: cr.proposed_content || '',
          authorId: cr.author_id
        });
        appliedResult = {
          type: 'file_create',
          filePath: created.fileName,
          content: created.content
        };
        break;
      }

      case 'file_rename': {
        const renamed = await renameFileInRoom({
          roomId,
          oldPath: cr.old_path,
          newPath: cr.target_path
        });
        appliedResult = {
          type: 'file_rename',
          oldPath: renamed.oldPath,
          newPath: renamed.newPath
        };
        break;
      }

      case 'file_delete': {
        const deleted = await deleteFileInRoom({
          roomId,
          filePath: cr.target_path
        });
        appliedResult = {
          type: 'file_delete',
          filePath: deleted.filePath
        };
        break;
      }

      case 'folder_create': {
        const created = await createFolderInRoom({
          roomId,
          folderPath: cr.target_path
        });
        appliedResult = {
          type: 'folder_create',
          folderPath: created.folderPath
        };
        break;
      }

      case 'folder_rename': {
        const renamed = await renameFolderInRoom({
          roomId,
          oldFolder: cr.old_path,
          newFolder: cr.target_path
        });
        appliedResult = {
          type: 'folder_rename',
          oldFolder: renamed.oldFolder,
          newFolder: renamed.newFolder,
          affectedFiles: renamed.affectedFiles
        };
        break;
      }

      case 'folder_delete': {
        const deleted = await deleteFolderInRoom({
          roomId,
          folderPath: cr.target_path
        });
        appliedResult = {
          type: 'folder_delete',
          folderPath: deleted.folderPath,
          deletedFiles: deleted.deletedFiles
        };
        break;
      }

      case 'version_restore': {
        if (cr.proposed_content) {
          const restored = await restoreFileVersion({
            roomId,
            fileName: cr.target_path,
            versionId: cr.proposed_content,
            authorId: userId
          });
          appliedResult = {
            type: 'version_restore',
            filePath: restored.fileName,
            content: restored.content
          };
        }
        break;
      }

      default:
        break;
    }

    // Log approval activity
    logActivity({
      roomId: project.room_id,
      userId,
      userName,
      userEmail,
      actionType: 'change_request_approve',
      targetName: cr.target_path,
      details: {
        requestId: cr.id,
        authorName: cr.author_name,
        title: cr.title
      },
      summary: `${userName} approved change request "${cr.title}" by ${cr.author_name}`
    }).catch(() => {});
  } else {
    // Log rejection activity
    logActivity({
      roomId: project.room_id,
      userId,
      userName,
      userEmail,
      actionType: 'change_request_reject',
      targetName: cr.target_path,
      details: {
        requestId: cr.id,
        authorName: cr.author_name,
        title: cr.title,
        reason: rejectionReason
      },
      summary: `${userName} rejected change request "${cr.title}" by ${cr.author_name}${rejectionReason ? `: ${rejectionReason}` : ''}`
    }).catch(() => {});
  }

  const updatedCr = await updateChangeRequestReview(requestId, {
    status,
    reviewedBy: userId,
    rejectionReason: status === 'rejected' ? (rejectionReason || null) : null
  });

  return {
    changeRequest: updatedCr,
    appliedResult,
    project
  };
}

export default {
  listProjectChangeRequests,
  submitChangeRequest,
  reviewChangeRequest
};
