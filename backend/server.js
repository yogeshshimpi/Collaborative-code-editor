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
  updateProject,
  updateProjectName,
  deleteProject,
  createFileVersion,
  getFileVersions,
  getFileVersionById,
  restoreFileVersion,
  getRoomWorkspace,
  isValidFilePath,
  isValidFolderPath,
  normalizePath,
  createFileInRoom,
  createFolderInRoom,
  renameFileInRoom,
  renameFolderInRoom,
  deleteFileInRoom,
  deleteFolderInRoom,
  moveItemInRoom,
  recordProjectActivity,
  getProjectActivityLogs
} from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_codecollab_secure_jwt_token_2026_local';

// Configured frontend client origins (supports comma-separated list)
const configuredOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const allowedOriginsSet = new Set([
  ...configuredOrigins,
  ...(isProduction ? [] : defaultDevOrigins)
]);

// Dynamic CORS validator allowing localhost, dev IPs, and configured domains
export const corsOriginValidator = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOriginsSet.has(origin)) return callback(null, true);

  if (!isProduction) {
    try {
      const parsed = new URL(origin);
      const host = parsed.hostname;
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      ) {
        return callback(null, true);
      }
    } catch {
      // ignore parse errors
    }
  }

  return callback(null, false);
};

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
  origin: corsOriginValidator,
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

// Rename project or room (Owner only)
app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { name, roomId } = req.body || {};
    if ((!name || typeof name !== 'string' || !name.trim()) && (!roomId || typeof roomId !== 'string' || !roomId.trim())) {
      return res.status(400).json({ error: 'Project name or room ID is required.' });
    }

    const updated = await updateProject(req.params.id, { name, roomId }, req.user.id);
    if (!updated) {
      return res.status(404).json({ error: 'Project not found or not owned by you.' });
    }

    // Broadcast project-renamed to Socket.IO clients in old and new rooms
    const oldRoom = updated.old_room_id || req.params.id;
    io.to(oldRoom).emit('project-renamed', {
      projectId: updated.id,
      oldRoomId: oldRoom,
      newRoomId: updated.room_id,
      newName: updated.name
    });
    if (updated.room_id && updated.room_id !== oldRoom) {
      io.to(updated.room_id).emit('project-renamed', {
        projectId: updated.id,
        oldRoomId: oldRoom,
        newRoomId: updated.room_id,
        newName: updated.name
      });
    }

    res.json({ project: updated });
  } catch (err) {
    console.error('[Projects Error] Failed to rename project:', err);
    res.status(err.status || 400).json({ error: err.message || 'Failed to rename project.' });
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

    const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    recordProjectActivity({
      roomId: project.room_id,
      projectId: project.id,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'member_invite',
      targetName: email.trim(),
      details: { role: roleDisplay },
      summary: `${req.user.name} invited ${email.trim()} as ${roleDisplay}`
    }).then((act) => {
      if (act) io.to(project.room_id).emit('activity-log-entry', act);
    }).catch(() => {});

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

    const targetUser = await findUserById(targetUserId);
    const updated = await updateProjectMemberRole(project.id, targetUserId, role);
    if (!updated) {
      return res.status(404).json({ error: 'Project member not found.' });
    }

    const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    const targetName = targetUser?.name || `User #${targetUserId}`;
    recordProjectActivity({
      roomId: project.room_id,
      projectId: project.id,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'member_role_change',
      targetName,
      details: { newRole: roleDisplay },
      summary: `${req.user.name} changed ${targetName}’s role to ${roleDisplay}`
    }).then((act) => {
      if (act) io.to(project.room_id).emit('activity-log-entry', act);
    }).catch(() => {});

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

    const targetUser = await findUserById(targetUserId);
    const removed = await removeProjectMember(project.id, targetUserId);
    if (!removed) {
      return res.status(404).json({ error: 'Project member not found.' });
    }

    const targetName = targetUser?.name || `User #${targetUserId}`;
    const summary = isSelf
      ? `${req.user.name} left the project`
      : `${req.user.name} removed ${targetName} from the project`;

    recordProjectActivity({
      roomId: project.room_id,
      projectId: project.id,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: isSelf ? 'member_leave' : 'member_remove',
      targetName,
      details: { targetUserId },
      summary
    }).then((act) => {
      if (act) io.to(project.room_id).emit('activity-log-entry', act);
    }).catch(() => {});

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
    if (action === 'accept' && result?.invitation?.project_id) {
      const proj = await getProjectById(result.invitation.project_id, req.user.id);
      if (proj) {
        recordProjectActivity({
          roomId: proj.room_id,
          projectId: proj.id,
          userId: req.user.id,
          userName: req.user.name,
          userEmail: req.user.email,
          actionType: 'member_join',
          targetName: req.user.name,
          details: { role: result.invitation.role },
          summary: `${req.user.name} joined the project as ${result.invitation.role}`
        }).then((act) => {
          if (act) io.to(proj.room_id).emit('activity-log-entry', act);
        }).catch(() => {});
      }
    }
    res.json(result);
  } catch (err) {
    console.error('[Invitations Error] Failed to respond to invitation:', err.message);
    res.status(400).json({ error: err.message || 'Failed to process invitation.' });
  }
});

