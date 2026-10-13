import express from 'express';
import { isDbConnected } from '../db/index.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CodeCollab Backend',
    database: isDbConnected() ? 'connected' : 'in-memory-fallback',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

export default router;
