import express from 'express';
import { register, login, logout, getMe } from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', getMe);

export default router;
