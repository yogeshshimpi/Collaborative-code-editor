import {
  getWorkspaceTree,
  saveWorkspaceFile,
  createWorkspaceFile,
  createWorkspaceFolder,
  renameWorkspaceFile,
  renameWorkspaceFolder,
  deleteWorkspaceFile,
  deleteWorkspaceFolder,
  moveWorkspaceItem,
  getRawWorkspace
} from '../services/workspaceService.js';
import { logActivity } from '../services/activityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isValidFilePath } from '../utils/filePath.js';
import { ApiError } from '../utils/apiError.js';

export const getTree = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const data = await getWorkspaceTree(roomId, req.user.id);
  res.json(data);
});

export const getFiles = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const data = await getWorkspaceTree(roomId, req.user.id);
  res.json(data);
});

export const saveFileContentEndpoint = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { fileName, content, baseVersion } = req.body;

  if (!isValidFilePath(fileName)) {
    throw new ApiError(400, 'Invalid file path.');
  }
  if (typeof content !== 'string') {
    throw new ApiError(400, 'Content must be a string.');
  }

  const saved = await saveWorkspaceFile({
    roomId,
    fileName,
    content,
    userId: req.user.id,
    baseVersion
  });

  const io = req.app.get('io');
  if (io) {
    // Notify room of updated save status
    io.to(roomId).emit('save-status', {
      status: 'saved',
      fileName: saved.fileName,
      savedAt: saved.updatedAt,
      version: saved.version
    });
  }

  res.status(200).json({
    message: 'File saved successfully.',
    file: {
      fileName: saved.fileName,
      content: saved.content,
      updatedAt: saved.updatedAt,
      version: saved.version
    }
  });
});

export const createFile = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { path, content } = req.body;
  const created = await createWorkspaceFile({ roomId, path, content, userId: req.user.id });

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('file-created', {
      roomId,
      fileName: created.fileName,
      content: created.content
    });
  }

  logActivity({
    roomId,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'file_create',
    targetName: created.fileName,
    details: {},
    summary: `${req.user.name} created ${created.fileName}`
  }).then((act) => {
    if (act && io) io.to(roomId).emit('activity-log-entry', act);
  }).catch(() => {});

  res.status(201).json({
    message: `File "${created.fileName}" created successfully.`,
    file: created
  });
});

export const createFolder = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { path } = req.body;
  const created = await createWorkspaceFolder({ roomId, path, userId: req.user.id });

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('folder-created', {
      roomId,
      folderPath: created.folderPath
    });
  }

  logActivity({
    roomId,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'folder_create',
    targetName: created.folderPath,
    details: {},
    summary: `${req.user.name} created ${created.folderPath}`
  }).then((act) => {
    if (act && io) io.to(roomId).emit('activity-log-entry', act);
  }).catch(() => {});

  res.status(201).json({
    message: `Folder "${created.folderPath}" created successfully.`,
    folder: created
  });
});

export const renameFile = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { oldPath, newPath } = req.body;
  const renamed = await renameWorkspaceFile({ roomId, oldPath, newPath, userId: req.user.id });

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('file-renamed', {
      roomId,
      oldPath: renamed.oldPath,
      newPath: renamed.newPath
    });
  }

  logActivity({
    roomId,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'file_rename',
    targetName: renamed.newPath,
    details: { oldPath: renamed.oldPath, newPath: renamed.newPath },
    summary: `${req.user.name} renamed ${renamed.oldPath} to ${renamed.newPath}`
  }).then((act) => {
    if (act && io) io.to(roomId).emit('activity-log-entry', act);
  }).catch(() => {});

  res.json({
    message: `Renamed "${renamed.oldPath}" to "${renamed.newPath}".`,
    ...renamed
  });
});