// -------------------------------------------------------------
// PROJECT ACTIVITY LOG ROUTES
// -------------------------------------------------------------

// Retrieve activity timeline for a project
app.get('/api/projects/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, filter = 'all' } = req.query;

    // Direct access for demo-room
    if (id === 'demo-room') {
      const data = await getProjectActivityLogs({ roomId: 'demo-room', limit, offset, filter });
      return res.json(data);
    }

    // Authenticated access for real projects
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required to view project activity.' });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Session expired.' });
    }
    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const project = await getProjectById(id, user.id);
    const projectRole = await getProjectRole(id, user.id);
    if (project && !projectRole) {
      return res.status(403).json({ error: 'You do not have access to view this project activity.' });
    }

    const targetRoom = project?.room_id || id;
    const targetProjectId = project?.id || null;

    const data = await getProjectActivityLogs({
      roomId: targetRoom,
      projectId: targetProjectId,
      limit,
      offset,
      filter
    });

    res.json(data);
  } catch (err) {
    console.error('[Activity Log Error]:', err);
    res.status(500).json({ error: 'Failed to retrieve project activity logs.' });
  }
});

// -------------------------------------------------------------
// PER-FILE VERSION HISTORY & RESTORE ROUTES
// -------------------------------------------------------------

// List versions for a specific file in a project (supports nested paths)
app.get(['/api/projects/:roomId/files/:fileName/versions', /^\/api\/projects\/([^/]+)\/files\/(.+)\/versions$/], requireAuth, async (req, res) => {
  try {
    const roomId = req.params.roomId || req.params[0];
    const rawFileName = req.query.file || req.params.fileName || (req.params[1] ? decodeURIComponent(req.params[1]) : '');
    const fileName = normalizePath(rawFileName);

    if (!isValidFilePath(fileName)) {
      return res.status(400).json({ error: 'Invalid file path.' });
    }

    const project = await getProjectById(roomId, req.user.id);
    const projectRole = await getProjectRole(roomId, req.user.id);
    if (project && !projectRole) {
      return res.status(403).json({ error: 'You do not have access to view this project.' });
    }
    const targetRoom = project?.room_id || roomId;

    const versions = await getFileVersions(targetRoom, fileName);
    res.json({
      roomId: targetRoom,
      fileName,
      versions,
      userRole: projectRole || 'editor'
    });
  } catch (err) {
    console.error('[Version History Error] Failed to list file versions:', err);
    res.status(500).json({ error: 'Failed to retrieve version history.' });
  }
});

