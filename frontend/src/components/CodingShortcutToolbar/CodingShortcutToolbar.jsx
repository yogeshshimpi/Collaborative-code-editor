import './CodingShortcutToolbar.css';
import { useCallback, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Code2
} from 'lucide-react';

/**
 * CodeCollab Coding Shortcut Toolbar
 * Professional coding shortcut toolbar inspired by competitive-programming editors.
 * Works seamlessly across all devices: desktop, laptop, tablet, and mobile.
 *
 * Features:
 * - Organized into distinct logical groups for rapid access:
 *   1. Brackets & Delimiters (Separate open & close brackets + paired wrappers)
 *   2. Quotes & Strings
 *   3. Indentation & Navigation
 *   4. Operators & Arrows
 *   5. Punctuation, Logic & Syntax
 * - Separate open and close brackets ({, }, (, ), [, ], <, >)
 * - Quick toolbar collapse & floating restore pill
 */
export default function CodingShortcutToolbar({
  editorRef,
  readOnly = false,
  isCollapsed = false,
  onToggleCollapse,
  isKeyboardDocked = false,
  keyboardOffset = 0
}) {
  const scrollContainerRef = useRef(null);

  // Horizontal mouse wheel scrolling for the toolbar
  const handleWheel = useCallback((e) => {
    if (scrollContainerRef.current && e.deltaY !== 0 && !e.deltaX) {
      scrollContainerRef.current.scrollLeft += e.deltaY * 0.8;
    }
  }, []);

  // Prevent mouse down from stealing focus from Monaco Editor on desktop
  // On touchscreen devices, do not call preventDefault on touchstart so click fires reliably
  const preventBlur = useCallback((e) => {
    if (e.type === 'mousedown') {
      e.preventDefault();
    }
  }, []);

  // Insert plain character or text snippet at cursor
  const handleInsert = useCallback(
    (text) => {
      const editor = editorRef?.current;
      if (!editor || readOnly) return;

      const selection = editor.getSelection();
      if (!selection) return;

      editor.executeEdits('shortcut-toolbar', [
        {
          range: selection,
          text,
          forceMoveMarkers: true
        }
      ]);
      editor.focus();
    },
    [editorRef, readOnly]
  );

  // Handle separate open bracket: wraps selection if non-empty; inserts openChar if empty
  const handleOpenBracket = useCallback(
    (openChar, closeChar) => {
      const editor = editorRef?.current;
      if (!editor || readOnly) return;

      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model) return;

      if (!selection.isEmpty()) {
        const selectedText = model.getValueInRange(selection);
        editor.executeEdits('shortcut-toolbar', [
          {
            range: selection,
            text: `${openChar}${selectedText}${closeChar}`,
            forceMoveMarkers: true
          }
        ]);
      } else {
        editor.executeEdits('shortcut-toolbar', [
          {
            range: selection,
            text: openChar,
            forceMoveMarkers: true
          }
        ]);
      }
      editor.focus();
    },
    [editorRef, readOnly]
  );

  // Handle separate close bracket: inserts closeChar at cursor or replaces selection
  const handleCloseBracket = useCallback(
    (closeChar) => {
      const editor = editorRef?.current;
      if (!editor || readOnly) return;

      const selection = editor.getSelection();
      if (!selection) return;

      editor.executeEdits('shortcut-toolbar', [
        {
          range: selection,
          text: closeChar,
          forceMoveMarkers: true
        }
      ]);
      editor.focus();
    },
    [editorRef, readOnly]
  );

  // Smart wrap selection or insert pair and position cursor inside
  const handleInsertPair = useCallback(
    (openChar, closeChar) => {
      const editor = editorRef?.current;
      if (!editor || readOnly) return;

      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model) return;

      if (!selection.isEmpty()) {
        const selectedText = model.getValueInRange(selection);
        editor.executeEdits('shortcut-toolbar', [
          {
            range: selection,
            text: `${openChar}${selectedText}${closeChar}`,
            forceMoveMarkers: true
          }
        ]);
      } else {
        const pos = editor.getPosition();
        editor.executeEdits('shortcut-toolbar', [
          {
            range: selection,
            text: `${openChar}${closeChar}`,
            forceMoveMarkers: true
          }
        ]);
        if (pos) {
          editor.setPosition({
            lineNumber: pos.lineNumber,
            column: pos.column + openChar.length
          });
        }
      }
      editor.focus();
    },
    [editorRef, readOnly]
  );

  // Insert Tab (2 spaces indentation)
  const handleTab = useCallback(() => {
    handleInsert('  ');
  }, [handleInsert]);

  // Move cursor left by 1 character
  const handleMoveCursorLeft = useCallback(() => {
    const editor = editorRef?.current;
    if (!editor) return;
    const pos = editor.getPosition();
    if (!pos) return;
    if (pos.column > 1) {
      editor.setPosition({
        lineNumber: pos.lineNumber,
        column: pos.column - 1
      });
    } else if (pos.lineNumber > 1) {
      const model = editor.getModel();
      const prevLineLength = model ? model.getLineLength(pos.lineNumber - 1) : 1;
      editor.setPosition({
        lineNumber: pos.lineNumber - 1,
        column: prevLineLength + 1
      });
    }
    editor.focus();
  }, [editorRef]);

  // Move cursor right by 1 character
  const handleMoveCursorRight = useCallback(() => {
    const editor = editorRef?.current;
    if (!editor) return;
    const pos = editor.getPosition();
    const model = editor.getModel();
    if (!pos || !model) return;

    const lineLength = model.getLineLength(pos.lineNumber);
    if (pos.column <= lineLength) {
      editor.setPosition({
        lineNumber: pos.lineNumber,
        column: pos.column + 1
      });
    } else if (pos.lineNumber < model.getLineCount()) {
      editor.setPosition({
        lineNumber: pos.lineNumber + 1,
        column: 1
      });
    }
    editor.focus();
  }, [editorRef]);

  // If toolbar is hidden, render floating restore pill
  if (isCollapsed) {
    return (
      <div
        className={`coding-toolbar-restore-wrap mobile-toolbar-restore-wrap ${
          isKeyboardDocked ? 'is-keyboard-docked' : ''
        }`}
        style={
          isKeyboardDocked
            ? {
                bottom: `calc(var(--keyboard-offset, ${keyboardOffset}px) + 8px + env(safe-area-inset-bottom, 0px))`
              }
            : undefined
        }
      >
        <button
          type="button"
          className="coding-toolbar-restore-pill mobile-toolbar-restore-pill"
          onClick={onToggleCollapse}
          onMouseDown={preventBlur}
          onTouchStart={preventBlur}
          title="Restore Coding Shortcut Toolbar"
          aria-label="Restore Coding Shortcut Toolbar"
        >
          <Code2 size={13} className="restore-icon" />
          <span className="restore-text">&#123; &#125; Shortcuts</span>
          <ChevronUp size={13} />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`coding-shortcut-toolbar mobile-coding-toolbar ${
        isKeyboardDocked ? 'is-keyboard-docked' : ''
      }`}
      role="toolbar"
      aria-label="CodeCollab Coding Shortcut Toolbar"
      style={
        isKeyboardDocked
          ? {
              bottom: `calc(var(--keyboard-offset, ${keyboardOffset}px) + env(safe-area-inset-bottom, 0px))`
            }
          : undefined
      }
    >
      {/* -------------------------------------------------------------
          0. TOOLBAR CONTROLS: [ Hide Toolbar ]
          ------------------------------------------------------------- */}
      <div className="shortcut-toolbar-controls">
        <button
          type="button"
          className="shortcut-action-btn btn-hide-toolbar"
          onClick={onToggleCollapse}
          onMouseDown={preventBlur}
          onTouchStart={preventBlur}
          title="Hide Coding Shortcut Toolbar"
          aria-label="Hide Toolbar"
        >
          <ChevronDown size={14} className="action-icon" />
          <span className="action-label">Hide Toolbar</span>
        </button>
      </div>

      <div className="shortcut-toolbar-divider" />

      {/* -------------------------------------------------------------
          LOGICAL CODING SHORTCUT GROUPS
          ------------------------------------------------------------- */}
      <div
        className="shortcut-toolbar-symbols-scroll"
        ref={scrollContainerRef}
        onWheel={handleWheel}
      >
        {/* 1. BRACKETS & DELIMITERS GROUP */}
        <div className="shortcut-group group-brackets" role="group" aria-label="Brackets">
          {/* Paired convenience brackets */}
          <button
            type="button"
            className="shortcut-btn btn-pair"
            onClick={() => handleInsertPair('{', '}')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Curly braces pair { }"
            aria-label="Curly braces pair"
            disabled={readOnly}
          >
            {'{ }'}
          </button>
          <button
            type="button"
            className="shortcut-btn btn-pair"
            onClick={() => handleInsertPair('(', ')')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Parentheses pair ( )"
            aria-label="Parentheses pair"
            disabled={readOnly}
          >
            ( )
          </button>
          <button
            type="button"
            className="shortcut-btn btn-pair"
            onClick={() => handleInsertPair('[', ']')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Square brackets pair [ ]"
            aria-label="Square brackets pair"
            disabled={readOnly}
          >
            [ ]
          </button>

          {/* Angle brackets: < and > */}
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleOpenBracket('<', '>')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Open angle bracket <"
            aria-label="Open angle bracket <"
            disabled={readOnly}
          >
            &lt;
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleCloseBracket('>')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Close angle bracket >"
            aria-label="Close angle bracket >"
            disabled={readOnly}
          >
            &gt;
          </button>
        </div>

        <div className="shortcut-toolbar-divider" />

        {/* 2. QUOTES GROUP */}
        <div className="shortcut-group group-quotes" role="group" aria-label="Quotes">
          <button
            type="button"
            className="shortcut-btn btn-pair"
            onClick={() => handleInsertPair('"', '"')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Double quotes &quot;"
            aria-label="Double quotes"
            disabled={readOnly}
          >
            &quot;
          </button>
          <button
            type="button"
            className="shortcut-btn btn-pair"
            onClick={() => handleInsertPair("'", "'")}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Single quote '"
            aria-label="Single quote"
            disabled={readOnly}
          >
            &apos;
          </button>
          <button
            type="button"
            className="shortcut-btn btn-pair"
            onClick={() => handleInsertPair('`', '`')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Backtick template string `"
            aria-label="Backtick"
            disabled={readOnly}
          >
            `
          </button>
        </div>

        <div className="shortcut-toolbar-divider" />

        {/* 3. INDENTATION & NAVIGATION GROUP */}
        <div className="shortcut-group group-nav" role="group" aria-label="Navigation">
          <button
            type="button"
            className="shortcut-btn btn-tab"
            onClick={handleTab}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Insert Tab (2 spaces)"
            aria-label="Insert Tab"
            disabled={readOnly}
          >
            <span className="tab-glyph">⇥</span>
            <span className="tab-text">Tab</span>
          </button>
          <button
            type="button"
            className="shortcut-btn btn-icon-arrow"
            onClick={handleMoveCursorLeft}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Move Cursor Left"
            aria-label="Move Cursor Left"
          >
            <ArrowLeft size={13} />
          </button>
          <button
            type="button"
            className="shortcut-btn btn-icon-arrow"
            onClick={handleMoveCursorRight}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Move Cursor Right"
            aria-label="Move Cursor Right"
          >
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="shortcut-toolbar-divider" />

        {/* 4. OPERATORS & ARROWS GROUP */}
        <div className="shortcut-group group-operators" role="group" aria-label="Operators">
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('=')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Equals / Assign ="
            aria-label="Equals"
            disabled={readOnly}
          >
            =
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('=>')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Arrow function =>"
            aria-label="Fat arrow function"
            disabled={readOnly}
          >
            =&gt;
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('->')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Pointer arrow ->"
            aria-label="Pointer arrow"
            disabled={readOnly}
          >
            -&gt;
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('+')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Plus +"
            aria-label="Plus"
            disabled={readOnly}
          >
            +
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('-')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Minus -"
            aria-label="Minus"
            disabled={readOnly}
          >
            -
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('*')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Multiply *"
            aria-label="Multiply"
            disabled={readOnly}
          >
            *
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('/')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Divide /"
            aria-label="Divide"
            disabled={readOnly}
          >
            /
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('%')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Modulo %"
            aria-label="Modulo"
            disabled={readOnly}
          >
            %
          </button>
        </div>

        <div className="shortcut-toolbar-divider" />

        {/* 5. PUNCTUATION, LOGIC & SYNTAX GROUP */}
        <div className="shortcut-group group-syntax" role="group" aria-label="Syntax">
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert(';')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Semicolon ;"
            aria-label="Semicolon"
            disabled={readOnly}
          >
            ;
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert(':')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Colon :"
            aria-label="Colon"
            disabled={readOnly}
          >
            :
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('.')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Dot property access ."
            aria-label="Dot"
            disabled={readOnly}
          >
            .
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert(',')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Comma ,"
            aria-label="Comma"
            disabled={readOnly}
          >
            ,
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('!')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Not / Exclamation !"
            aria-label="Exclamation"
            disabled={readOnly}
          >
            !
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('?')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Question / Ternary ?"
            aria-label="Question"
            disabled={readOnly}
          >
            ?
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('&')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Ampersand &"
            aria-label="Ampersand"
            disabled={readOnly}
          >
            &amp;
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('|')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Pipe |"
            aria-label="Pipe"
            disabled={readOnly}
          >
            |
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('$')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Dollar sign $"
            aria-label="Dollar"
            disabled={readOnly}
          >
            $
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('_')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Underscore _"
            aria-label="Underscore"
            disabled={readOnly}
          >
            _
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('// ')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Comment //"
            aria-label="Comment"
            disabled={readOnly}
          >
            //
          </button>
          <button
            type="button"
            className="shortcut-btn btn-symbol"
            onClick={() => handleInsert('#')}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Hash #"
            aria-label="Hash"
            disabled={readOnly}
          >
            #
          </button>
        </div>
      </div>
    </div>
  );
}
