import './ThemeSection.css';
import { useState, useEffect } from 'react';
import {
  Palette,
  Check,
  Loader2,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Layout,
  FileCode
} from 'lucide-react';
import { useSettings } from '../../context/useSettings';

export const THEME_OPTIONS = [
  {
    id: 'navy',
    name: 'Navy Dark',
    badge: 'Default',
    tagline: 'Deep midnight navy blue with refined violet accents',
    description: 'The signature CodeCollab developer theme designed for focus and long coding sessions.',
    preview: {
      bgApp: '#090d16',
      bgSurface: '#121a29',
      bgEditor: '#0c121d',
      accent: '#6d5dfc',
      text: '#f2f6ff',
      border: '#26344d'
    },
    colors: ['#090d16', '#121a29', '#6d5dfc', '#f2f6ff']
  },
  {
    id: 'midnight',
    name: 'Midnight OLED',
    badge: 'Pitch Black',
    tagline: 'True black 0-nit backgrounds with vivid indigo contrast',
    description: 'Optimized for OLED displays with maximum power efficiency and zero distractions.',
    preview: {
      bgApp: '#000000',
      bgSurface: '#111114',
      bgEditor: '#050507',
      accent: '#6366f1',
      text: '#f8fafc',
      border: '#222228'
    },
    colors: ['#000000', '#111114', '#6366f1', '#f8fafc']
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Synthwave',
    badge: 'Neon Glow',
    tagline: 'Deep dark violet realm with electric fuchsia and pink glow',
    description: 'High-energy retrofuturistic neon aesthetics for creative nocturnal coding.',
    preview: {
      bgApp: '#0c0618',
      bgSurface: '#1b0e33',
      bgEditor: '#0f0720',
      accent: '#d946ef',
      text: '#fdf4ff',
      border: '#3a1e64'
    },
    colors: ['#0c0618', '#1b0e33', '#d946ef', '#fdf4ff']
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    badge: 'Forest Dark',
    tagline: 'Deep obsidian green backdrop with sharp emerald highlights',
    description: 'Sophisticated cyber-terminal theme with restful natural green undertones.',
    preview: {
      bgApp: '#030d08',
      bgSurface: '#0b2216',
      bgEditor: '#05140b',
      accent: '#10b981',
      text: '#f0fdf4',
      border: '#19412d'
    },
    colors: ['#030d08', '#0b2216', '#10b981', '#f0fdf4']
  },
  {
    id: 'ocean',
    name: 'Ocean Deep Teal',
    badge: 'Deep Sea',
    tagline: 'Abyssal oceanic teal palette with bright cyan illumination',
    description: 'Smooth nautical tones inspired by marine depths and solarized developer palettes.',
    preview: {
      bgApp: '#03131c',
      bgSurface: '#0a2738',
      bgEditor: '#041824',
      accent: '#06b6d4',
      text: '#f0fdfa',
      border: '#164661'
    },
    colors: ['#03131c', '#0a2738', '#06b6d4', '#f0fdfa']
  },
  {
    id: 'light',
    name: 'Clean Daytime Light',
    badge: 'Daylight',
    tagline: 'Crisp, high-contrast sunlight theme with indigo highlights',
    description: 'Easy on the eyes in brightly illuminated environments or outdoors with ultra-sharp text.',
    preview: {
      bgApp: '#f4f6fa',
      bgSurface: '#ffffff',
      bgEditor: '#ffffff',
      accent: '#4f46e5',
      text: '#0f172a',
      border: '#e2e8f0'
    },
    colors: ['#f4f6fa', '#ffffff', '#4f46e5', '#0f172a']
  }
];

