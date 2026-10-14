import './Sidebar.css';
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  ChevronDown,
  ChevronRight,
  FileCode,
  FileText,
  Palette,
  Edit2,
  Trash2,
  X,
  Minimize2,
  AlertTriangle,
  Code2,
  Database,
  Terminal,
  FileJson,
  Lock,
  Unlock
} from 'lucide-react';
import { buildFileTree, isValidName, normalizePath } from '../../utils/fileTree';
import { getDefaultFileContent } from '../../data/initialFiles';

export default function Sidebar({
  files = [],
  folders = [],
  activeFile,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onRenameFolder,
  onDeleteFile,
  onDeleteFolder,
  onMoveItem,
  userRole = 'editor',
  requiresApproval = false,
  isOpen = false,
  onClose,
  projectName = 'my-project',
  protectedFiles = [],
  isOwner = false,
  onToggleProtectFile
}) {
  const isViewer = userRole === 'viewer';

  // Set of collapsed folder paths
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());

  // Creation state: { type: 'file' | 'folder', parentPath: string } | null
  const [creationState, setCreationState] = useState(null);
  const [creationName, setCreationName] = useState('');
  const [creationError, setCreationError] = useState(null);
  const creationInputRef = useRef(null);

  // Renaming state: { path: string, isFolder: boolean, currentName: string } | null
  const [renamingState, setRenamingState] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState(null);
  const renameInputRef = useRef(null);

  // Drag over target path for visual feedback
  const [dragOverPath, setDragOverPath] = useState(null);

  // Build tree from files and folders
  const fileTree = useMemo(() => {
    return buildFileTree(files, folders);
  }, [files, folders]);

  // Focus input on creation
  useEffect(() => {
    if (creationState && creationInputRef.current) {
      creationInputRef.current.focus();
      creationInputRef.current.select();
    }
  }, [creationState]);

  // Focus input on rename
  useEffect(() => {
    if (renamingState && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingState]);

  // Toggle folder collapse/expand
  const toggleFolder = (folderPath) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Collapse all folders
  const handleCollapseAll = () => {
    const allPaths = new Set(folders);
    for (const file of files) {
      const parts = normalizePath(file.name).split('/');
      let cur = '';
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        allPaths.add(cur);
      }
    }
    setCollapsedFolders(allPaths);
  };

  // Expand all folders
  const handleExpandAll = () => {
    setCollapsedFolders(new Set());
  };

  // Select file handler
  const handleFileClick = (fileName) => {
    if (renamingState) return;
    onSelectFile(fileName);
    if (onClose) {
      onClose();
    }
  };

  // Start creating a file or folder
  const startCreation = (type, parentPath = '') => {
    if (isViewer) return;
    setRenamingState(null);
    setCreationState({ type, parentPath: normalizePath(parentPath) });
    setCreationName('');
    setCreationError(null);

    // Ensure parent folder is expanded
    if (parentPath) {
      setCollapsedFolders((prev) => {
        const next = new Set(prev);
        next.delete(parentPath);
        return next;
      });
    }
  };

  // Submit creation
  const handleCreationSubmit = (e) => {
    if (e) e.preventDefault();
    if (!creationState) return;

    const trimmed = creationName.trim();
    if (!trimmed) {
      setCreationState(null);
      return;
    }

    if (!isValidName(trimmed)) {
      setCreationError('Invalid name. Cannot contain: / \\ : * ? " < > |');
      return;
    }

    const parent = creationState.parentPath;
    const fullPath = parent ? `${parent}/${trimmed}` : trimmed;

    // Check collision
    if (creationState.type === 'file') {
      const exists = files.some((f) => normalizePath(f.name) === fullPath);
      if (exists) {
        setCreationError('A file with this name already exists.');
        return;
      }
      const initialContent = getDefaultFileContent(fullPath);
      onCreateFile(fullPath, initialContent);
    } else {
      const exists = folders.some((f) => normalizePath(f) === fullPath);
      if (exists) {
        setCreationError('A folder with this name already exists.');
        return;
      }
      onCreateFolder(fullPath);
    }

    setCreationState(null);
    setCreationName('');
    setCreationError(null);
  };

  // Cancel creation on Escape or blur
  const handleCreationKeyDown = (e) => {
    if (e.key === 'Escape') {
      setCreationState(null);
      setCreationError(null);
    } else if (e.key === 'Enter') {
      handleCreationSubmit(e);
    }
  };

  // Start renaming
  const startRename = (node, e) => {
    e.stopPropagation();
    if (isViewer) return;
    setCreationState(null);
    setRenamingState({
      path: node.path,
      isFolder: node.isFolder,
      currentName: node.name
    });
    setRenameValue(node.name);
    setRenameError(null);
  };

  // Submit rename
  const handleRenameSubmit = (e) => {
    if (e) e.preventDefault();
    if (!renamingState) return;

    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renamingState.currentName) {
      setRenamingState(null);
      return;
    }

    if (!isValidName(trimmed)) {
      setRenameError('Invalid name. Cannot contain: / \\ : * ? " < > |');
      return;
    }

    const parts = renamingState.path.split('/');
    parts[parts.length - 1] = trimmed;
    const newFullPath = parts.join('/');

    if (renamingState.isFolder) {
      onRenameFolder(renamingState.path, newFullPath);
    } else {
      onRenameFile(renamingState.path, newFullPath);
    }

    setRenamingState(null);
    setRenameValue('');
    setRenameError(null);
  };

  // Cancel rename on Escape
  const handleRenameKeyDown = (e) => {
    if (e.key === 'Escape') {
      setRenamingState(null);
      setRenameError(null);
    } else if (e.key === 'Enter') {
      handleRenameSubmit(e);
    }
  };


  // Drag and drop handlers
  const handleDragStart = (e, node) => {
    if (isViewer) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ path: node.path, isFolder: node.isFolder })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetFolder) => {
    if (isViewer) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPath(targetFolder?.path ?? '__root__');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
  };

  const handleDrop = (e, targetFolderPath) => {
    if (isViewer) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const { path: sourcePath, isFolder } = JSON.parse(dataStr);

      const cleanSource = normalizePath(sourcePath);
      const cleanTarget = normalizePath(targetFolderPath);

      if (!cleanSource) return;
      if (cleanSource === cleanTarget) return;

      // Cannot move a folder into its own subfolder
      if (isFolder && cleanTarget.startsWith(`${cleanSource}/`)) {
        return;
      }

      // Check if source is already inside target
      const parentOfSource = cleanSource.includes('/')
        ? cleanSource.slice(0, cleanSource.lastIndexOf('/'))
        : '';
      if (parentOfSource === cleanTarget) {
        return;
      }

      if (onMoveItem) {
        onMoveItem(isFolder ? 'folder' : 'file', cleanSource, cleanTarget);
      }
    } catch (err) {
      console.warn('[DragDrop Error]:', err);
    }
  };

  // Get file icon with distinct color styling
  const getFileIcon = (fileName) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.jsx') || lower.endsWith('.tsx')) {
      return <Code2 size={15} className="file-icon file-icon-jsx" />;
    }
    if (lower.endsWith('.ts')) {
      return <FileCode size={15} className="file-icon file-icon-ts" />;
    }
    if (lower.endsWith('.js') || lower.endsWith('.mjs')) {
      return <FileCode size={15} className="file-icon file-icon-js" />;
    }
    if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      return <FileText size={15} className="file-icon file-icon-html" />;
    }
    if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.less')) {
      return <Palette size={15} className="file-icon file-icon-css" />;
    }
    if (lower.endsWith('.json')) {
      return <FileJson size={15} className="file-icon file-icon-json" />;
    }
    if (lower.endsWith('.py')) {
      return <Terminal size={15} className="file-icon file-icon-py" />;
    }
    if (lower.endsWith('.sql')) {
      return <Database size={15} className="file-icon file-icon-sql" />;
    }
    if (lower.endsWith('.md')) {
      return <FileText size={15} className="file-icon file-icon-md" />;
    }
    return <FileCode size={15} className="file-icon" />;
  };

  // Recursive render of tree nodes
  const renderTree = (nodes, depth = 0) => {
    return nodes.map((node) => {
      const isCollapsed = collapsedFolders.has(node.path);
      const isSelected = !node.isFolder && activeFile === node.path;
      const isRenaming = renamingState?.path === node.path;
      const isDragTarget = dragOverPath === node.path;
      const indentPadding = `${depth * 14 + 10}px`;

      if (node.isFolder) {
        return (
          <div key={`folder-${node.path}`} className="tree-folder-group">
            <div
              className={`folder-item ${isDragTarget ? 'drag-over' : ''}`}
              style={{ paddingLeft: indentPadding }}
              onClick={() => toggleFolder(node.path)}
              draggable={!isViewer && !isRenaming}
              onDragStart={(e) => handleDragStart(e, node)}
              onDragOver={(e) => handleDragOver(e, node)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, node.path)}
              role="button"
              tabIndex={0}
            >
              <span className="folder-chevron">
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </span>
              <span className="folder-icon">
                {isCollapsed ? <Folder size={16} /> : <FolderOpen size={16} />}
              </span>

              {isRenaming ? (
                <form
                  onSubmit={handleRenameSubmit}
                  className="inline-input-form"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    ref={renameInputRef}
                    type="text"
                    className="inline-explorer-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={handleRenameSubmit}
                  />
                  {renameError && <span className="inline-error-tooltip">{renameError}</span>}
                </form>
              ) : (
                <span className="folder-name" title={node.path}>
                  {node.name}
                </span>
              )}

              {/* Action Buttons for Folder (hidden for viewers) */}
              {!isViewer && !isRenaming && (
                <div className="item-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="item-action-btn"
                    title="New File in Folder"
                    aria-label="New File in Folder"
                    onClick={() => startCreation('file', node.path)}
                  >
                    <FilePlus size={13} />
                  </button>
                  <button
                    type="button"
                    className="item-action-btn"
                    title="New Subfolder"
                    aria-label="New Subfolder"
                    onClick={() => startCreation('folder', node.path)}
                  >
                    <FolderPlus size={13} />
                  </button>
                  {/* Hide rename/delete if folder has protected files and user is not owner */}
                  {(!protectedFiles.some((pf) => pf === node.path || pf.startsWith(`${node.path}/`)) || isOwner) && (
                    <>
                      <button
                        type="button"
                        className="item-action-btn"
                        title="Rename Folder"
                        aria-label="Rename Folder"
                        onClick={(e) => startRename(node, e)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="item-action-btn delete-action-btn"
                        title="Delete Folder"
                        aria-label="Delete Folder"
                        onClick={() => onDeleteFolder(node.path)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Folder Children */}
            {!isCollapsed && (
              <div className="folder-children">
                {/* Inline creation input inside this folder */}
                {creationState && creationState.parentPath === node.path && (
                  <div
                    className="file-item inline-create-row"
                    style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
                  >
                    {creationState.type === 'folder' ? (
                      <Folder size={16} className="folder-icon" />
                    ) : (
                      <FileCode size={15} className="file-icon" />
                    )}
                    <form onSubmit={handleCreationSubmit} className="inline-input-form">
                      <input
                        ref={creationInputRef}
                        type="text"
                        className="inline-explorer-input"
                        placeholder={creationState.type === 'folder' ? 'folder name' : 'file.js'}
                        value={creationName}
                        onChange={(e) => setCreationName(e.target.value)}
                        onKeyDown={handleCreationKeyDown}
                        onBlur={handleCreationSubmit}
                      />
                      {creationError && (
                        <span className="inline-error-tooltip">{creationError}</span>
                      )}
                    </form>
                  </div>
                )}

                {node.children.length > 0
                  ? renderTree(node.children, depth + 1)
                  : !creationState || creationState.parentPath !== node.path ? (
                      <div
                        className="empty-folder-hint"
                        style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
                      >
                        (empty)
                      </div>
                    ) : null}
              </div>
            )}
          </div>
        );
      }

      // File item
      const isProtected = protectedFiles.includes(node.path);

      return (
        <div
          key={`file-${node.path}`}
          className={`file-item ${isSelected ? 'selected' : ''} ${isProtected ? 'is-protected-file' : ''}`}
          style={{ paddingLeft: indentPadding }}
          onClick={() => handleFileClick(node.path)}
          draggable={!isViewer && !isRenaming && (!isProtected || isOwner)}
          onDragStart={(e) => handleDragStart(e, node)}
          role="button"
          tabIndex={0}
        >
          <span className="file-indicator" />
          {getFileIcon(node.name)}

          {isRenaming ? (
            <form
              onSubmit={handleRenameSubmit}
              className="inline-input-form"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                ref={renameInputRef}
                type="text"
                className="inline-explorer-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={handleRenameSubmit}
              />
              {renameError && <span className="inline-error-tooltip">{renameError}</span>}
            </form>
          ) : (
            <span className="file-name" title={node.path}>
              {node.name}
            </span>
          )}

          {/* Protected File Lock Badge */}
          {isProtected && (
            <span
              className="file-protected-lock"
              title="This file is protected by the project owner."
              aria-label="Protected file"
            >
              <Lock size={12} />
            </span>
          )}

          {/* Action buttons for File */}
          {!isViewer && !isRenaming && (
            <div className="item-actions" onClick={(e) => e.stopPropagation()}>
              {/* Owner can toggle file protection */}
              {isOwner && (
                <button
                  type="button"
                  className={`item-action-btn ${isProtected ? 'is-protected-active' : ''}`}
                  title={isProtected ? 'Unprotect file' : 'Protect file (Owner only)'}
                  aria-label={isProtected ? 'Unprotect file' : 'Protect file'}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleProtectFile) onToggleProtectFile(node.path);
                  }}
                >
                  {isProtected ? <Unlock size={13} /> : <Lock size={13} />}
                </button>
              )}

              {/* Editors and Owners can rename & delete unprotected files; only Owner can modify protected files */}
              {(!isProtected || isOwner) && (
                <>
                  <button
                    type="button"
                    className="item-action-btn"
                    title="Rename File"
                    aria-label="Rename File"
                    onClick={(e) => startRename(node, e)}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="item-action-btn delete-action-btn"
                    title="Delete File"
                    aria-label="Delete File"
                    onClick={() => onDeleteFile(node.path)}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      );
    });
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
          <div className="sidebar-header-title">
            <span className="sidebar-title">EXPLORER</span>
            {isViewer && <span className="explorer-viewer-badge">READ ONLY</span>}
          </div>

          <div className="sidebar-actions">
            {!isViewer && (
              <>
                <button
                  type="button"
                  className="action-icon-btn"
                  title="New File (Root)"
                  aria-label="New File in Root"
                  onClick={() => startCreation('file', '')}
                >
                  <FilePlus size={15} />
                </button>
                <button
                  type="button"
                  className="action-icon-btn"
                  title="New Folder (Root)"
                  aria-label="New Folder in Root"
                  onClick={() => startCreation('folder', '')}
                >
                  <FolderPlus size={15} />
                </button>
              </>
            )}

            <button
              type="button"
              className="action-icon-btn"
              title="Collapse All Folders"
              aria-label="Collapse All Folders"
              onClick={handleCollapseAll}
            >
              <Minimize2 size={14} />
            </button>

            {/* Mobile Drawer Close Button */}
            <button
              type="button"
              className="action-icon-btn mobile-close-btn"
              title="Close Explorer"
              aria-label="Close Explorer"
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Root project drop target & container */}
        <div
          className={`explorer-tree ${dragOverPath === '__root__' ? 'drag-over-root' : ''}`}
          onDragOver={(e) => handleDragOver(e, { path: '' })}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, '')}
        >
          {/* Project root folder header */}
          <div className="explorer-project-header">
            <span className="project-root-label">WORKSPACE</span>
            <span className="project-root-name">{projectName}</span>
          </div>

          {/* Root Level Inline Creation Row */}
          {creationState && creationState.parentPath === '' && (
            <div className="file-item inline-create-row" style={{ paddingLeft: '14px' }}>
              {creationState.type === 'folder' ? (
                <Folder size={16} className="folder-icon" />
              ) : (
                <FileCode size={15} className="file-icon" />
              )}
              <form onSubmit={handleCreationSubmit} className="inline-input-form">
                <input
                  ref={creationInputRef}
                  type="text"
                  className="inline-explorer-input"
                  placeholder={creationState.type === 'folder' ? 'folder name' : 'file.js'}
                  value={creationName}
                  onChange={(e) => setCreationName(e.target.value)}
                  onKeyDown={handleCreationKeyDown}
                  onBlur={handleCreationSubmit}
                />
                {creationError && <span className="inline-error-tooltip">{creationError}</span>}
              </form>
            </div>
          )}

          {/* Render File & Folder Tree */}
          {fileTree.length > 0 ? (
            renderTree(fileTree, 0)
          ) : (
            <div className="empty-workspace-state">
              <p>No files in project.</p>
              {!isViewer && (
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => startCreation('file', '')}
                >
                  Create a file
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
