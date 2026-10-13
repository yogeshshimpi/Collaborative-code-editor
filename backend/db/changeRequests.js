import { pool, isDbConnected } from './index.js';
import { getProjectById } from './projects.js';
import { logger } from '../utils/logger.js';

export const inMemoryChangeRequests = new Map(); // requestId -> changeRequest

/**
 * Create a new pending change request for a project.
 */
export async function createChangeRequest({
  projectId,
  roomId,
  authorId,
  authorName,
  authorEmail = '',
  requestType = 'code_change',
  targetPath,
  oldPath = null,
  proposedContent = null,
  originalContent = null,
  title,
  description = ''
}) {
  const cleanTitle = (title && typeof title === 'string') ? title.trim().slice(0, 150) : `Change proposal for ${targetPath}`;

  if (isDbConnected() && pool) {
    try {
      const query = `
        INSERT INTO project_change_requests (
          project_id,
          room_id,
          author_id,
          author_name,
          author_email,
          request_type,
          target_path,
          old_path,
          proposed_content,
          original_content,
          title,
          description,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', NOW())
        RETURNING *;
      `;
      const values = [
        projectId,
        roomId,
        authorId,
        authorName,
        authorEmail,
        requestType,
        targetPath,
        oldPath,
        proposedContent,
        originalContent,
        cleanTitle,
        description
      ];
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (err) {
      logger.error('[ChangeRequests DB Error] Failed to create change request:', err.message);
      throw err;
    }
  }

  // In-memory fallback
  const id = `cr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cr = {
    id,
    project_id: projectId,
    room_id: roomId,
    author_id: authorId,
    author_name: authorName,
    author_email: authorEmail,
    request_type: requestType,
    target_path: targetPath,
    old_path: oldPath,
    proposed_content: proposedContent,
    original_content: originalContent,
    title: cleanTitle,
    description,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    created_at: new Date()
  };
  inMemoryChangeRequests.set(id, cr);
  return cr;
}

/**
 * Retrieve all change requests for a project, optionally filtered by status ('pending', 'approved', 'rejected', 'all').
 */
export async function getProjectChangeRequests(projectIdOrRoomId, status = 'all') {
  if (!projectIdOrRoomId) return [];
  const project = await getProjectById(projectIdOrRoomId);
  const targetProjectId = project?.id || projectIdOrRoomId;
  const targetRoomId = project?.room_id || projectIdOrRoomId;

  if (isDbConnected() && pool) {
    try {
      let query = `
        SELECT 
          cr.*,
          u.name AS reviewer_name,
          u.email AS reviewer_email
        FROM project_change_requests cr
        LEFT JOIN users u ON u.id = cr.reviewed_by
        WHERE (cr.project_id::text = $1 OR cr.room_id = $2)
      `;
      const values = [String(targetProjectId), String(targetRoomId)];

      if (status && status !== 'all') {
        query += ` AND cr.status = $3`;
        values.push(status);
      }

      query += ` ORDER BY cr.created_at DESC;`;
      const res = await pool.query(query, values);
      return res.rows;
    } catch (err) {
      logger.error('[ChangeRequests DB Error] Failed to list change requests:', err.message);
      throw err;
    }
  }

  // In-memory fallback
  const all = Array.from(inMemoryChangeRequests.values()).filter((cr) => {
    const matchesProject = cr.project_id === targetProjectId || cr.room_id === targetRoomId;
    if (!matchesProject) return false;
    if (status && status !== 'all' && cr.status !== status) return false;
    return true;
  });

  return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * Retrieve a specific change request by its ID.
 */
export async function getChangeRequestById(requestId) {
  if (!requestId) return null;
  const cleanId = String(requestId).trim();

  if (isDbConnected() && pool) {
    try {
      const query = `
        SELECT 
          cr.*,
          u.name AS reviewer_name,
          u.email AS reviewer_email
        FROM project_change_requests cr
        LEFT JOIN users u ON u.id = cr.reviewed_by
        WHERE cr.id::text = $1
        LIMIT 1;
      `;
      const res = await pool.query(query, [cleanId]);
      return res.rows[0] || null;
    } catch (err) {
      logger.error('[ChangeRequests DB Error] Failed to get change request by ID:', err.message);
      return null;
    }
  }

  return inMemoryChangeRequests.get(cleanId) || null;
}

/**
 * Review (approve or reject) a pending change request.
 */
export async function updateChangeRequestReview(requestId, { status, reviewedBy, rejectionReason = null }) {
  if (!requestId || !['approved', 'rejected'].includes(status)) {
    throw new Error('Valid review status (approved or rejected) is required.');
  }
  const cleanId = String(requestId).trim();

  if (isDbConnected() && pool) {
    try {
      const query = `
        UPDATE project_change_requests
        SET 
          status = $1,
          reviewed_by = $2,
          reviewed_at = NOW(),
          rejection_reason = $3
        WHERE id::text = $4
        RETURNING *;
      `;
      const res = await pool.query(query, [status, reviewedBy, rejectionReason, cleanId]);
      return res.rows[0] || null;
    } catch (err) {
      logger.error('[ChangeRequests DB Error] Failed to update change request review:', err.message);
      throw err;
    }
  }

  const existing = inMemoryChangeRequests.get(cleanId);
  if (!existing) return null;

  existing.status = status;
  existing.reviewed_by = reviewedBy;
  existing.reviewed_at = new Date();
  existing.rejection_reason = rejectionReason;
  inMemoryChangeRequests.set(cleanId, existing);
  return existing;
}

export default {
  createChangeRequest,
  getProjectChangeRequests,
  getChangeRequestById,
  updateChangeRequestReview
};
