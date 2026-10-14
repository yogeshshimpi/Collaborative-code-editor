import { useEffect, useRef, useState, useCallback } from 'react';
import { initSocket } from '../socket';

export function useSocket({
  roomId,
  user,
  onRemoteCodeChange,
  onRoomSync,
  onSaveStatus,
  onPermissionError,
  onFileCreated,
  onFileRenamed,
  onFileDeleted,
  onFolderCreated,
  onFolderRenamed,
  onFolderDeleted,
  onFileError,
  onProjectInfo,
  onProjectRenamed,
  onActivityLogEntry,
  onApprovalModeUpdated,
  onChangeRequestCreated,
  onChangeRequestApproved,
  onChangeRequestRejected,
  onApprovalRequired,
  onProtectedFilesUpdated,
  onActivityNotification
}) {
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [participantCount, setParticipantCount] = useState(1);
  const [activeUsers, setActiveUsers] = useState([]);
  const [role, setRole] = useState('editor');
  const [remoteCursors, setRemoteCursors] = useState({});
  const socketRef = useRef(null);

  // Store callbacks and user in refs to keep listener references stable
  const onRemoteCodeChangeRef = useRef(onRemoteCodeChange);
  const onRoomSyncRef = useRef(onRoomSync);
  const onSaveStatusRef = useRef(onSaveStatus);
  const onPermissionErrorRef = useRef(onPermissionError);
  const onFileCreatedRef = useRef(onFileCreated);
  const onFileRenamedRef = useRef(onFileRenamed);
  const onFileDeletedRef = useRef(onFileDeleted);
  const onFolderCreatedRef = useRef(onFolderCreated);
  const onFolderRenamedRef = useRef(onFolderRenamed);
  const onFolderDeletedRef = useRef(onFolderDeleted);
  const onFileErrorRef = useRef(onFileError);
  const onProjectInfoRef = useRef(onProjectInfo);
  const onProjectRenamedRef = useRef(onProjectRenamed);
  const onActivityLogEntryRef = useRef(onActivityLogEntry);
  const onApprovalModeUpdatedRef = useRef(onApprovalModeUpdated);
  const onChangeRequestCreatedRef = useRef(onChangeRequestCreated);
  const onChangeRequestApprovedRef = useRef(onChangeRequestApproved);
  const onChangeRequestRejectedRef = useRef(onChangeRequestRejected);
  const onApprovalRequiredRef = useRef(onApprovalRequired);
  const onProtectedFilesUpdatedRef = useRef(onProtectedFilesUpdated);
  const onActivityNotificationRef = useRef(onActivityNotification);
  const userRef = useRef(user);

  useEffect(() => {
    onProtectedFilesUpdatedRef.current = onProtectedFilesUpdated;
  }, [onProtectedFilesUpdated]);

  useEffect(() => {
    onActivityNotificationRef.current = onActivityNotification;
  }, [onActivityNotification]);

  useEffect(() => {
    onRemoteCodeChangeRef.current = onRemoteCodeChange;
  }, [onRemoteCodeChange]);

  useEffect(() => {
    onRoomSyncRef.current = onRoomSync;
  }, [onRoomSync]);

  useEffect(() => {
    onSaveStatusRef.current = onSaveStatus;
  }, [onSaveStatus]);

  useEffect(() => {
    onPermissionErrorRef.current = onPermissionError;
  }, [onPermissionError]);

  useEffect(() => {
    onFileCreatedRef.current = onFileCreated;
  }, [onFileCreated]);

  useEffect(() => {
    onFileRenamedRef.current = onFileRenamed;
  }, [onFileRenamed]);

  useEffect(() => {
    onFileDeletedRef.current = onFileDeleted;
  }, [onFileDeleted]);

  useEffect(() => {
    onFolderCreatedRef.current = onFolderCreated;
  }, [onFolderCreated]);

  useEffect(() => {
    onFolderRenamedRef.current = onFolderRenamed;
  }, [onFolderRenamed]);

  useEffect(() => {
    onFolderDeletedRef.current = onFolderDeleted;
  }, [onFolderDeleted]);

  useEffect(() => {
    onFileErrorRef.current = onFileError;
  }, [onFileError]);

  useEffect(() => {
    onProjectInfoRef.current = onProjectInfo;
  }, [onProjectInfo]);

  useEffect(() => {
    onProjectRenamedRef.current = onProjectRenamed;
  }, [onProjectRenamed]);

  useEffect(() => {
    onActivityLogEntryRef.current = onActivityLogEntry;
  }, [onActivityLogEntry]);

  useEffect(() => {
    onApprovalModeUpdatedRef.current = onApprovalModeUpdated;
  }, [onApprovalModeUpdated]);

  useEffect(() => {
    onChangeRequestCreatedRef.current = onChangeRequestCreated;
  }, [onChangeRequestCreated]);

  useEffect(() => {
    onChangeRequestApprovedRef.current = onChangeRequestApproved;
  }, [onChangeRequestApproved]);

  useEffect(() => {
    onChangeRequestRejectedRef.current = onChangeRequestRejected;
  }, [onChangeRequestRejected]);

  useEffect(() => {
    onApprovalRequiredRef.current = onApprovalRequired;
  }, [onApprovalRequired]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!roomId) return;

    const socket = initSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionStatus('connected');
      // Emit join-room with room ID and live user presence details
      socket.emit('join-room', {
        roomId,
        user: userRef.current
      });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      setRemoteCursors({});
    });

    socket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('reconnect_attempt', () => {
      setConnectionStatus('connecting');
    });

    // Receive workspace permission role (owner, editor, viewer)
    socket.on('user-role', (data) => {
      if (data?.role) {
        setRole(data.role);
      }
    });

    // Receive resolved project info
    socket.on('project-info', (data) => {
      if (data && onProjectInfoRef.current) {
        onProjectInfoRef.current(data);
      }
    });

    // Receive project renamed notification
    socket.on('project-renamed', (data) => {
      if (data && onProjectRenamedRef.current) {
        onProjectRenamedRef.current(data);
      }
    });

    // Permission error handler
    socket.on('permission-error', (data) => {
      if (data && onPermissionErrorRef.current) {
        onPermissionErrorRef.current(data);
      }
    });

    // File operation error handler
    socket.on('file-error', (data) => {
      if (data && onFileErrorRef.current) {
        onFileErrorRef.current(data);
      }
    });

    // Update active collaborator presence list
    socket.on('room-users', ({ users }) => {
      if (Array.isArray(users)) {
        setActiveUsers(users);
        setParticipantCount(users.length);

        // Remove remote cursors for users who have left
        const activeSocketIds = new Set(users.map((u) => u.socketId));
        setRemoteCursors((prev) => {
          let hasOrphans = false;
          for (const sId of Object.keys(prev)) {
            if (!activeSocketIds.has(sId)) {
              hasOrphans = true;
              break;
            }
          }
          if (!hasOrphans) return prev;
          const next = { ...prev };
          for (const sId of Object.keys(next)) {
            if (!activeSocketIds.has(sId)) {
              delete next[sId];
            }
          }
          return next;
        });
      }
    });

    socket.on('room-participants', ({ count }) => {
      if (typeof count === 'number') {
        setParticipantCount(count);
      }
    });

    socket.on('code-change', (data) => {
      if (data && onRemoteCodeChangeRef.current) {
        onRemoteCodeChangeRef.current(data);
      }
    });

    socket.on('room-sync', (data) => {
      if (data && onRoomSyncRef.current) {
        onRoomSyncRef.current(data);
      }
    });

    socket.on('save-status', (data) => {
      if (data && onSaveStatusRef.current) {
        onSaveStatusRef.current(data);
      }
    });

    // File and folder real-time synchronization events
    socket.on('file-created', (data) => {
      if (data && onFileCreatedRef.current) {
        onFileCreatedRef.current(data);
      }
    });

    socket.on('file-renamed', (data) => {
      if (data && onFileRenamedRef.current) {
        onFileRenamedRef.current(data);
      }
    });

    socket.on('file-deleted', (data) => {
      if (data && onFileDeletedRef.current) {
        onFileDeletedRef.current(data);
      }
    });

    socket.on('folder-created', (data) => {
      if (data && onFolderCreatedRef.current) {
        onFolderCreatedRef.current(data);
      }
    });

    socket.on('folder-renamed', (data) => {
      if (data && onFolderRenamedRef.current) {
        onFolderRenamedRef.current(data);
      }
    });

    socket.on('folder-deleted', (data) => {
      if (data && onFolderDeletedRef.current) {
        onFolderDeletedRef.current(data);
      }
    });

    // Remote collaborator cursor and selection updates
    socket.on('cursor-change', (data) => {
      if (data && data.socketId) {
        setRemoteCursors((prev) => ({
          ...prev,
          [data.socketId]: data
        }));
      }
    });

    // Remote collaborator cursor cleared (e.g. switched files, blurred)
    socket.on('cursor-clear', (data) => {
      if (data?.socketId) {
        setRemoteCursors((prev) => {
          if (!prev[data.socketId]) return prev;
          const next = { ...prev };
          delete next[data.socketId];
          return next;
        });
      }
    });

    // Real-time project activity log entry broadcast
    socket.on('activity-log-entry', (data) => {
      if (data && onActivityLogEntryRef.current) {
        onActivityLogEntryRef.current(data);
      }
    });

    // Approval mode updated by project owner
    socket.on('approval-mode-updated', (data) => {
      if (data && onApprovalModeUpdatedRef.current) {
        onApprovalModeUpdatedRef.current(data);
      }
    });

    // Change request created
    socket.on('change-request-created', (data) => {
      if (data && onChangeRequestCreatedRef.current) {
        onChangeRequestCreatedRef.current(data);
      }
    });

    // Change request approved by owner
    socket.on('change-request-approved', (data) => {
      if (data && onChangeRequestApprovedRef.current) {
        onChangeRequestApprovedRef.current(data);
      }
    });

    // Change request rejected by owner
    socket.on('change-request-rejected', (data) => {
      if (data && onChangeRequestRejectedRef.current) {
        onChangeRequestRejectedRef.current(data);
      }
    });

    // Direct edit/file operation requires approval
    socket.on('approval-required', (data) => {
      if (data && onApprovalRequiredRef.current) {
        onApprovalRequiredRef.current(data);
      }
    });

    // Clean up on room change or unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('reconnect_attempt');
      socket.off('user-role');
      socket.off('permission-error');
      socket.off('file-error');
      socket.off('room-users');
      socket.off('room-participants');
      socket.off('code-change');
      socket.off('room-sync');
      socket.off('save-status');
      socket.off('file-created');
      socket.off('file-renamed');
      socket.off('file-deleted');
      socket.off('folder-created');
      socket.off('folder-renamed');
      socket.off('folder-deleted');
      socket.off('cursor-change');
      socket.off('cursor-clear');
      socket.off('activity-log-entry');
      socket.off('approval-mode-updated');
      socket.off('change-request-created');
      socket.off('change-request-approved');
      socket.off('change-request-rejected');
      socket.off('approval-required');
      socket.disconnect();
      socketRef.current = null;
      setRemoteCursors({});
    };
  }, [roomId, user?.id]);

  // Method to emit local code changes safely
  const emitCodeChange = useCallback((fileName, content) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('code-change', {
        roomId,
        fileName,
        content
      });
    }
  }, [roomId]);

  // Method to emit local cursor position and selection
  const emitCursorChange = useCallback((fileName, cursor, selection = null) => {
    if (socketRef.current && socketRef.current.connected && fileName && cursor) {
      socketRef.current.emit('cursor-change', {
        roomId,
        fileName,
        cursor,
        selection
      });
    }
  }, [roomId]);

  // Method to clear local cursor for other users (e.g. when leaving a file)
  const emitCursorClear = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('cursor-clear', {
        roomId
      });
    }
  }, [roomId]);

  // Virtual file & folder emitter actions
  const emitCreateFile = useCallback((filePath, content = '') => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('create-file', {
        roomId,
        filePath,
        content
      });
    }
  }, [roomId]);

  const emitCreateFolder = useCallback((folderPath) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('create-folder', {
        roomId,
        folderPath
      });
    }
  }, [roomId]);

  const emitRenameFile = useCallback((oldPath, newPath) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('rename-file', {
        roomId,
        oldPath,
        newPath
      });
    }
  }, [roomId]);

  const emitRenameFolder = useCallback((oldFolder, newFolder) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('rename-folder', {
        roomId,
        oldFolder,
        newFolder
      });
    }
  }, [roomId]);

  const emitDeleteFile = useCallback((filePath) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('delete-file', {
        roomId,
        filePath
      });
    }
  }, [roomId]);

  const emitDeleteFolder = useCallback((folderPath) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('delete-folder', {
        roomId,
        folderPath
      });
    }
  }, [roomId]);

  const emitMoveItem = useCallback((itemType, oldPath, targetParentFolder) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('move-item', {
        roomId,
        itemType,
        oldPath,
        targetParentFolder
      });
    }
  }, [roomId]);

  return {
    connectionStatus,
    participantCount,
    activeUsers,
    role,
    remoteCursors,
    emitCodeChange,
    emitCursorChange,
    emitCursorClear,
    emitCreateFile,
    emitCreateFolder,
    emitRenameFile,
    emitRenameFolder,
    emitDeleteFile,
    emitDeleteFolder,
    emitMoveItem
  };
}
