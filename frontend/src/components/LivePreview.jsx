import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  RotateCw,
  Terminal,
  Maximize2,
  Minimize2,
  X,
  Smartphone,
  Tablet,
  Monitor,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  ShieldCheck,
  FileCode,
  ExternalLink,
  Link2,
  Check
} from 'lucide-react';
import { buildPreviewDocument } from '../utils/previewCompiler';

export { buildPreviewDocument };

export default function LivePreview({
  isOpen,
  onClose,
  files = {},
  activeFile,
  projectName = 'Project',
  roomId = 'demo-room',
  _userRole = 'editor',
  isMaximized = false,
  onToggleMaximize,
  runTrigger,
  onShowToast,
  style,
  className = ''
}) {
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'console'
  const [viewportMode, setViewportMode] = useState('responsive'); // 'responsive' | 'tablet' | 'mobile'
  const [selectedHtmlFile, setSelectedHtmlFile] = useState(null);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [consoleFilter, setConsoleFilter] = useState('all'); // 'all' | 'log' | 'warn' | 'error'
  const [renderNonce, setRenderNonce] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRunOnEdit, setAutoRunOnEdit] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const iframeRef = useRef(null);

  const triggerRefreshAnimation = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleManualRefresh = () => {
    setRenderNonce((n) => n + 1);
    triggerRefreshAnimation();
  };

  // Synchronize state to localStorage and BroadcastChannel for standalone new-tab preview
  const syncToStorage = useCallback(() => {
    try {
      const cleanRoom = roomId ? String(roomId).replace(/[^a-zA-Z0-9_-]/g, '') : 'demo-room';
      const payload = {
        files,
        selectedHtmlFile,
        projectName,
        roomId: cleanRoom,
        timestamp: Date.now()
      };
      localStorage.setItem(`codecollab_preview_${cleanRoom}`, JSON.stringify(payload));
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const bc = new BroadcastChannel(`codecollab_preview_channel_${cleanRoom}`);
          bc.postMessage({ type: 'PREVIEW_UPDATE', payload });
          bc.close();
        } catch {
          // ignore BroadcastChannel errors
        }
      }
    } catch (e) {
      console.warn('Could not sync preview to storage:', e);
    }
  }, [files, selectedHtmlFile, projectName, roomId]);

  // Keep storage updated whenever files or selectedHtmlFile change while preview is open
  useEffect(() => {
    if (isOpen) {
      syncToStorage();
    }
  }, [isOpen, files, selectedHtmlFile, syncToStorage]);

  const getPreviewUrl = useCallback(() => {
    const cleanRoom = roomId ? String(roomId).replace(/[^a-zA-Z0-9_-]/g, '') : 'demo-room';
    const entryParam =
      selectedHtmlFile && selectedHtmlFile !== 'index.html'
        ? `?entry=${encodeURIComponent(selectedHtmlFile)}`
        : '';
    return `${window.location.origin}/preview/${encodeURIComponent(cleanRoom)}${entryParam}`;
  }, [roomId, selectedHtmlFile]);

  const handleOpenNewTab = () => {
    syncToStorage();
    const url = getPreviewUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    syncToStorage();
    const url = getPreviewUrl();
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch (_err) {
      // Browser blocked async clipboard; proceed to textarea fallback
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (fallbackErr) {
        console.warn('Fallback copy failed:', fallbackErr);
      }
    }

    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2400);
    if (onShowToast) {
      onShowToast('Preview link copied to clipboard!');
    }
  };

  // Available HTML files in the project
  const htmlFiles = useMemo(() => {
    return Object.keys(files).filter((name) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.html') || lower.endsWith('.htm');
    });
  }, [files]);

  // Set default entry HTML file
  useEffect(() => {
    if (activeFile && (activeFile.endsWith('.html') || activeFile.endsWith('.htm'))) {
      setSelectedHtmlFile(activeFile);
    } else if (files['index.html']) {
      setSelectedHtmlFile('index.html');
    } else if (htmlFiles.length > 0) {
      setSelectedHtmlFile(htmlFiles[0]);
    }
  }, [activeFile, files, htmlFiles]);

  // Re-run whenever runTrigger prop increments
  useEffect(() => {
    if (runTrigger) {
      setRenderNonce((n) => n + 1);
      triggerRefreshAnimation();
    }
  }, [runTrigger]);

  // Auto-reload when files change (if autoRunOnEdit is enabled)
  useEffect(() => {
    if (autoRunOnEdit && isOpen) {
      const timer = setTimeout(() => {
        setRenderNonce((n) => n + 1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [files, autoRunOnEdit, isOpen]);

  // Listen to postMessage from sandboxed iframe
  useEffect(() => {
    const handleMessage = (event) => {
      // Validate telemetry message from sandboxed preview
      if (event.data && event.data.source === 'codecollab-preview') {
        const { type, messages, meta, timestamp } = event.data;
        const newEntry = {
          id: `log-${timestamp}-${Math.random().toString(36).substring(2, 7)}`,
          type,
          messages,
          meta,
          timestamp: new Date(timestamp).toLocaleTimeString()
        };
        setConsoleLogs((prev) => [...prev.slice(-199), newEntry]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleClearConsole = () => {
    setConsoleLogs([]);
  };

  // Compile the final HTML document to pass into srcDoc
  const compiledHtml = useMemo(() => {
    return buildPreviewDocument(files, selectedHtmlFile, renderNonce);
  }, [files, selectedHtmlFile, renderNonce]);

  if (!isOpen) return null;

  // Counts for badge
  const errorCount = consoleLogs.filter(
    (l) => l.type === 'error' || l.type === 'runtime-error'
  ).length;
  const warnCount = consoleLogs.filter((l) => l.type === 'warn').length;

  const filteredLogs = consoleLogs.filter((log) => {
    if (consoleFilter === 'all') return true;
    if (consoleFilter === 'error') return log.type === 'error' || log.type === 'runtime-error';
    if (consoleFilter === 'warn') return log.type === 'warn';
    if (consoleFilter === 'log') return log.type === 'log' || log.type === 'info' || log.type === 'system';
    return true;
  });

  return (
    <aside
      className={`live-preview-container ${isMaximized ? 'maximized' : ''} ${className}`}
      style={style}
      aria-label="CodeCollab Live Preview"
    >
      {/* Preview Header Toolbar */}
      <header className="preview-header">
        <div className="preview-header-left">
          <div className="preview-status-indicator" title="Safe Isolated Sandbox">
            <span className="preview-status-dot" />
            <span className="preview-title">Live Preview</span>
          </div>

          {/* Segmented View Tabs (Preview vs Console) */}
          <div className="preview-tabs-group" role="tablist">
            <button
              type="button"
              className={`preview-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
              role="tab"
              aria-selected={activeTab === 'preview'}
            >
              <Play size={12} fill="currentColor" />
              <span>Preview</span>
            </button>
            <button
              type="button"
              className={`preview-tab-btn ${activeTab === 'console' ? 'active' : ''}`}
              onClick={() => setActiveTab('console')}
              role="tab"
              aria-selected={activeTab === 'console'}
            >
              <Terminal size={12} />
              <span>Console</span>
              {consoleLogs.length > 0 && (
                <span
                  className={`console-counter-badge ${
                    errorCount > 0 ? 'badge-error' : warnCount > 0 ? 'badge-warn' : ''
                  }`}
                >
                  {errorCount > 0 ? errorCount : consoleLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Center / Right Controls */}
        <div className="preview-header-right">
          {/* Viewport Width Controls (Only active in Preview tab) */}
          {activeTab === 'preview' && (
            <div className="viewport-switcher-group" title="Preview Viewport Mode">
              <button
                type="button"
                className={`viewport-btn ${viewportMode === 'responsive' ? 'active' : ''}`}
                onClick={() => setViewportMode('responsive')}
                title="Full Responsive Width (100%)"
                aria-label="Full Responsive Width"
              >
                <Monitor size={13} />
              </button>
              <button
                type="button"
                className={`viewport-btn ${viewportMode === 'tablet' ? 'active' : ''}`}
                onClick={() => setViewportMode('tablet')}
                title="Tablet Viewport (768px)"
                aria-label="Tablet Viewport (768px)"
              >
                <Tablet size={13} />
              </button>
              <button
                type="button"
                className={`viewport-btn ${viewportMode === 'mobile' ? 'active' : ''}`}
                onClick={() => setViewportMode('mobile')}
                title="Mobile Viewport (375px)"
                aria-label="Mobile Viewport (375px)"
              >
                <Smartphone size={13} />
              </button>
            </div>
          )}

          {/* HTML Entry Selector (if multiple HTML files exist) */}
          {htmlFiles.length > 1 && (
            <div className="entry-html-selector-wrap" title="Select entry HTML file">
              <FileCode size={13} className="entry-icon" />
              <select
                className="entry-html-select"
                value={selectedHtmlFile || 'index.html'}
                onChange={(e) => setSelectedHtmlFile(e.target.value)}
                aria-label="Entry HTML File"
              >
                {htmlFiles.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 1. Refresh Button */}
          <button
            type="button"
            className="preview-control-btn btn-refresh"
            onClick={handleManualRefresh}
            title="Refresh sandbox preview"
            aria-label="Refresh Preview"
          >
            <RotateCw size={13} className={isRefreshing ? 'spinning' : ''} />
          </button>

          {/* 2. Open in New Tab Button */}
          <button
            type="button"
            className="preview-control-btn preview-btn-labeled btn-open-tab"
            onClick={handleOpenNewTab}
            title="Open preview in a separate browser tab"
            aria-label="Open in New Tab"
          >
            <ExternalLink size={13} />
            <span className="preview-btn-label">Open in New Tab</span>
          </button>

          {/* 3. Copy Preview Link Button */}
          <button
            type="button"
            className={`preview-control-btn preview-btn-labeled btn-copy-link ${isCopied ? 'copied' : ''}`}
            onClick={handleCopyLink}
            title="Copy preview URL to clipboard"
            aria-label="Copy Preview Link"
          >
            {isCopied ? <Check size={13} className="text-success" /> : <Link2 size={13} />}
            <span className="preview-btn-label">{isCopied ? 'Copied!' : 'Copy Preview Link'}</span>
          </button>

          {/* Maximize / Dock Toggle */}
          {onToggleMaximize && (
            <button
              type="button"
              className="preview-control-btn btn-maximize"
              onClick={onToggleMaximize}
              title={isMaximized ? 'Restore Split View' : 'Maximize Preview'}
              aria-label={isMaximized ? 'Restore Split View' : 'Maximize Preview'}
            >
              {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          )}

          {/* 4. Close Button */}
          <button
            type="button"
            className="preview-control-btn preview-close-btn"
            onClick={onClose}
            title="Close Live Preview"
            aria-label="Close Live Preview"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="preview-body">
        {/* VIEW 1: Visual Sandbox Iframe */}
        <div className={`preview-canvas-pane ${activeTab === 'preview' ? 'active' : 'hidden'}`}>
          <div className={`preview-viewport-wrapper viewport-${viewportMode}`}>
            <iframe
              ref={iframeRef}
              title={`CodeCollab Preview - ${projectName}`}
              sandbox="allow-scripts allow-modals"
              srcDoc={compiledHtml}
              className="preview-sandboxed-iframe"
              loading="lazy"
            />
          </div>
        </div>

        {/* VIEW 2: Virtual Console Output */}
        <div className={`preview-console-pane ${activeTab === 'console' ? 'active' : 'hidden'}`}>
          <div className="console-toolbar">
            <div className="console-filters">
              <button
                type="button"
                className={`filter-chip ${consoleFilter === 'all' ? 'active' : ''}`}
                onClick={() => setConsoleFilter('all')}
              >
                All ({consoleLogs.length})
              </button>
              <button
                type="button"
                className={`filter-chip ${consoleFilter === 'log' ? 'active' : ''}`}
                onClick={() => setConsoleFilter('log')}
              >
                Logs
              </button>
              <button
                type="button"
                className={`filter-chip chip-warn ${consoleFilter === 'warn' ? 'active' : ''}`}
                onClick={() => setConsoleFilter('warn')}
              >
                Warnings ({warnCount})
              </button>
              <button
                type="button"
                className={`filter-chip chip-error ${consoleFilter === 'error' ? 'active' : ''}`}
                onClick={() => setConsoleFilter('error')}
              >
                Errors ({errorCount})
              </button>
            </div>

            <button
              type="button"
              className="btn-clear-console"
              onClick={handleClearConsole}
              title="Clear Console Output"
              disabled={consoleLogs.length === 0}
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>

          <div className="console-messages-list">
            {filteredLogs.length === 0 ? (
              <div className="console-empty-state">
                <Terminal size={24} className="empty-icon" />
                <p>No console messages</p>
                <span>
                  Calls to console.log(), console.warn(), console.error() and uncaught runtime
                  exceptions will appear here in real time.
                </span>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isError = log.type === 'error' || log.type === 'runtime-error';
                const isWarn = log.type === 'warn';
                const isSystem = log.type === 'system';

                return (
                  <div
                    key={log.id}
                    className={`console-log-row ${
                      isError ? 'log-row-error' : isWarn ? 'log-row-warn' : isSystem ? 'log-row-system' : 'log-row-normal'
                    }`}
                  >
                    <div className="log-row-prefix">
                      {isError ? (
                        <AlertCircle size={12} className="text-danger" />
                      ) : isWarn ? (
                        <AlertTriangle size={12} className="text-warning" />
                      ) : isSystem ? (
                        <Info size={12} className="text-info" />
                      ) : (
                        <span className="log-bullet" />
                      )}
                      <span className="log-time">{log.timestamp}</span>
                    </div>

                    <div className="log-row-content">
                      {log.messages.map((msg, index) => (
                        <pre key={index} className="log-message-pre">
                          {msg}
                        </pre>
                      ))}
                    </div>

                    {log.meta?.line && (
                      <span className="log-location" title={`Line ${log.meta.line}, Col ${log.meta.col}`}>
                        L{log.meta.line}:{log.meta.col || 1}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Preview Footer Status Bar */}
      <footer className="preview-footer">
        <div className="preview-footer-left">
          <div className="security-badge" title="Executing in safe sandboxed frame without parent access">
            <ShieldCheck size={12} className="text-success" />
            <span>Sandboxed (No Parent Access)</span>
          </div>

          <div className="divider-vertical" />

          <span className="footer-entry-info">
            Entry: <code className="entry-filename">{selectedHtmlFile || 'index.html'}</code>
          </span>
        </div>

        <div className="preview-footer-right">
          <label className="auto-run-label" title="Automatically re-run sandbox when project files are modified">
            <input
              type="checkbox"
              checked={autoRunOnEdit}
              onChange={(e) => setAutoRunOnEdit(e.target.checked)}
            />
            <span>Auto-run</span>
          </label>
        </div>
      </footer>

      {/* Toast notification when preview link is copied */}
      {isCopied && (
        <div className="preview-inline-toast" role="status" aria-live="polite">
          <Check size={13} className="text-success" />
          <span>Preview link copied to clipboard!</span>
        </div>
      )}
    </aside>
  );
}
