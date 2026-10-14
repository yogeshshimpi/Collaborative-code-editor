import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 auth requests per window
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

export const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 executions per minute
  message: { error: 'Code execution rate limit exceeded. Please wait a minute before running code again.' },
  standardHeaders: true,
  legacyHeaders: false
});

export default {
  authLimiter,
  executionLimiter
};
