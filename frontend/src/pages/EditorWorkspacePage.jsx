import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, FolderCode, ArrowLeft, Code2, Columns, Play } from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import TabBar from '../components/TabBar';
import EditorArea from '../components/EditorArea';
import StatusBar from '../components/StatusBar';
import CollaboratorsPanel from '../components/CollaboratorsPanel';
import CollaboratorsModal from '../components/CollaboratorsModal';
import VersionHistoryModal from '../components/VersionHistoryModal';
import LivePreview from '../components/LivePreview';
import WorkspaceSplitDivider from '../components/WorkspaceSplitDivider';
import Toast from '../components/Toast';
import { useAuth } from '../context/useAuth';
import { api } from '../services/api';
import { INITIAL_FILES, getLanguageFromFile } from '../data/initialFiles';
import { useSocket } from '../hooks/useSocket';

export default function EditorWorkspacePage() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { user, projects, renameProject, logout } = useAuth();

  const roomId = (urlRoomId && decodeURIComponent(urlRoomId).trim()) || 'demo-room';

  // Helper for slug comparison
  const toSlug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cleanParam = roomId.trim();
  const lowerParam = cleanParam.toLowerCase();
  const slugParam = toSlug(cleanParam);

  // Match project from context projects array
  const matchedInContext = projects.find((p) => {
    if (!p) return false;
    if (p.room_id === cleanParam || p.id === cleanParam) return true;
    if (p.room_id && p.room_id.toLowerCase() === lowerParam) return true;
    if (p.name && p.name.toLowerCase() === lowerParam) return true;
    if (toSlug(p.name) === slugParam || toSlug(p.room_id) === slugParam) return true;
    return false;
  });

  const [currentProject, setCurrentProject] = useState(matchedInContext || null);
  const [isProjectLoading, setIsProjectLoading] = useState(!matchedInContext && roomId !== 'demo-room');
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [toast, setToast] = useState(null);

  // Show notification
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  // Direct project API loader to guarantee freshness on direct route load & refresh
  useEffect(() => {
    let isMounted = true;
    setProjectNotFound(false);

    if (matchedInContext) {
      setCurrentProject(matchedInContext);
      setIsProjectLoading(false);
    }

    if (roomId === 'demo-room') {
      setIsProjectLoading(false);
      return;
    }

    api.getProject(roomId)
      .then((res) => {
        if (isMounted && res?.project) {
          setCurrentProject(res.project);
          setIsProjectLoading(false);
          setProjectNotFound(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setIsProjectLoading(false);
          if (!matchedInContext && (err.status === 404 || err.message?.toLowerCase().includes('not found'))) {
            setProjectNotFound(true);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [roomId, matchedInContext]);

  // Handle remote project info from socket
  const handleProjectInfo = useCallback((info) => {
    if (info) {
      setCurrentProject((prev) => ({
        ...(prev || {}),
        ...info
      }));
    }
  }, []);

  // Handle project renamed notification from socket
  const handleProjectRenamed = useCallback(({ projectId, newRoomId, newName }) => {
    setCurrentProject((prev) => {
      if (!prev || prev.id === projectId) {
        return {
          ...(prev || {}),
          id: projectId,
          name: newName,
          room_id: newRoomId
        };
      }
      return prev;
    });

    const targetSlug = newRoomId || newName;
    navigate(`/projects/${encodeURIComponent(targetSlug)}`, { replace: true });
    showToast(`Project renamed to "${newName}"`, 'info');
  }, [navigate, showToast]);

  const activeRoomId = currentProject?.room_id || matchedInContext?.room_id || roomId;
  const projectName = currentProject?.name || matchedInContext?.name || roomId;

  // Active user is the authenticated user
  const currentUser = user || { name: 'User', color: '#6d5dfc', initials: 'U' };

  // File storage state - holds independent content per file
  const [filesState, setFilesState] = useState(INITIAL_FILES);
  // Folder paths list in workspace
  const [foldersState, setFoldersState] = useState([]);
  // Open tabs list
  const [openTabs, setOpenTabs] = useState(['main.js', 'index.html', 'styles.css']);
  // Currently active file
  const [activeFile, setActiveFile] = useState('main.js');
  // Live cursor position for the status bar
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  // Right panel toggle (Collaborators)
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  // Collaborators & Invitations Modal
  const [isCollaboratorsOpen, setIsCollaboratorsOpen] = useState(false);
  // Version History Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  // Live Preview Sandbox & Split Pane Workspace state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50); // percentage: 15% to 85%, default 50%
  const [maximizedPane, setMaximizedPane] = useState('none'); // 'none' | 'editor' | 'preview'
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState('split'); // 'editor' | 'split' | 'preview'
  const [runTrigger, setRunTrigger] = useState(0);
  const [isMobileWorkspace, setIsMobileWorkspace] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024
  );
  const workspaceRowRef = useRef(null);

  // Responsive workspace layout detection
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setIsMobileWorkspace(window.innerWidth < 1024);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleToggleMaximizePreview = useCallback(() => {
    setMaximizedPane((prev) => (prev === 'preview' ? 'none' : 'preview'));
  }, []);

  const handleMaximizeEditor = useCallback(() => {
    setMaximizedPane((prev) => (prev === 'editor' ? 'none' : 'editor'));
  }, []);

  const handleResetSplit = useCallback(() => {
    setSplitRatio(50);
    setMaximizedPane('none');
  }, []);
  // Mobile sidebar drawer state (open/close)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Updated only from server acknowledgements
  const [saveStatus, setSaveStatus] = useState('idle');

  // Flag to avoid infinite loops: prevent remote updates from being emitted back
  const isRemoteChangeRef = useRef(false);

  // Handle permission error from server (e.g. viewer trying to emit code changes)
  const handlePermissionError = useCallback((err) => {
    showToast(err?.message || 'Permission denied: Viewers cannot edit or save code.', 'error');
  }, [showToast]);

  // Handle file operation error
  const handleFileError = useCallback((err) => {
    showToast(err?.error || err?.message || 'File operation failed.', 'error');
  }, [showToast]);

  // Remote code change callback
  const handleRemoteCodeChange = useCallback(({ fileName, content }) => {
    if (!fileName || typeof content !== 'string') return;

    isRemoteChangeRef.current = true;
    setFilesState((prev) => {
      if (prev[fileName]?.content === content) return prev;
      return {
        ...prev,
        [fileName]: {
          ...prev[fileName],
          content
        }
      };
    });
  }, []);

  // Room initial sync callback (when entering an active room session)
  const handleRoomSync = useCallback((syncData) => {
    if (!syncData || typeof syncData !== 'object') return;

    isRemoteChangeRef.current = true;
    const incomingFiles = syncData.files || syncData;
    const incomingFolders = Array.isArray(syncData.folders) ? syncData.folders : [];

    setFoldersState(incomingFolders);

    setFilesState((prev) => {
      const next = {};
      for (const [name, content] of Object.entries(incomingFiles)) {
        if (typeof content === 'string') {
          next[name] = {
            name,
            language: getLanguageFromFile(name),
            content
          };
        }
      }
      return next;
    });

    const fileNames = Object.keys(incomingFiles);
    if (fileNames.length > 0) {
      setActiveFile((current) => {
        if (current && fileNames.includes(current)) return current;
        return fileNames[0];
      });
      setOpenTabs((prevTabs) => {
        const valid = prevTabs.filter((t) => fileNames.includes(t));
        return valid.length > 0 ? valid : [fileNames[0]];
      });
    }
  }, []);

  // Real-time file & folder event callbacks from collaborators
  const handleFileCreated = useCallback(({ fileName, content }) => {
    if (!fileName) return;
    isRemoteChangeRef.current = true;
    setFilesState((prev) => ({
      ...prev,
      [fileName]: {
        name: fileName,
        language: getLanguageFromFile(fileName),
        content: content || ''
      }
    }));
  }, []);

  const handleFileRenamed = useCallback(({ oldPath, newPath }) => {
    if (!oldPath || !newPath) return;
    isRemoteChangeRef.current = true;
    setFilesState((prev) => {
      if (!prev[oldPath]) return prev;
      const next = { ...prev };
      next[newPath] = {
        ...next[oldPath],
        name: newPath,
        language: getLanguageFromFile(newPath)
      };
      delete next[oldPath];
      return next;
    });

    setOpenTabs((prev) => prev.map((t) => (t === oldPath ? newPath : t)));
    setActiveFile((current) => (current === oldPath ? newPath : current));
  }, []);

  const handleFileDeleted = useCallback(({ filePath }) => {
    if (!filePath) return;
    isRemoteChangeRef.current = true;
    setFilesState((prev) => {
      if (!prev[filePath]) return prev;
      const next = { ...prev };
      delete next[filePath];
      return next;
    });

    setOpenTabs((prevTabs) => {
      const remaining = prevTabs.filter((t) => t !== filePath);
      setActiveFile((current) => {
        if (current === filePath) {
          return remaining.length > 0 ? remaining[remaining.length - 1] : null;
        }
        return current;
      });
      return remaining;
    });
  }, []);

  const handleFolderCreated = useCallback(({ folderPath }) => {
    if (!folderPath) return;
    setFoldersState((prev) => (prev.includes(folderPath) ? prev : [...prev, folderPath]));
  }, []);

  const handleFolderRenamed = useCallback(({ oldFolder, newFolder, affectedFiles }) => {
    if (!oldFolder || !newFolder) return;
    isRemoteChangeRef.current = true;

    setFoldersState((prev) =>
      prev.map((f) => {
        if (f === oldFolder) return newFolder;
        if (f.startsWith(`${oldFolder}/`)) {
          return `${newFolder}/${f.slice(oldFolder.length + 1)}`;
        }
        return f;
      })
    );

    if (Array.isArray(affectedFiles)) {
      setFilesState((prev) => {
        const next = { ...prev };
        for (const { oldPath, newPath } of affectedFiles) {
          if (next[oldPath]) {
            next[newPath] = {
              ...next[oldPath],
              name: newPath,
              language: getLanguageFromFile(newPath)
            };
            delete next[oldPath];
          }
        }
        return next;
      });

      setOpenTabs((prevTabs) =>
        prevTabs.map((t) => {
          const match = affectedFiles.find((a) => a.oldPath === t);
          return match ? match.newPath : t;
        })
      );

      setActiveFile((current) => {
        const match = affectedFiles.find((a) => a.oldPath === current);
        return match ? match.newPath : current;
      });
    }
  }, []);

  const handleFolderDeleted = useCallback(({ folderPath, deletedFiles }) => {
    if (!folderPath) return;
    isRemoteChangeRef.current = true;

    setFoldersState((prev) =>
      prev.filter((f) => f !== folderPath && !f.startsWith(`${folderPath}/`))
    );

    const deletedList = Array.isArray(deletedFiles) ? deletedFiles : [];
    setFilesState((prev) => {
      const next = { ...prev };
      for (const f of deletedList) {
        delete next[f];
      }
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${folderPath}/`)) {
          delete next[key];
        }
      }
      return next;
    });

    setOpenTabs((prevTabs) => {
      const remaining = prevTabs.filter(
        (t) => !deletedList.includes(t) && !t.startsWith(`${folderPath}/`)
      );
      setActiveFile((current) => {
        if (deletedList.includes(current) || current?.startsWith(`${folderPath}/`)) {
          return remaining.length > 0 ? remaining[remaining.length - 1] : null;
        }
        return current;
      });
      return remaining;
    });
  }, []);

  const handleSaveStatus = useCallback(({ status }) => {
    if (status === 'saving' || status === 'saved' || status === 'error') {
      setSaveStatus(status);
    }
  }, []);

  // Initialize Socket.IO connection hook with live user identity & role
  const {
    connectionStatus,
    participantCount,
    activeUsers,
    role,
    remoteCursors,
    emitCodeChange,
    emitCursorChange,
    emitCursorClear,
    emitCreateFile,
    emitCreateFolder,
    emitRenameFile,
    emitRenameFolder,
    emitDeleteFile,
    emitDeleteFolder,
    emitMoveItem
  } = useSocket({
    roomId: activeRoomId,
    user: currentUser,
    onRemoteCodeChange: handleRemoteCodeChange,
    onRoomSync: handleRoomSync,
    onSaveStatus: handleSaveStatus,
    onPermissionError: handlePermissionError,
    onFileCreated: handleFileCreated,
    onFileRenamed: handleFileRenamed,
    onFileDeleted: handleFileDeleted,
    onFolderCreated: handleFolderCreated,
    onFolderRenamed: handleFolderRenamed,
    onFolderDeleted: handleFolderDeleted,
    onFileError: handleFileError,
    onProjectInfo: handleProjectInfo,
    onProjectRenamed: handleProjectRenamed
  });

  // Throttled cursor and selection activity broadcaster (~35ms throttle for smooth real-time rendering)
  const cursorThrottleTimerRef = useRef(null);
  const pendingCursorPayloadRef = useRef(null);

  const handleCursorActivity = useCallback(
    ({ cursor, selection }) => {
      if (!activeFile) return;

      pendingCursorPayloadRef.current = { cursor, selection };

      if (!cursorThrottleTimerRef.current) {
        // Emit immediately on first activity
        emitCursorChange(activeFile, cursor, selection);

        cursorThrottleTimerRef.current = setTimeout(() => {
          cursorThrottleTimerRef.current = null;
          if (pendingCursorPayloadRef.current) {
            emitCursorChange(
              activeFile,
              pendingCursorPayloadRef.current.cursor,
              pendingCursorPayloadRef.current.selection
            );
            pendingCursorPayloadRef.current = null;
          }
        }, 35);
      }
    },
    [activeFile, emitCursorChange]
  );

  // Effective role in project workspace
  const effectiveRole = role || currentProject?.role || matchedInContext?.role || 'editor';
  const isViewer = effectiveRole === 'viewer';

  // Switch active room by navigating to the new route
  const handleChangeRoom = (newRoom) => {
    const trimmed = newRoom ? newRoom.trim() : '';
    if (!trimmed || trimmed === activeRoomId) return;
    emitCursorClear();
    navigate(`/projects/${encodeURIComponent(trimmed)}`);
    showToast(`Switched to room "${trimmed}"`, 'info');
  };

  // Rename project or room (owner/editor)
  const handleRenameProject = async ({ newName, newRoomId }) => {
    if (isViewer) {
      showToast('You have view-only access. Renaming is restricted to project owners.', 'error');
      return;
    }

    try {
      const targetId = currentProject?.id || matchedInContext?.id;
      if (targetId) {
        const updated = await renameProject(targetId, {
          name: newName || projectName,
          roomId: newRoomId || activeRoomId
        });
        setCurrentProject(updated);
        const targetSlug = updated.room_id || updated.name;
        navigate(`/projects/${encodeURIComponent(targetSlug)}`, { replace: true });
        showToast(`Project updated to "${updated.name}" (#${updated.room_id})`, 'success');
      } else {
        // Ad-hoc room switch
        handleChangeRoom(newRoomId || newName);
      }
    } catch (err) {
      showToast(err.message || 'Failed to rename project.', 'error');
    }
  };

  // Switch active file from sidebar or tabs
  const handleSelectFile = (fileName) => {
    if (fileName !== activeFile) {
      if (cursorThrottleTimerRef.current) {
        clearTimeout(cursorThrottleTimerRef.current);
        cursorThrottleTimerRef.current = null;
      }
      pendingCursorPayloadRef.current = null;
      emitCursorClear();
    }

    if (!openTabs.includes(fileName)) {
      setOpenTabs((prev) => [...prev, fileName]);
    }
    setActiveFile(fileName);
    setIsSidebarOpen(false);
  };

  // Close an open tab
  const handleCloseTab = (fileName) => {
    const updatedTabs = openTabs.filter((tab) => tab !== fileName);
    setOpenTabs(updatedTabs);

    if (activeFile === fileName) {
      if (cursorThrottleTimerRef.current) {
        clearTimeout(cursorThrottleTimerRef.current);
        cursorThrottleTimerRef.current = null;
      }
      pendingCursorPayloadRef.current = null;
      emitCursorClear();

      if (updatedTabs.length > 0) {
        setActiveFile(updatedTabs[updatedTabs.length - 1]);
      } else {
        setActiveFile(null);
      }
    }
  };

  // Handle local code edits inside Monaco
  const handleEditorChange = (newContent) => {
    if (!activeFile) return;
    const cleanContent = newContent ?? '';

    if (isViewer) {
      showToast('You have view-only access. Code editing is disabled.', 'error');
      return;
    }

    if (isRemoteChangeRef.current) {
      isRemoteChangeRef.current = false;
      return;
    }

    setFilesState((prev) => ({
      ...prev,
      [activeFile]: {
        ...prev[activeFile],
        content: cleanContent
      }
    }));

    emitCodeChange(activeFile, cleanContent);
  };

  // Action handlers
  const handleRun = () => {
    setIsPreviewOpen(true);
    if (maximizedPane === 'editor') {
      setMaximizedPane('none');
    }
    setRunTrigger((prev) => prev + 1);
    if (isViewer) {
      showToast('Running project in isolated Live Preview (Viewer mode)', 'info');
    } else {
      showToast('Running project in Live Preview split panel', 'success');
    }
  };

  // Toggle Live Preview split panel from TabBar
  const handleTogglePreview = () => {
    setIsPreviewOpen((prev) => {
      const next = !prev;
      if (next && maximizedPane === 'editor') {
        setMaximizedPane('none');
      }
      return next;
    });
    setRunTrigger((prev) => prev + 1);
  };

  const handleLogout = async () => {
    emitCursorClear();
    await logout();
    navigate('/login', { replace: true });
  };

  // Handle restoring a file from Version History
  const handleVersionRestored = useCallback(
    (fileName, newContent) => {
      isRemoteChangeRef.current = true;
      setFilesState((prev) => ({
        ...prev,
        [fileName]: {
          ...prev[fileName],
          content: newContent
        }
      }));
      showToast(`Restored "${fileName}" to previous version.`, 'success');
    },
    [showToast]
  );

  // Virtual file & folder actions
  const handleCreateFile = useCallback((path, content) => {
    emitCreateFile(path, content);
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    showToast(`Creating "${path}"...`, 'info');
  }, [emitCreateFile, showToast]);

  const handleCreateFolder = useCallback((path) => {
    emitCreateFolder(path);
    showToast(`Creating folder "${path}"...`, 'info');
  }, [emitCreateFolder, showToast]);

  const handleRenameFile = useCallback((oldPath, newPath) => {
    emitRenameFile(oldPath, newPath);
  }, [emitRenameFile]);

  const handleRenameFolder = useCallback((oldFolder, newFolder) => {
    emitRenameFolder(oldFolder, newFolder);
  }, [emitRenameFolder]);

  const handleDeleteFile = useCallback((path) => {
    emitDeleteFile(path);
  }, [emitDeleteFile]);

  const handleDeleteFolder = useCallback((path) => {
    emitDeleteFolder(path);
  }, [emitDeleteFolder]);

  const handleMoveItem = useCallback((itemType, oldPath, targetParentFolder) => {
    emitMoveItem(itemType, oldPath, targetParentFolder);
  }, [emitMoveItem]);

  const currentFileObj = activeFile ? filesState[activeFile] : null;
  const currentLanguage = activeFile ? getLanguageFromFile(activeFile) : 'plaintext';
  const fileList = Object.values(filesState);

  if (projectNotFound && !isProjectLoading && roomId !== 'demo-room') {
    return (
      <div className="workspace-not-found-container">
        <div className="workspace-not-found-card">
          <div className="not-found-icon">
            <FolderCode size={36} />
          </div>
          <h2>Project Not Found</h2>
          <p>
            We couldn't locate a project matching <code>{roomId}</code>. It may have been renamed, deleted, or you may need an invitation.
          </p>
          <div className="not-found-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/projects')}
            >
              <ArrowLeft size={16} />
              <span>Back to Projects Dashboard</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/projects/demo-room')}
            >
              <span>Open Demo Sandbox</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        projectName={projectName}
        roomId={activeRoomId}
        onChangeRoom={handleChangeRoom}
        onRenameProject={handleRenameProject}
        connectionStatus={connectionStatus}
        participantCount={participantCount}
        currentUser={currentUser}
        activeUsers={activeUsers}
        userRole={effectiveRole}
        onRun={handleRun}
        isPreviewOpen={isPreviewOpen}
        onShare={() => setIsCollaboratorsOpen(true)}
        onOpenCollaborators={() => setIsCollaboratorsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        isRightPanelOpen={isRightPanelOpen}
        toggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isAuthenticated={true}
        onOpenProjects={() => navigate('/projects')}
        onLogout={handleLogout}
      />

      {/* Main Workspace */}
      <div className="workspace">
        {/* Left Explorer Sidebar (Drawer on mobile) */}
        <Sidebar
          files={fileList}
          folders={foldersState}
          activeFile={activeFile}
          onSelectFile={handleSelectFile}
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
          onRenameFile={handleRenameFile}
          onRenameFolder={handleRenameFolder}
          onDeleteFile={handleDeleteFile}
          onDeleteFolder={handleDeleteFolder}
          onMoveItem={handleMoveItem}
          userRole={effectiveRole}
          projectName={projectName}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Center Code Editor Area */}
        <main className="editor-workspace">
          {/* Read-Only Notice Banner for Viewers */}
          {isViewer && (
            <div className="view-only-banner">
              <Eye size={14} className="banner-icon" />
              <span>
                <strong>View-Only Mode:</strong> You can view all files in real time. Code editing and cloud saving are restricted to editors and the owner.
              </span>
            </div>
          )}

          {openTabs.length > 0 && (
            <TabBar
              openTabs={openTabs}
              activeTab={activeFile}
              onSelectTab={handleSelectFile}
              onCloseTab={handleCloseTab}
              onOpenHistory={() => setIsHistoryOpen(true)}
              onTogglePreview={handleTogglePreview}
              isPreviewOpen={isPreviewOpen}
            />
          )}

          {/* Mobile/Tablet Workspace View Switcher (when Preview is open on small screens) */}
          {isPreviewOpen && isMobileWorkspace && (
            <div className="mobile-workspace-switcher" role="tablist" aria-label="Workspace View Mode">
              <button
                type="button"
                className={`mobile-view-btn ${mobileWorkspaceView === 'editor' ? 'active' : ''}`}
                onClick={() => {
                  setMobileWorkspaceView('editor');
                  setMaximizedPane('editor');
                }}
              >
                <Code2 size={13} />
                <span>Code</span>
              </button>
              <button
                type="button"
                className={`mobile-view-btn ${mobileWorkspaceView === 'split' ? 'active' : ''}`}
                onClick={() => {
                  setMobileWorkspaceView('split');
                  setMaximizedPane('none');
                }}
              >
                <Columns size={13} />
                <span>Split</span>
              </button>
              <button
                type="button"
                className={`mobile-view-btn ${mobileWorkspaceView === 'preview' ? 'active' : ''}`}
                onClick={() => {
                  setMobileWorkspaceView('preview');
                  setMaximizedPane('preview');
                }}
              >
                <Play size={13} fill="currentColor" />
                <span>Preview</span>
              </button>
            </div>
          )}

          <div
            ref={workspaceRowRef}
            className={`workspace-editor-row ${isDraggingSplit ? 'is-dragging' : ''} ${
              isPreviewOpen ? 'has-preview-open' : ''
            } ${maximizedPane !== 'none' ? `maximized-${maximizedPane}` : ''} ${
              isMobileWorkspace && mobileWorkspaceView === 'split' ? 'mobile-split-vertical' : ''
            }`}
          >
            {/* Left Monaco Code Editor Pane */}
            <div
              className={`editor-pane ${
                isPreviewOpen && maximizedPane === 'preview' ? 'pane-collapsed pane-hidden' : ''
              }`}
              style={{
                width: isPreviewOpen
                  ? isMobileWorkspace && mobileWorkspaceView === 'split'
                    ? '100%'
                    : maximizedPane === 'editor'
                    ? '100%'
                    : maximizedPane === 'preview'
                    ? '0%'
                    : `${splitRatio}%`
                  : '100%',
                height:
                  isPreviewOpen && isMobileWorkspace && mobileWorkspaceView === 'split'
                    ? `${splitRatio}%`
                    : '100%',
                flex: isPreviewOpen ? 'none' : '1'
              }}
            >
              {activeFile && currentFileObj ? (
                <EditorArea
                  content={currentFileObj.content}
                  language={currentLanguage}
                  onChange={handleEditorChange}
                  onCursorChange={setCursor}
                  onCursorActivity={handleCursorActivity}
                  layoutTrigger={
                    isSidebarOpen ||
                    isRightPanelOpen ||
                    isPreviewOpen ||
                    maximizedPane !== 'none' ||
                    splitRatio ||
                    isDraggingSplit ||
                    mobileWorkspaceView
                  }
                  readOnly={isViewer}
                  activeFile={activeFile}
                  remoteCursors={remoteCursors}
                />
              ) : (
                <div className="no-editor-state">
                  <div className="no-editor-content">
                    <p>No open file</p>
                    <span>Select a file from the Explorer on the left to start editing</span>
                  </div>
                </div>
              )}
            </div>

            {/* Draggable Divider with Arrow Controls */}
            {isPreviewOpen && (
              <WorkspaceSplitDivider
                containerRef={workspaceRowRef}
                splitRatio={splitRatio}
                onSplitChange={setSplitRatio}
                maximizedPane={maximizedPane}
                onMaximizeEditor={handleMaximizeEditor}
                onMaximizePreview={handleToggleMaximizePreview}
                onResetSplit={handleResetSplit}
                isVertical={Boolean(isMobileWorkspace && mobileWorkspaceView === 'split')}
                onDragStart={() => setIsDraggingSplit(true)}
                onDragEnd={() => setIsDraggingSplit(false)}
              />
            )}

            {/* Right Live Preview Sandbox Pane */}
            {isPreviewOpen && (
              <LivePreview
                isOpen={isPreviewOpen}
                onClose={() => {
                  setIsPreviewOpen(false);
                  setMaximizedPane('none');
                }}
                files={filesState}
                activeFile={activeFile}
                projectName={projectName}
                roomId={activeRoomId}
                userRole={effectiveRole}
                isMaximized={maximizedPane === 'preview'}
                onToggleMaximize={handleToggleMaximizePreview}
                runTrigger={runTrigger}
                style={{
                  width:
                    isMobileWorkspace && mobileWorkspaceView === 'split'
                      ? '100%'
                      : maximizedPane === 'preview'
                      ? '100%'
                      : maximizedPane === 'editor'
                      ? '0%'
                      : `${100 - splitRatio}%`,
                  height:
                    isMobileWorkspace && mobileWorkspaceView === 'split'
                      ? `${100 - splitRatio}%`
                      : '100%',
                  display: maximizedPane === 'editor' ? 'none' : 'flex',
                  flex: 'none'
                }}
              />
            )}
          </div>
        </main>

        {/* Right Collaborators Panel */}
        <CollaboratorsPanel
          isOpen={isRightPanelOpen}
          onClose={() => setIsRightPanelOpen(false)}
          roomId={activeRoomId}
          currentUser={currentUser}
          activeUsers={activeUsers}
          currentActiveFile={activeFile}
        />
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        language={currentLanguage}
        cursor={cursor}
        encoding="UTF-8"
        connectionStatus={connectionStatus}
        roomId={activeRoomId}
        saveStatus={saveStatus}
        userRole={effectiveRole}
      />

      {/* Collaborators & Access Management Modal */}
      <CollaboratorsModal
        isOpen={isCollaboratorsOpen}
        onClose={() => setIsCollaboratorsOpen(false)}
        projectId={currentProject?.id || matchedInContext?.id || activeRoomId}
        projectName={projectName}
        userRole={effectiveRole}
        currentUserId={currentUser?.id}
        onShowToast={showToast}
      />

      {/* Per-File Version History & Restore Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        roomId={activeRoomId}
        fileName={activeFile || 'main.js'}
        userRole={effectiveRole}
        onRestore={handleVersionRestored}
        onShowToast={showToast}
      />

      {/* Feedback Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
