import { useState } from 'react';
import { Code2, Play, Share2, Users, Hash, Edit2, Check, PanelLeft } from 'lucide-react';

export default function Navbar({
  projectName = 'Untitled Project',
  roomId = 'demo-room',
  onChangeRoom,
  connectionStatus = 'connecting',
  participantCount = 1,
  currentUser = { name: 'Guest', color: '#6366f1', initials: 'G' },
  activeUsers = [],
  onRun,
  onShare,
  isRightPanelOpen,
  toggleRightPanel,
  onToggleSidebar
}) {
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [roomInput, setRoomInput] = useState(roomId);

  const handleRoomSubmit = (e) => {
    e.preventDefault();
    if (roomInput.trim() && onChangeRoom) {
      onChangeRoom(roomInput.trim());
    }
    setIsEditingRoom(false);
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
          <span className="project-title">{projectName}</span>
        </div>
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

        <button
          type="button"
          className="btn btn-secondary btn-action"
          onClick={onShare}
          title="Share Project Room"
          aria-label="Share Project Room"
        >
          <Share2 size={15} />
          <span className="btn-text">Share</span>
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

        {/* Current User Avatar with custom presence color */}
        <div
          className="user-avatar"
          style={{ backgroundColor: currentUser.color }}
          title={`You: ${currentUser.name}`}
          aria-label={`You: ${currentUser.name}`}
        >
          <span>{currentUser.initials || currentUser.name.slice(0, 2).toUpperCase()}</span>
        </div>
      </div>
    </header>
  );
}
