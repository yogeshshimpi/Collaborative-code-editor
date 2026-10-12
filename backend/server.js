import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { parseCookie } from 'cookie';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import {
  initDatabase,
  getRoomFiles,
  saveFileContent,
  isDbConnected,
  createUser,
  findUserByEmail,
  findUserById,
  createProject,
  getUserProjects,
  getProjectById,
  getProjectRole,
  getProjectMembers,
  getProjectInvitations,
  createProjectInvitation,
  revokeProjectInvitation,
  updateProjectMemberRole,
  removeProjectMember,
  getUserPendingInvitations,
  respondToInvitation,
  updateProjectName,
  deleteProject
} from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_codecollab_secure_jwt_token_2026_local';
const isProduction = process.env.NODE_ENV === 'production';

// Initialize PostgreSQL database schema
initDatabase();

// Security headers with Helmet (allow cross-origin workers for Monaco)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Cookie parser for HTTP sessions
app.use(cookieParser());

// CORS configuration for local development and Render production
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// Cookie configuration: HttpOnly, secure in prod, sameSite: none for cross-site Render deployments
const COOKIE_NAME = 'codecollab_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/'
};

// Rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 auth requests per window
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Helper: Sign JWT
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Helper: Verify JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Middleware: Require Authenticated User
async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  const user = await findUserById(decoded.id);
  if (!user) {
    return res.status(401).json({ error: 'User account not found.' });
  }

  req.user = user;
  next();
}

// =============================================================
// AUTHENTICATION ROUTES
// =============================================================

// Register new user
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    // Validate password (min 6 characters)
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please provide a name with at least 2 characters.' });
    }

    // Check if user already exists
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Save to database
    const user = await createUser({
      email: email.trim(),
      passwordHash,
      name: name.trim()
    });

    // Sign JWT and set secure HttpOnly cookie
    const token = generateToken(user);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    console.error('[Auth Error] Registration failed:', err);
    res.status(500).json({ error: 'Registration failed due to a server error.' });
  }
});

// Log in user
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Check user exists
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Sign JWT and set secure HttpOnly cookie
    const token = generateToken(user);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    console.error('[Auth Error] Login failed:', err);
    res.status(500).json({ error: 'Login failed due to a server error.' });
  }
});

// Log out user
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
  res.json({ message: 'Logged out successfully.' });
});

// Current user session check
app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return res.json({ user: null });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.clearCookie(COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
    return res.json({ user: null });
  }

  try {
    const user = await findUserById(decoded.id);
    if (!user) {
      res.clearCookie(COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
      return res.json({ user: null });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    console.error('[Auth Error] Session check failed:', err);
    res.json({ user: null });
  }
});

// =============================================================
// PROJECT OWNERSHIP ROUTES (AUTHENTICATED)
// =============================================================

// List owned projects
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const projects = await getUserProjects(req.user.id);
    res.json({ projects });
  } catch (err) {
    console.error('[Projects Error] Failed to list projects:', err);
    res.status(500).json({ error: 'Failed to retrieve projects.' });
  }
});

