import { saveFileContent } from '../db/workspace.js';
import { getProjectById, isFileProtected } from '../db/projects.js';
import { isValidFilePath } from '../utils/filePath.js';
import { logger } from '../utils/logger.js';

// In-memory per-file debounce map for PostgreSQL saves to prevent connection pool exhaustion
const pendingFileSaves = new Map();

function debounceSocketSave(roomId, fileName, content, userId, socket) {
  const saveKey = `${roomId}:${fileName}`;
  const existing = pendingFileSaves.get(saveKey);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }

  const timer = setTimeout(async () => {
    pendingFileSaves.delete(saveKey);
    try {
      if (socket.connected) {
        socket.emit('save-status', { status: 'saving', fileName });
      }
      const saveInfo = await saveFileContent(roomId, fileName, content, userId);
      if (socket.connected) {
        socket.emit('save-status', {
          status: 'saved',
          fileName,
          savedAt: (saveInfo && saveInfo.updatedAt) || new Date().toISOString(),
          version: saveInfo ? saveInfo.version : 1
        });
      }
    } catch (err) {
      if (socket.connected) {
        socket.emit('save-status', { status: 'error', fileName });
      }
    }
  }, 400);

  pendingFileSaves.set(saveKey, { timer, content });
}

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
  
  // Authoritative server-side role and approval check cached in-memory on socket.data
  let userRole = socket.data.role;
  let requiresApproval = Boolean(socket.data.requiresApproval);
  let project = socket.data.project;

  // Cache project in socket.data once per session to avoid hitting PostgreSQL on EVERY single keystroke
  if (!project && !socket.data._checkedProject) {
    try {
      project = await getProjectById(cleanRoomId, userId);
      if (project) {
        socket.data.project = project;
        if (project.role) userRole = project.role;
        if (project.owner_id === userId) userRole = 'owner';
        socket.data.role = userRole;
        requiresApproval = Boolean(project.requires_approval);
        socket.data.requiresApproval = requiresApproval;
      }
      socket.data._checkedProject = true;
    } catch {}
  } else if (project) {
    if (project.role) userRole = project.role;
    if (project.owner_id === userId) userRole = 'owner';
    requiresApproval = Boolean(project.requires_approval);
  }

  // 1. Role check: viewers cannot edit code
  if (userRole === 'viewer') {
    logger.warn(`[Permission Denied] Socket ${socket.id} (user ${userId}) is a viewer and attempted to edit code.`);
    socket.emit('permission-error', { error: 'Viewer permission: editing is disabled.' });
    return;
  }

  // 2. Protected files check: editors cannot edit protected files
  if (userRole === 'editor' && project && isFileProtected(project, fileName)) {
    socket.emit('permission-error', {
      error: `File "${fileName}" is protected by the project owner and cannot be edited.`
    });
    socket.emit('save-status', { status: 'error', fileName });
    return;
  }

  // 3. Strict Approval Mode: When ON, editor code changes require approval
  if (userRole === 'editor' && requiresApproval) {
    socket.emit('save-status', { status: 'approval_required', fileName });
    socket.emit('approval-required', {
      roomId: cleanRoomId,
      fileName,
      message: 'Strict review mode is enabled. Your code changes require owner approval.'
    });
    return;
  }

  // Broadcast update to all other sockets in the room IMMEDIATELY (0ms database delay, pure RAM)
  socket.to(cleanRoomId).emit('code-change', {
    fileName,
    content,
    senderId: socket.id,
    authorId: userId
  });

  // Debounced PostgreSQL persistence in background so typing 50 chars only triggers 1 SQL write
  debounceSocketSave(cleanRoomId, fileName, content, userId, socket);
}

export default {
  handleCodeChange
};

