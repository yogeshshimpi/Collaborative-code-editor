import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import {
  saveLocalDraft,
  removeLocalDraft,
  getAllPendingDrafts
} from '../utils/localDraftStorage';

/**
 * useAutoSave hook
 * 
 * - Debounces file saves by 1000ms after user stops typing
 * - Persists immediate local draft into localStorage on every edit
 * - Detects online/offline status and manages state transitions:
 *   'saved' | 'saving' | 'offline' | 'error' | 'connecting'
 * - Auto-uploads pending queued drafts on network / socket reconnection
 * - Protects against tab closing/refreshing with beforeunload warning while dirty
 * - Provides retry functionality on failure
 */
export function useAutoSave({
  roomId,
  userId = null,
  activeFile,
  filesState,
  fileMeta = {},
  setFileMeta = null,
  isOnline = true,
  socketConnected = true,
  socketConnectionStatus = 'connected',
  isViewer = false,
  onSaveSuccess = null,
  onSaveError = null,
  onConflict = null
}) {
  const [saveStatus, setSaveStatus] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [dirtyFiles, setDirtyFiles] = useState(() => new Set());

  const debounceTimerRef = useRef(null);
  const pendingContentRef = useRef({}); // fileName -> content
  const isSavingRef = useRef(false);

  const filesStateRef = useRef(filesState);
  filesStateRef.current = filesState;

  const fileMetaRef = useRef(fileMeta);
  fileMetaRef.current = fileMeta;

  const isViewerRef = useRef(isViewer);
  isViewerRef.current = isViewer;

  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const socketConnectedRef = useRef(socketConnected);
  socketConnectedRef.current = socketConnected;

  const hasUnsavedChanges = Boolean(activeFile && dirtyFiles.has(activeFile));

  // 1. Browser Refresh & Page-Leave Protection
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (dirtyFiles.size > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirtyFiles]);

  // 2. Perform Backend Save
  const performSave = useCallback(
    async (targetFile, contentToSave) => {
      if (!roomId || !targetFile || isViewerRef.current) return;

      // If offline, store locally and set offline state
      if (!isOnlineRef.current) {
        saveLocalDraft(userId, roomId, targetFile, {
          content: contentToSave,
          baseVersion: fileMetaRef.current[targetFile]?.version || 1,
          timestamp: Date.now(),
          synced: false
        });
        setSaveStatus('offline');
        return;
      }

      setSaveStatus('saving');
      isSavingRef.current = true;

      const baseVersion = fileMetaRef.current[targetFile]?.version;

      try {
        const response = await api.saveProjectFileContent(roomId, {
          fileName: targetFile,
          content: contentToSave,
          baseVersion: typeof baseVersion === 'number' ? baseVersion : undefined
        });

        const savedFile = response?.file || response;
        const savedTime = savedFile?.updatedAt || new Date().toISOString();
        const savedVersion = savedFile?.version || 1;

        // Update fileMeta state with new version and timestamp
        if (setFileMeta) {
          setFileMeta((prev) => ({
            ...prev,
            [targetFile]: {
              updatedAt: savedTime,
              version: savedVersion
            }
          }));
        }

        // Clean up local draft since backend save confirmed
        removeLocalDraft(userId, roomId, targetFile);

        // Remove from dirty tracking
        setDirtyFiles((prev) => {
          const next = new Set(prev);
          next.delete(targetFile);
          return next;
        });

        delete pendingContentRef.current[targetFile];

        setLastSavedAt(savedTime);
        setSaveStatus('saved');
        isSavingRef.current = false;

        if (onSaveSuccess) {
          onSaveSuccess({ fileName: targetFile, savedAt: savedTime, version: savedVersion });
        }
      } catch (err) {
        isSavingRef.current = false;
        console.error(`[AutoSave] Save failed for "${targetFile}":`, err.message);

        // Keep local draft safely in storage for offline recovery
        saveLocalDraft(userId, roomId, targetFile, {
          content: contentToSave,
          baseVersion: fileMetaRef.current[targetFile]?.version || 1,
          timestamp: Date.now(),
          synced: false
        });

        if (err.status === 409 || err.statusCode === 409) {
          const details = err.data?.details || err.details || null;
          const serverContent = details?.serverContent;
          const serverVersion = details?.serverVersion;
          const serverUpdatedAt = details?.serverUpdatedAt;

          const normalize = (str) => (typeof str === 'string' ? str.replace(/\r\n/g, '\n') : '');

          // If the server content already matches what we tried to save,
          // it's not a real conflict (was already saved e.g. via socket). Reconcile silently.
          if (typeof serverContent === 'string' && normalize(serverContent) === normalize(contentToSave)) {
            if (setFileMeta && serverVersion) {
              setFileMeta((prev) => ({
                ...prev,
                [targetFile]: {
                  updatedAt: serverUpdatedAt || new Date().toISOString(),
                  version: serverVersion
                }
              }));
            }
            removeLocalDraft(userId, roomId, targetFile);
            setDirtyFiles((prev) => {
              const next = new Set(prev);
              next.delete(targetFile);
              return next;
            });
            delete pendingContentRef.current[targetFile];
            setLastSavedAt(serverUpdatedAt || new Date().toISOString());
            setSaveStatus('saved');
            return;
          }

          // Collaborator Conflict Detected
          if (onConflict) {
            onConflict({
              fileName: targetFile,
              localContent: contentToSave,
              serverDetails: details
            });
          }
          setSaveStatus('error');
        } else if (!isOnlineRef.current) {
          setSaveStatus('offline');
        } else {
          setSaveStatus('error');
        }

        if (onSaveError) {
          onSaveError(err);
        }
      }
    },
    [roomId, userId, setFileMeta, onSaveSuccess, onSaveError, onConflict]
  );

  // 3. Trigger Change (debounced 1000ms after user stops typing)
  const triggerChange = useCallback(
    (fileName, newContent) => {
      if (!fileName || isViewerRef.current) return;

      const cleanContent = newContent ?? '';
      pendingContentRef.current[fileName] = cleanContent;

      // Immediately persist local draft for offline recovery
      saveLocalDraft(userId, roomId, fileName, {
        content: cleanContent,
        baseVersion: fileMetaRef.current[fileName]?.version || 1,
        timestamp: Date.now(),
        synced: false
      });

      // Mark file as having unsaved dirty changes
      setDirtyFiles((prev) => {
        if (prev.has(fileName)) return prev;
        const next = new Set(prev);
        next.add(fileName);
        return next;
      });

      if (!isOnlineRef.current) {
        setSaveStatus('offline');
        return;
      }

      // Reset debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const contentToSave = pendingContentRef.current[fileName];
        performSave(fileName, contentToSave);
      }, 1000);
    },
    [roomId, userId, performSave]
  );

  // 4. Immediate Save (for manual Retry button or immediate flush)
  const saveImmediately = useCallback(
    (fileName) => {
      const targetFile = fileName || activeFile;
      if (!targetFile) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const content =
        pendingContentRef.current[targetFile] ??
        filesStateRef.current[targetFile]?.content ??
        '';

      return performSave(targetFile, content);
    },
    [activeFile, performSave]
  );

  // 5. Auto-upload queued changes when network or socket reconnects
  const flushPendingDrafts = useCallback(async () => {
    if (!roomId || !isOnlineRef.current || isViewerRef.current) return;

    const pending = getAllPendingDrafts(userId, roomId);
    if (pending.length === 0) return;

    setSaveStatus('saving');
    for (const draft of pending) {
      try {
        await performSave(draft.fileName, draft.content);
      } catch (err) {
        console.warn(`[AutoSave] Could not flush queued draft for "${draft.fileName}":`, err.message);
      }
    }
  }, [roomId, userId, performSave]);

  // 6. External Save Notification (e.g. from WebSocket save-status event)
  const markFileSaved = useCallback(
    (fileName, version, savedAt) => {
      if (!fileName) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      delete pendingContentRef.current[fileName];

      const savedTime = savedAt || new Date().toISOString();
      const savedVersion = typeof version === 'number' ? version : 1;

      if (setFileMeta && version) {
        setFileMeta((prev) => ({
          ...prev,
          [fileName]: {
            updatedAt: savedTime,
            version: savedVersion
          }
        }));
      }

      removeLocalDraft(userId, roomId, fileName);

      setDirtyFiles((prev) => {
        if (!prev.has(fileName)) return prev;
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });

      setLastSavedAt(savedTime);
      setSaveStatus('saved');
    },
    [userId, roomId, setFileMeta]
  );

  // 7. Online / Socket Reconnection effect
  useEffect(() => {
    if (!isOnline) {
      setSaveStatus('offline');
    } else if (socketConnectionStatus === 'connecting') {
      // Show connecting while socket connects, unless already saving
      setSaveStatus((prev) => (prev === 'saving' ? 'saving' : 'connecting'));
    } else if (isOnline && socketConnected) {
      if (dirtyFiles.size > 0) {
        flushPendingDrafts();
      } else {
        setSaveStatus('saved');
      }
    }
  }, [isOnline, socketConnected, socketConnectionStatus, dirtyFiles.size, flushPendingDrafts]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    saveStatus,
    setSaveStatus,
    lastSavedAt,
    hasUnsavedChanges,
    dirtyFiles,
    triggerChange,
    saveImmediately,
    flushPendingDrafts,
    markFileSaved,
    isSaving: isSavingRef.current
  };
}

export default useAutoSave;
