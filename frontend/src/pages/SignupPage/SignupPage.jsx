import './SignupPage.css';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Code2, Mail, Lock, User, ArrowRight, AlertCircle, Loader2, Palette } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useSettings } from '../../context/SettingsContext';

export default function SignupPage() {
  const { register } = useAuth();
  const { settings, changeTheme } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Target path to redirect after successful authentication
  const redirectTarget = searchParams.get('redirect') || '/projects';

  const currentTheme = settings?.project_theme || 'navy';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name || name.trim().length < 2) {
      setError('Please provide a display name with at least 2 characters.');
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(cleanEmail, password, name.trim());
      // Ensure redirect path is relative to prevent open redirects
      const safeRedirect = redirectTarget.startsWith('/') ? redirectTarget : '/projects';
      navigate(safeRedirect, { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginLinkUrl = redirectTarget !== '/projects'
    ? `/login?redirect=${encodeURIComponent(redirectTarget)}`
    : '/login';

  return (
    <div className="auth-page-container">
      {/* Quick Theme Selector on Auth Page */}
      <div className="auth-theme-bar" title="Change application theme">
        <span className="auth-theme-label">
          <Palette size={13} />
          Theme:
        </span>
        <select
          className="auth-theme-select"
          value={currentTheme}
          onChange={(e) => changeTheme(e.target.value)}
          aria-label="Select theme"
        >
          <option value="navy">Navy</option>
          <option value="midnight">Midnight</option>
          <option value="cyberpunk">Cyberpunk</option>
          <option value="emerald">Emerald</option>
          <option value="ocean">Ocean</option>
          <option value="light">Light</option>
        </select>
      </div>

      <div className="auth-page-card">
        {/* Brand Header */}
        <div className="auth-page-header">
          <div className="auth-brand-logo">
            <Code2 size={24} />
          </div>
          <h1 className="auth-page-title">Create your CodeCollab account</h1>
          <p className="auth-page-subtitle">
            Get started with real-time collaborative coding and cloud project persistence
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error-banner" role="alert">
            <AlertCircle size={16} className="error-icon" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form-standalone">
          <div className="form-group">
            <label htmlFor="signup-name">Display Name</label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                id="signup-name"
                type="text"
                className="modal-input"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                autoComplete="name"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-email">Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                id="signup-email"
                type="email"
                className="modal-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="signup-password">Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                id="signup-password"
                type="password"
                className="modal-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <span className="input-hint">Must be at least 6 characters long</span>
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spinning" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Switch Link */}
        <div className="auth-page-footer">
          <p>
            Already have an account?{' '}
            <Link to={loginLinkUrl} className="auth-switch-link">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
