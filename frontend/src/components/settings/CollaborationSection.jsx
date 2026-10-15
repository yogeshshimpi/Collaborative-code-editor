import './CollaborationSection.css';
import { useState, useEffect } from 'react';
import { Users, Check, Loader2, Clock, Eye, Sparkles } from 'lucide-react';
import { useSettings } from '../../context/useSettings';

export default function CollaborationSection({ onShowToast }) {
  const { settings, saveCollaborationSettings } = useSettings();

  const [showLiveCursors, setShowLiveCursors] = useState(true);
  const [showCollaboratorLabels, setShowCollaboratorLabels] = useState(true);
  const [autosaveDelay, setAutosaveDelay] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (settings) {
      setShowLiveCursors(settings.show_live_cursors !== false);
      setShowCollaboratorLabels(settings.show_collaborator_labels !== false);
      setAutosaveDelay(Number(settings.autosave_delay) || 2);
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await saveCollaborationSettings({
        showLiveCursors,
        showCollaboratorLabels,
        autosaveDelay
      });
      onShowToast?.('Collaboration settings saved!', 'success');
    } catch (err) {
      onShowToast?.(err.message || 'Failed to save collaboration settings.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    showLiveCursors !== (settings?.show_live_cursors !== false) ||
    showCollaboratorLabels !== (settings?.show_collaborator_labels !== false) ||
    autosaveDelay !== (Number(settings?.autosave_delay) || 2);

  return (
    <form className="settings-section-form" onSubmit={handleSubmit}>
      <div className="settings-section-header">
        <h2 className="section-title">Collaboration</h2>
        <p className="section-subtitle">
          Manage real-time peer presence indicators, cursor flags, and automatic document persistence intervals.
        </p>
      </div>

      {/* Presence & Live Cursors */}
      <div className="settings-card">
        <h3 className="card-heading">Peer Presence & Indicators</h3>

        <div className="settings-toggle-list" style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <span className="toggle-title">Show Live Collaborator Cursors</span>
              <span className="toggle-desc">
                Render colored live cursor flags and multi-line selection boxes for teammates working in the same file.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${showLiveCursors ? 'is-on' : ''}`}
              onClick={() => setShowLiveCursors((prev) => !prev)}
              role="switch"
              aria-checked={showLiveCursors}
              aria-label="Toggle live collaborator cursors"
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="toggle-row">
            <div className="toggle-label-wrap">
              <span className="toggle-title">Show Collaborator Name Labels</span>
              <span className="toggle-desc">
                Display floating name tags above active collaborator carets to instantly identify who is typing.
              </span>
            </div>
            <button
              type="button"
              className={`modern-toggle-switch ${showCollaboratorLabels ? 'is-on' : ''}`}
              onClick={() => setShowCollaboratorLabels((prev) => !prev)}
              role="switch"
              aria-checked={showCollaboratorLabels}
              aria-label="Toggle collaborator name labels"
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
      </div>

      {/* Auto-save Delay */}
      <div className="settings-card">
        <h3 className="card-heading">Document Auto-Save Frequency</h3>
        <p className="settings-card-desc">
          Controls how quickly editor changes are committed to PostgreSQL database checkpoints after typing stops.
        </p>

        <div className="autosave-selector-grid" role="radiogroup" aria-label="Auto-save delay">
          <button
            type="button"
            className={`autosave-card-btn ${autosaveDelay === 1 ? 'active' : ''}`}
            onClick={() => setAutosaveDelay(1)}
            role="radio"
            aria-checked={autosaveDelay === 1}
          >
            <div className="autosave-icon-wrap">
              <Clock size={16} />
            </div>
            <div className="autosave-info">
              <span className="autosave-time">1 Second</span>
              <span className="autosave-badge">Rapid Sync</span>
              <span className="autosave-desc">Ideal for high-speed internet connections and rapid teamwork.</span>
            </div>
            {autosaveDelay === 1 && <Check size={16} className="autosave-check" />}
          </button>

          <button
            type="button"
            className={`autosave-card-btn ${autosaveDelay === 2 ? 'active' : ''}`}
            onClick={() => setAutosaveDelay(2)}
            role="radio"
            aria-checked={autosaveDelay === 2}
          >
            <div className="autosave-icon-wrap">
              <Clock size={16} />
            </div>
            <div className="autosave-info">
              <span className="autosave-time">2 Seconds</span>
              <span className="autosave-badge default">Recommended</span>
              <span className="autosave-desc">Balanced performance with optimal database efficiency.</span>
            </div>
            {autosaveDelay === 2 && <Check size={16} className="autosave-check" />}
          </button>

          <button
            type="button"
            className={`autosave-card-btn ${autosaveDelay === 5 ? 'active' : ''}`}
            onClick={() => setAutosaveDelay(5)}
            role="radio"
            aria-checked={autosaveDelay === 5}
          >
            <div className="autosave-icon-wrap">
              <Clock size={16} />
            </div>
            <div className="autosave-info">
              <span className="autosave-time">5 Seconds</span>
              <span className="autosave-badge">Conservative</span>
              <span className="autosave-desc">Batches code edits into fewer version checkpoints.</span>
            </div>
            {autosaveDelay === 5 && <Check size={16} className="autosave-check" />}
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
              <span>Saving Collaboration...</span>
            </>
          ) : (
            <>
              <Check size={15} />
              <span>Save Collaboration Settings</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
