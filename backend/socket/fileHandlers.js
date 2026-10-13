import {
  createFileInRoom,
  createFolderInRoom,
  renameFileInRoom,
  renameFolderInRoom,
  deleteFileInRoom,
  deleteFolderInRoom,
  moveItemInRoom
} from '../db/workspace.js';
import { getProjectById } from '../db/projects.js';

/**
 * Authoritative server-side role and approval check for socket file operations.
 */
async function verifySocketFilePermission(socket, roomId, action) {
  const userId = socket.user?.id || socket.data.authenticatedUser?.id || socket.data.currentUser?.id || null;
  let userRole = socket.data.role;
  let requiresApproval = false;

  try {
    const project = await getProjectById(roomId, userId);
    if (project) {
      if (project.role) userRole = project.role;
      requiresApproval = Boolean(project.requires_approval);
    }
  } catch {}

  if (userRole === 'viewer') {
    socket.emit('permission-error', { error: 'Viewer permission: editing is disabled.' });
    return false;
  }

  if (userRole === 'editor' && requiresApproval) {
    socket.emit('permission-error', {
      error: `Approval mode is active. Cannot directly ${action}; please submit a Change Request for Owner approval.`
    });
    socket.emit('approval-required', { roomId, action });
    return false;
  }

  return true;
}

export async function handleCreateFile(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const allowed = await verifySocketFilePermission(socket, cleanRoom, 'create files');
  if (!allowed) return;

  try {
    const created = await createFileInRoom({
      roomId: cleanRoom,
      filePath: data.filePath || data.path,
      content: data.content || '',
      authorId: socket.user?.id || socket.data.authenticatedUser?.id || socket.data.currentUser?.id || null
    });

    io.to(cleanRoom).emit('file-created', {
      roomId: cleanRoom,
      fileName: created.fileName,
      content: created.content
    });
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleCreateFolder(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const allowed = await verifySocketFilePermission(socket, cleanRoom, 'create folders');
  if (!allowed) return;

  try {
    const created = await createFolderInRoom({
      roomId: cleanRoom,
      folderPath: data.folderPath || data.path
    });

    io.to(cleanRoom).emit('folder-created', {
      roomId: cleanRoom,
      folderPath: created.folderPath
    });
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleRenameFile(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const allowed = await verifySocketFilePermission(socket, cleanRoom, 'rename files');
  if (!allowed) return;

  try {
    const renamed = await renameFileInRoom({
      roomId: cleanRoom,
      oldPath: data.oldPath,
      newPath: data.newPath
    });

    io.to(cleanRoom).emit('file-renamed', {
      roomId: cleanRoom,
      oldPath: renamed.oldPath,
      newPath: renamed.newPath
    });
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleRenameFolder(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const allowed = await verifySocketFilePermission(socket, cleanRoom, 'rename folders');
  if (!allowed) return;

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
      affectedFiles: renamed.affectedFiles
    });
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleDeleteFile(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const allowed = await verifySocketFilePermission(socket, cleanRoom, 'delete files');
  if (!allowed) return;

  try {
    const deleted = await deleteFileInRoom({
      roomId: cleanRoom,
      filePath: data.filePath || data.path
    });

    io.to(cleanRoom).emit('file-deleted', {
      roomId: cleanRoom,
      filePath: deleted.filePath
    });
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleDeleteFolder(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const allowed = await verifySocketFilePermission(socket, cleanRoom, 'delete folders');
  if (!allowed) return;

  try {
    const deleted = await deleteFolderInRoom({
      roomId: cleanRoom,
      folderPath: data.folderPath || data.path
    });

    io.to(cleanRoom).emit('folder-deleted', {
      roomId: cleanRoom,
      folderPath: deleted.folderPath,
      deletedFiles: deleted.deletedFiles
    });
  } catch (err) {
    socket.emit('file-error', { error: err.message });
  }
}

export async function handleMoveItem(io, socket, data) {
  if (!data || typeof data !== 'object') return;
  const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
  if (!cleanRoom) return;

  const allowed = await verifySocketFilePermission(socket, cleanRoom, 'move items');
  if (!allowed) return;

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
        affectedFiles: moved.affectedFiles
      });
    } else {
      io.to(cleanRoom).emit('file-renamed', {
        roomId: cleanRoom,
        oldPath: moved.oldPath,
        newPath: moved.newPath
      });
    }
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
