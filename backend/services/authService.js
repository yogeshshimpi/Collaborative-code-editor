import bcrypt from 'bcryptjs';
import { findUserByEmail, findUserById, createUser } from '../db/users.js';
import { generateToken, verifyToken } from '../middleware/authMiddleware.js';
import { ApiError } from '../utils/apiError.js';
import { validateEmail, validatePassword } from '../middleware/validateRequest.js';

export async function registerUser({ email, password, name }) {
  if (!validateEmail(email)) {
    throw new ApiError(400, 'Please provide a valid email address.');
  }

  if (!validatePassword(password)) {
    throw new ApiError(400, 'Password must be at least 6 characters long.');
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    throw new ApiError(400, 'Please provide a name with at least 2 characters.');
  }

  const cleanEmail = email.trim().toLowerCase();
  const existing = await findUserByEmail(cleanEmail);
  if (existing) {
    throw new ApiError(400, 'An account with this email address already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    email: cleanEmail,
    passwordHash,
    name: name.trim()
  });

  const token = generateToken(user);
  return { user, token };
}

export async function loginUser({ email, password }) {
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = await findUserByEmail(cleanEmail);
  if (!user) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = generateToken(user);
  return { user, token };
}

export async function getCurrentUser(token) {
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  return findUserById(decoded.id);
}

export default {
  registerUser,
  loginUser,
  getCurrentUser
};
