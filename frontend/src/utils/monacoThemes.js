/**
 * Custom Monaco Editor Themes for CodeCollab
 * Synchronizes Monaco code editor with Whole-Project Themes
 */

export function defineAllMonacoThemes(monaco) {
  if (!monaco?.editor) return;

  // 1. Navy Dark (Default)
  monaco.editor.defineTheme('theme-navy', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'keyword', foreground: '818cf8', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'f2f6ff' },
      { token: 'string', foreground: '34d399' },
      { token: 'number', foreground: 'f59e0b' },
      { token: 'type', foreground: '60a5fa' },
      { token: 'function', foreground: '38bdf8' },
      { token: 'delimiter', foreground: '94a3b8' }
    ],
    colors: {
      'editor.background': '#0c121d',
      'editor.foreground': '#f2f6ff',
      'editorLineNumber.foreground': '#3a4d6d',
      'editorLineNumber.activeForeground': '#818cf8',
      'editorCursor.foreground': '#6d5dfc',
      'editor.selectionBackground': '#26344d99',
      'editor.inactiveSelectionBackground': '#26344d44',
      'editor.lineHighlightBackground': '#121a2977',
      'editorGutter.background': '#0c121d',
      'editorIndentGuide.background1': '#182235',
      'editorIndentGuide.activeBackground1': '#3a4d6d',
      'editorWidget.background': '#121a29',
      'editorWidget.border': '#26344d',
      'editorSuggestWidget.background': '#121a29',
      'editorSuggestWidget.border': '#26344d',
      'editorSuggestWidget.selectedBackground': '#202d43'
    }
  });

  // 2. Midnight OLED (Pure Black)
  monaco.editor.defineTheme('theme-midnight', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
      { token: 'keyword', foreground: '818cf8', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'f8fafc' },
      { token: 'string', foreground: 'a3e635' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'type', foreground: '38bdf8' },
      { token: 'function', foreground: '60a5fa' },
      { token: 'delimiter', foreground: '94a3b8' }
    ],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#f8fafc',
      'editorLineNumber.foreground': '#334155',
      'editorLineNumber.activeForeground': '#818cf8',
      'editorCursor.foreground': '#6366f1',
      'editor.selectionBackground': '#312e8177',
      'editor.inactiveSelectionBackground': '#1e1b4b44',
      'editor.lineHighlightBackground': '#0d0d12',
      'editorGutter.background': '#000000',
      'editorIndentGuide.background1': '#18181c',
      'editorIndentGuide.activeBackground1': '#383842',
      'editorWidget.background': '#111114',
      'editorWidget.border': '#222228',
      'editorSuggestWidget.background': '#111114',
      'editorSuggestWidget.border': '#222228',
      'editorSuggestWidget.selectedBackground': '#232329'
    }
  });

  // 3. Cyberpunk Synthwave
  monaco.editor.defineTheme('theme-cyberpunk', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '7e22ce', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'f472b6', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'fdf4ff' },
      { token: 'string', foreground: '22d3ee' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'type', foreground: 'c084fc' },
      { token: 'function', foreground: 'e879f9' },
      { token: 'delimiter', foreground: 'd8b4fe' }
    ],
    colors: {
      'editor.background': '#0c0618',
      'editor.foreground': '#fdf4ff',
      'editorLineNumber.foreground': '#6b21a8',
      'editorLineNumber.activeForeground': '#d946ef',
      'editorCursor.foreground': '#ec4899',
      'editor.selectionBackground': '#701a7599',
      'editor.inactiveSelectionBackground': '#4a044e55',
      'editor.lineHighlightBackground': '#1b0e3388',
      'editorGutter.background': '#0c0618',
      'editorIndentGuide.background1': '#261447',
      'editorIndentGuide.activeBackground1': '#592e99',
      'editorWidget.background': '#1b0e33',
      'editorWidget.border': '#3a1e64',
      'editorSuggestWidget.background': '#1b0e33',
      'editorSuggestWidget.border': '#3a1e64',
      'editorSuggestWidget.selectedBackground': '#351c61'
    }
  });

  // 4. Emerald Matrix
  monaco.editor.defineTheme('theme-emerald', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '15803d', fontStyle: 'italic' },
      { token: 'keyword', foreground: '34d399', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'f0fdf4' },
      { token: 'string', foreground: 'facc15' },
      { token: 'number', foreground: '67e8f9' },
      { token: 'type', foreground: '6ee7b7' },
      { token: 'function', foreground: '10b981' },
      { token: 'delimiter', foreground: '86efac' }
    ],
    colors: {
      'editor.background': '#030d08',
      'editor.foreground': '#f0fdf4',
      'editorLineNumber.foreground': '#166534',
      'editorLineNumber.activeForeground': '#34d399',
      'editorCursor.foreground': '#10b981',
      'editor.selectionBackground': '#064e3b99',
      'editor.inactiveSelectionBackground': '#022c2255',
      'editor.lineHighlightBackground': '#0b221688',
      'editorGutter.background': '#030d08',
      'editorIndentGuide.background1': '#113121',
      'editorIndentGuide.activeBackground1': '#256043',
      'editorWidget.background': '#0b2216',
      'editorWidget.border': '#19412d',
      'editorSuggestWidget.background': '#0b2216',
      'editorSuggestWidget.border': '#19412d',
      'editorSuggestWidget.selectedBackground': '#19442e'
    }
  });

  // 5. Ocean Deep Teal
  monaco.editor.defineTheme('theme-ocean', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '155e75', fontStyle: 'italic' },
      { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
      { token: 'identifier', foreground: 'f0fdfa' },
      { token: 'string', foreground: 'fbbf24' },
      { token: 'number', foreground: 'f472b6' },
      { token: 'type', foreground: '2dd4bf' },
      { token: 'function', foreground: '06b6d4' },
      { token: 'delimiter', foreground: '99f6e4' }
    ],
    colors: {
      'editor.background': '#03131c',
      'editor.foreground': '#f0fdfa',
      'editorLineNumber.foreground': '#155e75',
      'editorLineNumber.activeForeground': '#22d3ee',
      'editorCursor.foreground': '#06b6d4',
      'editor.selectionBackground': '#164e6399',
      'editor.inactiveSelectionBackground': '#08334455',
      'editor.lineHighlightBackground': '#0a273888',
      'editorGutter.background': '#03131c',
      'editorIndentGuide.background1': '#0f364e',
      'editorIndentGuide.activeBackground1': '#21678f',
      'editorWidget.background': '#0a2738',
      'editorWidget.border': '#164661',
      'editorSuggestWidget.background': '#0a2738',
      'editorSuggestWidget.border': '#164661',
      'editorSuggestWidget.selectedBackground': '#154a6b'
    }
  });

  // 6. Clean Daytime Light
  monaco.editor.defineTheme('theme-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '94a3b8', fontStyle: 'italic' },
      { token: 'keyword', foreground: '4f46e5', fontStyle: 'bold' },
      { token: 'identifier', foreground: '0f172a' },
      { token: 'string', foreground: '059669' },
      { token: 'number', foreground: 'd97706' },
      { token: 'type', foreground: '2563eb' },
      { token: 'function', foreground: '7c3aed' },
      { token: 'delimiter', foreground: '64748b' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#0f172a',
      'editorLineNumber.foreground': '#94a3b8',
      'editorLineNumber.activeForeground': '#4f46e5',
      'editorCursor.foreground': '#4f46e5',
      'editor.selectionBackground': '#c7d2fe88',
      'editor.inactiveSelectionBackground': '#e0e7ff55',
      'editor.lineHighlightBackground': '#f1f5f9',
      'editorGutter.background': '#ffffff',
      'editorIndentGuide.background1': '#e2e8f0',
      'editorIndentGuide.activeBackground1': '#cbd5e1',
      'editorWidget.background': '#ffffff',
      'editorWidget.border': '#e2e8f0',
      'editorSuggestWidget.background': '#ffffff',
      'editorSuggestWidget.border': '#e2e8f0',
      'editorSuggestWidget.selectedBackground': '#e2e8f0'
    }
  });
}

/**
 * Determine the Monaco theme name based on project theme and editor theme preferences
 */
export function getMonacoThemeName(projectTheme = 'navy', editorTheme = 'dark') {
  const validThemeMap = {
    navy: 'theme-navy',
    midnight: 'theme-midnight',
    cyberpunk: 'theme-cyberpunk',
    emerald: 'theme-emerald',
    ocean: 'theme-ocean',
    light: 'theme-light'
  };

  // If explicitly requested light editor
  if (editorTheme === 'light') {
    return 'theme-light';
  }

  // If matching system
  if (editorTheme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'theme-light';
    }
    return projectTheme === 'light' ? 'theme-light' : (validThemeMap[projectTheme] || 'theme-navy');
  }

  // If project theme is light, automatically switch to light editor unless user selected force-dark
  if (projectTheme === 'light' && editorTheme !== 'force-dark') {
    return 'theme-light';
  }

  // Otherwise, match the corresponding whole-project theme in Monaco!
  return validThemeMap[projectTheme] || 'theme-navy';
}
