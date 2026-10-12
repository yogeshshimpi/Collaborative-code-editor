import { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import TabBar from '../components/TabBar';
import EditorArea from '../components/EditorArea';
import StatusBar from '../components/StatusBar';
import CollaboratorsPanel from '../components/CollaboratorsPanel';
import CollaboratorsModal from '../components/CollaboratorsModal';
import Toast from '../components/Toast';
import { useAuth } from '../context/useAuth';
import { INITIAL_FILES, getLanguageFromFile } from '../data/initialFiles';
import { useSocket } from '../hooks/useSocket';

export default function EditorWorkspacePage() {
  const { roomId: urlRoomId } = useParams();
  const navigate = useNavigate();
  const { user, projects, logout } = useAuth();

  const roomId = (urlRoomId && decodeURIComponent(urlRoomId).trim()) || 'demo-room';

  // Active user is the authenticated user
  const currentUser = user || { name: 'User', color: '#6366f1', initials: 'U' };

  // File storage state - holds independent content per file
  const [filesState, setFilesState] = useState(INITIAL_FILES);
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
  // Mobile sidebar drawer state (open/close)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Toast feedback message
  const [toast, setToast] = useState(null);
  // Updated only from server acknowledgements
  const [saveStatus, setSaveStatus] = useState('idle');

  // Flag to avoid infinite loops: prevent remote updates from being emitted back
  const isRemoteChangeRef = useRef(false);

  // Show notification
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  // Handle permission error from server (e.g. viewer trying to emit code changes)
  const handlePermissionError = useCallback((err) => {
    showToast(err?.message || 'Permission denied: Viewers cannot edit or save code.', 'error');
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
  const handleRoomSync = useCallback((roomFiles) => {
    if (!roomFiles || typeof roomFiles !== 'object') return;

    isRemoteChangeRef.current = true;
    setFilesState((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const [name, content] of Object.entries(roomFiles)) {
        if (next[name] && typeof content === 'string' && next[name].content !== content) {
          next[name] = { ...next[name], content };
          changed = true;
        }
      }

      return changed ? next : prev;
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
    emitCursorClear
  } = useSocket({
    roomId,
    user: currentUser,
    onRemoteCodeChange: handleRemoteCodeChange,
    onRoomSync: handleRoomSync,
    onSaveStatus: handleSaveStatus,
    onPermissionError: handlePermissionError
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

  // Determine displayed project name and effective role
  const matchedProject = projects.find((p) => p.room_id === roomId || p.id === roomId);
  const projectName = matchedProject ? matchedProject.name : roomId;
  const effectiveRole = role || matchedProject?.role || 'editor';
  const isViewer = effectiveRole === 'viewer';

  // Switch active room by navigating to the new route
  const handleChangeRoom = (newRoom) => {
    const trimmed = newRoom ? newRoom.trim() : '';
    if (!trimmed || trimmed === roomId) return;
    emitCursorClear();
    navigate(`/projects/${encodeURIComponent(trimmed)}`);
    showToast(`Switched to room "${trimmed}"`, 'info');
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
    if (isViewer) {
      showToast(`Running "${activeFile}" in View-Only Sandbox Mode`, 'info');
      return;
    }
    console.log(`[CodeCollab] Running file "${activeFile}" in room "${roomId}" as ${currentUser.name}`);
    showToast(`Execution started for "${activeFile}" (Sandbox Mode)`, 'success');
  };

  const handleLogout = async () => {
    emitCursorClear();
    await logout();
    navigate('/login', { replace: true });
  };

  const currentFileObj = activeFile ? filesState[activeFile] : null;
  const currentLanguage = activeFile ? getLanguageFromFile(activeFile) : 'plaintext';
  const fileList = Object.values(filesState);

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        projectName={projectName}
        roomId={roomId}
        onChangeRoom={handleChangeRoom}
        connectionStatus={connectionStatus}
        participantCount={participantCount}
        currentUser={currentUser}
        activeUsers={activeUsers}
        userRole={effectiveRole}
        onRun={handleRun}
        onShare={() => setIsCollaboratorsOpen(true)}
        onOpenCollaborators={() => setIsCollaboratorsOpen(true)}
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
          activeFile={activeFile}
          onSelectFile={handleSelectFile}
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
            />
          )}

          {activeFile && currentFileObj ? (
            <EditorArea
              content={currentFileObj.content}
              language={currentLanguage}
              onChange={handleEditorChange}
              onCursorChange={setCursor}
              onCursorActivity={handleCursorActivity}
              layoutTrigger={isSidebarOpen || isRightPanelOpen}
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
        </main>

        {/* Right Collaborators Panel */}
        <CollaboratorsPanel
          isOpen={isRightPanelOpen}
          onClose={() => setIsRightPanelOpen(false)}
          roomId={roomId}
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
        roomId={roomId}
        saveStatus={saveStatus}
        userRole={effectiveRole}
      />

      {/* Collaborators & Access Management Modal */}
      <CollaboratorsModal
        isOpen={isCollaboratorsOpen}
        onClose={() => setIsCollaboratorsOpen(false)}
        projectId={matchedProject?.id || roomId}
        projectName={projectName}
        userRole={effectiveRole}
        currentUserId={currentUser?.id}
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
