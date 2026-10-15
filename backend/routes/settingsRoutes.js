import express from 'express';
import {
  getSettings,
  updateProfile,
  updateTheme,
  updateEditor,
  updateCollaboration,
  updateNotifications,
  deleteAccount
} from '../controllers/settingsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getSettings);
router.put('/profile', updateProfile);
router.put('/theme', updateTheme);
router.put('/editor', updateEditor);
router.put('/collaboration', updateCollaboration);
router.put('/notifications', updateNotifications);
router.delete('/account', deleteAccount);

export default router;
