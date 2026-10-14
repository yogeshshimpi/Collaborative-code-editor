import { pool, isDbConnected } from './index.js';
import { inMemoryUsers } from './users.js';

export const inMemoryProjects = new Map();
export const inMemoryMembers = new Map(); // projectId -> Array<{ id, project_id, user_id, role, created_at }>

export async function createProject({ id, name, ownerId }) {
  const cleanRoomId = id.trim();
  const cleanName = name.trim();

  if (isDbConnected() && pool) {
    const query = `
      INSERT INTO projects (room_id, name, owner_id)
      VALUES ($1, $2, $3)
      RETURNING id, room_id, name, owner_id, COALESCE(requires_approval, FALSE) AS requires_approval, COALESCE(protected_files, '[]'::jsonb) AS protected_files, created_at, updated_at;
    `;
    const res = await pool.query(query, [cleanRoomId, cleanName, ownerId]);
    return res.rows[0];
  }

  // Fallback in-memory
  const project = {
    id: `proj-${Date.now()}`,
    room_id: cleanRoomId,
    name: cleanName,
    owner_id: ownerId,
    requires_approval: false,
    protected_files: [],
    created_at: new Date(),
    updated_at: new Date()
  };
  inMemoryProjects.set(cleanRoomId, project);
  inMemoryProjects.set(project.id, project);
  return project;
}

export async function getUserProjects(userId) {
  if (isDbConnected() && pool) {
    const query = `
      SELECT 
        p.id, 
        p.room_id, 
        p.name, 
        p.owner_id,
        COALESCE(p.requires_approval, FALSE) AS requires_approval,
        COALESCE(p.protected_files, '[]'::jsonb) AS protected_files,
        u.name AS owner_name,
        u.email AS owner_email,
        CASE 
          WHEN p.owner_id = $1 THEN 'owner'
          ELSE COALESCE(pm.role, 'viewer')
        END AS role,
        p.created_at, 
        p.updated_at
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
      WHERE p.owner_id = $1 OR pm.user_id = $1
      ORDER BY p.updated_at DESC;
    `;
    const res = await pool.query(query, [userId]);
    return res.rows;
  }

  // Fallback in-memory
  const list = [];
  for (const project of inMemoryProjects.values()) {
    let role = null;
    if (project.owner_id === userId) {
      role = 'owner';
    } else {
      const members = inMemoryMembers.get(project.id) || [];
      const m = members.find((mem) => mem.user_id === userId);
      if (m) role = m.role;
    }

    if (role) {
      const ownerUser = Array.from(inMemoryUsers.values()).find((u) => u.id === project.owner_id);
      list.push({
        ...project,
        owner_name: ownerUser?.name || 'Unknown',
        owner_email: ownerUser?.email || '',
        role
      });
    }
  }
  return list.sort((a, b) => b.updated_at - a.updated_at);
}

