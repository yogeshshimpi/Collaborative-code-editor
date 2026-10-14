import './CodeCommentWidget.css';
import { useState } from 'react';
import { FileCode, X, MessageSquare, Filter } from 'lucide-react';
import CodeCommentWidget from './CodeCommentWidget';

export default function CodeCommentsDrawer({
  isOpen,
  onClose,
  comments = [],
  activeFile,
  currentUser,
  userRole,
  onReply,
  onResolve,
  onDelete,
  onJumpToLine
}) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'open' | 'resolved'
  const [fileFilterOnly, setFileFilterOnly] = useState(false);

  if (!isOpen) return null;

  let filtered = comments;
  if (fileFilterOnly && activeFile) {
    filtered = filtered.filter((c) => c.filePath === activeFile);
  }
  if (filterMode === 'open') {
    filtered = filtered.filter((c) => !c.isResolved);
  } else if (filterMode === 'resolved') {
    filtered = filtered.filter((c) => c.isResolved);
  }

  return (
    <>
      <div className="chat-panel-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="chat-panel" aria-label="Code Comments">
        <div className="chat-panel-header">
          <div className="chat-header-title">
            <MessageSquare size={16} className="text-info" />
            <span>Code Comments ({comments.length})</span>
          </div>
          <button
            type="button"
            className="action-icon-btn"
            onClick={onClose}
            title="Close Comments"
            aria-label="Close Comments"
          >
            <X size={15} />
          </button>
        </div>

        {/* Filter controls */}
        <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`btn btn-secondary btn-sm ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
              style={{ fontSize: '10.5px', padding: '2px 7px' }}
            >
              All
            </button>
            <button
              type="button"
              className={`btn btn-secondary btn-sm ${filterMode === 'open' ? 'active' : ''}`}
              onClick={() => setFilterMode('open')}
              style={{ fontSize: '10.5px', padding: '2px 7px' }}
            >
              Open
            </button>
            <button
              type="button"
              className={`btn btn-secondary btn-sm ${filterMode === 'resolved' ? 'active' : ''}`}
              onClick={() => setFilterMode('resolved')}
              style={{ fontSize: '10.5px', padding: '2px 7px' }}
            >
              Resolved
            </button>
          </div>

          {activeFile && (
            <button
              type="button"
              className={`btn btn-secondary btn-sm ${fileFilterOnly ? 'active' : ''}`}
              onClick={() => setFileFilterOnly((prev) => !prev)}
              style={{ fontSize: '10.5px', padding: '2px 7px' }}
              title="Show only comments in the current active file"
            >
              Current File
            </button>
          )}
        </div>

        {/* Comments Feed */}
        <div className="chat-messages-container" style={{ padding: '12px' }}>
          {filtered.length === 0 ? (
            <div className="chat-empty-state">
              <MessageSquare size={28} className="text-muted" />
              <h4>No comments found</h4>
              <p>Click on any line number in the code editor to start a discussion thread.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map((comment) => (
                <div
                  key={comment.id}
                  onClick={() => onJumpToLine && onJumpToLine(comment.filePath, comment.lineNumber)}
                  style={{ cursor: 'pointer' }}
                >
                  <CodeCommentWidget
                    comment={comment}
                    currentUser={currentUser}
                    userRole={userRole}
                    onReply={onReply}
                    onResolve={onResolve}
                    onDelete={onDelete}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
