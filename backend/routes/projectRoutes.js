import express from 'express';
import {
  getProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  getMembers,
  createInvitation,
  revokeInvitation,
  updateMemberRole,
  removeMember,
  toggleApprovalMode
} from '../controllers/projectController.js';
import {
  getChangeRequests,
  getChangeRequest,
  createChangeRequest,
  reviewChangeRequest
} from '../controllers/changeRequestController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', getProjects);
router.post('/', createProject);
router.get('/:id', getProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Project Owner Approval Mode
router.put('/:id/approval-mode', toggleApprovalMode);

// Change Requests (Role-based permissions & Owner approval workflow)
router.get('/:id/change-requests', getChangeRequests);
router.post('/:id/change-requests', createChangeRequest);
router.get('/:id/change-requests/:requestId', getChangeRequest);
router.post('/:id/change-requests/:requestId/review', reviewChangeRequest);

// Members and project invitations
router.get('/:id/members', getMembers);
router.post('/:id/invitations', createInvitation);
router.delete('/:id/invitations/:invitationId', revokeInvitation);
router.put('/:id/members/:userId', updateMemberRole);
router.delete('/:id/members/:userId', removeMember);

export default router;

