import { useState, useRef, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import EditorArea from './components/EditorArea';
import StatusBar from './components/StatusBar';
import CollaboratorsPanel from './components/CollaboratorsPanel';
import Toast from './components/Toast';
import { INITIAL_FILES, getLanguageFromFile } from './data/initialFiles';
import { useSocket } from './hooks/useSocket';
import { getOrCreateUser } from './utils/user';
import './App.css';

function App() {
  // Read room from URL query param (e.g. ?room=team-alpha) or fallback to demo-room
  const getInitialRoom = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      return urlRoom && urlRoom.trim() ? urlRoom.trim() : 'demo-room';
    } catch {
      return 'demo-room';
    }
  };

  const [roomId, setRoomId] = useState(getInitialRoom);

  // Anonymous guest user identity (persisted across page refresh via sessionStorage)
  const [currentUser] = useState(getOrCreateUser);

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
  // Mobile sidebar drawer state (open/close)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Toast feedback message
  const [toast, setToast] = useState(null);
  // Updated only from server acknowledgements: never claim a cloud save until
  // PostgreSQL has actually accepted the latest change.
  const [saveStatus, setSaveStatus] = useState('idle');

  // Flag to avoid infinite loops: prevent remote updates from being emitted back
  const isRemoteChangeRef = useRef(false);

  // Show notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

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

  // Initialize Socket.IO connection hook with live user identity
  const { connectionStatus, participantCount, activeUsers, emitCodeChange } = useSocket({
    roomId,
    user: currentUser,
    onRemoteCodeChange: handleRemoteCodeChange,
    onRoomSync: handleRoomSync,
    onSaveStatus: handleSaveStatus
  });

  // Switch active room
  const handleChangeRoom = (newRoom) => {
    const trimmed = newRoom ? newRoom.trim() : '';
    if (!trimmed || trimmed === roomId) return;

    setRoomId(trimmed);

    // Update URL query parameter without page reload
    try {
      const newUrl = `${window.location.pathname}?room=${encodeURIComponent(trimmed)}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } catch {
      // Ignored in non-browser environments
    }

    showToast(`Switched to room "${trimmed}"`, 'info');
  };

  // Switch active file from sidebar or tabs
  const handleSelectFile = (fileName) => {
    if (!openTabs.includes(fileName)) {
      setOpenTabs((prev) => [...prev, fileName]);
    }
    setActiveFile(fileName);
    // Automatically close mobile sidebar drawer after selection
    setIsSidebarOpen(false);
  };

  // Close an open tab
  const handleCloseTab = (fileName) => {
    const updatedTabs = openTabs.filter((tab) => tab !== fileName);
    setOpenTabs(updatedTabs);

    if (activeFile === fileName) {
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

    // If change was received remotely, do not echo back to server
    if (isRemoteChangeRef.current) {
      isRemoteChangeRef.current = false;
      return;
    }

    // Update local React state immediately
    setFilesState((prev) => ({
      ...prev,
      [activeFile]: {
        ...prev[activeFile],
        content: cleanContent
      }
    }));

    // Broadcast code change to other peers in room via Socket.IO
    emitCodeChange(activeFile, cleanContent);
  };

  // Action handlers
  const handleRun = () => {
    console.log(`[CodeCollab] Running file "${activeFile}" in room "${roomId}" as ${currentUser.name}`);
    showToast(`Execution started for "${activeFile}" (Sandbox Mode)`, 'success');
  };

  const handleShare = () => {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard?.writeText(inviteUrl);
    showToast(`Invite link for room "${roomId}" copied!`, 'info');
  };

  const currentFileObj = activeFile ? filesState[activeFile] : null;
  const currentLanguage = activeFile ? getLanguageFromFile(activeFile) : 'plaintext';
  const fileList = Object.values(filesState);

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        projectName="Untitled Project"
        roomId={roomId}
        onChangeRoom={handleChangeRoom}
        connectionStatus={connectionStatus}
        participantCount={participantCount}
        currentUser={currentUser}
        activeUsers={activeUsers}
        onRun={handleRun}
        onShare={handleShare}
        isRightPanelOpen={isRightPanelOpen}
        toggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
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
              layoutTrigger={isSidebarOpen || isRightPanelOpen}
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

        {/* Optional Right Collaborators Panel */}
        <CollaboratorsPanel
          isOpen={isRightPanelOpen}
          onClose={() => setIsRightPanelOpen(false)}
          roomId={roomId}
          currentUser={currentUser}
          activeUsers={activeUsers}
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

export default App;
