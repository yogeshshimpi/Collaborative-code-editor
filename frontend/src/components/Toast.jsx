import { CheckCircle2, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  return (
    <div className={`toast-container toast-${type}`}>
      <div className="toast-content">
        {type === 'success' ? (
          <CheckCircle2 size={16} className="toast-icon text-success" />
        ) : (
          <Info size={16} className="toast-icon text-accent" />
        )}
        <span className="toast-message">{message}</span>
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={onClose}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
