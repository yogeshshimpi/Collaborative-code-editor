// Comprehensive test for CodeCollab Project URL, Room Renaming, Refresh & Route Loading
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const requireBackend = createRequire('y:/Project/CollabrativeEditot/backend/package.json');
const dotenv = requireBackend('dotenv');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const {
  initDatabase,
  createUser,
  createProject,
  getProjectById,
  updateProject,
  getRoomWorkspace,
  createFileInRoom,
  createFileVersion,
  getFileVersions
} = await import('../backend/db.js');

async function runTests() {
  console.log('--- Testing Project Routing, Room Renaming, & Route Loading ---');
  await initDatabase();

  const testEmail = `tester_${Date.now()}@codecollab.dev`;
  const user = await createUser({
    email: testEmail,
    passwordHash: 'hashed_pw_test',
    name: 'Test Developer'
  });
  console.log('✓ Created test user:', user.email, `(id: ${user.id})`);

  // 1. Create a project
  const initialRoomId = `room-${Date.now().toString(36)}`;
  const initialName = 'YOgesh Project';
  const created = await createProject({
    id: initialRoomId,
    name: initialName,
    ownerId: user.id
  });
  console.log('✓ Created project:', created.name, `room_id: ${created.room_id}`, `id: ${created.id}`);

  // Add a test file and version
  await createFileInRoom({
    roomId: initialRoomId,
    filePath: 'main.js',
    content: 'console.log("Original code");',
    authorId: user.id
  });
  await createFileVersion({
    roomId: initialRoomId,
    fileName: 'main.js',
    content: 'console.log("Original code snapshot");',
    authorId: user.id,
    versionType: 'manual',
    label: 'Initial checkpoint'
  });
  console.log('✓ Created test file and version under room:', initialRoomId);

  // 2. Test lookup by exact room_id
  const byRoomId = await getProjectById(initialRoomId, user.id);
  if (!byRoomId || byRoomId.id !== created.id) {
    throw new Error(`Failed to lookup by room_id: ${initialRoomId}`);
  }
  console.log('✓ Looked up by exact room_id successfully');

  // 3. Test lookup by exact UUID id
  const byId = await getProjectById(created.id, user.id);
  if (!byId || byId.id !== created.id) {
    throw new Error(`Failed to lookup by UUID: ${created.id}`);
  }
  console.log('✓ Looked up by UUID successfully');

  // 4. Test lookup by exact name "YOgesh Project"
  const byName = await getProjectById(initialName, user.id);
  if (!byName || byName.id !== created.id) {
    throw new Error(`Failed to lookup by exact name: "${initialName}"`);
  }
  console.log('✓ Looked up by exact name successfully');

  // 5. Test lookup by lowercase name "yogesh project"
  const byLowerName = await getProjectById('yogesh project', user.id);
  if (!byLowerName || byLowerName.id !== created.id) {
    throw new Error(`Failed to lookup by lowercase name: "yogesh project"`);
  }
  console.log('✓ Looked up by lowercase name successfully');

  // 6. Test lookup by slug "yogesh-project"
  const bySlug = await getProjectById('yogesh-project', user.id);
  if (!bySlug || bySlug.id !== created.id) {
    throw new Error(`Failed to lookup by slug: "yogesh-project"`);
  }
  console.log('✓ Looked up by slugified name successfully');

  // 7. Test Renaming both Name and Room ID atomically
  const newName = 'YOgesh Modern App';
  const newRoomId = `yogesh-app-${Date.now().toString(36)}`;
  const updated = await updateProject(created.id, { name: newName, roomId: newRoomId }, user.id);
  if (!updated || updated.name !== newName || updated.room_id !== newRoomId) {
    throw new Error('Failed to update project name and room ID');
  }
  console.log('✓ Renamed project to:', updated.name, 'and room_id to:', updated.room_id);

  // 8. Verify files migrated to new room_id
  const newWorkspace = await getRoomWorkspace(newRoomId);
  if (!newWorkspace.files['main.js'] || !newWorkspace.files['main.js'].includes('Original code')) {
    throw new Error(`Files did not migrate to new room_id: ${newRoomId}`);
  }
  console.log('✓ Verified files migrated to new room_id');

  // 9. Verify versions migrated to new room_id
  const newVersions = await getFileVersions(newRoomId, 'main.js');
  if (newVersions.length === 0 || !newVersions[0].label.includes('checkpoint')) {
    throw new Error(`Versions did not migrate to new room_id: ${newRoomId}`);
  }
  console.log('✓ Verified file versions migrated to new room_id');

  // 10. Verify lookup by new name and new slug
  const byNewName = await getProjectById(newName, user.id);
  if (!byNewName || byNewName.id !== created.id) {
    throw new Error(`Failed to lookup by new name: "${newName}"`);
  }
  const byNewSlug = await getProjectById('yogesh-modern-app', user.id);
  if (!byNewSlug || byNewSlug.id !== created.id) {
    throw new Error(`Failed to lookup by new slug: "yogesh-modern-app"`);
  }
  console.log('✓ Looked up by new name and new slug successfully');

  console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY! 100% SUCCESS.');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
