/**
 * Local Draft Storage Utility
 * Safely persists unsaved file edits into browser localStorage.
 * Key format: codecollab_draft_${userId || 'guest'}_${roomId}_${encodeURIComponent(fileName)}
 * Prevents collisions between different users, projects/rooms, and files.
 */

const DRAFT_PREFIX = 'codecollab_draft_';

export function getDraftKey(userId, roomId, fileName) {
  const safeUser = userId ? String(userId).trim() : 'guest';
  const safeRoom = roomId ? String(roomId).trim() : 'default';
  const safeFile = encodeURIComponent(fileName || '');
  return `${DRAFT_PREFIX}${safeUser}_${safeRoom}_${safeFile}`;
}

export function saveLocalDraft(userId, roomId, fileName, { content, baseVersion = 1, timestamp = Date.now(), synced = false }) {
  if (typeof window === 'undefined' || !fileName) return null;
  const key = getDraftKey(userId, roomId, fileName);
  const payload = {
    userId: userId || 'guest',
    roomId: roomId || 'default',
    fileName,
    content: typeof content === 'string' ? content : '',
    baseVersion: typeof baseVersion === 'number' ? baseVersion : 1,
    timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
    synced: Boolean(synced)
  };

  try {
    localStorage.setItem(key, JSON.stringify(payload));
    return payload;
  } catch (err) {
    console.warn('[LocalDraftStorage] Failed to save draft:', err.message);
    return null;
  }
}

export function getLocalDraft(userId, roomId, fileName) {
  if (typeof window === 'undefined' || !fileName) return null;
  const key = getDraftKey(userId, roomId, fileName);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[LocalDraftStorage] Failed to parse draft:', err.message);
    return null;
  }
}

export function removeLocalDraft(userId, roomId, fileName) {
  if (typeof window === 'undefined' || !fileName) return;
  const key = getDraftKey(userId, roomId, fileName);
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('[LocalDraftStorage] Failed to remove draft:', err.message);
  }
}

export function getAllPendingDrafts(userId, roomId) {
  if (typeof window === 'undefined') return [];
  const safeUser = userId ? String(userId).trim() : 'guest';
  const safeRoom = roomId ? String(roomId).trim() : 'default';
  const prefix = `${DRAFT_PREFIX}${safeUser}_${safeRoom}_`;
  const pending = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item && !item.synced) {
            pending.push(item);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[LocalDraftStorage] Error listing pending drafts:', err.message);
  }

  return pending;
}

export function getAllDraftsForRoom(userId, roomId) {
  if (typeof window === 'undefined') return [];
  const safeUser = userId ? String(userId).trim() : 'guest';
  const safeRoom = roomId ? String(roomId).trim() : 'default';
  const prefix = `${DRAFT_PREFIX}${safeUser}_${safeRoom}_`;
  const drafts = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key));
          if (item && item.fileName) {
            drafts.push(item);
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[LocalDraftStorage] Error listing room drafts:', err.message);
  }

  return drafts;
}

export function clearAllDraftsForRoom(userId, roomId) {
  if (typeof window === 'undefined') return;
  const safeUser = userId ? String(userId).trim() : 'guest';
  const safeRoom = roomId ? String(roomId).trim() : 'default';
  const prefix = `${DRAFT_PREFIX}${safeUser}_${safeRoom}_`;

  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('[LocalDraftStorage] Error clearing room drafts:', err.message);
  }
}

export default {
  getDraftKey,
  saveLocalDraft,
  getLocalDraft,
  removeLocalDraft,
  getAllPendingDrafts,
  getAllDraftsForRoom,
  clearAllDraftsForRoom
};
