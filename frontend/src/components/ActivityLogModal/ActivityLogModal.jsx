import './ActivityLogModal.css';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Activity,
  X,
  RefreshCw,
  Search,
  FilePlus,
  FolderPlus,
  FileEdit,
  Trash2,
  History,
  UserPlus,
  ShieldCheck,
  UserX,
  LogOut,
  UserCheck,
  Move,
  FolderMinus,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';

// Generate consistent avatar color based on user name string
function getAvatarColor(name = '') {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#10b981', '#06b6d4', '#3b82f6', '#f59e0b',
    '#14b8a6', '#84cc16'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Generate initials from user name
function getInitials(name = 'User') {
  const clean = name.trim();
  if (!clean) return 'U';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

// Format relative timestamp nicely
function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatFullTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

// Return icon, label, and accent color per action type
function getActionMeta(actionType) {
  switch (actionType) {
    case 'file_create':
      return {
        icon: FilePlus,
        label: 'File Created',
        badgeClass: 'badge-action-create',
        color: '#10b981',
        category: 'files'
      };
    case 'folder_create':
      return {
        icon: FolderPlus,
        label: 'Folder Created',
        badgeClass: 'badge-action-create',
        color: '#3b82f6',
        category: 'files'
      };
    case 'file_rename':
      return {
        icon: FileEdit,
        label: 'File Renamed',
        badgeClass: 'badge-action-rename',
        color: '#f59e0b',
        category: 'files'
      };
    case 'folder_rename':
      return {
        icon: FileEdit,
        label: 'Folder Renamed',
        badgeClass: 'badge-action-rename',
        color: '#f59e0b',
        category: 'files'
      };
    case 'file_delete':
      return {
        icon: Trash2,
        label: 'File Deleted',
        badgeClass: 'badge-action-delete',
        color: '#f43f5e',
        category: 'files'
      };
    case 'folder_delete':
      return {
        icon: FolderMinus,
        label: 'Folder Deleted',
        badgeClass: 'badge-action-delete',
        color: '#f43f5e',
        category: 'files'
      };
    case 'item_move':
      return {
        icon: Move,
        label: 'Item Moved',
        badgeClass: 'badge-action-move',
        color: '#06b6d4',
        category: 'files'
      };
    case 'file_restore':
      return {
        icon: History,
        label: 'Version Restored',
        badgeClass: 'badge-action-restore',
        color: '#8b5cf6',
        category: 'versions'
      };
    case 'member_invite':
      return {
        icon: UserPlus,
        label: 'Invited Member',
        badgeClass: 'badge-action-member',
        color: '#14b8a6',
        category: 'members'
      };
    case 'member_role_change':
      return {
        icon: ShieldCheck,
        label: 'Role Updated',
        badgeClass: 'badge-action-role',
        color: '#f97316',
        category: 'members'
      };
    case 'member_remove':
      return {
        icon: UserX,
        label: 'Member Removed',
        badgeClass: 'badge-action-delete',
        color: '#ef4444',
        category: 'members'
      };
    case 'member_leave':
      return {
        icon: LogOut,
        label: 'Member Left',
        badgeClass: 'badge-action-delete',
        color: '#64748b',
        category: 'members'
      };
    case 'member_join':
      return {
        icon: UserCheck,
        label: 'Member Joined',
        badgeClass: 'badge-action-member',
        color: '#10b981',
        category: 'members'
      };
    default:
      return {
        icon: Activity,
        label: 'Activity',
        badgeClass: 'badge-action-default',
        color: '#6366f1',
        category: 'all'
      };
  }
}

export default function ActivityLogModal({
  isOpen,
  onClose,
  projectId,
  roomId,
  projectName = 'Project',
  liveActivityEntry = null,
  isSidebar = false
}) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'files' | 'members' | 'versions'
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const targetId = projectId || roomId || 'demo-room';

  // Fetch activities from API
  const fetchActivities = useCallback(async (isSilent = false) => {
    if (!isOpen) return;
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const res = await api.getProjectActivity(targetId, {
        limit: 100,
        filter: activeFilter
      });
      if (res?.logs) {
        setLogs(res.logs);
      }
    } catch (err) {
      console.warn('[Activity Log Modal] Failed to fetch activities:', err.message);
      setError(err.message || 'Failed to load activity logs.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isOpen, targetId, activeFilter]);

  // Initial load and filter change
  useEffect(() => {
    if (isOpen) {
      fetchActivities();
    }
  }, [isOpen, fetchActivities]);

  // Prepend live activity entries received in real-time from socket
  useEffect(() => {
    if (liveActivityEntry && isOpen) {
      setLogs((prev) => {
        // Prevent duplicate IDs
        if (prev.some((item) => item.id === liveActivityEntry.id)) {
          return prev;
        }
        return [liveActivityEntry, ...prev];
      });
    }
  }, [liveActivityEntry, isOpen]);

  // Keyboard escape listener to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Client-side search and category filtering
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter check
      if (activeFilter !== 'all') {
        const meta = getActionMeta(log.action_type);
        if (meta.category !== activeFilter) {
          return false;
        }
      }

      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSummary = log.summary?.toLowerCase().includes(q);
        const matchesUser = log.user_name?.toLowerCase().includes(q);
        const matchesTarget = log.target_name?.toLowerCase().includes(q);
        const matchesType = log.action_type?.toLowerCase().includes(q);
        return matchesSummary || matchesUser || matchesTarget || matchesType;
      }

      return true;
    });
  }, [logs, activeFilter, searchQuery]);

  // Compute category counts
  const counts = useMemo(() => {
    const res = { all: logs.length, files: 0, members: 0, versions: 0 };
    for (const l of logs) {
      const meta = getActionMeta(l.action_type);
      if (meta.category === 'files') res.files++;
      else if (meta.category === 'members') res.members++;
      else if (meta.category === 'versions') res.versions++;
    }
    return res;
  }, [logs]);

  if (!isOpen) return null;

  const innerContent = (
    <>
      {/* Modal / Sidebar Header */}
      <div className="activity-modal-header">
        <div className="activity-header-left">
          <div className="activity-header-icon-wrap">
            <Activity size={isSidebar ? 16 : 18} />
          </div>
          <div className="activity-header-titles">
            <div className="activity-title-row">
              <h2 className="activity-modal-title">
                {isSidebar ? 'Activity Log' : 'Project Activity Log'}
              </h2>
              <span className="activity-project-pill" title={`Active workspace: ${projectName}`}>
                {projectName}
              </span>
              <span className="activity-live-indicator" title="Connected to real-time activity stream">
                <span className="pulse-dot" />
                Live Sync
              </span>
            </div>
            {!isSidebar && (
              <p className="activity-modal-subtitle">
                Track file modifications, team invitations, role changes, and version restores.
              </p>
            )}
          </div>
        </div>

        <div className="activity-header-actions">
          <button
            type="button"
            className={`activity-btn-refresh ${isRefreshing ? 'is-spinning' : ''}`}
            onClick={() => fetchActivities(true)}
            title="Refresh activity logs"
            disabled={isLoading || isRefreshing}
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title={isSidebar ? "Close Activity Sidebar" : "Close (Esc)"}
            aria-label="Close activity log"
          >
            <X size={isSidebar ? 16 : 18} />
          </button>
        </div>
      </div>

        {/* Toolbar: Filter Pills & Search Box */}
        <div className="activity-toolbar">
          <div className="activity-filter-pills" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'all'}
              className={`activity-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Actions
              <span className="activity-count-badge">{counts.all}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'files'}
              className={`activity-filter-pill ${activeFilter === 'files' ? 'active' : ''}`}
              onClick={() => setActiveFilter('files')}
            >
              Files & Folders
              <span className="activity-count-badge">{counts.files}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'members'}
              className={`activity-filter-pill ${activeFilter === 'members' ? 'active' : ''}`}
              onClick={() => setActiveFilter('members')}
            >
              Collaborators
              <span className="activity-count-badge">{counts.members}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === 'versions'}
              className={`activity-filter-pill ${activeFilter === 'versions' ? 'active' : ''}`}
              onClick={() => setActiveFilter('versions')}
            >
              Versions & Restores
              <span className="activity-count-badge">{counts.versions}</span>
            </button>
          </div>

          <div className="activity-search-wrap">
            <Search size={14} className="activity-search-icon" />
            <input
              type="text"
              className="activity-search-input"
              placeholder="Search by user, action, or file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="activity-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Main Timeline Body */}
        <div className="activity-modal-body">
          {isLoading ? (
            <div className="activity-loading-state">
              <div className="activity-spinner" />
              <span>Loading project activity history...</span>
            </div>
          ) : error ? (
            <div className="activity-error-state">
              <p>{error}</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fetchActivities()}
              >
                Retry
              </button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="activity-empty-state">
              <div className="activity-empty-icon-wrap">
                <Activity size={28} />
              </div>
              <h3>No activity records found</h3>
              <p>
                {searchQuery
                  ? `No events match "${searchQuery}". Try a different search keyword.`
                  : activeFilter !== 'all'
                  ? `No ${activeFilter} activities recorded yet.`
                  : 'Actions like file changes, invitations, and restores will appear here in real-time.'}
              </p>
              {(searchQuery || activeFilter !== 'all') && (
                <button
                  type="button"
                  className="activity-btn-reset-filters"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                  }}
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="activity-timeline-container">
              <div className="activity-timeline-line" />
              <div className="activity-timeline-list">
                {filteredLogs.map((log) => {
                  const meta = getActionMeta(log.action_type);
                  const ActionIcon = meta.icon;
                  const avatarBg = getAvatarColor(log.user_name);
                  const initials = getInitials(log.user_name);
                  const fullDate = formatFullTime(log.created_at);
                  const relTime = formatRelativeTime(log.created_at);

                  return (
                    <div
                      key={log.id}
                      className="activity-item-card"
                      title={fullDate}
                    >
                      {/* Avatar with floating action badge */}
                      <div className="activity-avatar-container">
                        <div
                          className="activity-user-avatar"
                          style={{ backgroundColor: avatarBg }}
                        >
                          <span>{initials}</span>
                        </div>
                        <div
                          className={`activity-action-icon-pill ${meta.badgeClass}`}
                          style={{ borderColor: meta.color }}
                        >
                          <ActionIcon size={11} style={{ color: meta.color }} />
                        </div>
                      </div>

                      {/* Content Card */}
                      <div className="activity-item-content">
                        <div className="activity-item-header">
                          <div className="activity-actor-info">
                            <span className="activity-actor-name">{log.user_name}</span>
                            <span className={`activity-type-badge ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                          </div>
                          <div className="activity-time-badge" title={fullDate}>
                            <Clock size={11} />
                            <span>{relTime}</span>
                          </div>
                        </div>

                        {/* Rich summary text with code highlight */}
                        <div className="activity-summary-text">
                          <span className="summary-sentence">{log.summary}</span>
                        </div>

                        {/* Additional contextual chips if present */}
                        {log.details && (log.details.oldPath || log.details.role || log.details.newRole) && (
                          <div className="activity-details-chips">
                            {log.details.oldPath && log.details.newPath && (
                              <span className="detail-chip detail-path">
                                <span className="chip-label">From:</span> {log.details.oldPath} → <span className="chip-label">To:</span> {log.details.newPath}
                              </span>
                            )}
                            {log.details.newRole && (
                              <span className="detail-chip detail-role">
                                <ShieldCheck size={10} /> Role changed to <strong>{log.details.newRole}</strong>
                              </span>
                            )}
                            {log.details.role && log.action_type === 'member_invite' && (
                              <span className="detail-chip detail-role">
                                <UserPlus size={10} /> Invited as <strong>{log.details.role}</strong>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal / Sidebar Footer */}
        <div className="activity-modal-footer">
          <div className="activity-footer-meta">
            <span className="activity-counter-text">
              Showing <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> actions
            </span>
          </div>
          {!isSidebar && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
    </>
  );

  if (isSidebar) {
    return (
      <aside className="activity-sidebar-panel" aria-label="Project Activity Log">
        {innerContent}
      </aside>
    );
  }

  return (
    <div className="modal-backdrop activity-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-container activity-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {innerContent}
      </div>
    </div>
  );
}
