import { registerUser, loginUser, getCurrentUser } from '../services/authService.js';
import { COOKIE_NAME, COOKIE_OPTIONS, CLEAR_COOKIE_OPTIONS } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  const { user, token } = await registerUser({ email, password, name });

  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await loginUser({ email, password });

  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
});

export const logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
  res.json({ message: 'Logged out successfully.' });
};

export const getMe = asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  if (!token) {
    return res.json({ user: null });
  }

  const user = await getCurrentUser(token);
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
});

export default {
  register,
  login,
  logout,
  getMe
};
