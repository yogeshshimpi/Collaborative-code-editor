import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Starter templates for main.js, index.html, styles.css
export const STARTER_FILES = {
  'main.js': `// Welcome to CodeCollab - Professional Collaborative Code Editor
// Real-time Collaborative Session

function calculateProjectStats(project) {
  const { name, teamSize, status } = project;
  console.log(\`🚀 Initializing workspace for "\${name}"...\`);
  
  return {
    projectName: name,
    collaborators: teamSize,
    workspaceState: status,
    readyForSync: true,
    engine: 'Monaco Editor (VS Code core)',
    timestamp: new Date().toLocaleTimeString()
  };
}

const currentSession = calculateProjectStats({
  name: 'CodeCollab Major Project',
  teamSize: 4,
  status: 'active'
});

console.log('Session Summary:', currentSession);
`,
  'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeCollab Preview</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main class="container">
    <div class="card">
      <span class="badge">Live Project</span>
      <h1>Welcome to CodeCollab</h1>
      <p>A real-time developer environment engineered for high-performance team collaboration.</p>
      <button id="cta-btn">Explore Documentation</button>
    </div>
  </main>
  <script src="main.js"></script>
</body>
</html>
`,
  'styles.css': `/* CodeCollab Modern Dark Theme Styles */
:root {
  --bg-primary: #0f1117;
  --bg-card: #161922;
  --accent: #6366f1;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-primary);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.card {
  background: var(--bg-card);
  padding: 2.5rem;
  border-radius: 12px;
  border: 1px solid #282f44;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  max-width: 480px;
  text-align: center;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--accent);
  background: rgba(99, 102, 241, 0.15);
  border-radius: 9999px;
  margin-bottom: 1rem;
}
`
};

let pool = null;
let dbConnected = false;

// In-memory fallback stores if database is not reachable
const inMemoryStore = new Map();
const inMemoryUsers = new Map();
const inMemoryProjects = new Map();
const inMemoryMembers = new Map(); // projectId -> Array<{ id, project_id, user_id, role, created_at }>
const inMemoryInvitations = new Map(); // invitationId -> { id, project_id, invited_by, invited_email, role, status, created_at, expires_at }
let inMemoryUserIdSeq = 1;

// Initialize Postgres connection pool
const databaseUrl = process.env.DATABASE_URL?.trim();

if (databaseUrl) {
  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL Error] Unexpected client error:', err.message);
    });
  } catch (err) {
    console.warn('[PostgreSQL] Failed to initialize connection pool:', err.message);
  }
} else {
  console.log('[Database] DATABASE_URL not set. Operating in in-memory session mode.');
}

/**
 * Initialize Database schema:
 * - room_files: persists code for all rooms
 * - users: user accounts
 * - projects: user-owned projects linked to rooms
 */
export async function initDatabase() {
  if (!pool) return false;

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS room_files (
          room_id VARCHAR(64) NOT NULL,
          file_name VARCHAR(64) NOT NULL,
          content TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (room_id, file_name)
        );

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id VARCHAR(64) NOT NULL,
          name VARCHAR(100) NOT NULL,
          owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Ensure owner_id column exists if table was pre-existing
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

        CREATE TABLE IF NOT EXISTS project_members (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL DEFAULT 'editor'
            CHECK (role IN ('owner', 'editor', 'viewer')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (project_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS project_invitations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          invited_email VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'editor'
            CHECK (role IN ('editor', 'viewer')),
          status VARCHAR(20) NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'accepted', 'declined', 'revoked', 'expired')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
          responded_at TIMESTAMPTZ
        );

        CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(LOWER(invited_email));
        CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON project_invitations(project_id);
      `);
      dbConnected = true;
      console.log('✅ [PostgreSQL] Connected to Neon PostgreSQL database and verified tables (room_files, users, projects, project_members, project_invitations).');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbConnected = false;
    console.warn('⚠️ [PostgreSQL] Database connection failed. Falling back to in-memory mode:', err.message);
    return false;
  }
}

