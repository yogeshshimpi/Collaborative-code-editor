import React from 'react';
import './ConflictResolutionModal.css';
import { AlertTriangle, Check, ArrowRight, Clock, FileCode, X } from 'lucide-react';

/**
 * Conflict Resolution Modal
 * Displays options when a collaborator updates a file that currently has unsaved local edits:
 * 1. "Keep My Changes"
 * 2. "Use Teammate Changes"
 * 3. "Compare Later"
 */
export default function ConflictResolutionModal({
  isOpen,
  onClose,
  fileName,
  localContent = '',
  remoteContent = '',
  remoteAuthor = 'A teammate',
  onKeepMine,
  onUseTeammate,
  onCompareLater
}) {
  if (!isOpen) return null;

  const localLineCount = (localContent || '').split('\n').length;
  const remoteLineCount = (remoteContent || '').split('\n').length;

  return (
    <div className="modal-overlay conflict-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container conflict-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="conflict-modal-header">
          <div className="conflict-header-title-row">
            <div className="conflict-icon-badge">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="conflict-modal-title">Collaborator Conflict Detected</h3>
              <p className="conflict-modal-subtitle">
                {remoteAuthor} made changes to <strong>{fileName}</strong> while you have unsaved edits.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="conflict-modal-close"
            onClick={onClose}
            aria-label="Close conflict modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="conflict-modal-body">
          <div className="conflict-summary-cards">
            <div className="conflict-card conflict-card-local">
              <div className="conflict-card-header">
                <FileCode size={14} className="text-accent" />
                <span className="conflict-card-title">My Local Unsaved Edits</span>
              </div>
              <div className="conflict-card-details">
                <span>{localLineCount} lines</span>
                <span className="conflict-card-tag local-tag">Unsaved Draft</span>
              </div>
            </div>

            <div className="conflict-card conflict-card-remote">
              <div className="conflict-card-header">
                <FileCode size={14} className="text-warning" />
                <span className="conflict-card-title">Teammate Updates</span>
              </div>
              <div className="conflict-card-details">
                <span>{remoteLineCount} lines</span>
                <span className="conflict-card-tag remote-tag">Server Latest</span>
              </div>
            </div>
          </div>

          <p className="conflict-guidance">
            Choose how you would like to reconcile this file. You will not lose your local code unless you choose to discard it.
          </p>

          <div className="conflict-actions-list">
            <button
              type="button"
              className="conflict-action-option primary-option"
              onClick={onKeepMine}
            >
              <div className="conflict-action-info">
                <span className="conflict-action-title">
                  <Check size={16} />
                  Keep My Changes
                </span>
                <span className="conflict-action-desc">
                  Save your local edits as the latest version and update collaborators.
                </span>
              </div>
              <ArrowRight size={16} className="conflict-action-arrow" />
            </button>

            <button
              type="button"
              className="conflict-action-option secondary-option"
              onClick={onUseTeammate}
            >
              <div className="conflict-action-info">
                <span className="conflict-action-title">
                  <Check size={16} />
                  Use Teammate Changes
                </span>
                <span className="conflict-action-desc">
                  Accept your teammate's latest code and discard your unsaved draft.
                </span>
              </div>
              <ArrowRight size={16} className="conflict-action-arrow" />
            </button>

            <button
              type="button"
              className="conflict-action-option neutral-option"
              onClick={onCompareLater}
            >
              <div className="conflict-action-info">
                <span className="conflict-action-title">
                  <Clock size={16} />
                  Compare Later
                </span>
                <span className="conflict-action-desc">
                  Keep working on your local draft without overwriting server code yet.
                </span>
              </div>
              <ArrowRight size={16} className="conflict-action-arrow" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
