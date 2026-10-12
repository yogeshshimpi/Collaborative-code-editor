import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  Palette,
  Plus,
  MoreVertical,
  X
} from 'lucide-react';

export default function Sidebar({
  files = [],
  activeFile,
  onSelectFile,
  isOpen = false,
  onClose
}) {
  const [isFolderOpen, setIsFolderOpen] = useState(true);

  const getFileIcon = (fileName) => {
    if (fileName.endsWith('.js')) {
      return <FileCode size={15} className="file-icon file-icon-js" />;
    }
    if (fileName.endsWith('.html')) {
      return <FileText size={15} className="file-icon file-icon-html" />;
    }
    if (fileName.endsWith('.css')) {
      return <Palette size={15} className="file-icon file-icon-css" />;
    }
    return <FileCode size={15} className="file-icon" />;
  };

  const handleFileClick = (fileName) => {
    onSelectFile(fileName);
    // On mobile, close drawer after file selection
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">EXPLORER</span>
          <div className="sidebar-actions">
            <button
              type="button"
              className="action-icon-btn"
              title="New File (Coming soon)"
              onClick={() => {}}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              className="action-icon-btn"
              title="More Options"
              onClick={() => {}}
            >
              <MoreVertical size={15} />
            </button>
            {/* Mobile Drawer Close Button */}
            <button
              type="button"
              className="action-icon-btn mobile-close-btn"
              title="Close Explorer"
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="explorer-tree">
          {/* Project Folder */}
          <div
            className="folder-item"
            onClick={() => setIsFolderOpen(!isFolderOpen)}
            role="button"
            tabIndex={0}
          >
            <span className="folder-chevron">
              {isFolderOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="folder-icon">
              {isFolderOpen ? <FolderOpen size={16} /> : <Folder size={16} />}
            </span>
            <span className="folder-name">my-project</span>
          </div>

          {/* Files inside project folder */}
          {isFolderOpen && (
            <div className="file-list">
              {files.map((file) => {
                const isSelected = activeFile === file.name;
                return (
                  <div
                    key={file.name}
                    className={`file-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleFileClick(file.name)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="file-indicator" />
                    {getFileIcon(file.name)}
                    <span className="file-name">{file.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
