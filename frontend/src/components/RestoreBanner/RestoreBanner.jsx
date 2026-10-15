import React from 'react';
import './RestoreBanner.css';
import { History, Check, Trash2, X } from 'lucide-react';

/**
 * Small restore banner shown when newer unsaved local edits exist for a file after refresh.
 * Allows user to Restore or Discard local changes.
 */
export default function RestoreBanner({
  fileName,
  draftTimestamp = null,
  onRestore,
  onDiscard,
  onClose
}) {
  if (!fileName) return null;

  const timeString = draftTimestamp
    ? new Date(draftTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <aside
      className="restore-banner-container"
      role="alert"
      aria-live="assertive"
    >
      <div className="restore-banner-content">
        <div className="restore-banner-left">
          <span className="restore-banner-icon-wrapper">
            <History size={15} className="restore-banner-icon" />
          </span>
          <span className="restore-banner-text">
            Unsaved local changes found for <strong>{fileName}</strong>
            {timeString ? ` (${timeString})` : ''}.
          </span>
        </div>

        <div className="restore-banner-actions">
          <button
            type="button"
            className="restore-banner-btn restore-banner-btn-primary"
            onClick={onRestore}
            title="Restore your local unsaved edits"
          >
            <Check size={13} />
            <span>Restore</span>
          </button>

          <button
            type="button"
            className="restore-banner-btn restore-banner-btn-secondary"
            onClick={onDiscard}
            title="Discard local edits and use server version"
          >
            <Trash2 size={13} />
            <span>Discard</span>
          </button>

          {onClose && (
            <button
              type="button"
              className="restore-banner-btn-close"
              onClick={onClose}
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
