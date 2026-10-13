import './VersionHistoryModal.css';
import { useState, useEffect, useCallback } from 'react';
import {
  History,
  RotateCcw,
  Clock,
  Plus,
  X,
  FileCode,
  User,
  AlertCircle,
  Eye,
  Check,
  Loader2,
  FileText,
  Sparkles
} from 'lucide-react';
import { getLanguageFromFile } from '../../data/initialFiles';
import { apiUrl } from '../../services/api';

export default function VersionHistoryModal({
  isOpen,
  onClose,
  roomId,
  fileName,
  userRole = 'editor',
  onRestore,
  onShowToast
}) {
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [selectedVersionDetails, setSelectedVersionDetails] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [error, setError] = useState(null);
  const [mobileTab, setMobileTab] = useState('timeline'); // 'timeline' | 'preview'

  const isViewer = userRole === 'viewer';

  // Format date nicely (e.g. "Oct 12, 2026, 3:30 PM" or "Just now")
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown date';

    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fetch list of versions for current file
  const fetchVersions = useCallback(async () => {
    if (!roomId || !fileName) return;
    setIsLoadingList(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileName)}/versions`), {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load version history.');
      }
      const data = await res.json();
      const list = Array.isArray(data.versions) ? data.versions : [];
      setVersions(list);

      // Select latest version by default if none selected or previous no longer in list
      if (list.length > 0) {
        setSelectedVersionId((prev) => (list.some((v) => v.id === prev) ? prev : list[0].id));
      } else {
        setSelectedVersionId(null);
        setSelectedVersionDetails(null);
      }
    } catch (err) {
      console.error('[Version History] Error fetching versions:', err);
      setError(err.message);
    } finally {
      setIsLoadingList(false);
    }
  }, [roomId, fileName]);

  // Fetch preview content when selectedVersionId changes
  useEffect(() => {
    if (!isOpen || !roomId || !fileName || !selectedVersionId) return;

    let isMounted = true;
    setIsLoadingPreview(true);

    fetch(apiUrl(`/api/projects/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileName)}/versions/${encodeURIComponent(selectedVersionId)}`), {
      credentials: 'include'
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load version preview.');
        return res.json();
      })
      .then((data) => {
        if (isMounted && data.version) {
          setSelectedVersionDetails(data.version);
        }
      })
      .catch((err) => {
        console.error('[Version History] Preview fetch error:', err);
        if (isMounted) setError(err.message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, roomId, fileName, selectedVersionId]);

  // Load versions on modal open or file change
  useEffect(() => {
    if (isOpen) {
      fetchVersions();
      setShowConfirmRestore(false);
      setSnapshotLabel('');
    }
  }, [isOpen, fetchVersions]);

  // Handle manual snapshot creation
  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    if (isViewer) return;

    setIsCreatingSnapshot(true);
    try {
      const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileName)}/versions`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: snapshotLabel.trim() || 'Manual Checkpoint'
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create snapshot.');
      }

      const data = await res.json();
      if (onShowToast) onShowToast('Snapshot created successfully.', 'success');
      setSnapshotLabel('');
      await fetchVersions();
      if (data.version?.id) {
        setSelectedVersionId(data.version.id);
      }
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  // Handle restoring selected version
  const handleRestoreConfirm = async () => {
    if (!selectedVersionId || isViewer) return;

    setIsRestoring(true);
    try {
      const res = await fetch(
        apiUrl(`/api/projects/${encodeURIComponent(roomId)}/files/${encodeURIComponent(fileName)}/versions/${encodeURIComponent(selectedVersionId)}/restore`),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to restore version.');
      }

      const data = await res.json();
      if (onRestore) {
        onRestore(data.fileName, data.content);
      }
      setShowConfirmRestore(false);
      onClose();
    } catch (err) {
      if (onShowToast) onShowToast(err.message, 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  if (!isOpen) return null;

  const currentLanguage = getLanguageFromFile(fileName);
  const lineCount = selectedVersionDetails?.content
    ? selectedVersionDetails.content.split('\n').length
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-container version-history-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <History size={18} />
            </div>
            <div>
              <h2 id="version-history-title" className="modal-title">
                Version History
              </h2>
              <div className="version-modal-subtitle">
                <FileCode size={13} className="subtitle-icon" />
                <span className="file-pill">{fileName}</span>
                <span className="room-crumb">in room: {roomId}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="action-icon-btn"
            onClick={onClose}
            title="Close Version History"
            aria-label="Close Version History"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mobile View Switcher (visible on mobile screens < 640px) */}
        <div className="version-mobile-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'timeline'}
            className={`version-mobile-tab-btn ${mobileTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setMobileTab('timeline')}
          >
            <Clock size={13} />
            <span>Timeline ({versions.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileTab === 'preview'}
            className={`version-mobile-tab-btn ${mobileTab === 'preview' ? 'active' : ''}`}
            onClick={() => setMobileTab('preview')}
          >
            <FileCode size={13} />
            <span>Preview & Restore</span>
          </button>
        </div>

        {/* Modal Body: Split Pane (Desktop/Tablet) or Active Tab (Mobile) */}
        <div className="version-history-body">
          {/* Left Column: Version Timeline */}
          <aside className={`version-history-sidebar ${mobileTab === 'timeline' ? 'mobile-pane-active' : 'mobile-pane-hidden'}`}>
            <div className="version-sidebar-header">
              <div className="sidebar-heading">
                <span>Timeline ({versions.length})</span>
              </div>

              {/* Manual Snapshot Form (Owner & Editor only) */}
              {!isViewer && (
                <form onSubmit={handleCreateSnapshot} className="snapshot-form">
                  <input
                    type="text"
                    className="snapshot-input"
                    placeholder="Checkpoint name (optional)..."
                    value={snapshotLabel}
                    onChange={(e) => setSnapshotLabel(e.target.value)}
                    disabled={isCreatingSnapshot}
                    maxLength={100}
                  />
                  <button
                    type="submit"
                    className="btn btn-secondary btn-sm btn-snapshot"
                    disabled={isCreatingSnapshot}
                    title="Save current file content as a named snapshot checkpoint"
                    aria-label="Save snapshot checkpoint"
                  >
                    {isCreatingSnapshot ? (
                      <Loader2 size={13} className="spinner" />
                    ) : (
                      <Plus size={13} />
                    )}
                    <span>Snapshot</span>
                  </button>
                </form>
              )}
            </div>

            {/* Version List */}
            <div className="version-list-scroll">
              {isLoadingList ? (
                <div className="version-loading-state">
                  <Loader2 size={20} className="spinner" />
                  <span>Loading versions...</span>
                </div>
              ) : error ? (
                <div className="version-empty-state">
                  <AlertCircle size={20} className="empty-icon text-danger" />
                  <p>{error}</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={fetchVersions}
                  >
                    Retry
                  </button>
                </div>
              ) : versions.length === 0 ? (
                <div className="version-empty-state">
                  <Clock size={24} className="empty-icon" />
                  <p>No previous versions recorded yet.</p>
                  <span>
                    Edits are automatically captured every few minutes, or click "Snapshot" above to create one.
                  </span>
                </div>
              ) : (
                versions.map((ver, idx) => {
                  const isSelected = ver.id === selectedVersionId;
                  const isLatest = idx === 0;

                  return (
                    <div
                      key={ver.id}
                      className={`version-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedVersionId(ver.id);
                        setShowConfirmRestore(false);
                        setMobileTab('preview');
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="version-card-top">
                        <span
                          className={`version-badge badge-${ver.version_type || 'auto'}`}
                        >
                          {ver.version_type === 'manual'
                            ? 'Snapshot'
                            : ver.version_type === 'restore'
                            ? 'Restore Point'
                            : 'Auto Save'}
                        </span>
                        {isLatest && <span className="latest-pill">Current</span>}
                        <span className="version-time">{formatDate(ver.created_at)}</span>
                      </div>

                      <div className="version-card-title">
                        {ver.label || (ver.version_type === 'manual' ? 'Manual Checkpoint' : 'Code Update')}
                      </div>

                      <div className="version-card-footer">
                        <span className="version-author">
                          <User size={11} className="meta-icon" />
                          {ver.author_name || 'Collaborator'}
                        </span>
                        {ver.size_bytes !== undefined && (
                          <span className="version-size">
                            {(ver.size_bytes / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Column: Version Preview & Restore Control */}
          <main className={`version-history-preview ${mobileTab === 'preview' ? 'mobile-pane-active' : 'mobile-pane-hidden'}`}>
            {selectedVersionDetails ? (
              <div className="preview-container">
                {/* Preview Toolbar */}
                <div className="preview-toolbar">
                  <div className="preview-meta">
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs btn-back-timeline"
                      onClick={() => setMobileTab('timeline')}
                      title="Back to timeline list"
                      aria-label="Back to timeline list"
                    >
                      <Clock size={12} />
                      <span>Timeline</span>
                    </button>
                    <div className="preview-meta-text">
                      <span className="preview-heading">
                        Previewing: <strong>{selectedVersionDetails.label || selectedVersionDetails.file_name}</strong>
                      </span>
                      <span className="preview-submeta">
                        Captured {new Date(selectedVersionDetails.created_at).toLocaleString()} • {lineCount} lines • Author: {selectedVersionDetails.author_name || 'System'}
                      </span>
                    </div>
                  </div>

                  <div className="preview-actions">
                    {isViewer ? (
                      <div className="view-only-tag" title="Only editors and owners can restore versions">
                        <Eye size={13} />
                        <span>View-Only</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm btn-restore-trigger"
                        onClick={() => setShowConfirmRestore(true)}
                        title="Restore this version into the active project"
                        aria-label="Restore this version"
                      >
                        <RotateCcw size={13} />
                        <span>Restore This Version</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Restore Confirmation Dialog Overlay inside preview */}
                {showConfirmRestore && !isViewer && (
                  <div className="restore-confirm-banner">
                    <div className="confirm-icon">
                      <AlertCircle size={18} />
                    </div>
                    <div className="confirm-text">
                      <strong>Confirm Version Restore</strong>
                      <p>
                        Restoring will overwrite current <code>{fileName}</code> in the workspace with this version from{' '}
                        {new Date(selectedVersionDetails.created_at).toLocaleTimeString()}. All collaborators will immediately receive the restored code.
                      </p>
                    </div>
                    <div className="confirm-buttons">
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => setShowConfirmRestore(false)}
                        disabled={isRestoring}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs btn-confirm-restore"
                        onClick={handleRestoreConfirm}
                        disabled={isRestoring}
                      >
                        {isRestoring ? (
                          <>
                            <Loader2 size={12} className="spinner" />
                            <span>Restoring...</span>
                          </>
                        ) : (
                          <>
                            <Check size={12} />
                            <span>Yes, Restore File</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Code Preview Viewer */}
                <div className="preview-code-viewport">
                  {isLoadingPreview ? (
                    <div className="preview-loading">
                      <Loader2 size={24} className="spinner" />
                      <span>Loading code snapshot...</span>
                    </div>
                  ) : (
                    <pre className="preview-pre">
                      <code className={`preview-code language-${currentLanguage}`}>
                        {selectedVersionDetails.content || '// (Empty file)'}
                      </code>
                    </pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="preview-empty">
                <FileText size={32} className="empty-icon" />
                <h3>No Version Selected</h3>
                <p>Select a version from the timeline on the left to view its preview and restore options.</p>
              </div>
            )}
          </main>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer version-modal-footer">
          <div className="footer-tip">
            <Sparkles size={13} className="tip-icon" />
            <span>
              Restoring safely archives current changes and notifies all room participants instantly.
            </span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
