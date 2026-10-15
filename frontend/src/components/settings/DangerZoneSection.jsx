import './DangerZoneSection.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, KeyRound, Loader2, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useSettings } from '../../context/useSettings';

export default function DangerZoneSection({ onShowToast }) {
  const { logout } = useAuth();
  const { deleteAccount } = useSettings();
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async (e) => {
    e.preventDefault();
    if (confirmText !== 'DELETE') {
      setError('You must type DELETE in all uppercase to proceed.');
      return;
    }

    if (!password) {
      setError('Your password is required to confirm account deletion.');
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await deleteAccount({ password, confirmText });
      setIsModalOpen(false);
      await logout();
      navigate('/login?deleted=true', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to delete account. Please verify your password.');
      setIsDeleting(false);
    }
  };

  const isConfirmed = confirmText === 'DELETE' && password.length > 0;

  return (
    <div className="settings-section-form">
      <div className="settings-section-header">
        <h2 className="section-title text-danger-title">Danger Zone</h2>
        <p className="section-subtitle">
          Irreversible actions and permanent account deletion. Please proceed with caution.
        </p>
      </div>

      {/* Delete Account Warning Card */}
      <div className="settings-card danger-card">
        <div className="danger-card-header">
          <div className="danger-icon-badge">
            <AlertTriangle size={20} />
          </div>
          <div className="danger-header-info">
            <h3 className="danger-title">Delete Account</h3>
            <p className="danger-desc">
              Permanently delete your developer profile, all owned collaborative projects, version checkpoints, comments, and settings. This action cannot be reversed.
            </p>
          </div>
        </div>

        <div className="danger-consequences-list">
          <div className="consequence-item">
            <span className="consequence-bullet">•</span>
            <span>All projects where you are the owner will be permanently deleted for all collaborators.</span>
          </div>
          <div className="consequence-item">
            <span className="consequence-bullet">•</span>
            <span>You will be removed from all team memberships and pending project invitations.</span>
          </div>
          <div className="consequence-item">
            <span className="consequence-bullet">•</span>
            <span>Your stored code files and commit history checkpoints will be permanently expunged.</span>
          </div>
        </div>

        <div className="danger-action-row">
          <button
            type="button"
            className="btn btn-danger btn-delete-trigger"
            onClick={() => {
              setIsModalOpen(true);
              setPassword('');
              setConfirmText('');
              setError(null);
            }}
          >
            <Trash2 size={15} />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isModalOpen && (
        <div className="danger-modal-backdrop" onClick={() => !isDeleting && setIsModalOpen(false)}>
          <div
            className="danger-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="danger-modal-title"
          >
            <div className="danger-modal-header">
              <div className="modal-title-with-icon">
                <ShieldAlert size={18} className="danger-shield-icon" />
                <h3 id="danger-modal-title">Confirm Account Deletion</h3>
              </div>
              <button
                type="button"
                className="modal-close-icon"
                onClick={() => !isDeleting && setIsModalOpen(false)}
                disabled={isDeleting}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <p className="danger-modal-intro">
              This action is <strong>permanent</strong> and cannot be undone. To verify your intent, enter your password and type <code>DELETE</code> below.
            </p>

            {error && <div className="danger-modal-error">{error}</div>}

            <form onSubmit={handleDelete} className="danger-modal-form">
              <div className="form-group">
                <label htmlFor="delete-account-password" className="form-label">
                  Current Password
                </label>
                <div className="input-with-icon">
                  <KeyRound size={15} className="input-icon" />
                  <input
                    id="delete-account-password"
                    type="password"
                    className="form-input has-icon"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '0.85rem' }}>
                <label htmlFor="delete-account-confirm" className="form-label">
                  Type <span className="delete-code-highlight">DELETE</span> to confirm
                </label>
                <input
                  id="delete-account-confirm"
                  type="text"
                  className="form-input"
                  placeholder="DELETE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="danger-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger btn-confirm-delete"
                  disabled={!isConfirmed || isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={14} className="spin-icon" />
                      <span>Deleting Account...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
