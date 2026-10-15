import {
  getSettingsByUserId,
  updateProfileSettings,
  updateEditorSettings,
  updateCollaborationSettings,
  updateNotificationSettings,
  updateThemeSettings
} from '../db/settings.js';
import { deleteUserAccount } from '../services/authService.js';
import { COOKIE_NAME, CLEAR_COOKIE_OPTIONS } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

export const getSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const settings = await getSettingsByUserId(userId, req.user.name);
  res.json({
    settings: {
      ...settings,
      email: req.user.email
    }
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { displayName, avatarUrl, bio } = req.body;

  if (displayName !== undefined && (!displayName || displayName.trim().length < 2)) {
    throw new ApiError(400, 'Display name must have at least 2 characters.');
  }

  const settings = await updateProfileSettings(userId, { displayName, avatarUrl, bio });
  res.json({
    settings: {
      ...settings,
      email: req.user.email
    },
    message: 'Profile updated successfully.'
  });
});

export const updateEditor = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    editorFontSize,
    tabSize,
    wordWrap,
    showLineNumbers,
    showMinimap,
    editorTheme
  } = req.body;

  const settings = await updateEditorSettings(userId, {
    editorFontSize,
    tabSize,
    wordWrap,
    showLineNumbers,
    showMinimap,
    editorTheme
  });

  res.json({
    settings: {
      ...settings,
      email: req.user.email
    },
    message: 'Editor preferences saved.'
  });
});

export const updateCollaboration = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    showLiveCursors,
    showCollaboratorLabels,
    autosaveDelay
  } = req.body;

  const settings = await updateCollaborationSettings(userId, {
    showLiveCursors,
    showCollaboratorLabels,
    autosaveDelay
  });

  res.json({
    settings: {
      ...settings,
      email: req.user.email
    },
    message: 'Collaboration settings saved.'
  });
});

export const updateNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const {
    chatNotifications,
    mentionNotifications,
    commentNotifications,
    invitationNotifications,
    notificationSound
  } = req.body;

  const settings = await updateNotificationSettings(userId, {
    chatNotifications,
    mentionNotifications,
    commentNotifications,
    invitationNotifications,
    notificationSound
  });

  res.json({
    settings: {
      ...settings,
      email: req.user.email
    },
    message: 'Notification settings saved.'
  });
});

export const updateTheme = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { projectTheme, editorTheme } = req.body;

  const settings = await updateThemeSettings(userId, { projectTheme, editorTheme });
  res.json({
    settings: {
      ...settings,
      email: req.user.email
    },
    message: 'Appearance & theme saved.'
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { password, confirmText } = req.body;

  if (confirmText !== 'DELETE') {
    throw new ApiError(400, 'Please type DELETE to confirm account deletion.');
  }

  const result = await deleteUserAccount(userId, password);
  res.clearCookie(COOKIE_NAME, CLEAR_COOKIE_OPTIONS);
  res.json(result);
});

export default {
  getSettings,
  updateProfile,
  updateTheme,
  updateEditor,
  updateCollaboration,
  updateNotifications,
  deleteAccount
};
