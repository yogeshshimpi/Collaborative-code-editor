import crypto from 'crypto';
import { pool, isDbConnected } from './index.js';
import { logger } from '../utils/logger.js';

export const DEMO_ACTIVITY_LOGS = [
  {
    id: 'demo-act-1',
    project_id: null,
    room_id: 'demo-room',
    user_name: 'Yogesh',
    user_email: 'yogesh@example.com',
    action_type: 'file_create',
    target_name: 'main.js',
    details: {},
    summary: 'Yogesh created main.js',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString()
  },
  {
    id: 'demo-act-2',
    project_id: null,
    room_id: 'demo-room',
    user_name: 'Alex',
    user_email: 'alex@example.com',
    action_type: 'folder_create',
    target_name: 'src/components',
    details: {},
    summary: 'Alex created src/components',
    created_at: new Date(Date.now() - 1000 * 60 * 95).toISOString()
  },
  {
    id: 'demo-act-3',
    project_id: null,
    room_id: 'demo-room',
    user_name: 'Yogesh',
    user_email: 'yogesh@example.com',
    action_type: 'file_rename',
    target_name: 'Editor.jsx',
    details: { oldPath: 'App.jsx', newPath: 'Editor.jsx' },
    summary: 'Yogesh renamed App.jsx to Editor.jsx',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  },
  {
    id: 'demo-act-4',
    project_id: null,
    room_id: 'demo-room',
    user_name: 'Alex',
    user_email: 'alex@example.com',
    action_type: 'file_delete',
    target_name: 'styles.css',
    details: {},
    summary: 'Alex deleted styles.css',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString()
  },
  {
    id: 'demo-act-5',
    project_id: null,
    room_id: 'demo-room',
    user_name: 'Yogesh',
    user_email: 'yogesh@example.com',
    action_type: 'file_restore',
    target_name: 'main.js',
    details: {},
    summary: 'Yogesh restored main.js to an earlier version',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  },
  {
    id: 'demo-act-6',
    project_id: null,
    room_id: 'demo-room',
    user_name: 'Alex',
    user_email: 'alex@example.com',
    action_type: 'member_invite',
    target_name: 'teammate@example.com',
    details: { role: 'Editor' },
    summary: 'Alex invited teammate@example.com as Editor',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    id: 'demo-act-7',
    project_id: null,
    room_id: 'demo-room',
    user_name: 'Yogesh',
    user_email: 'yogesh@example.com',
    action_type: 'member_role_change',
    target_name: 'Alex',
    details: { newRole: 'Viewer' },
    summary: 'Yogesh changed Alex’s role to Viewer',
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  }
];

export const inMemoryActivityLogs = new Map(); // key: roomId/projectId -> Array<activityLog>
inMemoryActivityLogs.set('demo-room', [...DEMO_ACTIVITY_LOGS]);

/**
 * Record a meaningful project activity log entry.
 * Inserts into PostgreSQL project_activity_logs (if connected) and in-memory store.
 */
