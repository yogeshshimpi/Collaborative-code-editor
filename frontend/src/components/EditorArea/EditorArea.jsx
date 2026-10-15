import './EditorArea.css';
import { useRef, useEffect, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';
import CodingShortcutToolbar from '../CodingShortcutToolbar/CodingShortcutToolbar';
import TouchSelectionOverlay from './TouchSelectionOverlay';
import { useSettings } from '../../context/useSettings';
import { defineAllMonacoThemes, getMonacoThemeName } from '../../utils/monacoThemes';

// Convert hex color to semi-transparent rgba for clean selection highlight
function hexToRgba(color, alpha = 0.22) {
  if (!color || typeof color !== 'string') return `rgba(109, 93, 252, ${alpha})`;
  if (color.startsWith('rgb')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  let hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) return `rgba(109, 93, 252, ${alpha})`;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function EditorArea({
  content,
  language,
  onChange,
  onCursorChange,
  onCursorActivity,
  layoutTrigger,
  readOnly = false,
  activeFile,
  remoteCursors = {},
  onRun,
  onOpenConsole,
  editorRef: externalEditorRef,
  codeComments = [],
  onGutterCommentClick,
  onAddCommentAtLine
}) {
  const internalEditorRef = useRef(null);
  const editorRef = externalEditorRef || internalEditorRef;
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const commentDecorationsRef = useRef([]);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const onRunRef = useRef(onRun);
  const onGutterCommentClickRef = useRef(onGutterCommentClick);
  const onAddCommentAtLineRef = useRef(onAddCommentAtLine);
  const activeFileRef = useRef(activeFile);
  const { settings } = useSettings();

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    onGutterCommentClickRef.current = onGutterCommentClick;
  }, [onGutterCommentClick]);

  useEffect(() => {
    onAddCommentAtLineRef.current = onAddCommentAtLine;
  }, [onAddCommentAtLine]);

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  // Mobile virtual keyboard & touchscreen states
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const isKeyboardOpenRef = useRef(false);

  useEffect(() => {
    isKeyboardOpenRef.current = isKeyboardOpen;
  }, [isKeyboardOpen]);

  // Calculate active Monaco theme based on project and editor preferences
  const activeMonacoTheme = getMonacoThemeName(
    settings?.project_theme || 'navy',
    settings?.editor_theme || 'dark'
  );

  const handleBeforeMount = useCallback((monaco) => {
    defineAllMonacoThemes(monaco);
  }, []);

  // Dynamically update Monaco editor theme whenever project_theme or editor_theme changes
  useEffect(() => {
    if (monacoRef.current?.editor) {
      defineAllMonacoThemes(monacoRef.current);
      monacoRef.current.editor.setTheme(activeMonacoTheme);
    }
  }, [activeMonacoTheme]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    if (externalEditorRef) {
      externalEditorRef.current = editor;
    }
    monacoRef.current = monaco;
    defineAllMonacoThemes(monaco);
    monaco.editor.setTheme(activeMonacoTheme);
    setIsEditorReady(true);

    // Bind Ctrl+Enter / Cmd+Enter to run code / project
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onRunRef.current) {
        onRunRef.current();
      }
    });

    // Bind Shift+Alt+F to format document
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      const formatAction = editor.getAction('editor.action.formatDocument');
      if (formatAction) {
        formatAction.run();
      }
    });

    // Bind Ctrl+H / Cmd+H to open Find and Replace widget
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH, () => {
      const replaceAction = editor.getAction('editor.action.startFindReplaceAction');
      if (replaceAction) {
        replaceAction.run();
      }
    });

    // Handle gutter clicks for Code Comments
    editor.onMouseDown((e) => {
      if (e.target && e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber;
        if (line) {
          if (onGutterCommentClickRef.current) {
            onGutterCommentClickRef.current(line, activeFileRef.current);
          }
        }
      }
    });

    // Add Code Comment context menu action (supports both single line & multiline selection)
    editor.addAction({
      id: 'add-code-comment',
      label: '💬 Add Code Comment',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyM],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed) => {
        const selection = ed.getSelection();
        const model = ed.getModel();
        if (selection && !selection.isEmpty()) {
          const startLine = Math.min(selection.startLineNumber, selection.endLineNumber);
          const endLine = Math.max(selection.startLineNumber, selection.endLineNumber);
          const snippet = model ? model.getValueInRange(selection) : '';
          if (onAddCommentAtLineRef.current) {
            onAddCommentAtLineRef.current(startLine, activeFileRef.current, endLine, snippet);
          }
        } else {
          const pos = ed.getPosition();
          if (pos && onAddCommentAtLineRef.current) {
            onAddCommentAtLineRef.current(pos.lineNumber, activeFileRef.current);
          }
        }
      }
    });

    // Track focus state for mobile virtual keyboard awareness
    editor.onDidFocusEditorText(() => {
      setIsEditorFocused(true);
    });
    editor.onDidBlurEditorText(() => {
      setIsEditorFocused(false);
    });

    // Track cursor movement for status bar updates & reveal cursor above mobile keyboard
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange({
          line: e.position.lineNumber,
          column: e.position.column
        });
      }

      // If mobile keyboard is open, scroll active cursor line so it is never covered by toolbar/keyboard
      if (isKeyboardOpenRef.current) {
        editor.revealPositionInCenterIfOutsideViewport(e.position);
      }
    });

    // Track cursor movement and text selections for live collaboration broadcasting
    editor.onDidChangeCursorSelection((e) => {
      if (!onCursorActivity) return;
      const position = editor.getPosition();
      const selection = e.selection;
      if (!position) return;

      const hasSelection =
        selection &&
        (selection.startLineNumber !== selection.endLineNumber ||
          selection.startColumn !== selection.endColumn);

      onCursorActivity({
        cursor: {
          line: position.lineNumber,
          column: position.column
        },
        selection: hasSelection
          ? {
              startLineNumber: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLineNumber: selection.endLineNumber,
              endColumn: selection.endColumn
            }
          : null
      });
    });

    // Ensure immediate layout calculation
    editor.layout();
  };

  // Render and synchronize remote collaborator cursors and text selections
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !isEditorReady) return;

    const model = editor.getModel();
    if (!model) return;

    // Respect live cursor toggle from settings
    if (settings?.show_live_cursors === false) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }

    const showLabels = settings?.show_collaborator_labels !== false;
    const maxLine = model.getLineCount();
    const newDecorations = [];
    const styleRules = [];

    // Filter remote cursors to collaborators currently viewing this file
    const cursorEntries = Object.entries(remoteCursors || {}).filter(
      ([, data]) => data && data.fileName === activeFile && data.cursor
    );

    for (const [socketId, data] of cursorEntries) {
      const { cursor, selection, userName, userColor } = data;
      const safeId = String(socketId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const color = userColor || '#6d5dfc';
      const name = userName || 'Collaborator';
      const escapedName = String(name).replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 20);

      // Dynamic CSS rules for this collaborator's caret line, label, and selection highlight
      styleRules.push(`
        .remote-cursor-${safeId} {
          border-left: 2px solid ${color} !important;
        }
        .remote-cursor-${safeId}::after {
          content: "${escapedName}";
          background-color: ${color};
          display: ${showLabels ? 'block' : 'none !important'};
        }
        .remote-selection-${safeId} {
          background-color: ${hexToRgba(color, 0.22)} !important;
        }
      `);

      // 1. Text selection highlight (if any)
      if (selection) {
        const startLine = Math.min(Math.max(1, Number(selection.startLineNumber) || 1), maxLine);
        const startCol = Math.min(Math.max(1, Number(selection.startColumn) || 1), model.getLineMaxColumn(startLine));
        const endLine = Math.min(Math.max(1, Number(selection.endLineNumber) || 1), maxLine);
        const endCol = Math.min(Math.max(1, Number(selection.endColumn) || 1), model.getLineMaxColumn(endLine));

        if (startLine !== endLine || startCol !== endCol) {
          newDecorations.push({
            range: new monaco.Range(startLine, startCol, endLine, endCol),
            options: {
              className: `remote-selection remote-selection-${safeId}`,
              hoverMessage: { value: `${name} (Selecting)` }
            }
          });
        }
      }

      // 2. Cursor caret & floating name badge
      if (cursor) {
        const line = Math.min(Math.max(1, Number(cursor.line) || 1), maxLine);
        const col = Math.min(Math.max(1, Number(cursor.column) || 1), model.getLineMaxColumn(line));

        newDecorations.push({
          range: new monaco.Range(line, col, line, col),
          options: {
            className: `remote-cursor-head remote-cursor-${safeId}${line <= 1 ? ' remote-cursor-top' : ''}`,
            hoverMessage: { value: name }
          }
        });
      }
    }

    // Inject or update dynamic style rules in document head
    let styleEl = document.getElementById('monaco-remote-cursor-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'monaco-remote-cursor-styles';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = styleRules.join('\n');

    // Atomically replace previous decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [remoteCursors, activeFile, isEditorReady, settings?.show_live_cursors, settings?.show_collaborator_labels]);

  // Render Monaco glyph margin comment indicators and line highlights
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !isEditorReady) return;

    const model = editor.getModel();
    if (!model) return;

    const maxLine = model.getLineCount();
    const fileComments = (codeComments || []).filter((c) => c.filePath === activeFile);

    const newCommentDecorations = [];
    fileComments.forEach((c) => {
      const startLine = Math.min(Math.max(1, Number(c.lineNumber) || 1), maxLine);
      const endLine = Math.min(Math.max(startLine, Number(c.endLineNumber) || startLine), maxLine);
      const isResolved = Boolean(c.isResolved);
      const lineRangeLabel = startLine === endLine ? `Line ${startLine}` : `Lines ${startLine}-${endLine}`;

      // Glyph margin indicator on the starting line
      newCommentDecorations.push({
        range: new monaco.Range(startLine, 1, startLine, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: `monaco-comment-glyph-indicator ${isResolved ? 'resolved' : 'open'}`,
          glyphMarginHoverMessage: {
            value: `💬 **Comment on ${lineRangeLabel}** (${isResolved ? 'Resolved' : 'Active'})\nBy: ${c.authorName || 'User'}\n\n${c.content}`
          }
        }
      });

      // Highlight the entire commented line range if open
      if (!isResolved) {
        newCommentDecorations.push({
          range: new monaco.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine)),
          options: {
            isWholeLine: true,
            className: 'monaco-comment-line-highlight'
          }
        });
      }
    });

    commentDecorationsRef.current = editor.deltaDecorations(
      commentDecorationsRef.current,
      newCommentDecorations
    );
  }, [codeComments, activeFile, isEditorReady]);

  // Clean up decorations and styles on file change or unmount
  useEffect(() => {
    return () => {
      if (editorRef.current && decorationsRef.current.length > 0) {
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      }
      if (editorRef.current && commentDecorationsRef.current.length > 0) {
        commentDecorationsRef.current = editorRef.current.deltaDecorations(
          commentDecorationsRef.current,
          []
        );
      }
      const styleEl = document.getElementById('monaco-remote-cursor-styles');
      if (styleEl) {
        styleEl.textContent = '';
      }
    };
  }, [activeFile]);

  // Recalculate Monaco layout when layoutTrigger (e.g. sidebar open/close) changes
  useEffect(() => {
    if (editorRef.current) {
      // Trigger immediately and after drawer animation completes
      editorRef.current.layout();
      const timer = setTimeout(() => {
        editorRef.current?.layout();
      }, 260);
      return () => clearTimeout(timer);
    }
  }, [layoutTrigger]);

  const [isMobileScreen, setIsMobileScreen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024
  );

  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('codecollab_mobile_toolbar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleToolbar = useCallback(() => {
    setIsToolbarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('codecollab_mobile_toolbar_collapsed', String(next));
      } catch {}
      return next;
    });
  }, []);

  // Recalculate Monaco layout when toolbar collapse state changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.layout();
      const timer = setTimeout(() => {
        editorRef.current?.layout();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isToolbarCollapsed]);

  // Visual Viewport API: Keyboard-aware overlap calculation for mobile & tablet touchscreen devices
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkVisualViewport = () => {
      const isTouchOrSmall =
        window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth < 1024 ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;

      if (!isTouchOrSmall) {
        setKeyboardOffset(0);
        setIsKeyboardOpen(false);
        document.documentElement.style.removeProperty('--keyboard-offset');
        return;
      }

      if (window.visualViewport) {
        const vv = window.visualViewport;
        // Calculate the keyboard overlap: window.innerHeight - visualViewport.height - offsetTop
        const rawOverlap = window.innerHeight - vv.height - (vv.offsetTop || 0);
        // Safe clamp: Ignore subtle address bar height collapse (< 40px)
        const clampedOffset = rawOverlap > 40 ? Math.max(0, Math.round(rawOverlap)) : 0;
        const keyboardActive = clampedOffset > 0;

        setKeyboardOffset(clampedOffset);
        setIsKeyboardOpen(keyboardActive);

        // Store safe clamped value in CSS custom property --keyboard-offset
        if (keyboardActive) {
          document.documentElement.style.setProperty('--keyboard-offset', `${clampedOffset}px`);
        } else {
          document.documentElement.style.setProperty('--keyboard-offset', '0px');
        }

        // Layout editor and reveal cursor if keyboard popped up
        if (editorRef.current) {
          editorRef.current.layout();
          if (keyboardActive) {
            const pos = editorRef.current.getPosition();
            if (pos) {
              editorRef.current.revealPositionInCenterIfOutsideViewport(pos);
            }
          }
        }
      }
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', checkVisualViewport);
      vv.addEventListener('scroll', checkVisualViewport);
    }
    window.addEventListener('resize', checkVisualViewport);
    window.addEventListener('orientationchange', checkVisualViewport);

    // Initial check
    checkVisualViewport();

    return () => {
      if (vv) {
        vv.removeEventListener('resize', checkVisualViewport);
        vv.removeEventListener('scroll', checkVisualViewport);
      }
      window.removeEventListener('resize', checkVisualViewport);
      window.removeEventListener('orientationchange', checkVisualViewport);
      document.documentElement.style.removeProperty('--keyboard-offset');
    };
  }, [editorRef]);

  // Recalculate on window resize and mobile orientation change
  useEffect(() => {
    const handleLayoutRecalc = () => {
      if (typeof window !== 'undefined') {
        setIsMobileScreen(window.innerWidth < 1024);
      }
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    window.addEventListener('resize', handleLayoutRecalc);
    window.addEventListener('orientationchange', handleLayoutRecalc);
    return () => {
      window.removeEventListener('resize', handleLayoutRecalc);
      window.removeEventListener('orientationchange', handleLayoutRecalc);
    };
  }, []);

  const isTouchDevice =
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 1024 ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0);

  // Active keyboard-docked state: mobile/tablet device with virtual keyboard active or focused with offset
  const isKeyboardDocked =
    Boolean(isTouchDevice && (isKeyboardOpen || (isEditorFocused && keyboardOffset > 0)));

  return (
    <div
      className={`editor-area-container ${isKeyboardDocked ? 'is-keyboard-docked' : ''}`}
      style={{
        '--keyboard-offset': `${keyboardOffset}px`
      }}
    >
      <div
        className="monaco-viewport-wrapper"
        style={{
          paddingBottom: !isToolbarCollapsed && isKeyboardDocked ? '56px' : undefined,
          boxSizing: 'border-box'
        }}
      >
        <Editor
          height="100%"
          width="100%"
          language={language}
          value={content}
          theme={activeMonacoTheme}
          beforeMount={handleBeforeMount}
          onChange={onChange}
          onMount={handleEditorDidMount}
          loading={
            <div className="editor-loader">
              <Loader2 className="spinner" size={24} />
              <span>Loading Monaco Editor...</span>
            </div>
          }
          options={{
            fontSize: settings?.editor_font_size ? Number(settings.editor_font_size) : (isMobileScreen ? 12.5 : 13.5),
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            minimap: {
              enabled: !isMobileScreen && settings?.show_minimap !== false,
              side: 'right'
            },
            lineNumbers: settings?.show_line_numbers === false ? 'off' : 'on',
            lineNumbersMinChars: isMobileScreen ? 2 : 3,
            glyphMargin: true,
            folding: !isMobileScreen,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: Number(settings?.tab_size) === 4 ? 4 : 2,
            wordWrap: settings?.word_wrap === false ? 'off' : 'on',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'all',
            renderWhitespace: 'selection',
            padding: {
              top: isMobileScreen ? 6 : 10,
              bottom: !isToolbarCollapsed && isKeyboardDocked ? 56 : (isMobileScreen ? 6 : 10)
            },
            bracketPairColorization: { enabled: true },
            readOnly: Boolean(readOnly),
            domReadOnly: Boolean(readOnly),
            accessibilitySupport: 'auto',
            contextmenu: true,
            quickSuggestions: true,
            selectionHighlight: true,
            selectOnLineNumbers: true
          }}
        />

        {/* Mobile & Tablet Touch Selection Handles & Clipboard Action Bar */}
        <TouchSelectionOverlay
          editor={isEditorReady ? editorRef.current : null}
          monaco={isEditorReady ? monacoRef.current : null}
          readOnly={readOnly}
          keyboardOffset={keyboardOffset}
          isKeyboardOpen={isKeyboardOpen}
          onAddComment={onAddCommentAtLine}
          activeFile={activeFile}
        />
      </div>

      {/* CodeCollab Coding Shortcut Toolbar for All Screen Sizes */}
      <CodingShortcutToolbar
        editorRef={editorRef}
        readOnly={readOnly}
        isCollapsed={isToolbarCollapsed}
        onToggleCollapse={handleToggleToolbar}
        onRun={onRun}
        onOpenConsole={onOpenConsole}
        isKeyboardDocked={isKeyboardDocked}
        keyboardOffset={keyboardOffset}
      />
    </div>
  );
}

