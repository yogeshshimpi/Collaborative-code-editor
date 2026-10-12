import { Users, Shield, Copy, Check, X, User } from 'lucide-react';
import { useState } from 'react';

export default function CollaboratorsPanel({
  isOpen,
  onClose,
  roomId = 'demo-room',
  currentUser = { id: 'local', name: 'Guest', color: '#6366f1' },
  activeUsers = [],
  currentActiveFile = 'main.js'
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If activeUsers from server is empty, fallback to currentUser
  const userList = activeUsers.length > 0 ? activeUsers : [currentUser];

  return (
    <>
      <div
        className="collaborators-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="collaborators-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Users size={15} />
          <span>Live Collaborators ({userList.length})</span>
        </div>
        <button
          type="button"
          className="action-icon-btn"
          onClick={onClose}
          title="Close Collaborators Panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="collaborator-list">
        {userList.map((user) => {
          const isYou = user.id === currentUser.id;
          const initials = user.name ? user.name.replace(/[^0-9a-zA-Z]/g, '').slice(-2) : 'G';
          const activeFileName = isYou ? currentActiveFile : user.activeFile;

          return (
            <div key={user.socketId || user.id} className="collaborator-card">
              <div
                className="collaborator-avatar"
                style={{ backgroundColor: user.color || '#6366f1' }}
              >
                <span>{initials}</span>
                <span className="presence-dot online" />
              </div>
              <div className="collaborator-info">
                <div className="collaborator-name">
                  <span>{user.name}</span>
                  {isYou && <span className="you-badge">(You)</span>}
                  {isYou ? (
                    <Shield size={12} className="role-icon" title="You" />
                  ) : (
                    <User size={12} className="role-icon" title="Collaborator" />
                  )}
                </div>
                <div className="collaborator-meta">
                  {activeFileName ? (
                    <>
                      {user.role === 'viewer' ? 'Viewing' : 'Editing'}:{' '}
                      <span className="meta-file">{activeFileName}</span>
                    </>
                  ) : (
                    <>
                      Status: <span className="meta-file">Active in Room</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel-footer">
        <div className="room-info">
          <span className="room-label">Active Room:</span>
          <code className="room-code">{roomId}</code>
        </div>
        <button
          type="button"
          className="btn-copy-room"
          onClick={handleCopyLink}
          title="Copy Room Link"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Link Copied!' : 'Copy Room Invite URL'}</span>
        </button>
      </div>
    </aside>
    </>
  );
}