// -------------------------------------------------------------
// USER OPERATIONS
// -------------------------------------------------------------

export async function createUser({ email, passwordHash, name }) {
  if (dbConnected && pool) {
    const query = `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name, created_at;
    `;
    const res = await pool.query(query, [email.toLowerCase().trim(), passwordHash, name.trim()]);
    return res.rows[0];
  }

  // Fallback in-memory
  const id = inMemoryUserIdSeq++;
  const user = {
    id,
    email: email.toLowerCase().trim(),
    password_hash: passwordHash,
    name: name.trim(),
    created_at: new Date()
  };
  inMemoryUsers.set(user.email, user);
  return { id: user.id, email: user.email, name: user.name, created_at: user.created_at };
}

export async function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();

  if (dbConnected && pool) {
    const query = `
      SELECT id, email, password_hash, name, created_at
      FROM users
      WHERE LOWER(email) = $1;
    `;
    const res = await pool.query(query, [cleanEmail]);
    return res.rows[0] || null;
  }

  // Fallback in-memory
  return inMemoryUsers.get(cleanEmail) || null;
}

export async function findUserById(id) {
  if (!id) return null;

  if (dbConnected && pool) {
    const query = `
      SELECT id, email, name, created_at
      FROM users
      WHERE id = $1;
    `;
    const res = await pool.query(query, [id]);
    return res.rows[0] || null;
  }

  // Fallback in-memory
  for (const user of inMemoryUsers.values()) {
    if (user.id === id) {
      return { id: user.id, email: user.email, name: user.name, created_at: user.created_at };
    }
  }
  return null;
}

// -------------------------------------------------------------
// PROJECT (OWNERSHIP) OPERATIONS
// -------------------------------------------------------------

