import './CollaborationDrawer.css';
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  MessageSquare,
  MessageCircle,
  Share2,
  Copy,
  Check,
  Send,
  ArrowUp,
  UserPlus,
  Trash2,
  AlertCircle,
  Shield,
  ShieldCheck,
  Eye,
  User,
  Users,
  Clock,
  Sparkles,
  Link,
  MoreVertical,
  Edit2
} from 'lucide-react';
import CodeCommentWidget from '../CodeComments/CodeCommentWidget';
import { api } from '../../services/api';

/**
 * Format timestamp nicely (e.g. "3:30 PM" or "Oct 15, 3:30 PM")
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

export default function CollaborationDrawer({
  isOpen,
  onClose,
  initialTab = 'collaborators',
  projectId,
  roomId = 'demo-room',
  projectName = 'OS practical',
  participantCount = 1,
  currentUser = { id: 1, name: 'User', color: '#6366f1' },
  userRole = 'editor',
  activeUsers = [],
  // Chat props
  chatMessages = [],
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  unreadChatCount = 0,
  onClearUnreadChat,
  // Comments props
  comments = [],
  activeFile = '',
  openCommentsCount = 0,
  onReplyComment,
  onResolveComment,
  onDeleteComment,
  onJumpToLine,
  // Toast
  onShowToast
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'collaborators' | 'chat' | 'comments'
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Chat message editing & delete modal states
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInputText, setEditInputText] = useState('');
  const [deletingMessage, setDeletingMessage] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Comments filters
  const [commentFilter, setCommentFilter] = useState('all'); // 'all' | 'open' | 'resolved'
  const [fileFilterOnly, setFileFilterOnly] = useState(false);

  // Share & Invite states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [projectMembers, setProjectMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const activeMenuRef = useRef(null);

  const isViewer = userRole === 'viewer';
  const isOwner = userRole === 'owner';

  // Deduplicated chat messages list
  const uniqueMessages = useMemo(() => {
    const seen = new Set();
    const unique = [];
    (chatMessages || []).forEach((m) => {
      if (!m) return;
      const key = String(m.id || `${m.senderId}-${m.createdAt}`);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(m);
      }
    });
    return unique;
  }, [chatMessages]);

  // Sync initial tab when drawer opens or initialTab changes from props
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Clear unread chat count when drawer is open and chat tab is active
  useEffect(() => {
    if (isOpen && activeTab === 'chat' && unreadChatCount > 0) {
      if (onClearUnreadChat) onClearUnreadChat();
    }
  }, [isOpen, activeTab, unreadChatCount, onClearUnreadChat]);

  // Scroll chat to bottom when chat opens or new messages arrive
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [uniqueMessages, isOpen, activeTab]);

  // Load project members when Collaborators tab is selected
  useEffect(() => {
    if (
      isOpen &&
      (activeTab === 'collaborators' || activeTab === 'share') &&
      projectId &&
      projectId !== 'demo-room'
    ) {
      let cancelled = false;
      setIsLoadingMembers(true);
      api
        .getProjectMembers(projectId)
        .then((res) => {
          if (!cancelled && res?.members) {
            setProjectMembers(res.members);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setIsLoadingMembers(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, activeTab, projectId]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (activeMenuRef.current && !activeMenuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter mention suggestions
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const uniqueMap = new Map();

    activeUsers.forEach((u) => {
      if (u?.name && !uniqueMap.has(u.name.toLowerCase())) {
        uniqueMap.set(u.name.toLowerCase(), u);
      }
    });
    if (currentUser?.name && !uniqueMap.has(currentUser.name.toLowerCase())) {
      uniqueMap.set(currentUser.name.toLowerCase(), currentUser);
    }

    return Array.from(uniqueMap.values())
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [mentionQuery, activeUsers, currentUser]);

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

  const selectMention = (name) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      const newText = `${textBeforeCursor.slice(0, lastAtPos)}@${name} ${textAfterCursor}`;
      setInputText(newText);
      setMentionQuery(null);
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursor = lastAtPos + name.length + 2;
          textareaRef.current.selectionStart = newCursor;
          textareaRef.current.selectionEnd = newCursor;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

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
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending || isViewer) return;

    setIsSending(true);
    try {
      if (onSendMessage) {
        await onSendMessage(text);
      }
      setInputText('');
      setMentionQuery(null);
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Failed to send message', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveEdit = async (msgId) => {
    const text = editInputText.trim();
    if (!text) return;
    try {
      if (onEditMessage) {
        await onEditMessage(msgId, text);
      }
      setEditingMessageId(null);
      setEditInputText('');
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Failed to update message', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingMessage) return;
    try {
      if (onDeleteMessage) {
        await onDeleteMessage(deletingMessage.id);
      }
      setDeletingMessage(null);
    } catch (err) {
      if (onShowToast) onShowToast(err.message || 'Failed to delete message', 'error');
    }
  };

  // Copy shareable room link
  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/projects/${encodeURIComponent(roomId)}`;
    navigator.clipboard?.writeText(inviteUrl);
    setCopiedLink(true);
    if (onShowToast) onShowToast('Invite link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2200);
  };

  // Send invitation by email
  const handleSendInvite = async (e) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    setInviteError(null);
    setIsInviting(true);
    try {
      if (projectId && projectId !== 'demo-room') {
        await api.inviteCollaborator(projectId, {
          email: cleanEmail,
          role: inviteRole
        });
      }
      setInviteEmail('');
      if (onShowToast) {
        onShowToast(`Invitation sent to ${cleanEmail} as ${inviteRole}!`, 'success');
      }
    } catch (err) {
      setInviteError(err.message || 'Failed to send invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  // Filtered comments (guaranteed deduplication by id and content/location)
  const filteredComments = useMemo(() => {
    const seen = new Set();
    const unique = [];
    (comments || []).forEach((c) => {
      if (!c) return;
      const keyId = c.id ? String(c.id) : null;
      const compositeKey = `${c.filePath || ''}:${c.lineNumber || 0}:${(c.content || '').trim()}`;
      if ((keyId && seen.has(keyId)) || seen.has(compositeKey)) {
        return;
      }
      if (keyId) seen.add(keyId);
      seen.add(compositeKey);
      unique.push(c);
    });

    let res = unique;
    if (fileFilterOnly && activeFile) {
      res = res.filter((c) => c.filePath === activeFile);
    }
    if (commentFilter === 'open') {
      res = res.filter((c) => !c.isResolved);
    } else if (commentFilter === 'resolved') {
      res = res.filter((c) => c.isResolved);
    }
    return res;
  }, [comments, fileFilterOnly, activeFile, commentFilter]);

  // Format message text with @mentions
  const renderMessageContent = (text) => {
    if (text === null || text === undefined) return '';
    const raw = typeof text === 'string' ? text : String(text);
    if (!raw.trim()) return raw;
    const parts = raw.split(/(@[a-zA-Z0-9_\-.]+)/g);
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
      <div className="collab-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="collab-drawer" aria-label="Team Collaboration">
        <div className="collab-bottom-sheet-handle" aria-hidden="true" />

        {/* ===================================================================
            HEADER: Collaboration Title + Live Members Count + Close Button
            =================================================================== */}
        <div className="collab-drawer-header">
          <div className="collab-drawer-header-left">
            <h3 className="collab-drawer-title">Collaboration</h3>
            {/* Live member count & pulsing indicator */}
            <div className="collab-live-badge" title={`${participantCount} collaborator(s) online`}>
              <span className="live-dot-pulse" />
              <span className="live-count-text">{participantCount} live</span>
            </div>
          </div>
          <button
            type="button"
            className="collab-drawer-close-btn"
            onClick={onClose}
            title="Close Collaboration Panel"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ===================================================================
            SUB-TABS BAR: [ Collaborators ] [ Chat ] [ Comments ]
            =================================================================== */}
        <div className="collab-subtabs-bar">
          <button
            type="button"
            className={`collab-subtab-btn ${
              activeTab === 'collaborators' || activeTab === 'share' ? 'active' : ''
            }`}
            onClick={() => setActiveTab('collaborators')}
          >
            <Users size={13} />
            <span>Collaborators</span>
          </button>

          <button
            type="button"
            className={`collab-subtab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('chat');
              if (onClearUnreadChat) onClearUnreadChat();
            }}
          >
            <MessageSquare size={13} />
            <span>Chat</span>
            {unreadChatCount > 0 && (
              <span className="subtab-badge badge-chat">{unreadChatCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`collab-subtab-btn ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            <MessageCircle size={13} />
            <span>Comments</span>
            {openCommentsCount > 0 && (
              <span className="subtab-badge badge-comments">{openCommentsCount}</span>
            )}
          </button>
        </div>

        {/* ===================================================================
            TAB 1: CHAT
            =================================================================== */}
        {activeTab === 'chat' && (
          <div className="collab-tab-content chat-content">
            {/* Messages Feed */}
            <div className="chat-messages-container">
              {uniqueMessages.length === 0 ? (
                <div className="collab-empty-state">
                  <div className="empty-icon-wrap">
                    <MessageSquare size={28} />
                  </div>
                  <h4>No messages yet</h4>
                  <p>Send a message below to coordinate with online teammates in #{roomId}.</p>
                  <span className="empty-hint">Tip: Type @ to mention collaborators</span>
                </div>
              ) : (
                <div className="chat-messages-list">
                  {uniqueMessages.map((msg) => {
                    const messageText =
                      (typeof msg === 'string' ? msg : null) ??
                      (typeof msg?.message === 'string' ? msg.message : null) ??
                      (typeof msg?.content === 'string' ? msg.content : null) ??
                      (typeof msg?.text === 'string' ? msg.text : null) ??
                      (typeof msg?.body === 'string' ? msg.body : null) ??
                      (typeof msg?.message?.message === 'string' ? msg.message.message : null) ??
                      (msg?.message != null ? String(msg.message) : '');
                    const isYou =
                      currentUser?.id && msg.senderId
                        ? String(currentUser.id) === String(msg.senderId)
                        : Boolean(
                            currentUser?.name &&
                            msg.senderName &&
                            currentUser.name.trim().toLowerCase() === msg.senderName.trim().toLowerCase()
                          );

                    const initials = msg.senderName
                      ? msg.senderName.replace(/[^0-9a-zA-Z]/g, '').slice(-2).toUpperCase()
                      : 'U';

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
                        {/* Avatar */}
                        <div
                          className="chat-avatar"
                          style={{ backgroundColor: msg.senderColor || '#6366f1' }}
                          title={msg.senderName}
                        >
                          {initials}
                        </div>

                        {/* Content */}
                        <div className="chat-message-bubble-wrapper">
                          <div className="chat-message-meta">
                            <span className="chat-sender-name">
                              {msg.senderName}
                              {isYou && <span className="you-pill">You</span>}
                            </span>
                            <span className="chat-time" title={msg.createdAt}>
                              {formatMessageTime(msg.createdAt)}
                            </span>
                            {msg.isEdited && !msg.isDeleted && (
                              <span className="chat-edited-badge" title="Edited message">
                                (edited)
                              </span>
                            )}

                            {!msg.isDeleted && (canEdit || canDelete) && (
                              <div className="chat-msg-actions-wrapper" ref={openMenuId === msg.id ? activeMenuRef : null}>
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
                                        onClick={() => {
                                          setEditingMessageId(msg.id);
                                          setEditInputText(messageText);
                                          setOpenMenuId(null);
                                        }}
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

                          {isEditingThis ? (
                            <div className="chat-inline-edit-form">
                              <textarea
                                value={editInputText}
                                onChange={(e) => setEditInputText(e.target.value)}
                                className="chat-edit-textarea"
                                rows={2}
                                autoFocus
                              />
                              <div className="chat-edit-actions">
                                <button
                                  type="button"
                                  className="btn-chat-mini cancel"
                                  onClick={() => setEditingMessageId(null)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn-chat-mini save"
                                  onClick={() => handleSaveEdit(msg.id)}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="chat-message-bubble">
                              <p className="chat-message-text">
                                {msg.isDeleted ? (
                                  <em className="deleted-hint">This message was deleted.</em>
                                ) : (
                                  renderMessageContent(messageText)
                                )}
                              </p>
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

            {/* Mention Suggestions Popover */}
            {mentionQuery !== null && mentionSuggestions.length > 0 && (
              <div className="chat-mentions-popup" role="listbox">
                {mentionSuggestions.map((user, idx) => (
                  <div
                    key={user.id || user.name}
                    className={`chat-mention-item ${idx === mentionIndex ? 'highlighted' : ''}`}
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
                    <span className="mention-name">{user.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Input Footer */}
            <div className="collab-chat-footer">
              {isViewer ? (
                <div className="chat-viewer-notice">
                  <AlertCircle size={14} className="text-warning" />
                  <span>Viewer mode: chat is read-only.</span>
                </div>
              ) : (
                <div className="chat-input-wrapper">
                  <textarea
                    ref={textareaRef}
                    className="chat-textarea"
                    placeholder={projectName ? `Message ${projectName}...` : 'Type a message... (@ to mention)'}
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    disabled={isSending}
                    aria-label="Message input"
                  />
                  <button
                    type="button"
                    className="btn-chat-send-round"
                    onClick={handleSend}
                    disabled={!inputText.trim() || isSending}
                    title="Send message (Enter)"
                    aria-label="Send message"
                  >
                    <ArrowUp size={15} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: COMMENTS
            =================================================================== */}
        {activeTab === 'comments' && (
          <div className="collab-tab-content comments-content">
            {/* Filter row */}
            <div className="comments-filter-row">
              <div className="filter-pill-group">
                <button
                  type="button"
                  className={`filter-pill ${commentFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setCommentFilter('all')}
                >
                  All ({comments.length})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${commentFilter === 'open' ? 'active' : ''}`}
                  onClick={() => setCommentFilter('open')}
                >
                  Open ({openCommentsCount})
                </button>
                <button
                  type="button"
                  className={`filter-pill ${commentFilter === 'resolved' ? 'active' : ''}`}
                  onClick={() => setCommentFilter('resolved')}
                >
                  Resolved
                </button>
              </div>

              {activeFile && (
                <button
                  type="button"
                  className={`filter-pill current-file ${fileFilterOnly ? 'active' : ''}`}
                  onClick={() => setFileFilterOnly((prev) => !prev)}
                  title="Show only comments in the current active file"
                >
                  Current File
                </button>
              )}
            </div>

            {/* Comments List */}
            <div className="comments-feed-container">
              {filteredComments.length === 0 ? (
                <div className="collab-empty-state">
                  <div className="empty-icon-wrap">
                    <MessageCircle size={28} />
                  </div>
                  <h4>No code comments found</h4>
                  <p>
                    {fileFilterOnly
                      ? `No comments in "${activeFile}". Click any line number in the editor to start a discussion.`
                      : 'Click any line number in the code editor to start a code review discussion.'}
                  </p>
                </div>
              ) : (
                <div className="comments-card-list">
                  {filteredComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="comment-item-card"
                      onClick={() => onJumpToLine && onJumpToLine(comment.filePath, comment.lineNumber, comment.endLineNumber)}
                    >
                      <CodeCommentWidget
                        comment={comment}
                        currentUser={currentUser}
                        userRole={userRole}
                        onReply={onReplyComment}
                        onResolve={onResolveComment}
                        onDelete={onDeleteComment}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB: COLLABORATORS & SHARE
            =================================================================== */}
        {(activeTab === 'collaborators' || activeTab === 'share') && (
          <div className="collab-tab-content share-content">
            {/* Section 1: Live Members & Collaborators List */}
            <div className="share-section">
              <div className="share-section-header">
                <span className="share-section-title">Active Collaborators ({activeUsers.length || 1})</span>
              </div>

              <div className="live-members-list">
                {/* Current User */}
                <div className="live-member-item is-self">
                  <div
                    className="live-member-avatar"
                    style={{ backgroundColor: currentUser.color || '#6366f1' }}
                  >
                    {currentUser.initials || currentUser.name.slice(0, 1).toUpperCase()}
                    <span className="status-dot-green" />
                  </div>
                  <div className="live-member-info">
                    <span className="live-member-name">
                      {currentUser.name} <span className="self-tag">(You)</span>
                    </span>
                    <span className="live-member-role">{userRole}</span>
                  </div>
                  <span className="live-tag">Online</span>
                </div>

                {/* Peer Users */}
                {activeUsers
                  .filter((u) => u.id !== currentUser.id)
                  .map((peer) => {
                    const initials = peer.name ? peer.name.slice(0, 1).toUpperCase() : 'G';
                    return (
                      <div key={peer.id || peer.socketId} className="live-member-item">
                        <div
                          className="live-member-avatar"
                          style={{ backgroundColor: peer.color || '#6366f1' }}
                        >
                          {initials}
                          <span className="status-dot-green" />
                        </div>
                        <div className="live-member-info">
                          <span className="live-member-name">{peer.name || 'Collaborator'}</span>
                          <span className="live-member-role">{peer.role || 'Editor'}</span>
                        </div>
                        <span className="live-tag">Online</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Section 2: Copy Link */}
            <div className="share-section">
              <span className="share-section-title">Invite Link</span>
              <div className="share-link-box">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/projects/${encodeURIComponent(roomId)}`}
                  className="share-link-input"
                />
                <button
                  type="button"
                  className={`btn-copy-link ${copiedLink ? 'copied' : ''}`}
                  onClick={handleCopyLink}
                  title="Copy room link"
                >
                  {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Section 3: Invite by Email (for owner/editors) */}
            {userRole !== 'viewer' && (
              <div className="share-section">
                <span className="share-section-title">Invite Collaborator</span>
                <form onSubmit={handleSendInvite} className="share-invite-form">
                  <div className="invite-input-row">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@example.com"
                      className="share-email-input"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="share-role-select"
                      aria-label="Select role"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  {inviteError && <span className="invite-error-text">{inviteError}</span>}
                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim()}
                    className="btn-send-invite"
                  >
                    <UserPlus size={14} />
                    <span>{isInviting ? 'Sending...' : 'Send Invite'}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

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
                <em>"This message was deleted."</em>
              </p>
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="btn-chat-mini cancel"
                  onClick={() => setDeletingMessage(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-chat-mini delete"
                  onClick={handleConfirmDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </aside>
    </>
  );
}
