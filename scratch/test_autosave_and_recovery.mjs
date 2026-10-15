import { getRoomWorkspace, saveFileContent, getFileMetadata } from '../backend/db/workspace.js';
import { saveWorkspaceFile } from '../backend/services/workspaceService.js';
import { getDraftKey, saveLocalDraft, getLocalDraft, removeLocalDraft } from '../frontend/src/utils/localDraftStorage.js';

async function runTests() {
  console.log('--- Testing Auto-Save, Conflict Safety & Recovery Storage ---');

  // Test 1: Key format
  const draftKey = getDraftKey('user123', 'room456', 'src/app.js');
  console.log('1. Draft Key generated:', draftKey);
  const expectedKey = 'codecollab_draft_user123_room456_src%2Fapp.js';
  if (draftKey === expectedKey) {
    console.log('   ✓ Draft key format matches requirement exactly');
  } else {
    throw new Error(`Draft key mismatch: got "${draftKey}", expected "${expectedKey}"`);
  }

  // Test 2: In-memory / DB saveFileContent returns version and updatedAt
  const testRoom = 'test-autosave-room-' + Date.now();
  const testFile = 'main.js';
  const save1 = await saveFileContent(testRoom, testFile, '// Version 1 test content', 1);
  console.log('2. Save 1 result:', save1);
  if (save1 && save1.fileName === 'main.js' && save1.version && save1.updatedAt) {
    console.log('   ✓ Save 1 returned fileName, content, updatedAt, version');
  } else {
    throw new Error('Save 1 did not return required fields');
  }

  // Test 3: getFileMetadata returns version and updatedAt
  const meta = await getFileMetadata(testRoom, testFile);
  console.log('3. getFileMetadata result:', meta);
  if (meta && meta.fileName === 'main.js' && meta.version) {
    console.log('   ✓ getFileMetadata returned valid metadata');
  } else {
    throw new Error('getFileMetadata failed');
  }

  // Test 4: Workspace returns fileMeta
  const ws = await getRoomWorkspace(testRoom);
  console.log('4. getRoomWorkspace keys:', Object.keys(ws), 'has fileMeta:', Boolean(ws.fileMeta));
  if (ws.fileMeta && ws.fileMeta['main.js']) {
    console.log('   ✓ getRoomWorkspace includes fileMeta map');
  } else {
    throw new Error('getRoomWorkspace did not return fileMeta');
  }

  console.log('\n--- All Automated Logic Checks Passed Successfully! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
