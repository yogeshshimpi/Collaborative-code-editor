import './TabBar.css';
import { useRef, useEffect } from 'react';
import {
  X,
  FileCode,
  FileText,
  Palette,
  Terminal,
  Undo2,
  Redo2,
  Play,
  GitPullRequest
} from 'lucide-react';

export default function TabBar({
  openTabs = [],
  activeTab,
  onSelectTab,
  onCloseTab,
  onConsole,
  onUndo,
  onRedo,
  onRun,
  readOnly = false,
  requiresApproval = false,
  userRole = 'editor',
  onSubmitForReview
}) {
  const scrollContainerRef = useRef(null);
  const activeTabRef = useRef(null);

  // Auto-scroll active tab into view when selection changes
  useEffect(() => {
    if (activeTabRef.current && scrollContainerRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [activeTab]);

  // Support horizontal mouse wheel scrolling across tabs
  const handleWheel = (e) => {
    if (scrollContainerRef.current && e.deltaY !== 0 && !e.deltaX) {
      scrollContainerRef.current.scrollLeft += e.deltaY * 0.8;
    }
  };

  const getTabIcon = (fileName) => {
    if (fileName.endsWith('.js')) {
      return <FileCode size={14} className="file-icon file-icon-js" />;
    }
    if (fileName.endsWith('.html')) {
      return <FileText size={14} className="file-icon file-icon-html" />;
    }
    if (fileName.endsWith('.css')) {
      return <Palette size={14} className="file-icon file-icon-css" />;
    }
    return <FileCode size={14} className="file-icon" />;
  };

  return (
    <div className="tab-bar">
      {/* Zone 1: Horizontally scrollable file tabs area */}
      <div
        className="tab-scroll-container"
        ref={scrollContainerRef}
        onWheel={handleWheel}
      >
        <div className="tab-list">
          {openTabs.map((fileName) => {
            const isActive = fileName === activeTab;
            return (
              <div
                key={fileName}
                ref={isActive ? activeTabRef : null}
                className={`tab-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(fileName)}
                role="button"
                tabIndex={0}
                title={fileName}
              >
                <span className="tab-icon">{getTabIcon(fileName)}</span>
                <span className="tab-label">{fileName}</span>
                <button
                  type="button"
                  className="tab-close-btn"
                  title={`Close ${fileName}`}
                  aria-label={`Close ${fileName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(fileName);
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zone 2: Key editor action buttons pinned on right: [ Submit for Review ] [ Undo ] [ Redo ] [ Run ] [ Console ] */}
      <div className="tab-bar-actions">

        {/* [ Submit for Review ] when approval mode is active for editors */}
        {requiresApproval && userRole === 'editor' && onSubmitForReview && (
          <button
            type="button"
            className="tab-action-btn btn-tab-submit-review"
            onClick={onSubmitForReview}
            onMouseDown={(e) => e.preventDefault()}
            title="Submit proposed changes for project owner review"
            aria-label="Submit for Review"
          >
            <GitPullRequest size={13} className="tab-action-icon text-amber" />
            <span className="tab-action-text">Submit for Review</span>
          </button>
        )}

        {/* [ Undo ] */}
        <button
          type="button"
          className="tab-action-btn btn-tab-undo"
          onClick={onUndo}
          onMouseDown={(e) => e.preventDefault()}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          disabled={readOnly || !activeTab}
        >
          <Undo2 size={13} className="tab-action-icon" />
          <span className="tab-action-text">Undo</span>
        </button>

        {/* [ Redo ] */}
        <button
          type="button"
          className="tab-action-btn btn-tab-redo"
          onClick={onRedo}
          onMouseDown={(e) => e.preventDefault()}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          disabled={readOnly || !activeTab}
        >
          <Redo2 size={13} className="tab-action-icon" />
          <span className="tab-action-text">Redo</span>
        </button>

        {/* [ Run ] */}
        <button
          type="button"
          className="tab-action-btn btn-tab-run"
          onClick={onRun}
          onMouseDown={(e) => e.preventDefault()}
          title="Run project in Live Preview"
          aria-label="Run Live Preview"
        >
          <Play size={12} fill="currentColor" className="tab-action-icon" />
          <span className="tab-action-text">Run</span>
        </button>
        {/* [ Console ] */}
        <button
          type="button"
          className="tab-action-btn btn-tab-console"
          onClick={onConsole}
          onMouseDown={(e) => e.preventDefault()}
          title="Open Virtual Console"
          aria-label="Open Virtual Console"
        >
          <Terminal size={13} className="tab-action-icon" />
          <span className="tab-action-text">Console</span>
          
        </button>
      </div>
    </div>
  );
}
