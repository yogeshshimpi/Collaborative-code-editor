import { CLIENT_URL, isProduction } from './env.js';

// Configured frontend client origins (supports comma-separated list)
const configuredOrigins = CLIENT_URL
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

export const allowedOriginsSet = new Set([
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

export const corsOptions = {
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

export default corsOptions;
