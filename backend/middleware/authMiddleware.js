import jwt from 'jsonwebtoken';
import { JWT_SECRET, COOKIE_NAME } from '../config/env.js';
import { findUserById } from '../db/users.js';

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || 
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

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

export async function optionalAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || 
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const user = await findUserById(decoded.id);
      if (user) {
        req.user = user;
      }
    }
  }
  next();
}

export default {
  verifyToken,
  generateToken,
  requireAuth,
  optionalAuth
};
