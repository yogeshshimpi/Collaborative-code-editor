import { pool, isDbConnected, STARTER_FILES } from './index.js';
import { normalizePath, isValidFilePath, isValidFolderPath, getParentFolderPaths } from '../utils/filePath.js';
import { createFileVersion } from './versions.js';
import { logger } from '../utils/logger.js';

export const inMemoryStore = new Map();
export const inMemoryFolders = new Map(); // roomId -> Set<folderPath>
const pendingSaves = new Map();

/**
 * Retrieve entire workspace (files map and folders list) for a given room.
 * Seeds default starter files if the room is completely new.
 */
export async function getRoomWorkspace(roomId) {
  if (!roomId || typeof roomId !== 'string') {
    return { files: { ...STARTER_FILES }, folders: [] };
  }
  const cleanRoomId = roomId.trim();

  if (isDbConnected() && pool) {
    try {
      const filesRes = await pool.query(
        'SELECT file_name, content FROM room_files WHERE room_id = $1 ORDER BY file_name ASC;',
        [cleanRoomId]
      );
      const foldersRes = await pool.query(
        'SELECT folder_path FROM room_folders WHERE room_id = $1 ORDER BY folder_path ASC;',
        [cleanRoomId]
      );

      const hasFiles = filesRes.rows.length > 0;
      const hasFolders = foldersRes.rows.length > 0;

      // If workspace is completely empty (brand new room), seed starter files
      if (!hasFiles && !hasFolders) {
        for (const [name, content] of Object.entries(STARTER_FILES)) {
          await pool.query(
            `INSERT INTO room_files (room_id, file_name, content, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (room_id, file_name) DO NOTHING;`,
            [cleanRoomId, name, content]
          );
        }

        const seededFiles = { ...STARTER_FILES };
        inMemoryStore.set(cleanRoomId, { ...seededFiles });
        return { files: seededFiles, folders: [] };
      }

      const files = {};
      for (const row of filesRes.rows) {
        files[row.file_name] = row.content;
      }
      const folders = foldersRes.rows.map((r) => r.folder_path);

      // Cache in memory for quick fallback access
      inMemoryStore.set(cleanRoomId, { ...files });
      if (!inMemoryFolders.has(cleanRoomId)) {
        inMemoryFolders.set(cleanRoomId, new Set(folders));
      } else {
        const folderSet = inMemoryFolders.get(cleanRoomId);
        folders.forEach((f) => folderSet.add(f));
      }

      return { files, folders };
    } catch (err) {
      logger.error(`Error loading workspace for room "${cleanRoomId}":`, err.message);
    }
  }

  // Fallback in-memory store
  if (!inMemoryStore.has(cleanRoomId) && !inMemoryFolders.has(cleanRoomId)) {
    inMemoryStore.set(cleanRoomId, { ...STARTER_FILES });
    inMemoryFolders.set(cleanRoomId, new Set());
  }

  const memFiles = inMemoryStore.get(cleanRoomId) || {};
  const memFolders = Array.from(inMemoryFolders.get(cleanRoomId) || []);
  return { files: { ...memFiles }, folders: memFolders };
}

/**
 * Retrieve all files for a given room (backward compatibility).
 */
export async function getRoomFiles(roomId) {
  const workspace = await getRoomWorkspace(roomId);
  return workspace.files;
}

/**
 * Create a new virtual file in the room.
 */
