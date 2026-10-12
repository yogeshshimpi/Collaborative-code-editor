import Editor from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

export default function EditorArea({
  content,
  language,
  onChange,
  onCursorChange
}) {
  const handleEditorDidMount = (editor) => {
    // Track cursor movement for status bar updates
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange({
          line: e.position.lineNumber,
          column: e.position.column
        });
      }
    });

    // Focus editor automatically
    editor.focus();
  };

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
          fontSize: 14,
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
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
          padding: { top: 12, bottom: 12 },
          bracketPairColorization: { enabled: true }
        }}
      />
    </div>
  );
}