export default function ThemeSection({ onShowToast }) {
  const { settings, saveThemeSettings, previewTheme } = useSettings();

  const [selectedTheme, setSelectedTheme] = useState(settings?.project_theme || 'navy');
  const [editorThemeSync, setEditorThemeSync] = useState(settings?.editor_theme || 'dark');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (settings) {
      setSelectedTheme(settings.project_theme || 'navy');
      setEditorThemeSync(settings.editor_theme || (settings.project_theme === 'light' ? 'light' : 'dark'));
    }
  }, [settings]);

  // Handle live theme preview when clicking on a card
  const handleSelectTheme = (themeId) => {
    setSelectedTheme(themeId);
    previewTheme(themeId);

    // If syncing editor theme, adjust automatically
    if (themeId === 'light' && editorThemeSync !== 'system') {
      setEditorThemeSync('light');
    } else if (themeId !== 'light' && editorThemeSync === 'light') {
      setEditorThemeSync('dark');
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setIsSubmitting(true);
    try {
      await saveThemeSettings({
        projectTheme: selectedTheme,
        editorTheme: editorThemeSync
      });
      onShowToast?.(`"${THEME_OPTIONS.find((t) => t.id === selectedTheme)?.name || selectedTheme}" theme applied across the whole project!`, 'success');
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save theme preferences.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentThemeObj = THEME_OPTIONS.find((t) => t.id === selectedTheme) || THEME_OPTIONS[0];

  const hasChanges =
    selectedTheme !== (settings?.project_theme || 'navy') ||
    editorThemeSync !== (settings?.editor_theme || 'dark');

  return (
    <div className="settings-section-form theme-section-wrapper">
      <div className="settings-section-header">
        <div className="theme-header-row">
          <div>
            <h2 className="section-title">Whole Project Appearance & Themes</h2>
            <p className="section-subtitle">
              Choose an aesthetic that transforms the entire CodeCollab application—including the top navigation bar, sidebars, file tree, modals, cards, and Monaco editor.
            </p>
          </div>
          <span className="theme-active-indicator">
            <span
              className="theme-dot-pulse"
              style={{ backgroundColor: currentThemeObj.preview.accent }}
            />
            Active: <strong>{currentThemeObj.name}</strong>
          </span>
        </div>
      </div>

      {/* Live Workspace Preview Card */}
      <div className="settings-card theme-mock-card">
        <div className="theme-mock-header">
          <div className="theme-mock-title">
            <Layout size={15} />
            <span>Whole Project Live Preview</span>
          </div>
          <span className="theme-mock-badge">Instant CSS Variable Cascade</span>
        </div>

        <div
          className="theme-preview-workspace"
          style={{
            backgroundColor: currentThemeObj.preview.bgApp,
            borderColor: currentThemeObj.preview.border
          }}
        >
          {/* Mock Top Navbar */}
          <div
            className="mock-navbar"
            style={{
              backgroundColor: currentThemeObj.preview.bgSurface,
              borderColor: currentThemeObj.preview.border
            }}
          >
            <div className="mock-nav-brand">
              <div
                className="mock-brand-icon"
                style={{ backgroundColor: currentThemeObj.preview.accent }}
              >
                <Palette size={11} color="#ffffff" />
              </div>
              <span
                className="mock-brand-text"
                style={{ color: currentThemeObj.preview.text }}
              >
                CodeCollab
              </span>
            </div>
            <div className="mock-nav-actions">
              <span
                className="mock-pill"
                style={{
                  backgroundColor: currentThemeObj.preview.bgEditor,
                  borderColor: currentThemeObj.preview.border,
                  color: currentThemeObj.preview.text
                }}
              >
                main.js
              </span>
              <span
                className="mock-btn-accent"
                style={{ backgroundColor: currentThemeObj.preview.accent }}
              >
                Share
              </span>
            </div>
          </div>

          {/* Mock Body: Sidebar + Editor */}
          <div className="mock-workspace-body">
            {/* Mock Sidebar */}
            <div
              className="mock-sidebar"
              style={{
                backgroundColor: currentThemeObj.preview.bgSurface,
                borderColor: currentThemeObj.preview.border
              }}
            >
              <div
                className="mock-sidebar-title"
                style={{ color: currentThemeObj.preview.text }}
              >
                EXPLORER
              </div>
              <div
                className="mock-file-item active"
                style={{
                  backgroundColor: `${currentThemeObj.preview.accent}22`,
                  color: currentThemeObj.preview.accent
                }}
              >
                <FileCode size={11} />
                <span>main.js</span>
              </div>
              <div
                className="mock-file-item"
                style={{ color: currentThemeObj.preview.text, opacity: 0.7 }}
              >
                <FileCode size={11} />
                <span>styles.css</span>
              </div>
              <div
                className="mock-file-item"
                style={{ color: currentThemeObj.preview.text, opacity: 0.7 }}
              >
                <FileCode size={11} />
                <span>App.jsx</span>
              </div>
            </div>

            {/* Mock Editor Canvas */}
            <div
              className="mock-editor"
              style={{
                backgroundColor: currentThemeObj.preview.bgEditor,
                color: currentThemeObj.preview.text
              }}
            >
              <div className="mock-editor-lines">
                <div>
                  <span className="line-num">1</span>
                  <span style={{ color: currentThemeObj.preview.accent }}>import</span> React{' '}
                  <span style={{ color: currentThemeObj.preview.accent }}>from</span> 'react';
                </div>
                <div>
                  <span className="line-num">2</span>
                  <span style={{ color: currentThemeObj.preview.accent }}>export default function</span>{' '}
                  <span style={{ color: '#38bdf8' }}>App</span>() {'{'}
                </div>
                <div>
                  <span className="line-num">3</span>
                  &nbsp;&nbsp;<span style={{ color: currentThemeObj.preview.accent }}>const</span> theme ={' '}
                  <span style={{ color: '#f59e0b' }}>'{currentThemeObj.name}'</span>;
                </div>
                <div>
                  <span className="line-num">4</span>
                  &nbsp;&nbsp;<span style={{ color: currentThemeObj.preview.accent }}>return</span>{' '}
                  &lt;<span style={{ color: '#38bdf8' }}>Workspace</span> theme={'{'}theme{'}'} /&gt;;
                </div>
                <div>
                  <span className="line-num">5</span>
                  {'}'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Cards Grid */}
      <div className="settings-card">
        <div className="theme-cards-intro">
          <h3 className="card-heading">Available Project Color Schemes</h3>
          <span className="card-heading-sub">
            Click any palette card to preview immediately across your entire browser.
          </span>
        </div>

        <div className="theme-grid-container" role="radiogroup" aria-label="Project themes">
          {THEME_OPTIONS.map((theme) => {
            const isSelected = selectedTheme === theme.id;
            return (
              <div
                key={theme.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                className={`theme-card-option ${isSelected ? 'is-selected' : ''}`}
                onClick={() => handleSelectTheme(theme.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectTheme(theme.id);
                  }
                }}
              >
                <div className="theme-card-top">
                  <div className="theme-name-group">
                    <span className="theme-card-title">{theme.name}</span>
                    <span className="theme-card-badge">{theme.badge}</span>
                  </div>
                  {isSelected && (
                    <div className="theme-selected-badge">
                      <Check size={13} />
                      <span>Applied</span>
                    </div>
                  )}
                </div>

                <p className="theme-card-tagline">{theme.tagline}</p>

                {/* Swatch Palette Dots */}
                <div className="theme-swatch-row">
                  {theme.colors.map((c, i) => (
                    <span
                      key={i}
                      className="theme-swatch-dot"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                  <span className="theme-swatch-hint">Canvas • Surface • Accent • Text</span>
                </div>

                <div
                  className="theme-card-visual-bar"
                  style={{
                    background: `linear-gradient(90deg, ${theme.preview.bgApp} 0%, ${theme.preview.bgSurface} 50%, ${theme.preview.accent} 100%)`
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Sync Preferences */}
      <div className="settings-card">
        <h3 className="card-heading">Monaco Code Editor Theme Sync</h3>
        <p className="form-helper" style={{ marginBottom: '1rem' }}>
          Choose how the code editing surface reacts when switching your whole project theme.
        </p>

        <div className="editor-sync-options" role="radiogroup" aria-label="Editor Theme Sync">
          <button
            type="button"
            className={`sync-option-btn ${editorThemeSync === (selectedTheme === 'light' ? 'light' : 'dark') ? 'active' : ''}`}
            onClick={() => setEditorThemeSync(selectedTheme === 'light' ? 'light' : 'dark')}
            role="radio"
            aria-checked={editorThemeSync === (selectedTheme === 'light' ? 'light' : 'dark')}
          >
            <div className="sync-btn-icon">
              <Sparkles size={16} />
            </div>
            <div className="sync-btn-content">
              <span className="sync-btn-title">Match Project Theme (Recommended)</span>
              <span className="sync-btn-desc">
                Monaco editor matches the selected workspace light/dark tone automatically.
              </span>
            </div>
            {editorThemeSync === (selectedTheme === 'light' ? 'light' : 'dark') && (
              <Check size={16} className="sync-check" />
            )}
          </button>

          <button
            type="button"
            className={`sync-option-btn ${editorThemeSync === 'dark' ? 'active' : ''}`}
            onClick={() => setEditorThemeSync('dark')}
            role="radio"
            aria-checked={editorThemeSync === 'dark'}
          >
            <div className="sync-btn-icon">
              <Moon size={16} />
            </div>
            <div className="sync-btn-content">
              <span className="sync-btn-title">Always VS Dark</span>
              <span className="sync-btn-desc">
                Keep Monaco editor syntax in dark mode regardless of project shell.
              </span>
            </div>
            {editorThemeSync === 'dark' && <Check size={16} className="sync-check" />}
          </button>

          <button
            type="button"
            className={`sync-option-btn ${editorThemeSync === 'light' ? 'active' : ''}`}
            onClick={() => setEditorThemeSync('light')}
            role="radio"
            aria-checked={editorThemeSync === 'light'}
          >
            <div className="sync-btn-icon">
              <Sun size={16} />
            </div>
            <div className="sync-btn-content">
              <span className="sync-btn-title">Always VS Light</span>
              <span className="sync-btn-desc">
                Keep Monaco editor syntax in daytime light mode.
              </span>
            </div>
            {editorThemeSync === 'light' && <Check size={16} className="sync-check" />}
          </button>
        </div>
      </div>

      {/* Floating Save Action Bar */}
      <div className="settings-action-bar">
        <button
          type="button"
          className="btn btn-primary btn-save"
          onClick={handleSave}
          disabled={isSubmitting || !hasChanges}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={15} className="spin-icon" />
              <span>Saving Theme...</span>
            </>
          ) : (
            <>
              <Check size={15} />
              <span>Apply & Save Theme</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
