import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './useAuth';

export const DEFAULT_SETTINGS = {
  display_name: '',
  avatar_url: '',
  bio: '',
  editor_font_size: 14,
  tab_size: 2,
  word_wrap: true,
  show_line_numbers: true,
  show_minimap: true,
  editor_theme: 'dark',
  project_theme: 'navy',
  show_live_cursors: true,
  show_collaborator_labels: true,
  autosave_delay: 2,
  chat_notifications: true,
  mention_notifications: true,
  comment_notifications: true,
  invitation_notifications: true,
  notification_sound: true
};

const STORAGE_KEY = 'codecollab_user_settings';
const THEME_STORAGE_KEY = 'codecollab_theme';

export function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return;
  const validTheme = ['navy', 'midnight', 'cyberpunk', 'emerald', 'ocean', 'light'].includes(theme)
    ? theme
    : 'navy';
  document.documentElement.setAttribute('data-theme', validTheme);
  document.documentElement.style.colorScheme = validTheme === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_STORAGE_KEY, validTheme);
  } catch {}
}

export const SettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  loading: false,
  saveThemeSettings: async () => {},
  previewTheme: () => {},
  changeTheme: () => {},
  saveProfileSettings: async () => {},
  saveEditorSettings: async () => {},
  saveCollaborationSettings: async () => {},
  saveNotificationSettings: async () => {},
  changePassword: async () => {},
  deleteAccount: async () => {},
  refreshSettings: async () => {}
});

export function SettingsProvider({ children }) {
  const { user, isAuthenticated } = useAuth();

  const [settings, setSettings] = useState(() => {
    let initialTheme = 'navy';
    if (typeof window !== 'undefined') {
      try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme) initialTheme = savedTheme;
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
          if (savedTheme) parsed.project_theme = savedTheme;
          applyThemeToDocument(parsed.project_theme || 'navy');
          return parsed;
        }
      } catch {}
    }
    applyThemeToDocument(initialTheme);
    return { ...DEFAULT_SETTINGS, project_theme: initialTheme };
  });

  const [loading, setLoading] = useState(false);

  // Apply project theme whenever it changes in state
  useEffect(() => {
    applyThemeToDocument(settings.project_theme || 'navy');
  }, [settings.project_theme]);

  // Fetch settings from server on auth state change
  const refreshSettings = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.getSettings();
      if (res?.settings) {
        setSettings((prev) => {
          const merged = { ...prev, ...res.settings };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            if (merged.project_theme) {
              localStorage.setItem(THEME_STORAGE_KEY, merged.project_theme);
            }
          } catch {}
          return merged;
        });
      }
    } catch (err) {
      console.warn('[SettingsContext] Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshSettings();
    } else {
      // Keep selected theme intact on logout / unauthenticated pages like /login & /signup
      const currentTheme = typeof window !== 'undefined'
        ? localStorage.getItem(THEME_STORAGE_KEY) || settings.project_theme || 'navy'
        : 'navy';
      setSettings((prev) => ({
        ...DEFAULT_SETTINGS,
        project_theme: currentTheme
      }));
      applyThemeToDocument(currentTheme);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }, [isAuthenticated, refreshSettings]);

  // Change theme locally immediately and persist
  const changeTheme = (newTheme) => {
    applyThemeToDocument(newTheme);
    setSettings((prev) => ({
      ...prev,
      project_theme: newTheme
    }));
  };

  // Save Profile Settings
  const saveProfileSettings = async (data) => {
    const res = await api.updateProfileSettings(data);
    if (res?.settings) {
      setSettings((prev) => {
        const next = { ...prev, ...res.settings };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      return res.settings;
    }
    throw new Error(res?.error || 'Failed to update profile settings.');
  };

  // Save Whole Project Theme & Editor Theme
  const saveThemeSettings = async ({ projectTheme, editorTheme }) => {
    applyThemeToDocument(projectTheme);
    const res = await api.updateThemeSettings({ projectTheme, editorTheme });
    if (res?.settings) {
      setSettings((prev) => {
        const next = { ...prev, ...res.settings };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          localStorage.setItem(THEME_STORAGE_KEY, next.project_theme);
        } catch {}
        return next;
      });
      return res.settings;
    }
    throw new Error(res?.error || 'Failed to update theme settings.');
  };

  const previewTheme = (theme) => {
    applyThemeToDocument(theme);
  };

  // Save Editor Preferences
  const saveEditorSettings = async (data) => {
    const res = await api.updateEditorSettings(data);
    if (res?.settings) {
      setSettings((prev) => {
        const next = { ...prev, ...res.settings };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      return res.settings;
    }
    throw new Error(res?.error || 'Failed to update editor preferences.');
  };

  // Save Collaboration Settings
  const saveCollaborationSettings = async (data) => {
    const res = await api.updateCollaborationSettings(data);
    if (res?.settings) {
      setSettings((prev) => {
        const next = { ...prev, ...res.settings };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      return res.settings;
    }
    throw new Error(res?.error || 'Failed to update collaboration settings.');
  };

  // Save Notification Preferences
  const saveNotificationSettings = async (data) => {
    const res = await api.updateNotificationSettings(data);
    if (res?.settings) {
      setSettings((prev) => {
        const next = { ...prev, ...res.settings };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      return res.settings;
    }
    throw new Error(res?.error || 'Failed to update notification settings.');
  };

  // Change Password
  const changePassword = async (data) => {
    return api.changePassword(data);
  };

  // Delete Account
  const deleteAccount = async (data) => {
    const res = await api.deleteAccount(data);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return res;
  };

  const value = {
    settings,
    loading,
    saveThemeSettings,
    previewTheme,
    changeTheme,
    saveProfileSettings,
    saveEditorSettings,
    saveCollaborationSettings,
    saveNotificationSettings,
    changePassword,
    deleteAccount,
    refreshSettings
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
