import { pool, isDbConnected } from './index.js';
import { inMemoryUsers, findUserByEmail, findUserById } from './users.js';
import { inMemoryProjects, inMemoryMembers, getProjectById, getProjectMembers } from './projects.js';

export const inMemoryInvitations = new Map(); // invitationId -> { id, project_id, invited_by, invited_email, role, status, created_at, expires_at }

export async function getProjectInvitations(projectId) {
  if (isDbConnected() && pool) {
    const query = `
      SELECT 
        pi.id,
        pi.project_id,
        pi.invited_by,
        pi.invited_email,
        pi.role,
        pi.status,
        pi.created_at,
        pi.expires_at,
        u.name AS invited_by_name
      FROM project_invitations pi
      JOIN users u ON u.id = pi.invited_by
      WHERE pi.project_id::text = $1 
        AND pi.status = 'pending' 
        AND pi.expires_at > NOW()
      ORDER BY pi.created_at DESC;
    `;
    const res = await pool.query(query, [projectId]);
    return res.rows;
  }

  const now = new Date();
  const list = [];
  for (const inv of inMemoryInvitations.values()) {
    if (inv.project_id === projectId && inv.status === 'pending' && new Date(inv.expires_at) > now) {
      const u = Array.from(inMemoryUsers.values()).find((user) => user.id === inv.invited_by);
      list.push({
        ...inv,
        invited_by_name: u?.name || 'Unknown'
      });
    }
  }
  return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function createProjectInvitation({ projectId, invitedById, invitedEmail, role }) {
  const cleanEmail = invitedEmail.toLowerCase().trim();

  // Validate invited user exists in CodeCollab
  const invitedUser = await findUserByEmail(cleanEmail);
  if (!invitedUser) {
    const error = new Error(`No registered user found with email "${invitedEmail}". The user must register an account before being invited.`);
    error.status = 404;
    throw error;
  }

  // Retrieve project
  const project = await getProjectById(projectId, invitedById);
  if (!project) {
    const error = new Error('Project not found.');
    error.status = 404;
    throw error;
  }

  // Project owner cannot invite themselves
  if (project.owner_id === invitedUser.id) {
    const error = new Error('You cannot invite yourself as you are already the project owner.');
    error.status = 400;
    throw error;
  }

  // Check if user is already an accepted member
  const members = await getProjectMembers(project.id);
  if (members.some((m) => m.user_id === invitedUser.id)) {
    const error = new Error(`User "${invitedEmail}" is already a member of this project.`);
    error.status = 400;
    throw error;
  }

  // Check if active pending invite already exists
  if (isDbConnected() && pool) {
    const checkQuery = `
      SELECT id FROM project_invitations
      WHERE project_id::text = $1 
        AND LOWER(invited_email) = $2 
        AND status = 'pending' 
        AND expires_at > NOW();
    `;
    const checkRes = await pool.query(checkQuery, [project.id, cleanEmail]);
    if (checkRes.rows.length > 0) {
      const error = new Error(`An active pending invitation has already been sent to "${invitedEmail}".`);
      error.status = 400;
      throw error;
    }

    const insertQuery = `
      INSERT INTO project_invitations (project_id, invited_by, invited_email, role, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, project_id, invited_by, invited_email, role, status, created_at, expires_at;
    `;
    const res = await pool.query(insertQuery, [project.id, invitedById, cleanEmail, role]);
    return res.rows[0];
  }

  // Fallback in-memory
  const now = new Date();
  for (const inv of inMemoryInvitations.values()) {
    if (inv.project_id === project.id && inv.invited_email.toLowerCase() === cleanEmail && inv.status === 'pending' && new Date(inv.expires_at) > now) {
      const error = new Error(`An active pending invitation has already been sent to "${invitedEmail}".`);
      error.status = 400;
      throw error;
    }
  }

  const id = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = {
    id,
    project_id: project.id,
    invited_by: invitedById,
    invited_email: cleanEmail,
    role,
    status: 'pending',
    created_at: now,
    expires_at: expiresAt
  };
  inMemoryInvitations.set(id, invitation);
  return invitation;
}

export async function revokeProjectInvitation(invitationId, projectId) {
  if (isDbConnected() && pool) {
    const query = `
      UPDATE project_invitations
      SET status = 'revoked', responded_at = NOW()
      WHERE id::text = $1 AND project_id::text = $2 AND status = 'pending'
      RETURNING id, status;
    `;
    const res = await pool.query(query, [invitationId, projectId]);
    return res.rows[0] || null;
  }

  const inv = inMemoryInvitations.get(invitationId);
  if (inv && inv.project_id === projectId && inv.status === 'pending') {
    inv.status = 'revoked';
    inv.responded_at = new Date();
    return inv;
  }
  return null;
}

export async function getUserPendingInvitations(userEmail) {
  if (!userEmail) return [];
  const cleanEmail = userEmail.toLowerCase().trim();

  if (isDbConnected() && pool) {
    const query = `
      SELECT 
        pi.id,
        pi.project_id,
        p.name AS project_name,
        p.room_id,
        u.name AS invited_by_name,
        u.email AS invited_by_email,
        pi.role,
        pi.created_at,
        pi.expires_at
      FROM project_invitations pi
      JOIN projects p ON p.id = pi.project_id
      JOIN users u ON u.id = pi.invited_by
      WHERE LOWER(pi.invited_email) = $1
        AND pi.status = 'pending'
        AND pi.expires_at > NOW()
      ORDER BY pi.created_at DESC;
    `;
    const res = await pool.query(query, [cleanEmail]);
    return res.rows;
  }

  const now = new Date();
  const list = [];
  for (const inv of inMemoryInvitations.values()) {
    if (inv.invited_email.toLowerCase() === cleanEmail && inv.status === 'pending' && new Date(inv.expires_at) > now) {
      const p = inMemoryProjects.get(inv.project_id) || Array.from(inMemoryProjects.values()).find((proj) => proj.id === inv.project_id || proj.room_id === inv.project_id);
      const u = Array.from(inMemoryUsers.values()).find((user) => user.id === inv.invited_by);
      if (p) {
        list.push({
          id: inv.id,
          project_id: inv.project_id,
          project_name: p.name,
          room_id: p.room_id,
          invited_by_name: u?.name || 'Unknown',
          invited_by_email: u?.email || '',
          role: inv.role,
          created_at: inv.created_at,
          expires_at: inv.expires_at
        });
      }
    }
  }
  return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function respondToInvitation(invitationId, userEmailOrUserId, userIdOrAction, maybeAction) {
  let userEmail, userId, action;
  if (maybeAction !== undefined) {
    userEmail = userEmailOrUserId;
    userId = userIdOrAction;
    action = maybeAction;
  } else {
    action = userIdOrAction;
    if (typeof userEmailOrUserId === 'string' && userEmailOrUserId.includes('@')) {
      userEmail = userEmailOrUserId;
      const u = await findUserByEmail(userEmail);
      userId = u?.id;
    } else {
      userId = userEmailOrUserId;
      const u = await findUserById(userId);
      userEmail = u?.email;
    }
  }

  if (!['accept', 'decline'].includes(action)) {
    throw new Error('Action must be either accept or decline.');
  }
  const cleanEmail = (userEmail || '').toLowerCase().trim();

  if (isDbConnected() && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const invQuery = `
        SELECT id, project_id, role
        FROM project_invitations
        WHERE id::text = $1 
          AND LOWER(invited_email) = $2 
          AND status = 'pending' 
          AND expires_at > NOW()
        FOR UPDATE;
      `;
      const invRes = await client.query(invQuery, [invitationId, cleanEmail]);
      if (invRes.rows.length === 0) {
        throw new Error('Invitation not found, already responded to, or expired.');
      }

      const inv = invRes.rows[0];
      const newStatus = action === 'accept' ? 'accepted' : 'declined';

      await client.query(`
        UPDATE project_invitations
        SET status = $1, responded_at = NOW()
        WHERE id = $2;
      `, [newStatus, inv.id]);

      if (action === 'accept') {
        await client.query(`
          INSERT INTO project_members (project_id, user_id, role)
          VALUES ($1, $2, $3)
          ON CONFLICT (project_id, user_id)
          DO UPDATE SET role = EXCLUDED.role;
        `, [inv.project_id, userId, inv.role]);
      }

      await client.query('COMMIT');
      return { success: true, action: newStatus, projectId: inv.project_id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Fallback in-memory
  const inv = inMemoryInvitations.get(invitationId);
  const now = new Date();
  if (!inv || inv.invited_email.toLowerCase() !== cleanEmail || inv.status !== 'pending' || new Date(inv.expires_at) <= now) {
    throw new Error('Invitation not found, already responded to, or expired.');
  }

  const newStatus = action === 'accept' ? 'accepted' : 'declined';
  inv.status = newStatus;
  inv.responded_at = now;

  if (action === 'accept') {
    const members = inMemoryMembers.get(inv.project_id) || [];
    const existing = members.find((m) => m.user_id === userId);
    if (existing) {
      existing.role = inv.role;
    } else {
      members.push({
        id: `mem-${Date.now()}`,
        project_id: inv.project_id,
        user_id: userId,
        role: inv.role,
        created_at: now
      });
    }
    inMemoryMembers.set(inv.project_id, members);
  }

  return { success: true, action: newStatus, projectId: inv.project_id };
}

export default {
  getProjectInvitations,
  createProjectInvitation,
  revokeProjectInvitation,
  getUserPendingInvitations,
  respondToInvitation
};
