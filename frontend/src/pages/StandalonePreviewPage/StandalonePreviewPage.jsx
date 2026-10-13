import './StandalonePreviewPage.css';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  RotateCw,
  Terminal,
  Link2,
  Check,
  Smartphone,
  Tablet,
  Monitor,
  FileCode,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
  ShieldCheck
} from 'lucide-react';
import { buildPreviewDocument } from '../../utils/previewCompiler';
import { INITIAL_FILES, getLanguageFromFile } from '../../data/initialFiles';
import { api } from '../../services/api';

// The backend returns workspace files as a dictionary of strings:
// { "index.html": "<!DOCTYPE html>...", "styles.css": "...", "main.js": "..." }
// Monaco editor and buildPreviewDocument() expect file objects:
// { "index.html": { name: "index.html", language: "html", content: "..." } }
function normalizeWorkspaceFiles(workspaceFiles) {
  if (!workspaceFiles || typeof workspaceFiles !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(workspaceFiles).map(([name, file]) => {
      const language = getLanguageFromFile(name);
      if (typeof file === 'string') {
        return [
          name,
          {
            name,
            language,
            content: file
          }
        ];
      }
      return [
        name,
        {
          name,
          language: file?.language || language,
          content: typeof file?.content === 'string' ? file.content : '',
          ...file
        }
      ];
    })
  );
}

