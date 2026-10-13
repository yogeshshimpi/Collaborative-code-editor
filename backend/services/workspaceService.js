import {
  getRoomWorkspace as dbGetRoomWorkspace,
  createFileInRoom,
  createFolderInRoom,
  renameFileInRoom,
  renameFolderInRoom,
  deleteFileInRoom,
  deleteFolderInRoom,
  moveItemInRoom
} from '../db/workspace.js';
import { getProjectById, getProjectRole } from '../db/projects.js';
import { ApiError } from '../utils/apiError.js';

/**
 * Validates that the user has write permissions for this project room.
 * Rejects viewers and checks if approval mode blocks direct changes for editors.
 */
async function assertWritePermission(roomId, userId, actionName = 'make changes') {
  const role = await getProjectRole(roomId, userId);
  if (role === 'viewer') {
    throw new ApiError(403, 'Viewer permission: editing is disabled.');
  }

  const project = await getProjectById(roomId, userId);
  if (role === 'editor' && project?.requires_approval) {
    throw new ApiError(403, `Approval mode is active. Cannot directly ${actionName}; please submit a Change Request for Owner approval.`);
  }
}

export async function getWorkspaceTree(roomId, userId) {
  const project = await getProjectById(roomId, userId);
  const projectRole = await getProjectRole(roomId, userId);
  if (project && !projectRole) {
    throw new ApiError(403, 'You do not have access to this project.');
  }
  const targetRoom = project?.room_id || roomId;
  const workspace = await dbGetRoomWorkspace(targetRoom);

  return {
    roomId: targetRoom,
    files: workspace.files,
    folders: workspace.folders,
    userRole: projectRole || 'editor',
    requiresApproval: Boolean(project?.requires_approval)
  };
}

export async function createWorkspaceFile({ roomId, path, content, userId }) {
  await assertWritePermission(roomId, userId, 'create files');

  return createFileInRoom({
    roomId,
    filePath: path,
    content: content || '',
    authorId: userId
  });
}

export async function createWorkspaceFolder({ roomId, path, userId }) {
  await assertWritePermission(roomId, userId, 'create folders');

  return createFolderInRoom({
    roomId,
    folderPath: path
  });
}

export async function renameWorkspaceFile({ roomId, oldPath, newPath, userId }) {
  await assertWritePermission(roomId, userId, 'rename files');

  return renameFileInRoom({
    roomId,
    oldPath,
    newPath
  });
}

export async function renameWorkspaceFolder({ roomId, oldFolder, newFolder, userId }) {
  await assertWritePermission(roomId, userId, 'rename folders');

  return renameFolderInRoom({
    roomId,
    oldFolder,
    newFolder
  });
}

export async function deleteWorkspaceFile({ roomId, path, userId }) {
  await assertWritePermission(roomId, userId, 'delete files');

  return deleteFileInRoom({
    roomId,
    filePath: path
  });
}

export async function deleteWorkspaceFolder({ roomId, path, userId }) {
  await assertWritePermission(roomId, userId, 'delete folders');

  return deleteFolderInRoom({
    roomId,
    folderPath: path
  });
}

export async function moveWorkspaceItem({ roomId, itemType, oldPath, targetParentFolder, userId }) {
  await assertWritePermission(roomId, userId, 'move items');

  return moveItemInRoom({
    roomId,
    itemType,
    oldPath,
    targetParentFolder
  });
}

export async function getRawWorkspace(roomId) {
  return dbGetRoomWorkspace(roomId);
}

export default {
  getWorkspaceTree,
  createWorkspaceFile,
  createWorkspaceFolder,
  renameWorkspaceFile,
  renameWorkspaceFolder,
  deleteWorkspaceFile,
  deleteWorkspaceFolder,
  moveWorkspaceItem,
  getRawWorkspace
};
