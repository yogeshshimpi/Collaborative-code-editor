import pg from 'pg';
import { DATABASE_URL } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

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

if (DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    pool.on('error', (err) => {
      logger.error('[PostgreSQL Error] Unexpected client error:', err.message);
    });
  } catch (err) {
    logger.warn('[PostgreSQL] Failed to initialize connection pool:', err.message);
  }
} else {
  logger.info('[Database] DATABASE_URL not set. Operating in in-memory session mode.');
}

export function isDbConnected() {
  return dbConnected && pool !== null;
}

export function setDbConnected(status) {
  dbConnected = status;
}

/**
 * Initialize Database schema:
 * - room_files: persists code for all rooms
 * - users: user accounts
 * - projects: user-owned projects linked to rooms
 * - project_members: team access control
 * - project_invitations: email invitations
 * - file_versions: version history checkpoints
 * - room_folders: directory tree persistence
 * - project_activity_logs: team activity tracking
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
          requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
          protected_files JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Ensure owner_id, requires_approval, and protected_files columns exist if table was pre-existing
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE projects ADD COLUMN IF NOT EXISTS protected_files JSONB NOT NULL DEFAULT '[]'::jsonb;

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

        -- Owner approval workflow: change requests table
        CREATE TABLE IF NOT EXISTS project_change_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          room_id VARCHAR(64) NOT NULL,
          author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          author_name VARCHAR(100) NOT NULL,
          author_email VARCHAR(255),
          request_type VARCHAR(30) NOT NULL
            CHECK (request_type IN (
              'code_change',
              'file_create',
              'file_rename',
              'file_delete',
              'folder_create',
              'folder_rename',
              'folder_delete',
              'version_restore'
            )),
          target_path VARCHAR(255) NOT NULL,
          old_path VARCHAR(255),
          proposed_content TEXT,
          original_content TEXT,
          title VARCHAR(150) NOT NULL,
          description TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'approved', 'rejected')),
          reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reviewed_at TIMESTAMPTZ,
          rejection_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
        CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(LOWER(invited_email));
        CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON project_invitations(project_id);
        CREATE INDEX IF NOT EXISTS idx_change_requests_project ON project_change_requests(project_id, status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_change_requests_room ON project_change_requests(room_id, status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_change_requests_author ON project_change_requests(author_id);

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
      logger.info('Connected to Neon PostgreSQL database and verified tables.');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    dbConnected = false;
    logger.warn('Database connection failed. Falling back to in-memory mode:', err.message);
    return false;
  }
}

export default {
  pool,
  isDbConnected,
  setDbConnected,
  initDatabase,
  STARTER_FILES
};
