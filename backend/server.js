import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { PORT } from './config/env.js';
import { corsOptions, allowedOriginsSet } from './config/cors.js';
import { configureSocketIO } from './config/socket.js';
import { initDatabase } from './db/index.js';
import { registerSocketHandlers } from './socket/registerSocketHandlers.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import workspaceRoutes, { getLegacyRoom } from './routes/workspaceRoutes.js';
import versionRoutes from './routes/versionRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import executionRoutes from './routes/executionRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

const app = express();
const server = http.createServer(app);

// Initialize PostgreSQL database schema
initDatabase();

// Global middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.json());

// Setup Socket.IO
const io = configureSocketIO(server);
app.set('io', io);
registerSocketHandlers(io);

// Mount API routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', workspaceRoutes);
app.use('/api/projects', versionRoutes);
app.use('/api/projects', activityRoutes);
app.use('/api/projects', chatRoutes);
app.use('/api/projects', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/execute', executionRoutes);
app.get('/api/rooms/:roomId', getLegacyRoom);

// Global error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 CodeCollab Backend running on http://localhost:${PORT}`);
  logger.info(`📡 Socket.IO listening with CORS allowed for: ${Array.from(allowedOriginsSet).join(', ')}`);
});

export { app, server, io };
export default app;
