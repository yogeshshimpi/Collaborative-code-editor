import './Navbar.css';
import { useState, useRef, useEffect } from 'react';
import {
  Code2,
  Play,
  Share2,
  Users,
  Hash,
  Edit2,
  Check,
  PanelLeft,
  LogIn,
  LogOut,
  FolderCode,
  User,
  ChevronDown,
  Eye,
  ShieldCheck,
  History,
  Activity,
  GitPullRequest,
  RotateCcw,
  Trash2,
  FilePlus,
  MoreHorizontal
} from 'lucide-react';

export default function Navbar({
  projectName = 'Untitled Project',
  roomId = 'demo-room',
  onChangeRoom,
  onRenameProject,
  connectionStatus = 'connecting',
  participantCount = 1,
  currentUser = { name: 'Guest', color: '#6d5dfc', initials: 'G' },
  activeUsers = [],
  userRole = 'editor',
  onRun,
  isPreviewOpen = false,
  onShare,
  onOpenCollaborators,
  onOpenHistory,
  onOpenActivity,
  isActivityOpen = false,
  onOpenChangeRequests,
  pendingRequestsCount = 0,
  requiresApproval = false,
  onToggleApprovalMode,
  isRightPanelOpen,
  toggleRightPanel,
  onToggleSidebar,
  isAuthenticated = false,
  onOpenAuth,
  onOpenProjects,
  onLogout
}) {
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [roomInput, setRoomInput] = useState(roomId);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectName);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const [isApprovalMenuOpen, setIsApprovalMenuOpen] = useState(false);
  const approvalMenuRef = useRef(null);

  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const mobileToolsRef = useRef(null);

  // Sync inputs when props change externally
  useEffect(() => {
    setRoomInput(roomId);
  }, [roomId]);

  useEffect(() => {
    setTitleInput(projectName);
  }, [projectName]);

  // Close dropdowns on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
      if (approvalMenuRef.current && !approvalMenuRef.current.contains(event.target)) {
        setIsApprovalMenuOpen(false);
      }
      if (mobileToolsRef.current && !mobileToolsRef.current.contains(event.target)) {
        setIsMobileToolsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsApprovalMenuOpen(false);
        setIsMobileToolsOpen(false);
      }
    }
    if (isUserMenuOpen || isApprovalMenuOpen || isMobileToolsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen, isApprovalMenuOpen, isMobileToolsOpen]);

  const handleRoomSubmit = (e) => {
    e?.preventDefault?.();
    const clean = roomInput.trim();
    if (clean && clean !== roomId) {
      if (onRenameProject) {
        onRenameProject({ newRoomId: clean });
      } else if (onChangeRoom) {
        onChangeRoom(clean);
      }
    }
    setIsEditingRoom(false);
  };

  const handleTitleSubmit = (e) => {
    e?.preventDefault?.();
    const clean = titleInput.trim();
    if (clean && clean !== projectName) {
      if (onRenameProject) {
        onRenameProject({ newName: clean });
      }
    }
    setIsEditingTitle(false);
  };

  const getConnectionConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          label: 'Connected',
          className: 'status-connected',
          title: 'Socket.IO connected to backend'
        };
      case 'connecting':
        return {
          label: 'Connecting...',
          className: 'status-connecting',
          title: 'Connecting to Socket.IO server'
        };
      case 'disconnected':
      default:
        return {
          label: 'Disconnected',
          className: 'status-disconnected',
          title: 'Disconnected from backend server'
        };
    }
  };

  const connConfig = getConnectionConfig();
  const peerUsers = activeUsers.filter((u) => u.id !== currentUser.id);

  return (
    <header className="navbar">
      <div className="navbar-left">
        {/* Mobile/Responsive Sidebar Toggle Button */}
        <button
          type="button"
          className="btn-sidebar-toggle"
          onClick={onToggleSidebar}
          title="Toggle Explorer"
          aria-label="Toggle Explorer"
        >
          <PanelLeft size={16} />
        </button>

        <div className="brand" title="CodeCollab Workspace">
          <div className="brand-icon">
            <Code2 size={18} />
          </div>
          <span className="brand-name">CodeCollab</span>
        </div>

        <div className="divider-vertical divider-desktop" />

        {/* Dynamic Real-time Connection Indicator */}
        <div className={`connection-pill ${connConfig.className}`} title={connConfig.title}>
          <span className="status-dot"></span>
          <span className="status-label">{connConfig.label}</span>
        </div>

        <div className="divider-vertical divider-desktop" />

        {/* Room Switcher / Display */}
        <div className="room-badge-container">
          {isEditingRoom ? (
            <form onSubmit={handleRoomSubmit} className="room-edit-form">
              <Hash size={13} className="room-icon" />
              <input
                type="text"
                className="room-input"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                autoFocus
                onBlur={handleRoomSubmit}
                placeholder="Room name"
              />
              <button type="submit" className="room-submit-btn" title="Confirm Room" aria-label="Confirm Room">
                <Check size={12} />
              </button>
            </form>
          ) : (
            <div
              className="room-badge"
              onClick={() => {
                setRoomInput(roomId);
                setIsEditingRoom(true);
              }}
              title="Click to switch room"
              role="button"
              tabIndex={0}
            >
              <Hash size={13} className="room-icon" />
              <span className="room-name">{roomId}</span>
              <Edit2 size={11} className="room-edit-icon" />
            </div>
          )}
        </div>

        <div className="divider-vertical divider-tablet" />

        <div className="project-title-container">
          {isEditingTitle ? (
            <form onSubmit={handleTitleSubmit} className="project-title-edit-form">
              <input
                type="text"
                className="project-title-input"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                autoFocus
                onBlur={handleTitleSubmit}
                placeholder="Project name"
              />
              <button type="submit" className="room-submit-btn" title="Confirm Name" aria-label="Confirm Name">
                <Check size={12} />
              </button>
            </form>
          ) : (
            <div
              className={`project-title-wrapper ${userRole !== 'viewer' ? 'editable' : ''}`}
              onClick={() => {
                if (userRole !== 'viewer') {
                  setTitleInput(projectName);
                  setIsEditingTitle(true);
                }
              }}
              title={userRole !== 'viewer' ? 'Click to rename project' : projectName}
              role={userRole !== 'viewer' ? 'button' : undefined}
              tabIndex={userRole !== 'viewer' ? 0 : undefined}
            >
              <span className="project-title">{projectName}</span>
              {userRole !== 'viewer' && <Edit2 size={11} className="title-edit-icon" />}
            </div>
          )}
        </div>

        {/* User Role Badge in Header */}
        {userRole === 'viewer' && (
          <div className="navbar-role-badge badge-viewer" title="You have View-Only access to this project. Editing and saving are disabled.">
            <Eye size={12} />
            <span>View Only</span>
          </div>
        )}
        {userRole === 'owner' && (
          <div className="navbar-role-badge badge-owner" title="You are the Owner of this project with full permissions.">
            <ShieldCheck size={12} />
            <span>Owner</span>
          </div>
        )}
      </div>

      <div className="navbar-right">
        {/* Collaborators counter button */}
        <button
          type="button"
          className={`collaborators-counter-btn ${isRightPanelOpen ? 'active' : ''}`}
          onClick={toggleRightPanel}
          title="Toggle Collaborators Panel"
          aria-label="Toggle Collaborators Panel"
        >
          <Users size={14} />
          <span className="participant-count-text">
            {participantCount} {participantCount === 1 ? 'collaborator' : 'collaborators'}
          </span>
          <span className="participant-count-short">{participantCount}</span>
        </button>

        {/* Peer Collaborator Avatars Stack */}
        {peerUsers.length > 0 && (
          <div className="peer-avatars-stack navbar-desktop-only" title={`${peerUsers.length} peer(s) in room`}>
            {peerUsers.slice(0, 3).map((peer) => {
              const initials = peer.name ? peer.name.replace(/[^0-9a-zA-Z]/g, '').slice(-2) : 'G';
              return (
                <div
                  key={peer.id || peer.socketId}
                  className="peer-avatar"
                  style={{ backgroundColor: peer.color }}
                  title={`Peer: ${peer.name}`}
                >
                  <span>{initials}</span>
                </div>
              );
            })}
            {peerUsers.length > 3 && (
              <div className="peer-avatar peer-avatar-more">
                <span>+{peerUsers.length - 3}</span>
              </div>
            )}
          </div>
        )}

        {/* My Projects shortcut button when logged in (Desktop) */}
        {isAuthenticated && (
          <button
            type="button"
            className="btn btn-secondary btn-action navbar-desktop-only"
            onClick={onOpenProjects}
            title="Manage Projects"
            aria-label="Manage Projects"
          >
            <FolderCode size={14} />
            <span className="btn-text">Projects</span>
          </button>
        )}

        {/* Sign In CTA when in guest mode (Desktop) */}
        {!isAuthenticated && (
          <button
            type="button"
            className="btn btn-secondary btn-action btn-auth navbar-desktop-only"
            onClick={() => onOpenAuth && onOpenAuth('login')}
            title="Sign in to save projects"
            aria-label="Sign In"
          >
            <LogIn size={14} />
            <span className="btn-text">Sign In</span>
          </button>
        )}

        {/* Version History action button (Desktop) */}
        {onOpenHistory && (
          <button
            type="button"
            className="btn btn-secondary btn-action navbar-desktop-only"
            onClick={onOpenHistory}
            title="View per-file version history & restore previous versions"
            aria-label="Version History"
          >
            <History size={14} />
            <span className="btn-text">History</span>
          </button>
        )}

        {/* Dedicated Owner Approval System Control in Navbar (Desktop) */}
        {userRole === 'owner' && onOpenChangeRequests && (
          <div className="navbar-approval-wrapper navbar-desktop-only" ref={approvalMenuRef}>
            <div className={`navbar-approval-control ${requiresApproval ? 'is-active' : 'is-inactive'}`} title="Approval System: Protect project from unapproved code edits, file deletions, and version restores">
              <button
                type="button"
                className="navbar-approval-pill"
                onClick={() => setIsApprovalMenuOpen((prev) => !prev)}
                title={
                  requiresApproval
                    ? 'Approval Mode is ACTIVE: Major changes (restore, delete file, edits) require your approval. Click for details.'
                    : 'Approval Mode is OFF: Editors can edit and delete directly. Click for details.'
                }
                aria-label="Approval System Menu"
                aria-expanded={isApprovalMenuOpen}
              >
                <ShieldCheck size={14} className={`approval-shield-icon ${requiresApproval ? 'active' : ''}`} />
                <span className="approval-pill-label">Approval System</span>
                <span className={`approval-status-tag ${requiresApproval ? 'tag-on' : 'tag-off'}`}>
                  {requiresApproval ? 'ON' : 'OFF'}
                </span>
                {pendingRequestsCount > 0 && (
                  <span
                    className="navbar-cr-badge pulse"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChangeRequests();
                    }}
                    title={`${pendingRequestsCount} change requests waiting for approval (click to review)`}
                  >
                    {pendingRequestsCount}
                  </span>
                )}
                <ChevronDown size={11} className={`approval-caret ${isApprovalMenuOpen ? 'open' : ''}`} />
              </button>

              {/* Direct One-Click Toggle for Owner */}
              {onToggleApprovalMode && (
                <button
                  type="button"
                  className={`navbar-approval-quick-toggle ${requiresApproval ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleApprovalMode(!requiresApproval);
                  }}
                  title={requiresApproval ? 'Turn OFF Approval Mode (Direct Editing Enabled)' : 'Turn ON Approval Mode (Owner Approval Required for Major Changes)'}
                  aria-label={requiresApproval ? 'Disable approval mode' : 'Enable approval mode'}
                >
                  <span className="quick-toggle-slider" />
                </button>
              )}
            </div>

            {/* Approval System Dropdown / Popover for Owner */}
            {isApprovalMenuOpen && (
              <div className="approval-dropdown-menu" role="menu">
                <div className="approval-dropdown-header">
                  <div className="approval-dropdown-title-row">
                    <ShieldCheck size={16} className={requiresApproval ? 'text-amber' : 'text-muted'} />
                    <span className="approval-dropdown-title">Strict Approval Mode</span>
                    <span className={`approval-status-tag ${requiresApproval ? 'tag-on' : 'tag-off'}`}>
                      {requiresApproval ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="approval-dropdown-subtitle">
                    Optional code approval gate. When enabled, only editor code edits require approval before being applied. File/folder operations remain immediate.
                  </p>
                </div>

                <div className="approval-dropdown-body">
                  <div className="approval-quick-toggle-row">
                    <div className="toggle-info">
                      <span className="toggle-title">Require approval before editor code is applied</span>
                      <span className="toggle-desc">
                        {requiresApproval
                          ? 'Strict review mode is ON. Editor code edits require owner approval.'
                          : 'Default mode: Editors collaborate normally without blocking approvals.'}
                      </span>
                    </div>
                    {onToggleApprovalMode && (
                      <button
                        type="button"
                        className={`navbar-approval-quick-toggle large ${requiresApproval ? 'active' : ''}`}
                        onClick={() => onToggleApprovalMode(!requiresApproval)}
                        title={requiresApproval ? 'Disable strict approval mode' : 'Enable strict approval mode'}
                      >
                        <span className="quick-toggle-slider" />
                      </button>
                    )}
                  </div>

                  <div className="approval-protected-features">
                    <span className="features-label">Workflow Behavior:</span>
                    <ul className="features-list">
                      <li className={requiresApproval ? 'active' : 'inactive'}>
                        <GitPullRequest size={13} className="feature-icon feature-code" />
                        <span><strong>Editor Code Edits:</strong> {requiresApproval ? 'Private draft requiring owner review' : 'Real-time collaborative live sync'}</span>
                      </li>
                      <li className="active">
                        <Trash2 size={13} className="feature-icon feature-delete" />
                        <span><strong>File & Folder Management:</strong> Immediate for editors (with 10s safe Undo)</span>
                      </li>
                      <li className="active">
                        <RotateCcw size={13} className="feature-icon feature-restore" />
                        <span><strong>Version Restores:</strong> Immediate rollback without approval</span>
                      </li>
                      <li className="active">
                        <ShieldCheck size={13} className="feature-icon feature-create" />
                        <span><strong>Protected Files:</strong> Critical files (e.g. .env, package.json) locked from editor edits</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="approval-dropdown-footer">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm btn-block"
                    onClick={() => {
                      setIsApprovalMenuOpen(false);
                      onOpenChangeRequests();
                    }}
                  >
                    <GitPullRequest size={13} />
                    <span>
                      {pendingRequestsCount > 0
                        ? `Review Pending Requests (${pendingRequestsCount})`
                        : 'Open Change Requests & History'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Change Requests / Approvals button for Collaborators (Desktop) */}
        {userRole !== 'owner' && onOpenChangeRequests && (
          <button
            type="button"
            className={`btn btn-secondary btn-action btn-cr-action navbar-desktop-only ${requiresApproval ? 'approval-active-editor' : ''}`}
            onClick={onOpenChangeRequests}
            title={requiresApproval ? "Approval Mode Active: Changes require owner approval" : "View Change Requests"}
            aria-label="Change Requests"
          >
            <GitPullRequest size={14} className={pendingRequestsCount > 0 || requiresApproval ? "text-amber" : ""} />
            <span className="btn-text">{requiresApproval ? 'Approvals' : 'Requests'}</span>
            {pendingRequestsCount > 0 && (
              <span className="navbar-cr-badge">{pendingRequestsCount}</span>
            )}
          </button>
        )}

        {/* Project Activity Log action button (Desktop) */}
        {onOpenActivity && (
          <button
            type="button"
            className={`btn btn-secondary btn-action navbar-desktop-only ${isActivityOpen ? 'active-action' : ''}`}
            onClick={onOpenActivity}
            title={isActivityOpen ? "Close Project Activity Log" : "View project activity log & timeline"}
            aria-label="Project Activity"
            aria-pressed={isActivityOpen}
          >
            <Activity size={14} />
            <span className="btn-text">Activity</span>
          </button>
        )}

        {/* Share Button (Desktop) */}
        <button
          type="button"
          className="btn btn-secondary btn-action navbar-desktop-only"
          onClick={onOpenCollaborators || onShare}
          title={userRole === 'owner' ? "Invite collaborators & manage permissions" : "Share project & view collaborators"}
          aria-label="Share Project"
        >
          <Share2 size={15} />
          <span className="btn-text">{userRole === 'owner' ? 'Share & Invite' : 'Share'}</span>
        </button>

        {/* MOBILE TOOLS DROPDOWN TRIGGER (Mobile Only: < 768px) */}
        <div className="navbar-mobile-tools-wrapper" ref={mobileToolsRef}>
          <button
            type="button"
            className={`btn btn-secondary btn-action btn-mobile-tools ${
              isMobileToolsOpen ? 'active' : ''
            }`}
            onClick={() => setIsMobileToolsOpen((v) => !v)}
            title="Project Tools & Collaboration Menu"
            aria-label="Project Tools"
            aria-expanded={isMobileToolsOpen}
            aria-haspopup="true"
          >
            <MoreHorizontal size={16} />
            {pendingRequestsCount > 0 && (
              <span className="navbar-cr-badge pulse">{pendingRequestsCount}</span>
            )}
          </button>

          {/* MOBILE TOOLS DROPDOWN MENU */}
          {isMobileToolsOpen && (
            <div className="navbar-mobile-tools-dropdown" role="menu">
              {/* Group 1: Project & File History */}
              <div className="tools-dropdown-section">
                <span className="tools-dropdown-header">Project & History</span>
                {isAuthenticated && onOpenProjects && (
                  <button
                    type="button"
                    className="tools-dropdown-item"
                    onClick={() => {
                      setIsMobileToolsOpen(false);
                      onOpenProjects();
                    }}
                  >
                    <FolderCode size={15} />
                    <span>My Projects</span>
                  </button>
                )}
                {onOpenHistory && (
                  <button
                    type="button"
                    className="tools-dropdown-item"
                    onClick={() => {
                      setIsMobileToolsOpen(false);
                      onOpenHistory();
                    }}
                  >
                    <History size={15} />
                    <span>Version History</span>
                  </button>
                )}
                {onOpenActivity && (
                  <button
                    type="button"
                    className={`tools-dropdown-item ${isActivityOpen ? 'active' : ''}`}
                    onClick={() => {
                      setIsMobileToolsOpen(false);
                      onOpenActivity();
                    }}
                  >
                    <Activity size={15} />
                    <span>Activity Log</span>
                  </button>
                )}
              </div>

              <div className="tools-dropdown-divider" />

              {/* Group 2: Collaboration & Approvals */}
              <div className="tools-dropdown-section">
                <span className="tools-dropdown-header">Collaboration & Access</span>
                <button
                  type="button"
                  className="tools-dropdown-item"
                  onClick={() => {
                    setIsMobileToolsOpen(false);
                    if (onOpenCollaborators) onOpenCollaborators();
                    else if (onShare) onShare();
                  }}
                >
                  <Share2 size={15} />
                  <span>{userRole === 'owner' ? 'Share & Invite' : 'Share Project'}</span>
                </button>

                {/* Owner Approvals workflow */}
                {userRole === 'owner' && (
                  <>
                    {onToggleApprovalMode && (
                      <div className="tools-dropdown-toggle-item">
                        <div className="tools-toggle-left">
                          <ShieldCheck
                            size={15}
                            className={requiresApproval ? 'text-amber' : 'text-muted'}
                          />
                          <span>Strict Review Mode</span>
                        </div>
                        <button
                          type="button"
                          className={`navbar-approval-quick-toggle ${
                            requiresApproval ? 'active' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleApprovalMode(!requiresApproval);
                          }}
                          title={
                            requiresApproval
                              ? 'Disable strict review mode'
                              : 'Enable strict review mode'
                          }
                        >
                          <span className="quick-toggle-slider" />
                        </button>
                      </div>
                    )}

                    {onOpenChangeRequests && (
                      <button
                        type="button"
                        className="tools-dropdown-item"
                        onClick={() => {
                          setIsMobileToolsOpen(false);
                          onOpenChangeRequests();
                        }}
                      >
                        <GitPullRequest
                          size={15}
                          className={pendingRequestsCount > 0 ? 'text-amber' : ''}
                        />
                        <span>Change Requests</span>
                        {pendingRequestsCount > 0 && (
                          <span className="navbar-cr-badge">{pendingRequestsCount}</span>
                        )}
                      </button>
                    )}
                  </>
                )}

                {/* Collaborator Approvals workflow */}
                {userRole !== 'owner' && onOpenChangeRequests && (
                  <button
                    type="button"
                    className="tools-dropdown-item"
                    onClick={() => {
                      setIsMobileToolsOpen(false);
                      onOpenChangeRequests();
                    }}
                  >
                    <GitPullRequest
                      size={15}
                      className={
                        pendingRequestsCount > 0 || requiresApproval ? 'text-amber' : ''
                      }
                    />
                    <span>{requiresApproval ? 'Approvals & Requests' : 'Change Requests'}</span>
                    {pendingRequestsCount > 0 && (
                      <span className="navbar-cr-badge">{pendingRequestsCount}</span>
                    )}
                  </button>
                )}
              </div>

              {/* Group 3: Sign In CTA if guest */}
              {!isAuthenticated && onOpenAuth && (
                <>
                  <div className="tools-dropdown-divider" />
                  <div className="tools-dropdown-section">
                    <button
                      type="button"
                      className="tools-dropdown-item"
                      onClick={() => {
                        setIsMobileToolsOpen(false);
                        onOpenAuth('login');
                      }}
                    >
                      <LogIn size={15} />
                      <span>Sign In</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`btn btn-primary btn-action ${isPreviewOpen ? 'active-run' : ''}`}
          onClick={onRun}
          title={isPreviewOpen ? "Re-run Live Preview" : "Run Code (Live Preview)"}
          aria-label="Run Code"
        >
          <Play size={15} fill="currentColor" />
          <span className="btn-text">{isPreviewOpen ? 'Re-Run' : 'Run'}</span>
        </button>

        <div className="divider-vertical divider-desktop" />

        {/* User Account / Avatar Dropdown */}
        <div className="user-menu-container" ref={userMenuRef}>
          <button
            type="button"
            className="user-avatar-trigger"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            title={currentUser.name}
            aria-label="User account menu"
            aria-expanded={isUserMenuOpen}
            aria-haspopup="true"
          >
            <div
              className="user-avatar"
              style={{ backgroundColor: currentUser.color }}
            >
              <span>{currentUser.initials || currentUser.name.slice(0, 2).toUpperCase()}</span>
            </div>
            <ChevronDown size={12} className="user-caret" />
          </button>

          {isUserMenuOpen && (
            <div className="user-dropdown-menu" role="menu">
              <div className="dropdown-user-header">
                <div
                  className="dropdown-avatar"
                  style={{ backgroundColor: currentUser.color }}
                >
                  <span>{currentUser.initials || currentUser.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="dropdown-user-info">
                  <span className="dropdown-user-name">{currentUser.name}</span>
                  <span className="dropdown-user-email">
                    {isAuthenticated ? currentUser.email : 'Guest Session'}
                  </span>
                </div>
              </div>

              <div className="dropdown-divider" />

              {onOpenActivity && (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenActivity();
                  }}
                  role="menuitem"
                >
                  <Activity size={14} />
                  <span>Activity Log</span>
                </button>
              )}

              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onOpenProjects) onOpenProjects();
                    }}
                    role="menuitem"
                  >
                    <FolderCode size={14} />
                    <span>My Projects</span>
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    type="button"
                    className="dropdown-item danger"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onLogout) onLogout();
                    }}
                    role="menuitem"
                  >
                    <LogOut size={14} />
                    <span>Log Out</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onOpenAuth) onOpenAuth('login');
                    }}
                    role="menuitem"
                  >
                    <LogIn size={14} />
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      if (onOpenAuth) onOpenAuth('register');
                    }}
                    role="menuitem"
                  >
                    <User size={14} />
                    <span>Create Account</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
