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

// In-memory fallback if DATABASE_URL is not set or connection fails
const inMemoryStore = new Map();

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
 * Initialize Database schema (creates room_files table if not present)
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
      `);
      dbConnected = true;
      console.log('✅ [PostgreSQL] Connected to Neon PostgreSQL database and verified tables.');
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
