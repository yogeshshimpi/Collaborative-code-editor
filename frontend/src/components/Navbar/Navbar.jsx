import './Navbar.css';
import { useState, useRef, useEffect } from 'react';
import {
  Code2,
  Play,
  Users,
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
  MoreHorizontal,
  MessageSquare,
  MessageCircle,
  Settings
} from 'lucide-react';
import NotificationBell from '../Notifications/NotificationBell';

export default function Navbar({
  projectName = 'Untitled Project',
  roomId = 'demo-room',
  activeFile = '',
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
  onToggleCollaborators,
  isCollabDrawerOpen = false,
  onOpenHistory,
  onOpenActivity,
  isActivityOpen = false,
  onOpenChangeRequests,
  pendingRequestsCount = 0,
  requiresApproval = false,
  onToggleApprovalMode,
  onToggleSidebar,
  isAuthenticated = false,
  onOpenAuth,
  onOpenProjects,
  onLogout,
  // Collaboration Chat, Comments, and Notifications
  onToggleChat,
  isChatOpen = false,
  unreadChatCount = 0,
  onToggleComments,
  isCommentsOpen = false,
  openCommentsCount = 0,
  notifications = [],
  unreadNotificationsCount = 0,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNavigateNotification
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectName);

  // Dropdown states for Workspace, Approvals, Profile, and Mobile overflow menus
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const workspaceMenuRef = useRef(null);

  const [isApprovalMenuOpen, setIsApprovalMenuOpen] = useState(false);
  const approvalMenuRef = useRef(null);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const mobileToolsRef = useRef(null);

  useEffect(() => {
    setTitleInput(projectName);
  }, [projectName]);

  // Close dropdowns on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target)) {
        setIsWorkspaceMenuOpen(false);
      }
      if (approvalMenuRef.current && !approvalMenuRef.current.contains(event.target)) {
        setIsApprovalMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
      if (mobileToolsRef.current && !mobileToolsRef.current.contains(event.target)) {
        setIsMobileToolsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsWorkspaceMenuOpen(false);
        setIsApprovalMenuOpen(false);
        setIsUserMenuOpen(false);
        setIsMobileToolsOpen(false);
      }
    }
    if (
      isWorkspaceMenuOpen ||
      isApprovalMenuOpen ||
      isUserMenuOpen ||
      isMobileToolsOpen
    ) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    isWorkspaceMenuOpen,
    isApprovalMenuOpen,
    isUserMenuOpen,
    isMobileToolsOpen
  ]);

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
          label: 'Offline',
          className: 'status-disconnected',
          title: 'Disconnected from backend server'
        };
    }
  };

  const connConfig = getConnectionConfig();
  const peerUsers = activeUsers.filter((u) => u.id !== currentUser.id);

  return (
    <header className="navbar">
      {/* =========================================================================
          LEFT ZONE: [ CodeCollab ] [ Connection ] [ Project Name ] [ Owner Badge ]
          ========================================================================= */}
      <div className="navbar-left">
        {/* Responsive Sidebar Explorer Toggle */}
        <button
          type="button"
          className="btn-sidebar-toggle"
          onClick={onToggleSidebar}
          title="Toggle Explorer"
          aria-label="Toggle Explorer"
        >
          <PanelLeft size={16} />
        </button>

        {/* [ CodeCollab ] Brand */}
        <div className="brand" title="CodeCollab IDE">
          <div className="brand-icon">
            <Code2 size={15} />
          </div>
          <span className="brand-name">CodeCollab</span>
        </div>

        {/* [ Connection ] Indicator */}
        <div
          className={`navbar-connection-badge ${connConfig.className}`}
          title={connConfig.title}
        >
          <span className={`status-dot-indicator ${connConfig.className}`} />
          <span className="connection-text">{connConfig.label}</span>
        </div>

        {/* [ Project Name ] & [ Owner Badge ] Context Capsule */}
        <div className="project-context-capsule">
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
              {userRole !== 'viewer' && <Edit2 size={10} className="title-edit-icon" />}
            </div>
          )}

          {/* Role Tag */}
          {userRole === 'owner' && (
            <span className="navbar-role-tag role-owner" title="Project Owner (Full Administrative Access)">
              <ShieldCheck size={11} />
              <span className="role-tag-text">Owner</span>
            </span>
          )}
          {userRole === 'viewer' && (
            <span className="navbar-role-tag role-viewer" title="View-Only Access (Editing disabled)">
              <Eye size={11} />
              <span className="role-tag-text">View Only</span>
            </span>
          )}
          {userRole === 'editor' && (
            <span className="navbar-role-tag role-editor" title="Editor (Live Collaboration Access)">
              <User size={11} />
              <span className="role-tag-text">Editor</span>
            </span>
          )}
        </div>
      </div>

      {/* =========================================================================
          CENTER ZONE: Clean Breadcrumb [ Active File ] (Static, no switch room button)
          ========================================================================= */}
      <div className="navbar-center navbar-desktop-only">
        <div className="navbar-center-breadcrumb">
          <span className="breadcrumb-proj" title={`Project: ${projectName}`}>
            {projectName}
          </span>
          {activeFile && (
            <>
              <span className="breadcrumb-sep">›</span>
              <span className="breadcrumb-file" title={`Active file: ${activeFile}`}>
                {activeFile}
              </span>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          RIGHT ZONE: 3 Structured Dropdowns + Bell + Run + Profile
          ========================================================================= */}
      <div className="navbar-right">

        {/* ---------------------------------------------------------------------
            COLLABORATORS:
            When clicked, directly opens right-side Collaboration Drawer
            with Live Members count and 3 sections: Chat, Comments, Share & Invite
            --------------------------------------------------------------------- */}
        <div className="navbar-collab-wrapper navbar-desktop-tools">
          <button
            type="button"
            className={`navbar-btn-dropdown navbar-btn-collab ${isCollabDrawerOpen ? 'active' : ''}`}
            onClick={() => {
              if (onToggleCollaborators) {
                onToggleCollaborators('collaborators');
              } else if (onOpenCollaborators) {
                onOpenCollaborators('collaborators');
              }
            }}
            title="Collaborators & Live Team (Opens Collaboration Drawer on Collaborators)"
            aria-label="Collaborators Panel"
          >
            <div className="presence-avatars">
              {peerUsers.slice(0, 2).map((peer) => {
                const initials = peer.name ? peer.name.slice(0, 1).toUpperCase() : 'G';
                return (
                  <span
                    key={peer.id || peer.socketId}
                    className="presence-avatar"
                    style={{ backgroundColor: peer.color }}
                  >
                    {initials}
                  </span>
                );
              })}
              <span
                className="presence-avatar presence-avatar-self"
                style={{ backgroundColor: currentUser.color }}
              >
                {currentUser.initials || currentUser.name.slice(0, 1).toUpperCase()}
              </span>
            </div>
            <span className="navbar-btn-label">Collaborators</span>
            <span className="presence-count-pill">{participantCount}</span>

            {(unreadChatCount > 0 || openCommentsCount > 0) && (
              <span className="navbar-badge navbar-chat-badge pulse">
                {(unreadChatCount || 0) + (openCommentsCount || 0)}
              </span>
            )}
          </button>
        </div>

        {/* ---------------------------------------------------------------------
            DROPDOWN 2: Workspace & History
            - My Projects
            - Version History
            - Activity Log
            --------------------------------------------------------------------- */}
        <div className="navbar-dropdown-wrapper navbar-desktop-tools" ref={workspaceMenuRef}>
          <button
            type="button"
            className={`navbar-btn-dropdown ${isWorkspaceMenuOpen ? 'active' : ''}`}
            onClick={() => setIsWorkspaceMenuOpen((prev) => !prev)}
            title="Workspace & History"
            aria-label="Workspace & History Menu"
            aria-expanded={isWorkspaceMenuOpen}
            aria-haspopup="true"
          >
            <FolderCode size={14} />
            <span className="navbar-btn-label">Workspace & History</span>
            <ChevronDown size={11} className={`dropdown-caret ${isWorkspaceMenuOpen ? 'open' : ''}`} />
          </button>

          {isWorkspaceMenuOpen && (
            <div className="workspace-dropdown-menu" role="menu">
              <div className="workspace-dropdown-header">
                <span className="workspace-dropdown-title">Workspace & History</span>
              </div>

              <div className="dropdown-action-group">
                {isAuthenticated && onOpenProjects && (
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    onClick={() => {
                      setIsWorkspaceMenuOpen(false);
                      onOpenProjects();
                    }}
                    role="menuitem"
                  >
                    <div className="menu-item-left">
                      <FolderCode size={14} />
                      <span>My Projects</span>
                    </div>
                  </button>
                )}

                {onOpenHistory && (
                  <button
                    type="button"
                    className="dropdown-menu-item"
                    onClick={() => {
                      setIsWorkspaceMenuOpen(false);
                      onOpenHistory();
                    }}
                    role="menuitem"
                  >
                    <div className="menu-item-left">
                      <History size={14} />
                      <span>Version History</span>
                    </div>
                  </button>
                )}

                {onOpenActivity && (
                  <button
                    type="button"
                    className={`dropdown-menu-item ${isActivityOpen ? 'active' : ''}`}
                    onClick={() => {
                      setIsWorkspaceMenuOpen(false);
                      onOpenActivity();
                    }}
                    role="menuitem"
                  >
                    <div className="menu-item-left">
                      <Activity size={14} />
                      <span>Activity Log</span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------------------
            DROPDOWN 3: Approvals & Review
            - Strict Review Mode (toggle)
            - Approvals & Requests
            --------------------------------------------------------------------- */}
        <div className="navbar-dropdown-wrapper navbar-desktop-tools" ref={approvalMenuRef}>
          <button
            type="button"
            className={`navbar-btn-dropdown ${requiresApproval ? 'active-approval' : ''} ${
              isApprovalMenuOpen ? 'active' : ''
            }`}
            onClick={() => setIsApprovalMenuOpen((prev) => !prev)}
            title="Approvals & Review"
            aria-label="Approvals & Review Menu"
            aria-expanded={isApprovalMenuOpen}
            aria-haspopup="true"
          >
            <ShieldCheck size={14} className={requiresApproval ? 'text-amber' : ''} />
            <span className="navbar-btn-label">Approvals & Review</span>
            {pendingRequestsCount > 0 && (
              <span className="navbar-cr-badge pulse">{pendingRequestsCount}</span>
            )}
            <ChevronDown size={11} className={`dropdown-caret ${isApprovalMenuOpen ? 'open' : ''}`} />
          </button>

          {isApprovalMenuOpen && (
            <div className="approval-dropdown-menu" role="menu">
              <div className="approval-dropdown-header">
                <div className="approval-dropdown-title-row">
                  <ShieldCheck size={15} className={requiresApproval ? 'text-amber' : 'text-muted'} />
                  <span className="approval-dropdown-title">Approvals & Review</span>
                  <span className={`approval-status-tag ${requiresApproval ? 'tag-on' : 'tag-off'}`}>
                    {requiresApproval ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>

              <div className="approval-dropdown-body">
                {/* 1. Strict Review Mode Toggle for Owner */}
                {userRole === 'owner' && onToggleApprovalMode && (
                  <div className="approval-quick-toggle-row">
                    <div className="toggle-info">
                      <span className="toggle-title">Strict Review Mode</span>
                      <span className="toggle-desc">
                        {requiresApproval
                          ? 'Active: Code edits require owner approval.'
                          : 'Inactive: Real-time collaborative sync.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`navbar-approval-quick-toggle large ${requiresApproval ? 'active' : ''}`}
                      onClick={() => onToggleApprovalMode(!requiresApproval)}
                      title={requiresApproval ? 'Disable strict review mode' : 'Enable strict review mode'}
                    >
                      <span className="quick-toggle-slider" />
                    </button>
                  </div>
                )}

                {/* 2. Approvals & Requests Item */}
                {onOpenChangeRequests && (
                  <div className="approval-requests-section">
                    <button
                      type="button"
                      className="dropdown-menu-item approval-cr-btn"
                      onClick={() => {
                        setIsApprovalMenuOpen(false);
                        onOpenChangeRequests();
                      }}
                      role="menuitem"
                    >
                      <div className="menu-item-left">
                        <GitPullRequest size={14} className={pendingRequestsCount > 0 || requiresApproval ? 'text-amber' : ''} />
                        <span>Approvals & Requests</span>
                      </div>
                      {pendingRequestsCount > 0 && (
                        <span className="navbar-cr-badge">{pendingRequestsCount}</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadNotificationsCount}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          onNavigateNotification={onNavigateNotification}
        />

        {/* Mobile / Responsive More Tools Trigger (<= 1100px) */}
        <div className="navbar-mobile-tools-wrapper" ref={mobileToolsRef}>
          <button
            type="button"
            className={`navbar-icon-btn btn-mobile-tools ${
              isMobileToolsOpen ? 'active' : ''
            }`}
            onClick={() => setIsMobileToolsOpen((v) => !v)}
            title="More Options"
            aria-label="More Options"
            aria-expanded={isMobileToolsOpen}
            aria-haspopup="true"
          >
            <MoreHorizontal size={16} />
            {(pendingRequestsCount > 0 || unreadChatCount > 0) && (
              <span className="navbar-cr-badge pulse">
                {(pendingRequestsCount || 0) + (unreadChatCount || 0)}
              </span>
            )}
          </button>

          {/* Mobile Overflow Menu */}
          {isMobileToolsOpen && (
            <div className="navbar-mobile-tools-dropdown" role="menu">
              {/* 1. Collaborators */}
              <div className="tools-dropdown-section">
                <span className="tools-dropdown-header">1. Collaborators</span>
                <button
                  type="button"
                  className="tools-dropdown-item"
                  onClick={() => {
                    setIsMobileToolsOpen(false);
                    if (onOpenCollaborators) onOpenCollaborators('collaborators');
                  }}
                >
                  <Users size={14} />
                  <span>Collaborators ({participantCount})</span>
                </button>
                <button
                  type="button"
                  className="tools-dropdown-item"
                  onClick={() => {
                    setIsMobileToolsOpen(false);
                    if (onOpenCollaborators) onOpenCollaborators('chat');
                    else if (onToggleChat) onToggleChat();
                  }}
                >
                  <MessageSquare size={14} />
                  <span>Chat</span>
                  {unreadChatCount > 0 && (
                    <span className="navbar-badge navbar-chat-badge">{unreadChatCount}</span>
                  )}
                </button>
                <button
                  type="button"
                  className="tools-dropdown-item"
                  onClick={() => {
                    setIsMobileToolsOpen(false);
                    if (onOpenCollaborators) onOpenCollaborators('comments');
                    else if (onToggleComments) onToggleComments();
                  }}
                >
                  <MessageCircle size={14} />
                  <span>Comment</span>
                  {openCommentsCount > 0 && (
                    <span className="navbar-badge navbar-comment-badge">{openCommentsCount}</span>
                  )}
                </button>
              </div>

              <div className="tools-dropdown-divider" />

              {/* 2. Workspace & History */}
              <div className="tools-dropdown-section">
                <span className="tools-dropdown-header">2. Workspace & History</span>
                {isAuthenticated && onOpenProjects && (
                  <button
                    type="button"
                    className="tools-dropdown-item"
                    onClick={() => {
                      setIsMobileToolsOpen(false);
                      onOpenProjects();
                    }}
                  >
                    <FolderCode size={14} />
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
                    <History size={14} />
                    <span>Version History</span>
                  </button>
                )}
                {onOpenActivity && (
                  <button
                    type="button"
                    className="tools-dropdown-item"
                    onClick={() => {
                      setIsMobileToolsOpen(false);
                      onOpenActivity();
                    }}
                  >
                    <Activity size={14} />
                    <span>Activity Log</span>
                  </button>
                )}
              </div>

              <div className="tools-dropdown-divider" />

              {/* 3. Approvals & Review */}
              <div className="tools-dropdown-section">
                <span className="tools-dropdown-header">3. Approvals & Review</span>
                {userRole === 'owner' && onToggleApprovalMode && (
                  <div className="tools-dropdown-toggle-item">
                    <div className="tools-toggle-left">
                      <ShieldCheck
                        size={14}
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
                      size={14}
                      className={pendingRequestsCount > 0 || requiresApproval ? 'text-amber' : ''}
                    />
                    <span>Approvals & Requests</span>
                    {pendingRequestsCount > 0 && (
                      <span className="navbar-cr-badge">{pendingRequestsCount}</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Run Button (Desktop only; on mobile, editor TabBar maintains the single Run button) */}
        <button
          type="button"
          className={`navbar-btn-run ${isPreviewOpen ? 'active-run' : ''}`}
          onClick={onRun}
          title={isPreviewOpen ? "Re-run Live Preview (Ctrl+Enter)" : "Run Code (Live Preview)"}
          aria-label="Run Code"
        >
          <Play size={12} fill="currentColor" />
          <span className="btn-run-text">{isPreviewOpen ? 'Re-Run' : 'Run'}</span>
        </button>

        {/* Profile Dropdown */}
        <div className="user-menu-container" ref={userMenuRef}>
          <button
            type="button"
            className="user-avatar-trigger"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            title={`${currentUser.name} (${userRole})`}
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
            <ChevronDown size={11} className="user-caret" />
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

              {/* Settings button only (functionality to be added later) */}
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setIsUserMenuOpen(false);
                }}
                role="menuitem"
              >
                <Settings size={14} />
                <span>Settings</span>
              </button>

              <div className="dropdown-divider" />

              {isAuthenticated ? (
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
