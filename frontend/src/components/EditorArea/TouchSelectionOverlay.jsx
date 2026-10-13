import './TouchSelectionOverlay.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Scissors, ClipboardPaste, CheckSquare, X } from 'lucide-react';

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
 * - Keyboard-aware action bar with Copy, Cut, Paste, Select All, and Cancel
 * - Safe clipboard fallbacks and accessible 44px tap targets
 */
export default function TouchSelectionOverlay({
  editor,
  monaco,
  readOnly = false,
  keyboardOffset = 0,
  isKeyboardOpen = false
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

  // Action: Select All code in file
  const handleSelectAll = () => {
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const fullRange = model.getFullModelRange();
    editor.setSelection(fullRange);
    setIsActionBarVisible(true);
    showFeedback('Selected all code');
  };

  // Action: Cancel selection
  const handleCancel = () => {
    if (!editor) return;
    const sel = editor.getSelection();
    if (sel) {
      // Collapse selection to cursor at current end position
      editor.setSelection(
        new monaco.Selection(
          sel.endLineNumber,
          sel.endColumn,
          sel.endLineNumber,
          sel.endColumn
        )
      );
    }
    setHandleState(null);
    setIsActionBarVisible(false);
  };

  if (!isTouchDevice || !handleState) {
    return null;
  }

  const { start, end } = handleState;

  // Calculate Action Bar Positioning
  // If keyboard is open, dock above keyboard using --keyboard-offset
  // If keyboard is closed, float above the selection
  const actionBarBottomStyle = isKeyboardOpen
    ? `calc(var(--keyboard-offset, ${keyboardOffset}px) + 50px + env(safe-area-inset-bottom, 0px))`
    : undefined;

  let actionBarTopStyle;
  let actionBarLeftStyle = '50%';

  if (!isKeyboardOpen && start) {
    if (start.top > 64) {
      actionBarTopStyle = `${Math.max(10, start.top - 52)}px`;
      actionBarLeftStyle = `${Math.max(140, start.left)}px`;
    } else if (end) {
      actionBarTopStyle = `${end.top + end.height + 14}px`;
      actionBarLeftStyle = `${Math.max(140, end.left)}px`;
    }
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

      {/* 3. Touch Selection Action Bar */}
      {isActionBarVisible && (
        <div
          className={`touch-selection-action-bar ${isKeyboardOpen ? 'is-docked-above-keyboard' : ''}`}
          style={{
            bottom: actionBarBottomStyle,
            top: !isKeyboardOpen ? actionBarTopStyle : undefined,
            left: actionBarLeftStyle
          }}
          role="toolbar"
          aria-label="Touch code selection actions"
        >
          {/* Feedback notice toast */}
          {feedbackMessage && (
            <div className="touch-selection-toast" role="status">
              {feedbackMessage}
            </div>
          )}

          <div className="touch-action-buttons-group">
            <button
              type="button"
              className="touch-action-btn"
              onClick={handleCopy}
              aria-label="Copy selected code"
              title="Copy"
            >
              <Copy size={15} />
              <span>Copy</span>
            </button>

            {!readOnly && (
              <button
                type="button"
                className="touch-action-btn"
                onClick={handleCut}
                aria-label="Cut selected code"
                title="Cut"
              >
                <Scissors size={15} />
                <span>Cut</span>
              </button>
            )}

            {!readOnly && (
              <button
                type="button"
                className="touch-action-btn"
                onClick={handlePaste}
                aria-label="Paste from clipboard"
                title="Paste"
              >
                <ClipboardPaste size={15} />
                <span>Paste</span>
              </button>
            )}

            <button
              type="button"
              className="touch-action-btn"
              onClick={handleSelectAll}
              aria-label="Select all code in file"
              title="Select All"
            >
              <CheckSquare size={15} />
              <span>Select All</span>
            </button>

            <button
              type="button"
              className="touch-action-btn btn-cancel"
              onClick={handleCancel}
              aria-label="Cancel selection"
              title="Cancel"
            >
              <X size={15} />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
