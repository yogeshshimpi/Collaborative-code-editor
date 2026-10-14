import './NotificationBell.css';
import { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  MessageSquare,
  FileCode,
  AtSign,
  ShieldAlert,
  Clock,
  Check,
  ExternalLink
} from 'lucide-react';

/**
 * Format relative time (e.g., "Just now", "5m ago", "2h ago")
 */
function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function NotificationBell({
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  onNavigateNotification
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleItemClick = (notif) => {
    if (!notif.isRead && onMarkRead) {
      onMarkRead(notif.id);
    }
    setIsOpen(false);
    if (onNavigateNotification) {
      onNavigateNotification(notif);
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'chat_mention':
        return <AtSign size={14} className="text-accent" />;
      case 'comment_mention':
      case 'code_comment':
        return <FileCode size={14} className="text-info" />;
      default:
        return <Bell size={14} className="text-amber" />;
    }
  };

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button
        type="button"
        className={`notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'Notifications'}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="notif-badge-pill" aria-label={`${unreadCount} unread`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-popover" role="dialog" aria-label="Notifications list">
          <div className="notif-popover-header">
            <div className="notif-header-title">
              <Bell size={14} />
              <span>Notifications</span>
              {unreadCount > 0 && <span className="notif-unread-tag">{unreadCount} new</span>}
            </div>
            {unreadCount > 0 && onMarkAllRead && (
              <button
                type="button"
                className="btn-mark-all-read"
                onClick={onMarkAllRead}
                title="Mark all notifications as read"
              >
                <CheckCheck size={13} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="notif-items-list">
            {notifications.length === 0 ? (
              <div className="notif-empty-state">
                <Bell size={24} className="text-muted" />
                <p>No notifications yet</p>
                <span>Mentions and code comments will appear here.</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notif-item ${!notif.isRead ? 'unread' : 'read'}`}
                  onClick={() => handleItemClick(notif)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="notif-icon-wrap">{getNotifIcon(notif.type)}</div>
                  <div className="notif-content">
                    <div className="notif-title-row">
                      <span className="notif-title">{notif.title}</span>
                      <span className="notif-time">{formatRelativeTime(notif.createdAt)}</span>
                    </div>
                    {notif.body && <p className="notif-body-text">{notif.body}</p>}
                    {notif.metadata?.filePath && (
                      <div className="notif-meta-link">
                        <FileCode size={11} />
                        <span>
                          {notif.metadata.filePath}:{notif.metadata.lineNumber || 1}
                        </span>
                      </div>
                    )}
                  </div>
                  {!notif.isRead && <span className="notif-unread-dot" title="Unread" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
