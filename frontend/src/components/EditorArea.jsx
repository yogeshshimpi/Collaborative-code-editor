import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

export default function EditorArea({
  content,
  language,
  onChange,
  onCursorChange,
  layoutTrigger
}) {
  const editorRef = useRef(null);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;

    // Track cursor movement for status bar updates
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange({
          line: e.position.lineNumber,
          column: e.position.column
        });
      }
    });

    // Ensure immediate layout calculation
    editor.layout();
  };

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

  // Recalculate on window resize and mobile orientation change
  useEffect(() => {
    const handleLayoutRecalc = () => {
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

  return (
    <div className="editor-area-container">
      <Editor
        height="100%"
        width="100%"
        language={language}
        value={content}
        theme="vs-dark"
        onChange={onChange}
        onMount={handleEditorDidMount}
        loading={
          <div className="editor-loader">
            <Loader2 className="spinner" size={24} />
            <span>Loading Monaco Editor...</span>
          </div>
        }
        options={{
          fontSize: 13.5,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
          fontLigatures: true,
          minimap: {
            enabled: true,
            side: 'right'
          },
          lineNumbers: 'on',
          lineNumbersMinChars: 3,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          tabSize: 2,
          wordWrap: 'on',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          renderWhitespace: 'selection',
          padding: { top: 10, bottom: 10 },
          bracketPairColorization: { enabled: true }
        }}
      />
    </div>
  );
}