export async function createProject({ id, name, ownerId }) {
  const cleanRoomId = id.trim();
  const cleanName = name.trim();

  if (dbConnected && pool) {
    const query = `
      INSERT INTO projects (room_id, name, owner_id)
      VALUES ($1, $2, $3)
      RETURNING id, room_id, name, owner_id, created_at, updated_at;
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
    created_at: new Date(),
    updated_at: new Date()
  };
  inMemoryProjects.set(cleanRoomId, project);
  inMemoryProjects.set(project.id, project);
  return project;
}

export async function getUserProjects(userId) {
  if (dbConnected && pool) {
    const query = `
      SELECT 
        p.id, 
        p.room_id, 
        p.name, 
        p.owner_id,
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
  if (dbConnected && pool) {
    const query = `
      SELECT 
        p.id, 
        p.room_id, 
        p.name, 
        p.owner_id,
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
      WHERE p.id::text = $1 OR p.room_id = $1
      LIMIT 1;
    `;
    const res = await pool.query(query, [id, userId]);
    return res.rows[0] || null;
  }

  const p = inMemoryProjects.get(id) || Array.from(inMemoryProjects.values()).find((proj) => proj.room_id === id || proj.id === id);
  if (!p) return null;

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
  if (dbConnected && pool) {
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

export async function getProjectInvitations(projectId) {
  if (dbConnected && pool) {
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
  if (dbConnected && pool) {
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
  if (dbConnected && pool) {
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

export async function updateProjectMemberRole(projectId, targetUserId, newRole) {
  if (!['editor', 'viewer'].includes(newRole)) {
    throw new Error('Role must be either editor or viewer.');
  }

  if (dbConnected && pool) {
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
  if (dbConnected && pool) {
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

export async function getUserPendingInvitations(userEmail) {
  if (!userEmail) return [];
  const cleanEmail = userEmail.toLowerCase().trim();

  if (dbConnected && pool) {
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

  if (dbConnected && pool) {
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

export async function updateProjectName(id, name, ownerId) {
  if (dbConnected && pool) {
    const query = `
      UPDATE projects
      SET name = $1, updated_at = CURRENT_TIMESTAMP
      WHERE (id::text = $2 OR room_id = $2) AND owner_id = $3
      RETURNING id, room_id, name, owner_id, created_at, updated_at;
    `;
    const res = await pool.query(query, [name.trim(), id, ownerId]);
    return res.rows[0] || null;
  }

  const p = inMemoryProjects.get(id);
  if (p && p.owner_id === ownerId) {
    p.name = name.trim();
    p.updated_at = new Date();
    return p;
  }
  return null;
}

export async function deleteProject(id, ownerId) {
  if (dbConnected && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query('DELETE FROM projects WHERE (id::text = $1 OR room_id = $1) AND owner_id = $2 RETURNING id, room_id;', [id, ownerId]);
      if (res.rows.length > 0) {
        await client.query('DELETE FROM room_files WHERE room_id = $1;', [res.rows[0].room_id]);
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
    inMemoryStore.delete(p.room_id || id);
    return { id, room_id: p.room_id || id };
  }
  return null;
}

// -------------------------------------------------------------
// ROOM FILES OPERATIONS
// -------------------------------------------------------------

/**
 * Retrieve all files for a given room.
 * Seeds default starter files if the room is new.
 */
export async function getRoomFiles(roomId) {
  // If PostgreSQL is connected, fetch from database
  if (dbConnected && pool) {
    try {
      const query = `
        SELECT file_name, content 
        FROM room_files 
        WHERE room_id = $1;
      `;
      const result = await pool.query(query, [roomId]);

      if (result.rows.length > 0) {
        const files = {};
        for (const row of result.rows) {
          files[row.file_name] = row.content;
        }

        // Ensure all 3 supported files exist in the returned set
        for (const [name, defaultContent] of Object.entries(STARTER_FILES)) {
          if (files[name] === undefined) {
            files[name] = defaultContent;
            // Seed missing starter file into database
            await saveFileContent(roomId, name, defaultContent);
          }
        }

        return files;
      }

      // Room is new: seed all 3 starter files into database
      for (const [name, content] of Object.entries(STARTER_FILES)) {
        await saveFileContent(roomId, name, content);
      }
      return { ...STARTER_FILES };
    } catch (err) {
      console.error(`[PostgreSQL] Error loading files for room "${roomId}":`, err.message);
      // Fall through to in-memory store
    }
  }

  // Fallback to in-memory store
  if (!inMemoryStore.has(roomId)) {
    inMemoryStore.set(roomId, { ...STARTER_FILES });
  }
  return inMemoryStore.get(roomId);
}

// Pending debounced database writes. Every caller receives the final result of
// the write, so the UI can show a real save confirmation rather than guessing.
const pendingSaves = new Map();

/**
 * Persist file content to PostgreSQL with debounced writes to optimize performance.
 */
export function saveFileContent(roomId, fileName, content) {
  // Always update in-memory cache immediately
  if (!inMemoryStore.has(roomId)) {
    inMemoryStore.set(roomId, {});
  }
  inMemoryStore.get(roomId)[fileName] = content;

  if (!dbConnected || !pool) {
    return Promise.reject(new Error('Database is not connected'));
  }

  // Debounce writes so rapid keystrokes do not flood PostgreSQL. All edits
  // made during the debounce window are confirmed together after the latest
  // version has been written successfully.
  const timerKey = `${roomId}:${fileName}`;
  return new Promise((resolve, reject) => {
    let pending = pendingSaves.get(timerKey);

    if (!pending) {
      pending = { roomId, fileName, content, timer: null, waiters: [] };
      pendingSaves.set(timerKey, pending);
    } else {
      clearTimeout(pending.timer);
      pending.content = content;
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
        pending.waiters.forEach(({ resolve }) => resolve());
      } catch (err) {
        console.error(`[PostgreSQL] Failed to save file "${fileName}" in room "${roomId}":`, err.message);
        pending.waiters.forEach(({ reject: rejectSave }) => rejectSave(err));
      }
    }, 800);
  });
}

export function isDbConnected() {
  return dbConnected;
}
