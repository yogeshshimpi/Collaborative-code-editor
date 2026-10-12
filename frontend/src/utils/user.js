const USER_COLORS = [
  '#6d5dfc', // Violet Accent
  '#25c990', // Success Emerald
  '#ec4899', // Pink
  '#f4b860', // Warning Amber
  '#54a6ff', // Info Blue
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#14b8a6'  // Teal
];

const STORAGE_KEY = 'codecollab_guest_user';

export function getOrCreateUser() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.id && parsed?.name && parsed?.color) {
        return parsed;
      }
    }
  } catch {
    // Fall back to new user generation
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `guest-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const user = {
    id,
    name: `Guest ${randomNum}`,
    color,
    initials: `G${randomNum.toString().slice(-2)}`
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Non-blocking in incognito / restricted environments
  }

  return user;
}

export function formatAuthUser(user) {
  if (!user) return null;

  const initials = user.name
    ? user.name
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  // Deterministic avatar color based on user email or name
  let hash = 0;
  const seed = (user.email || user.name || 'user').toLowerCase();
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = USER_COLORS[Math.abs(hash) % USER_COLORS.length];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    initials,
    color,
    isAuthenticated: true
  };
}
