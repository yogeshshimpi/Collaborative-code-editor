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
const TEST_ROOM = `test-e2e-files-${Date.now()}`;

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`🧪 RUNNING REAL-TIME FILE & FOLDER MANAGEMENT E2E TESTS`);
  console.log(`Room: ${TEST_ROOM}`);
  console.log(`======================================================\n`);

  let clientA, clientB;
  try {
    // 1. Connect Client A (Editor/Owner)
    clientA = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true
    });

    const clientASyncPromise = new Promise((resolve) => {
      clientA.on('room-sync', (workspace) => {
        resolve(workspace);
      });
    });

    await new Promise((resolve) => clientA.on('connect', resolve));
    console.log('✅ Client A connected to Socket.IO server.');

    clientA.emit('join-room', {
      roomId: TEST_ROOM,
      user: { id: 'user-a', name: 'Alice Editor', color: '#6366f1' }
    });

    const initialWorkspace = await clientASyncPromise;
    console.log('✅ Initial workspace received by Client A:', {
      files: Object.keys(initialWorkspace.files || initialWorkspace),
      folders: initialWorkspace.folders
    });

    if (!initialWorkspace.files && !initialWorkspace['main.js']) {
      throw new Error('Initial starter files were not seeded in new room');
    }

    // 2. Connect Client B (Collaborator)
    clientB = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true
    });

    const clientBSyncPromise = new Promise((resolve) => {
      clientB.on('room-sync', resolve);
    });

    await new Promise((resolve) => clientB.on('connect', resolve));
    console.log('✅ Client B connected to Socket.IO server.');

    clientB.emit('join-room', {
      roomId: TEST_ROOM,
      user: { id: 'user-b', name: 'Bob Collaborator', color: '#10b981' }
    });

    await clientBSyncPromise;
    console.log('✅ Client B received room-sync.');

    // 3. Test File Creation with nested path
    console.log('\n--- Test 1: Nested File Creation ("src/components/App.jsx") ---');
    const fileCreatedPromise = new Promise((resolve) => {
      clientB.once('file-created', (data) => resolve(data));
    });

    clientA.emit('create-file', {
      roomId: TEST_ROOM,
      filePath: 'src/components/App.jsx',
      content: 'export default function App() { return <h1>Hello CodeCollab</h1>; }'
    });

    const createdEvent = await fileCreatedPromise;
    console.log('✅ Client B received "file-created" event live:', createdEvent);
    if (createdEvent.fileName !== 'src/components/App.jsx') {
      throw new Error(`Unexpected fileName in event: ${createdEvent.fileName}`);
    }

    // Verify in Neon DB
    const dbFileRes = await pool.query(
      'SELECT file_name, content FROM room_files WHERE room_id = $1 AND file_name = $2;',
      [TEST_ROOM, 'src/components/App.jsx']
    );
    if (dbFileRes.rows.length === 0) {
      throw new Error('File not found in Neon room_files table');
    }
    console.log('✅ File verified persisted in Neon PostgreSQL room_files table.');

    // Verify parent folders registered in Neon room_folders
    const dbFoldersRes = await pool.query(
      'SELECT folder_path FROM room_folders WHERE room_id = $1 ORDER BY folder_path ASC;',
      [TEST_ROOM]
    );
    const dbFolders = dbFoldersRes.rows.map((r) => r.folder_path);
    console.log('✅ Registered folders in Neon room_folders:', dbFolders);
    if (!dbFolders.includes('src') || !dbFolders.includes('src/components')) {
      throw new Error('Parent folders were not registered in room_folders');
    }

    // 4. Test Code Change in nested file
    console.log('\n--- Test 2: Live Code Sync in Nested File ---');
    const codeChangePromise = new Promise((resolve) => {
      clientB.once('code-change', (data) => resolve(data));
    });

    const updatedCode = 'export default function App() { return <h1>Hello Real-Time World</h1>; }';
    clientA.emit('code-change', {
      roomId: TEST_ROOM,
      fileName: 'src/components/App.jsx',
      content: updatedCode
    });

    const codeChangeEvent = await codeChangePromise;
    console.log('✅ Client B received live "code-change":', codeChangeEvent.fileName);
    if (codeChangeEvent.content !== updatedCode) {
      throw new Error('Code content mismatch in live sync');
    }

    // Wait for debounced write to Neon DB
    await new Promise((r) => setTimeout(r, 1200));
    const dbUpdatedFile = await pool.query(
      'SELECT content FROM room_files WHERE room_id = $1 AND file_name = $2;',
      [TEST_ROOM, 'src/components/App.jsx']
    );
    if (dbUpdatedFile.rows[0]?.content !== updatedCode) {
      throw new Error('Updated code content was not saved to Neon DB');
    }
    console.log('✅ Updated code debounced and verified persisted in Neon PostgreSQL.');

    // 5. Test Live Cursor in nested file
    console.log('\n--- Test 3: Live Cursor Tracking in Nested File ---');
    const cursorChangePromise = new Promise((resolve) => {
      clientB.once('cursor-change', (data) => resolve(data));
    });

    clientA.emit('cursor-change', {
      roomId: TEST_ROOM,
      fileName: 'src/components/App.jsx',
      cursor: { line: 5, column: 12 },
      selection: { startLineNumber: 5, startColumn: 1, endLineNumber: 5, endColumn: 12 }
    });

    const cursorEvent = await cursorChangePromise;
    console.log('✅ Client B received live "cursor-change":', {
      fileName: cursorEvent.fileName,
      cursor: cursorEvent.cursor
    });
    if (cursorEvent.fileName !== 'src/components/App.jsx' || cursorEvent.cursor?.line !== 5) {
      throw new Error('Cursor event failed in nested file');
    }

    // 6. Test Folder Renaming ("src" -> "source")
    console.log('\n--- Test 4: Folder Renaming ("src" -> "source") ---');
    const folderRenamedPromise = new Promise((resolve) => {
      clientB.once('folder-renamed', (data) => resolve(data));
    });

    clientA.emit('rename-folder', {
      roomId: TEST_ROOM,
      oldFolder: 'src',
      newFolder: 'source'
    });

    const renameFolderEvent = await folderRenamedPromise;
    console.log('✅ Client B received "folder-renamed" event:', renameFolderEvent);
    if (renameFolderEvent.newFolder !== 'source') {
      throw new Error('Folder rename event mismatch');
    }

    // Verify Neon DB updated
    const dbRenamedFiles = await pool.query(
      'SELECT file_name FROM room_files WHERE room_id = $1;',
      [TEST_ROOM]
    );
    const renamedFileNames = dbRenamedFiles.rows.map((r) => r.file_name);
    console.log('✅ Files in Neon DB after folder rename:', renamedFileNames);
    if (!renamedFileNames.includes('source/components/App.jsx')) {
      throw new Error('File path in Neon DB was not renamed when folder was renamed');
    }
    if (renamedFileNames.includes('src/components/App.jsx')) {
      throw new Error('Old file path still exists in Neon DB');
    }

    // 7. Test Explicit Folder Creation
    console.log('\n--- Test 5: Explicit Folder Creation ("public/assets") ---');
    const folderCreatedPromise = new Promise((resolve) => {
      clientB.once('folder-created', (data) => resolve(data));
    });

    clientA.emit('create-folder', {
      roomId: TEST_ROOM,
      folderPath: 'public/assets'
    });

    const folderCreatedEvent = await folderCreatedPromise;
    console.log('✅ Client B received "folder-created":', folderCreatedEvent);

    // 8. Test Moving an Item ("source/components/App.jsx" -> "source")
    console.log('\n--- Test 6: Move Item ("source/components/App.jsx" -> "source/App.jsx") ---');
    const itemMovedPromise = new Promise((resolve) => {
      clientB.once('file-renamed', (data) => resolve(data));
    });

    clientA.emit('move-item', {
      roomId: TEST_ROOM,
      itemType: 'file',
      oldPath: 'source/components/App.jsx',
      targetParentFolder: 'source'
    });

    const itemMovedEvent = await itemMovedPromise;
    console.log('✅ Client B received "file-renamed" for moved item:', itemMovedEvent);
    if (itemMovedEvent.newPath !== 'source/App.jsx') {
      throw new Error(`Expected newPath "source/App.jsx", got "${itemMovedEvent.newPath}"`);
    }

    // 9. Test File Deletion ("source/App.jsx")
    console.log('\n--- Test 7: File Deletion ("source/App.jsx") ---');
    const fileDeletedPromise = new Promise((resolve) => {
      clientB.once('file-deleted', (data) => resolve(data));
    });

    clientA.emit('delete-file', {
      roomId: TEST_ROOM,
      filePath: 'source/App.jsx'
    });

    const fileDeletedEvent = await fileDeletedPromise;
    console.log('✅ Client B received "file-deleted":', fileDeletedEvent);

    const dbAfterFileDelete = await pool.query(
      'SELECT file_name FROM room_files WHERE room_id = $1 AND file_name = $2;',
      [TEST_ROOM, 'source/App.jsx']
    );
    if (dbAfterFileDelete.rows.length !== 0) {
      throw new Error('File was not deleted from Neon DB');
    }
    console.log('✅ File verified deleted from Neon PostgreSQL room_files table.');

    // 10. Test Folder Deletion ("source")
    console.log('\n--- Test 8: Folder Deletion ("source") ---');
    const folderDeletedPromise = new Promise((resolve) => {
      clientB.once('folder-deleted', (data) => resolve(data));
    });

    clientA.emit('delete-folder', {
      roomId: TEST_ROOM,
      folderPath: 'source'
    });

    const folderDeletedEvent = await folderDeletedPromise;
    console.log('✅ Client B received "folder-deleted":', folderDeletedEvent);

    const dbAfterFolderDelete = await pool.query(
      'SELECT folder_path FROM room_folders WHERE room_id = $1 AND (folder_path = $2 OR folder_path LIKE $2 || \'%\');',
      [TEST_ROOM, 'source']
    );
    if (dbAfterFolderDelete.rows.length !== 0) {
      throw new Error('Folder was not deleted from Neon room_folders');
    }
    console.log('✅ Folder and subfolders verified deleted from Neon PostgreSQL.');

    console.log('\n======================================================');
    console.log('🎉 ALL 8 REAL-TIME FILE & FOLDER TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } finally {
    // Cleanup sockets
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();

    // Clean up test room data from Neon DB
    try {
      await pool.query('DELETE FROM room_files WHERE room_id = $1;', [TEST_ROOM]);
      await pool.query('DELETE FROM room_folders WHERE room_id = $1;', [TEST_ROOM]);
      await pool.query('DELETE FROM file_versions WHERE room_id = $1;', [TEST_ROOM]);
      console.log(`🧹 Test room "${TEST_ROOM}" cleaned up from Neon DB.`);
    } catch (err) {
      console.warn('Cleanup warning:', err.message);
    }
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