// Get a single version with full code content for previewing (supports nested paths)
app.get(['/api/projects/:roomId/files/:fileName/versions/:versionId', /^\/api\/projects\/([^/]+)\/files\/(.+)\/versions\/([^/]+)$/], requireAuth, async (req, res) => {
  try {
    const roomId = req.params.roomId || req.params[0];
    const rawFileName = req.query.file || req.params.fileName || (req.params[1] ? decodeURIComponent(req.params[1]) : '');
    const versionId = req.params.versionId || req.params[2];
    const fileName = normalizePath(rawFileName);

    if (!isValidFilePath(fileName)) {
      return res.status(400).json({ error: 'Invalid file path.' });
    }

    const project = await getProjectById(roomId, req.user.id);
    const projectRole = await getProjectRole(roomId, req.user.id);
    if (project && !projectRole) {
      return res.status(403).json({ error: 'You do not have access to view this project.' });
    }
    const targetRoom = project?.room_id || roomId;

    const version = await getFileVersionById(versionId, targetRoom);
    if (!version || version.file_name !== fileName) {
      return res.status(404).json({ error: 'Version not found for this file.' });
    }

    res.json({ version });
  } catch (err) {
    console.error('[Version History Error] Failed to retrieve version preview:', err);
    res.status(500).json({ error: 'Failed to retrieve version preview.' });
  }
});

// Create a manual checkpoint / snapshot (supports nested paths)
app.post(['/api/projects/:roomId/files/:fileName/versions', /^\/api\/projects\/([^/]+)\/files\/(.+)\/versions$/], requireAuth, async (req, res) => {
  try {
    const roomId = req.params.roomId || req.params[0];
    const rawFileName = req.query.file || req.params.fileName || (req.params[1] ? decodeURIComponent(req.params[1]) : '');
    const fileName = normalizePath(rawFileName);
    const { label, content } = req.body;

    if (!isValidFilePath(fileName)) {
      return res.status(400).json({ error: 'Invalid file path.' });
    }

    const project = await getProjectById(roomId, req.user.id);
    const projectRole = await getProjectRole(roomId, req.user.id);
    if (project && !projectRole) {
      return res.status(403).json({ error: 'You do not have access to this project.' });
    }
    if (projectRole === 'viewer') {
      return res.status(403).json({ error: 'Permission denied: Viewers cannot create manual versions.' });
    }
    const targetRoom = project?.room_id || roomId;

    let fileContent = typeof content === 'string' ? content : null;
    if (fileContent === null) {
      const roomFiles = await getRoomFiles(targetRoom);
      fileContent = roomFiles[fileName] || '';
    }

    const newVersion = await createFileVersion({
      roomId: targetRoom,
      fileName,
      content: fileContent,
      authorId: req.user.id,
      versionType: 'manual',
      label: typeof label === 'string' && label.trim() ? label.trim().slice(0, 100) : 'Manual Snapshot'
    });

    res.status(201).json({
      message: 'Snapshot created successfully.',
      version: newVersion
    });
  } catch (err) {
    console.error('[Version History Error] Failed to create manual version:', err);
    res.status(500).json({ error: 'Failed to create snapshot.' });
  }
});