export const renameFolder = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { oldFolder, newFolder, oldPath, newPath } = req.body;
  const source = oldFolder || oldPath;
  const target = newFolder || newPath;

  const renamed = await renameWorkspaceFolder({ roomId, oldFolder: source, newFolder: target, userId: req.user.id });

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('folder-renamed', {
      roomId,
      oldFolder: renamed.oldFolder,
      newFolder: renamed.newFolder,
      affectedFiles: renamed.affectedFiles
    });
  }

  logActivity({
    roomId,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'folder_rename',
    targetName: renamed.newFolder,
    details: { oldFolder: renamed.oldFolder, newFolder: renamed.newFolder },
    summary: `${req.user.name} renamed folder ${renamed.oldFolder} to ${renamed.newFolder}`
  }).then((act) => {
    if (act && io) io.to(roomId).emit('activity-log-entry', act);
  }).catch(() => {});

  res.json({
    message: `Renamed folder "${renamed.oldFolder}" to "${renamed.newFolder}".`,
    ...renamed
  });
});

export const deleteFile = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const path = req.body?.path || req.query?.path;

  const deleted = await deleteWorkspaceFile({ roomId, path, userId: req.user.id });

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('file-deleted', {
      roomId,
      filePath: deleted.filePath
    });
  }

  logActivity({
    roomId,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'file_delete',
    targetName: deleted.filePath,
    details: {},
    summary: `${req.user.name} deleted ${deleted.filePath}`
  }).then((act) => {
    if (act && io) io.to(roomId).emit('activity-log-entry', act);
  }).catch(() => {});

  res.json({
    message: `Deleted file "${deleted.filePath}".`,
    ...deleted
  });
});

export const deleteFolder = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const path = req.body?.path || req.query?.path;

  const deleted = await deleteWorkspaceFolder({ roomId, path, userId: req.user.id });

  const io = req.app.get('io');
  if (io) {
    io.to(roomId).emit('folder-deleted', {
      roomId,
      folderPath: deleted.folderPath,
      deletedFiles: deleted.deletedFiles
    });
  }

  logActivity({
    roomId,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'folder_delete',
    targetName: deleted.folderPath,
    details: {},
    summary: `${req.user.name} deleted folder ${deleted.folderPath}`
  }).then((act) => {
    if (act && io) io.to(roomId).emit('activity-log-entry', act);
  }).catch(() => {});

  res.json({
    message: `Deleted folder "${deleted.folderPath}".`,
    ...deleted
  });
});

export const moveItem = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { itemType, oldPath, targetParentFolder } = req.body;

  const moved = await moveWorkspaceItem({
    roomId,
    itemType: itemType || 'file',
    oldPath,
    targetParentFolder: targetParentFolder || '',
    userId: req.user.id
  });

  const io = req.app.get('io');
  if (io) {
    if (itemType === 'folder') {
      io.to(roomId).emit('folder-renamed', {
        roomId,
        oldFolder: moved.oldFolder,
        newFolder: moved.newFolder,
        affectedFiles: moved.affectedFiles
      });
    } else {
      io.to(roomId).emit('file-renamed', {
        roomId,
        oldPath: moved.oldPath,
        newPath: moved.newPath
      });
    }
  }

  const originPath = itemType === 'folder' ? moved.oldFolder : moved.oldPath;
  const targetPath = itemType === 'folder' ? moved.newFolder : moved.newPath;
  logActivity({
    roomId,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'item_move',
    targetName: targetPath,
    details: { oldPath: originPath, newPath: targetPath, itemType },
    summary: `${req.user.name} moved ${originPath} to ${targetParentFolder || 'root'}`
  }).then((act) => {
    if (act && io) io.to(roomId).emit('activity-log-entry', act);
  }).catch(() => {});

  res.json({
    message: 'Moved successfully.',
    ...moved
  });
});

export const getLegacyRoom = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const workspace = await getRawWorkspace(roomId);
  res.json({ roomId, files: workspace.files, folders: workspace.folders });
});

export default {
  getTree,
  getFiles,
  createFile,
  createFolder,
  renameFile,
  renameFolder,
  deleteFile,
  deleteFolder,
  moveItem,
  getLegacyRoom
};
