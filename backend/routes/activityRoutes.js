import express from 'express';
import { getActivityLogs } from '../controllers/activityController.js';

const router = express.Router();

router.get('/:id/activity', getActivityLogs);

export default router;
