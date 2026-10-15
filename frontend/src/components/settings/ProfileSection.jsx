import './ProfileSection.css';
import { useState, useEffect } from 'react';
import { User, Mail, Camera, Loader2, Check, AlertCircle, FileText } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useSettings } from '../../context/useSettings';

export default function ProfileSection({ onShowToast }) {
  const { user } = useAuth();
  const { settings, saveProfileSettings } = useSettings();

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (settings) {
      setDisplayName(settings.display_name || user?.name || '');
      setAvatarUrl(settings.avatar_url || '');
      setBio(settings.bio || '');
      setImageError(false);
    }
  }, [settings, user]);

  const handleAvatarUrlChange = (e) => {
    setAvatarUrl(e.target.value);
    setImageError(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim() || displayName.trim().length < 2) {
      onShowToast?.('Display name must be at least 2 characters.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await saveProfileSettings({
        displayName: displayName.trim(),
        avatarUrl: avatarUrl.trim(),
        bio: bio.trim()
      });
      onShowToast?.('Profile updated successfully!', 'success');
    } catch (err) {
      onShowToast?.(err.message || 'Failed to update profile.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = displayName
    ? displayName.trim().slice(0, 2).toUpperCase()
    : user?.initials || 'U';

  const hasChanges =
    displayName.trim() !== (settings?.display_name || user?.name || '') ||
    avatarUrl.trim() !== (settings?.avatar_url || '') ||
    bio.trim() !== (settings?.bio || '');

  return (
    <form className="settings-section-form" onSubmit={handleSubmit}>
      <div className="settings-section-header">
        <h2 className="section-title">Profile</h2>
        <p className="section-subtitle">
          Manage your personal details, public profile name, and developer avatar.
        </p>
      </div>

      {/* Avatar Preview & URL */}
      <div className="settings-card">
        <h3 className="card-heading">Avatar Preview</h3>
        <div className="avatar-preview-row">
          <div className="profile-avatar-container">
            {avatarUrl && !imageError ? (
              <img
                src={avatarUrl}
                alt={displayName || 'Avatar'}
                className="profile-avatar-image"
                onError={() => setImageError(true)}
              />
            ) : (
              <div
                className="profile-avatar-placeholder"
                style={{ backgroundColor: user?.color || '#6366f1' }}
              >
                <span>{initials}</span>
              </div>
            )}
            <div className="profile-avatar-badge" title="Developer Avatar">
              <Camera size={13} />
            </div>
          </div>

          <div className="avatar-info-col">
            <span className="avatar-hint-title">Custom Avatar Image</span>
            <span className="avatar-hint-desc">
              Provide a direct image URL (PNG, JPG, or SVG). If left blank or invalid, your initials will be used.
            </span>
            {imageError && (
              <span className="avatar-error-text">
                <AlertCircle size={12} /> Unable to load image from URL.
              </span>
            )}
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1.25rem' }}>
          <label htmlFor="profile-avatar-url" className="form-label">
            Avatar Image URL
          </label>
          <input
            id="profile-avatar-url"
            type="url"
            className="form-input"
            placeholder="https://example.com/my-photo.jpg"
            value={avatarUrl}
            onChange={handleAvatarUrlChange}
          />
        </div>
      </div>

      {/* Display Name & Email */}
      <div className="settings-card">
        <h3 className="card-heading">Account Information</h3>
        <div className="form-grid-2">
          <div className="form-group">
            <label htmlFor="profile-display-name" className="form-label">
              Display Name <span className="label-required">*</span>
            </label>
            <div className="input-with-icon">
              <User size={15} className="input-icon" />
              <input
                id="profile-display-name"
                type="text"
                className="form-input has-icon"
                placeholder="Alex Rivera"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                required
              />
            </div>
            <span className="form-helper">Visible to collaborators in code sessions and live chat.</span>
          </div>

          <div className="form-group">
            <label htmlFor="profile-email" className="form-label">
              Email Address
            </label>
            <div className="input-with-icon">
              <Mail size={15} className="input-icon" />
              <input
                id="profile-email"
                type="email"
                className="form-input has-icon is-readonly"
                value={settings?.email || user?.email || ''}
                readOnly
                disabled
              />
            </div>
            <span className="form-helper">Associated with your authentication credentials (read-only).</span>
          </div>
        </div>

        {/* Short Bio */}
        <div className="form-group" style={{ marginTop: '1.25rem' }}>
          <div className="bio-label-row">
            <label htmlFor="profile-bio" className="form-label">
              Developer Bio / About
            </label>
            <span className="bio-char-counter">{bio.length} / 250</span>
          </div>
          <textarea
            id="profile-bio"
            className="form-textarea"
            rows={3}
            placeholder="Full-stack engineer passionate about cloud architecture, real-time collaboration, and developer tools..."
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 250))}
          />
          <span className="form-helper">A brief description shown when team members inspect your profile.</span>
        </div>
      </div>

      {/* Save Button */}
      <div className="settings-action-bar">
        <button
          type="submit"
          className="btn btn-primary btn-save"
          disabled={isSubmitting || !hasChanges}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={15} className="spin-icon" />
              <span>Saving Profile...</span>
            </>
          ) : (
            <>
              <Check size={15} />
              <span>Save Profile</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
