import {
  createFileInRoom,
  createFolderInRoom,
  renameFileInRoom,
  renameFolderInRoom,
  deleteFileInRoom,
  deleteFolderInRoom,
  moveItemInRoom
} from '../db/workspace.js';
import { getProjectById, isFileProtected } from '../db/projects.js';
import { logActivity } from '../services/activityService.js';

/**
 * Authoritative server-side role and protected file check for socket file operations.
 * - Viewers: blocked completely (read-only).
 * - Editors: allowed immediately for all normal file/folder operations, blocked ONLY if file is protected by owner.
 * - Owners: full permissions.
 */
async function verifySocketFilePermission(socket, roomId, action, targetPath = null) {
  const userId = socket.user?.id || socket.data.authenticatedUser?.id || socket.data.currentUser?.id || null;
  const userName = socket.user?.name || socket.data.authenticatedUser?.name || socket.data.currentUser?.name || 'Collaborator';
  const userEmail = socket.user?.email || socket.data.authenticatedUser?.email || socket.data.currentUser?.email || '';
  let userRole = socket.data.role || 'editor';

  let project = null;
  try {
    project = await getProjectById(roomId, userId);
    if (project) {
      if (project.role) userRole = project.role;
      if (project.owner_id === userId) userRole = 'owner';
    }
  } catch {}

  // 1. Role check: Viewers cannot modify files or folders
  if (userRole === 'viewer') {
    socket.emit('permission-error', { error: 'Viewer permission: editing and modifying files is disabled.' });
    return { allowed: false, userRole, project };
  }

  // 2. Protected files check: Editors cannot rename, delete, or move protected files
  if (targetPath && userRole === 'editor' && project && isFileProtected(project, targetPath)) {
    socket.emit('permission-error', {
      error: `File "${targetPath}" is protected by the project owner and cannot be modified or deleted.`
    });
    return { allowed: false, userRole, project };
  }

  return {
    allowed: true,
    userRole,
    project,
    userId,
    userName,
    userEmail
  };
}