// Restore an earlier version (supports nested paths)
app.post(['/api/projects/:roomId/files/:fileName/versions/:versionId/restore', /^\/api\/projects\/([^/]+)\/files\/(.+)\/versions\/([^/]+)\/restore$/], requireAuth, async (req, res) => {
  try {
    const roomId = req.params.roomId || req.params[0];
    const rawFileName = req.query.file || req.params.fileName || (req.params[1] ? decodeURIComponent(req.params[1]) : '');
    const versionId = req.params.versionId || req.params[2];
    const fileName = normalizePath(rawFileName);

    if (!isValidFilePath(fileName)) {
      return res.status(400).json({ error: 'Invalid file path.' });
    }

    const project = await getProjectById(roomId, req.user.id);
    const projectRole = await getProjectRole(roomId, req.user.id);
    if (project && !projectRole) {
      return res.status(403).json({ error: 'You do not have access to this project.' });
    }
    if (projectRole === 'viewer') {
      return res.status(403).json({ error: 'Permission denied: Viewers cannot restore versions.' });
    }
    const targetRoom = project?.room_id || roomId;

    const targetVersion = await getFileVersionById(versionId, targetRoom);
    if (!targetVersion || targetVersion.file_name !== fileName) {
      return res.status(404).json({ error: 'Version not found for this file.' });
    }

    const restored = await restoreFileVersion({
      versionId,
      roomId: targetRoom,
      restoredByUserId: req.user.id
    });

    // Broadcast restored code change to all collaborators in the room
    io.to(targetRoom).emit('code-change', {
      fileName: restored.fileName,
      content: restored.content
    });
    if (targetRoom !== roomId) {
      io.to(roomId).emit('code-change', {
        fileName: restored.fileName,
        content: restored.content
      });
    }

    // Notify room of saved status
    io.to(targetRoom).emit('save-status', {
      status: 'saved',
      fileName: restored.fileName,
      savedAt: new Date().toISOString()
    });

    recordProjectActivity({
      roomId: targetRoom,
      projectId: project?.id || null,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'file_restore',
      targetName: restored.fileName,
      details: { restoredFromId: versionId, newVersionId: restored.newVersionId },
      summary: `${req.user.name} restored ${restored.fileName} to an earlier version`
    }).then((act) => {
      if (act) {
        io.to(targetRoom).emit('activity-log-entry', act);
        if (targetRoom !== roomId) io.to(roomId).emit('activity-log-entry', act);
      }
    }).catch(() => {});

    res.json({
      message: `Successfully restored ${restored.fileName} from previous version.`,
      fileName: restored.fileName,
      content: restored.content,
      newVersionId: restored.newVersionId
    });
  } catch (err) {
    console.error('[Version History Error] Failed to restore version:', err);
    res.status(500).json({ error: err.message || 'Failed to restore version.' });
  }
});

// -------------------------------------------------------------
// VIRTUAL FILE & FOLDER EXPLORER ROUTES
// -------------------------------------------------------------

// Get workspace file and folder tree
app.get('/api/projects/:roomId/tree', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const project = await getProjectById(roomId, req.user.id);
    const projectRole = await getProjectRole(roomId, req.user.id);
    if (project && !projectRole) {
      return res.status(403).json({ error: 'You do not have access to this project.' });
    }
    const targetRoom = project?.room_id || roomId;

    const workspace = await getRoomWorkspace(targetRoom);
    res.json({
      roomId: targetRoom,
      files: workspace.files,
      folders: workspace.folders,
      userRole: projectRole || 'editor'
    });
  } catch (err) {
    console.error('[File Tree Error] Failed to get workspace tree:', err);
    res.status(500).json({ error: 'Failed to retrieve workspace tree.' });
  }
});

// Alias for getting files and folders
app.get('/api/projects/:roomId/files', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const project = await getProjectById(roomId, req.user.id);
    const projectRole = await getProjectRole(roomId, req.user.id);
    if (project && !projectRole) {
      return res.status(403).json({ error: 'You do not have access to this project.' });
    }
    const targetRoom = project?.room_id || roomId;

    const workspace = await getRoomWorkspace(targetRoom);
    res.json({
      roomId: targetRoom,
      files: workspace.files,
      folders: workspace.folders,
      userRole: projectRole || 'editor'
    });
  } catch (err) {
    console.error('[Files Error] Failed to get project files:', err);
    res.status(500).json({ error: 'Failed to retrieve project files.' });
  }
});

// Create new virtual file
app.post('/api/projects/:roomId/files', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { path, content } = req.body;

    const projectRole = await getProjectRole(roomId, req.user.id);
    if (projectRole === 'viewer') {
      return res.status(403).json({ error: 'Permission denied: Viewers cannot create files.' });
    }

    const created = await createFileInRoom({
      roomId,
      filePath: path,
      content: content || '',
      authorId: req.user.id
    });

    // Broadcast file creation live to collaborators
    io.to(roomId).emit('file-created', {
      roomId,
      fileName: created.fileName,
      content: created.content
    });

    recordProjectActivity({
      roomId,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'file_create',
      targetName: created.fileName,
      details: {},
      summary: `${req.user.name} created ${created.fileName}`
    }).then((act) => {
      if (act) io.to(roomId).emit('activity-log-entry', act);
    }).catch(() => {});

    res.status(201).json({
      message: `File "${created.fileName}" created successfully.`,
      file: created
    });
  } catch (err) {
    console.error('[Create File Error]:', err.message);
    res.status(400).json({ error: err.message || 'Failed to create file.' });
  }
});

