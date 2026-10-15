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

export async function changeUserPassword(userId, { currentPassword, newPassword, confirmPassword }) {
  if (!userId) {
    throw new ApiError(401, 'Unauthorized request.');
  }

  if (!currentPassword) {
    throw new ApiError(400, 'Current password is required.');
  }

  if (!newPassword || !validatePassword(newPassword)) {
    throw new ApiError(400, 'New password must be at least 6 characters long.');
  }

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, 'New password and confirmation do not match.');
  }

  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password cannot be the same as your current password.');
  }

  const { findUserWithPasswordById, updateUserPassword } = await import('../db/users.js');
  const user = await findUserWithPasswordById(userId);
  if (!user || !user.password_hash) {
    throw new ApiError(404, 'User account not found.');
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isCurrentValid) {
    throw new ApiError(400, 'Current password is incorrect.');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const updated = await updateUserPassword(userId, newHash);
  if (!updated) {
    throw new ApiError(500, 'Failed to update password. Please try again.');
  }

  return { success: true, message: 'Password updated successfully.' };
}

export async function deleteUserAccount(userId, password) {
  if (!userId) {
    throw new ApiError(401, 'Unauthorized request.');
  }

  if (!password) {
    throw new ApiError(400, 'Password confirmation is required to delete your account.');
  }

  const { findUserWithPasswordById, deleteUserById } = await import('../db/users.js');
  const user = await findUserWithPasswordById(userId);
  if (!user || !user.password_hash) {
    throw new ApiError(404, 'User account not found.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new ApiError(400, 'Incorrect password. Account deletion aborted.');
  }

  const deleted = await deleteUserById(userId);
  if (!deleted) {
    throw new ApiError(500, 'Failed to delete account. Please try again.');
  }

  return { success: true, message: 'Your account has been permanently deleted.' };
}

export default {
  registerUser,
  loginUser,
  getCurrentUser,
  changeUserPassword,
  deleteUserAccount
};