export async function recordProjectActivity({
  projectId = null,
  roomId,
  userId = null,
  userName = 'Anonymous',
  userEmail = null,
  actionType,
  targetName = null,
  details = {},
  summary
}) {
  if (!roomId && !projectId) return null;

  const resolvedRoomId = roomId || 'demo-room';
  let resolvedProjectId = projectId;

  // If projectId is not passed, attempt to find project by roomId
  if (!resolvedProjectId && isDbConnected() && pool) {
    try {
      const pRes = await pool.query('SELECT id FROM projects WHERE room_id = $1 LIMIT 1', [resolvedRoomId]);
      if (pRes.rows.length > 0) {
        resolvedProjectId = pRes.rows[0].id;
      }
    } catch {
      // ignore
    }
  }

  const logEntry = {
    id: `act-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    project_id: resolvedProjectId || null,
    room_id: resolvedRoomId,
    user_id: userId || null,
    user_name: userName || 'Anonymous',
    user_email: userEmail || null,
    action_type: actionType,
    target_name: targetName || null,
    details: details || {},
    summary: summary || `${userName} performed ${actionType}`,
    created_at: new Date().toISOString()
  };

  // 1. Insert into PostgreSQL if connected
  if (isDbConnected() && pool) {
    try {
      const query = `
        INSERT INTO project_activity_logs 
          (project_id, room_id, user_id, user_name, user_email, action_type, target_name, details, summary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, project_id, room_id, user_id, user_name, user_email, action_type, target_name, details, summary, created_at;
      `;
      const res = await pool.query(query, [
        resolvedProjectId || null,
        resolvedRoomId,
        userId || null,
        logEntry.user_name,
        logEntry.user_email,
        logEntry.action_type,
        logEntry.target_name,
        JSON.stringify(logEntry.details),
        logEntry.summary
      ]);
      if (res.rows[0]) {
        logEntry.id = res.rows[0].id;
        logEntry.created_at = res.rows[0].created_at;
      }
    } catch (err) {
      logger.warn('[Activity Log] Failed to insert activity log to DB:', err.message);
    }
  }

  // 2. Insert into in-memory store (for demo-room and fast fallback)
  const storeKey = resolvedRoomId;
  if (!inMemoryActivityLogs.has(storeKey)) {
    inMemoryActivityLogs.set(storeKey, []);
  }
  const logs = inMemoryActivityLogs.get(storeKey);
  logs.unshift(logEntry);
  if (logs.length > 500) {
    logs.length = 500;
  }

  // Also store by project_id if different
  if (resolvedProjectId && resolvedProjectId !== storeKey) {
    if (!inMemoryActivityLogs.has(resolvedProjectId)) {
      inMemoryActivityLogs.set(resolvedProjectId, []);
    }
    const pLogs = inMemoryActivityLogs.get(resolvedProjectId);
    pLogs.unshift(logEntry);
    if (pLogs.length > 500) {
      pLogs.length = 500;
    }
  }

  return logEntry;
}

/**
 * Retrieve paginated activity logs for a project/room.
 */
export async function getProjectActivityLogs({ roomId, projectId = null, limit = 50, offset = 0, filter = null }) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);

  if (isDbConnected() && pool) {
    try {
      let filterClause = '';
      const params = [roomId];
      let paramIndex = 2;

      if (projectId) {
        filterClause += ` OR project_id::text = $${paramIndex++}`;
        params.push(projectId);
      }

      let categoryClause = '';
      if (filter && filter !== 'all') {
        if (filter === 'files') {
          categoryClause = ` AND action_type IN ('file_create', 'file_rename', 'file_delete', 'folder_create', 'folder_rename', 'folder_delete', 'item_move')`;
        } else if (filter === 'members') {
          categoryClause = ` AND action_type IN ('member_invite', 'member_role_change', 'member_remove', 'member_leave', 'member_join')`;
        } else if (filter === 'versions') {
          categoryClause = ` AND action_type IN ('file_restore', 'file_snapshot')`;
        }
      }

      const query = `
        SELECT id, project_id, room_id, user_id, user_name, user_email, action_type, target_name, details, summary, created_at
        FROM project_activity_logs
        WHERE (room_id = $1 ${filterClause}) ${categoryClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++};
      `;
      params.push(safeLimit, safeOffset);

      const countQuery = `
        SELECT COUNT(*) AS total
        FROM project_activity_logs
        WHERE (room_id = $1 ${filterClause}) ${categoryClause};
      `;
      const countParams = params.slice(0, paramIndex - 3);

      const [res, countRes] = await Promise.all([
        pool.query(query, params),
        pool.query(countQuery, countParams)
      ]);

      const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);
      if (totalCount === 0 && roomId === 'demo-room') {
        // Seed demo records into database
        try {
          for (const item of DEMO_ACTIVITY_LOGS) {
            await pool.query(`
              INSERT INTO project_activity_logs 
                (id, room_id, user_name, user_email, action_type, target_name, details, summary, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (id) DO NOTHING;
            `, [
              crypto.randomUUID(),
              item.room_id,
              item.user_name,
              item.user_email,
              item.action_type,
              item.target_name,
              JSON.stringify(item.details),
              item.summary,
              item.created_at
            ]);
          }
          const [reRes, reCount] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, countParams)
          ]);
          return {
            logs: reRes.rows,
            total: parseInt(reCount.rows[0]?.total || '0', 10)
          };
        } catch {
          // If insert fails, fallback to inMemoryActivityLogs
          return {
            logs: DEMO_ACTIVITY_LOGS.slice(safeOffset, safeOffset + safeLimit),
            total: DEMO_ACTIVITY_LOGS.length
          };
        }
      }

      return {
        logs: res.rows,
        total: totalCount
      };
    } catch (err) {
      logger.warn('[Activity Log] DB query error, falling back to memory:', err.message);
    }
  }

  // Fallback in-memory
  let logs = inMemoryActivityLogs.get(roomId) || [];
  if (logs.length === 0 && projectId) {
    logs = inMemoryActivityLogs.get(projectId) || [];
  }
  if (logs.length === 0 && roomId === 'demo-room') {
    logs = [...DEMO_ACTIVITY_LOGS];
    inMemoryActivityLogs.set('demo-room', logs);
  }

  let filtered = logs;
  if (filter && filter !== 'all') {
    if (filter === 'files') {
      filtered = logs.filter((l) => ['file_create', 'file_rename', 'file_delete', 'folder_create', 'folder_rename', 'folder_delete', 'item_move'].includes(l.action_type));
    } else if (filter === 'members') {
      filtered = logs.filter((l) => ['member_invite', 'member_role_change', 'member_remove', 'member_leave', 'member_join'].includes(l.action_type));
    } else if (filter === 'versions') {
      filtered = logs.filter((l) => ['file_restore', 'file_snapshot'].includes(l.action_type));
    }
  }

  return {
    logs: filtered.slice(safeOffset, safeOffset + safeLimit),
    total: filtered.length
  };
}

export default {
  DEMO_ACTIVITY_LOGS,
  recordProjectActivity,
  getProjectActivityLogs
};
