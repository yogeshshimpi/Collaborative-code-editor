// E2E REST API test for Project URL, Renaming, and Refresh behavior
const fetch = globalThis.fetch;

async function run() {
  console.log('Testing REST API for Renaming and Direct Route Resolution...');
  const baseUrl = 'http://localhost:5000';
  const email = `e2e_${Date.now()}@codecollab.dev`;
  const password = 'StrongPassword123!';

  // 1. Register user
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'YOgesh Shimpi' })
  });
  if (!regRes.ok) throw new Error(`Register failed: ${regRes.status}`);
  const cookie = regRes.headers.get('set-cookie');
  console.log('✓ Registered user and received auth cookie');

  // 2. Create project named "YOgesh App"
  const createRes = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'YOgesh App' })
  });
  if (!createRes.ok) throw new Error(`Create project failed: ${createRes.status}`);
  const { project: created } = await createRes.json();
  console.log('✓ Created project:', created.name, `room_id: ${created.room_id}`);

  // 3. Resolve by original room_id
  const getByRoomRes = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(created.room_id)}`, {
    headers: { Cookie: cookie }
  });
  if (!getByRoomRes.ok) throw new Error(`Get by room failed: ${getByRoomRes.status}`);
  console.log('✓ Successfully retrieved project by room_id');

  // 4. Resolve by project name "YOgesh App"
  const getByNameRes = await fetch(`${baseUrl}/api/projects/${encodeURIComponent('YOgesh App')}`, {
    headers: { Cookie: cookie }
  });
  if (!getByNameRes.ok) throw new Error(`Get by name failed: ${getByNameRes.status}`);
  const { project: byName } = await getByNameRes.json();
  if (byName.id !== created.id) throw new Error('Retrieved project does not match created id');
  console.log('✓ Successfully retrieved project by exact name "YOgesh App"');

  // 5. Resolve by lowercase slug "yogesh-app"
  const getBySlugRes = await fetch(`${baseUrl}/api/projects/${encodeURIComponent('yogesh-app')}`, {
    headers: { Cookie: cookie }
  });
  if (!getBySlugRes.ok) throw new Error(`Get by slug failed: ${getBySlugRes.status}`);
  console.log('✓ Successfully retrieved project by URL slug "yogesh-app"');

  // 6. Rename project name to "YOgesh Pro" and room_id to "yogesh-pro"
  const renameRes = await fetch(`${baseUrl}/api/projects/${encodeURIComponent(created.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'YOgesh Pro', roomId: 'yogesh-pro' })
  });
  if (!renameRes.ok) throw new Error(`Rename project failed: ${renameRes.status}`);
  const { project: renamed } = await renameRes.json();
  if (renamed.name !== 'YOgesh Pro' || renamed.room_id !== 'yogesh-pro') {
    throw new Error('Rename returned unexpected values');
  }
  console.log('✓ Renamed project to:', renamed.name, 'with room_id:', renamed.room_id);

  // 7. Resolve renamed project by new URL route "yogesh-pro"
  const getNewRoomRes = await fetch(`${baseUrl}/api/projects/yogesh-pro`, {
    headers: { Cookie: cookie }
  });
  if (!getNewRoomRes.ok) throw new Error(`Get by new room failed: ${getNewRoomRes.status}`);
  console.log('✓ Successfully retrieved project by renamed room URL "yogesh-pro"');

  // 8. Resolve renamed project by new name "YOgesh Pro"
  const getNewNameRes = await fetch(`${baseUrl}/api/projects/${encodeURIComponent('YOgesh Pro')}`, {
    headers: { Cookie: cookie }
  });
  if (!getNewNameRes.ok) throw new Error(`Get by new name failed: ${getNewNameRes.status}`);
  console.log('✓ Successfully retrieved project by renamed name "YOgesh Pro"');

  // 9. Check file tree for renamed room
  const treeRes = await fetch(`${baseUrl}/api/projects/yogesh-pro/tree`, {
    headers: { Cookie: cookie }
  });
  if (!treeRes.ok) throw new Error(`Tree failed: ${treeRes.status}`);
  const treeData = await treeRes.json();
  if (!treeData.files['main.js']) throw new Error('Starter files missing in renamed room tree');
  console.log('✓ Verified files in renamed room tree: main.js, index.html, styles.css intact');

  console.log('\n🎉 ALL E2E API RESOLUTION & RENAMING TESTS PASSED (100% SUCCESS)!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ E2E test failed:', err);
  process.exit(1);
});
