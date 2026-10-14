import './ChatPanel.css';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Edit2,
  Trash2,
  AlertCircle,
  Clock,
  Check,
  Smile,
  Shield,
  User,
  MoreVertical,
  HelpCircle,
  AtSign
} from 'lucide-react';

/**
 * Format timestamp nicely (e.g. "10:45 AM" or "Oct 14, 10:45 AM")
 */
function formatMessageTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({
  isOpen,
  onClose,
  projectId,
  roomId = 'demo-room',
  currentUser = { id: 1, name: 'User', color: '#6366f1' },
  userRole = 'editor',
  activeUsers = [],
  messages = [],
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  socket = null
}) {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Editing state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInputText, setEditInputText] = useState('');

  // Delete confirmation modal state
  const [deletingMessage, setDeletingMessage] = useState(null);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null); // null if not active, string if typing @...
  const [mentionIndex, setMentionIndex] = useState(0);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const activeMenuRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const isViewer = userRole === 'viewer';
  const isOwner = userRole === 'owner';

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Close message action menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (activeMenuRef.current && !activeMenuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter mention suggestions from online collaborators & project members
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const uniqueMap = new Map();

    // Include active peer users
    activeUsers.forEach((u) => {
      if (u && u.name && !uniqueMap.has(u.name.toLowerCase())) {
        uniqueMap.set(u.name.toLowerCase(), u);
      }
    });

    // Also include current user as reference
    if (currentUser && currentUser.name && !uniqueMap.has(currentUser.name.toLowerCase())) {
      uniqueMap.set(currentUser.name.toLowerCase(), currentUser);
    }

    const allCollaborators = Array.from(uniqueMap.values());
    return allCollaborators
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [mentionQuery, activeUsers, currentUser]);

  // Handle textarea typing & detect @mentions
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const charBeforeAt = lastAtPos === 0 ? ' ' : textBeforeCursor[lastAtPos - 1];
      if (charBeforeAt === ' ' || charBeforeAt === '\n') {
        const query = textBeforeCursor.slice(lastAtPos + 1);
        if (!query.includes(' ')) {
          setMentionQuery(query);
          setMentionIndex(0);
          return;
        }
      }
    }
    setMentionQuery(null);
  };

  // Insert mention into message textarea
  const selectMention = (name) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const newBefore = textBeforeCursor.slice(0, lastAtPos) + `@${name} `;
      setInputText(newBefore + textAfterCursor);
      setMentionQuery(null);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newBefore.length, newBefore.length);
        }
      }, 10);
    }
  };

  // Send message
  const handleSend = async () => {
    if (isViewer) return;
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      if (onSendMessage) {
        await onSendMessage(trimmed);
      }
      setInputText('');
      setMentionQuery(null);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Keyboard navigation for multiline textarea & mention autocomplete
  const handleKeyDown = (e) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMention(mentionSuggestions[mentionIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Start editing a message
  const handleStartEdit = (msg) => {
    setOpenMenuId(null);
    setEditingMessageId(msg.id);
    setEditInputText(msg.message);
  };

  // Save edited message
  const handleSaveEdit = async (msgId) => {
    if (!editInputText.trim()) return;
    try {
      if (onEditMessage) {
        await onEditMessage(msgId, editInputText.trim());
      }
      setEditingMessageId(null);
      setEditInputText('');
    } catch (err) {
      alert(err.message || 'Failed to edit message');
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deletingMessage) return;
    try {
      if (onDeleteMessage) {
        await onDeleteMessage(deletingMessage.id);
      }
      setDeletingMessage(null);
    } catch (err) {
      alert(err.message || 'Failed to delete message');
    }
  };

  // Render message text with highlighted @mentions
  const renderMessageContent = (text, isDeleted) => {
    if (isDeleted) {
      return <span className="deleted-message-text">This message was deleted.</span>;
    }

    const parts = text.split(/(@[a-zA-Z0-9_\-.]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="chat-mention-pill">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="chat-panel-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="chat-panel" aria-label="Project Team Chat">
        {/* Panel Header */}
        <div className="chat-panel-header">
          <div className="chat-header-title">
            <MessageSquare size={16} className="text-accent" />
            <span>Project Chat</span>
            <span className="chat-room-badge" title={`Room: ${roomId}`}>
              #{roomId}
            </span>
          </div>
          <button
            type="button"
            className="action-icon-btn"
            onClick={onClose}
            title="Close Chat"
            aria-label="Close Chat"
          >
            <X size={15} />
          </button>
        </div>

        {/* Messages List Area */}
        <div className="chat-messages-container">
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <div className="chat-empty-icon-wrap">
                <MessageSquare size={32} />
              </div>
              <h4>No messages yet</h4>
              <p>Start collaborating with your team.</p>
              <span className="chat-empty-hint">Use @name to mention collaborators</span>
            </div>
          ) : (
            <div className="chat-messages-list">
              {messages.map((msg) => {
                const isYou =
                  currentUser?.id && msg.senderId
                    ? String(currentUser.id) === String(msg.senderId)
                    : currentUser?.name === msg.senderName;

                const initials = msg.senderName
                  ? msg.senderName.replace(/[^0-9a-zA-Z]/g, '').slice(-2).toUpperCase()
                  : 'U';

                // Safe 15-minute edit period check
                const createdTime = new Date(msg.createdAt).getTime();
                const minutesElapsed = (Date.now() - createdTime) / (1000 * 60);
                const canEdit = !msg.isDeleted && isYou && minutesElapsed <= 15;
                const canDelete = !msg.isDeleted && (isYou || isOwner);

                const isEditingThis = editingMessageId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`chat-message-row ${isYou ? 'is-own-message' : ''} ${
                      msg.isDeleted ? 'is-deleted' : ''
                    }`}
                  >
                    {/* Sender Avatar */}
                    <div
                      className="chat-avatar"
                      style={{ backgroundColor: msg.senderColor || '#6366f1' }}
                      title={msg.senderName}
                    >
                      <span>{initials}</span>
                    </div>

                    <div className="chat-message-body">
                      {/* Sender Meta (Name, Time, Badges) */}
                      <div className="chat-message-meta">
                        <span className="chat-sender-name">
                          {msg.senderName}
                          {isYou && <span className="you-pill">You</span>}
                        </span>
                        <span className="chat-message-time" title={msg.createdAt}>
                          {formatMessageTime(msg.createdAt)}
                        </span>
                        {msg.isEdited && !msg.isDeleted && (
                          <span className="chat-edited-badge" title="Edited message">
                            (edited)
                          </span>
                        )}

                        {/* Actions Trigger (Edit / Delete) */}
                        {!msg.isDeleted && (canEdit || canDelete) && (
                          <div className="chat-msg-actions-wrapper" ref={activeMenuRef}>
                            <button
                              type="button"
                              className="chat-msg-menu-btn"
                              onClick={() => setOpenMenuId(openMenuId === msg.id ? null : msg.id)}
                              title="Message options"
                              aria-label="Message options"
                            >
                              <MoreVertical size={13} />
                            </button>

                            {openMenuId === msg.id && (
                              <div className="chat-actions-dropdown" role="menu">
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="chat-dropdown-action"
                                    onClick={() => handleStartEdit(msg)}
                                    role="menuitem"
                                  >
                                    <Edit2 size={12} />
                                    <span>Edit (within 15m)</span>
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    className="chat-dropdown-action text-danger"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      setDeletingMessage(msg);
                                    }}
                                    role="menuitem"
                                  >
                                    <Trash2 size={12} />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Message Content or Inline Edit Form */}
                      {isEditingThis ? (
                        <div className="chat-inline-edit-form">
                          <textarea
                            className="chat-edit-textarea"
                            value={editInputText}
                            onChange={(e) => setEditInputText(e.target.value)}
                            rows={2}
                            autoFocus
                          />
                          <div className="chat-edit-buttons">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setEditingMessageId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSaveEdit(msg.id)}
                              disabled={!editInputText.trim()}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="chat-message-text">
                          {renderMessageContent(msg.message, msg.isDeleted)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Mention Autocomplete Floating Popover */}
        {mentionQuery !== null && mentionSuggestions.length > 0 && (
          <div className="mention-autocomplete-popover" role="listbox">
            <div className="mention-popover-header">
              <AtSign size={12} />
              <span>Mention collaborator:</span>
            </div>
            {mentionSuggestions.map((user, idx) => (
              <div
                key={user.id || user.name}
                className={`mention-popover-item ${idx === mentionIndex ? 'selected' : ''}`}
                onClick={() => selectMention(user.name)}
                role="option"
                aria-selected={idx === mentionIndex}
              >
                <div
                  className="mention-item-avatar"
                  style={{ backgroundColor: user.color || '#6366f1' }}
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="mention-item-info">
                  <span className="mention-name">{user.name}</span>
                  {user.email && <span className="mention-email">{user.email}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat Input Footer */}
        <div className="chat-panel-footer">
          {isViewer ? (
            <div
              className="chat-viewer-notice"
              title="Viewer permission: chat messages are disabled."
            >
              <AlertCircle size={14} className="text-warning" />
              <span>Viewer permission: chat messages are disabled.</span>
            </div>
          ) : (
            <div className="chat-input-wrapper">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                placeholder="Type a message... (@ to mention, Shift+Enter for new line)"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={2}
                disabled={isSending}
                aria-label="Type a message"
              />
              <button
                type="button"
                className="btn-chat-send"
                onClick={handleSend}
                disabled={!inputText.trim() || isSending}
                title={!inputText.trim() ? 'Enter text to send' : 'Send message (Enter)'}
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Deletion Confirmation Modal */}
        {deletingMessage && (
          <div className="chat-modal-backdrop" role="dialog" aria-modal="true">
            <div className="chat-confirm-modal">
              <div className="confirm-modal-header">
                <Trash2 size={18} className="text-danger" />
                <h3>Delete Message?</h3>
              </div>
              <p>
                Are you sure you want to delete this message? The message text will be replaced with
                <em>"This message was deleted."</em> and logged in the project activity timeline.
              </p>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeletingMessage(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmDelete}
                >
                  Delete Message
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