export default function StandalonePreviewPage() {
  const { roomId: urlRoomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const rawRoomId = (urlRoomId && decodeURIComponent(urlRoomId).trim()) || 'demo-room';
  const entryQuery = searchParams.get('entry');

  // Keep localStorage only as a fast temporary cache while fresh files load from backend
  const [files, setFiles] = useState(() => {
    try {
      const cached = localStorage.getItem(`codecollab_preview_${rawRoomId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.files && typeof parsed.files === 'object') {
          return normalizeWorkspaceFiles(parsed.files);
        }
      }
    } catch (e) {
      console.warn('Failed reading preview localStorage cache:', e);
    }
    return {};
  });

  const [projectName, setProjectName] = useState(() => {
    try {
      const cached = localStorage.getItem(`codecollab_preview_${rawRoomId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.projectName) return parsed.projectName;
      }
    } catch (_e) {}
    return rawRoomId;
  });

  const [selectedHtmlFile, setSelectedHtmlFile] = useState(entryQuery || null);
  const [viewportMode, setViewportMode] = useState('responsive'); // 'responsive' | 'tablet' | 'mobile'
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleFilter, setConsoleFilter] = useState('all'); // 'all' | 'log' | 'warn' | 'error'
  const [renderNonce, setRenderNonce] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isTopBarCollapsed, setIsTopBarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(() => Object.keys(files).length === 0);
  const [loadError, setLoadError] = useState('');

  const iframeRef = useRef(null);

  // Available HTML files
  const htmlFiles = useMemo(() => {
    return Object.keys(files).filter((name) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.html') || lower.endsWith('.htm');
    });
  }, [files]);

  // Set default entry HTML file if not set
  useEffect(() => {
    if (entryQuery && files[entryQuery]) {
      setSelectedHtmlFile(entryQuery);
    } else if (!selectedHtmlFile || !files[selectedHtmlFile]) {
      if (files['index.html']) {
        setSelectedHtmlFile('index.html');
      } else if (htmlFiles.length > 0) {
        setSelectedHtmlFile(htmlFiles[0]);
      }
    }
  }, [files, entryQuery, htmlFiles, selectedHtmlFile]);

  // Fetch both project metadata and saved workspace files from backend on initial mount
  useEffect(() => {
    let isMounted = true;
    if (Object.keys(files).length === 0) {
      setIsLoading(true);
    }
    setLoadError('');

    Promise.allSettled([
      api.getProject(rawRoomId),
      api.getProjectWorkspace(rawRoomId)
    ])
      .then(([projectResult, workspaceResult]) => {
        if (!isMounted) return;

        // If workspace files request failed, report the error UI
        if (workspaceResult.status === 'rejected') {
          // In local development demo-room mode, fall back to initial starter files if offline
          if (rawRoomId === 'demo-room' && import.meta.env.DEV) {
            setFiles(INITIAL_FILES);
            setProjectName('Demo Room');
            setIsLoading(false);
            return;
          }
          const errMsg =
            workspaceResult.reason?.message
            || workspaceResult.reason?.data?.error
            || 'Failed to load project workspace files from server.';
          setLoadError(errMsg);
          setIsLoading(false);
          return;
        }

        const workspaceData = workspaceResult.value;
        const rawFiles = workspaceData?.files;

        if (!rawFiles || typeof rawFiles !== 'object') {
          setLoadError('The server returned an invalid workspace files format.');
          setIsLoading(false);
          return;
        }

        const convertedFiles = normalizeWorkspaceFiles(rawFiles);
        if (Object.keys(convertedFiles).length === 0) {
          setLoadError('No saved project files found in this workspace.');
          setIsLoading(false);
          return;
        }

        // Project metadata (if available)
        let resolvedProjectName = rawRoomId;
        if (projectResult.status === 'fulfilled' && projectResult.value?.project?.name) {
          resolvedProjectName = projectResult.value.project.name;
        }

        setProjectName(resolvedProjectName);
        setFiles(convertedFiles);
        setLoadError('');
        setIsLoading(false);

        // Update fast temporary localStorage cache
        try {
          const cachePayload = {
            files: convertedFiles,
            projectName: resolvedProjectName,
            roomId: rawRoomId,
            timestamp: Date.now()
          };
          localStorage.setItem(`codecollab_preview_${rawRoomId}`, JSON.stringify(cachePayload));
        } catch (_e) {}
      })
      .catch((err) => {
        if (isMounted) {
          setLoadError(err?.message || 'Unable to load saved project files.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [rawRoomId, retryNonce]);

  // Listen to cross-tab updates via BroadcastChannel and window storage event
  useEffect(() => {
    const handleUpdate = (payload) => {
      if (payload && payload.files && typeof payload.files === 'object') {
        const normalized = normalizeWorkspaceFiles(payload.files);
        setFiles(normalized);
        if (payload.projectName) setProjectName(payload.projectName);
        if (!entryQuery && payload.selectedHtmlFile) {
          setSelectedHtmlFile(payload.selectedHtmlFile);
        }
        setLoadError('');
        setIsLoading(false);
        setRenderNonce((n) => n + 1);
      }
    };

    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(`codecollab_preview_channel_${rawRoomId}`);
        bc.onmessage = (event) => {
          if (event.data?.type === 'PREVIEW_UPDATE') {
            handleUpdate(event.data.payload);
          }
        };
      } catch (e) {
        console.warn('BroadcastChannel error:', e);
      }
    }

    const handleStorageEvent = (event) => {
      if (event.key === `codecollab_preview_${rawRoomId}` && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          handleUpdate(parsed);
        } catch (_e) {}
      }
    };

    window.addEventListener('storage', handleStorageEvent);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [rawRoomId, entryQuery]);

  // Listen to postMessage telemetry from the sandboxed iframe
  useEffect(() => {
    const handleMessage = (event) => {
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

  const triggerRefresh = () => {
    setIsRefreshing(true);
    setRetryNonce((n) => n + 1);
    setRenderNonce((n) => n + 1);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCopyLink = async () => {
    const url = window.location.href;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch (_e) {}

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
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (_err) {}
    }

    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2400);
  };

  // Compile the HTML document
  const compiledHtml = useMemo(() => {
    return buildPreviewDocument(files, selectedHtmlFile, renderNonce);
  }, [files, selectedHtmlFile, renderNonce]);

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
    <div className="standalone-preview-root">
      {/* Top Standalone Navigation Bar */}
      <header className={`standalone-preview-header ${isTopBarCollapsed ? 'collapsed' : ''}`}>
        <div className="standalone-header-left">
          {/* Back to CodeCollab Editor */}
          <button
            type="button"
            className="standalone-btn btn-back-editor"
            onClick={() => navigate(`/projects/${encodeURIComponent(rawRoomId)}`)}
            title="Open Editor in CodeCollab"
            aria-label="Open Editor in CodeCollab"
          >
            <ArrowLeft size={14} />
            <span className="btn-label">Back to Editor</span>
          </button>

          <div className="standalone-brand-divider" />

          {/* Project Title Badge */}
          <div className="standalone-project-info" title={`Project: ${projectName}`}>
            <span className="standalone-dot" />
            <span className="standalone-project-name">{projectName}</span>
            <span className="standalone-badge-preview">Live Output</span>
          </div>
        </div>

        {/* Center Viewport Switcher & Entry Selector */}
        <div className="standalone-header-center">
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

          {/* HTML Entry Selector */}
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
        </div>

        {/* Right Toolbar Actions */}
        <div className="standalone-header-right">
          {/* Console Drawer Toggle */}
          <button
            type="button"
            className={`standalone-btn btn-console-toggle ${isConsoleOpen ? 'active' : ''}`}
            onClick={() => setIsConsoleOpen((prev) => !prev)}
            title="Toggle Debug Console"
            aria-label="Toggle Debug Console"
          >
            <Terminal size={13} />
            <span className="btn-label">Console</span>
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

          {/* Refresh Output */}
          <button
            type="button"
            className="standalone-btn"
            onClick={triggerRefresh}
            title="Reload Preview Sandbox"
            aria-label="Reload Preview Sandbox"
          >
            <RotateCw size={13} className={isRefreshing ? 'spinning' : ''} />
            <span className="btn-label">Refresh</span>
          </button>

          {/* Copy Preview Link */}
          <button
            type="button"
            className={`standalone-btn ${isCopied ? 'copied' : ''}`}
            onClick={handleCopyLink}
            title={isCopied ? 'Link Copied!' : 'Copy Preview Link'}
            aria-label="Copy Preview Link"
          >
            {isCopied ? <Check size={13} className="text-success" /> : <Link2 size={13} />}
            <span className="btn-label">{isCopied ? 'Copied!' : 'Copy Link'}</span>
          </button>

          {/* Minimize / Hide Top Bar (Presentation Mode) */}
          <button
            type="button"
            className="standalone-btn btn-collapse-bar"
            onClick={() => setIsTopBarCollapsed(true)}
            title="Hide Toolbar (Full Screen)"
            aria-label="Hide Toolbar"
          >
            <ChevronUp size={13} />
          </button>
        </div>
      </header>

      {/* Floating Restore Bar Button when Toolbar is Collapsed */}
      {isTopBarCollapsed && (
        <button
          type="button"
          className="standalone-btn-floating-restore"
          onClick={() => setIsTopBarCollapsed(false)}
          title="Show Preview Toolbar"
          aria-label="Show Preview Toolbar"
        >
          <ChevronDown size={13} />
          <span>Show Toolbar</span>
        </button>
      )}

      {/* Main Sandbox Area */}
      <main className="standalone-preview-main">
        {isLoading ? (
          <div className="standalone-loading-state">
            <div className="loading-spinner" />
            <p>Loading project preview...</p>
          </div>
        ) : loadError ? (
          <div className="standalone-loading-state standalone-error-state" role="alert">
            <AlertCircle size={32} className="text-danger" />
            <h3>Unable to load saved project files</h3>
            <p className="error-description">{loadError}</p>
            <div className="error-actions">
              <button
                type="button"
                className="standalone-btn btn-retry"
                onClick={() => {
                  setLoadError('');
                  setIsLoading(true);
                  setRetryNonce((n) => n + 1);
                }}
              >
                <RotateCw size={13} />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                className="standalone-btn btn-back-editor"
                onClick={() => navigate(`/projects/${encodeURIComponent(rawRoomId)}`)}
              >
                <ArrowLeft size={13} />
                <span>Back to Editor</span>
              </button>
            </div>
          </div>
        ) : Object.keys(files).length === 0 ? (
          <div className="standalone-loading-state standalone-error-state" role="alert">
            <AlertCircle size={32} className="text-warning" />
            <h3>Unable to load saved project files</h3>
            <p className="error-description">No project files found in saved workspace.</p>
            <div className="error-actions">
              <button
                type="button"
                className="standalone-btn btn-retry"
                onClick={() => {
                  setLoadError('');
                  setIsLoading(true);
                  setRetryNonce((n) => n + 1);
                }}
              >
                <RotateCw size={13} />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                className="standalone-btn btn-back-editor"
                onClick={() => navigate(`/projects/${encodeURIComponent(rawRoomId)}`)}
              >
                <ArrowLeft size={13} />
                <span>Back to Editor</span>
              </button>
            </div>
          </div>
        ) : (
          <div className={`standalone-viewport-container viewport-${viewportMode}`}>
            <iframe
              ref={iframeRef}
              title={`CodeCollab Preview - ${projectName}`}
              sandbox="allow-scripts allow-modals"
              srcDoc={compiledHtml}
              className="standalone-sandboxed-iframe"
            />
          </div>
        )}
      </main>

      {/* Collapsible Console Drawer at Bottom */}
      {isConsoleOpen && (
        <section className="standalone-console-drawer" aria-label="Debug Console">
          <div className="console-drawer-header">
            <div className="console-drawer-left">
              <Terminal size={13} />
              <span className="drawer-title">Virtual Console Output</span>
              <span className="console-count">({consoleLogs.length} events)</span>
            </div>

            <div className="console-drawer-right">
              {/* Filter Chips */}
              <div className="console-filters-group">
                <button
                  type="button"
                  className={`filter-chip ${consoleFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setConsoleFilter('all')}
                >
                  All ({consoleLogs.length})
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

              {/* Clear */}
              <button
                type="button"
                className="btn-clear-console"
                onClick={() => setConsoleLogs([])}
                disabled={consoleLogs.length === 0}
                title="Clear console"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>

              {/* Close Console Drawer */}
              <button
                type="button"
                className="standalone-btn btn-close-console"
                onClick={() => setIsConsoleOpen(false)}
                title="Close console"
                aria-label="Close console"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          </div>

          <div className="console-messages-list">
            {filteredLogs.length === 0 ? (
              <div className="console-empty-state">
                <p>No console messages</p>
                <span>Console output and runtime errors from your project will appear here.</span>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className={`console-log-row log-row-${log.type}`}>
                  <span className="log-row-prefix">
                    {log.type === 'error' || log.type === 'runtime-error' ? (
                      <AlertCircle size={12} className="text-danger" />
                    ) : log.type === 'warn' ? (
                      <AlertTriangle size={12} className="text-warning" />
                    ) : log.type === 'system' ? (
                      <Info size={12} className="text-info" />
                    ) : (
                      <span className="log-bullet" />
                    )}
                    <span className="log-time">{log.timestamp}</span>
                  </span>
                  <div className="log-row-content">
                    <pre className="log-message-pre">
                      {log.messages ? log.messages.join(' ') : ''}
                    </pre>
                  </div>
                  {log.meta?.line && (
                    <span className="log-location">
                      Ln {log.meta.line}:{log.meta.col || 1}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Minimal Footer */}
      <footer className="standalone-preview-footer">
        <div className="footer-left">
          <ShieldCheck size={12} className="text-success" />
          <span>Safe Isolated Browser Sandbox (No external tracking, parent isolated)</span>
        </div>
        <div className="footer-right">
          <span>Active HTML: <code>{selectedHtmlFile || 'index.html'}</code></span>
        </div>
      </footer>
    </div>
  );
}
