import { X, FileCode, FileText, Palette } from 'lucide-react';

export default function TabBar({
  openTabs = [],
  activeTab,
  onSelectTab,
  onCloseTab
}) {
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
      <div className="tab-list">
        {openTabs.map((fileName) => {
          const isActive = fileName === activeTab;
          return (
            <div
              key={fileName}
              className={`tab-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(fileName)}
              role="button"
              tabIndex={0}
            >
              <span className="tab-icon">{getTabIcon(fileName)}</span>
              <span className="tab-label">{fileName}</span>
              <button
                type="button"
                className="tab-close-btn"
                title={`Close ${fileName}`}
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
  );
}
