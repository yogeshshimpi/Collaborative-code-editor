import {
  listFileVersions,
  getSingleVersionPreview,
  createManualSnapshot,
  restoreVersionSnapshot
} from '../services/versionService.js';
import { logActivity } from '../services/activityService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getVersions = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId || req.params[0];
  const rawFileName = req.query.file || req.params.fileName || (req.params[1] ? decodeURIComponent(req.params[1]) : '');

  const data = await listFileVersions(roomId, rawFileName, req.user.id);
  res.json(data);
});

export const getVersion = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId || req.params[0];
  const rawFileName = req.query.file || req.params.fileName || (req.params[1] ? decodeURIComponent(req.params[1]) : '');
  const versionId = req.params.versionId || req.params[2];

  const version = await getSingleVersionPreview(roomId, rawFileName, versionId, req.user.id);
  res.json({ version });
});

export const createVersion = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId || req.params[0];
  const rawFileName = req.query.file || req.params.fileName || (req.params[1] ? decodeURIComponent(req.params[1]) : '');
  const { label, content } = req.body;

  const newVersion = await createManualSnapshot({
    roomId,
    rawFileName,
    content,
    label,
    userId: req.user.id
  });

  res.status(201).json({
    message: 'Snapshot created successfully.',
    version: newVersion
  });
});

export const restoreVersion = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId || req.params[0];
  const rawFileName = req.query.file || req.params.fileName || (req.params[1] ? decodeURIComponent(req.params[1]) : '');
  const versionId = req.params.versionId || req.params[2];

  const { restored, targetRoom, project } = await restoreVersionSnapshot({
    roomId,
    rawFileName,
    versionId,
    userId: req.user.id
  });

  const io = req.app.get('io');
  if (io) {
    io.to(targetRoom).emit('code-change', {
      fileName: restored.fileName,
      content: restored.content
    });
    if (targetRoom !== roomId) {
      io.to(roomId).emit('code-change', {
        fileName: restored.fileName,
        content: restored.content
      });
    }

    io.to(targetRoom).emit('save-status', {
      status: 'saved',
      fileName: restored.fileName,
      savedAt: new Date().toISOString()
    });
  }

  logActivity({
    roomId: targetRoom,
    projectId: project?.id || null,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    actionType: 'file_restore',
    targetName: restored.fileName,
    details: { restoredFromId: versionId, newVersionId: restored.newVersionId },
    summary: `${req.user.name} restored ${restored.fileName} to an earlier version`
  }).then((act) => {
    if (act && io) {
      io.to(targetRoom).emit('activity-log-entry', act);
      if (targetRoom !== roomId) io.to(roomId).emit('activity-log-entry', act);
    }
  }).catch(() => {});

  res.json({
    message: `Successfully restored ${restored.fileName} from previous version.`,
    fileName: restored.fileName,
    content: restored.content,
    newVersionId: restored.newVersionId
  });
});

export default {
  getVersions,
  getVersion,
  createVersion,
  restoreVersion
};
