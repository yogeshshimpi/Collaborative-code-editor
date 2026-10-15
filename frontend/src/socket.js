import { io } from 'socket.io-client';

/**
 * Sanitizes a backend/socket URL to ensure cloud hosting platforms (like Render, Railway, Vercel)
 * do not have invalid local development ports (:5000) appended.
 */
export const sanitizeSocketUrl = (url) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

    // On cloud/production HTTPS domains (e.g. *.onrender.com), strip accidental :5000 port
    if (parsed.port === '5000' && (!isLocal || parsed.protocol === 'https:')) {
      parsed.port = '';
      return parsed.origin;
    }
    return url.replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '');
  }
};

/**
 * Resolves the Socket.IO server URL:
 * 1. Honors VITE_SOCKET_SERVER_URL or VITE_BACKEND_URL or VITE_API_URL first
 * 2. In browser dev mode on LAN IP (e.g. 192.168.x.x:5173), points to LAN IP:5000
 * 3. On localhost / 127.0.0.1, points to http://localhost:5000
 * 4. On cloud production (e.g. onrender.com) without env var, falls back to same origin (port 443)
 */
export const getSocketServerUrl = () => {
  // 1. Explicitly configured environment variable takes highest priority
  const envUrl =
    import.meta.env.VITE_SOCKET_SERVER_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL;

  if (envUrl) {
    return sanitizeSocketUrl(envUrl);
  }

  // 2. Client-side browser runtime resolution
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname.toLowerCase();

    // Localhost development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }

    // Local LAN IP testing (e.g. testing mobile/tablet over local Wi-Fi)
    const isLanIp =
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

    if (isLanIp) {
      return `${window.location.protocol}//${hostname}:5000`;
    }

    // Public domain / cloud host (e.g. *.onrender.com, custom domain)
    // NEVER append :5000 on cloud domains because Render exposes HTTPS/WSS on port 443!
    return window.location.origin;
  }

  return 'http://localhost:5000';
};

export const SOCKET_SERVER_URL = getSocketServerUrl();

export const initSocket = () => {
  return io(getSocketServerUrl(), {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    // Start with polling and upgrade to websocket to support cloud cold starts & proxy handshakes
    transports: ['polling', 'websocket'],
    withCredentials: true
  });
};
