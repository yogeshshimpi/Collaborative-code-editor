import {
  listProjectChangeRequests,
  submitChangeRequest as serviceSubmitChangeRequest,
  reviewChangeRequest as serviceReviewChangeRequest
} from '../services/changeRequestService.js';
import { getChangeRequestById } from '../db/changeRequests.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

export const getChangeRequests = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const status = req.query.status || 'all';
  const data = await listProjectChangeRequests(id, req.user.id, status);
  res.json(data);
});

export const getChangeRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const cr = await getChangeRequestById(requestId);
  if (!cr) {
    throw new ApiError(404, 'Change request not found.');
  }
  res.json({ changeRequest: cr });
});

export const createChangeRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    requestType,
    targetPath,
    oldPath,
    proposedContent,
    originalContent,
    title,
    description
  } = req.body;

  const changeRequest = await serviceSubmitChangeRequest({
    projectIdOrRoomId: id,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    requestType,
    targetPath,
    oldPath,
    proposedContent,
    originalContent,
    title,
    description
  });

  const io = req.app.get('io');
  if (io && changeRequest.room_id) {
    io.to(changeRequest.room_id).emit('change-request-created', {
      roomId: changeRequest.room_id,
      changeRequest
    });
  }

  res.status(201).json({
    message: 'Change request submitted successfully for owner review.',
    changeRequest
  });
});

export const reviewChangeRequest = asyncHandler(async (req, res) => {
  const { id, requestId } = req.params;
  const { status, rejectionReason } = req.body;

  const { changeRequest, appliedResult, project } = await serviceReviewChangeRequest({
    projectIdOrRoomId: id,
    requestId,
    userId: req.user.id,
    userName: req.user.name,
    userEmail: req.user.email,
    status,
    rejectionReason
  });

  const io = req.app.get('io');
  const targetRoom = project.room_id || changeRequest.room_id;

  if (io && targetRoom) {
    if (status === 'approved') {
      io.to(targetRoom).emit('change-request-approved', {
        roomId: targetRoom,
        changeRequest,
        appliedResult
      });

      // Synchronize file state across active collaborator editors in the room
      if (appliedResult?.type === 'code_change') {
        io.to(targetRoom).emit('code-change', {
          roomId: targetRoom,
          filePath: appliedResult.filePath,
          code: appliedResult.content
        });
        io.to(targetRoom).emit('save-status', {
          roomId: targetRoom,
          filePath: appliedResult.filePath,
          status: 'saved'
        });
      } else if (appliedResult?.type === 'file_create') {
        io.to(targetRoom).emit('file-created', {
          roomId: targetRoom,
          fileName: appliedResult.filePath,
          content: appliedResult.content
        });
      } else if (appliedResult?.type === 'file_rename') {
        io.to(targetRoom).emit('file-renamed', {
          roomId: targetRoom,
          oldPath: appliedResult.oldPath,
          newPath: appliedResult.newPath
        });
      } else if (appliedResult?.type === 'file_delete') {
        io.to(targetRoom).emit('file-deleted', {
          roomId: targetRoom,
          filePath: appliedResult.filePath
        });
      } else if (appliedResult?.type === 'folder_create') {
        io.to(targetRoom).emit('folder-created', {
          roomId: targetRoom,
          folderPath: appliedResult.folderPath
        });
      } else if (appliedResult?.type === 'folder_rename') {
        io.to(targetRoom).emit('folder-renamed', {
          roomId: targetRoom,
          oldFolder: appliedResult.oldFolder,
          newFolder: appliedResult.newFolder,
          affectedFiles: appliedResult.affectedFiles
        });
      } else if (appliedResult?.type === 'folder_delete') {
        io.to(targetRoom).emit('folder-deleted', {
          roomId: targetRoom,
          folderPath: appliedResult.folderPath,
          deletedFiles: appliedResult.deletedFiles
        });
      } else if (appliedResult?.type === 'version_restore') {
        io.to(targetRoom).emit('file-restored', {
          roomId: targetRoom,
          filePath: appliedResult.filePath,
          content: appliedResult.content
        });
        io.to(targetRoom).emit('code-change', {
          roomId: targetRoom,
          filePath: appliedResult.filePath,
          code: appliedResult.content
        });
      }
    } else {
      io.to(targetRoom).emit('change-request-rejected', {
        roomId: targetRoom,
        changeRequest,
        rejectionReason: changeRequest.rejection_reason
      });
    }
  }

  res.json({
    message: `Change request "${changeRequest.title}" was ${status}.`,
    changeRequest,
    appliedResult
  });
});

export default {
  getChangeRequests,
  getChangeRequest,
  createChangeRequest,
  reviewChangeRequest
};
