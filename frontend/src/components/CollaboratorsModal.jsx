import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Mail,
  Trash2,
  Share2,
  Copy,
  Check,
  Loader2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function CollaboratorsModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  userRole = 'editor',
  currentUserId,
  onShowToast
}) {
  const [members, setMembers] = useState([]);
  const [owner, setOwner] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const isOwner = userRole === 'owner';

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const data = await api.getProjectMembers(projectId);
      setOwner(data.owner);
      setMembers(data.members || []);
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('[CollaboratorsModal] Error loading members:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setInviteError(null);
      setInviteEmail('');
      setInviteRole('editor');
      setDeletingUserId(null);
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteError('Please provide a valid email address.');
      return;
    }

    setInviteError(null);
    setIsInviting(true);
    try {
      const res = await api.inviteCollaborator(projectId, {
        email: inviteEmail.trim(),
        role: inviteRole
      });
      setInviteEmail('');
      if (res?.invitation) {
        setInvitations((prev) => [res.invitation, ...prev]);
      }
      if (onShowToast) {
        onShowToast(`Invitation sent to "${inviteEmail.trim()}" as ${inviteRole}!`, 'success');
      }
    } catch (err) {
      setInviteError(err.message || 'Failed to send invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevokeInvite = async (invitationId, email) => {
    try {
      await api.revokeInvitation(projectId, invitationId);
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      if (onShowToast) {
        onShowToast(`Revoked invitation for "${email}"`, 'info');
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Failed to revoke invitation', 'error');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      const res = await api.updateMemberRole(projectId, userId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role: res.member.role } : m))
      );
      if (onShowToast) {
        onShowToast(`Updated member role to ${newRole}`, 'success');
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Failed to update role', 'error');
    }
  };

  const handleRemoveMember = async (userId, memberName) => {
    try {
      await api.removeMember(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setDeletingUserId(null);
      if (onShowToast) {
        onShowToast(`Removed ${memberName} from project`, 'info');
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Failed to remove member', 'error');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    if (onShowToast) onShowToast('Workspace link copied to clipboard!', 'info');
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog collaborators-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Users size={18} />
            </div>
            <div>
              <h2 className="modal-title">Project Collaborators</h2>
              <p className="modal-subtitle">
                Manage access roles and team members for <strong>{projectName}</strong>
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Quick Share Link Bar */}
        <div className="collaborators-share-bar">
          <div className="share-bar-left">
            <Share2 size={14} className="share-icon" />
            <span className="share-bar-text">Share Workspace Link</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyLink}>
            {copiedLink ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
            <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>

        {/* Invite Collaborator Form (Owner Only) */}
        {isOwner && (
          <div className="invite-form-card">
            <div className="invite-form-header">
              <UserPlus size={15} className="invite-icon" />
              <span>Invite Registered Collaborator</span>
            </div>

            {inviteError && (
              <div className="auth-error-banner" style={{ margin: '8px 0' }}>
                <AlertCircle size={15} />
                <span>{inviteError}</span>
              </div>
            )}

            <form onSubmit={handleSendInvite} className="invite-form">
              <div className="invite-inputs-row">
                <div className="input-with-icon flex-2">
                  <Mail size={15} className="input-icon" />
                  <input
                    type="email"
                    className="modal-input"
                    placeholder="User's registered email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={isInviting}
                    required
                  />
                </div>

                <div className="role-select-wrap flex-1">
                  <select
                    className="modal-input modal-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    disabled={isInviting}
                  >
                    <option value="editor">Editor (Can edit)</option>
                    <option value="viewer">Viewer (Read-only)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-invite-submit"
                  disabled={isInviting || !inviteEmail.trim()}
                >
                  {isInviting ? <Loader2 size={15} className="spinning" /> : <UserPlus size={15} />}
                  <span>Invite</span>
                </button>
              </div>
              <span className="invite-hint">
                Collaborators must already have a CodeCollab account. They will receive an in-app invite upon login.
              </span>
            </form>
          </div>
        )}

        {/* Members & Invitations Content */}
        <div className="collaborators-body">
          {isLoading ? (
            <div className="collaborators-loading">
              <Loader2 size={24} className="spinning" />
              <p>Loading project members...</p>
            </div>
          ) : (
            <>
              {/* Active Members Section */}
              <div className="members-section">
                <h3 className="section-title">
                  <span>Project Members</span>
                  <span className="count-badge">{(members?.length || 0) + (owner ? 1 : 0)}</span>
                </h3>

                <div className="members-list">
                  {/* Owner Row */}
                  {owner && (
                    <div className="member-row owner-row">
                      <div className="member-avatar" style={{ backgroundColor: '#6366f1' }}>
                        <span>{owner.name?.slice(0, 2).toUpperCase() || 'OW'}</span>
                      </div>
                      <div className="member-info">
                        <div className="member-name-row">
                          <span className="member-name">{owner.name}</span>
                          <span className="role-chip chip-owner">
                            <ShieldCheck size={11} />
                            <span>Owner</span>
                          </span>
                        </div>
                        <span className="member-email">{owner.email}</span>
                      </div>
                    </div>
                  )}

                  {/* Members Rows */}
                  {members.map((member) => {
                    const isSelf = member.user_id === currentUserId;
                    const isConfirming = deletingUserId === member.user_id;

                    return (
                      <div key={member.id || member.user_id} className="member-row">
                        <div className="member-avatar" style={{ backgroundColor: '#10b981' }}>
                          <span>{member.name?.slice(0, 2).toUpperCase() || 'U'}</span>
                        </div>
                        <div className="member-info">
                          <div className="member-name-row">
                            <span className="member-name">
                              {member.name} {isSelf && '(You)'}
                            </span>
                            <span className={`role-chip chip-${member.role}`}>
                              {member.role === 'editor' ? <Shield size={11} /> : <ShieldAlert size={11} />}
                              <span>{member.role === 'editor' ? 'Editor' : 'Viewer'}</span>
                            </span>
                          </div>
                          <span className="member-email">{member.email}</span>
                        </div>

                        {/* Controls (Owner can change role or remove) */}
                        <div className="member-controls">
                          {isOwner && (
                            <select
                              className="role-change-select"
                              value={member.role}
                              onChange={(e) => handleChangeRole(member.user_id, e.target.value)}
                            >
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          )}

                          {(isOwner || isSelf) && (
                            isConfirming ? (
                              <div className="delete-confirm-chip">
                                <button
                                  type="button"
                                  className="btn-delete-confirm-sm"
                                  onClick={() => handleRemoveMember(member.user_id, member.name)}
                                >
                                  {isSelf ? 'Leave' : 'Remove'}
                                </button>
                                <button
                                  type="button"
                                  className="btn-card-action"
                                  onClick={() => setDeletingUserId(null)}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn-card-action danger"
                                onClick={() => setDeletingUserId(member.user_id)}
                                title={isSelf ? 'Leave project' : 'Remove member'}
                              >
                                <Trash2 size={13} />
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pending Invitations Section (Owner Only) */}
              {isOwner && invitations.length > 0 && (
                <div className="invitations-section">
                  <h3 className="section-title">
                    <span>Pending Invitations</span>
                    <span className="count-badge">{invitations.length}</span>
                  </h3>

                  <div className="invitations-list">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="invitation-row">
                        <div className="invitation-info">
                          <div className="invitation-email-row">
                            <Mail size={13} className="invitation-icon" />
                            <span className="invitation-email">{inv.invited_email}</span>
                            <span className={`role-chip chip-${inv.role}`}>
                              {inv.role === 'editor' ? 'Editor' : 'Viewer'}
                            </span>
                          </div>
                          <span className="invitation-meta">
                            <Clock size={11} />
                            <span>Expires in 7 days</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          className="btn-revoke-invite"
                          onClick={() => handleRevokeInvite(inv.id, inv.invited_email)}
                          title="Revoke invitation"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
