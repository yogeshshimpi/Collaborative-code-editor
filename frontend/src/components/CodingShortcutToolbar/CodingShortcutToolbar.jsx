import './CodingShortcutToolbar.css';
import { useCallback, useRef } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Code2
} from 'lucide-react';

/**
 * 9 Grouped Key Configurations matching user's exact grouping and design:
 * Key 1: ⇥ (Tab) / ↔ (Space)
 * Key 2: # $ / ^ %
 * Key 3: \ @ / ~ _
 * Key 4: & | / ? !
 * Key 5: + - / * /
 * Key 6: ' " / ` =
 * Key 7: { } / [ ]
 * Key 8: ( ) / < >
 * Key 9: . : / , ;
 */
const SHORTCUT_KEY_GROUPS = [
  // 1: ⇥ / ↔
  {
    id: 'key-tab-space',
    type: 'vertical',
    label: 'Tab and Space',
    items: [
      { char: '⇥', label: 'Tab (2 spaces)', action: 'tab' },
      { char: '↔', label: 'Space', action: 'space' }
    ]
  },
  // 2: # $ / ^ %
  {
    id: 'key-hash-dollar',
    type: 'grid',
    label: '# $ ^ %',
    rows: [
      [{ char: '#', action: 'insert', val: '#' }, { char: '$', action: 'insert', val: '$' }],
      [{ char: '^', action: 'insert', val: '^' }, { char: '%', action: 'insert', val: '%' }]
    ]
  },
  // 3: \ @ / ~ _
  {
    id: 'key-slash-at',
    type: 'grid',
    label: '\\ @ ~ _',
    rows: [
      [{ char: '\\', action: 'insert', val: '\\' }, { char: '@', action: 'insert', val: '@' }],
      [{ char: '~', action: 'insert', val: '~' }, { char: '_', action: 'insert', val: '_' }]
    ]
  },
  // 4: & | / ? !
  {
    id: 'key-amp-pipe',
    type: 'grid',
    label: '& | ? !',
    rows: [
      [{ char: '&', action: 'insert', val: '&' }, { char: '|', action: 'insert', val: '|' }],
      [{ char: '?', action: 'insert', val: '?' }, { char: '!', action: 'insert', val: '!' }]
    ]
  },
  // 5: + - / * /
  {
    id: 'key-math',
    type: 'grid',
    label: '+ - * /',
    rows: [
      [{ char: '+', action: 'insert', val: '+' }, { char: '-', action: 'insert', val: '-' }],
      [{ char: '*', action: 'insert', val: '*' }, { char: '/', action: 'insert', val: '/' }]
    ]
  },
  // 6: ' " / ` =
  {
    id: 'key-quotes-eq',
    type: 'grid',
    label: '\' " ` =',
    rows: [
      [{ char: "'", action: 'quote', val: "'" }, { char: '"', action: 'quote', val: '"' }],
      [{ char: '`', action: 'quote', val: '`' }, { char: '=', action: 'insert', val: '=' }]
    ]
  },
  // 7: { } / [ ]
  {
    id: 'key-curly-square',
    type: 'grid',
    label: '{ } [ ]',
    rows: [
      [{ char: '{', action: 'openBracket', open: '{', close: '}' }, { char: '}', action: 'closeBracket', close: '}' }],
      [{ char: '[', action: 'openBracket', open: '[', close: ']' }, { char: ']', action: 'closeBracket', close: ']' }]
    ]
  },
  // 8: ( ) / < >
  {
    id: 'key-paren-angle',
    type: 'grid',
    label: '( ) < >',
    rows: [
      [{ char: '(', action: 'openBracket', open: '(', close: ')' }, { char: ')', action: 'closeBracket', close: ')' }],
      [{ char: '<', action: 'openBracket', open: '<', close: '>' }, { char: '>', action: 'closeBracket', close: '>' }]
    ]
  },
  // 9: . : / , ;
  {
    id: 'key-dots-comma',
    type: 'grid',
    label: '. : , ;',
    rows: [
      [{ char: '.', action: 'insert', val: '.' }, { char: ':', action: 'insert', val: ':' }],
      [{ char: ',', action: 'insert', val: ',' }, { char: ';', action: 'insert', val: ';' }]
    ]
  }
];

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

  // Handle open bracket or quote: wraps selection if non-empty; inserts openChar if empty
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

  // Handle close bracket: inserts closeChar at cursor
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

  // Insert Tab (2 spaces indentation)
  const handleTab = useCallback(() => {
    handleInsert('  ');
  }, [handleInsert]);

  // Handle click on any key cell based on its action type
  const handleKeyClick = useCallback(
    (item) => {
      if (readOnly) return;
      if (item.action === 'tab') {
        handleTab();
      } else if (item.action === 'space') {
        handleInsert(' ');
      } else if (item.action === 'openBracket') {
        handleOpenBracket(item.open, item.close);
      } else if (item.action === 'closeBracket') {
        handleCloseBracket(item.close);
      } else if (item.action === 'quote') {
        handleOpenBracket(item.val, item.val);
      } else if (item.action === 'insert') {
        handleInsert(item.val);
      }
    },
    [readOnly, handleTab, handleInsert, handleOpenBracket, handleCloseBracket]
  );

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
      {/* Optional Collapse Toggle */}
      {onToggleCollapse && (
        <div className="shortcut-toolbar-controls">
          <button
            type="button"
            className="shortcut-action-btn btn-hide-toolbar"
            onClick={onToggleCollapse}
            onMouseDown={preventBlur}
            onTouchStart={preventBlur}
            title="Hide Toolbar"
            aria-label="Hide Toolbar"
          >
            <ChevronDown size={14} className="action-icon" />
          </button>
        </div>
      )}

      {/* 9 Grouped Key Buttons */}
      <div
        className="shortcut-toolbar-symbols-scroll"
        ref={scrollContainerRef}
        onWheel={handleWheel}
      >
        {SHORTCUT_KEY_GROUPS.map((group) => {
          if (group.type === 'vertical') {
            return (
              <div
                key={group.id}
                className="shortcut-key-card key-card-vertical"
                role="group"
                aria-label={group.label}
              >
                {group.items.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="key-sub-btn key-sub-btn-vertical"
                    onClick={() => handleKeyClick(item)}
                    onMouseDown={preventBlur}
                    onTouchStart={preventBlur}
                    title={item.label || item.char}
                    aria-label={item.label || item.char}
                    disabled={readOnly}
                  >
                    <span className="key-char-glyph">{item.char}</span>
                  </button>
                ))}
              </div>
            );
          }

          return (
            <div
              key={group.id}
              className="shortcut-key-card key-card-grid"
              role="group"
              aria-label={group.label}
            >
              {group.rows.map((row, rIdx) => (
                <div key={rIdx} className="key-card-row">
                  {row.map((item, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      className="key-sub-btn key-sub-btn-grid"
                      onClick={() => handleKeyClick(item)}
                      onMouseDown={preventBlur}
                      onTouchStart={preventBlur}
                      title={`Insert ${item.char}`}
                      aria-label={item.char}
                      disabled={readOnly}
                    >
                      <span className="key-char-glyph">{item.char}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
