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
  ShieldAlert,
  History
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
  onShare,
  onOpenCollaborators,
  onOpenHistory,
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

  // Sync inputs when props change externally
  useEffect(() => {
    setRoomInput(roomId);
  }, [roomId]);

  useEffect(() => {
    setTitleInput(projectName);
  }, [projectName]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

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
          <div className="peer-avatars-stack" title={`${peerUsers.length} peer(s) in room`}>
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

        {/* My Projects shortcut button when logged in */}
        {isAuthenticated && (
          <button
            type="button"
            className="btn btn-secondary btn-action"
            onClick={onOpenProjects}
            title="Manage Projects"
            aria-label="Manage Projects"
          >
            <FolderCode size={14} />
            <span className="btn-text">Projects</span>
          </button>
        )}

        {/* Sign In CTA when in guest mode */}
        {!isAuthenticated && (
          <button
            type="button"
            className="btn btn-secondary btn-action btn-auth"
            onClick={() => onOpenAuth && onOpenAuth('login')}
            title="Sign in to save projects"
            aria-label="Sign In"
          >
            <LogIn size={14} />
            <span className="btn-text">Sign In</span>
          </button>
        )}

        {/* Version History action button */}
        {onOpenHistory && (
          <button
            type="button"
            className="btn btn-secondary btn-action"
            onClick={onOpenHistory}
            title="View per-file version history & restore previous versions"
            aria-label="Version History"
          >
            <History size={14} />
            <span className="btn-text">History</span>
          </button>
        )}

        <button
          type="button"
          className="btn btn-secondary btn-action"
          onClick={onOpenCollaborators || onShare}
          title={userRole === 'owner' ? "Invite collaborators & manage permissions" : "Share project & view collaborators"}
          aria-label="Share Project"
        >
          <Share2 size={15} />
          <span className="btn-text">{userRole === 'owner' ? 'Share & Invite' : 'Share'}</span>
        </button>

        <button
          type="button"
          className="btn btn-primary btn-action"
          onClick={onRun}
          title="Run Code"
          aria-label="Run Code"
        >
          <Play size={15} fill="currentColor" />
          <span className="btn-text">Run</span>
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
