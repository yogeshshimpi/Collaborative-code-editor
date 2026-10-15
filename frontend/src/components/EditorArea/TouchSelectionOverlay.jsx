import './TouchSelectionOverlay.css';
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * TouchSelectionOverlay
 * Professional mobile and tablet multi-line touch selection and clipboard
 * action bar for Monaco Editor.
 *
 * Features:
 * - Detects long press only on touch/coarse devices without interfering with normal taps or scrolling
 * - Renders draggable teardrop Start and End handles for multi-line selection
 * - Converts touch coordinates to editor positions via editor.getTargetAtClientPoint
 * - Smooth auto-scrolling when dragging handles near top/bottom edges
 * - Keyboard-aware action bar with Copy, Cut, Paste, Comment, Select All, and Cancel
 * - Safe clipboard fallbacks and accessible 44px tap targets
 */
export default function TouchSelectionOverlay({
  editor,
  monaco,
  readOnly = false,
  keyboardOffset = 0,
  isKeyboardOpen = false,
  onAddComment,
  activeFile = ''
}) {
  const [handleState, setHandleState] = useState(null);
  const [activeDragHandle, setActiveDragHandle] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [isActionBarVisible, setIsActionBarVisible] = useState(false);
  const feedbackTimerRef = useRef(null);

  // Check if current device has touch/coarse pointer
  const isTouchDevice =
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.innerWidth < 1024 ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0);

  // Show transient user feedback toast
  const showFeedback = useCallback((msg) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedbackMessage(msg);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackMessage(null);
      feedbackTimerRef.current = null;
    }, 2200);
  }, []);

  // Update screen coordinates for start and end handles
  const updateHandlePositions = useCallback(() => {
    if (!editor || !monaco) return;
    const sel = editor.getSelection();

    if (!sel || sel.isEmpty()) {
      setHandleState(null);
      setIsActionBarVisible(false);
      return;
    }

    const startPos = sel.getStartPosition();
    const endPos = sel.getEndPosition();

    const startCoord = editor.getScrolledVisiblePosition(startPos);
    const endCoord = editor.getScrolledVisiblePosition(endPos);

    setHandleState({
      start: startCoord
        ? {
            top: startCoord.top,
            left: startCoord.left,
            height: startCoord.height || 18
          }
        : null,
      end: endCoord
        ? {
            top: endCoord.top,
            left: endCoord.left,
            height: endCoord.height || 18
          }
        : null,
      selection: sel
    });
  }, [editor, monaco]);

  // Listen to Monaco selection & scroll changes to keep handles synchronized
  useEffect(() => {
    if (!editor) return;

    const selSub = editor.onDidChangeCursorSelection(() => {
      const sel = editor.getSelection();
      if (sel && !sel.isEmpty()) {
        setIsActionBarVisible(true);
      }
      updateHandlePositions();
    });

    const scrollSub = editor.onDidScrollChange(() => {
      updateHandlePositions();
    });

    const blurSub = editor.onDidBlurEditorText(() => {
      // Delay closing slightly so tapping action bar buttons doesn't immediately dismiss
      setTimeout(() => {
        if (!document.activeElement?.closest?.('.touch-selection-action-bar')) {
          setHandleState(null);
          setIsActionBarVisible(false);
        }
      }, 180);
    });

    return () => {
      selSub.dispose();
      scrollSub.dispose();
      blurSub.dispose();
    };
  }, [editor, updateHandlePositions]);

  // Detect long press on touchscreen to initiate word selection & action bar
  useEffect(() => {
    if (!editor || !monaco || !isTouchDevice) return;
    const domNode = editor.getDomNode();
    if (!domNode) return;

    let timer = null;
    let touchStartCoord = null;

    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartCoord = { x: touch.clientX, y: touch.clientY };

      timer = setTimeout(() => {
        timer = null;
        if (!touchStartCoord) return;

        // Long press detected: resolve editor position from client point
        const target = editor.getTargetAtClientPoint(touchStartCoord.x, touchStartCoord.y);
        if (target && target.position) {
          const model = editor.getModel();
          if (!model) return;

          // Select current word at position or character range
          const word = model.getWordAtPosition(target.position);
          let newSel;
          if (word) {
            newSel = new monaco.Selection(
              target.position.lineNumber,
              word.startColumn,
              target.position.lineNumber,
              word.endColumn
            );
          } else {
            const maxCol = model.getLineMaxColumn(target.position.lineNumber);
            const startCol = Math.max(1, target.position.column - 1);
            const endCol = Math.min(maxCol, target.position.column + 1);
            newSel = new monaco.Selection(
              target.position.lineNumber,
              startCol,
              target.position.lineNumber,
              endCol
            );
          }

          editor.setSelection(newSel);
          setIsActionBarVisible(true);

          // Subtle haptic vibration if supported
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate(25);
            } catch {}
          }
        }
      }, 450);
    };

    const handleTouchMove = (e) => {
      if (!timer || !touchStartCoord || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartCoord.x);
      const dy = Math.abs(touch.clientY - touchStartCoord.y);

      // Cancel long press if finger moves more than 8px (scrolling)
      if (dx > 8 || dy > 8) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const handleTouchEnd = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    domNode.addEventListener('touchstart', handleTouchStart, { passive: true });
    domNode.addEventListener('touchmove', handleTouchMove, { passive: true });
    domNode.addEventListener('touchend', handleTouchEnd, { passive: true });
    domNode.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      if (timer) clearTimeout(timer);
      domNode.removeEventListener('touchstart', handleTouchStart);
      domNode.removeEventListener('touchmove', handleTouchMove);
      domNode.removeEventListener('touchend', handleTouchEnd);
      domNode.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [editor, monaco, isTouchDevice]);

  // Handle dragging Start Handle or End Handle across multiple lines
  const startHandleDrag = useCallback(
    (handleType) => (e) => {
      if (!editor || !monaco) return;
      e.preventDefault();
      e.stopPropagation();

      setActiveDragHandle(handleType);
      let currentDragType = handleType;

      const onPointerMove = (moveEvent) => {
        const clientX = moveEvent.clientX ?? moveEvent.touches?.[0]?.clientX;
        const clientY = moveEvent.clientY ?? moveEvent.touches?.[0]?.clientY;
        if (clientX == null || clientY == null) return;

        // Auto-scroll when dragging near editor top or bottom edges
        const domNode = editor.getDomNode();
        if (domNode) {
          const rect = domNode.getBoundingClientRect();
          const edgeThreshold = 44;
          if (clientY < rect.top + edgeThreshold) {
            editor.setScrollTop(editor.getScrollTop() - 14);
          } else if (clientY > rect.bottom - edgeThreshold) {
            editor.setScrollTop(editor.getScrollTop() + 14);
          }
        }

        const target = editor.getTargetAtClientPoint(clientX, clientY);
        if (!target || !target.position) return;

        const sel = editor.getSelection();
        if (!sel) return;

        let startLine = sel.startLineNumber;
        let startCol = sel.startColumn;
        let endLine = sel.endLineNumber;
        let endCol = sel.endColumn;

        const targetLine = target.position.lineNumber;
        const targetCol = target.position.column;

        if (currentDragType === 'start') {
          startLine = targetLine;
          startCol = targetCol;

          // If start handle is dragged past the end handle, dynamically flip
          if (startLine > endLine || (startLine === endLine && startCol > endCol)) {
            const swapLine = endLine;
            const swapCol = endCol;
            endLine = startLine;
            endCol = startCol;
            startLine = swapLine;
            startCol = swapCol;
            currentDragType = 'end';
            setActiveDragHandle('end');
          }
        } else {
          endLine = targetLine;
          endCol = targetCol;

          // If end handle is dragged before the start handle, dynamically flip
          if (endLine < startLine || (endLine === startLine && endCol < startCol)) {
            const swapLine = startLine;
            const swapCol = startCol;
            startLine = endLine;
            startCol = endCol;
            endLine = swapLine;
            endCol = swapCol;
            currentDragType = 'start';
            setActiveDragHandle('start');
          }
        }

        const newSel = new monaco.Selection(startLine, startCol, endLine, endCol);
        editor.setSelection(newSel);
        setIsActionBarVisible(true);
      };

      const onPointerUp = () => {
        setActiveDragHandle(null);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
        window.removeEventListener('touchcancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: false });
      window.addEventListener('pointercancel', onPointerUp, { passive: false });
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp, { passive: false });
      window.addEventListener('touchcancel', onPointerUp, { passive: false });
    },
    [editor, monaco]
  );

  // Action: Copy selected text
  const handleCopy = async () => {
    if (!editor) return;
    const sel = editor.getSelection();
    const model = editor.getModel();
    if (!sel || !model || sel.isEmpty()) return;

    const text = model.getValueInRange(sel);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showFeedback('Copied to clipboard');
      } else {
        editor.focus();
        editor.trigger('touch-bar', 'editor.action.clipboardCopyAction');
        showFeedback('Copied');
      }
    } catch {
      // Safe fallback using Monaco copy command
      editor.focus();
      editor.trigger('touch-bar', 'editor.action.clipboardCopyAction');
      showFeedback('Copied');
    }
  };

  // Action: Cut selected text (only removes text after copy succeeds)
  const handleCut = async () => {
    if (!editor || readOnly) return;
    const sel = editor.getSelection();
    const model = editor.getModel();
    if (!sel || !model || sel.isEmpty()) return;

    const text = model.getValueInRange(sel);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        editor.focus();
        editor.trigger('touch-bar', 'editor.action.clipboardCopyAction');
      }

      // Remove selected text only after clipboard write succeeds
      editor.executeEdits('touch-cut', [
        {
          range: sel,
          text: '',
          forceMoveMarkers: true
        }
      ]);
      showFeedback('Cut to clipboard');
      setIsActionBarVisible(false);
      setHandleState(null);
    } catch {
      showFeedback('Cut failed: clipboard access denied');
    }
  };

  // Action: Paste text at selection
  const handlePaste = async () => {
    if (!editor || readOnly) return;

    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const sel = editor.getSelection() || editor.getPosition();
          editor.executeEdits('touch-paste', [
            {
              range: sel,
              text,
              forceMoveMarkers: true
            }
          ]);
          editor.focus();
          showFeedback('Pasted from clipboard');
          setIsActionBarVisible(false);
          setHandleState(null);
        } else {
          showFeedback('Clipboard is empty');
        }
      } else {
        showFeedback('Use your keyboard or browser Paste option.');
      }
    } catch {
      showFeedback('Use your keyboard or browser Paste option.');
    }
  };

  // Action: Run any Monaco action or command
  const handleMonacoAction = useCallback(
    (actionId) => {
      if (!editor) return;
      try {
        const action = editor.getAction(actionId);
        if (action) {
          action.run();
        } else {
          editor.trigger('touch-context-menu', actionId, null);
        }
      } catch (err) {
        console.warn(`Action ${actionId} failed:`, err);
      }
      setHandleState(null);
      setIsActionBarVisible(false);
    },
    [editor]
  );

  // Dismiss context menu
  const handleDismissMenu = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsActionBarVisible(false);
  }, []);

  // Action: Add code comment on selected code range or current line
  const handleComment = useCallback(() => {
    if (!editor || !onAddComment) return;
    const sel = editor.getSelection();
    const model = editor.getModel();

    if (sel && !sel.isEmpty()) {
      const startLine = Math.min(sel.startLineNumber, sel.endLineNumber);
      const endLine = Math.max(sel.startLineNumber, sel.endLineNumber);
      const selectedText = model ? model.getValueInRange(sel) : '';
      onAddComment(startLine, activeFile, endLine, selectedText);
    } else {
      const pos = editor.getPosition();
      const line = pos ? pos.lineNumber : 1;
      const lineText = model ? model.getLineContent(line) : '';
      onAddComment(line, activeFile, line, lineText);
    }
    setHandleState(null);
    setIsActionBarVisible(false);
  }, [editor, onAddComment, activeFile]);

  if (!isTouchDevice || !handleState) {
    return null;
  }

  const { start, end } = handleState;

  // Calculate Vertical Context Menu Positioning
  let menuStyle = {};

  if (isKeyboardOpen) {
    menuStyle = {
      position: 'fixed',
      bottom: `calc(var(--keyboard-offset, ${keyboardOffset}px) + 12px + env(safe-area-inset-bottom, 0px))`,
      left: '50%',
      transform: 'translateX(-50%)'
    };
  } else if (start) {
    const domNode = editor?.getDomNode?.();
    const containerW = domNode ? domNode.clientWidth : (typeof window !== 'undefined' ? window.innerWidth : 360);
    const containerH = domNode ? domNode.clientHeight : (typeof window !== 'undefined' ? window.innerHeight : 640);
    const menuWidth = 260;
    const halfWidth = menuWidth / 2;

    const startY = start.top;
    const endY = end ? end.top + end.height : start.top + 20;

    let topPos;
    let bottomPos;

    // Check if there is enough space below the end coordinate for the menu
    if (containerH - endY >= 350 || endY < containerH / 2) {
      topPos = `${endY + 6}px`;
    } else {
      bottomPos = `calc(100% - ${Math.max(6, startY - 6)}px)`;
    }

    const touchX = start.left || containerW / 2;
    const clampedCenterX = Math.min(
      Math.max(halfWidth + 8, touchX),
      containerW - halfWidth - 8
    );

    menuStyle = {
      top: topPos,
      bottom: bottomPos,
      left: `${clampedCenterX}px`,
      transform: 'translateX(-50%)'
    };
  }

  return (
    <div className="touch-selection-overlay" aria-hidden="true">
      {/* 1. Start Handle (Draggable Teardrop) */}
      {start && (
        <div
          className={`touch-selection-handle touch-handle-start ${
            activeDragHandle === 'start' ? 'is-dragging' : ''
          }`}
          style={{
            top: `${start.top}px`,
            left: `${start.left}px`,
            height: `${start.height}px`
          }}
        >
          <div className="handle-caret-line" />
          <div className="handle-teardrop-pin teardrop-top" />
          <div
            className="handle-touch-target"
            onPointerDown={startHandleDrag('start')}
            onTouchStart={startHandleDrag('start')}
            role="button"
            tabIndex={-1}
            aria-label="Drag start of code selection"
          />
        </div>
      )}

      {/* 2. End Handle (Draggable Teardrop) */}
      {end && (
        <div
          className={`touch-selection-handle touch-handle-end ${
            activeDragHandle === 'end' ? 'is-dragging' : ''
          }`}
          style={{
            top: `${end.top}px`,
            left: `${end.left}px`,
            height: `${end.height}px`
          }}
        >
          <div className="handle-caret-line" />
          <div className="handle-teardrop-pin teardrop-bottom" />
          <div
            className="handle-touch-target"
            onPointerDown={startHandleDrag('end')}
            onTouchStart={startHandleDrag('end')}
            role="button"
            tabIndex={-1}
            aria-label="Drag end of code selection"
          />
        </div>
      )}

      {/* 3. Invisible Backdrop to dismiss context menu on tap outside */}
      {isActionBarVisible && !activeDragHandle && (
        <div
          className="touch-context-menu-backdrop"
          onClick={handleDismissMenu}
          onTouchStart={handleDismissMenu}
        />
      )}

      {/* 4. Exact Monaco/VS Code Right Click Context Menu */}
      {isActionBarVisible && !activeDragHandle && (
        <div
          className={`touch-selection-action-bar ${isKeyboardOpen ? 'is-docked-above-keyboard' : ''}`}
          style={menuStyle}
          role="toolbar"
          aria-label="Touch code selection context menu"
        >
          {/* Transient feedback toast */}
          {feedbackMessage && (
            <div className="touch-selection-toast" role="status">
              {feedbackMessage}
            </div>
          )}

          <div className="touch-context-menu" role="menu" aria-label="Editor Context Menu">
            {/* Group 1: Navigation & Commenting */}
            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleMonacoAction('editor.action.revealDefinition')}
              role="menuitem"
            >
              <span className="context-item-label">Go to Definition</span>
              <span className="context-item-shortcut">Ctrl+F12</span>
            </button>

            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleMonacoAction('editor.action.goToReferences')}
              role="menuitem"
            >
              <span className="context-item-label">Go to References</span>
              <span className="context-item-shortcut">Shift+F12</span>
            </button>

            <button
              type="button"
              className="context-menu-item item-comment-action"
              onClick={handleComment}
              role="menuitem"
            >
              <div className="context-item-left">
                <span className="context-item-emoji">💬</span>
                <span className="context-item-label">Add Code Comment</span>
              </div>
              <span className="context-item-shortcut">Ctrl+Alt+M</span>
            </button>

            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleMonacoAction('editor.action.quickOutline')}
              role="menuitem"
            >
              <span className="context-item-label">Go to Symbol...</span>
              <span className="context-item-shortcut">Ctrl+Shift+O</span>
            </button>

            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleMonacoAction('editor.action.peekDefinition')}
              role="menuitem"
            >
              <span className="context-item-label">Peek</span>
              <span className="context-item-chevron">&gt;</span>
            </button>

            <div className="context-menu-divider" />

            {/* Group 2: Symbol & Code Formatting */}
            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleMonacoAction('editor.action.rename')}
              disabled={readOnly}
              role="menuitem"
            >
              <span className="context-item-label">Rename Symbol</span>
              <span className="context-item-shortcut">F2</span>
            </button>

            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleMonacoAction('editor.action.changeAll')}
              disabled={readOnly}
              role="menuitem"
            >
              <span className="context-item-label">Change All Occurrences</span>
              <span className="context-item-shortcut">Ctrl+F2</span>
            </button>

            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleMonacoAction('editor.action.formatDocument')}
              disabled={readOnly}
              role="menuitem"
            >
              <span className="context-item-label">Format Document</span>
              <span className="context-item-shortcut">Ctrl+Shift+I</span>
            </button>

            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleMonacoAction('editor.action.formatSelection')}
              disabled={readOnly}
              role="menuitem"
            >
              <span className="context-item-label">Format Selection</span>
              <span className="context-item-shortcut">Ctrl+K Ctrl+F</span>
            </button>

            <div className="context-menu-divider" />

            {/* Group 3: Clipboard Actions */}
            <button
              type="button"
              className="context-menu-item"
              onClick={handleCut}
              disabled={readOnly}
              role="menuitem"
            >
              <span className="context-item-label">Cut</span>
            </button>

            <button
              type="button"
              className="context-menu-item"
              onClick={handleCopy}
              role="menuitem"
            >
              <span className="context-item-label">Copy</span>
            </button>

            <div className="context-menu-divider" />

            {/* Group 4: Command Palette */}
            <button
              type="button"
              className="context-menu-item"
              onClick={() => handleMonacoAction('editor.action.quickCommand')}
              role="menuitem"
            >
              <span className="context-item-label">Command Palette</span>
              <span className="context-item-shortcut">F1</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
