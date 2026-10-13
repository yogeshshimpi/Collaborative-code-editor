import './Toast.css';
import { CheckCircle2, Info, AlertCircle, AlertTriangle, X } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  const renderIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={16} className="toast-icon text-success" />;
      case 'error':
        return <AlertCircle size={16} className="toast-icon text-danger" />;
      case 'warning':
        return <AlertTriangle size={16} className="toast-icon text-warning" />;
      case 'info':
      default:
        return <Info size={16} className="toast-icon text-accent" />;
    }
  };

  return (
    <div className={`toast-container toast-${type}`}>
      <div className="toast-content">
        {renderIcon()}
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