// Create new virtual folder
app.post('/api/projects/:roomId/folders', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { path } = req.body;

    const projectRole = await getProjectRole(roomId, req.user.id);
    if (projectRole === 'viewer') {
      return res.status(403).json({ error: 'Permission denied: Viewers cannot create folders.' });
    }

    const created = await createFolderInRoom({
      roomId,
      folderPath: path
    });

    // Broadcast folder creation live to collaborators
    io.to(roomId).emit('folder-created', {
      roomId,
      folderPath: created.folderPath
    });

    recordProjectActivity({
      roomId,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'folder_create',
      targetName: created.folderPath,
      details: {},
      summary: `${req.user.name} created ${created.folderPath}`
    }).then((act) => {
      if (act) io.to(roomId).emit('activity-log-entry', act);
    }).catch(() => {});

    res.status(201).json({
      message: `Folder "${created.folderPath}" created successfully.`,
      folder: created
    });
  } catch (err) {
    console.error('[Create Folder Error]:', err.message);
    res.status(400).json({ error: err.message || 'Failed to create folder.' });
  }
});

// Rename virtual file
app.put('/api/projects/:roomId/files/rename', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { oldPath, newPath } = req.body;

    const projectRole = await getProjectRole(roomId, req.user.id);
    if (projectRole === 'viewer') {
      return res.status(403).json({ error: 'Permission denied: Viewers cannot rename files.' });
    }

    const renamed = await renameFileInRoom({
      roomId,
      oldPath,
      newPath
    });

    // Broadcast file rename live to collaborators
    io.to(roomId).emit('file-renamed', {
      roomId,
      oldPath: renamed.oldPath,
      newPath: renamed.newPath
    });

    recordProjectActivity({
      roomId,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'file_rename',
      targetName: renamed.newPath,
      details: { oldPath: renamed.oldPath, newPath: renamed.newPath },
      summary: `${req.user.name} renamed ${renamed.oldPath} to ${renamed.newPath}`
    }).then((act) => {
      if (act) io.to(roomId).emit('activity-log-entry', act);
    }).catch(() => {});

    res.json({
      message: `Renamed "${renamed.oldPath}" to "${renamed.newPath}".`,
      ...renamed
    });
  } catch (err) {
    console.error('[Rename File Error]:', err.message);
    res.status(400).json({ error: err.message || 'Failed to rename file.' });
  }
});

// Rename virtual folder
app.put('/api/projects/:roomId/folders/rename', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { oldFolder, newFolder, oldPath, newPath } = req.body;
    const source = oldFolder || oldPath;
    const target = newFolder || newPath;

    const projectRole = await getProjectRole(roomId, req.user.id);
    if (projectRole === 'viewer') {
      return res.status(403).json({ error: 'Permission denied: Viewers cannot rename folders.' });
    }

    const renamed = await renameFolderInRoom({
      roomId,
      oldFolder: source,
      newFolder: target
    });

    // Broadcast folder rename live to collaborators
    io.to(roomId).emit('folder-renamed', {
      roomId,
      oldFolder: renamed.oldFolder,
      newFolder: renamed.newFolder,
      affectedFiles: renamed.affectedFiles
    });

    recordProjectActivity({
      roomId,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'folder_rename',
      targetName: renamed.newFolder,
      details: { oldFolder: renamed.oldFolder, newFolder: renamed.newFolder },
      summary: `${req.user.name} renamed folder ${renamed.oldFolder} to ${renamed.newFolder}`
    }).then((act) => {
      if (act) io.to(roomId).emit('activity-log-entry', act);
    }).catch(() => {});

    res.json({
      message: `Renamed folder "${renamed.oldFolder}" to "${renamed.newFolder}".`,
      ...renamed
    });
  } catch (err) {
    console.error('[Rename Folder Error]:', err.message);
    res.status(400).json({ error: err.message || 'Failed to rename folder.' });
  }
});

