import { useEffect, useRef, useState, useCallback } from 'react';
import { initSocket } from '../socket';

export function useSocket({ roomId, user, onRemoteCodeChange, onRoomSync, onSaveStatus, onPermissionError }) {
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [participantCount, setParticipantCount] = useState(1);
  const [activeUsers, setActiveUsers] = useState([]);
  const [role, setRole] = useState('editor');
  const socketRef = useRef(null);

  // Store callbacks and user in refs to keep listener references stable
  const onRemoteCodeChangeRef = useRef(onRemoteCodeChange);
  const onRoomSyncRef = useRef(onRoomSync);
  const onSaveStatusRef = useRef(onSaveStatus);
  const onPermissionErrorRef = useRef(onPermissionError);
  const userRef = useRef(user);

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

    // Permission error handler
    socket.on('permission-error', (data) => {
      if (data && onPermissionErrorRef.current) {
        onPermissionErrorRef.current(data);
      }
    });

    // Update active collaborator presence list
    socket.on('room-users', ({ users }) => {
      if (Array.isArray(users)) {
        setActiveUsers(users);
        setParticipantCount(users.length);
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

    // Clean up on room change or unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('reconnect_attempt');
      socket.off('user-role');
      socket.off('permission-error');
      socket.off('room-users');
      socket.off('room-participants');
      socket.off('code-change');
      socket.off('room-sync');
      socket.off('save-status');
      socket.disconnect();
      socketRef.current = null;
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

  return {
    connectionStatus,
    participantCount,
    activeUsers,
    role,
    emitCodeChange
  };
}
