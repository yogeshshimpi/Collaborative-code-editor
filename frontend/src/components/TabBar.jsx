import { useRef, useEffect } from 'react';
import { X, FileCode, FileText, Palette, History } from 'lucide-react';

export default function TabBar({
  openTabs = [],
  activeTab,
  onSelectTab,
  onCloseTab,
  onOpenHistory
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

      {/* Zone 2: Fixed History button pinned on right */}
      {onOpenHistory && (
        <div className="tab-bar-actions">
          <button
            type="button"
            className="tab-action-btn"
            onClick={onOpenHistory}
            title={activeTab ? `View version history for ${activeTab}` : 'View version history'}
            aria-label="View Version History"
            disabled={!activeTab}
          >
            <History size={13} />
            <span className="tab-action-text">History</span>
          </button>
        </div>
      )}
    </div>
  );
}
