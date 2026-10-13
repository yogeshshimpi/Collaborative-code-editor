import express from 'express';
import {
  getTree,
  getFiles,
  createFile,
  createFolder,
  renameFile,
  renameFolder,
  deleteFile,
  deleteFolder,
  moveItem,
  getLegacyRoom
} from '../controllers/workspaceController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:roomId/tree', requireAuth, getTree);
router.get('/:roomId/files', requireAuth, getFiles);
router.post('/:roomId/files', requireAuth, createFile);
router.post('/:roomId/folders', requireAuth, createFolder);
router.put('/:roomId/files/rename', requireAuth, renameFile);
router.put('/:roomId/folders/rename', requireAuth, renameFolder);
router.delete('/:roomId/files', requireAuth, deleteFile);
router.delete('/:roomId/folders', requireAuth, deleteFolder);
router.put('/:roomId/move', requireAuth, moveItem);

export { getLegacyRoom };
export default router;
