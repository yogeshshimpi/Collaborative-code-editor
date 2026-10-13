import express from 'express';
import { getUserInvitations, respondInvitation } from '../controllers/invitationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getUserInvitations);
router.post('/:id/respond', respondInvitation);

export default router;
