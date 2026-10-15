import { pool, isDbConnected } from './index.js';
import { updateUserName } from './users.js';

export const DEFAULT_USER_SETTINGS = {
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

export const inMemoryUserSettings = new Map();

/**
 * Get settings for a user. If no row exists yet, initialize a default row.
 */
export async function getSettingsByUserId(userId, fallbackName = '') {
  if (!userId) return null;

  if (isDbConnected() && pool) {
    const query = `
      SELECT 
        user_id, display_name, avatar_url, bio,
        editor_font_size, tab_size, word_wrap, show_line_numbers, show_minimap, editor_theme, project_theme,
        show_live_cursors, show_collaborator_labels, autosave_delay,
        chat_notifications, mention_notifications, comment_notifications, invitation_notifications, notification_sound,
        created_at, updated_at
      FROM user_settings
      WHERE user_id = $1;
    `;
    const res = await pool.query(query, [userId]);
    if (res.rows.length > 0) {
      return res.rows[0];
    }

    // Initialize default row for user in DB
    const insertQuery = `
      INSERT INTO user_settings (
        user_id, display_name, avatar_url, bio,
        editor_font_size, tab_size, word_wrap, show_line_numbers, show_minimap, editor_theme, project_theme,
        show_live_cursors, show_collaborator_labels, autosave_delay,
        chat_notifications, mention_notifications, comment_notifications, invitation_notifications, notification_sound
      ) VALUES (
        $1, $2, '', '',
        $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16, $17
      )
      ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
      RETURNING *;
    `;
    const insertRes = await pool.query(insertQuery, [
      userId,
      fallbackName.trim(),
      DEFAULT_USER_SETTINGS.editor_font_size,
      DEFAULT_USER_SETTINGS.tab_size,
      DEFAULT_USER_SETTINGS.word_wrap,
      DEFAULT_USER_SETTINGS.show_line_numbers,
      DEFAULT_USER_SETTINGS.show_minimap,
      DEFAULT_USER_SETTINGS.editor_theme,
      DEFAULT_USER_SETTINGS.project_theme,
      DEFAULT_USER_SETTINGS.show_live_cursors,
      DEFAULT_USER_SETTINGS.show_collaborator_labels,
      DEFAULT_USER_SETTINGS.autosave_delay,
      DEFAULT_USER_SETTINGS.chat_notifications,
      DEFAULT_USER_SETTINGS.mention_notifications,
      DEFAULT_USER_SETTINGS.comment_notifications,
      DEFAULT_USER_SETTINGS.invitation_notifications,
      DEFAULT_USER_SETTINGS.notification_sound
    ]);
    return insertRes.rows[0];
  }

  // Fallback in-memory
  let settings = inMemoryUserSettings.get(userId);
  if (!settings) {
    settings = {
      user_id: userId,
      ...DEFAULT_USER_SETTINGS,
      display_name: fallbackName.trim(),
      created_at: new Date(),
      updated_at: new Date()
    };
    inMemoryUserSettings.set(userId, settings);
  }
  return { ...settings };
}

/**
 * Update Whole Project Theme & Editor Theme
 */
export async function updateThemeSettings(userId, { projectTheme, editorTheme }) {
  if (!userId) return null;

  const validThemes = ['navy', 'midnight', 'cyberpunk', 'emerald', 'ocean', 'light', 'system'];
  const theme = validThemes.includes(projectTheme) ? projectTheme : 'navy';
  const edTheme = editorTheme || (theme === 'light' ? 'light' : 'dark');

  if (isDbConnected() && pool) {
    const query = `
      INSERT INTO user_settings (
        user_id, project_theme, editor_theme, updated_at
      ) VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        project_theme = $2,
        editor_theme = $3,
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(query, [userId, theme, edTheme]);
    return res.rows[0];
  }

  // Fallback in-memory
  const current = await getSettingsByUserId(userId);
  const updated = {
    ...current,
    project_theme: theme,
    editor_theme: edTheme,
    updated_at: new Date()
  };
  inMemoryUserSettings.set(userId, updated);
  return { ...updated };
}

/**
 * Update Profile Settings (display_name, avatar_url, bio)
 */
export async function updateProfileSettings(userId, { displayName, avatarUrl, bio }) {
  if (!userId) return null;

  const cleanName = typeof displayName === 'string' ? displayName.trim() : undefined;
  const cleanAvatar = typeof avatarUrl === 'string' ? avatarUrl.trim() : '';
  const cleanBio = typeof bio === 'string' ? bio.trim().slice(0, 500) : '';

  // Synchronize with users.name if displayName is provided
  if (cleanName) {
    await updateUserName(userId, cleanName);
  }

  if (isDbConnected() && pool) {
    const query = `
      INSERT INTO user_settings (user_id, display_name, avatar_url, bio, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        display_name = COALESCE($2, user_settings.display_name),
        avatar_url = $3,
        bio = $4,
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(query, [userId, cleanName, cleanAvatar, cleanBio]);
    return res.rows[0];
  }

  // Fallback in-memory
  const current = await getSettingsByUserId(userId, cleanName || '');
  const updated = {
    ...current,
    display_name: cleanName !== undefined ? cleanName : current.display_name,
    avatar_url: cleanAvatar,
    bio: cleanBio,
    updated_at: new Date()
  };
  inMemoryUserSettings.set(userId, updated);
  return { ...updated };
}

/**
 * Update Monaco Editor Preferences
 */
export async function updateEditorSettings(userId, {
  editorFontSize,
  tabSize,
  wordWrap,
  showLineNumbers,
  showMinimap,
  editorTheme
}) {
  if (!userId) return null;

  // Validate bounds
  const fontSize = Math.min(Math.max(Number(editorFontSize) || 14, 12), 24);
  const tabs = Number(tabSize) === 4 ? 4 : 2;
  const wrap = Boolean(wordWrap);
  const lineNumbers = Boolean(showLineNumbers);
  const minimap = Boolean(showMinimap);
  const theme = ['dark', 'light', 'system'].includes(editorTheme) ? editorTheme : 'dark';

  if (isDbConnected() && pool) {
    const query = `
      INSERT INTO user_settings (
        user_id, editor_font_size, tab_size, word_wrap, show_line_numbers, show_minimap, editor_theme, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        editor_font_size = $2,
        tab_size = $3,
        word_wrap = $4,
        show_line_numbers = $5,
        show_minimap = $6,
        editor_theme = $7,
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(query, [userId, fontSize, tabs, wrap, lineNumbers, minimap, theme]);
    return res.rows[0];
  }

  // Fallback in-memory
  const current = await getSettingsByUserId(userId);
  const updated = {
    ...current,
    editor_font_size: fontSize,
    tab_size: tabs,
    word_wrap: wrap,
    show_line_numbers: lineNumbers,
    show_minimap: minimap,
    editor_theme: theme,
    updated_at: new Date()
  };
  inMemoryUserSettings.set(userId, updated);
  return { ...updated };
}

/**
 * Update Collaboration Settings
 */
export async function updateCollaborationSettings(userId, {
  showLiveCursors,
  showCollaboratorLabels,
  autosaveDelay
}) {
  if (!userId) return null;

  const cursors = Boolean(showLiveCursors);
  const labels = Boolean(showCollaboratorLabels);
  const delay = [1, 2, 5].includes(Number(autosaveDelay)) ? Number(autosaveDelay) : 2;

  if (isDbConnected() && pool) {
    const query = `
      INSERT INTO user_settings (
        user_id, show_live_cursors, show_collaborator_labels, autosave_delay, updated_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        show_live_cursors = $2,
        show_collaborator_labels = $3,
        autosave_delay = $4,
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(query, [userId, cursors, labels, delay]);
    return res.rows[0];
  }

  // Fallback in-memory
  const current = await getSettingsByUserId(userId);
  const updated = {
    ...current,
    show_live_cursors: cursors,
    show_collaborator_labels: labels,
    autosave_delay: delay,
    updated_at: new Date()
  };
  inMemoryUserSettings.set(userId, updated);
  return { ...updated };
}

/**
 * Update Notification Preferences
 */
export async function updateNotificationSettings(userId, {
  chatNotifications,
  mentionNotifications,
  commentNotifications,
  invitationNotifications,
  notificationSound
}) {
  if (!userId) return null;

  const chat = Boolean(chatNotifications);
  const mention = Boolean(mentionNotifications);
  const comment = Boolean(commentNotifications);
  const invitation = Boolean(invitationNotifications);
  const sound = Boolean(notificationSound);

  if (isDbConnected() && pool) {
    const query = `
      INSERT INTO user_settings (
        user_id, chat_notifications, mention_notifications, comment_notifications, invitation_notifications, notification_sound, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        chat_notifications = $2,
        mention_notifications = $3,
        comment_notifications = $4,
        invitation_notifications = $5,
        notification_sound = $6,
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(query, [userId, chat, mention, comment, invitation, sound]);
    return res.rows[0];
  }

  // Fallback in-memory
  const current = await getSettingsByUserId(userId);
  const updated = {
    ...current,
    chat_notifications: chat,
    mention_notifications: mention,
    comment_notifications: comment,
    invitation_notifications: invitation,
    notification_sound: sound,
    updated_at: new Date()
  };
  inMemoryUserSettings.set(userId, updated);
  return { ...updated };
}

/**
 * Delete settings for a user
 */
export async function deleteSettingsByUserId(userId) {
  if (!userId) return false;

  if (isDbConnected() && pool) {
    const query = `DELETE FROM user_settings WHERE user_id = $1;`;
    const res = await pool.query(query, [userId]);
    return res.rowCount > 0;
  }

  return inMemoryUserSettings.delete(userId);
}

export default {
  DEFAULT_USER_SETTINGS,
  getSettingsByUserId,
  updateThemeSettings,
  updateProfileSettings,
  updateEditorSettings,
  updateCollaborationSettings,
  updateNotificationSettings,
  deleteSettingsByUserId
};
