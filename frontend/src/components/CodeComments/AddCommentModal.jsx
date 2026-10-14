import './CodeCommentWidget.css';
import { useState, useRef, useEffect, useMemo } from 'react';
import { FileCode, MessageSquare, Send, X, AtSign, Eye } from 'lucide-react';

export default function AddCommentModal({
  isOpen,
  onClose,
  filePath,
  lineNumber,
  codeSnippet = '',
  activeUsers = [],
  onSubmit,
  isViewer = false
}) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setContent('');
      setIsSubmitting(false);
      setMentionQuery(null);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen, filePath, lineNumber]);

  // Mention autocomplete suggestions
  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const map = new Map();
    activeUsers.forEach((u) => {
      if (u && u.name && !map.has(u.name.toLowerCase())) {
        map.set(u.name.toLowerCase(), u);
      }
    });
    return Array.from(map.values()).filter((u) =>
      u.name.toLowerCase().includes(q)
    );
  }, [mentionQuery, activeUsers]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setContent(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      if (!query.includes(' ') && query.length <= 25) {
        setMentionQuery(query);
        return;
      }
    }
    setMentionQuery(null);
  };

  const handleSelectMention = (user) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const lastAtIndex = textBefore.lastIndexOf('@');
    if (lastAtIndex === -1) return;

    const textAfter = content.slice(cursorPos);
    const newContent = `${textBefore.slice(0, lastAtIndex)}@${user.name} ${textAfter}`;
    setContent(newContent);
    setMentionQuery(null);

    setTimeout(() => {
      textareaRef.current?.focus();
      const newPos = lastAtIndex + user.name.length + 2;
      textareaRef.current?.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (isViewer || !content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        filePath,
        lineNumber,
        content: content.trim(),
        selectedText: codeSnippet
      });
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="add-comment-modal-backdrop" onClick={onClose}>
      <div
        className="add-comment-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-comment-title"
      >
        <div className="add-comment-header">
          <div className="add-comment-title-wrap">
            <MessageSquare size={16} className="text-info" />
            <h3 id="add-comment-title">Add Code Comment</h3>
            <span className="location-pill">
              <FileCode size={12} />
              {filePath}:{lineNumber}
            </span>
          </div>
          <button
            type="button"
            className="action-icon-btn"
            onClick={onClose}
            aria-label="Close comment dialog"
          >
            <X size={15} />
          </button>
        </div>

        {codeSnippet && (
          <div className="add-comment-snippet">
            <div className="snippet-line-num">{lineNumber}</div>
            <pre className="snippet-code">{codeSnippet}</pre>
          </div>
        )}

        {isViewer ? (
          <div className="add-comment-viewer-alert">
            <Eye size={14} />
            <span>Viewer permission: comments are read-only.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="add-comment-form">
            <div className="add-comment-input-wrap">
              <textarea
                ref={textareaRef}
                className="add-comment-textarea"
                placeholder="Write a comment or question... Type @ to mention a collaborator (Ctrl+Enter to post)"
                value={content}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                rows={4}
                required
              />

              {/* Mention Autocomplete List */}
              {mentionSuggestions.length > 0 && (
                <div className="mention-autocomplete-menu">
                  <div className="mention-menu-header">Collaborators</div>
                  {mentionSuggestions.map((u) => (
                    <button
                      key={u.id || u.socketId || u.name}
                      type="button"
                      className="mention-menu-item"
                      onClick={() => handleSelectMention(u)}
                    >
                      <span
                        className="mention-avatar-dot"
                        style={{ backgroundColor: u.color || '#6366f1' }}
                      />
                      <span className="mention-item-name">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="add-comment-footer">
              <span className="keyboard-hint">Ctrl + Enter to send</span>
              <div className="add-comment-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={!content.trim() || isSubmitting}
                >
                  <Send size={13} />
                  <span>{isSubmitting ? 'Posting...' : 'Post Comment'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
