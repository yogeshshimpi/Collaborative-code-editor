import './ProjectsModal.css';
import { useState, useEffect } from 'react';
import {
  X,
  FolderCode,
  Plus,
  Trash2,
  Edit2,
  Check,
  ExternalLink,
  Loader2,
  Calendar,
  AlertCircle,
  Hash
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

export default function ProjectsModal({
  isOpen,
  onClose,
  currentRoomId,
  onSelectProject,
  onShowToast
}) {
  const { projects, projectsLoading, createProject, renameProject, deleteProject, user } = useAuth();

  const [newProjectName, setNewProjectName] = useState('');
  const [saveCurrentRoom, setSaveCurrentRoom] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);


  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setError('Please provide a name for the new project.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      // If saveCurrentRoom is checked, use the current active room ID
      const roomIdToUse = saveCurrentRoom ? currentRoomId : null;
      const created = await createProject(newProjectName.trim(), roomIdToUse);
      setNewProjectName('');
      setSaveCurrentRoom(false);
      if (onShowToast) {
        onShowToast(`Project "${created.name}" created successfully!`, 'success');
      }
      if (onSelectProject) {
        onSelectProject(created);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRename = (project) => {
    setEditingId(project.id);
    setEditingName(project.name);
    setError(null);
  };

  const handleSaveRename = async (projectId) => {
    if (!editingName.trim()) {
      setError('Project name cannot be empty.');
      return;
    }

    try {
      const updated = await renameProject(projectId, editingName.trim());
      setEditingId(null);
      if (onShowToast) {
        onShowToast(`Renamed project to "${updated.name}"`, 'info');
      }
    } catch (err) {
      setError(err.message || 'Failed to rename project.');
    }
  };

  const handleDelete = async (projectId, projectName) => {
    try {
      await deleteProject(projectId);
      setDeletingId(null);
      if (onShowToast) {
        onShowToast(`Deleted project "${projectName}"`, 'info');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete project.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog projects-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <FolderCode size={18} />
            </div>
            <div>
              <h2 className="modal-title">My Projects</h2>
              <p className="modal-subtitle">
                Manage and switch between your cloud-persisted CodeCollab projects
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="auth-error-banner" role="alert" style={{ margin: '12px 24px 0' }}>
            <AlertCircle size={16} className="error-icon" />
            <span>{error}</span>
          </div>
        )}

        {/* Create new project card */}
        <div className="new-project-card">
          <form onSubmit={handleCreateProject} className="new-project-form">
            <div className="new-project-input-row">
              <input
                type="text"
                className="modal-input"
                placeholder="New project name (e.g. Algorithm Visualizer)"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                disabled={isSubmitting}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !newProjectName.trim()}
              >
                {isSubmitting ? <Loader2 size={15} className="spinning" /> : <Plus size={15} />}
                <span>Create</span>
              </button>
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={saveCurrentRoom}
                onChange={(e) => setSaveCurrentRoom(e.target.checked)}
                disabled={isSubmitting}
              />
              <span>
                Link to current room (<code>{currentRoomId}</code>)
              </span>
            </label>
          </form>
        </div>

        {/* Projects list */}
        <div className="projects-list-container">
          {projectsLoading ? (
            <div className="projects-empty-state">
              <Loader2 size={24} className="spinning" />
              <p>Loading your projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="projects-empty-state">
              <FolderCode size={36} className="empty-icon" />
              <p className="empty-title">No saved projects yet</p>
              <span className="empty-subtitle">
                Create a project above or link your current room to save it under your account.
              </span>
            </div>
          ) : (
            <div className="projects-list">
              {projects.map((project) => {
                const isCurrentRoom = project.room_id === currentRoomId;
                const isEditing = editingId === project.id;
                const isConfirmingDelete = deletingId === project.id;

                return (
                  <div
                    key={project.id}
                    className={`project-item ${isCurrentRoom ? 'active' : ''}`}
                  >
                    <div className="project-item-main">
                      {isEditing ? (
                        <div className="project-edit-row">
                          <input
                            type="text"
                            className="modal-input modal-input-compact"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(project.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button
                            type="button"
                            className="btn-icon-action confirm"
                            onClick={() => handleSaveRename(project.id)}
                            title="Save Name"
                            aria-label="Save Name"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-action cancel"
                            onClick={() => setEditingId(null)}
                            title="Cancel"
                            aria-label="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="project-title-row">
                          <span className="project-name-text">{project.name}</span>
                          {isCurrentRoom && (
                            <span className="current-badge" title="Currently open in editor">
                              Current Room
                            </span>
                          )}
                        </div>
                      )}

                      <div className="project-meta-row">
                        <span className="project-meta-chip">
                          <Hash size={11} />
                          <span>{project.room_id}</span>
                        </span>
                        {project.updated_at && (
                          <span className="project-meta-chip">
                            <Calendar size={11} />
                            <span>{formatDate(project.updated_at)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="project-actions">
                      {!isCurrentRoom && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            if (onSelectProject) onSelectProject(project);
                            onClose();
                          }}
                          title="Open project room"
                          aria-label="Open project room"
                        >
                          <ExternalLink size={13} />
                          <span>Open</span>
                        </button>
                      )}

                      {!isEditing && (
                        <button
                          type="button"
                          className="btn-icon-action"
                          onClick={() => handleStartRename(project)}
                          title="Rename project"
                          aria-label="Rename project"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}

                      {isConfirmingDelete ? (
                        <div className="delete-confirm-wrap">
                          <button
                            type="button"
                            className="btn-delete-confirm"
                            onClick={() => handleDelete(project.id, project.name)}
                            title="Confirm delete"
                            aria-label="Confirm delete"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            className="btn-icon-action cancel"
                            onClick={() => setDeletingId(null)}
                            title="Cancel"
                            aria-label="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-icon-action danger"
                          onClick={() => setDeletingId(project.id)}
                          title="Delete project"
                          aria-label="Delete project"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer info */}
        <div className="modal-footer-hint">
          <span>Signed in as <strong>{user?.email}</strong>. Projects and files are securely stored in Neon cloud.</span>
        </div>
      </div>
    </div>
  );
}
