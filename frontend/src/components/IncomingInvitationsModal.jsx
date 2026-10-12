import { useState } from 'react';
import {
  X,
  Mail,
  Shield,
  ShieldAlert,
  Check,
  User,
  Clock,
  Loader2,
  FolderCode
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

export default function IncomingInvitationsModal({ isOpen, onClose, onShowToast, onAccepted }) {
  const { invitations, invitationsLoading, respondInvitation } = useAuth();
  const [processingId, setProcessingId] = useState(null);

  if (!isOpen) return null;

  const handleRespond = async (invitationId, projectName, action) => {
    setProcessingId(invitationId);
    try {
      await respondInvitation(invitationId, action);
      if (action === 'accept') {
        if (onShowToast) onShowToast(`Accepted invitation to join "${projectName}"!`, 'success');
        if (onAccepted) onAccepted();
      } else {
        if (onShowToast) onShowToast(`Declined invitation for "${projectName}"`, 'info');
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Failed to process invitation', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog incoming-invites-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="modal-title">Project Invitations</h2>
              <p className="modal-subtitle">
                Accept or decline invitations to collaborate on CodeCollab projects
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="incoming-invites-body">
          {invitationsLoading ? (
            <div className="collaborators-loading">
              <Loader2 size={24} className="spinning" />
              <p>Loading invitations...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="dashboard-empty-state" style={{ padding: '36px 16px', background: 'transparent', border: 'none' }}>
              <div className="empty-icon-wrap">
                <FolderCode size={36} />
              </div>
              <h3>No pending invitations</h3>
              <p>When a teammate invites you to their project, it will appear here for you to accept.</p>
            </div>
          ) : (
            <div className="incoming-invites-list">
              {invitations.map((inv) => {
                const isProcessing = processingId === inv.id;

                return (
                  <div key={inv.id} className="incoming-invite-card">
                    <div className="invite-card-main">
                      <div className="invite-project-title-row">
                        <FolderCode size={16} className="text-primary-accent" />
                        <span className="invite-project-name">{inv.project_name}</span>
                        <span className={`role-chip chip-${inv.role}`}>
                          {inv.role === 'editor' ? <Shield size={11} /> : <ShieldAlert size={11} />}
                          <span>{inv.role === 'editor' ? 'Editor' : 'Viewer'}</span>
                        </span>
                      </div>

                      <div className="invite-details-row">
                        <span className="invite-from-badge">
                          <User size={12} />
                          <span>Invited by <strong>{inv.invited_by_name}</strong> ({inv.invited_by_email})</span>
                        </span>
                        {inv.created_at && (
                          <span className="invite-date-badge">
                            <Clock size={11} />
                            <span>{formatDate(inv.created_at)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="invite-card-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRespond(inv.id, inv.project_name, 'decline')}
                        disabled={isProcessing}
                      >
                        <X size={13} />
                        <span>Decline</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRespond(inv.id, inv.project_name, 'accept')}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 size={13} className="spinning" /> : <Check size={13} />}
                        <span>Accept & Join</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
