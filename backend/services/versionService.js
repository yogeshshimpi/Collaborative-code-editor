import {
  getFileVersions as dbGetFileVersions,
  getFileVersionById,
  createFileVersion,
  restoreFileVersion as dbRestoreFileVersion
} from '../db/versions.js';
import { getProjectById, getProjectRole } from '../db/projects.js';
import { getRoomFiles } from '../db/workspace.js';
import { normalizePath, isValidFilePath } from '../utils/filePath.js';
import { ApiError } from '../utils/apiError.js';

export async function listFileVersions(roomId, rawFileName, userId) {
  const fileName = normalizePath(rawFileName);
  if (!isValidFilePath(fileName)) {
    throw new ApiError(400, 'Invalid file path.');
  }

  const project = await getProjectById(roomId, userId);
  const projectRole = await getProjectRole(roomId, userId);
  if (project && !projectRole) {
    throw new ApiError(403, 'You do not have access to view this project.');
  }
  const targetRoom = project?.room_id || roomId;

  const versions = await dbGetFileVersions(targetRoom, fileName);
  return {
    roomId: targetRoom,
    fileName,
    versions,
    userRole: projectRole || 'editor'
  };
}

export async function getSingleVersionPreview(roomId, rawFileName, versionId, userId) {
  const fileName = normalizePath(rawFileName);
  if (!isValidFilePath(fileName)) {
    throw new ApiError(400, 'Invalid file path.');
  }

  const project = await getProjectById(roomId, userId);
  const projectRole = await getProjectRole(roomId, userId);
  if (project && !projectRole) {
    throw new ApiError(403, 'You do not have access to view this project.');
  }
  const targetRoom = project?.room_id || roomId;

  const version = await getFileVersionById(versionId, targetRoom);
  if (!version || version.file_name !== fileName) {
    throw new ApiError(404, 'Version not found for this file.');
  }

  return version;
}

export async function createManualSnapshot({ roomId, rawFileName, content, label, userId }) {
  const fileName = normalizePath(rawFileName);
  if (!isValidFilePath(fileName)) {
    throw new ApiError(400, 'Invalid file path.');
  }

  const project = await getProjectById(roomId, userId);
  const projectRole = await getProjectRole(roomId, userId);
  if (project && !projectRole) {
    throw new ApiError(403, 'You do not have access to this project.');
  }
  if (projectRole === 'viewer') {
    throw new ApiError(403, 'Permission denied: Viewers cannot create manual versions.');
  }
  const targetRoom = project?.room_id || roomId;

  let fileContent = typeof content === 'string' ? content : null;
  if (fileContent === null) {
    const roomFiles = await getRoomFiles(targetRoom);
    fileContent = roomFiles[fileName] || '';
  }

  const newVersion = await createFileVersion({
    roomId: targetRoom,
    fileName,
    content: fileContent,
    authorId: userId,
    versionType: 'manual',
    label: typeof label === 'string' && label.trim() ? label.trim().slice(0, 100) : 'Manual Snapshot'
  });

  return newVersion;
}

export async function restoreVersionSnapshot({ roomId, rawFileName, versionId, userId }) {
  const fileName = normalizePath(rawFileName);
  if (!isValidFilePath(fileName)) {
    throw new ApiError(400, 'Invalid file path.');
  }

  const project = await getProjectById(roomId, userId);
  const projectRole = await getProjectRole(roomId, userId);
  if (project && !projectRole) {
    throw new ApiError(403, 'You do not have access to this project.');
  }
  if (projectRole === 'viewer') {
    throw new ApiError(403, 'Viewer permission: editing is disabled.');
  }
  if (projectRole === 'editor' && project?.requires_approval) {
    throw new ApiError(403, 'Approval mode is active. Restoring a version must be submitted as a Change Request for Owner approval.');
  }
  const targetRoom = project?.room_id || roomId;

  const targetVersion = await getFileVersionById(versionId, targetRoom);
  if (!targetVersion || targetVersion.file_name !== fileName) {
    throw new ApiError(404, 'Version not found for this file.');
  }

  const restored = await dbRestoreFileVersion({
    versionId,
    roomId: targetRoom,
    restoredByUserId: userId
  });

  return { restored, targetRoom, project };
}

export default {
  listFileVersions,
  getSingleVersionPreview,
  createManualSnapshot,
  restoreVersionSnapshot
};
