import './LoadingScreen.css';
import { Code2 } from 'lucide-react';

export default function LoadingScreen({ message = 'Loading CodeCollab...' }) {
  return (
    <div className="auth-loading-screen" role="status" aria-live="polite">
      <div className="loading-content">
        <div className="loading-logo-wrap">
          <div className="loading-brand-icon">
            <Code2 size={28} />
          </div>
          <div className="loading-pulse-ring" />
        </div>
        <h2 className="loading-brand-title">CodeCollab</h2>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
}
