import express from 'express';
import { executeCode, getLanguages } from '../controllers/executionController.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import { executionLimiter } from '../middleware/rateLimiters.js';

const router = express.Router();

// Get list of supported execution languages
router.get('/languages', getLanguages);

// Global execute endpoint
router.post('/run', executionLimiter, optionalAuth, executeCode);
router.post('/', executionLimiter, optionalAuth, executeCode);

// Project-scoped execution endpoint
router.post('/projects/:id/run', executionLimiter, optionalAuth, executeCode);

export default router;
