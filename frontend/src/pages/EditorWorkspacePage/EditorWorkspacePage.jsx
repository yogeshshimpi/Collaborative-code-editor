import './EditorWorkspacePage.css';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye, FolderCode, ArrowLeft, Code2, Columns, Play, GitPullRequest, Lock, RotateCcw, Trash2, X } from 'lucide-react';
import Navbar from '../../components/Navbar/Navbar';
import Sidebar from '../../components/Sidebar/Sidebar';
import TabBar from '../../components/TabBar/TabBar';
import EditorArea from '../../components/EditorArea/EditorArea';
import StatusBar from '../../components/StatusBar/StatusBar';
import CollaboratorsPanel from '../../components/CollaboratorsPanel/CollaboratorsPanel';
import CollaboratorsModal from '../../components/CollaboratorsModal/CollaboratorsModal';
import VersionHistoryModal from '../../components/VersionHistoryModal/VersionHistoryModal';
import ActivityLogModal from '../../components/ActivityLogModal/ActivityLogModal';
import ChangeRequestsModal from '../../components/ChangeRequestsModal/ChangeRequestsModal';
import LivePreview from '../../components/LivePreview/LivePreview';
import WorkspaceSplitDivider from '../../components/WorkspaceSplitDivider/WorkspaceSplitDivider';
import Toast from '../../components/Toast/Toast';
import { useAuth } from '../../context/useAuth';
import { api } from '../../services/api';
import { INITIAL_FILES, getLanguageFromFile } from '../../data/initialFiles';
import { useSocket } from '../../hooks/useSocket';

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
  const [projectRequiresApproval, setProjectRequiresApproval] = useState(
    Boolean(matchedInContext?.requires_approval)
  );
  const [protectedFiles, setProtectedFiles] = useState(
    Array.isArray(matchedInContext?.protected_files) ? matchedInContext.protected_files : []
  );
  const [undoDeleteInfo, setUndoDeleteInfo] = useState(null);
  const undoTimerRef = useRef(null);
  const [isChangeRequestsOpen, setIsChangeRequestsOpen] = useState(false);
  const [changeRequestsInitialCreate, setChangeRequestsInitialCreate] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [isProjectLoading, setIsProjectLoading] = useState(!matchedInContext && roomId !== 'demo-room');
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [toast, setToast] = useState(null);

  // Sync approval mode and protected files when project state changes
  useEffect(() => {
    if (currentProject?.requires_approval !== undefined) {
      setProjectRequiresApproval(Boolean(currentProject.requires_approval));
    }
    if (Array.isArray(currentProject?.protected_files)) {
      setProtectedFiles(currentProject.protected_files);
    }
  }, [currentProject?.requires_approval, currentProject?.protected_files]);

  // Load pending change requests counter
  useEffect(() => {
    const projId = currentProject?.id || matchedInContext?.id || roomId;
    if (!projId || projId === 'demo-room') return;
    api.getChangeRequests(projId, 'pending')
      .then((data) => {
        if (Array.isArray(data?.changeRequests)) {
          setPendingRequestsCount(data.changeRequests.length);
        }
      })
      .catch(() => {});
  }, [currentProject?.id, matchedInContext?.id, roomId]);

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
          if (res.project.requires_approval !== undefined) {
            setProjectRequiresApproval(Boolean(res.project.requires_approval));
          }
          if (Array.isArray(res.project.protected_files)) {
            setProtectedFiles(res.project.protected_files);
          }
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
      if (info.requires_approval !== undefined) {
        setProjectRequiresApproval(Boolean(info.requires_approval));
      }
      if (Array.isArray(info.protected_files)) {
        setProtectedFiles(info.protected_files);
      }
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
  // Project Activity Log Modal
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [liveActivityEntry, setLiveActivityEntry] = useState(null);
  // Live Preview Sandbox & Split Pane Workspace state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewActiveTab, setPreviewActiveTab] = useState('preview');
  const [splitRatio, setSplitRatio] = useState(50); // percentage: 15% to 85%, default 50%
  const [maximizedPane, setMaximizedPane] = useState('none'); // 'none' | 'editor' | 'preview'
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState('split'); // 'editor' | 'split' | 'preview'
  const [runTrigger, setRunTrigger] = useState(0);

  // Stable key for per-file execution UI state: projectId + filePath
  const getFileExecKey = useCallback((projId, filePath) => {
    const safeProj = projId || 'default';
    return `${safeProj}:${filePath || ''}`;
  }, []);

  // Per-file Execution UI state dictionary: { [fileKey]: { stdin, stdout, stderr, compileOutput, status, exitCode, executionTime, executionTimeMs, selectedLanguage, lastRunTimestamp } }
  const [fileExecutionMap, setFileExecutionMap] = useState(() => {
    try {
      const saved = localStorage.getItem('codecollab_file_executions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Sandboxed Code Execution State (active file projection)
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStdin, setExecutionStdin] = useState('');
  const executionStdinRef = useRef(executionStdin);
  executionStdinRef.current = executionStdin;

  // Synchronize execution result and stdin when switching activeFile
  const prevActiveFileRef = useRef(activeFile);
  useEffect(() => {
    const prevFile = prevActiveFileRef.current;
    const currentProjId = currentProject?.id || matchedInContext?.id || activeRoomId || 'default';

    // If changing files, save current stdin into prevFile's execution map entry
    if (prevFile && prevFile !== activeFile) {
      const prevKey = getFileExecKey(currentProjId, prevFile);
      setFileExecutionMap((prev) => {
        const existing = prev[prevKey] || {};
        const updated = {
          ...prev,
          [prevKey]: {
            ...existing,
            stdin: executionStdinRef.current
          }
        };
        try {
          localStorage.setItem('codecollab_file_executions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }

    // Now restore target file's execution state
    if (activeFile) {
      const nextKey = getFileExecKey(currentProjId, activeFile);
      const targetState = fileExecutionMap[nextKey];
      if (targetState) {
        setExecutionStdin(targetState.stdin || '');
        if (targetState.status || targetState.stdout || targetState.stderr || targetState.compileOutput) {
          setExecutionResult({
            success: targetState.status === 'Accepted',
            status: targetState.status || 'Finished',
            stdout: targetState.stdout || '',
            stderr: targetState.stderr || '',
            compileOutput: targetState.compileOutput || '',
            exitCode: targetState.exitCode ?? null,
            executionTime: targetState.executionTime ?? targetState.executionTimeMs ?? null,
            executionTimeMs: targetState.executionTimeMs ?? targetState.executionTime ?? null,
            language: targetState.selectedLanguage || getLanguageFromFile(activeFile),
            selectedLanguage: targetState.selectedLanguage || getLanguageFromFile(activeFile),
            lastRunTimestamp: targetState.lastRunTimestamp || null
          });
        } else {
          setExecutionResult(null);
        }
      } else {
        setExecutionStdin('');
        setExecutionResult(null);
      }
    } else {
      setExecutionStdin('');
      setExecutionResult(null);
    }

    prevActiveFileRef.current = activeFile;
  }, [activeFile, currentProject?.id, matchedInContext?.id, activeRoomId, getFileExecKey]);

  const [isMobileWorkspace, setIsMobileWorkspace] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024
  );
  const workspaceRowRef = useRef(null);
  const editorRef = useRef(null);

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
    onProjectRenamed: handleProjectRenamed,
    onActivityLogEntry: (entry) => {
      setLiveActivityEntry(entry);
    },
    onProtectedFilesUpdated: ({ protectedFiles: nextProtected }) => {
      const list = Array.isArray(nextProtected) ? nextProtected : [];
      setProtectedFiles(list);
      setCurrentProject((prev) => (prev ? { ...prev, protected_files: list } : prev));
      showToast('Protected files list updated by project owner.', 'info');
    },
    onActivityNotification: (notif) => {
      if (notif?.userName && notif.userName !== currentUser?.name) {
        const actionMap = {
          file_create: 'created file',
          folder_create: 'created folder',
          file_rename: 'renamed file',
          folder_rename: 'renamed folder',
          file_delete: 'deleted file',
          folder_delete: 'deleted folder',
          file_move: 'moved item',
          version_restore: 'restored version on',
          review_requested: 'requested code review for'
        };
        const verb = actionMap[notif.action] || notif.action;
        showToast(`${notif.userName} ${verb} "${notif.targetName || ''}"`, 'info');
      }
    },
    onApprovalModeUpdated: ({ requiresApproval }) => {
      setProjectRequiresApproval(Boolean(requiresApproval));
      setCurrentProject((prev) => (prev ? { ...prev, requires_approval: Boolean(requiresApproval) } : prev));
      showToast(
        requiresApproval
          ? 'Strict review mode enabled: Editor code changes require owner approval.'
          : 'Strict review mode disabled: Direct editing is active.',
        'info'
      );
    },
    onChangeRequestCreated: ({ changeRequest }) => {
      setPendingRequestsCount((prev) => prev + 1);
      showToast(`New change request submitted: "${changeRequest?.title || 'Untitled'}"`, 'info');
    },
    onChangeRequestApproved: ({ changeRequest, appliedResult }) => {
      setPendingRequestsCount((prev) => Math.max(0, prev - 1));
      showToast(`Change request "${changeRequest?.title || 'Untitled'}" was approved and applied!`, 'success');
      if ((appliedResult?.type === 'code_change' || appliedResult?.type === 'version_restore') && appliedResult?.filePath) {
        setFilesState((prev) => ({
          ...prev,
          [appliedResult.filePath]: {
            ...prev[appliedResult.filePath],
            content: appliedResult.content
          }
        }));
      } else if (appliedResult?.type === 'file_create' && appliedResult?.filePath) {
        setFilesState((prev) => ({
          ...prev,
          [appliedResult.filePath]: {
            name: appliedResult.filePath,
            content: appliedResult.content || '',
            language: getLanguageFromFile(appliedResult.filePath)
          }
        }));
      } else if (appliedResult?.type === 'file_delete' && appliedResult?.filePath) {
        setFilesState((prev) => {
          const next = { ...prev };
          delete next[appliedResult.filePath];
          return next;
        });
      }
    },
    onChangeRequestRejected: ({ changeRequest }) => {
      setPendingRequestsCount((prev) => Math.max(0, prev - 1));
      showToast(`Change request "${changeRequest?.title || 'Untitled'}" was rejected.`, 'info');
    },
    onApprovalRequired: ({ message }) => {
      showToast(
        message || 'Approval Mode is active. Direct edits require owner approval.',
        'warning'
      );
    }
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
  const isOwner = Boolean(
    role === 'owner' ||
    (user?.id && (currentProject?.owner_id === user.id || matchedInContext?.owner_id === user.id)) ||
    currentProject?.role === 'owner' ||
    matchedInContext?.role === 'owner'
  );
  const effectiveRole = isOwner ? 'owner' : (role || currentProject?.role || matchedInContext?.role || 'editor');
  const isViewer = effectiveRole === 'viewer';
  const isProtectedActiveFile = Boolean(activeFile && protectedFiles.includes(activeFile));
  const isEditorRestricted = isProtectedActiveFile && !isOwner;

  // Undo and Redo actions for TabBar and coding controls
  const handleUndo = useCallback(() => {
    if (editorRef.current && !isViewer) {
      editorRef.current.trigger('tab-bar', 'undo');
      editorRef.current.focus();
    }
  }, [isViewer]);

  const handleRedo = useCallback(() => {
    if (editorRef.current && !isViewer) {
      editorRef.current.trigger('tab-bar', 'redo');
      editorRef.current.focus();
    }
  }, [isViewer]);

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

  // Toggle project approval mode (Owner only)
  const handleToggleApprovalMode = async (nextValue) => {
    const targetId = currentProject?.id || matchedInContext?.id || activeRoomId;
    await api.toggleProjectApprovalMode(targetId, nextValue);
    setProjectRequiresApproval(nextValue);
    setCurrentProject((prev) => (prev ? { ...prev, requires_approval: nextValue } : prev));
  };

  // Toggle protected file (Owner only)
  const handleToggleProtectFile = useCallback(async (filePath) => {
    if (!isOwner) {
      showToast('Only the project owner can change file protection status.', 'error');
      return;
    }
    const targetId = currentProject?.id || matchedInContext?.id || activeRoomId;
    const isCurrentlyProtected = protectedFiles.includes(filePath);
    const nextList = isCurrentlyProtected
      ? protectedFiles.filter((p) => p !== filePath)
      : [...protectedFiles, filePath];

    try {
      await api.updateProtectedFiles(targetId, nextList);
      setProtectedFiles(nextList);
      setCurrentProject((prev) => (prev ? { ...prev, protected_files: nextList } : prev));
      showToast(
        isCurrentlyProtected
          ? `Unprotected "${filePath}". Editors can now modify it.`
          : `Protected "${filePath}". Editors cannot edit, rename, or delete it.`,
        'success'
      );
    } catch (err) {
      showToast(err.message || 'Failed to update file protection.', 'error');
    }
  }, [isOwner, currentProject?.id, matchedInContext?.id, activeRoomId, protectedFiles, showToast]);

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

  // Handlers for Per-File Stdin & Execution
  const handleStdinChange = useCallback((newStdin) => {
    setExecutionStdin(newStdin);
    if (!activeFile) return;
    const currentProjId = currentProject?.id || matchedInContext?.id || activeRoomId || 'default';
    const fileKey = getFileExecKey(currentProjId, activeFile);
    setFileExecutionMap((prev) => {
      const existing = prev[fileKey] || {};
      const updated = {
        ...prev,
        [fileKey]: {
          ...existing,
          stdin: newStdin
        }
      };
      try {
        localStorage.setItem('codecollab_file_executions', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [activeFile, currentProject?.id, matchedInContext?.id, activeRoomId, getFileExecKey]);

  // Action handlers
  const handleExecuteCode = useCallback(async (customStdin) => {
    if (!activeFile) {
      showToast('Please select a file to execute', 'warning');
      return;
    }

    const lang = getLanguageFromFile(activeFile);
    const supportedLangs = ['javascript', 'python', 'java', 'cpp', 'c'];
    if (!supportedLangs.includes(lang)) {
      showToast(`Direct execution is not supported for "${activeFile}".`, 'info');
      return;
    }

    const code = filesState[activeFile]?.content || '';
    if (!code.trim()) {
      showToast('File is empty, nothing to run.', 'warning');
      return;
    }

    setIsExecuting(true);
    setIsPreviewOpen(true);
    setPreviewActiveTab('terminal');
    if (maximizedPane === 'editor') {
      setMaximizedPane('none');
    }

    const projId = currentProject?.id || matchedInContext?.id || activeRoomId;
    const currentProjId = projId || 'default';
    const fileKey = getFileExecKey(currentProjId, activeFile);
    const stdinToPass = customStdin !== undefined ? customStdin : executionStdin;
    const timestamp = Date.now();

    try {
      const res = await api.executeCode({
        projectId: projId,
        language: lang,
        fileName: activeFile,
        code,
        stdin: stdinToPass
      });

      const executionData = res?.result || res;
      if (executionData && typeof executionData === 'object') {
        const fileStateObj = {
          stdin: stdinToPass,
          stdout: executionData.stdout || '',
          stderr: executionData.stderr || '',
          compileOutput: executionData.compileOutput || '',
          status: executionData.status || 'Finished',
          exitCode: executionData.exitCode ?? null,
          executionTime: executionData.executionTimeMs ?? null,
          executionTimeMs: executionData.executionTimeMs ?? null,
          selectedLanguage: executionData.language || lang,
          lastRunTimestamp: timestamp
        };

        const resultObj = {
          ...executionData,
          ...fileStateObj,
          success: executionData.status === 'Accepted'
        };

        setExecutionResult(resultObj);
        setFileExecutionMap((prev) => {
          const updated = {
            ...prev,
            [fileKey]: fileStateObj
          };
          try {
            localStorage.setItem('codecollab_file_executions', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        if (executionData.status === 'Accepted') {
          showToast(`Execution finished (${executionData.executionTimeMs}ms)`, 'success');
        } else if (executionData.compileOutput) {
          showToast(`Compilation error in ${activeFile}`, 'error');
        } else if (executionData.status === 'Time Limit Exceeded') {
          showToast('Execution timed out (> 10s)', 'warning');
        } else if (executionData.stderr) {
          showToast(`Runtime error in ${activeFile}`, 'warning');
        } else {
          showToast(`Execution finished: ${executionData.status || 'OK'}`, 'info');
        }
      } else {
        throw new Error(res?.error || 'Invalid execution response');
      }
    } catch (err) {
      console.error('Code execution failed:', err);
      const errMsg = err.response?.data?.error || err.message || 'Execution error';
      const fileErrState = {
        stdin: stdinToPass,
        stdout: '',
        stderr: errMsg,
        compileOutput: '',
        status: 'Error',
        exitCode: 1,
        executionTime: 0,
        executionTimeMs: 0,
        selectedLanguage: lang,
        lastRunTimestamp: timestamp
      };

      const errResult = {
        success: false,
        status: 'Error',
        statusDescription: errMsg,
        stderr: errMsg,
        stdout: '',
        compileOutput: '',
        exitCode: 1,
        executionTimeMs: 0,
        executionTime: 0,
        language: lang,
        selectedLanguage: lang,
        provider: 'sandbox',
        lastRunTimestamp: timestamp
      };

      setExecutionResult(errResult);
      setFileExecutionMap((prev) => {
        const updated = {
          ...prev,
          [fileKey]: fileErrState
        };
        try {
          localStorage.setItem('codecollab_file_executions', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      showToast(`Execution failed: ${errMsg}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  }, [
    activeFile,
    filesState,
    currentProject,
    matchedInContext,
    activeRoomId,
    executionStdin,
    maximizedPane,
    getFileExecKey,
    showToast
  ]);

  const handleClearExecution = useCallback(() => {
    setExecutionResult(null);
    if (!activeFile) return;
    const currentProjId = currentProject?.id || matchedInContext?.id || activeRoomId || 'default';
    const fileKey = getFileExecKey(currentProjId, activeFile);
    setFileExecutionMap((prev) => {
      const existing = prev[fileKey] || {};
      const updated = {
        ...prev,
        [fileKey]: {
          ...existing,
          stdout: '',
          stderr: '',
          compileOutput: '',
          status: '',
          exitCode: null,
          executionTime: null,
          executionTimeMs: null,
          lastRunTimestamp: null
        }
      };
      try {
        localStorage.setItem('codecollab_file_executions', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [activeFile, currentProject?.id, matchedInContext?.id, activeRoomId, getFileExecKey]);

  // Editor Find action (Ctrl+F)
  const handleFind = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus();
      const findAction = editorRef.current.getAction('actions.find');
      if (findAction) {
        findAction.run();
      }
    }
  }, []);

  // Editor Replace action (Ctrl+H)
  const handleReplace = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus();
      const replaceAction = editorRef.current.getAction('editor.action.startFindReplaceAction');
      if (replaceAction) {
        replaceAction.run();
      }
    }
  }, []);

  // Editor Format Document action (Shift+Alt+F)
  const handleFormatDocument = useCallback(async () => {
    if (!editorRef.current) return;
    if (isViewer || isEditorRestricted) {
      showToast('Cannot format: file is read-only', 'warning');
      return;
    }
    const formatAction = editorRef.current.getAction('editor.action.formatDocument');
    if (formatAction) {
      try {
        await formatAction.run();
        showToast('Document formatted', 'success');
      } catch (err) {
        console.warn('Formatting failed:', err);
        showToast('Could not format document', 'info');
      }
    } else {
      showToast(`No formatter available for ${activeFile || 'file'}`, 'info');
    }
  }, [isViewer, isEditorRestricted, activeFile, showToast]);

  const handleRun = useCallback(() => {
    if (maximizedPane === 'editor') {
      setMaximizedPane('none');
    }

    const fileLang = activeFile ? getLanguageFromFile(activeFile) : null;
    const isBackendLang = fileLang && ['python', 'java', 'cpp', 'c'].includes(fileLang);
    const isJsInTerminal = fileLang === 'javascript' && previewActiveTab === 'terminal';

    if (isBackendLang || isJsInTerminal) {
      handleExecuteCode();
    } else {
      setIsPreviewOpen(true);
      setPreviewActiveTab('preview');
      setRunTrigger((prev) => prev + 1);
      if (isViewer) {
        showToast('Running project in isolated Live Preview (Viewer mode)', 'info');
      } else {
        showToast('Running project in Live Preview split panel', 'success');
      }
    }
  }, [maximizedPane, activeFile, previewActiveTab, handleExecuteCode, isViewer, showToast]);

  const handleOpenConsole = useCallback(() => {
    setIsPreviewOpen(true);
    setPreviewActiveTab('console');
    if (maximizedPane === 'editor') {
      setMaximizedPane('none');
    }
    showToast('Switched to Virtual Console output', 'info');
  }, [maximizedPane, showToast]);

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

  // Virtual file & folder actions - Immediate for Owner and Editor without approval
  const handleCreateFile = useCallback((path, content) => {
    if (isViewer) {
      showToast('View-only access: creating files is disabled.', 'error');
      return;
    }
    emitCreateFile(path, content);
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
    showToast(`Creating "${path}"...`, 'info');
  }, [emitCreateFile, showToast, isViewer]);

  const handleCreateFolder = useCallback((path) => {
    if (isViewer) {
      showToast('View-only access: creating folders is disabled.', 'error');
      return;
    }
    emitCreateFolder(path);
    showToast(`Creating folder "${path}"...`, 'info');
  }, [emitCreateFolder, showToast, isViewer]);

  const handleRenameFile = useCallback((oldPath, newPath) => {
    if (isViewer) {
      showToast('View-only access: renaming files is disabled.', 'error');
      return;
    }
    if (!isOwner && protectedFiles.includes(oldPath)) {
      showToast(`File "${oldPath}" is protected by the project owner and cannot be renamed.`, 'error');
      return;
    }
    emitRenameFile(oldPath, newPath);
  }, [emitRenameFile, isViewer, isOwner, protectedFiles, showToast]);

  const handleRenameFolder = useCallback((oldFolder, newFolder) => {
    if (isViewer) {
      showToast('View-only access: renaming folders is disabled.', 'error');
      return;
    }
    if (!isOwner && protectedFiles.some((pf) => pf === oldFolder || pf.startsWith(`${oldFolder}/`))) {
      showToast(`Folder "${oldFolder}" contains protected files and cannot be renamed by editors.`, 'error');
      return;
    }
    emitRenameFolder(oldFolder, newFolder);
  }, [emitRenameFolder, isViewer, isOwner, protectedFiles, showToast]);

  // Safe delete experience: applies immediately with 10-second Undo toast
  const handleDeleteFile = useCallback((path) => {
    if (isViewer) {
      showToast('View-only access: deleting files is disabled.', 'error');
      return;
    }
    if (!isOwner && protectedFiles.includes(path)) {
      showToast(`File "${path}" is protected by the project owner and cannot be deleted.`, 'error');
      return;
    }

    const currentContent = filesState[path]?.content || '';
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    setUndoDeleteInfo({
      type: 'file',
      path,
      content: currentContent,
      timestamp: Date.now()
    });

    undoTimerRef.current = setTimeout(() => {
      setUndoDeleteInfo(null);
    }, 10000);

    emitDeleteFile(path);
  }, [emitDeleteFile, isViewer, isOwner, protectedFiles, filesState, showToast]);

  const handleDeleteFolder = useCallback((path) => {
    if (isViewer) {
      showToast('View-only access: deleting folders is disabled.', 'error');
      return;
    }
    if (!isOwner && protectedFiles.some((pf) => pf === path || pf.startsWith(`${path}/`))) {
      showToast(`Folder "${path}" contains protected files and cannot be deleted by editors.`, 'error');
      return;
    }

    const childFiles = Object.entries(filesState)
      .filter(([k]) => k.startsWith(`${path}/`))
      .map(([k, v]) => ({ path: k, content: v?.content || '' }));
    const childFolders = foldersState.filter((f) => f === path || f.startsWith(`${path}/`));

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }

    setUndoDeleteInfo({
      type: 'folder',
      path,
      files: childFiles,
      folders: childFolders,
      timestamp: Date.now()
    });

    undoTimerRef.current = setTimeout(() => {
      setUndoDeleteInfo(null);
    }, 10000);

    emitDeleteFolder(path);
  }, [emitDeleteFolder, isViewer, isOwner, protectedFiles, filesState, foldersState, showToast]);

  // Restore deleted file or folder when Undo is clicked
  const handlePerformUndoDelete = useCallback(() => {
    if (!undoDeleteInfo) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    if (undoDeleteInfo.type === 'file') {
      emitCreateFile(undoDeleteInfo.path, undoDeleteInfo.content);
      setOpenTabs((prev) => (prev.includes(undoDeleteInfo.path) ? prev : [...prev, undoDeleteInfo.path]));
      setActiveFile(undoDeleteInfo.path);
      showToast(`Restored "${undoDeleteInfo.path}"`, 'success');
    } else if (undoDeleteInfo.type === 'folder') {
      emitCreateFolder(undoDeleteInfo.path);
      for (const folder of undoDeleteInfo.folders || []) {
        if (folder !== undoDeleteInfo.path) {
          emitCreateFolder(folder);
        }
      }
      for (const file of undoDeleteInfo.files || []) {
        emitCreateFile(file.path, file.content);
      }
      showToast(`Restored folder "${undoDeleteInfo.path}" and its contents`, 'success');
    }

    setUndoDeleteInfo(null);
  }, [undoDeleteInfo, emitCreateFile, emitCreateFolder, showToast]);

  const handleMoveItem = useCallback((itemType, oldPath, targetParentFolder) => {
    if (isViewer) return;
    if (!isOwner && protectedFiles.some((pf) => pf === oldPath || pf.startsWith(`${oldPath}/`))) {
      showToast(`Protected file/folder cannot be moved by editors.`, 'error');
      return;
    }
    emitMoveItem(itemType, oldPath, targetParentFolder);
  }, [emitMoveItem, isViewer, isOwner, protectedFiles, showToast]);

  const handleToggleActivity = useCallback(() => {
    setIsActivityLogOpen((prev) => {
      const next = !prev;
      if (next && !isMobileWorkspace) {
        setIsRightPanelOpen(false);
      }
      return next;
    });
  }, [isMobileWorkspace]);

  const handleToggleCollaborators = useCallback(() => {
    setIsRightPanelOpen((prev) => {
      const next = !prev;
      if (next && !isMobileWorkspace) {
        setIsActivityLogOpen(false);
      }
      return next;
    });
  }, [isMobileWorkspace]);

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
        onOpenActivity={handleToggleActivity}
        isActivityOpen={isActivityLogOpen}
        onOpenChangeRequests={() => {
          setChangeRequestsInitialCreate(false);
          setIsChangeRequestsOpen(true);
        }}
        pendingRequestsCount={pendingRequestsCount}
        requiresApproval={projectRequiresApproval}
        onToggleApprovalMode={handleToggleApprovalMode}
        isRightPanelOpen={isRightPanelOpen}
        toggleRightPanel={handleToggleCollaborators}
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
          requiresApproval={projectRequiresApproval}
          projectName={projectName}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          protectedFiles={protectedFiles}
          isOwner={isOwner}
          onToggleProtectFile={handleToggleProtectFile}
        />

        {/* Center Code Editor Area */}
        <main className="editor-workspace">
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
              {/* Read-Only Notice Banner for Viewers */}
              {isViewer && (
                <div className="view-only-banner">
                  <Eye size={14} className="banner-icon" />
                  <span>
                    <strong>View-Only Mode:</strong> You can view all files in real time. Code editing and cloud saving are restricted to editors and the owner.
                  </span>
                </div>
              )}

              {/* Protected File Notice Banner for Editors */}
              {isEditorRestricted && (
                <div className="protected-file-banner">
                  <div className="protected-file-banner-left">
                    <Lock size={14} className="banner-icon" />
                    <span>
                      <strong>Protected File:</strong> This file is protected by the project owner.
                    </span>
                  </div>
                </div>
              )}

              {/* Strict Review Mode Notice Banner for Editors */}
              {!isViewer && effectiveRole === 'editor' && projectRequiresApproval && (
                <div className="approval-mode-banner">
                  <div className="approval-mode-banner-left">
                    <GitPullRequest size={14} className="banner-icon" />
                    <span>
                      <strong>Strict review mode is enabled. Your code changes require owner approval.</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="approval-mode-banner-btn"
                    onClick={() => {
                      setChangeRequestsInitialCreate(true);
                      setIsChangeRequestsOpen(true);
                    }}
                  >
                    <GitPullRequest size={12} />
                    <span>Request Review</span>
                  </button>
                </div>
              )}

              {/* Code Editor Tab Bar with Responsive Dropdown & Grouped Tools */}
              {openTabs.length > 0 && (
                <TabBar
                  openTabs={openTabs}
                  activeTab={activeFile}
                  onSelectTab={handleSelectFile}
                  onCloseTab={handleCloseTab}
                  onConsole={handleOpenConsole}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onRun={handleRun}
                  onFind={handleFind}
                  onReplace={handleReplace}
                  onFormatDocument={handleFormatDocument}
                  readOnly={isViewer || isEditorRestricted}
                  requiresApproval={projectRequiresApproval}
                  userRole={effectiveRole}
                  onRequestReview={() => {
                    setChangeRequestsInitialCreate(true);
                    setIsChangeRequestsOpen(true);
                  }}
                  onSubmitForReview={() => {
                    setChangeRequestsInitialCreate(true);
                    setIsChangeRequestsOpen(true);
                  }}
                />
              )}

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
                  readOnly={isViewer || isEditorRestricted}
                  activeFile={activeFile}
                  remoteCursors={remoteCursors}
                  onRun={handleRun}
                  onOpenConsole={handleOpenConsole}
                  editorRef={editorRef}
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
                previewTab={previewActiveTab}
                onTabChange={setPreviewActiveTab}
                executionResult={executionResult}
                isExecuting={isExecuting}
                onExecuteCode={handleExecuteCode}
                stdin={executionStdin}
                onStdinChange={handleStdinChange}
                onClearExecution={handleClearExecution}
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

        {/* Right Activity Log Panel on big screens */}
        {!isMobileWorkspace && isActivityLogOpen && (
          <ActivityLogModal
            isOpen={isActivityLogOpen}
            onClose={() => setIsActivityLogOpen(false)}
            projectId={currentProject?.id || matchedInContext?.id}
            roomId={activeRoomId}
            projectName={projectName}
            liveActivityEntry={liveActivityEntry}
            isSidebar={true}
          />
        )}
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
        requiresApproval={projectRequiresApproval}
        onToggleApprovalMode={handleToggleApprovalMode}
        onShowToast={showToast}
      />

      {/* Role-Based Change Requests & Owner Approval Modal */}
      <ChangeRequestsModal
        isOpen={isChangeRequestsOpen}
        onClose={() => setIsChangeRequestsOpen(false)}
        projectId={currentProject?.id || matchedInContext?.id || activeRoomId}
        projectName={projectName}
        roomId={activeRoomId}
        userRole={effectiveRole}
        currentUser={currentUser}
        activeFile={activeFile}
        activeFileContent={filesState[activeFile]?.content || ''}
        filesState={filesState}
        initialCreateMode={changeRequestsInitialCreate}
        onShowToast={showToast}
      />

      {/* Per-File Version History & Restore Modal */}
      <VersionHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        roomId={activeRoomId}
        projectId={currentProject?.id || matchedInContext?.id || activeRoomId}
        fileName={activeFile || 'main.js'}
        userRole={effectiveRole}
        requiresApproval={projectRequiresApproval}
        protectedFiles={protectedFiles}
        currentUser={currentUser}
        currentContent={filesState[activeFile]?.content || ''}
        onRestore={handleVersionRestored}
        onShowToast={showToast}
      />

      {/* Project Activity Log Modal on smaller screens / mobile ("less ratio") */}
      {isMobileWorkspace && isActivityLogOpen && (
        <ActivityLogModal
          isOpen={isActivityLogOpen}
          onClose={() => setIsActivityLogOpen(false)}
          projectId={currentProject?.id || matchedInContext?.id}
          roomId={activeRoomId}
          projectName={projectName}
          liveActivityEntry={liveActivityEntry}
          isSidebar={false}
        />
      )}

      {/* Safe Delete 10s Undo Toast */}
      {undoDeleteInfo && (
        <div className="undo-delete-toast" role="alert">
          <div className="undo-toast-left">
            <Trash2 size={16} className="undo-toast-icon" />
            <span>
              Deleted {undoDeleteInfo.type === 'folder' ? 'folder' : 'file'} <strong>{undoDeleteInfo.path}</strong>
            </span>
          </div>
          <div className="undo-toast-actions">
            <button
              type="button"
              className="btn-undo-action"
              onClick={handlePerformUndoDelete}
            >
              <RotateCcw size={13} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              className="btn-undo-dismiss"
              onClick={() => {
                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                setUndoDeleteInfo(null);
              }}
              aria-label="Dismiss undo notification"
            >
              <X size={14} />
            </button>
          </div>
          <div className="undo-toast-progress-bar" />
        </div>
      )}

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
