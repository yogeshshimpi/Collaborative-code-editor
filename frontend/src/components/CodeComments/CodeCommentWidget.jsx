import './CodeCommentWidget.css';
import { useState, useRef } from 'react';
import {
  MessageSquare,
  CornerDownRight,
  Check,
  RotateCcw,
  Trash2,
  X,
  Send,
  AtSign,
  FileCode,
  Shield,
  User,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function CodeCommentWidget({
  comment,
  currentUser = { id: 1, name: 'User', color: '#6366f1' },
  userRole = 'editor',
  onReply,
  onResolve,
  onDelete,
  onClose,
  isInline = false
}) {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isViewer = userRole === 'viewer';
  const isOwner = userRole === 'owner';

  const isAuthor =
    currentUser?.id && comment?.authorId
      ? String(currentUser.id) === String(comment.authorId)
      : currentUser?.name === comment?.authorName;

  const canDelete = isAuthor || isOwner;

  const handleSendReply = async () => {
    if (isViewer || !replyText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (onReply) {
        await onReply(comment.id, replyText.trim());
      }
      setReplyText('');
      setIsReplying(false);
    } catch (err) {
      alert(err.message || 'Failed to reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleResolve = () => {
    if (isViewer) return;
    if (onResolve) {
      onResolve(comment.id, !comment.isResolved);
    }
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (window.confirm('Delete this comment thread?')) {
      if (onDelete) {
        onDelete(comment.id);
      }
    }
  };

  return (
    <div className={`code-comment-thread-card ${comment.isResolved ? 'is-resolved' : 'is-open'} ${isInline ? 'inline-mode' : ''}`}>
      {/* Thread Header */}
      <div className="thread-header">
        <div className="thread-location-badge">
          <FileCode size={12} />
          <span>
            {comment.filePath}:{comment.lineNumber}
          </span>
        </div>

        <div className="thread-status-actions">
          <button
            type="button"
            className={`btn-resolve-thread ${comment.isResolved ? 'resolved' : ''}`}
            onClick={handleToggleResolve}
            disabled={isViewer}
            title={comment.isResolved ? 'Re-open discussion thread' : 'Mark as resolved'}
          >
            {comment.isResolved ? <RotateCcw size={12} /> : <Check size={12} />}
            <span>{comment.isResolved ? 'Resolved' : 'Resolve'}</span>
          </button>

          {canDelete && (
            <button
              type="button"
              className="btn-thread-delete"
              onClick={handleDelete}
              title="Delete thread"
            >
              <Trash2 size={12} />
            </button>
          )}

          {onClose && (
            <button type="button" className="btn-thread-close" onClick={onClose} title="Close">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Code Snippet Snapshot Preview */}
      {comment.lineContent && (
        <div className="thread-code-snippet">
          <code>{comment.lineContent}</code>
        </div>
      )}

      {/* Root Comment Item */}
      <div className="thread-root-comment">
        <div
          className="comment-avatar"
          style={{ backgroundColor: comment.authorColor || '#6366f1' }}
        >
          {comment.authorName ? comment.authorName.slice(0, 1).toUpperCase() : 'U'}
        </div>
        <div className="comment-main">
          <div className="comment-meta">
            <span className="comment-author">{comment.authorName}</span>
            <span className="comment-time">
              {new Date(comment.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          <div className="comment-content-text">{comment.content}</div>
        </div>
      </div>

      {/* Replies List */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="thread-replies-list">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="thread-reply-item">
              <CornerDownRight size={13} className="reply-arrow" />
              <div
                className="comment-avatar reply-avatar"
                style={{ backgroundColor: reply.authorColor || '#6366f1' }}
              >
                {reply.authorName ? reply.authorName.slice(0, 1).toUpperCase() : 'U'}
              </div>
              <div className="comment-main">
                <div className="comment-meta">
                  <span className="comment-author">{reply.authorName}</span>
                  <span className="comment-time">
                    {new Date(reply.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="comment-content-text">{reply.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Input Form */}
      {!comment.isResolved && !isViewer && (
        <div className="thread-reply-form">
          <input
            type="text"
            className="reply-input"
            placeholder="Reply to thread... (Enter to send)"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
            disabled={isSubmitting}
          />
          <button
            type="button"
            className="btn-send-reply"
            onClick={handleSendReply}
            disabled={!replyText.trim() || isSubmitting}
            title="Send reply"
          >
            <Send size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
