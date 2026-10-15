import './NotificationsSection.css';
import { useState, useEffect } from 'react';
import { Bell, Check, Loader2, Volume2, MessageSquare, AtSign, MessageCircle, Mail } from 'lucide-react';
import { useSettings } from '../../context/useSettings';

export default function NotificationsSection({ onShowToast }) {
  const { settings, saveNotificationSettings } = useSettings();

  const [chatNotifications, setChatNotifications] = useState(true);
  const [mentionNotifications, setMentionNotifications] = useState(true);
  const [commentNotifications, setCommentNotifications] = useState(true);
  const [invitationNotifications, setInvitationNotifications] = useState(true);
  const [notificationSound, setNotificationSound] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (settings) {
      setChatNotifications(settings.chat_notifications !== false);
      setMentionNotifications(settings.mention_notifications !== false);
      setCommentNotifications(settings.comment_notifications !== false);
      setInvitationNotifications(settings.invitation_notifications !== false);
      setNotificationSound(settings.notification_sound !== false);
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await saveNotificationSettings({
        chatNotifications,
        mentionNotifications,
        commentNotifications,
        invitationNotifications,
        notificationSound
      });
      onShowToast?.('Notification preferences saved!', 'success');
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save notification settings.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    chatNotifications !== (settings?.chat_notifications !== false) ||
    mentionNotifications !== (settings?.mention_notifications !== false) ||
    commentNotifications !== (settings?.comment_notifications !== false) ||
    invitationNotifications !== (settings?.invitation_notifications !== false) ||
    notificationSound !== (settings?.notification_sound !== false);

  return (
    <form className="settings-section-form" onSubmit={handleSubmit}>
      <div className="settings-section-header">
        <h2 className="section-title">Notifications</h2>
        <p className="section-subtitle">
          Choose which collaborative activities trigger in-app alerts, badge counters, and audio cues.
        </p>
      </div>

      {/* In-App Alerts */}
      <div className="settings-card">
        <h3 className="card-heading">Activity Notifications</h3>

        <div className="settings-toggle-list" style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <div className="toggle-title-with-icon">
                <MessageSquare size={16} className="item-icon-accent" />
                <span className="toggle-title">Chat Message Notifications</span>
              </div>
              <span className="toggle-desc">
                Receive unread badge counters and alerts when team members send messages in project chat.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${chatNotifications ? 'is-on' : ''}`}
              onClick={() => setChatNotifications((prev) => !prev)}
              role="switch"
              aria-checked={chatNotifications}
              aria-label="Toggle chat message notifications"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <div className="toggle-title-with-icon">
                <AtSign size={16} className="item-icon-accent" />
                <span className="toggle-title">Mention (@) Notifications</span>
              </div>
              <span className="toggle-desc">
                Get high-priority alerts whenever a teammate mentions your username in chat messages or code comments.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${mentionNotifications ? 'is-on' : ''}`}
              onClick={() => setMentionNotifications((prev) => !prev)}
              role="switch"
              aria-checked={mentionNotifications}
              aria-label="Toggle mention notifications"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <div className="toggle-title-with-icon">
                <MessageCircle size={16} className="item-icon-accent" />
                <span className="toggle-title">Comment & Review Notifications</span>
              </div>
              <span className="toggle-desc">
                Notify you when team members post code comments, replies, or change review approvals on your projects.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${commentNotifications ? 'is-on' : ''}`}
              onClick={() => setCommentNotifications((prev) => !prev)}
              role="switch"
              aria-checked={commentNotifications}
              aria-label="Toggle comment notifications"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <div className="toggle-title-with-icon">
                <Mail size={16} className="item-icon-accent" />
                <span className="toggle-title">Project Invitations</span>
              </div>
              <span className="toggle-desc">
                Show top-level invitation banners and notification bell alerts when invited to join projects.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${invitationNotifications ? 'is-on' : ''}`}
              onClick={() => setInvitationNotifications((prev) => !prev)}
              role="switch"
              aria-checked={invitationNotifications}
              aria-label="Toggle project invitation notifications"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
      </div>

      {/* Sound Settings */}
      <div className="settings-card">
        <h3 className="card-heading">Audio Cues</h3>

        <div className="settings-toggle-list" style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <div className="toggle-title-with-icon">
                <Volume2 size={16} className="item-icon-accent" />
                <span className="toggle-title">Notification Sounds</span>
              </div>
              <span className="toggle-desc">
                Play an audible tone when receiving new chat messages or mentions while CodeCollab is in focus.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${notificationSound ? 'is-on' : ''}`}
              onClick={() => setNotificationSound((prev) => !prev)}
              role="switch"
              aria-checked={notificationSound}
              aria-label="Toggle notification sounds"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="settings-action-bar">
        <button
          type="submit"
          className="btn btn-primary btn-save"
          disabled={isSubmitting || !hasChanges}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={15} className="spin-icon" />
              <span>Saving Notifications...</span>
            </>
          ) : (
            <>
              <Check size={15} />
              <span>Save Notification Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