export async function handleCreateFile(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const auth = await verifySocketFilePermission(socket, cleanRoom, 'create files');
  if (!auth.allowed) return;

  try {
    const created = await createFileInRoom({
      roomId: cleanRoom,
      filePath: data.filePath || data.path,
      content: data.content || '',
      authorId: auth.userId
    });

    io.to(cleanRoom).emit('file-created', {
      roomId: cleanRoom,
      fileName: created.fileName,
      content: created.content,
      createdBy: auth.userName
    });

    // Notify room of activity
    logActivity({
      roomId: cleanRoom,
      userId: auth.userId,
      userName: auth.userName,
      userEmail: auth.userEmail,
      actionType: 'file_create',
      targetName: created.fileName,
      summary: `${auth.userName} created file "${created.fileName}"`
    }).then((act) => {
      if (act && io) {
        io.to(cleanRoom).emit('activity-log-entry', act);
        io.to(cleanRoom).emit('activity-notification', {
          action: 'file_create',
          userName: auth.userName,
          targetName: created.fileName,
          timestamp: new Date().toISOString()
        });
      }
    }).catch(() => {});
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleCreateFolder(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const auth = await verifySocketFilePermission(socket, cleanRoom, 'create folders');
  if (!auth.allowed) return;

  try {
    const created = await createFolderInRoom({
      roomId: cleanRoom,
      folderPath: data.folderPath || data.path
    });

    io.to(cleanRoom).emit('folder-created', {
      roomId: cleanRoom,
      folderPath: created.folderPath,
      createdBy: auth.userName
    });

    logActivity({
      roomId: cleanRoom,
      userId: auth.userId,
      userName: auth.userName,
      userEmail: auth.userEmail,
      actionType: 'folder_create',
      targetName: created.folderPath,
      summary: `${auth.userName} created folder "${created.folderPath}"`
    }).then((act) => {
      if (act && io) {
        io.to(cleanRoom).emit('activity-log-entry', act);
        io.to(cleanRoom).emit('activity-notification', {
          action: 'folder_create',
          userName: auth.userName,
          targetName: created.folderPath,
          timestamp: new Date().toISOString()
        });
      }
    }).catch(() => {});
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleRenameFile(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const auth = await verifySocketFilePermission(socket, cleanRoom, 'rename files', data.oldPath);
  if (!auth.allowed) return;

  try {
    const renamed = await renameFileInRoom({
      roomId: cleanRoom,
      oldPath: data.oldPath,
      newPath: data.newPath
    });

    io.to(cleanRoom).emit('file-renamed', {
      roomId: cleanRoom,
      oldPath: renamed.oldPath,
      newPath: renamed.newPath,
      renamedBy: auth.userName
    });

    logActivity({
      roomId: cleanRoom,
      userId: auth.userId,
      userName: auth.userName,
      userEmail: auth.userEmail,
      actionType: 'file_rename',
      targetName: renamed.newPath,
      summary: `${auth.userName} renamed file "${renamed.oldPath}" to "${renamed.newPath}"`
    }).then((act) => {
      if (act && io) {
        io.to(cleanRoom).emit('activity-log-entry', act);
        io.to(cleanRoom).emit('activity-notification', {
          action: 'file_rename',
          userName: auth.userName,
          targetName: `${renamed.oldPath} -> ${renamed.newPath}`,
          timestamp: new Date().toISOString()
        });
      }
    }).catch(() => {});
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleRenameFolder(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const auth = await verifySocketFilePermission(socket, cleanRoom, 'rename folders', data.oldFolder || data.oldPath);
  if (!auth.allowed) return;

  try {
    const renamed = await renameFolderInRoom({
      roomId: cleanRoom,
      oldFolder: data.oldFolder || data.oldPath,
      newFolder: data.newFolder || data.newPath
    });

    io.to(cleanRoom).emit('folder-renamed', {
      roomId: cleanRoom,
      oldFolder: renamed.oldFolder,
      newFolder: renamed.newFolder,
      affectedFiles: renamed.affectedFiles,
      renamedBy: auth.userName
    });

    logActivity({
      roomId: cleanRoom,
      userId: auth.userId,
      userName: auth.userName,
      userEmail: auth.userEmail,
      actionType: 'folder_rename',
      targetName: renamed.newFolder,
      summary: `${auth.userName} renamed folder "${renamed.oldFolder}" to "${renamed.newFolder}"`
    }).then((act) => {
      if (act && io) {
        io.to(cleanRoom).emit('activity-log-entry', act);
        io.to(cleanRoom).emit('activity-notification', {
          action: 'folder_rename',
          userName: auth.userName,
          targetName: `${renamed.oldFolder} -> ${renamed.newFolder}`,
          timestamp: new Date().toISOString()
        });
      }
    }).catch(() => {});
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleDeleteFile(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const targetPath = data.filePath || data.path;
  const auth = await verifySocketFilePermission(socket, cleanRoom, 'delete files', targetPath);
  if (!auth.allowed) return;

  try {
    const deleted = await deleteFileInRoom({
      roomId: cleanRoom,
      filePath: targetPath
    });

    io.to(cleanRoom).emit('file-deleted', {
      roomId: cleanRoom,
      filePath: deleted.filePath,
      deletedBy: auth.userName
    });

    logActivity({
      roomId: cleanRoom,
      userId: auth.userId,
      userName: auth.userName,
      userEmail: auth.userEmail,
      actionType: 'file_delete',
      targetName: deleted.filePath,
      summary: `${auth.userName} deleted file "${deleted.filePath}"`
    }).then((act) => {
      if (act && io) {
        io.to(cleanRoom).emit('activity-log-entry', act);
        io.to(cleanRoom).emit('activity-notification', {
          action: 'file_delete',
          userName: auth.userName,
          targetName: deleted.filePath,
          timestamp: new Date().toISOString()
        });
      }
    }).catch(() => {});
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleDeleteFolder(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const targetPath = data.folderPath || data.path;
  const auth = await verifySocketFilePermission(socket, cleanRoom, 'delete folders', targetPath);
  if (!auth.allowed) return;

  try {
    const deleted = await deleteFolderInRoom({
      roomId: cleanRoom,
      folderPath: targetPath
    });

    io.to(cleanRoom).emit('folder-deleted', {
      roomId: cleanRoom,
      folderPath: deleted.folderPath,
      deletedFiles: deleted.deletedFiles,
      deletedBy: auth.userName
    });

    logActivity({
      roomId: cleanRoom,
      userId: auth.userId,
      userName: auth.userName,
      userEmail: auth.userEmail,
      actionType: 'folder_delete',
      targetName: deleted.folderPath,
      summary: `${auth.userName} deleted folder "${deleted.folderPath}"`
    }).then((act) => {
      if (act && io) {
        io.to(cleanRoom).emit('activity-log-entry', act);
        io.to(cleanRoom).emit('activity-notification', {
          action: 'folder_delete',
          userName: auth.userName,
          targetName: deleted.folderPath,
          timestamp: new Date().toISOString()
        });
      }
    }).catch(() => {});
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleMoveItem(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const auth = await verifySocketFilePermission(socket, cleanRoom, 'move items', data.oldPath);
  if (!auth.allowed) return;

  try {
    const moved = await moveItemInRoom({
      roomId: cleanRoom,
      itemType: data.itemType || 'file',
      oldPath: data.oldPath,
      targetParentFolder: data.targetParentFolder || ''
    });

    if (data.itemType === 'folder') {
      io.to(cleanRoom).emit('folder-renamed', {
        roomId: cleanRoom,
        oldFolder: moved.oldFolder,
        newFolder: moved.newFolder,
        affectedFiles: moved.affectedFiles,
        movedBy: auth.userName
      });
    } else {
      io.to(cleanRoom).emit('file-renamed', {
        roomId: cleanRoom,
        oldPath: moved.oldPath,
        newPath: moved.newPath,
        movedBy: auth.userName
      });
    }

    logActivity({
      roomId: cleanRoom,
      userId: auth.userId,
      userName: auth.userName,
      userEmail: auth.userEmail,
      actionType: 'item_move',
      targetName: moved.newPath || moved.newFolder,
      summary: `${auth.userName} moved ${data.itemType || 'item'} "${data.oldPath}" to "${data.targetParentFolder || 'root'}"`
    }).then((act) => {
      if (act && io) {
        io.to(cleanRoom).emit('activity-log-entry', act);
      }
    }).catch(() => {});
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export default {
  handleCreateFile,
  handleCreateFolder,
  handleRenameFile,
  handleRenameFolder,
  handleDeleteFile,
  handleDeleteFolder,
  handleMoveItem
};
