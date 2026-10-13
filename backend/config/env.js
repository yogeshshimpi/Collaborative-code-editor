import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isProduction = NODE_ENV === 'production';
export const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_codecollab_secure_jwt_token_2026_local';
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
export const DATABASE_URL = process.env.DATABASE_URL?.trim() || '';

// Cookie configuration
export const COOKIE_NAME = 'codecollab_token';
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
};

export const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/'
};

export default {
  PORT,
  NODE_ENV,
  isProduction,
  JWT_SECRET,
  CLIENT_URL,
  DATABASE_URL,
  COOKIE_NAME,
  COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS
};
