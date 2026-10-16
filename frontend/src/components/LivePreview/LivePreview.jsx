import './LivePreview.css';
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
  Check,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Copy,
  CornerDownLeft,
  Code2,
  MoreHorizontal,
  FileText,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  buildPreviewDocument,
  isReactWorkspace,
  formatRouteForDisplay,
  validatePreviewRoute
} from '../../utils/previewCompiler';

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
  className = '',
  previewTab,
  onTabChange,
  executionResult,
  isExecuting = false,
  onExecuteCode,
  stdin = '',
  onStdinChange,
  onClearExecution
}) {
  const [activeTab, setActiveTab] = useState(previewTab || 'preview');

  useEffect(() => {
    if (previewTab) {
      setActiveTab(previewTab);
    }
  }, [previewTab]);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };
  const [viewportMode, setViewportMode] = useState('responsive'); // 'responsive' | 'tablet' | 'mobile'
  const [selectedHtmlFile, setSelectedHtmlFile] = useState(null);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [consoleFilter, setConsoleFilter] = useState('all'); // 'all' | 'log' | 'warn' | 'error'
  const [renderNonce, setRenderNonce] = useState(0);
  const [isStdinOpen, setIsStdinOpen] = useState(() => Boolean(stdin && stdin.trim()));

  // Auto-open stdin drawer when active file has standard input
  useEffect(() => {
    if (stdin && stdin.trim()) {
      setIsStdinOpen(true);
    }
  }, [stdin, activeFile]);

  const [copiedOutput, setCopiedOutput] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRunOnEdit, setAutoRunOnEdit] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [previewHash, setPreviewHash] = useState('#/');
  const previewHashRef = useRef('#/');
  const isReact = useMemo(() => isReactWorkspace(files), [files]);
  const isReactRef = useRef(isReact);
  isReactRef.current = isReact;

  // Available HTML files in the project
  const htmlFiles = useMemo(() => {
    return Object.keys(files).filter((name) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.html') || lower.endsWith('.htm');
    });
  }, [files]);
  const htmlFilesRef = useRef(htmlFiles);
  htmlFilesRef.current = htmlFiles;

  const filesRef = useRef(files);
  filesRef.current = files;

  const selectedHtmlFileRef = useRef(selectedHtmlFile);
  selectedHtmlFileRef.current = selectedHtmlFile;

  const [routeField, setRouteField] = useState(() => (isReact ? '/#/' : '/index.html'));

  // Keep routeField in sync when switching files, entry HTML, or hash
  useEffect(() => {
    if (isReact) {
      setRouteField(formatRouteForDisplay(previewHashRef.current || previewHash));
    } else {
      const base = selectedHtmlFile ? `/${selectedHtmlFile}` : '/index.html';
      const hash = previewHash && previewHash !== '#/' && previewHash !== '#' ? previewHash : '';
      setRouteField(`${base}${hash}`);
    }
  }, [isReact, selectedHtmlFile, previewHash]);

  const handleNavBack = useCallback(() => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.history.back();
      }
    } catch {}
  }, []);

  const handleNavForward = useCallback(() => {
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.history.forward();
      }
    } catch {}
  }, []);

  const handleRouteKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const inputVal = (routeField || '').trim();

        if (isReact) {
          const validation = validatePreviewRoute(inputVal);
          if (!validation.isValid) {
            if (onShowToast) {
              onShowToast(validation.error || 'Blocked invalid route');
            }
            console.warn('[CodeCollab Preview] Blocked route input:', routeField, validation.error);
            setRouteField(formatRouteForDisplay(previewHashRef.current));
            return;
          }

          const targetHash = validation.hash;
          const displayRoute = formatRouteForDisplay(targetHash);
          setRouteField(displayRoute);
          setPreviewHash(targetHash);
          previewHashRef.current = targetHash;

          try {
            if (iframeRef.current && iframeRef.current.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                {
                  source: 'codecollab-parent',
                  type: 'parent-hash-change',
                  hash: targetHash
                },
                '*'
              );
            }
          } catch {}
        } else {
          // HTML / CSS / JavaScript Preview Navigation
          if (inputVal.startsWith('#') || inputVal.startsWith('/#')) {
            const cleanHash = inputVal.startsWith('/#') ? inputVal.slice(1) : inputVal;
            setPreviewHash(cleanHash);
            previewHashRef.current = cleanHash;
            const base = selectedHtmlFile ? `/${selectedHtmlFile}` : '/index.html';
            setRouteField(`${base}${cleanHash}`);
            try {
              if (iframeRef.current && iframeRef.current.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                  {
                    source: 'codecollab-parent',
                    type: 'parent-hash-change',
                    hash: cleanHash
                  },
                  '*'
                );
              }
            } catch {}
            return;
          }

          let rawPath = inputVal.replace(/^\/+/, '');
          let targetFile = rawPath;
          let targetHash = '';
          if (rawPath.includes('#')) {
            const parts = rawPath.split('#');
            targetFile = parts[0];
            targetHash = '#' + parts.slice(1).join('#');
          }

          if (!targetFile || targetFile === 'index' || targetFile === 'index.html') {
            targetFile = 'index.html';
          } else if (!targetFile.endsWith('.html') && !targetFile.endsWith('.htm')) {
            if (files[`${targetFile}.html`]) {
              targetFile = `${targetFile}.html`;
            }
          }

          if (files[targetFile] || htmlFiles.includes(targetFile)) {
            setSelectedHtmlFile(targetFile);
            setPreviewHash(targetHash);
            previewHashRef.current = targetHash;
            setRouteField(`/${targetFile}${targetHash}`);
            if (onShowToast) {
              onShowToast(`Navigated to /${targetFile}`, 'info');
            }
          } else {
            if (onShowToast) {
              onShowToast(`File "${targetFile}" not found in workspace`, 'warning');
            }
            const base = selectedHtmlFile ? `/${selectedHtmlFile}` : '/index.html';
            setRouteField(`${base}${previewHashRef.current || ''}`);
          }
        }
      } else if (e.key === 'Escape') {
        if (isReact) {
          setRouteField(formatRouteForDisplay(previewHashRef.current));
        } else {
          const base = selectedHtmlFile ? `/${selectedHtmlFile}` : '/index.html';
          setRouteField(`${base}${previewHashRef.current || ''}`);
        }
        e.currentTarget.blur();
      }
    },
    [routeField, isReact, files, htmlFiles, selectedHtmlFile, onShowToast]
  );

  const iframeRef = useRef(null);
  const headerRef = useRef(null);
  const moreMenuRef = useRef(null);
  const [headerWidth, setHeaderWidth] = useState(600);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // ResizeObserver on header for responsive collapsing & dropdown groupings
  useEffect(() => {
    if (!headerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setHeaderWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  // Dismiss dropdown menu on outside click or Escape key
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMoreMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreMenuOpen]);

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
      const currentHash = previewHashRef.current || previewHash || '#/';
      const validated = validatePreviewRoute(currentHash);
      const safeHash = validated.isValid ? validated.hash : '#/';
      const payload = {
        files,
        selectedHtmlFile,
        projectName,
        roomId: cleanRoom,
        previewHash: safeHash,
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
  }, [files, selectedHtmlFile, projectName, roomId, previewHash]);

  // Keep storage updated whenever files or selectedHtmlFile change while preview is open
  useEffect(() => {
    if (isOpen) {
      syncToStorage();
    }
  }, [isOpen, files, selectedHtmlFile, syncToStorage]);

  const getPreviewUrl = useCallback(() => {
    const cleanRoom = roomId ? String(roomId).replace(/[^a-zA-Z0-9_-]/g, '') : 'demo-room';
    const entryParam =
      !isReact && selectedHtmlFile && selectedHtmlFile !== 'index.html'
        ? `?entry=${encodeURIComponent(selectedHtmlFile)}`
        : '';
    const currentHash = previewHashRef.current || previewHash || '';
    const validated = validatePreviewRoute(currentHash);
    const safeHash = validated.isValid ? validated.hash : '#/';
    const hash = isReact
      ? (safeHash && safeHash !== '#' ? safeHash : '#/')
      : (safeHash && safeHash !== '#/' && safeHash !== '#' ? safeHash : '');
    return `${window.location.origin}/preview/${encodeURIComponent(cleanRoom)}${entryParam}${hash}`;
  }, [roomId, selectedHtmlFile, previewHash, isReact]);

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
      void _err;
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
        if (event.data.type === 'preview-page-navigate') {
          const targetPage = event.data.page;
          const targetHash = event.data.hash || '';
          if (targetPage && (filesRef.current[targetPage] || htmlFilesRef.current.includes(targetPage))) {
            setSelectedHtmlFile(targetPage);
            setPreviewHash(targetHash);
            previewHashRef.current = targetHash;
            setRouteField(`/${targetPage}${targetHash}`);
          }
          return;
        }

        if (event.data.type === 'preview-hash-change') {
          const rawHash = event.data.hash || '#/';
          const validation = validatePreviewRoute(rawHash);
          if (!validation.isValid) {
            console.warn('[CodeCollab Preview] Blocked invalid hash from preview:', rawHash);
            return;
          }
          const h = validation.hash;
          setPreviewHash(h);
          previewHashRef.current = h;
          if (isReactRef.current) {
            setRouteField(formatRouteForDisplay(h));
          } else {
            const base = selectedHtmlFileRef.current ? `/${selectedHtmlFileRef.current}` : '/index.html';
            setRouteField(`${base}${h && h !== '#/' && h !== '#' ? h : ''}`);
          }
          return;
        }

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

  const handleCopyOutput = async () => {
    const textToCopy = [
      executionResult?.compileOutput,
      executionResult?.stdout,
      executionResult?.stderr
    ]
      .filter(Boolean)
      .join('\n');
    if (!textToCopy) return;

    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      }
    } catch (_err) {
      void _err;
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        copied = true;
      } catch {}
    }

    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 2200);
    if (onShowToast) {
      onShowToast('Execution output copied to clipboard!');
    }
  };

  // Compile the final HTML document to pass into srcDoc
  const compiledHtml = useMemo(() => {
    return buildPreviewDocument(files, selectedHtmlFile, renderNonce, previewHashRef.current);
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

  const isExtraWide = headerWidth >= 860 || isMaximized;
  const isWide = headerWidth >= 580;
  const isMedium = headerWidth < 580 && headerWidth >= 440;
  const isTight = headerWidth < 440;

  return (
    <aside
      className={`live-preview-container ${isMaximized ? 'maximized' : ''} ${className}`}
      style={style}
      aria-label="CodeCollab Live Preview & Execution"
    >
      {/* Preview Header Toolbar */}
      <header
        ref={headerRef}
        className={`preview-header ${isTight ? 'mode-tight' : isMedium ? 'mode-medium' : 'mode-wide'}`}
      >
        <div className="preview-header-left">
          <div className="preview-status-indicator" title="Safe Isolated Sandbox">
            <span className={`preview-status-dot ${isExecuting ? 'status-dot-pulsing' : ''}`} />
            {!isTight && (
              <span className="preview-title">
                {activeTab === 'terminal' ? 'Code Execution' : 'Live Preview'}
              </span>
            )}
          </div>

          {/* Segmented View Tabs (Preview vs Terminal Output vs Console) */}
          <div className="preview-tabs-group" role="tablist">
            <button
              type="button"
              className={`preview-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => handleSelectTab('preview')}
              role="tab"
              aria-selected={activeTab === 'preview'}
              title="Interactive Web Sandbox Preview"
            >
              <Play size={12} fill="currentColor" />
              {!isTight && <span className="tab-text">Preview</span>}
            </button>

            <button
              type="button"
              className={`preview-tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
              onClick={() => handleSelectTab('terminal')}
              role="tab"
              aria-selected={activeTab === 'terminal'}
              title="Sandboxed Multi-Language Output (Python, Java, C++, C, Node.js)"
            >
              <Code2 size={12} />
              {!isTight && <span className="tab-text">Output</span>}
              {isExecuting ? (
                <span className="terminal-tab-running" title="Executing code...">
                  <Loader2 size={11} className="spinning" />
                </span>
              ) : executionResult ? (
                <span
                  className={`terminal-tab-dot ${
                    executionResult.status === 'Accepted'
                      ? 'dot-success'
                      : executionResult.compileOutput
                      ? 'dot-error'
                      : executionResult.stderr
                      ? 'dot-warn'
                      : 'dot-info'
                  }`}
                  title={`Status: ${executionResult.status || 'Finished'}`}
                />
              ) : null}
            </button>

            <button
              type="button"
              className={`preview-tab-btn ${activeTab === 'console' ? 'active' : ''}`}
              onClick={() => handleSelectTab('console')}
              role="tab"
              aria-selected={activeTab === 'console'}
              title="Browser Virtual Console Telemetry"
            >
              <Terminal size={12} />
              {!isTight && <span className="tab-text">Console</span>}
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
          {/* TERMINAL CONTROLS */}
          {activeTab === 'terminal' && (
            <>
              {/* Run / Re-Run Button */}
              {onExecuteCode && (
                <button
                  type="button"
                  className="preview-control-btn preview-btn-labeled btn-run-code"
                  onClick={() => onExecuteCode()}
                  disabled={isExecuting}
                  title="Execute code in sandboxed runner (Ctrl+Enter)"
                  aria-label="Run Code"
                >
                  {isExecuting ? (
                    <Loader2 size={13} className="spinning" />
                  ) : (
                    <Play size={12} fill="currentColor" />
                  )}
                  {!isTight && (
                    <span className="preview-btn-label">
                      {isExecuting ? 'Running...' : 'Run'}
                    </span>
                  )}
                </button>
              )}

              {/* Toggle Stdin Drawer (visible when not tight) */}
              {!isTight && (
                <button
                  type="button"
                  className={`preview-control-btn preview-btn-labeled btn-toggle-stdin ${
                    isStdinOpen ? 'active' : ''
                  }`}
                  onClick={() => setIsStdinOpen((v) => !v)}
                  title="Toggle standard input (stdin) for programs that read user input"
                  aria-label="Standard Input"
                >
                  <CornerDownLeft size={12} />
                  {isWide && <span className="preview-btn-label">Stdin</span>}
                  {stdin && stdin.trim() && <span className="stdin-active-dot" />}
                </button>
              )}

              {/* Copy Terminal Output (directly visible when wide) */}
              {isWide && (
                <>
                  <button
                    type="button"
                    className={`preview-control-btn ${copiedOutput ? 'copied' : ''}`}
                    onClick={handleCopyOutput}
                    disabled={
                      !executionResult ||
                      (!executionResult.stdout &&
                        !executionResult.stderr &&
                        !executionResult.compileOutput)
                    }
                    title="Copy terminal output to clipboard"
                    aria-label="Copy Output"
                  >
                    {copiedOutput ? (
                      <Check size={13} className="text-success" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>

                  {/* Clear Terminal Output */}
                  {onClearExecution && (
                    <button
                      type="button"
                      className="preview-control-btn"
                      onClick={onClearExecution}
                      disabled={!executionResult && !isExecuting}
                      title="Clear execution output"
                      aria-label="Clear Output"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* PREVIEW CONTROLS */}
          {activeTab === 'preview' && (
            <>
              {/* Viewport Width Controls (directly visible when wide) */}
              {isWide && (
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


              {/* Refresh Button (always directly visible in preview mode) */}
              <button
                type="button"
                className="preview-control-btn btn-refresh"
                onClick={handleManualRefresh}
                title="Refresh sandbox preview"
                aria-label="Refresh Preview"
              >
                <RotateCw size={13} className={isRefreshing ? 'spinning' : ''} />
              </button>

              {/* Open in New Tab Button (directly visible when wide) */}
              {isWide && (
                <>
                  <button
                    type="button"
                    className={`preview-control-btn btn-open-tab ${isExtraWide ? 'preview-btn-labeled' : ''}`}
                    onClick={handleOpenNewTab}
                    title="Open preview in a separate browser tab"
                    aria-label="Open in New Tab"
                  >
                    <ExternalLink size={13} />
                    {isExtraWide && <span className="preview-btn-label">Open in New Tab</span>}
                  </button>

                  {/* Copy Preview Link Button */}
                  <button
                    type="button"
                    className={`preview-control-btn btn-copy-link ${isExtraWide ? 'preview-btn-labeled' : ''} ${
                      isCopied ? 'copied' : ''
                    }`}
                    onClick={handleCopyLink}
                    title="Copy preview URL to clipboard"
                    aria-label="Copy Preview Link"
                  >
                    {isCopied ? <Check size={13} className="text-success" /> : <Link2 size={13} />}
                    {isExtraWide && (
                      <span className="preview-btn-label">{isCopied ? 'Copied!' : 'Copy Preview Link'}</span>
                    )}
                  </button>
                </>
              )}
            </>
          )}

          {/* CONSOLE CONTROLS */}
          {activeTab === 'console' && (
            <button
              type="button"
              className="preview-control-btn"
              onClick={handleClearConsole}
              disabled={consoleLogs.length === 0}
              title="Clear Virtual Console logs"
              aria-label="Clear Console"
            >
              <Trash2 size={13} />
            </button>
          )}

          {/* MORE OPTIONS DROPDOWN (Shown when not wide to collapse similar controls) */}
          {!isWide && (
            <div className="preview-more-menu-wrapper" ref={moreMenuRef}>
              <button
                type="button"
                className={`preview-control-btn btn-preview-more ${isMoreMenuOpen ? 'active' : ''}`}
                onClick={() => setIsMoreMenuOpen((v) => !v)}
                title="More preview actions & view options"
                aria-label="More Options"
                aria-expanded={isMoreMenuOpen}
                aria-haspopup="true"
              >
                <MoreHorizontal size={14} />
              </button>

              {isMoreMenuOpen && (
                <div className="preview-dropdown-menu" role="menu">
                  {/* PREVIEW TAB DROPDOWN OPTIONS */}
                  {activeTab === 'preview' && (
                    <>
                      {/* Device Viewport Options */}
                      <div className="preview-dropdown-section">
                        <span className="preview-dropdown-section-title">Device View</span>
                        <button
                          type="button"
                          className={`preview-dropdown-item ${viewportMode === 'responsive' ? 'active' : ''}`}
                          onClick={() => {
                            setViewportMode('responsive');
                            setIsMoreMenuOpen(false);
                          }}
                        >
                          <Monitor size={14} />
                          <span>Desktop (100%)</span>
                          {viewportMode === 'responsive' && <Check size={12} className="dropdown-check" />}
                        </button>
                        <button
                          type="button"
                          className={`preview-dropdown-item ${viewportMode === 'tablet' ? 'active' : ''}`}
                          onClick={() => {
                            setViewportMode('tablet');
                            setIsMoreMenuOpen(false);
                          }}
                        >
                          <Tablet size={14} />
                          <span>Tablet (768px)</span>
                          {viewportMode === 'tablet' && <Check size={12} className="dropdown-check" />}
                        </button>
                        <button
                          type="button"
                          className={`preview-dropdown-item ${viewportMode === 'mobile' ? 'active' : ''}`}
                          onClick={() => {
                            setViewportMode('mobile');
                            setIsMoreMenuOpen(false);
                          }}
                        >
                          <Smartphone size={14} />
                          <span>Mobile (375px)</span>
                          {viewportMode === 'mobile' && <Check size={12} className="dropdown-check" />}
                        </button>
                      </div>

                      <div className="preview-dropdown-divider" />

                      {/* Standalone Tab & Share Links */}
                      <button
                        type="button"
                        className="preview-dropdown-item"
                        onClick={() => {
                          handleOpenNewTab();
                          setIsMoreMenuOpen(false);
                        }}
                      >
                        <ExternalLink size={14} />
                        <span>Open in New Tab</span>
                      </button>

                      <button
                        type="button"
                        className="preview-dropdown-item"
                        onClick={() => {
                          handleCopyLink();
                          setIsMoreMenuOpen(false);
                        }}
                      >
                        <Link2 size={14} />
                        <span>{isCopied ? 'Link Copied!' : 'Copy Preview Link'}</span>
                      </button>

                      {/* Entry HTML Selector if multiple HTML files exist */}
                      {htmlFiles.length > 1 && (
                        <>
                          <div className="preview-dropdown-divider" />
                          <div className="preview-dropdown-section">
                            <span className="preview-dropdown-section-title">Entry File</span>
                            <select
                              className="preview-dropdown-select"
                              value={selectedHtmlFile || 'index.html'}
                              onChange={(e) => {
                                setSelectedHtmlFile(e.target.value);
                                setIsMoreMenuOpen(false);
                              }}
                            >
                              {htmlFiles.map((f) => (
                                <option key={f} value={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* TERMINAL TAB DROPDOWN OPTIONS */}
                  {activeTab === 'terminal' && (
                    <>
                      {isTight && (
                        <button
                          type="button"
                          className={`preview-dropdown-item ${isStdinOpen ? 'active' : ''}`}
                          onClick={() => {
                            setIsStdinOpen((v) => !v);
                            setIsMoreMenuOpen(false);
                          }}
                        >
                          <CornerDownLeft size={14} />
                          <span>Standard Input (Stdin)</span>
                          {stdin && stdin.trim() && <span className="dropdown-check">●</span>}
                        </button>
                      )}

                      <button
                        type="button"
                        className="preview-dropdown-item"
                        onClick={() => {
                          handleCopyOutput();
                          setIsMoreMenuOpen(false);
                        }}
                        disabled={
                          !executionResult ||
                          (!executionResult.stdout &&
                            !executionResult.stderr &&
                            !executionResult.compileOutput)
                        }
                      >
                        <Copy size={14} />
                        <span>{copiedOutput ? 'Output Copied!' : 'Copy Output'}</span>
                      </button>

                      {onClearExecution && (
                        <button
                          type="button"
                          className="preview-dropdown-item text-danger"
                          onClick={() => {
                            onClearExecution();
                            setIsMoreMenuOpen(false);
                          }}
                          disabled={!executionResult && !isExecuting}
                        >
                          <Trash2 size={14} />
                          <span>Clear Output</span>
                        </button>
                      )}
                    </>
                  )}

                  {/* Maximize option in dropdown when tight */}
                  {isTight && onToggleMaximize && (
                    <>
                      <div className="preview-dropdown-divider" />
                      <button
                        type="button"
                        className="preview-dropdown-item"
                        onClick={() => {
                          onToggleMaximize();
                          setIsMoreMenuOpen(false);
                        }}
                      >
                        {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        <span>{isMaximized ? 'Restore Split View' : 'Maximize Preview'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Maximize / Dock Toggle (directly visible when not tight) */}
          {!isTight && onToggleMaximize && (
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

          {/* Close Button (always visible) */}
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
        <div
          className={`preview-canvas-pane ${activeTab === 'preview' ? 'active' : 'hidden'} is-browser-frame ${
            isReact ? 'is-react-workspace' : ''
          }`}
        >
          {/* Unified Browser-like toolbar above Live Preview for React AND HTML/CSS/JS */}
          <div className="preview-browser-toolbar" role="toolbar" aria-label="Preview Navigation">
            <div className="preview-toolbar-nav-group">
              <button
                type="button"
                className="preview-toolbar-btn btn-nav-back"
                onClick={handleNavBack}
                title="Back"
                aria-label="Back"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                className="preview-toolbar-btn btn-nav-forward"
                onClick={handleNavForward}
                title="Forward"
                aria-label="Forward"
              >
                <ChevronRight size={13} />
              </button>
              <button
                type="button"
                className="preview-toolbar-btn btn-nav-refresh"
                onClick={handleManualRefresh}
                title="Refresh"
                aria-label="Refresh"
              >
                <RotateCw size={12} className={isRefreshing ? 'spinning' : ''} />
              </button>
            </div>

            <div className="preview-route-field-wrapper">
              <input
                type="text"
                className="preview-route-field-input"
                value={routeField}
                onChange={(e) => setRouteField(e.target.value)}
                onKeyDown={handleRouteKeyDown}
                placeholder={isReact ? '/#/' : (selectedHtmlFile ? `/${selectedHtmlFile}` : '/index.html')}
                spellCheck={false}
                autoComplete="off"
                aria-label="Route Field"
              />
            </div>
          </div>

          <div className="preview-canvas-body">
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
                      isError
                        ? 'log-row-error'
                        : isWarn
                        ? 'log-row-warn'
                        : isSystem
                        ? 'log-row-system'
                        : 'log-row-normal'
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

        {/* VIEW 3: Sandboxed Multi-Language Execution Output */}
        <div className={`preview-terminal-pane ${activeTab === 'terminal' ? 'active' : 'hidden'}`}>
          {/* Subheader / Status Bar */}
          <div className="terminal-status-bar">
            <div className="terminal-status-left">
              {isExecuting ? (
                <div className="terminal-status-pill pill-running">
                  <Loader2 size={13} className="spinning" />
                  <span>Executing in sandbox...</span>
                </div>
              ) : executionResult ? (
                <div
                  className={`terminal-status-pill ${
                    executionResult.status === 'Accepted'
                      ? 'pill-accepted'
                      : executionResult.compileOutput
                      ? 'pill-compile-error'
                      : executionResult.status === 'Time Limit Exceeded'
                      ? 'pill-timeout'
                      : executionResult.stderr
                      ? 'pill-runtime-error'
                      : 'pill-neutral'
                  }`}
                >
                  {executionResult.status === 'Accepted' ? (
                    <CheckCircle2 size={13} />
                  ) : executionResult.compileOutput ? (
                    <XCircle size={13} />
                  ) : executionResult.status === 'Time Limit Exceeded' ? (
                    <Clock size={13} />
                  ) : executionResult.stderr ? (
                    <AlertTriangle size={13} />
                  ) : (
                    <Info size={13} />
                  )}
                  <span>
                    {executionResult.status || 'Finished'}
                    {executionResult.exitCode !== null && executionResult.exitCode !== undefined
                      ? ` (Exit ${executionResult.exitCode})`
                      : ''}
                  </span>
                </div>
              ) : (
                <div className="terminal-status-pill pill-idle">
                  <Play size={12} fill="currentColor" />
                  <span>Ready to execute</span>
                </div>
              )}

              {/* File Badge */}
              {activeFile && (
                <span className="terminal-meta-chip file-badge" title={`Execution output for: ${activeFile}`}>
                  <FileText size={12} />
                  <span>{activeFile}</span>
                </span>
              )}

              {/* Language Chip */}
              {(executionResult?.language || activeFile) && (
                <span className="terminal-meta-chip lang-badge">
                  <FileCode size={12} />
                  <span>
                    {(
                      executionResult?.language ||
                      (activeFile ? activeFile.split('.').pop() : 'code')
                    ).toUpperCase()}
                  </span>
                </span>
              )}
            </div>

            {/* Metrics Chips (Time, Memory, Timestamp) */}
            {executionResult && !isExecuting && (
              <div className="terminal-metrics-group">
                {executionResult.executionTimeMs !== undefined && (
                  <span className="terminal-metric-chip" title="Execution Time">
                    <Clock size={11} />
                    <span>{executionResult.executionTimeMs} ms</span>
                  </span>
                )}
                {executionResult.memoryKb !== undefined && executionResult.memoryKb !== null && (
                  <span className="terminal-metric-chip" title="Memory Used">
                    <Cpu size={11} />
                    <span>
                      {executionResult.memoryKb > 1024
                        ? `${(executionResult.memoryKb / 1024).toFixed(1)} MB`
                        : `${executionResult.memoryKb} KB`}
                    </span>
                  </span>
                )}
                {executionResult.lastRunTimestamp && (
                  <span
                    className="terminal-metric-chip"
                    title={`Last run at ${new Date(executionResult.lastRunTimestamp).toLocaleString()}`}
                  >
                    <History size={11} />
                    <span>
                      {new Date(executionResult.lastRunTimestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Collapsible Standard Input Drawer */}
          {isStdinOpen && (
            <div className="terminal-stdin-drawer">
              <div className="terminal-stdin-header">
                <div className="stdin-title-wrap">
                  <CornerDownLeft size={13} />
                  <span>Standard Input (stdin)</span>
                </div>
                {stdin && stdin.trim() && (
                  <button
                    type="button"
                    className="stdin-clear-link"
                    onClick={() => onStdinChange && onStdinChange('')}
                  >
                    Clear Input
                  </button>
                )}
              </div>
              <textarea
                className="terminal-stdin-textarea"
                placeholder="Enter input values to feed into standard input (e.g., test cases, strings, numbers)..."
                value={stdin || ''}
                onChange={(e) => onStdinChange && onStdinChange(e.target.value)}
                disabled={isExecuting}
                rows={3}
                spellCheck={false}
              />
            </div>
          )}

          {/* Terminal Output Scroll Area */}
          <div className="terminal-output-scroll">
            {isExecuting ? (
              <div className="terminal-executing-state">
                <div className="terminal-spinner-ring">
                  <Loader2 size={32} className="spinning text-accent" />
                </div>
                <h4>Running in Isolated Container...</h4>
                <p>Sandboxed remote runner is executing your code securely.</p>
              </div>
            ) : !executionResult ? (
              <div className="terminal-idle-card">
                <div className="terminal-idle-icon-wrap">
                  <Terminal size={28} />
                </div>
                <h3>Sandboxed Multi-Language Execution</h3>
                <p>
                  Safely execute Python, Java, C++, C, or JavaScript in an isolated cloud container
                  with zero access to server files or sensitive environments.
                </p>
                <div className="terminal-keybind-hint">
                  <span>Shortcut:</span>
                  <kbd>Ctrl</kbd> + <kbd>Enter</kbd> or click <strong>Run</strong> above
                </div>
                <div className="terminal-supported-languages">
                  <span className="tech-chip">Python 3</span>
                  <span className="tech-chip">Java 15+</span>
                  <span className="tech-chip">C++ (GCC)</span>
                  <span className="tech-chip">C (GCC)</span>
                  <span className="tech-chip">Node.js</span>
                </div>
                {onExecuteCode && (
                  <button
                    type="button"
                    className="btn-terminal-run-hero"
                    onClick={() => onExecuteCode()}
                  >
                    <Play size={14} fill="currentColor" />
                    <span>Run {activeFile || 'Code'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="terminal-results-wrapper">
                {/* 1. Compiler Output (if build/compilation failed) */}
                {executionResult.compileOutput && (
                  <div className="terminal-stream-block stream-compile-error">
                    <div className="stream-header">
                      <div className="stream-label text-danger">
                        <XCircle size={13} />
                        <span>Compilation Diagnostics</span>
                      </div>
                    </div>
                    <pre className="stream-pre pre-compile">{executionResult.compileOutput}</pre>
                  </div>
                )}

                {/* 2. Standard Output */}
                {executionResult.stdout && (
                  <div className="terminal-stream-block stream-stdout">
                    <div className="stream-header">
                      <div className="stream-label text-success">
                        <Terminal size={13} />
                        <span>Standard Output (stdout)</span>
                      </div>
                      <button
                        type="button"
                        className="stream-copy-btn"
                        onClick={handleCopyOutput}
                        title="Copy stdout"
                      >
                        {copiedOutput ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy size={12} />
                        )}
                        <span>{copiedOutput ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <pre className="stream-pre pre-stdout">{executionResult.stdout}</pre>
                  </div>
                )}

                {/* 3. Standard Error / Runtime Diagnostics */}
                {executionResult.stderr && (
                  <div className="terminal-stream-block stream-stderr">
                    <div className="stream-header">
                      <div className="stream-label text-warning">
                        <AlertTriangle size={13} />
                        <span>Standard Error (stderr)</span>
                      </div>
                    </div>
                    <pre className="stream-pre pre-stderr">{executionResult.stderr}</pre>
                  </div>
                )}

                {/* 4. Completely Empty Output case */}
                {!executionResult.compileOutput &&
                  !executionResult.stdout &&
                  !executionResult.stderr && (
                    <div className="terminal-stream-block stream-empty">
                      <CheckCircle2 size={16} className="text-success" />
                      <span>
                        Program exited successfully with status 0 (no output produced).
                      </span>
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Footer Status Bar */}
      <footer className="preview-footer">
        <div className="preview-footer-left">
          {activeTab === 'terminal' ? (
            <>
              <div
                className="security-badge"
                title="Executed in external isolated sandbox - Zero server access"
              >
                <ShieldCheck size={12} className="text-success" />
                <span>Sandboxed Execution (Isolated Runner)</span>
              </div>
              <div className="divider-vertical" />
              <span className="footer-entry-info">
                Target: <code className="entry-filename">{activeFile || 'No file selected'}</code>
              </span>
            </>
          ) : (
            <>
              <div
                className="security-badge"
                title="Executing in safe sandboxed frame without parent access"
              >
                <ShieldCheck size={12} className="text-success" />
                <span>Sandboxed (No Parent Access)</span>
              </div>
              <div className="divider-vertical" />
              <span className="footer-entry-info">
                Entry: <code className="entry-filename">{selectedHtmlFile || 'index.html'}</code>
              </span>
            </>
          )}
        </div>

        <div className="preview-footer-right">
          {activeTab === 'terminal' ? (
            <span className="terminal-provider-badge" title="Execution Engine">
              Provider:{' '}
              <strong>
                {executionResult?.provider === 'judge0'
                  ? 'Judge0 CE'
                  : executionResult?.provider || 'Secure Sandbox'}
              </strong>
            </span>
          ) : (
            <label
              className="auto-run-label"
              title="Automatically re-run sandbox when project files are modified"
            >
              <input
                type="checkbox"
                checked={autoRunOnEdit}
                onChange={(e) => setAutoRunOnEdit(e.target.checked)}
              />
              <span>Auto-run</span>
            </label>
          )}
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
