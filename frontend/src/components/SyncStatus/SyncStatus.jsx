import React from 'react';
import './SyncStatus.css';
import { CheckCircle2, Loader2, CloudOff, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Compact Sync Status Indicator
 * 
 * Possible states:
 * - Green: "Saved"
 * - Purple/blue spinner: "Saving…"
 * - Yellow: "Offline — changes saved locally"
 * - Red: "Save failed — Retry" (interactive retry button)
 * - Gray: "Connecting…"
 */
export default function SyncStatus({
  status = 'saved', // 'saved' | 'saving' | 'offline' | 'error' | 'connecting'
  onRetry = null,
  lastSavedAt = null,
  compact = false,
  className = ''
}) {
  const getFormattedTime = () => {
    if (!lastSavedAt) return '';
    try {
      const date = new Date(lastSavedAt);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  const formattedTime = getFormattedTime();

  const renderContent = () => {
    switch (status) {
      case 'saving':
        return (
          <div
            className="sync-status-badge sync-status-saving"
            role="status"
            aria-live="polite"
            title="Saving your changes to the cloud database…"
          >
            <Loader2 size={13} className="sync-status-spinner" />
            <span className="sync-status-label">Saving…</span>
          </div>
        );

      case 'saved':
        return (
          <div
            className="sync-status-badge sync-status-saved"
            role="status"
            aria-live="polite"
            title={formattedTime ? `Saved to cloud at ${formattedTime}` : 'All changes saved to cloud'}
          >
            <CheckCircle2 size={13} className="sync-status-icon" />
            <span className="sync-status-label">Saved</span>
            {formattedTime && <span className="sync-status-time">{formattedTime}</span>}
          </div>
        );

      case 'offline':
        return (
          <div
            className="sync-status-badge sync-status-offline"
            role="status"
            aria-live="polite"
            title="Internet disconnected. Your changes are safely stored on this device and will automatically sync when connection returns."
          >
            <CloudOff size={13} className="sync-status-icon" />
            <span className="sync-status-label desktop-text">Offline — changes saved locally</span>
            <span className="sync-status-label mobile-text">Offline (saved locally)</span>
          </div>
        );

      case 'error':
        return (
          <div
            className="sync-status-badge sync-status-error"
            role="alert"
            title="Cloud save failed. Your latest edits are kept in local recovery storage."
          >
            <AlertCircle size={13} className="sync-status-icon" />
            <span className="sync-status-label desktop-text">Save failed</span>
            <span className="sync-status-label mobile-text">Failed</span>
            {onRetry && (
              <button
                type="button"
                className="sync-status-retry-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                title="Retry saving latest file content now"
                aria-label="Retry saving file"
              >
                Retry
              </button>
            )}
          </div>
        );

      case 'connecting':
      default:
        return (
          <div
            className="sync-status-badge sync-status-connecting"
            role="status"
            aria-live="polite"
            title="Reconnecting to real-time sync server…"
          >
            <RefreshCw size={12} className="sync-status-spinner" />
            <span className="sync-status-label">Connecting…</span>
          </div>
        );
    }
  };

  return (
    <div className={`sync-status-container ${compact ? 'sync-status-compact' : ''} ${className}`}>
      {renderContent()}
    </div>
  );
}
