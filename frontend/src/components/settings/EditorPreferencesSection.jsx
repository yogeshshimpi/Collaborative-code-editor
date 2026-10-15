import './EditorPreferencesSection.css';
import { useState, useEffect } from 'react';
import { Type, Check, Loader2, Code2, Sun, Moon, Monitor } from 'lucide-react';
import { useSettings } from '../../context/useSettings';

export default function EditorPreferencesSection({ onShowToast }) {
  const { settings, saveEditorSettings } = useSettings();

  const [editorFontSize, setEditorFontSize] = useState(14);
  const [tabSize, setTabSize] = useState(2);
  const [wordWrap, setWordWrap] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [editorTheme, setEditorTheme] = useState('dark');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (settings) {
      setEditorFontSize(Number(settings.editor_font_size) || 14);
      setTabSize(Number(settings.tab_size) === 4 ? 4 : 2);
      setWordWrap(settings.word_wrap !== false);
      setShowLineNumbers(settings.show_line_numbers !== false);
      setShowMinimap(settings.show_minimap !== false);
      setEditorTheme(settings.editor_theme || 'dark');
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await saveEditorSettings({
        editorFontSize,
        tabSize,
        wordWrap,
        showLineNumbers,
        showMinimap,
        editorTheme
      });
      onShowToast?.('Editor preferences saved and applied!', 'success');
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save editor preferences.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    editorFontSize !== (Number(settings?.editor_font_size) || 14) ||
    tabSize !== (Number(settings?.tab_size) === 4 ? 4 : 2) ||
    wordWrap !== (settings?.word_wrap !== false) ||
    showLineNumbers !== (settings?.show_line_numbers !== false) ||
    showMinimap !== (settings?.show_minimap !== false) ||
    editorTheme !== (settings?.editor_theme || 'dark');

  return (
    <form className="settings-section-form" onSubmit={handleSubmit}>
      <div className="settings-section-header">
        <h2 className="section-title">Editor Preferences</h2>
        <p className="section-subtitle">
          Configure Monaco code editor font sizing, indentation, wrap rules, and workspace theme.
        </p>
      </div>

      {/* Typography & Font Sizing */}
      <div className="settings-card">
        <h3 className="card-heading">Typography & Sizing</h3>

        <div className="form-group">
          <div className="slider-header-row">
            <label htmlFor="editor-font-size-slider" className="form-label">
              Font Size
            </label>
            <span className="font-size-badge">{editorFontSize}px</span>
          </div>

          <div className="slider-container">
            <span className="slider-bound-label">12px</span>
            <input
              id="editor-font-size-slider"
              type="range"
              min={12}
              max={24}
              step={1}
              value={editorFontSize}
              onChange={(e) => setEditorFontSize(Number(e.target.value))}
              className="settings-range-slider"
            />
            <span className="slider-bound-label">24px</span>
          </div>
          <span className="form-helper">Adjust editor code font size across all project files.</span>
        </div>

        {/* Live Code Font Preview */}
        <div className="font-preview-box">
          <div className="font-preview-header">
            <Code2 size={13} />
            <span>Live Editor Preview</span>
            <span className="font-preview-lang">JavaScript</span>
          </div>
          <pre
            className="font-preview-code"
            style={{ fontSize: `${editorFontSize}px`, tabSize }}
          >
            <code>
              <span className="syn-keyword">function</span>{' '}
              <span className="syn-func">syncWorkspace</span>(
              <span className="syn-param">session</span>) {'{\n'}
              {'  '}
              <span className="syn-keyword">const</span> {'{'} roomId, teamSize {'}'} = session;
              {'\n'}
              {'  '}<span className="syn-comment">// Real-time collaborative synchronization</span>
              {'\n'}
              {'  '}<span className="syn-return">return</span> `Connected to room: ${'{'}roomId{'}'}`;
              {'\n'}
              {'}'}
            </code>
          </pre>
        </div>
      </div>

      {/* Indentation & Layout Rules */}
      <div className="settings-card">
        <h3 className="card-heading">Code Formatting & Display</h3>

        {/* Tab Size */}
        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <label className="form-label">Tab Indentation Size</label>
          <div className="tab-size-selector" role="radiogroup" aria-label="Tab size">
            <button
              type="button"
              className={`tab-size-btn ${tabSize === 2 ? 'active' : ''}`}
              onClick={() => setTabSize(2)}
              role="radio"
              aria-checked={tabSize === 2}
            >
              <span className="tab-btn-title">2 Spaces</span>
              <span className="tab-btn-desc">Standard JavaScript, JSON & HTML</span>
            </button>
            <button
              type="button"
              className={`tab-size-btn ${tabSize === 4 ? 'active' : ''}`}
              onClick={() => setTabSize(4)}
              role="radio"
              aria-checked={tabSize === 4}
            >
              <span className="tab-btn-title">4 Spaces</span>
              <span className="tab-btn-desc">Traditional Python, C++ & Java</span>
            </button>
          </div>
        </div>

        {/* Toggles: Word Wrap, Line Numbers, Minimap */}
        <div className="settings-toggle-list">
          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <span className="toggle-title">Word Wrap</span>
              <span className="toggle-desc">
                Soft-wrap long lines of code so they fit comfortably inside your viewport without horizontal scrolling.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${wordWrap ? 'is-on' : ''}`}
              onClick={() => setWordWrap((prev) => !prev)}
              role="switch"
              aria-checked={wordWrap}
              aria-label="Toggle word wrap"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <span className="toggle-title">Line Numbers</span>
              <span className="toggle-desc">
                Display line numbers along the left editor gutter for easy navigation and team references.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${showLineNumbers ? 'is-on' : ''}`}
              onClick={() => setShowLineNumbers((prev) => !prev)}
              role="switch"
              aria-checked={showLineNumbers}
              aria-label="Toggle line numbers"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <span className="toggle-title">Monaco Minimap</span>
              <span className="toggle-desc">
                Show high-level code outline scroll minimap on the right edge of desktop editor screens.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${showMinimap ? 'is-on' : ''}`}
              onClick={() => setShowMinimap((prev) => !prev)}
              role="switch"
              aria-checked={showMinimap}
              aria-label="Toggle code minimap"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
      </div>

      {/* Editor Theme */}
      <div className="settings-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 className="card-heading" style={{ margin: 0 }}>Editor Syntax Theme</h3>
          <a
            href="/settings?tab=theme"
            className="theme-link-pill"
            style={{
              fontSize: '0.78rem',
              color: 'var(--accent-primary, #6d5dfc)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: 'var(--accent-subtle, rgba(109, 93, 252, 0.12))',
              padding: '0.25rem 0.65rem',
              borderRadius: '6px',
              fontWeight: 500
            }}
          >
            Looking for Whole Project Theme? Open Appearance & Theme tab &rarr;
          </a>
        </div>
        <div className="theme-selector-grid" role="radiogroup" aria-label="Editor color theme">
          <button
            type="button"
            className={`theme-card-btn ${editorTheme === 'dark' ? 'active' : ''}`}
            onClick={() => setEditorTheme('dark')}
            role="radio"
            aria-checked={editorTheme === 'dark'}
          >
            <div className="theme-icon-wrap theme-dark-icon">
              <Moon size={18} />
            </div>
            <div className="theme-card-info">
              <span className="theme-name">VS Dark</span>
              <span className="theme-tag">Default Dark</span>
            </div>
            {editorTheme === 'dark' && <Check size={16} className="theme-check-icon" />}
          </button>

          <button
            type="button"
            className={`theme-card-btn ${editorTheme === 'light' ? 'active' : ''}`}
            onClick={() => setEditorTheme('light')}
            role="radio"
            aria-checked={editorTheme === 'light'}
          >
            <div className="theme-icon-wrap theme-light-icon">
              <Sun size={18} />
            </div>
            <div className="theme-card-info">
              <span className="theme-name">VS Light</span>
              <span className="theme-tag">Clean Daytime Light</span>
            </div>
            {editorTheme === 'light' && <Check size={16} className="theme-check-icon" />}
          </button>

          <button
            type="button"
            className={`theme-card-btn ${editorTheme === 'system' ? 'active' : ''}`}
            onClick={() => setEditorTheme('system')}
            role="radio"
            aria-checked={editorTheme === 'system'}
          >
            <div className="theme-icon-wrap theme-system-icon">
              <Monitor size={18} />
            </div>
            <div className="theme-card-info">
              <span className="theme-name">System Match</span>
              <span className="theme-tag">Matches OS setting</span>
            </div>
            {editorTheme === 'system' && <Check size={16} className="theme-check-icon" />}
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="settings-action-bar">
        <button
          type="submit"
          className="btn btn-primary btn-save"
          disabled={isSubmitting || !hasChanges}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={15} className="spin-icon" />
              <span>Saving Preferences...</span>
            </>
          ) : (
            <>
              <Check size={15} />
              <span>Save Preferences</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