export async function createFileInRoom({ roomId, filePath, content = '', authorId = null }) {
  const cleanPath = normalizePath(filePath);
  if (!isValidFilePath(cleanPath)) {
    throw new Error('Invalid file path. Path must not contain illegal characters or directory traversal.');
  }

  const cleanContent = typeof content === 'string' ? content : '';

  if (isDbConnected() && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if file already exists
      const checkRes = await client.query(
        'SELECT file_name FROM room_files WHERE room_id = $1 AND file_name = $2;',
        [roomId, cleanPath]
      );
      if (checkRes.rows.length > 0) {
        throw new Error(`A file named "${cleanPath}" already exists.`);
      }

      // Automatically register parent folders if path is nested
      const parentFolders = getParentFolderPaths(cleanPath);
      for (const folder of parentFolders) {
        await client.query(
          `INSERT INTO room_folders (room_id, folder_path)
           VALUES ($1, $2)
           ON CONFLICT (room_id, folder_path) DO NOTHING;`,
          [roomId, folder]
        );
      }

      // Insert file
      await client.query(
        `INSERT INTO room_files (room_id, file_name, content, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP);`,
        [roomId, cleanPath, cleanContent]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Auto version history checkpoint
    createFileVersion({
      roomId,
      fileName: cleanPath,
      content: cleanContent,
      authorId,
      versionType: 'auto',
      label: 'Initial file creation'
    }).catch(() => {});
  }

  // Update in-memory fallback
  if (!inMemoryStore.has(roomId)) {
    inMemoryStore.set(roomId, {});
  }
  inMemoryStore.get(roomId)[cleanPath] = cleanContent;

  const parentFolders = getParentFolderPaths(cleanPath);
  if (!inMemoryFolders.has(roomId)) {
    inMemoryFolders.set(roomId, new Set());
  }
  const folderSet = inMemoryFolders.get(roomId);
  parentFolders.forEach((f) => folderSet.add(f));

  return { fileName: cleanPath, content: cleanContent };
}

/**
 * Create a new virtual folder in the room.
 */
export async function createFolderInRoom({ roomId, folderPath }) {
  const cleanFolder = normalizePath(folderPath);
  if (!isValidFolderPath(cleanFolder)) {
    throw new Error('Invalid folder path. Folder path must not contain illegal characters or directory traversal.');
  }

  if (isDbConnected() && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if folder already exists
      const checkRes = await client.query(
        'SELECT folder_path FROM room_folders WHERE room_id = $1 AND folder_path = $2;',
        [roomId, cleanFolder]
      );
      if (checkRes.rows.length > 0) {
        throw new Error(`A folder named "${cleanFolder}" already exists.`);
      }

      // Ensure parent folders are also registered
      const parentFolders = getParentFolderPaths(cleanFolder);
      for (const parent of parentFolders) {
        await client.query(
          `INSERT INTO room_folders (room_id, folder_path)
           VALUES ($1, $2)
           ON CONFLICT (room_id, folder_path) DO NOTHING;`,
          [roomId, parent]
        );
      }

      await client.query(
        `INSERT INTO room_folders (room_id, folder_path)
         VALUES ($1, $2)
         ON CONFLICT (room_id, folder_path) DO NOTHING;`,
        [roomId, cleanFolder]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Update in-memory fallback
  if (!inMemoryFolders.has(roomId)) {
    inMemoryFolders.set(roomId, new Set());
  }
  const folderSet = inMemoryFolders.get(roomId);
  const parentFolders = getParentFolderPaths(cleanFolder);
  parentFolders.forEach((p) => folderSet.add(p));
  folderSet.add(cleanFolder);

  return { folderPath: cleanFolder };
}

/**
 * Rename a virtual file in the room.
 */
export async function renameFileInRoom({ roomId, oldPath, newPath }) {
  const cleanOld = normalizePath(oldPath);
  const cleanNew = normalizePath(newPath);

  if (!isValidFilePath(cleanOld) || !isValidFilePath(cleanNew)) {
    throw new Error('Invalid file path.');
  }
  if (cleanOld === cleanNew) {
    return { oldPath: cleanOld, newPath: cleanNew };
  }

  if (isDbConnected() && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify old file exists
      const oldCheck = await client.query(
        'SELECT content FROM room_files WHERE room_id = $1 AND file_name = $2;',
        [roomId, cleanOld]
      );
      if (oldCheck.rows.length === 0) {
        throw new Error(`File "${cleanOld}" not found.`);
      }

      // Verify new file does not exist
      const newCheck = await client.query(
        'SELECT file_name FROM room_files WHERE room_id = $1 AND file_name = $2;',
        [roomId, cleanNew]
      );
      if (newCheck.rows.length > 0) {
        throw new Error(`A file named "${cleanNew}" already exists.`);
      }

      // Ensure new parent folders are registered
      const newParents = getParentFolderPaths(cleanNew);
      for (const parent of newParents) {
        await client.query(
          `INSERT INTO room_folders (room_id, folder_path)
           VALUES ($1, $2)
           ON CONFLICT (room_id, folder_path) DO NOTHING;`,
          [roomId, parent]
        );
      }

      // Update room_files
      await client.query(
        `UPDATE room_files
         SET file_name = $1, updated_at = CURRENT_TIMESTAMP
         WHERE room_id = $2 AND file_name = $3;`,
        [cleanNew, roomId, cleanOld]
      );

      // Preserve version history by updating file_versions
      await client.query(
        `UPDATE file_versions
         SET file_name = $1
         WHERE room_id = $2 AND file_name = $3;`,
        [cleanNew, roomId, cleanOld]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // In-memory fallback
  if (inMemoryStore.has(roomId)) {
    const store = inMemoryStore.get(roomId);
    if (store[cleanOld] !== undefined) {
      store[cleanNew] = store[cleanOld];
      delete store[cleanOld];
    }
  }
  return { oldPath: cleanOld, newPath: cleanNew };
}

/**
 * Rename a virtual folder and all its contents in the room.
 */
export async function renameFolderInRoom({ roomId, oldFolder, newFolder }) {
  const cleanOld = normalizePath(oldFolder);
  const cleanNew = normalizePath(newFolder);

  if (!isValidFolderPath(cleanOld) || !isValidFolderPath(cleanNew)) {
    throw new Error('Invalid folder path.');
  }
  if (cleanOld === cleanNew) {
    return { oldFolder: cleanOld, newFolder: cleanNew, affectedFiles: [] };
  }
  if (cleanNew.startsWith(`${cleanOld}/`)) {
    throw new Error('Cannot move or rename a folder into its own subfolder.');
  }

  const affectedFiles = [];

  if (isDbConnected() && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Find all affected files in room_files
      const filesRes = await client.query(
        `SELECT file_name FROM room_files
         WHERE room_id = $1 AND (file_name = $2 OR file_name LIKE $2 || '/%');`,
        [roomId, cleanOld]
      );

      for (const row of filesRes.rows) {
        const oldFile = row.file_name;
        const newFile = oldFile === cleanOld
          ? cleanNew
          : `${cleanNew}/${oldFile.slice(cleanOld.length + 1)}`;

        // Verify target file doesn't already exist
        const targetCheck = await client.query(
          'SELECT file_name FROM room_files WHERE room_id = $1 AND file_name = $2;',
          [roomId, newFile]
        );
        if (targetCheck.rows.length > 0) {
          throw new Error(`Cannot rename folder: "${newFile}" already exists.`);
        }

        // Update file
        await client.query(
          `UPDATE room_files
           SET file_name = $1, updated_at = CURRENT_TIMESTAMP
           WHERE room_id = $2 AND file_name = $3;`,
          [newFile, roomId, oldFile]
        );

        // Update file_versions
        await client.query(
          `UPDATE file_versions
           SET file_name = $1
           WHERE room_id = $2 AND file_name = $3;`,
          [newFile, roomId, oldFile]
        );

        affectedFiles.push({ oldPath: oldFile, newPath: newFile });
      }

      // 2. Find and update affected folders in room_folders
      const foldersRes = await client.query(
        `SELECT folder_path FROM room_folders
         WHERE room_id = $1 AND (folder_path = $2 OR folder_path LIKE $2 || '/%');`,
        [roomId, cleanOld]
      );

      for (const row of foldersRes.rows) {
        const oldF = row.folder_path;
        const newF = oldF === cleanOld
          ? cleanNew
          : `${cleanNew}/${oldF.slice(cleanOld.length + 1)}`;

        await client.query(
          `UPDATE room_folders
           SET folder_path = $1
           WHERE room_id = $2 AND folder_path = $3;`,
          [newF, roomId, oldF]
        );
      }

      // Ensure parents of newFolder are registered
      const newParents = getParentFolderPaths(cleanNew);
      for (const parent of newParents) {
        await client.query(
          `INSERT INTO room_folders (room_id, folder_path)
           VALUES ($1, $2)
           ON CONFLICT (room_id, folder_path) DO NOTHING;`,
          [roomId, parent]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // In-memory fallback
  if (inMemoryStore.has(roomId)) {
    const store = inMemoryStore.get(roomId);
    for (const [key, content] of Object.entries(store)) {
      if (key === cleanOld || key.startsWith(`${cleanOld}/`)) {
        const newFile = key === cleanOld
          ? cleanNew
          : `${cleanNew}/${key.slice(cleanOld.length + 1)}`;
        store[newFile] = content;
        delete store[key];
        if (!affectedFiles.some((a) => a.oldPath === key)) {
          affectedFiles.push({ oldPath: key, newPath: newFile });
        }
      }
    }
  }
  if (inMemoryFolders.has(roomId)) {
    const set = inMemoryFolders.get(roomId);
    const updatedFolders = [];
    for (const f of Array.from(set)) {
      if (f === cleanOld || f.startsWith(`${cleanOld}/`)) {
        set.delete(f);
        const newF = f === cleanOld ? cleanNew : `${cleanNew}/${f.slice(cleanOld.length + 1)}`;
        updatedFolders.push(newF);
      }
    }
    updatedFolders.forEach((f) => set.add(f));
    getParentFolderPaths(cleanNew).forEach((p) => set.add(p));
    set.add(cleanNew);
  }

  return { oldFolder: cleanOld, newFolder: cleanNew, affectedFiles };
}

/**
 * Delete a virtual file from the room.
 */
export async function deleteFileInRoom({ roomId, filePath }) {
  const cleanPath = normalizePath(filePath);
  if (!isValidFilePath(cleanPath)) {
    throw new Error('Invalid file path.');
  }

  if (isDbConnected() && pool) {
    await pool.query(
      'DELETE FROM room_files WHERE room_id = $1 AND file_name = $2;',
      [roomId, cleanPath]
    );
  }

  if (inMemoryStore.has(roomId)) {
    delete inMemoryStore.get(roomId)[cleanPath];
  }

  return { filePath: cleanPath };
}

/**
 * Delete a virtual folder and all its contents from the room.
 */
export async function deleteFolderInRoom({ roomId, folderPath }) {
  const cleanFolder = normalizePath(folderPath);
  if (!isValidFolderPath(cleanFolder)) {
    throw new Error('Invalid folder path.');
  }

  const deletedFiles = [];

  if (isDbConnected() && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const filesRes = await client.query(
        `SELECT file_name FROM room_files
         WHERE room_id = $1 AND (file_name = $2 OR file_name LIKE $2 || '/%');`,
        [roomId, cleanFolder]
      );
      for (const row of filesRes.rows) {
        deletedFiles.push(row.file_name);
      }

      await client.query(
        `DELETE FROM room_files
         WHERE room_id = $1 AND (file_name = $2 OR file_name LIKE $2 || '/%');`,
        [roomId, cleanFolder]
      );

      await client.query(
        `DELETE FROM room_folders
         WHERE room_id = $1 AND (folder_path = $2 OR folder_path LIKE $2 || '/%');`,
        [roomId, cleanFolder]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // In-memory fallback
  if (inMemoryStore.has(roomId)) {
    const store = inMemoryStore.get(roomId);
    for (const key of Object.keys(store)) {
      if (key === cleanFolder || key.startsWith(`${cleanFolder}/`)) {
        delete store[key];
        if (!deletedFiles.includes(key)) {
          deletedFiles.push(key);
        }
      }
    }
  }
  if (inMemoryFolders.has(roomId)) {
    const set = inMemoryFolders.get(roomId);
    for (const f of Array.from(set)) {
      if (f === cleanFolder || f.startsWith(`${cleanFolder}/`)) {
        set.delete(f);
      }
    }
  }

  return { folderPath: cleanFolder, deletedFiles };
}

/**
 * Move a file or folder into a target folder or workspace root.
 */
export async function moveItemInRoom({ roomId, itemType, oldPath, targetParentFolder }) {
  const cleanOld = normalizePath(oldPath);
  const cleanTarget = targetParentFolder ? normalizePath(targetParentFolder) : '';

  if (!cleanOld) {
    throw new Error('Source path is required.');
  }

  const baseName = cleanOld.split('/').pop();
  const cleanNew = cleanTarget ? `${cleanTarget}/${baseName}` : baseName;

  if (cleanOld === cleanNew) {
    return { itemType, oldPath: cleanOld, newPath: cleanNew };
  }

  if (itemType === 'folder') {
    return renameFolderInRoom({ roomId, oldFolder: cleanOld, newFolder: cleanNew });
  } else {
    return renameFileInRoom({ roomId, oldPath: cleanOld, newPath: cleanNew });
  }
}

/**
 * Persist file content to PostgreSQL with debounced writes to optimize performance.
 * Also records debounced version history checkpoints without storing every keypress.
 */
export function saveFileContent(roomId, fileName, content, authorId = null) {
  // Always update in-memory cache immediately
  if (!inMemoryStore.has(roomId)) {
    inMemoryStore.set(roomId, {});
  }
  inMemoryStore.get(roomId)[fileName] = content;

  if (!isDbConnected() || !pool) {
    createFileVersion({
      roomId,
      fileName,
      content,
      authorId,
      versionType: 'auto'
    }).catch(() => {});
    return Promise.reject(new Error('Database is not connected'));
  }

  // Debounce writes so rapid keystrokes do not flood PostgreSQL.
  const timerKey = `${roomId}:${fileName}`;
  return new Promise((resolve, reject) => {
    let pending = pendingSaves.get(timerKey);

    if (!pending) {
      pending = { roomId, fileName, content, authorId, timer: null, waiters: [] };
      pendingSaves.set(timerKey, pending);
    } else {
      clearTimeout(pending.timer);
      pending.content = content;
      if (authorId) pending.authorId = authorId;
    }

    pending.waiters.push({ resolve, reject });
    pending.timer = setTimeout(async () => {
      pendingSaves.delete(timerKey);
      try {
        const upsertQuery = `
          INSERT INTO room_files (room_id, file_name, content, updated_at)
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
          ON CONFLICT (room_id, file_name)
          DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP;
        `;
        await pool.query(upsertQuery, [pending.roomId, pending.fileName, pending.content]);
        pending.waiters.forEach(({ resolve: res }) => res());

        // Automatically record debounced version checkpoint (collapses within 2 minutes)
        createFileVersion({
          roomId: pending.roomId,
          fileName: pending.fileName,
          content: pending.content,
          authorId: pending.authorId || null,
          versionType: 'auto'
        }).catch((err) => {
          logger.warn(`[Version History] Auto version creation skipped: ${err.message}`);
        });
      } catch (err) {
        logger.error(`Failed to save file "${fileName}" in room "${roomId}":`, err.message);
        pending.waiters.forEach(({ reject: rej }) => rej(err));
      }
    }, 800);
  });
}

export default {
  getRoomWorkspace,
  getRoomFiles,
  createFileInRoom,
  createFolderInRoom,
  renameFileInRoom,
  renameFolderInRoom,
  deleteFileInRoom,
  deleteFolderInRoom,
  moveItemInRoom,
  saveFileContent
};
