import { pool, isDbConnected } from './index.js';
import { computeContentHash } from '../utils/filePath.js';
import { inMemoryUsers } from './users.js';

export const inMemoryVersions = new Map(); // key: `${roomId}:${fileName}` -> Array<version>

/**
 * Create or collapse an auto, manual, or restore file version.
 * - Does not create duplicate snapshots for identical content.
 * - Automatically collapses rapid auto-saves within a 2-minute window.
 */
export async function createFileVersion({
  roomId,
  fileName,
  content,
  authorId = null,
  versionType = 'auto',
  label = null
}) {
  const cleanContent = typeof content === 'string' ? content : '';
  const contentHash = computeContentHash(cleanContent);
  const cleanLabel = typeof label === 'string' && label.trim() ? label.trim().slice(0, 100) : null;

  if (isDbConnected() && pool) {
    // Check latest version for this room and file
    const latestQuery = `
      SELECT id, content_hash, version_type, created_at
      FROM file_versions
      WHERE room_id = $1 AND file_name = $2
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const latestRes = await pool.query(latestQuery, [roomId, fileName]);
    const latest = latestRes.rows[0];

    // Skip if content has not changed from the latest version
    if (latest && latest.content_hash === contentHash) {
      return latest;
    }

    // Collapse rapid auto-saves within a 2-minute window (120,000ms)
    if (versionType === 'auto' && latest && latest.version_type === 'auto') {
      const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
      if (elapsedMs < 120000) {
        const updateQuery = `
          UPDATE file_versions
          SET content = $1, content_hash = $2, author_id = $3, created_at = NOW()
          WHERE id = $4
          RETURNING id, room_id, file_name, content_hash, author_id, version_type, label, created_at;
        `;
        const updateRes = await pool.query(updateQuery, [cleanContent, contentHash, authorId, latest.id]);
        return updateRes.rows[0];
      }
    }

    // Insert new version row
    const insertQuery = `
      INSERT INTO file_versions (room_id, file_name, content, content_hash, author_id, version_type, label, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, room_id, file_name, content_hash, author_id, version_type, label, created_at;
    `;
    const insertRes = await pool.query(insertQuery, [
      roomId,
      fileName,
      cleanContent,
      contentHash,
      authorId,
      versionType,
      cleanLabel
    ]);
    return insertRes.rows[0];
  }

  // Fallback in-memory version tracking
  const key = `${roomId}:${fileName}`;
  if (!inMemoryVersions.has(key)) {
    inMemoryVersions.set(key, []);
  }
  const list = inMemoryVersions.get(key);
  const latest = list[0];

  if (latest && latest.content_hash === contentHash) {
    return latest;
  }

  if (versionType === 'auto' && latest && latest.version_type === 'auto') {
    const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
    if (elapsedMs < 120000) {
      latest.content = cleanContent;
      latest.content_hash = contentHash;
      latest.author_id = authorId;
      latest.created_at = new Date();
      return latest;
    }
  }

  // Lookup author details if present
  let authorName = 'System';
  let authorEmail = '';
  if (authorId) {
    const authorUser = Array.from(inMemoryUsers.values()).find((u) => u.id === authorId);
    if (authorUser) {
      authorName = authorUser.name;
      authorEmail = authorUser.email;
    }
  }

  const newVer = {
    id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    room_id: roomId,
    file_name: fileName,
    content: cleanContent,
    content_hash: contentHash,
    author_id: authorId,
    author_name: authorName,
    author_email: authorEmail,
    version_type: versionType,
    label: cleanLabel,
    created_at: new Date()
  };
  list.unshift(newVer);
  return newVer;
}

/**
 * Retrieve metadata list of previous versions for a file.
 */
export async function getFileVersions(roomId, fileName, limit = 50) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));

  if (isDbConnected() && pool) {
    const query = `
      SELECT 
        fv.id,
        fv.room_id,
        fv.file_name,
        fv.content_hash,
        fv.author_id,
        fv.version_type,
        fv.label,
        fv.created_at,
        LENGTH(fv.content) AS size_bytes,
        u.name AS author_name,
        u.email AS author_email
      FROM file_versions fv
      LEFT JOIN users u ON fv.author_id = u.id
      WHERE fv.room_id = $1 AND fv.file_name = $2
      ORDER BY fv.created_at DESC
      LIMIT $3;
    `;
    const res = await pool.query(query, [roomId, fileName, safeLimit]);
    return res.rows;
  }

  // Fallback in-memory
  const key = `${roomId}:${fileName}`;
  const list = inMemoryVersions.get(key) || [];
  return list.slice(0, safeLimit).map((v) => ({
    id: v.id,
    room_id: v.room_id,
    file_name: v.file_name,
    content_hash: v.content_hash,
    author_id: v.author_id,
    version_type: v.version_type,
    label: v.label,
    created_at: v.created_at,
    size_bytes: v.content ? v.content.length : 0,
    author_name: v.author_name || 'System',
    author_email: v.author_email || ''
  }));
}

/**
 * Retrieve a single version with full code content for previewing or restoring.
 */
export async function getFileVersionById(versionId, roomId) {
  if (isDbConnected() && pool) {
    const query = `
      SELECT 
        fv.id,
        fv.room_id,
        fv.file_name,
        fv.content,
        fv.content_hash,
        fv.author_id,
        fv.version_type,
        fv.label,
        fv.created_at,
        u.name AS author_name,
        u.email AS author_email
      FROM file_versions fv
      LEFT JOIN users u ON fv.author_id = u.id
      WHERE fv.id::text = $1 AND fv.room_id = $2;
    `;
    const res = await pool.query(query, [versionId, roomId]);
    return res.rows[0] || null;
  }

  // Fallback in-memory
  for (const [, list] of inMemoryVersions.entries()) {
    const found = list.find((v) => v.id === versionId && v.room_id === roomId);
    if (found) return found;
  }
  return null;
}

/**
 * Restore an earlier file version safely.
 * - Replaces current room_files active content with the version content.
 * - Records a new version checkpoint with version_type = 'restore'.
 */
export async function restoreFileVersion({ versionId, roomId, restoredByUserId }) {
  const version = await getFileVersionById(versionId, roomId);
  if (!version) {
    const error = new Error('Version not found for this project.');
    error.status = 404;
    throw error;
  }

  const { file_name: fileName, content } = version;

  // 1. Update room_files in PostgreSQL
  if (isDbConnected() && pool) {
    const upsertQuery = `
      INSERT INTO room_files (room_id, file_name, content, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (room_id, file_name)
      DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP;
    `;
    await pool.query(upsertQuery, [roomId, fileName, content]);
  }

  // 2. Insert new version record indicating restore
  const restoreRecord = await createFileVersion({
    roomId,
    fileName,
    content,
    authorId: restoredByUserId || null,
    versionType: 'restore',
    label: `Restored from version (${new Date(version.created_at).toLocaleTimeString()})`
  });

  return {
    fileName,
    content,
    restoredFromId: versionId,
    newVersionId: restoreRecord.id
  };
}

export default {
  createFileVersion,
  getFileVersions,
  getFileVersionById,
  restoreFileVersion
};
