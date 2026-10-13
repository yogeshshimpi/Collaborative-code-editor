import { saveFileContent } from '../db/workspace.js';
import { getProjectById } from '../db/projects.js';
import { isValidFilePath } from '../utils/filePath.js';
import { logger } from '../utils/logger.js';

export async function handleCodeChange(io, socket, data) {
  if (!data || typeof data !== 'object') {
    return;
  }

  const { roomId, fileName, content } = data;

  // Validation
  if (
    typeof roomId !== 'string' ||
    !roomId.trim() ||
    roomId.trim().length > 64 ||
    !isValidFilePath(fileName) ||
    typeof content !== 'string'
  ) {
    logger.warn(`[Rejected Invalid code-change] Socket ${socket.id}`, { roomId, fileName, contentType: typeof content });
    return;
  }

  const cleanRoomId = roomId.trim();
  const userId = socket.user?.id || socket.data.authenticatedUser?.id || socket.data.currentUser?.id || null;
  
  // Authoritative server-side role and approval check from database
  let userRole = socket.data.role;
  let requiresApproval = false;

  try {
    const project = await getProjectById(cleanRoomId, userId);
    if (project) {
      if (project.role) userRole = project.role;
      requiresApproval = Boolean(project.requires_approval);
    }
  } catch {}

  // 1. Role check: viewers cannot edit code
  if (userRole === 'viewer') {
    logger.warn(`[Permission Denied] Socket ${socket.id} (user ${userId}) is a viewer and attempted to edit code.`);
    socket.emit('permission-error', { error: 'Viewer permission: editing is disabled.' });
    return;
  }

  // 2. Approval check: editors cannot auto-save code when approval mode is enabled
  if (userRole === 'editor' && requiresApproval) {
    socket.emit('save-status', { status: 'approval_required', fileName });
    socket.emit('approval-required', {
      roomId: cleanRoomId,
      fileName,
      message: 'Approval mode is active. Please submit your changes as a Change Request for Owner review.'
    });
    return;
  }

  // Broadcast update to all other sockets in the room (instant live sync)
  socket.to(cleanRoomId).emit('code-change', {
    fileName,
    content
  });

  // Notify editing browser of save status
  socket.emit('save-status', { status: 'saving', fileName });
  saveFileContent(cleanRoomId, fileName, content, userId)
    .then(() => {
      socket.emit('save-status', {
        status: 'saved',
        fileName,
        savedAt: new Date().toISOString()
      });
    })
    .catch(() => {
      socket.emit('save-status', { status: 'error', fileName });
    });
}

export default {
  handleCodeChange
};

