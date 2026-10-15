import express from 'express';
import { register, login, logout, getMe, changePassword } from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', getMe);
router.put('/change-password', requireAuth, changePassword);

export default router;
