import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Code2, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/useAuth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Target path to redirect after successful authentication
  const redirectTarget = searchParams.get('redirect') || '/projects';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(cleanEmail, password);
      // Ensure redirect path is relative to prevent open redirects
      const safeRedirect = redirectTarget.startsWith('/') ? redirectTarget : '/projects';
      navigate(safeRedirect, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const signupLinkUrl = redirectTarget !== '/projects'
    ? `/signup?redirect=${encodeURIComponent(redirectTarget)}`
    : '/signup';

  return (
    <div className="auth-page-container">
      <div className="auth-page-card">
        {/* Brand Header */}
        <div className="auth-page-header">
          <div className="auth-brand-logo">
            <Code2 size={24} />
          </div>
          <h1 className="auth-page-title">Welcome back to CodeCollab</h1>
          <p className="auth-page-subtitle">
            Sign in to access your cloud-saved projects and collaborative rooms
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
            <label htmlFor="login-email">Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                id="login-email"
                type="email"
                className="modal-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                id="login-password"
                type="password"
                className="modal-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spinning" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Switch Link */}
        <div className="auth-page-footer">
          <p>
            Don't have an account?{' '}
            <Link to={signupLinkUrl} className="auth-switch-link">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
