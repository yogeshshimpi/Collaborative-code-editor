import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

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

export let pool = null;
let dbConnected = false;

// In-memory fallback stores if database is not reachable
const inMemoryStore = new Map();
const inMemoryUsers = new Map();
const inMemoryProjects = new Map();
const inMemoryMembers = new Map(); // projectId -> Array<{ id, project_id, user_id, role, created_at }>
const inMemoryInvitations = new Map(); // invitationId -> { id, project_id, invited_by, invited_email, role, status, created_at, expires_at }
const inMemoryFolders = new Map(); // roomId -> Set<folderPath>
const inMemoryVersions = new Map(); // key: `${roomId}:${fileName}` -> Array<version>
const inMemoryActivityLogs = new Map(); // key: roomId/projectId -> Array<activityLog>

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

// Pre-populate demo-room activity logs
inMemoryActivityLogs.set('demo-room', [...DEMO_ACTIVITY_LOGS]);
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

        -- Per-file version history and restore table
        CREATE TABLE IF NOT EXISTS file_versions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id VARCHAR(64) NOT NULL,
          file_name VARCHAR(64) NOT NULL,
          content TEXT NOT NULL,
          content_hash VARCHAR(64) NOT NULL,
          author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          version_type VARCHAR(20) NOT NULL DEFAULT 'auto'
            CHECK (version_type IN ('auto', 'manual', 'restore')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Optional label/name for manual checkpoints
        ALTER TABLE file_versions ADD COLUMN IF NOT EXISTS label VARCHAR(100);

        -- Expand room_files and file_versions file_name to VARCHAR(255) to support nested paths
        ALTER TABLE room_files ALTER COLUMN file_name TYPE VARCHAR(255);
        ALTER TABLE file_versions ALTER COLUMN file_name TYPE VARCHAR(255);

        CREATE INDEX IF NOT EXISTS idx_file_versions_lookup 
          ON file_versions(room_id, file_name, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_file_versions_author 
          ON file_versions(author_id);

        -- Virtual project folders table
        CREATE TABLE IF NOT EXISTS room_folders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id VARCHAR(64) NOT NULL,
          folder_path VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (room_id, folder_path)
        );

        CREATE INDEX IF NOT EXISTS idx_room_folders_room ON room_folders(room_id);

        -- Project activity logs table
        CREATE TABLE IF NOT EXISTS project_activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
          room_id VARCHAR(64) NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          user_name VARCHAR(100) NOT NULL,
          user_email VARCHAR(255),
          action_type VARCHAR(50) NOT NULL,
          target_name VARCHAR(255),
          details JSONB DEFAULT '{}',
          summary TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_activity_logs_room ON project_activity_logs(room_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON project_activity_logs(project_id, created_at DESC);
      `);
      dbConnected = true;
      console.log('✅ [PostgreSQL] Connected to Neon PostgreSQL database and verified tables (room_files, users, projects, project_members, project_invitations, file_versions, room_folders, project_activity_logs).');
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
  if (!id) return null;
  const cleanId = String(id).trim();
  const lowerId = cleanId.toLowerCase();

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

  if (dbConnected && pool) {
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

    // Migrate in-memory files
    for (const [key, content] of Array.from(inMemoryStore.entries())) {
      if (key.startsWith(`${oldRoomId}:`)) {
        const fileName = key.slice(oldRoomId.length + 1);
        inMemoryStore.set(`${targetRoomId}:${fileName}`, content);
        inMemoryStore.delete(key);
      }
    }

    // Migrate in-memory folders
    if (inMemoryFolders.has(oldRoomId)) {
      const folders = inMemoryFolders.get(oldRoomId);
      inMemoryFolders.set(targetRoomId, folders);
      inMemoryFolders.delete(oldRoomId);
    }

    // Migrate in-memory versions
    for (const [key, versions] of Array.from(inMemoryVersions.entries())) {
      if (key.startsWith(`${oldRoomId}:`)) {
        const fileName = key.slice(oldRoomId.length + 1);
        inMemoryVersions.set(`${targetRoomId}:${fileName}`, versions);
        inMemoryVersions.delete(key);
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
  if (dbConnected && pool) {
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
    inMemoryStore.delete(p.room_id || id);
    inMemoryFolders.delete(p.room_id || id);
    return { id, room_id: p.room_id || id };
  }
  return null;
}

// -------------------------------------------------------------
// VIRTUAL FILE & FOLDER OPERATIONS
// -------------------------------------------------------------

/**
 * Path utilities & validation
 */
export function normalizePath(rawPath) {
  if (typeof rawPath !== 'string') return '';
  let clean = rawPath.trim().replace(/\\/g, '/');
  clean = clean.replace(/^\/+|\/+$/g, '');
  clean = clean.replace(/\/+/g, '/');
  return clean;
}

export function isValidPathSegment(segment) {
  if (!segment || typeof segment !== 'string') return false;
  if (segment === '.' || segment === '..') return false;
  // Disallow control characters and invalid filesystem characters: \0 * ? " < > | :
  // eslint-disable-next-line no-control-regex
  if (/[\0*?"<>|:]/.test(segment)) return false;
  return true;
}

export function isValidPath(rawPath) {
  const normalized = normalizePath(rawPath);
  if (!normalized || normalized.length > 255) return false;
  const segments = normalized.split('/');
  return segments.every(isValidPathSegment);
}

export function isValidFilePath(rawPath) {
  return isValidPath(rawPath);
}

export function isValidFolderPath(rawPath) {
  return isValidPath(rawPath);
}

/**
 * Extracts all ancestor folder paths for a given normalized path.
 * e.g. "src/components/App.jsx" -> ["src", "src/components"]
 */
export function getParentFolderPaths(normalizedPath) {
  const parts = normalizedPath.split('/');
  const folders = [];
  let current = '';
  for (let i = 0; i < parts.length - 1; i++) {
    current = current ? `${current}/${parts[i]}` : parts[i];
    folders.push(current);
  }
  return folders;
}

/**
 * Retrieve entire workspace (files map and folders list) for a given room.
 * Seeds default starter files if the room is completely new.
 */
export async function getRoomWorkspace(roomId) {
  if (!roomId || typeof roomId !== 'string') {
    return { files: { ...STARTER_FILES }, folders: [] };
  }
  const cleanRoomId = roomId.trim();

  if (dbConnected && pool) {
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
      console.error(`[PostgreSQL] Error loading workspace for room "${cleanRoomId}":`, err.message);
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

  if (dbConnected && pool) {
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

  if (dbConnected && pool) {
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

  if (dbConnected && pool) {
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
  const oldKey = `${roomId}:${cleanOld}`;
  const newKey = `${roomId}:${cleanNew}`;
  if (inMemoryVersions.has(oldKey)) {
    const vers = inMemoryVersions.get(oldKey);
    vers.forEach((v) => (v.file_name = cleanNew));
    inMemoryVersions.set(newKey, vers);
    inMemoryVersions.delete(oldKey);
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

  if (dbConnected && pool) {
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

  if (dbConnected && pool) {
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

  if (dbConnected && pool) {
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
 * Compute SHA-256 content hash for integrity and duplicate prevention.
 */
export function computeContentHash(content) {
  return crypto.createHash('sha256').update(content || '', 'utf8').digest('hex');
}

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

  if (dbConnected && pool) {
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

  if (dbConnected && pool) {
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
  if (dbConnected && pool) {
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
  if (dbConnected && pool) {
    const upsertQuery = `
      INSERT INTO room_files (room_id, file_name, content, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (room_id, file_name)
      DO UPDATE SET content = EXCLUDED.content, updated_at = CURRENT_TIMESTAMP;
    `;
    await pool.query(upsertQuery, [roomId, fileName, content]);
  }

  // Update in-memory room_files cache
  if (!inMemoryStore.has(roomId)) {
    inMemoryStore.set(roomId, {});
  }
  inMemoryStore.get(roomId)[fileName] = content;

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

// Pending debounced database writes. Every caller receives the final result of
// the write, so the UI can show a real save confirmation rather than guessing.
const pendingSaves = new Map();

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

  if (!dbConnected || !pool) {
    createFileVersion({
      roomId,
      fileName,
      content,
      authorId,
      versionType: 'auto'
    }).catch(() => {});
    return Promise.reject(new Error('Database is not connected'));
  }

  // Debounce writes so rapid keystrokes do not flood PostgreSQL. All edits
  // made during the debounce window are confirmed together after the latest
  // version has been written successfully.
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
        pending.waiters.forEach(({ resolve }) => resolve());

        // Automatically record debounced version checkpoint (collapses within 2 minutes)
        createFileVersion({
          roomId: pending.roomId,
          fileName: pending.fileName,
          content: pending.content,
          authorId: pending.authorId || null,
          versionType: 'auto'
        }).catch((err) => {
          console.warn(`[Version History] Auto version creation skipped: ${err.message}`);
        });
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
  if (!resolvedProjectId && dbConnected && pool) {
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
  if (dbConnected && pool) {
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
      console.warn('[Activity Log] Failed to insert activity log to DB:', err.message);
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

  if (dbConnected && pool) {
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
      console.warn('[Activity Log] DB query error, falling back to memory:', err.message);
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

