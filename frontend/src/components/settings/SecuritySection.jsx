import './SecuritySection.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, KeyRound, Eye, EyeOff, Loader2, Check, LogOut, Lock, Sparkles, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useSettings } from '../../context/useSettings';

export default function SecuritySection({ onShowToast }) {
  const { logout } = useAuth();
  const { changePassword } = useSettings();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      onShowToast?.('Current password is required.', 'error');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      onShowToast?.('New password must be at least 6 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      onShowToast?.('New password and confirmation do not match.', 'error');
      return;
    }

    if (currentPassword === newPassword) {
      onShowToast?.('New password must be different from your current password.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onShowToast?.('Password changed successfully!', 'success');
    } catch (err) {
      onShowToast?.(err.message || 'Failed to update password.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeviceLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      onShowToast?.('Logout failed. Please try again.', 'error');
      setIsLoggingOut(false);
    }
  };

  const isFormValid =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    confirmPassword.length >= 6 &&
    newPassword === confirmPassword;

  return (
    <div className="settings-section-form">
      <div className="settings-section-header">
        <h2 className="section-title">Security</h2>
        <p className="section-subtitle">
          Manage your account credentials, password authentication, and session security.
        </p>
      </div>

      {/* Change Password Card */}
      <div className="settings-card">
        <h3 className="card-heading">Change Password</h3>
        <form onSubmit={handleSubmit} className="security-password-form">
          {/* Current Password */}
          <div className="form-group">
            <label htmlFor="sec-current-password" className="form-label">
              Current Password <span className="label-required">*</span>
            </label>
            <div className="input-with-icon">
              <KeyRound size={15} className="input-icon" />
              <input
                id="sec-current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                className="form-input has-icon has-toggle"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                title={showCurrentPassword ? 'Hide password' : 'Show password'}
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* New Password & Confirm Password Grid */}
          <div className="form-grid-2" style={{ marginTop: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="sec-new-password" className="form-label">
                New Password <span className="label-required">*</span>
              </label>
              <div className="input-with-icon">
                <Lock size={15} className="input-icon" />
                <input
                  id="sec-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  className="form-input has-icon has-toggle"
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                >
                  {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <span className="form-helper">At least 6 characters. Use letters, numbers & symbols.</span>
            </div>

            <div className="form-group">
              <label htmlFor="sec-confirm-password" className="form-label">
                Confirm New Password <span className="label-required">*</span>
              </label>
              <div className="input-with-icon">
                <Lock size={15} className="input-icon" />
                <input
                  id="sec-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input has-icon has-toggle"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <span className="password-mismatch-error">Passwords do not match</span>
              )}
            </div>
          </div>

          <div className="settings-action-bar" style={{ marginTop: '1.25rem' }}>
            <button
              type="submit"
              className="btn btn-primary btn-save"
              disabled={isSubmitting || !isFormValid}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="spin-icon" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Two-Factor Authentication Card (Coming Soon) */}
      <div className="settings-card two-factor-card">
        <div className="two-factor-header">
          <div className="two-factor-title-row">
            <Shield size={18} className="item-icon-accent" />
            <h3 className="card-heading" style={{ margin: 0, padding: 0, border: 'none' }}>
              Two-Factor Authentication (2FA)
            </h3>
            <span className="badge-coming-soon">Coming Soon</span>
          </div>
          <p className="settings-card-desc" style={{ margin: '0.5rem 0 0 0' }}>
            Add an extra layer of security to your CodeCollab account by requiring a time-based one-time password (TOTP) from an authenticator app (e.g. Google Authenticator or 1Password) when signing in.
          </p>
        </div>
      </div>

      {/* Session Management */}
      <div className="settings-card">
        <h3 className="card-heading">Active Sessions</h3>
        <p className="settings-card-desc">
          You are currently signed in on this device. Logging out will invalidate your local session cookie and require you to sign back in.
        </p>

        <div className="session-logout-row">
          <div className="session-device-info">
            <span className="device-title">Current Browser Session</span>
            <span className="device-status">Active now • HttpOnly secure token</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-logout-device"
            onClick={handleDeviceLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <>
                <Loader2 size={14} className="spin-icon" />
                <span>Logging Out...</span>
              </>
            ) : (
              <>
                <LogOut size={14} />
                <span>Log Out from this Device</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
