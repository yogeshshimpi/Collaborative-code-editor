import './ChangeRequestsModal.css';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  FileCode,
  FilePlus,
  FileEdit,
  Trash2,
  History,
  Send,
  Loader2,
  AlertCircle,
  ChevronRight,
  Eye,
  Filter,
  Check,
  Ban,
  RotateCcw
} from 'lucide-react';
import { DiffEditor, Editor } from '@monaco-editor/react';
import { api } from '../../services/api';
import { getLanguageFromFile } from '../../data/initialFiles';

export default function ChangeRequestsModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  roomId,
  userRole = 'editor',
  currentUser,
  activeFile,
  activeFileContent = '',
  filesState = {},
  initialCreateMode = false,
  onShowToast
}) {
  const [requests, setRequests] = useState([]);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'

  // Creation form state
  const [isCreating, setIsCreating] = useState(initialCreateMode);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTargetPath, setNewTargetPath] = useState(activeFile || 'main.js');
  const [newProposedContent, setNewProposedContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Rejection dialog state
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  const isOwner = userRole === 'owner';
  const isViewer = userRole === 'viewer';

  // Load change requests from server
  const loadRequests = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const data = await api.getChangeRequests(projectId, filterStatus);
      const list = data?.changeRequests || [];
      setRequests(list);
      if (list.length > 0 && !selectedRequestId) {
        setSelectedRequestId(list[0].id);
      }
    } catch (err) {
      console.error('[ChangeRequestsModal] Error loading change requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, filterStatus, selectedRequestId]);

  useEffect(() => {
    if (isOpen) {
      loadRequests();
      setIsCreating(initialCreateMode);
      setNewTargetPath(activeFile || 'main.js');
      setNewProposedContent(activeFileContent || (filesState[activeFile]?.content || ''));
      setNewTitle('');
      setNewDescription('');
      setCreateError(null);
      setRejectingId(null);
      setRejectionReason('');
    }
  }, [isOpen, loadRequests, initialCreateMode, activeFile, activeFileContent, filesState]);

  // When activeFile changes in creation form, sync content
  const handleTargetPathChange = (path) => {
    setNewTargetPath(path);
    const existing = filesState[path]?.content || '';
    setNewProposedContent(existing);
  };

  const selectedRequest = useMemo(() => {
    return requests.find((r) => r.id === selectedRequestId) || requests[0] || null;
  }, [requests, selectedRequestId]);

  // Filtered list
  const filteredRequests = useMemo(() => {
    if (filterStatus === 'all') return requests;
    return requests.filter((r) => r.status === filterStatus);
  }, [requests, filterStatus]);

  // Counts for tabs
  const counts = useMemo(() => {
    const p = requests.filter((r) => r.status === 'pending').length;
    const a = requests.filter((r) => r.status === 'approved').length;
    const rej = requests.filter((r) => r.status === 'rejected').length;
    return { all: requests.length, pending: p, approved: a, rejected: rej };
  }, [requests]);

  // Submit new change request
  const handleSubmitNewRequest = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Please provide a title for this change request.');
      return;
    }
    if (!newTargetPath) {
      setCreateError('Please select a target file.');
      return;
    }

    setCreateError(null);
    setIsSubmitting(true);
    try {
      const original = filesState[newTargetPath]?.content || '';
      const payload = {
        requestType: 'code_change',
        targetPath: newTargetPath,
        originalContent: original,
        proposedContent: newProposedContent,
        title: newTitle.trim(),
        description: newDescription.trim()
      };

      const res = await api.createChangeRequest(projectId, payload);
      if (res?.changeRequest) {
        setRequests((prev) => [res.changeRequest, ...prev]);
        setSelectedRequestId(res.changeRequest.id);
      }
      setIsCreating(false);
      if (onShowToast) {
        onShowToast('Change request submitted for owner approval!', 'success');
      }
    } catch (err) {
      setCreateError(err.message || 'Failed to submit change request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Review (Approve / Reject)
  const handleReview = async (requestId, status, reason = null) => {
    if (!isOwner) return;
    setIsReviewing(true);
    try {
      const res = await api.reviewChangeRequest(projectId, requestId, {
        status,
        rejectionReason: reason
      });

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, ...res.changeRequest } : r))
      );
      setRejectingId(null);
      setRejectionReason('');

      if (onShowToast) {
        onShowToast(
          status === 'approved'
            ? 'Change request approved and applied successfully!'
            : 'Change request rejected.',
          status === 'approved' ? 'success' : 'info'
        );
      }
    } catch (err) {
      if (onShowToast) {
        onShowToast(err.message || 'Failed to review change request.', 'error');
      }
    } finally {
      setIsReviewing(false);
    }
  };

  if (!isOpen) return null;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'file_create':
      case 'create_file':
      case 'folder_create':
      case 'create_folder':
        return <FilePlus size={14} className="text-emerald" />;
      case 'file_rename':
      case 'rename_file':
      case 'folder_rename':
      case 'rename_folder':
        return <FileEdit size={14} className="text-indigo" />;
      case 'file_delete':
      case 'delete_file':
      case 'folder_delete':
      case 'delete_folder':
        return <Trash2 size={14} className="text-rose" />;
      case 'version_restore':
        return <RotateCcw size={14} className="text-amber" />;
      default:
        return <FileCode size={14} className="text-accent" />;
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog change-requests-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge cr-badge">
              <GitPullRequest size={18} />
            </div>
            <div>
              <div className="modal-title-with-pill">
                <h2 className="modal-title">Change Requests</h2>
                <span className="cr-count-pill">{counts.pending} pending</span>
              </div>
              <p className="modal-subtitle">
                Role-based approval workflow for <strong>{projectName}</strong>
              </p>
            </div>
          </div>

          <div className="cr-header-actions">
            {!isViewer && (
              <button
                type="button"
                className={`btn btn-sm ${isCreating ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => {
                  setIsCreating((prev) => !prev);
                  setCreateError(null);
                }}
              >
                {isCreating ? 'View Requests' : '+ New Request'}
              </button>
            )}
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {isCreating ? (
          /* New Change Request Submission Form */
          <div className="cr-create-container">
            <div className="cr-create-header">
              <div className="cr-create-header-info">
                <h3>Submit Code Changes for Owner Review</h3>
                <p>
                  Your proposed changes will be safely stored and reviewed by the project owner
                  before being merged into the live project.
                </p>
              </div>
            </div>

            {createError && (
              <div className="auth-error-banner" style={{ margin: '0 20px 14px' }}>
                <AlertCircle size={15} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitNewRequest} className="cr-create-form">
              <div className="cr-form-row">
                <div className="cr-form-field flex-2">
                  <label htmlFor="cr-title-input">Title / Summary</label>
                  <input
                    id="cr-title-input"
                    type="text"
                    className="modal-input"
                    placeholder="e.g., Update hero layout and responsive typography"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="cr-form-field flex-1">
                  <label htmlFor="cr-target-select">Target File</label>
                  <select
                    id="cr-target-select"
                    className="modal-input modal-select"
                    value={newTargetPath}
                    onChange={(e) => handleTargetPathChange(e.target.value)}
                  >
                    {Object.keys(filesState).length > 0 ? (
                      Object.keys(filesState).map((path) => (
                        <option key={path} value={path}>
                          {path}
                        </option>
                      ))
                    ) : (
                      <option value="main.js">main.js</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="cr-form-field">
                <label htmlFor="cr-desc-input">Description (Optional)</label>
                <textarea
                  id="cr-desc-input"
                  className="modal-input cr-textarea"
                  placeholder="Explain why this change is needed and what parts were modified..."
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>

              <div className="cr-code-editor-section">
                <div className="cr-code-editor-header">
                  <span>Proposed Code Content ({newTargetPath})</span>
                  <span className="cr-editor-hint">Edit below to define your proposal</span>
                </div>
                <div className="cr-code-editor-wrapper">
                  <Editor
                    height="260px"
                    language={getLanguageFromFile(newTargetPath)}
                    value={newProposedContent}
                    theme="vs-dark"
                    onChange={(val) => setNewProposedContent(val || '')}
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', Consolas, monospace",
                      minimap: { enabled: false },
                      lineNumbers: 'on',
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      tabSize: 2,
                      automaticLayout: true
                    }}
                  />
                </div>
              </div>

              <div className="cr-create-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreating(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-submit-cr"
                  disabled={isSubmitting || !newTitle.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 size={15} className="spinning" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>Submit for Owner Review</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* List & Review Workspace */
          <div className="cr-workspace">
            {/* Filter Tabs */}
            <div className="cr-tabs-bar">
              <button
                type="button"
                className={`cr-tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                <span>All</span>
                <span className="cr-tab-count">{counts.all}</span>
              </button>
              <button
                type="button"
                className={`cr-tab-btn ${filterStatus === 'pending' ? 'active' : ''}`}
                onClick={() => setFilterStatus('pending')}
              >
                <Clock size={12} className="text-amber" />
                <span>Pending</span>
                <span className="cr-tab-count badge-amber">{counts.pending}</span>
              </button>
              <button
                type="button"
                className={`cr-tab-btn ${filterStatus === 'approved' ? 'active' : ''}`}
                onClick={() => setFilterStatus('approved')}
              >
                <CheckCircle2 size={12} className="text-emerald" />
                <span>Approved</span>
                <span className="cr-tab-count badge-emerald">{counts.approved}</span>
              </button>
              <button
                type="button"
                className={`cr-tab-btn ${filterStatus === 'rejected' ? 'active' : ''}`}
                onClick={() => setFilterStatus('rejected')}
              >
                <XCircle size={12} className="text-rose" />
                <span>Rejected</span>
                <span className="cr-tab-count badge-rose">{counts.rejected}</span>
              </button>
            </div>

            {isLoading ? (
              <div className="cr-loading-state">
                <Loader2 size={24} className="spinning" />
                <p>Loading change requests...</p>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="cr-empty-state">
                <GitPullRequest size={32} className="cr-empty-icon" />
                <h3>No Change Requests</h3>
                <p>
                  {filterStatus === 'pending'
                    ? 'All pending proposals have been reviewed.'
                    : 'There are no change requests in this view.'}
                </p>
                {!isViewer && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setIsCreating(true)}
                  >
                    + Create First Request
                  </button>
                )}
              </div>
            ) : (
              <div className="cr-split-layout">
                {/* Left List of Requests */}
                <div className="cr-list-column">
                  {filteredRequests.map((cr) => {
                    const isSelected = cr.id === selectedRequest?.id;
                    return (
                      <div
                        key={cr.id}
                        className={`cr-list-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedRequestId(cr.id)}
                      >
                        <div className="cr-item-top">
                          <span className={`cr-status-tag ${cr.status}`}>
                            {cr.status === 'pending' && <Clock size={11} />}
                            {cr.status === 'approved' && <CheckCircle2 size={11} />}
                            {cr.status === 'rejected' && <XCircle size={11} />}
                            <span>{cr.status}</span>
                          </span>
                          <span className="cr-item-time">{formatRelativeTime(cr.created_at)}</span>
                        </div>

                        <div className="cr-item-title-row">
                          <span className="cr-type-icon">{getTypeIcon(cr.request_type)}</span>
                          <span className="cr-item-title">{cr.title}</span>
                        </div>

                        <div className="cr-item-meta">
                          <span className="cr-item-file">{cr.target_path}</span>
                          <span className="cr-item-author">by {cr.author_name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Detail & Diff View */}
                {selectedRequest ? (
                  <div className="cr-detail-column">
                    <div className="cr-detail-header">
                      <div className="cr-detail-title-block">
                        <div className="cr-detail-title-row">
                          <span className="cr-type-icon large">{getTypeIcon(selectedRequest.request_type)}</span>
                          <h3>{selectedRequest.title}</h3>
                          <span className={`cr-status-tag large ${selectedRequest.status}`}>
                            {selectedRequest.status}
                          </span>
                        </div>
                        <div className="cr-detail-meta-row">
                          <span>
                            Proposed by <strong>{selectedRequest.author_name}</strong> ({selectedRequest.author_email})
                          </span>
                          <span>•</span>
                          <span>{formatRelativeTime(selectedRequest.created_at)}</span>
                          <span>•</span>
                          <span className="cr-target-chip">{selectedRequest.target_path}</span>
                        </div>
                        {selectedRequest.description && (
                          <p className="cr-detail-description">{selectedRequest.description}</p>
                        )}
                      </div>

                      {/* Review Action Controls for Owner */}
                      {isOwner && selectedRequest.status === 'pending' && (
                        <div className="cr-owner-actions">
                          {rejectingId === selectedRequest.id ? (
                            <div className="cr-reject-box">
                              <input
                                type="text"
                                className="modal-input modal-input-sm"
                                placeholder="Reason for rejection (optional)..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                disabled={isReviewing}
                                autoFocus
                              />
                              <div className="cr-reject-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setRejectingId(null)}
                                  disabled={isReviewing}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleReview(selectedRequest.id, 'rejected', rejectionReason)}
                                  disabled={isReviewing}
                                >
                                  {isReviewing ? <Loader2 size={13} className="spinning" /> : <Ban size={13} />}
                                  <span>Confirm Reject</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="cr-action-buttons">
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => setRejectingId(selectedRequest.id)}
                                disabled={isReviewing}
                              >
                                <XCircle size={14} />
                                <span>Reject</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm btn-approve"
                                onClick={() => handleReview(selectedRequest.id, 'approved')}
                                disabled={isReviewing}
                              >
                                {isReviewing ? <Loader2 size={14} className="spinning" /> : <Check size={14} />}
                                <span>
                                  {selectedRequest.request_type === 'file_delete' || selectedRequest.request_type === 'delete_file' || selectedRequest.request_type === 'folder_delete' || selectedRequest.request_type === 'delete_folder'
                                    ? 'Approve Deletion'
                                    : selectedRequest.request_type === 'version_restore'
                                    ? 'Approve Restore'
                                    : selectedRequest.request_type === 'file_create' || selectedRequest.request_type === 'create_file' || selectedRequest.request_type === 'folder_create' || selectedRequest.request_type === 'create_folder'
                                    ? 'Approve Creation'
                                    : selectedRequest.request_type === 'file_rename' || selectedRequest.request_type === 'rename_file' || selectedRequest.request_type === 'folder_rename' || selectedRequest.request_type === 'rename_folder'
                                    ? 'Approve Rename'
                                    : 'Approve & Merge'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Review Decision Banner (if already reviewed) */}
                    {selectedRequest.status !== 'pending' && (
                      <div className={`cr-reviewed-banner ${selectedRequest.status}`}>
                        {selectedRequest.status === 'approved' ? (
                          <>
                            <CheckCircle2 size={16} className="text-emerald" />
                            <span>
                              Approved and merged into project by {selectedRequest.reviewed_by || 'Owner'} on{' '}
                              {selectedRequest.reviewed_at
                                ? new Date(selectedRequest.reviewed_at).toLocaleDateString()
                                : 'recently'}
                              .
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle size={16} className="text-rose" />
                            <span>
                              Rejected by {selectedRequest.reviewed_by || 'Owner'}
                              {selectedRequest.rejection_reason ? `: "${selectedRequest.rejection_reason}"` : '.'}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Diff or Proposal View */}
                    <div className="cr-diff-container">
                      <div className="cr-diff-header">
                        <span className="diff-header-title">
                          {selectedRequest.request_type === 'version_restore'
                            ? `Version Restore Diff: Current vs Checkpoint (${selectedRequest.target_path})`
                            : selectedRequest.request_type === 'code_change'
                            ? `Original vs Proposed Diff (${selectedRequest.target_path})`
                            : `Operation Details: ${selectedRequest.title}`}
                        </span>
                        {(selectedRequest.request_type === 'code_change' || selectedRequest.request_type === 'version_restore') && (
                          <div className="diff-legend">
                            <span className="legend-red">- {selectedRequest.request_type === 'version_restore' ? 'Current' : 'Original'}</span>
                            <span className="legend-green">+ {selectedRequest.request_type === 'version_restore' ? 'Restored Checkpoint' : 'Proposed'}</span>
                          </div>
                        )}
                      </div>

                      <div className="cr-diff-editor-wrapper">
                        {selectedRequest.request_type === 'code_change' || selectedRequest.request_type === 'version_restore' ? (
                          <DiffEditor
                            height="100%"
                            language={getLanguageFromFile(selectedRequest.target_path)}
                            original={selectedRequest.original_content || ''}
                            modified={selectedRequest.proposed_content || ''}
                            theme="vs-dark"
                            options={{
                              readOnly: true,
                              fontSize: 13,
                              fontFamily: "'JetBrains Mono', Consolas, monospace",
                              minimap: { enabled: false },
                              lineNumbers: 'on',
                              wordWrap: 'on',
                              scrollBeyondLastLine: false,
                              renderSideBySide: true,
                              automaticLayout: true
                            }}
                          />
                        ) : selectedRequest.request_type === 'file_delete' || selectedRequest.request_type === 'delete_file' || selectedRequest.request_type === 'folder_delete' || selectedRequest.request_type === 'delete_folder' ? (
                          <div className="cr-major-card cr-delete-card">
                            <div className="cr-major-card-badge text-rose">
                              <Trash2 size={20} />
                              <span>Major Operation: Permanent Deletion</span>
                            </div>
                            <p className="cr-major-card-desc">
                              Collaborator <strong>{selectedRequest.author_name}</strong> requested deletion of{' '}
                              <code className="cr-path-tag">{selectedRequest.target_path}</code>.
                            </p>
                            <div className="cr-major-card-warning">
                              🛡️ <strong>Robust System Protection:</strong> Deletions are gated by Owner Approval. Approving will permanently remove this {selectedRequest.request_type.includes('folder') ? 'folder and its contents' : 'file'} across all connected collaborator workspaces.
                            </div>
                            {selectedRequest.original_content && (
                              <div className="cr-code-preview-wrap">
                                <span className="cr-preview-tag">File Content Before Deletion:</span>
                                <pre className="cr-code-snippet">{selectedRequest.original_content}</pre>
                              </div>
                            )}
                          </div>
                        ) : selectedRequest.request_type === 'file_create' || selectedRequest.request_type === 'create_file' || selectedRequest.request_type === 'folder_create' || selectedRequest.request_type === 'create_folder' ? (
                          <div className="cr-major-card cr-create-card">
                            <div className="cr-major-card-badge text-emerald">
                              <FilePlus size={20} />
                              <span>Major Operation: New {selectedRequest.request_type.includes('folder') ? 'Folder' : 'File'} Creation</span>
                            </div>
                            <p className="cr-major-card-desc">
                              Collaborator <strong>{selectedRequest.author_name}</strong> requested creation of{' '}
                              <code className="cr-path-tag">{selectedRequest.target_path}</code>.
                            </p>
                            {selectedRequest.proposed_content && (
                              <div className="cr-code-preview-wrap">
                                <span className="cr-preview-tag">Proposed Initial Content:</span>
                                <pre className="cr-code-snippet">{selectedRequest.proposed_content}</pre>
                              </div>
                            )}
                          </div>
                        ) : selectedRequest.request_type === 'file_rename' || selectedRequest.request_type === 'rename_file' || selectedRequest.request_type === 'folder_rename' || selectedRequest.request_type === 'rename_folder' ? (
                          <div className="cr-major-card cr-rename-card">
                            <div className="cr-major-card-badge text-indigo">
                              <FileEdit size={20} />
                              <span>Major Operation: Path Rename</span>
                            </div>
                            <p className="cr-major-card-desc">
                              Collaborator <strong>{selectedRequest.author_name}</strong> requested renaming:
                            </p>
                            <div className="cr-rename-flow">
                              <code className="path-old">{selectedRequest.old_path || 'original'}</code>
                              <span className="rename-arrow">➔</span>
                              <code className="path-new">{selectedRequest.target_path}</code>
                            </div>
                          </div>
                        ) : (
                          <div className="cr-non-code-summary">
                            <h4>Operation Details</h4>
                            <div className="cr-non-code-info">
                              <div><strong>Type:</strong> {selectedRequest.request_type}</div>
                              <div><strong>Target:</strong> {selectedRequest.target_path}</div>
                              {selectedRequest.old_path && (
                                <div><strong>Previous Path:</strong> {selectedRequest.old_path}</div>
                              )}
                            </div>
                            {selectedRequest.proposed_content && (
                              <div className="cr-raw-content">
                                <h5>Proposed Content:</h5>
                                <pre>{selectedRequest.proposed_content}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="cr-detail-column empty">
                    <p>Select a change request from the left list to review its diff.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