export async function getProjectById(id, userId = null) {
  if (!id) return null;
  const cleanId = String(id).trim();
  const lowerId = cleanId.toLowerCase();

  if (isDbConnected() && pool) {
    const query = `
      SELECT 
        p.id, 
        p.room_id, 
        p.name, 
        p.owner_id,
        COALESCE(p.requires_approval, FALSE) AS requires_approval,
        COALESCE(p.protected_files, '[]'::jsonb) AS protected_files,
        u.name AS owner_name,
        u.email AS owner_email,
        CASE 
          WHEN p.owner_id = $2 THEN 'owner'
          WHEN pm.role IS NOT NULL THEN pm.role
          ELSE NULL
        END AS role,
        p.created_at, 
        p.updated_at
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
      WHERE p.id::text = $1 
         OR p.room_id = $1 
         OR LOWER(p.room_id) = $3
         OR LOWER(p.name) = $3
         OR REGEXP_REPLACE(LOWER(p.name), '[^a-z0-9]+', '-', 'g') = $3
         OR REGEXP_REPLACE(LOWER(p.room_id), '[^a-z0-9]+', '-', 'g') = $3
      ORDER BY 
        CASE 
          WHEN p.owner_id = $2 THEN 0 
          WHEN pm.role IS NOT NULL THEN 1 
          ELSE 2 
        END,
        CASE 
          WHEN p.id::text = $1 THEN 0 
          WHEN p.room_id = $1 THEN 1 
          WHEN LOWER(p.room_id) = $3 THEN 2 
          WHEN LOWER(p.name) = $3 THEN 3 
          ELSE 4 
        END,
        p.updated_at DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [cleanId, userId, lowerId]);
    return res.rows[0] || null;
  }

  const toSlug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slugId = toSlug(cleanId);

  // Filter candidates matching by id, room_id, name, or slug
  const candidates = Array.from(inMemoryProjects.values()).filter((proj) => {
    if (!proj) return false;
    if (proj.id === cleanId || proj.room_id === cleanId) return true;
    if (proj.room_id && proj.room_id.toLowerCase() === lowerId) return true;
    if (proj.name && proj.name.toLowerCase() === lowerId) return true;
    if (toSlug(proj.name) === slugId || toSlug(proj.room_id) === slugId) return true;
    return false;
  });

  if (candidates.length === 0) return null;

  // Score candidate prioritizing user ownership/membership and exact match
  candidates.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (userId) {
      if (a.owner_id === userId) scoreA += 100;
      else {
        const memsA = inMemoryMembers.get(a.id) || [];
        if (memsA.some((m) => m.user_id === userId)) scoreA += 50;
      }
      if (b.owner_id === userId) scoreB += 100;
      else {
        const memsB = inMemoryMembers.get(b.id) || [];
        if (memsB.some((m) => m.user_id === userId)) scoreB += 50;
      }
    }

    if (a.id === cleanId || a.room_id === cleanId) scoreA += 30;
    else if (a.room_id && a.room_id.toLowerCase() === lowerId) scoreA += 20;
    else if (a.name && a.name.toLowerCase() === lowerId) scoreA += 10;

    if (b.id === cleanId || b.room_id === cleanId) scoreB += 30;
    else if (b.room_id && b.room_id.toLowerCase() === lowerId) scoreB += 20;
    else if (b.name && b.name.toLowerCase() === lowerId) scoreB += 10;

    if (scoreA !== scoreB) return scoreB - scoreA;
    return (new Date(b.updated_at || 0)) - (new Date(a.updated_at || 0));
  });

  const p = candidates[0];

  let role = null;
  if (userId) {
    if (p.owner_id === userId) role = 'owner';
    else {
      const members = inMemoryMembers.get(p.id) || [];
      const m = members.find((mem) => mem.user_id === userId);
      if (m) role = m.role;
    }
  }

  const ownerUser = Array.from(inMemoryUsers.values()).find((u) => u.id === p.owner_id);
  return {
    ...p,
    owner_name: ownerUser?.name || 'Unknown',
    owner_email: ownerUser?.email || '',
    role
  };
}

export async function getProjectRole(projectIdOrRoomId, userId) {
  if (!userId) return null;
  const project = await getProjectById(projectIdOrRoomId, userId);
  return project?.role || null;
}

export async function getProjectMembers(projectId) {
  if (isDbConnected() && pool) {
    const query = `
      SELECT 
        pm.id,
        pm.project_id,
        pm.user_id,
        pm.role,
        pm.created_at,
        u.name,
        u.email
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id::text = $1
      ORDER BY pm.created_at ASC;
    `;
    const res = await pool.query(query, [projectId]);
    return res.rows;
  }

  const members = inMemoryMembers.get(projectId) || [];
  return members.map((m) => {
    const u = Array.from(inMemoryUsers.values()).find((user) => user.id === m.user_id);
    return {
      ...m,
      name: u?.name || 'Unknown',
      email: u?.email || ''
    };
  });
}

export async function updateProjectMemberRole(projectId, targetUserId, newRole) {
  if (!['editor', 'viewer'].includes(newRole)) {
    throw new Error('Role must be either editor or viewer.');
  }

  if (isDbConnected() && pool) {
    const query = `
      UPDATE project_members
      SET role = $3
      WHERE project_id::text = $1 AND user_id = $2
      RETURNING id, project_id, user_id, role;
    `;
    const res = await pool.query(query, [projectId, targetUserId, newRole]);
    return res.rows[0] || null;
  }

  const members = inMemoryMembers.get(projectId) || [];
  const m = members.find((mem) => mem.user_id === targetUserId);
  if (m) {
    m.role = newRole;
    return m;
  }
  return null;
}

export async function removeProjectMember(projectId, targetUserId) {
  if (isDbConnected() && pool) {
    const query = `
      DELETE FROM project_members
      WHERE project_id::text = $1 AND user_id = $2
      RETURNING id, user_id;
    `;
    const res = await pool.query(query, [projectId, targetUserId]);
    return res.rows[0] || null;
  }

  const members = inMemoryMembers.get(projectId) || [];
  const idx = members.findIndex((mem) => mem.user_id === targetUserId);
  if (idx !== -1) {
    const removed = members.splice(idx, 1)[0];
    return removed;
  }
  return null;
}

export async function updateProject(idOrRoomId, { name, roomId }, ownerId) {
  if (!idOrRoomId) return null;
  const project = await getProjectById(idOrRoomId, ownerId);
  if (!project || project.owner_id !== ownerId) {
    return null;
  }

  const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 100) : project.name;
  let targetRoomId = project.room_id;
  if (typeof roomId === 'string' && roomId.trim() && roomId.trim() !== project.room_id) {
    targetRoomId = roomId.trim().slice(0, 64);
  }

  const oldRoomId = project.room_id;
  const roomIdChanged = targetRoomId !== oldRoomId;

  if (isDbConnected() && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if new room_id conflicts with another project
      if (roomIdChanged) {
        const checkConflict = await client.query(
          'SELECT id FROM projects WHERE room_id = $1 AND id != $2 LIMIT 1;',
          [targetRoomId, project.id]
        );
        if (checkConflict.rows.length > 0) {
          throw new Error(`Room ID "${targetRoomId}" is already in use by another project.`);
        }
      }

      // Update project record
      const updateRes = await client.query(
        `UPDATE projects
         SET name = $1, room_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND owner_id = $4
         RETURNING id, room_id, name, owner_id, created_at, updated_at;`,
        [cleanName, targetRoomId, project.id, ownerId]
      );

      // If room_id changed, migrate existing files, versions, and folders
      if (roomIdChanged) {
        await client.query(
          `UPDATE room_files SET room_id = $1 WHERE room_id = $2;`,
          [targetRoomId, oldRoomId]
        );
        await client.query(
          `UPDATE file_versions SET room_id = $1 WHERE room_id = $2;`,
          [targetRoomId, oldRoomId]
        );
        await client.query(
          `UPDATE room_folders SET room_id = $1 WHERE room_id = $2;`,
          [targetRoomId, oldRoomId]
        );
      }

      await client.query('COMMIT');
      return {
        ...updateRes.rows[0],
        old_room_id: oldRoomId,
        role: 'owner'
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Fallback in-memory
  const p = inMemoryProjects.get(project.id) || inMemoryProjects.get(oldRoomId) || project;
  p.name = cleanName;
  p.updated_at = new Date();

  if (roomIdChanged) {
    // Check collision in memory
    for (const other of inMemoryProjects.values()) {
      if (other.id !== p.id && other.room_id === targetRoomId) {
        throw new Error(`Room ID "${targetRoomId}" is already in use by another project.`);
      }
    }

    inMemoryProjects.delete(oldRoomId);
    p.room_id = targetRoomId;
    inMemoryProjects.set(targetRoomId, p);
    inMemoryProjects.set(p.id, p);
  }

  return {
    ...p,
    old_room_id: oldRoomId,
    role: 'owner'
  };
}

export async function updateProjectName(id, name, ownerId) {
  return updateProject(id, { name }, ownerId);
}

export async function deleteProject(id, ownerId) {
  if (isDbConnected() && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query('DELETE FROM projects WHERE (id::text = $1 OR room_id = $1) AND owner_id = $2 RETURNING id, room_id;', [id, ownerId]);
      if (res.rows.length > 0) {
        await client.query('DELETE FROM room_files WHERE room_id = $1;', [res.rows[0].room_id]);
        await client.query('DELETE FROM room_folders WHERE room_id = $1;', [res.rows[0].room_id]);
      }
      await client.query('COMMIT');
      return res.rows[0] || null;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  const p = inMemoryProjects.get(id);
  if (p && p.owner_id === ownerId) {
    inMemoryProjects.delete(id);
    return { id, room_id: p.room_id || id };
  }
  return null;
}

/**
 * Toggle owner approval mode for a project. (Owner only)
 */
export async function updateProjectApprovalMode(projectIdOrRoomId, requiresApproval, userId) {
  const project = await getProjectById(projectIdOrRoomId, userId);
  if (!project) return null;
  if (project.role !== 'owner' && project.owner_id !== userId) {
    throw new Error('Only the project owner can toggle approval mode.');
  }

  const targetId = project.id;
  const boolVal = Boolean(requiresApproval);

  if (isDbConnected() && pool) {
    const query = `
      UPDATE projects
      SET requires_approval = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, room_id, name, owner_id, requires_approval, COALESCE(protected_files, '[]'::jsonb) AS protected_files, created_at, updated_at;
    `;
    const res = await pool.query(query, [boolVal, targetId]);
    return res.rows[0] ? { ...res.rows[0], role: 'owner' } : null;
  }

  const p = inMemoryProjects.get(targetId);
  if (p) {
    p.requires_approval = boolVal;
    p.updated_at = new Date();
    inMemoryProjects.set(targetId, p);
    return { ...p, role: 'owner' };
  }
  return null;
}

export async function updateProjectProtectedFiles(projectIdOrRoomId, protectedFiles, userId) {
  const project = await getProjectById(projectIdOrRoomId, userId);
  if (!project) return null;
  if (project.role !== 'owner' && project.owner_id !== userId) {
    throw new Error('Only the project owner can update protected files.');
  }

  const targetId = project.id;
  const cleanList = Array.isArray(protectedFiles)
    ? Array.from(new Set(protectedFiles.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim())))
    : [];

  if (isDbConnected() && pool) {
    const query = `
      UPDATE projects
      SET protected_files = $1::jsonb, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, room_id, name, owner_id, requires_approval, COALESCE(protected_files, '[]'::jsonb) AS protected_files, created_at, updated_at;
    `;
    const res = await pool.query(query, [JSON.stringify(cleanList), targetId]);
    return res.rows[0] ? { ...res.rows[0], role: 'owner' } : null;
  }

  const p = inMemoryProjects.get(targetId);
  if (p) {
    p.protected_files = cleanList;
    p.updated_at = new Date();
    inMemoryProjects.set(targetId, p);
    return { ...p, role: 'owner' };
  }
  return null;
}

export function isFileProtected(project, filePath) {
  if (!project || !filePath) return false;
  const list = Array.isArray(project.protected_files)
    ? project.protected_files
    : typeof project.protected_files === 'string'
    ? JSON.parse(project.protected_files || '[]')
    : [];
  const cleanPath = filePath.replace(/^\/+/, '').trim().toLowerCase();
  return list.some(item => (typeof item === 'string' ? item : '').replace(/^\/+/, '').trim().toLowerCase() === cleanPath);
}

export default {
  createProject,
  getUserProjects,
  getProjectById,
  getProjectRole,
  getProjectMembers,
  updateProjectMemberRole,
  removeProjectMember,
  updateProject,
  updateProjectName,
  deleteProject,
  updateProjectApprovalMode,
  updateProjectProtectedFiles,
  isFileProtected
};

