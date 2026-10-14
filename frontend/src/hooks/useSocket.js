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
  onActivityNotification,
  // Collaboration Chat, Comments, and Notifications callbacks
  onNewChatMessage,
  onChatMessageEdited,
  onChatMessageDeleted,
  onNewComment,
  onCommentReply,
  onCommentResolved,
  onCommentDeleted,
  onNotification
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

  const onNewChatMessageRef = useRef(onNewChatMessage);
  const onChatMessageEditedRef = useRef(onChatMessageEdited);
  const onChatMessageDeletedRef = useRef(onChatMessageDeleted);
  const onNewCommentRef = useRef(onNewComment);
  const onCommentReplyRef = useRef(onCommentReply);
  const onCommentResolvedRef = useRef(onCommentResolved);
  const onCommentDeletedRef = useRef(onCommentDeleted);
  const onNotificationRef = useRef(onNotification);

  const userRef = useRef(user);

  useEffect(() => {
    onNewChatMessageRef.current = onNewChatMessage;
  }, [onNewChatMessage]);

  useEffect(() => {
    onChatMessageEditedRef.current = onChatMessageEdited;
  }, [onChatMessageEdited]);

  useEffect(() => {
    onChatMessageDeletedRef.current = onChatMessageDeleted;
  }, [onChatMessageDeleted]);

  useEffect(() => {
    onNewCommentRef.current = onNewComment;
  }, [onNewComment]);

  useEffect(() => {
    onCommentReplyRef.current = onCommentReply;
  }, [onCommentReply]);

  useEffect(() => {
    onCommentResolvedRef.current = onCommentResolved;
  }, [onCommentResolved]);

  useEffect(() => {
    onCommentDeletedRef.current = onCommentDeleted;
  }, [onCommentDeleted]);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

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

    // Real-time Collaboration Chat Events
    socket.on('chat:new-message', (data) => {
      if (data && onNewChatMessageRef.current) {
        onNewChatMessageRef.current(data);
      }
    });

    socket.on('chat:message-edited', (data) => {
      if (data && onChatMessageEditedRef.current) {
        onChatMessageEditedRef.current(data);
      }
    });

    socket.on('chat:message-deleted', (data) => {
      if (data && onChatMessageDeletedRef.current) {
        onChatMessageDeletedRef.current(data);
      }
    });

    // Real-time Code Comments Events
    socket.on('comment:new', (data) => {
      if (data && onNewCommentRef.current) {
        onNewCommentRef.current(data);
      }
    });

    socket.on('comment:reply-added', (data) => {
      if (data && onCommentReplyRef.current) {
        onCommentReplyRef.current(data);
      }
    });

    socket.on('comment:status-changed', (data) => {
      if (data && onCommentResolvedRef.current) {
        onCommentResolvedRef.current(data);
      }
    });

    socket.on('comment:deleted', (data) => {
      if (data && onCommentDeletedRef.current) {
        onCommentDeletedRef.current(data);
      }
    });

    // Direct In-App Notifications (mentions, comments, reviews)
    socket.on('notification:new', (data) => {
      if (data && onNotificationRef.current) {
        onNotificationRef.current(data.notification || data);
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
      socket.off('chat:new-message');
      socket.off('chat:message-edited');
      socket.off('chat:message-deleted');
      socket.off('comment:new');
      socket.off('comment:reply-added');
      socket.off('comment:status-changed');
      socket.off('comment:deleted');
      socket.off('notification:new');
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

  // Real-time Chat Emit Helpers
  const emitSendChatMessage = useCallback((message) => {
    if (socketRef.current && socketRef.current.connected && message) {
      socketRef.current.emit('chat:send-message', { roomId, message });
    }
  }, [roomId]);

  const emitEditChatMessage = useCallback((messageId, message) => {
    if (socketRef.current && socketRef.current.connected && messageId && message) {
      socketRef.current.emit('chat:edit-message', { roomId, messageId, message });
    }
  }, [roomId]);

  const emitDeleteChatMessage = useCallback((messageId) => {
    if (socketRef.current && socketRef.current.connected && messageId) {
      socketRef.current.emit('chat:delete-message', { roomId, messageId });
    }
  }, [roomId]);

  const emitChatTyping = useCallback((isTyping) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('chat:typing', { roomId, isTyping });
    }
  }, [roomId]);

  // Real-time Code Comments Emit Helpers
  const emitCreateComment = useCallback((payload) => {
    if (socketRef.current && socketRef.current.connected && payload) {
      socketRef.current.emit('comment:create', { roomId, ...payload });
    }
  }, [roomId]);

  const emitReplyComment = useCallback((commentId, content) => {
    if (socketRef.current && socketRef.current.connected && commentId && content) {
      socketRef.current.emit('comment:reply', { roomId, commentId, content });
    }
  }, [roomId]);

  const emitResolveComment = useCallback((commentId, isResolved) => {
    if (socketRef.current && socketRef.current.connected && commentId) {
      socketRef.current.emit('comment:resolve', { roomId, commentId, isResolved });
    }
  }, [roomId]);

  const emitDeleteComment = useCallback((commentId) => {
    if (socketRef.current && socketRef.current.connected && commentId) {
      socketRef.current.emit('comment:delete', { roomId, commentId });
    }
  }, [roomId]);

  return {
    connectionStatus,
    participantCount,
    activeUsers,
    role,
    remoteCursors,
    socket: socketRef.current,
    emitCodeChange,
    emitCursorChange,
    emitCursorClear,
    emitCreateFile,
    emitCreateFolder,
    emitRenameFile,
    emitRenameFolder,
    emitDeleteFile,
    emitDeleteFolder,
    emitMoveItem,
    emitSendChatMessage,
    emitEditChatMessage,
    emitDeleteChatMessage,
    emitChatTyping,
    emitCreateComment,
    emitReplyComment,
    emitResolveComment,
    emitDeleteComment
  };
}