// Delete virtual file
app.delete('/api/projects/:roomId/files', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const path = req.body?.path || req.query?.path;

    const projectRole = await getProjectRole(roomId, req.user.id);
    if (projectRole === 'viewer') {
      return res.status(403).json({ error: 'Permission denied: Viewers cannot delete files.' });
    }

    const deleted = await deleteFileInRoom({
      roomId,
      filePath: path
    });

    // Broadcast file deletion live to collaborators
    io.to(roomId).emit('file-deleted', {
      roomId,
      filePath: deleted.filePath
    });

    recordProjectActivity({
      roomId,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'file_delete',
      targetName: deleted.filePath,
      details: {},
      summary: `${req.user.name} deleted ${deleted.filePath}`
    }).then((act) => {
      if (act) io.to(roomId).emit('activity-log-entry', act);
    }).catch(() => {});

    res.json({
      message: `Deleted file "${deleted.filePath}".`,
      ...deleted
    });
  } catch (err) {
    console.error('[Delete File Error]:', err.message);
    res.status(400).json({ error: err.message || 'Failed to delete file.' });
  }
});

// Delete virtual folder
app.delete('/api/projects/:roomId/folders', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const path = req.body?.path || req.query?.path;

    const projectRole = await getProjectRole(roomId, req.user.id);
    if (projectRole === 'viewer') {
      return res.status(403).json({ error: 'Permission denied: Viewers cannot delete folders.' });
    }

    const deleted = await deleteFolderInRoom({
      roomId,
      folderPath: path
    });

    // Broadcast folder deletion live to collaborators
    io.to(roomId).emit('folder-deleted', {
      roomId,
      folderPath: deleted.folderPath,
      deletedFiles: deleted.deletedFiles
    });

    recordProjectActivity({
      roomId,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'folder_delete',
      targetName: deleted.folderPath,
      details: {},
      summary: `${req.user.name} deleted folder ${deleted.folderPath}`
    }).then((act) => {
      if (act) io.to(roomId).emit('activity-log-entry', act);
    }).catch(() => {});

    res.json({
      message: `Deleted folder "${deleted.folderPath}".`,
      ...deleted
    });
  } catch (err) {
    console.error('[Delete Folder Error]:', err.message);
    res.status(400).json({ error: err.message || 'Failed to delete folder.' });
  }
});

