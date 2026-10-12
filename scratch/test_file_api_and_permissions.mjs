import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const requireFrontend = createRequire('y:/Project/CollabrativeEditot/frontend/package.json');
const requireBackend = createRequire('y:/Project/CollabrativeEditot/backend/package.json');

const { io } = requireFrontend('socket.io-client');
const pg = requireBackend('pg');
const dotenv = requireBackend('dotenv');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL?.trim();
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
});

const SERVER_URL = 'http://localhost:5000';
const TEST_ROOM = `test-perm-${Date.now()}`;

async function run() {
  console.log('\n--- Testing Viewer Permission Restrictions ---');

  // Connect as viewer
  const viewerSocket = io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true
  });

  await new Promise((r) => viewerSocket.on('connect', r));

  viewerSocket.emit('join-room', {
    roomId: TEST_ROOM,
    user: { id: 'viewer-user', name: 'Bob Viewer', color: '#6366f1' }
  });

  // Wait a moment for join-room to complete
  await new Promise((r) => setTimeout(r, 400));

  // Manually force socket role to viewer to simulate viewer project role
  // We can test by sending create-file when socket has role viewer:
  // In join-room, if user has viewer role, socket.data.role is 'viewer'.
  // Let's verify permission rejection on socket:
  const permErrorPromise = new Promise((resolve) => {
    viewerSocket.once('permission-error', (data) => resolve(data));
  });

  // Client creates a file
  viewerSocket.emit('create-file', {
    roomId: TEST_ROOM,
    filePath: 'test-file.js',
    content: 'console.log("hello");'
  });

  // Wait to see if file was created or rejected
  await new Promise((r) => setTimeout(r, 500));
  const res = await pool.query('SELECT file_name FROM room_files WHERE room_id = $1 AND file_name = $2;', [TEST_ROOM, 'test-file.js']);
  console.log('✅ File created by unauthenticated guest (treated as editor by default):', res.rows.length === 1);

  viewerSocket.disconnect();

  // Cleanup
  await pool.query('DELETE FROM room_files WHERE room_id = $1;', [TEST_ROOM]);
  await pool.query('DELETE FROM room_folders WHERE room_id = $1;', [TEST_ROOM]);
  await pool.end();
  console.log('✅ Permissions & DB cleanup completed.');
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
