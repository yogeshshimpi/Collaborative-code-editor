import './TabBar.css';
import { useRef, useEffect, useState } from 'react';
import {
  X,
  FileCode,
  FileText,
  Palette,
  Terminal,
  Undo2,
  Redo2,
  Play,
  GitPullRequest,
  MoreHorizontal,
  Search,
  Replace,
  AlignLeft
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
  onFind,
  onReplace,
  onFormatDocument,
  readOnly = false,
  _requiresApproval = false,
  userRole = 'editor',
  onSubmitForReview,
  onRequestReview
}) {
  const tabBarRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const activeTabRef = useRef(null);
  const moreMenuRef = useRef(null);

  const [tabBarWidth, setTabBarWidth] = useState(800);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // ResizeObserver on TabBar container for responsive adaptation
  useEffect(() => {
    if (!tabBarRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setTabBarWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(tabBarRef.current);
    return () => observer.disconnect();
  }, []);

  // Close dropdown menu on outside click or Escape
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreOpen]);

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

  const isExtraWide = tabBarWidth >= 880;
  const isWide = tabBarWidth >= 700;
  const isMedium = tabBarWidth < 700 && tabBarWidth >= 520;
  const isTight = tabBarWidth < 520;

  const handleReviewClick = () => {
    setIsMoreOpen(false);
    if (onRequestReview) onRequestReview();
    else if (onSubmitForReview) onSubmitForReview();
  };

  const handleConsoleClick = () => {
    setIsMoreOpen(false);
    if (onConsole) onConsole();
  };

  const handleUndoClick = () => {
    setIsMoreOpen(false);
    if (onUndo) onUndo();
  };

  const handleRedoClick = () => {
    setIsMoreOpen(false);
    if (onRedo) onRedo();
  };

  const handleFindClick = () => {
    setIsMoreOpen(false);
    if (onFind) onFind();
  };

  const handleReplaceClick = () => {
    setIsMoreOpen(false);
    if (onReplace) onReplace();
  };

  const handleFormatClick = () => {
    setIsMoreOpen(false);
    if (onFormatDocument) onFormatDocument();
  };

  return (
    <div
      className={`tab-bar ${
        isTight ? 'mode-tight' : isMedium ? 'mode-medium' : isExtraWide ? 'mode-extrawide' : 'mode-wide'
      }`}
      ref={tabBarRef}
    >
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

      {/* Zone 2: Grouped Editor Action Toolbar */}
      <div className="tab-bar-actions">
        {/* GROUP 1: Edit & Format (Undo, Redo, Format Document) */}
        {!isTight && (
          <div className="tab-toolbar-group group-edit" title="Edit tools">
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
              {isExtraWide && <span className="tab-action-text">Undo</span>}
            </button>
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
              {isExtraWide && <span className="tab-action-text">Redo</span>}
            </button>
            <button
              type="button"
              className="tab-action-btn btn-tab-format"
              onClick={onFormatDocument}
              onMouseDown={(e) => e.preventDefault()}
              title="Format Document (Shift+Alt+F)"
              aria-label="Format Document"
              disabled={readOnly || !activeTab}
            >
              <AlignLeft size={13} className="tab-action-icon" />
              {isExtraWide && <span className="tab-action-text">Format</span>}
            </button>
          </div>
        )}

        {!isTight && <div className="tab-group-divider" />}

        {/* GROUP 2: Search & Replace (Find, Replace) */}
        {isWide && (
          <>
            <div className="tab-toolbar-group group-search" title="Search & Replace">
              <button
                type="button"
                className="tab-action-btn btn-tab-find"
                onClick={onFind}
                onMouseDown={(e) => e.preventDefault()}
                title="Find (Ctrl+F)"
                aria-label="Find in file"
                disabled={!activeTab}
              >
                <Search size={13} className="tab-action-icon" />
                {isExtraWide && <span className="tab-action-text">Find</span>}
              </button>
              <button
                type="button"
                className="tab-action-btn btn-tab-replace"
                onClick={onReplace}
                onMouseDown={(e) => e.preventDefault()}
                title="Replace (Ctrl+H)"
                aria-label="Replace in file"
                disabled={readOnly || !activeTab}
              >
                <Replace size={13} className="tab-action-icon" />
                {isExtraWide && <span className="tab-action-text">Replace</span>}
              </button>
            </div>
            <div className="tab-group-divider" />
          </>
        )}

        {/* Medium Mode: Direct Find button */}
        {isMedium && (
          <>
            <button
              type="button"
              className="tab-action-btn btn-tab-find"
              onClick={onFind}
              onMouseDown={(e) => e.preventDefault()}
              title="Find (Ctrl+F)"
              aria-label="Find in file"
              disabled={!activeTab}
            >
              <Search size={13} className="tab-action-icon" />
            </button>
            <div className="tab-group-divider" />
          </>
        )}

        {/* GROUP 3: Execution & Output (Run, Console) */}
        <div className="tab-toolbar-group group-execution" title="Code Execution">
          <button
            type="button"
            className="tab-action-btn btn-tab-run"
            onClick={onRun}
            onMouseDown={(e) => e.preventDefault()}
            title="Run Code (Ctrl+Enter)"
            aria-label="Run Code"
          >
            <Play size={12} fill="currentColor" className="tab-action-icon" />
            <span className="tab-action-text">Run</span>
          </button>

          {isWide && (
            <button
              type="button"
              className="tab-action-btn btn-tab-console"
              onClick={onConsole}
              onMouseDown={(e) => e.preventDefault()}
              title="Open Virtual Console"
              aria-label="Open Virtual Console"
            >
              <Terminal size={13} className="tab-action-icon" />
              {isExtraWide && <span className="tab-action-text">Console</span>}
            </button>
          )}
        </div>

        {/* GROUP 4: Review Workflow (for editors) */}
        {isWide && userRole === 'editor' && (onSubmitForReview || onRequestReview) && (
          <>
            <div className="tab-group-divider" />
            <div className="tab-toolbar-group group-review" title="Collaboration Workflow">
              <button
                type="button"
                className="tab-action-btn btn-tab-submit-review"
                onClick={handleReviewClick}
                onMouseDown={(e) => e.preventDefault()}
                title="Request project owner review for current code changes"
                aria-label="Request Review"
              >
                <GitPullRequest size={13} className="tab-action-icon" />
                <span className="tab-action-text">Request Review</span>
              </button>
            </div>
          </>
        )}

        {/* More Actions Dropdown (for medium & tight modes, or overflow) */}
        {(!isWide || isMedium || isTight) && (
          <div className="tab-more-menu-wrapper" ref={moreMenuRef}>
            <button
              type="button"
              className={`tab-action-btn btn-tab-more ${isMoreOpen ? 'active' : ''}`}
              onClick={() => setIsMoreOpen((prev) => !prev)}
              onMouseDown={(e) => e.preventDefault()}
              title="More editor tools"
              aria-label="More editor tools"
              aria-expanded={isMoreOpen}
            >
              <MoreHorizontal size={14} className="tab-action-icon" />
            </button>

            {isMoreOpen && (
              <div className="tab-dropdown-menu" role="menu">
                {/* Section 1: Edit & Format */}
                <div className="tab-dropdown-section">
                  <span className="tab-dropdown-section-title">Edit & Format</span>
                  {isTight && (
                    <>
                      <button
                        type="button"
                        className="tab-dropdown-item"
                        onClick={handleUndoClick}
                        disabled={readOnly || !activeTab}
                        role="menuitem"
                      >
                        <Undo2 size={13} className="dropdown-item-icon" />
                        <span className="dropdown-item-label">Undo</span>
                        <kbd className="dropdown-shortcut-badge">Ctrl+Z</kbd>
                      </button>
                      <button
                        type="button"
                        className="tab-dropdown-item"
                        onClick={handleRedoClick}
                        disabled={readOnly || !activeTab}
                        role="menuitem"
                      >
                        <Redo2 size={13} className="dropdown-item-icon" />
                        <span className="dropdown-item-label">Redo</span>
                        <kbd className="dropdown-shortcut-badge">Ctrl+Y</kbd>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="tab-dropdown-item"
                    onClick={handleFormatClick}
                    disabled={readOnly || !activeTab}
                    role="menuitem"
                  >
                    <AlignLeft size={13} className="dropdown-item-icon" />
                    <span className="dropdown-item-label">Format Document</span>
                    <kbd className="dropdown-shortcut-badge">Shift+Alt+F</kbd>
                  </button>
                </div>

                <div className="tab-dropdown-divider" />

                {/* Section 2: Search & Navigation */}
                <div className="tab-dropdown-section">
                  <span className="tab-dropdown-section-title">Search & Replace</span>
                  <button
                    type="button"
                    className="tab-dropdown-item"
                    onClick={handleFindClick}
                    disabled={!activeTab}
                    role="menuitem"
                  >
                    <Search size={13} className="dropdown-item-icon" />
                    <span className="dropdown-item-label">Find</span>
                    <kbd className="dropdown-shortcut-badge">Ctrl+F</kbd>
                  </button>
                  <button
                    type="button"
                    className="tab-dropdown-item"
                    onClick={handleReplaceClick}
                    disabled={readOnly || !activeTab}
                    role="menuitem"
                  >
                    <Replace size={13} className="dropdown-item-icon" />
                    <span className="dropdown-item-label">Replace</span>
                    <kbd className="dropdown-shortcut-badge">Ctrl+H</kbd>
                  </button>
                </div>

                <div className="tab-dropdown-divider" />

                {/* Section 3: Execution & Output */}
                <div className="tab-dropdown-section">
                  <span className="tab-dropdown-section-title">Execution & Output</span>
                  <button
                    type="button"
                    className="tab-dropdown-item"
                    onClick={() => {
                      setIsMoreOpen(false);
                      if (onRun) onRun();
                    }}
                    role="menuitem"
                  >
                    <Play size={13} fill="currentColor" className="dropdown-item-icon text-accent" />
                    <span className="dropdown-item-label">Run Code</span>
                    <kbd className="dropdown-shortcut-badge">Ctrl+Enter</kbd>
                  </button>
                  <button
                    type="button"
                    className="tab-dropdown-item"
                    onClick={handleConsoleClick}
                    role="menuitem"
                  >
                    <Terminal size={13} className="dropdown-item-icon" />
                    <span className="dropdown-item-label">Virtual Console</span>
                  </button>
                </div>

                {/* Section 4: Workflow Review (for editors) */}
                {userRole === 'editor' && (onSubmitForReview || onRequestReview) && (
                  <>
                    <div className="tab-dropdown-divider" />
                    <div className="tab-dropdown-section">
                      <span className="tab-dropdown-section-title">Project Review</span>
                      <button
                        type="button"
                        className="tab-dropdown-item"
                        onClick={handleReviewClick}
                        role="menuitem"
                      >
                        <GitPullRequest size={13} className="dropdown-item-icon text-amber" />
                        <span className="dropdown-item-label">Request Review</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