// Move item (file or folder)
app.put('/api/projects/:roomId/move', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { itemType, oldPath, targetParentFolder } = req.body;

    const projectRole = await getProjectRole(roomId, req.user.id);
    if (projectRole === 'viewer') {
      return res.status(403).json({ error: 'Permission denied: Viewers cannot move items.' });
    }

    const moved = await moveItemInRoom({
      roomId,
      itemType: itemType || 'file',
      oldPath,
      targetParentFolder: targetParentFolder || ''
    });

    if (itemType === 'folder') {
      io.to(roomId).emit('folder-renamed', {
        roomId,
        oldFolder: moved.oldFolder,
        newFolder: moved.newFolder,
        affectedFiles: moved.affectedFiles
      });
    } else {
      io.to(roomId).emit('file-renamed', {
        roomId,
        oldPath: moved.oldPath,
        newPath: moved.newPath
      });
    }

    const originPath = itemType === 'folder' ? moved.oldFolder : moved.oldPath;
    const targetPath = itemType === 'folder' ? moved.newFolder : moved.newPath;
    recordProjectActivity({
      roomId,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      actionType: 'item_move',
      targetName: targetPath,
      details: { oldPath: originPath, newPath: targetPath, itemType },
      summary: `${req.user.name} moved ${originPath} to ${targetParentFolder || 'root'}`
    }).then((act) => {
      if (act) io.to(roomId).emit('activity-log-entry', act);
    }).catch(() => {});

    res.json({
      message: 'Moved successfully.',
      ...moved
    });
  } catch (err) {
    console.error('[Move Item Error]:', err.message);
    res.status(400).json({ error: err.message || 'Failed to move item.' });
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

// REST endpoint to get room workspace files & folders
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const workspace = await getRoomWorkspace(roomId);
    res.json({ roomId, files: workspace.files, folders: workspace.folders });
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
    origin: corsOriginValidator,
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
    const initialActiveFile = typeof rawUser?.activeFile === 'string' && isValidFilePath(rawUser.activeFile) ? rawUser.activeFile : 'main.js';
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
    let matchedProject = null;
    if (authUser) {
      try {
        matchedProject = await getProjectById(roomId, authUser.id);
        if (matchedProject?.role) {
          userRole = matchedProject.role;
        }
      } catch (err) {
        console.warn(`[Role Check Error] Could not retrieve role for ${authUser.id}:`, err.message);
      }
    }
    socket.data.role = userRole;
    sanitizedUser.role = userRole;

    socket.data.currentUser = sanitizedUser;

    // Send user their role and project info in this workspace
    socket.emit('user-role', { role: userRole });
    if (matchedProject) {
      socket.emit('project-info', {
        id: matchedProject.id,
        name: matchedProject.name,
        roomId: matchedProject.room_id,
        role: userRole
      });
      // Also join canonical room if rawRoomId was project name or UUID
      if (matchedProject.room_id && matchedProject.room_id !== roomId) {
        socket.join(matchedProject.room_id);
      }
    }

    // Target room for presence & workspace (prefer project's canonical room_id)
    const targetRoom = matchedProject?.room_id || roomId;

    // Track user presence in this room
    if (!roomUsers.has(targetRoom)) {
      roomUsers.set(targetRoom, new Map());
    }
    const usersInRoom = roomUsers.get(targetRoom);
    usersInRoom.set(socket.id, sanitizedUser);

    // Retrieve persisted room workspace (files and folders) from PostgreSQL
    const workspace = await getRoomWorkspace(targetRoom);
    socket.emit('room-sync', workspace);

    // Broadcast updated presence list & count to everyone in the room
    const currentUsers = Array.from(usersInRoom.values());
    io.to(targetRoom).emit('room-users', { users: currentUsers });
    io.to(targetRoom).emit('room-participants', { count: currentUsers.length });
    if (targetRoom !== roomId) {
      io.to(roomId).emit('room-users', { users: currentUsers });
      io.to(roomId).emit('room-participants', { count: currentUsers.length });
    }

    console.log(`[Room: ${targetRoom}] ${sanitizedUser.name} (${socket.id}) joined as ${userRole}. Total online: ${currentUsers.length}`);
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
      !isValidFilePath(fileName) ||
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
    const authorId = socket.data.authenticatedUser?.id || null;
    saveFileContent(cleanRoomId, fileName, content, authorId)
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

  // Real-time Virtual File & Folder Management Socket Events
  socket.on('create-file', async (data) => {
    if (!data || typeof data !== 'object') return;
    if (socket.data.role === 'viewer') {
      socket.emit('permission-error', { error: 'Viewers cannot create files.' });
      return;
    }
    const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
    if (!cleanRoom) return;

    try {
      const created = await createFileInRoom({
        roomId: cleanRoom,
        filePath: data.filePath || data.path,
        content: data.content || '',
        authorId: socket.data.authenticatedUser?.id || null
      });

      io.to(cleanRoom).emit('file-created', {
        roomId: cleanRoom,
        fileName: created.fileName,
        content: created.content
      });
    } catch (err) {
      socket.emit('file-error', { error: err.message });
    }
  });

  socket.on('create-folder', async (data) => {
    if (!data || typeof data !== 'object') return;
    if (socket.data.role === 'viewer') {
      socket.emit('permission-error', { error: 'Viewers cannot create folders.' });
      return;
    }
    const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
    if (!cleanRoom) return;

    try {
      const created = await createFolderInRoom({
        roomId: cleanRoom,
        folderPath: data.folderPath || data.path
      });

      io.to(cleanRoom).emit('folder-created', {
        roomId: cleanRoom,
        folderPath: created.folderPath
      });
    } catch (err) {
      socket.emit('file-error', { error: err.message });
    }
  });

  socket.on('rename-file', async (data) => {
    if (!data || typeof data !== 'object') return;
    if (socket.data.role === 'viewer') {
      socket.emit('permission-error', { error: 'Viewers cannot rename files.' });
      return;
    }
    const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
    if (!cleanRoom) return;

    try {
      const renamed = await renameFileInRoom({
        roomId: cleanRoom,
        oldPath: data.oldPath,
        newPath: data.newPath
      });

      io.to(cleanRoom).emit('file-renamed', {
        roomId: cleanRoom,
        oldPath: renamed.oldPath,
        newPath: renamed.newPath
      });
    } catch (err) {
      socket.emit('file-error', { error: err.message });
    }
  });

  socket.on('rename-folder', async (data) => {
    if (!data || typeof data !== 'object') return;
    if (socket.data.role === 'viewer') {
      socket.emit('permission-error', { error: 'Viewers cannot rename folders.' });
      return;
    }
    const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
    if (!cleanRoom) return;

    try {
      const renamed = await renameFolderInRoom({
        roomId: cleanRoom,
        oldFolder: data.oldFolder || data.oldPath,
        newFolder: data.newFolder || data.newPath
      });

      io.to(cleanRoom).emit('folder-renamed', {
        roomId: cleanRoom,
        oldFolder: renamed.oldFolder,
        newFolder: renamed.newFolder,
        affectedFiles: renamed.affectedFiles
      });
    } catch (err) {
      socket.emit('file-error', { error: err.message });
    }
  });

  socket.on('delete-file', async (data) => {
    if (!data || typeof data !== 'object') return;
    if (socket.data.role === 'viewer') {
      socket.emit('permission-error', { error: 'Viewers cannot delete files.' });
      return;
    }
    const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
    if (!cleanRoom) return;

    try {
      const deleted = await deleteFileInRoom({
        roomId: cleanRoom,
        filePath: data.filePath || data.path
      });

      io.to(cleanRoom).emit('file-deleted', {
        roomId: cleanRoom,
        filePath: deleted.filePath
      });
    } catch (err) {
      socket.emit('file-error', { error: err.message });
    }
  });

  socket.on('delete-folder', async (data) => {
    if (!data || typeof data !== 'object') return;
    if (socket.data.role === 'viewer') {
      socket.emit('permission-error', { error: 'Viewers cannot delete folders.' });
      return;
    }
    const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
    if (!cleanRoom) return;

    try {
      const deleted = await deleteFolderInRoom({
        roomId: cleanRoom,
        folderPath: data.folderPath || data.path
      });

      io.to(cleanRoom).emit('folder-deleted', {
        roomId: cleanRoom,
        folderPath: deleted.folderPath,
        deletedFiles: deleted.deletedFiles
      });
    } catch (err) {
      socket.emit('file-error', { error: err.message });
    }
  });

  socket.on('move-item', async (data) => {
    if (!data || typeof data !== 'object') return;
    if (socket.data.role === 'viewer') {
      socket.emit('permission-error', { error: 'Viewers cannot move files or folders.' });
      return;
    }
    const cleanRoom = data.roomId?.trim() || socket.data.currentRoom;
    if (!cleanRoom) return;

    try {
      const moved = await moveItemInRoom({
        roomId: cleanRoom,
        itemType: data.itemType || 'file',
        oldPath: data.oldPath,
        targetParentFolder: data.targetParentFolder || ''
      });

      if (data.itemType === 'folder') {
        io.to(cleanRoom).emit('folder-renamed', {
          roomId: cleanRoom,
          oldFolder: moved.oldFolder,
          newFolder: moved.newFolder,
          affectedFiles: moved.affectedFiles
        });
      } else {
        io.to(cleanRoom).emit('file-renamed', {
          roomId: cleanRoom,
          oldPath: moved.oldPath,
          newPath: moved.newPath
        });
      }
    } catch (err) {
      socket.emit('file-error', { error: err.message });
    }
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
      !isValidFilePath(fileName)
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
  console.log(`📡 Socket.IO listening with CORS allowed for: ${Array.from(allowedOriginsSet).join(', ')}`);
});