// Create a new owned project
app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const { name, roomId } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    // Use provided roomId or generate a clean project slug
    const targetRoomId = (roomId && typeof roomId === 'string' && roomId.trim())
      ? roomId.trim().slice(0, 64)
      : `project-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const project = await createProject({
      id: targetRoomId,
      name: name.trim().slice(0, 100),
      ownerId: req.user.id
    });

    // Ensure default starter files exist for this project room
    await getRoomFiles(targetRoomId);

    res.status(201).json({ project });
  } catch (err) {
    console.error('[Projects Error] Failed to create project:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// Get single project details with user role
app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const project = await getProjectById(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ project });
  } catch (err) {
    console.error('[Projects Error] Failed to get project:', err);
    res.status(500).json({ error: 'Failed to retrieve project details.' });
  }
});

// Rename project (Owner only)
app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const updated = await updateProjectName(req.params.id, name.trim(), req.user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Project not found or not owned by you.' });
    }

    res.json({ project: updated });
  } catch (err) {
    console.error('[Projects Error] Failed to rename project:', err);
    res.status(500).json({ error: 'Failed to rename project.' });
  }
});

// Delete project (Owner only)
app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await deleteProject(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Project not found or not owned by you.' });
    }

    res.json({ message: 'Project deleted successfully.', id: req.params.id });
  } catch (err) {
    console.error('[Projects Error] Failed to delete project:', err);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// -------------------------------------------------------------
// COLLABORATOR & INVITATION ROUTES
// -------------------------------------------------------------

// List project collaborators and pending invitations
app.get('/api/projects/:id/members', requireAuth, async (req, res) => {
  try {
    const project = await getProjectById(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    if (!project.role) {
      return res.status(403).json({ error: 'You do not have access to this project.' });
    }

    const members = await getProjectMembers(project.id);
    const invitations = project.role === 'owner' ? await getProjectInvitations(project.id) : [];

    res.json({
      owner: { id: project.owner_id, name: project.owner_name, email: project.owner_email },
      members,
      invitations,
      userRole: project.role
    });
  } catch (err) {
    console.error('[Members Error] Failed to load members:', err);
    res.status(500).json({ error: 'Failed to load project members.' });
  }
});

// Send invitation to an already-registered user by email (Owner only)
app.post('/api/projects/:id/invitations', requireAuth, async (req, res) => {
  try {
    const { email, role = 'editor' } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either editor or viewer.' });
    }

    const project = await getProjectById(req.params.id, req.user.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    if (project.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the project owner can invite collaborators.' });
    }

    const invitation = await createProjectInvitation({
      projectId: project.id,
      invitedById: req.user.id,
      invitedEmail: email.trim(),
      role
    });

    res.status(201).json({ invitation });
  } catch (err) {
    console.error('[Invitations Error] Failed to invite collaborator:', err.message);
    const statusCode = err.status || 400;
    res.status(statusCode).json({ error: err.message || 'Failed to send invitation.' });
  }
});

// Revoke a pending invitation (Owner only)
app.delete('/api/projects/:id/invitations/:invitationId', requireAuth, async (req, res) => {
  try {
    const project = await getProjectById(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    if (project.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the project owner can revoke invitations.' });
    }

    const revoked = await revokeProjectInvitation(req.params.invitationId, project.id);
    if (!revoked) {
      return res.status(404).json({ error: 'Invitation not found or already processed.' });
    }
    res.json({ message: 'Invitation revoked successfully.', invitationId: req.params.invitationId });
  } catch (err) {
    console.error('[Invitations Error] Failed to revoke invitation:', err);
    res.status(500).json({ error: 'Failed to revoke invitation.' });
  }
});

// Update member role (Owner only)
app.put('/api/projects/:id/members/:userId', requireAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either editor or viewer.' });
    }

    const project = await getProjectById(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    if (project.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the project owner can change member roles.' });
    }

    const targetUserId = parseInt(req.params.userId, 10);
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot modify the owner role.' });
    }

    const updated = await updateProjectMemberRole(project.id, targetUserId, role);
    if (!updated) {
      return res.status(404).json({ error: 'Project member not found.' });
    }
    res.json({ member: updated });
  } catch (err) {
    console.error('[Members Error] Failed to update role:', err);
    res.status(500).json({ error: 'Failed to update member role.' });
  }
});

// Remove a collaborator or leave project
app.delete('/api/projects/:id/members/:userId', requireAuth, async (req, res) => {
  try {
    const project = await getProjectById(req.params.id, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const targetUserId = parseInt(req.params.userId, 10);
    const isOwner = project.owner_id === req.user.id;
    const isSelf = targetUserId === req.user.id;

    if (!isOwner && !isSelf) {
      return res.status(403).json({ error: 'You do not have permission to remove this member.' });
    }
    if (targetUserId === project.owner_id) {
      return res.status(400).json({ error: 'Project owner cannot be removed.' });
    }

    const removed = await removeProjectMember(project.id, targetUserId);
    if (!removed) {
      return res.status(404).json({ error: 'Project member not found.' });
    }
    res.json({ message: isSelf ? 'You have left the project.' : 'Member removed successfully.', userId: targetUserId });
  } catch (err) {
    console.error('[Members Error] Failed to remove member:', err);
    res.status(500).json({ error: 'Failed to remove project member.' });
  }
});

// Incoming pending invitations for the logged-in user
app.get('/api/invitations', requireAuth, async (req, res) => {
  try {
    const invitations = await getUserPendingInvitations(req.user.email);
    res.json({ invitations });
  } catch (err) {
    console.error('[Invitations Error] Failed to fetch user invitations:', err);
    res.status(500).json({ error: 'Failed to load invitations.' });
  }
});

// Respond to an invitation (accept or decline)
app.post('/api/invitations/:id/respond', requireAuth, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Action must be either accept or decline.' });
    }

    const result = await respondToInvitation(req.params.id, req.user.email, req.user.id, action);
    res.json(result);
  } catch (err) {
    console.error('[Invitations Error] Failed to respond to invitation:', err.message);
    res.status(400).json({ error: err.message || 'Failed to process invitation.' });
  }
});

// =============================================================
// HEALTH & EXISTING ROOM API
// =============================================================

// Health check endpoint (reports service and database status)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CodeCollab Backend',
    database: isDbConnected() ? 'connected' : 'in-memory-fallback',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// REST endpoint to get room files
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const files = await getRoomFiles(roomId);
    res.json({ roomId, files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch room files' });
  }
});

// =============================================================
// SOCKET.IO REAL-TIME COLLABORATION
// =============================================================

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO middleware to detect authenticated session cookie
io.use((socket, next) => {
  try {
    const cookieHeader = socket.request.headers.cookie;
    if (cookieHeader) {
      const parsed = parseCookie(cookieHeader);
      const token = parsed[COOKIE_NAME];
      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          socket.data.authenticatedUser = decoded;
        }
      }
    }
  } catch {
    // Non-blocking for anonymous guests
  }
  next();
});

// Supported files for validation
const ALLOWED_FILES = new Set(['main.js', 'index.html', 'styles.css']);

// Temporary in-memory collaborator presence per room
// Map<roomId, Map<socketId, { id, name, color, socketId }>>
const roomUsers = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Handle joining a room with user presence details
  socket.on('join-room', async (payload) => {
    const rawRoomId = typeof payload === 'object' && payload !== null ? payload.roomId : payload;
    const rawUser = typeof payload === 'object' && payload !== null ? payload.user : null;

    // Validation: room ID must be a non-empty short string
    if (typeof rawRoomId !== 'string' || !rawRoomId.trim() || rawRoomId.trim().length > 64) {
      console.warn(`[Invalid Room ID] Socket ${socket.id} attempted to join with:`, rawRoomId);
      return;
    }

    const roomId = rawRoomId.trim();
    socket.join(roomId);
    socket.data.currentRoom = roomId;

    // Determine user identity: Use authenticated user if session cookie is present, else guest identity
    const authUser = socket.data.authenticatedUser;
    const initialActiveFile = typeof rawUser?.activeFile === 'string' && ALLOWED_FILES.has(rawUser.activeFile) ? rawUser.activeFile : 'main.js';
    const sanitizedUser = authUser
      ? {
          id: `auth-${authUser.id}`,
          name: authUser.name,
          color: rawUser?.color || '#6366f1',
          isAuthenticated: true,
          socketId: socket.id,
          activeFile: initialActiveFile
        }
      : {
          id: typeof rawUser?.id === 'string' && rawUser.id.trim() ? rawUser.id.trim().slice(0, 64) : socket.id,
          name: typeof rawUser?.name === 'string' && rawUser.name.trim() ? rawUser.name.trim().slice(0, 32) : `Guest ${Math.floor(1000 + Math.random() * 9000)}`,
          color: typeof rawUser?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawUser.color) ? rawUser.color : '#6366f1',
          isAuthenticated: false,
          socketId: socket.id,
          activeFile: initialActiveFile
        };

    // Determine project access and user role
    let userRole = 'editor';
    if (authUser) {
      try {
        const projectRole = await getProjectRole(roomId, authUser.id);
        if (projectRole) {
          userRole = projectRole;
        }
      } catch (err) {
        console.warn(`[Role Check Error] Could not retrieve role for ${authUser.id}:`, err.message);
      }
    }
    socket.data.role = userRole;
    sanitizedUser.role = userRole;

    socket.data.currentUser = sanitizedUser;

    // Send user their role in this workspace
    socket.emit('user-role', { role: userRole });

    // Track user presence in this room
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Map());
    }
    const usersInRoom = roomUsers.get(roomId);
    usersInRoom.set(socket.id, sanitizedUser);

    // Retrieve persisted room files from PostgreSQL (or in-memory cache)
    const roomFiles = await getRoomFiles(roomId);
    socket.emit('room-sync', roomFiles);

    // Broadcast updated presence list & count to everyone in the room
    const currentUsers = Array.from(usersInRoom.values());
    io.to(roomId).emit('room-users', { users: currentUsers });
    io.to(roomId).emit('room-participants', { count: currentUsers.length });

    console.log(`[Room: ${roomId}] ${sanitizedUser.name} (${socket.id}) joined as ${userRole}. Total online: ${currentUsers.length}`);
  });

  // Handle real-time code changes
  socket.on('code-change', (data) => {
    if (!data || typeof data !== 'object') {
      return;
    }

    // Role check: viewers cannot edit code or broadcast changes
    if (socket.data.role === 'viewer') {
      console.warn(`[Permission Denied] Socket ${socket.id} is a viewer and attempted to edit code.`);
      socket.emit('permission-error', { error: 'You have read-only (viewer) access to this project and cannot edit code.' });
      return;
    }

    const { roomId, fileName, content } = data;

    // Validation
    if (
      typeof roomId !== 'string' ||
      !roomId.trim() ||
      roomId.trim().length > 64 ||
      !ALLOWED_FILES.has(fileName) ||
      typeof content !== 'string'
    ) {
      console.warn(`[Rejected Invalid code-change] Socket ${socket.id}`, { roomId, fileName, contentType: typeof content });
      return;
    }

    const cleanRoomId = roomId.trim();

    // Broadcast update to all other sockets in the room (instant live sync)
    socket.to(cleanRoomId).emit('code-change', {
      fileName,
      content
    });

    // Notify editing browser of save status
    socket.emit('save-status', { status: 'saving', fileName });
    saveFileContent(cleanRoomId, fileName, content)
      .then(() => {
        socket.emit('save-status', {
          status: 'saved',
          fileName,
          savedAt: new Date().toISOString()
        });
      })
      .catch(() => {
        socket.emit('save-status', { status: 'error', fileName });
      });
  });

  // Handle live collaborator cursor and selection changes
  socket.on('cursor-change', (data) => {
    if (!data || typeof data !== 'object') {
      return;
    }

    const { roomId, fileName, cursor, selection } = data;

    // Validate roomId and active file
    if (
      typeof roomId !== 'string' ||
      !roomId.trim() ||
      socket.data.currentRoom !== roomId.trim() ||
      !ALLOWED_FILES.has(fileName)
    ) {
      return;
    }

    const cleanRoomId = roomId.trim();
    const currentUser = socket.data.currentUser;
    if (!currentUser) {
      return;
    }

    // Update activeFile in room presence
    const oldFile = currentUser.activeFile;
    currentUser.activeFile = fileName;
    const usersInRoom = roomUsers.get(cleanRoomId);
    if (usersInRoom && usersInRoom.has(socket.id)) {
      usersInRoom.set(socket.id, currentUser);
      if (oldFile !== fileName) {
        io.to(cleanRoomId).emit('room-users', { users: Array.from(usersInRoom.values()) });
      }
    }

    // Broadcast cursor position and selection range to all other users in the room
    socket.to(cleanRoomId).emit('cursor-change', {
      socketId: socket.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
      fileName,
      cursor: cursor && typeof cursor === 'object'
        ? {
            line: Math.max(1, Number(cursor.line) || 1),
            column: Math.max(1, Number(cursor.column) || 1)
          }
        : null,
      selection: selection && typeof selection === 'object'
        ? {
            startLineNumber: Math.max(1, Number(selection.startLineNumber) || 1),
            startColumn: Math.max(1, Number(selection.startColumn) || 1),
            endLineNumber: Math.max(1, Number(selection.endLineNumber) || 1),
            endColumn: Math.max(1, Number(selection.endColumn) || 1)
          }
        : null
    });
  });

  // Handle clearing remote cursor (e.g. when user switches files or blurs)
  socket.on('cursor-clear', (data) => {
    const rawRoomId = typeof data === 'object' && data !== null ? data.roomId : socket.data.currentRoom;
    if (typeof rawRoomId === 'string' && rawRoomId.trim()) {
      const cleanRoomId = rawRoomId.trim();
      socket.to(cleanRoomId).emit('cursor-clear', {
        socketId: socket.id,
        userId: socket.data.currentUser?.id
      });
    }
  });

  // Handle socket disconnecting to accurately update presence and participant counts
  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id && roomUsers.has(room)) {
        // Emit cursor-clear to room immediately
        socket.to(room).emit('cursor-clear', {
          socketId: socket.id,
          userId: socket.data.currentUser?.id
        });

        const usersInRoom = roomUsers.get(room);
        usersInRoom.delete(socket.id);

        const remainingUsers = Array.from(usersInRoom.values());
        if (remainingUsers.length === 0) {
          roomUsers.delete(room);
        } else {
          socket.to(room).emit('room-users', { users: remainingUsers });
          socket.to(room).emit('room-participants', { count: remainingUsers.length });
        }
        console.log(`[Room: ${room}] User left (${socket.id}). Remaining: ${remainingUsers.length}`);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 CodeCollab Backend running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO listening with CORS allowed for ${CLIENT_URL}`);
});
