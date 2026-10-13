import crypto from 'crypto';

/**
 * Normalizes file and folder paths to forward slashes with no leading/trailing slashes.
 */
export function normalizePath(rawPath) {
  if (typeof rawPath !== 'string') return '';
  let clean = rawPath.trim().replace(/\\/g, '/');
  clean = clean.replace(/^\/+|\/+$/g, '');
  clean = clean.replace(/\/+/g, '/');
  return clean;
}

/**
 * Validates a single path segment (disallowing '.' or '..' or invalid filesystem characters).
 */
export function isValidPathSegment(segment) {
  if (!segment || typeof segment !== 'string') return false;
  if (segment === '.' || segment === '..') return false;
  // Disallow control characters and invalid filesystem characters: \0 * ? " < > | :
  // eslint-disable-next-line no-control-regex
  if (/[\0*?"<>|:]/.test(segment)) return false;
  return true;
}

/**
 * Validates that an entire path consists of valid segments and is within max length.
 */
export function isValidPath(rawPath) {
  const normalized = normalizePath(rawPath);
  if (!normalized || normalized.length > 255) return false;
  const segments = normalized.split('/');
  return segments.every(isValidPathSegment);
}

export function isValidFilePath(rawPath) {
  return isValidPath(rawPath);
}

export function isValidFolderPath(rawPath) {
  return isValidPath(rawPath);
}

/**
 * Extracts all ancestor folder paths for a given normalized path.
 * e.g. "src/components/App.jsx" -> ["src", "src/components"]
 */
export function getParentFolderPaths(normalizedPath) {
  const parts = normalizedPath.split('/');
  const folders = [];
  let current = '';
  for (let i = 0; i < parts.length - 1; i++) {
    current = current ? `${current}/${parts[i]}` : parts[i];
    folders.push(current);
  }
  return folders;
}

/**
 * Compute SHA-256 content hash for integrity and duplicate prevention.
 */
export function computeContentHash(content) {
  return crypto.createHash('sha256').update(content || '', 'utf8').digest('hex');
}
