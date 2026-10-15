import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLocalDraft,
  removeLocalDraft
} from '../utils/localDraftStorage';

/**
 * useOfflineFileRecovery hook
 * 
 * - Monitors window online / offline events and navigator.onLine
 * - Detects if a local draft is newer/different than database content after page load or refresh
 * - Exposes recovery candidate and restore / discard actions
 */
export function useOfflineFileRecovery({
  roomId,
  userId = null,
  activeFile,
  filesState,
  fileMeta = {},
  onDraftRestored = null
}) {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [recoveryCandidate, setRecoveryCandidate] = useState(null);

  const filesStateRef = useRef(filesState);
  filesStateRef.current = filesState;

  const fileMetaRef = useRef(fileMeta);
  fileMetaRef.current = fileMeta;

  // 1. Listen for browser online and offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Check for unsaved local draft whenever activeFile or server files load
  const checkForDraft = useCallback(
    (targetFile) => {
      if (!roomId || !targetFile) {
        setRecoveryCandidate(null);
        return;
      }

      const draft = getLocalDraft(userId, roomId, targetFile);
      if (!draft || draft.synced) {
        setRecoveryCandidate(null);
        return;
      }

      const serverFile = filesStateRef.current[targetFile];
      const serverContent = serverFile?.content ?? '';

      // If local draft differs from server content, offer recovery
      if (draft.content !== serverContent) {
        // Also check if draft is newer than fileMeta updated_at
        const serverUpdatedAt = fileMetaRef.current[targetFile]?.updatedAt;
        const serverTime = serverUpdatedAt ? new Date(serverUpdatedAt).getTime() : 0;
        const draftTime = draft.timestamp || 0;

        // If draft is newer or server time is unknown, prompt restore
        if (draftTime >= serverTime || !serverUpdatedAt) {
          setRecoveryCandidate({
            fileName: targetFile,
            content: draft.content,
            timestamp: draft.timestamp,
            baseVersion: draft.baseVersion
          });
          return;
        }
      }

      setRecoveryCandidate(null);
    },
    [roomId, userId]
  );

  useEffect(() => {
    if (activeFile) {
      checkForDraft(activeFile);
    } else {
      setRecoveryCandidate(null);
    }
  }, [activeFile, checkForDraft]);

  // 3. User chooses to restore local draft
  const restoreDraft = useCallback(
    (fileName) => {
      const target = fileName || recoveryCandidate?.fileName || activeFile;
      if (!target) return null;

      const draft = getLocalDraft(userId, roomId, target);
      if (draft) {
        setRecoveryCandidate(null);
        if (onDraftRestored) {
          onDraftRestored(target, draft.content);
        }
        return draft.content;
      }
      return null;
    },
    [userId, roomId, recoveryCandidate, activeFile, onDraftRestored]
  );

  // 4. User chooses to discard local draft
  const discardDraft = useCallback(
    (fileName) => {
      const target = fileName || recoveryCandidate?.fileName || activeFile;
      if (!target) return;

      removeLocalDraft(userId, roomId, target);
      setRecoveryCandidate(null);
    },
    [userId, roomId, recoveryCandidate, activeFile]
  );

  // 5. User dismisses banner without deleting draft
  const dismissBanner = useCallback(() => {
    setRecoveryCandidate(null);
  }, []);

  return {
    isOnline,
    recoveryCandidate,
    checkForDraft,
    restoreDraft,
    discardDraft,
    dismissBanner
  };
}

export default useOfflineFileRecovery;
