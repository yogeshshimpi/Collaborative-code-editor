import express from 'express';
import {
  getVersions,
  getVersion,
  createVersion,
  restoreVersion
} from '../controllers/versionController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

// Supports standard and deeply-nested file paths (e.g. src/components/App.jsx)
router.get(['/:roomId/files/:fileName/versions', /^\/([^/]+)\/files\/(.+)\/versions$/], getVersions);
router.get(['/:roomId/files/:fileName/versions/:versionId', /^\/([^/]+)\/files\/(.+)\/versions\/([^/]+)$/], getVersion);
router.post(['/:roomId/files/:fileName/versions', /^\/([^/]+)\/files\/(.+)\/versions$/], createVersion);
router.post(['/:roomId/files/:fileName/versions/:versionId/restore', /^\/([^/]+)\/files\/(.+)\/versions\/([^/]+)\/restore$/], restoreVersion);

export default router;
