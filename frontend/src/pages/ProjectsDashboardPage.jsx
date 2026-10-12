import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code2,
  Plus,
  FolderCode,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  Check,
  X,
  Copy,
  Calendar,
  LogOut,
  Loader2,
  Sparkles,
  Layers,
  Users,
  Mail,
  Shield,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import CollaboratorsModal from '../components/CollaboratorsModal';
import IncomingInvitationsModal from '../components/IncomingInvitationsModal';
import Toast from '../components/Toast';

export default function ProjectsDashboardPage() {
  const {
    user,
    projects,
    projectsLoading,
    createProject,
    renameProject,
    deleteProject,
    logout,
    invitations = [],
    refreshProjects
  } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Sharing & Invitations Modals
  const [isInvitesModalOpen, setIsInvitesModalOpen] = useState(false);
  const [activeProjectForCollab, setActiveProjectForCollab] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setError('Please provide a name for the project.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const targetRoom = newRoomId.trim() || undefined;
      const created = await createProject(newProjectName.trim(), targetRoom);
      setNewProjectName('');
      setNewRoomId('');
      setIsCreating(false);
      showToast(`Created "${created.name}"! Opening editor...`, 'success');
      setTimeout(() => {
        navigate(`/projects/${created.room_id}`);
      }, 400);
    } catch (err) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRename = async (projectId) => {
    if (!editingName.trim()) return;
    try {
      const updated = await renameProject(projectId, editingName.trim());
      setEditingId(null);
      showToast(`Renamed project to "${updated.name}"`, 'info');
    } catch (err) {
      showToast(err.message || 'Failed to rename project.', 'error');
    }
  };

  const handleDelete = async (projectId, projectName) => {
    try {
      await deleteProject(projectId);
      setDeletingId(null);
      showToast(`Deleted "${projectName}"`, 'info');
    } catch (err) {
      showToast(err.message || 'Failed to delete project.', 'error');
    }
  };

  const handleCopyRoom = (e, roomId) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(roomId);
    showToast(`Room ID "${roomId}" copied to clipboard!`, 'info');
  };

  // Filter projects by query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase().trim();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.room_id.toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

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
    <div className="dashboard-layout">
      {/* Top Navigation */}
      <header className="dashboard-navbar">
        <div className="dashboard-brand">
          <div className="brand-icon">
            <Code2 size={18} />
          </div>
          <span className="brand-name">CodeCollab</span>
          <span className="dashboard-tag">Dashboard</span>
        </div>

        <div className="dashboard-nav-right">
          <div className="dashboard-user-badge">
            <div
              className="user-avatar"
              style={{ backgroundColor: user?.color || '#6d5dfc' }}
            >
              <span>{user?.initials || 'U'}</span>
            </div>
            <div className="dashboard-user-details">
              <span className="user-name">{user?.name}</span>
              <span className="user-email">{user?.email}</span>
            </div>
          </div>

          <div className="divider-vertical" />

          <button
            type="button"
            className="btn btn-secondary btn-action"
            onClick={handleLogout}
            title="Log out of your account"
          >
            <LogOut size={14} />
            <span className="btn-text">Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="dashboard-main">
        {/* Banner / Header Bar */}
        <div className="dashboard-header-bar">
          <div>
            <h1 className="dashboard-title">My Projects</h1>
            <p className="dashboard-subtitle">
              Manage, create, and launch your real-time collaborative workspaces
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-new-project"
            onClick={() => {
              setIsCreating(true);
              setError(null);
            }}
          >
            <Plus size={16} />
            <span>New Project</span>
          </button>
        </div>

        {/* Pending In-App Invitations Banner */}
        {invitations.length > 0 && (
          <div className="dashboard-invitations-banner">
            <div className="banner-left">
              <div className="banner-icon-badge">
                <Mail size={18} />
              </div>
              <div className="banner-text">
                <h4 className="banner-title">
                  You have {invitations.length} pending project {invitations.length === 1 ? 'invitation' : 'invitations'}
                </h4>
                <p className="banner-subtitle">
                  Collaborate with team members in real-time. Review and accept invitations to join.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm btn-banner-action"
              onClick={() => setIsInvitesModalOpen(true)}
            >
              <Mail size={14} />
              <span>Review Invitations</span>
              <span className="banner-count-badge">{invitations.length}</span>
            </button>
          </div>
        )}

        {/* Toolbar: Search and Stats */}
        <div className="dashboard-toolbar">
          <div className="dashboard-search-wrap">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="dashboard-search-input"
              placeholder="Search projects by name or room ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="dashboard-toolbar-actions">
            {/* Invitations Button */}
            <button
              type="button"
              className={`dashboard-invitations-btn ${invitations.length > 0 ? 'has-invites' : ''}`}
              onClick={() => setIsInvitesModalOpen(true)}
              title="View incoming project invitations"
            >
              <Mail size={14} />
              <span>Invitations</span>
              {invitations.length > 0 && (
                <span className="invitations-count-pill">{invitations.length}</span>
              )}
            </button>

            <div className="dashboard-stats-chip">
              <Layers size={14} />
              <span>
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </span>
            </div>
          </div>
        </div>

        {/* Create Project Modal / Inline Drawer */}
        {isCreating && (
          <div className="create-project-card">
            <div className="create-card-header">
              <div className="create-card-title">
                <Sparkles size={16} className="sparkle-icon" />
                <span>Create New Project</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreating(false)}
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="auth-error-banner" style={{ margin: '0 0 12px' }}>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateProject} className="create-project-form">
              <div className="create-inputs-row">
                <div className="form-group flex-2">
                  <label htmlFor="new-proj-name">Project Name</label>
                  <input
                    id="new-proj-name"
                    type="text"
                    className="modal-input"
                    placeholder="e.g. Distributed Task Scheduler"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group flex-1">
                  <label htmlFor="new-proj-room">Custom Room ID (Optional)</label>
                  <input
                    id="new-proj-room"
                    type="text"
                    className="modal-input"
                    placeholder="e.g. team-distributed"
                    value={newRoomId}
                    onChange={(e) => setNewRoomId(e.target.value)}
                  />
                </div>
              </div>

              <div className="create-actions-row">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !newProjectName.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="spinning" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      <span>Create & Open Project</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Projects Grid */}
        {projectsLoading ? (
          <div className="dashboard-loading-state">
            <Loader2 size={28} className="spinning" />
            <p>Loading your cloud projects...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="dashboard-empty-state">
            <div className="empty-icon-wrap">
              <FolderCode size={40} />
            </div>
            {searchQuery ? (
              <>
                <h3>No projects match "{searchQuery}"</h3>
                <p>Try searching for a different name or room identifier</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSearchQuery('')}
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <h3>You haven't created any projects yet</h3>
                <p>Create your first project to start coding collaboratively in real time</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setIsCreating(true)}
                >
                  <Plus size={16} />
                  <span>Create Project</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="projects-grid">
            {filteredProjects.map((project) => {
              const isEditing = editingId === project.id;
              const isConfirmingDelete = deletingId === project.id;
              const projectRole = project.role || (project.owner_id === user?.id ? 'owner' : 'editor');
              const isOwner = projectRole === 'owner';

              return (
                <div
                  key={project.id}
                  className="project-card"
                  onClick={() => navigate(`/projects/${project.room_id}`)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="project-card-top">
                    <div className="project-card-icon">
                      <FolderCode size={20} />
                    </div>

                    <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
                      {/* Manage Collaborators Button */}
                      <button
                        type="button"
                        className="btn-card-action"
                        onClick={() => setActiveProjectForCollab(project)}
                        title={isOwner ? "Manage collaborators & invite users" : "View project collaborators"}
                        aria-label="Collaborators"
                      >
                        <Users size={13} />
                      </button>

                      {isOwner && !isEditing && (
                        <button
                          type="button"
                          className="btn-card-action"
                          onClick={() => {
                            setEditingId(project.id);
                            setEditingName(project.name);
                          }}
                          title="Rename project"
                          aria-label="Rename project"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}

                      {isOwner && (
                        isConfirmingDelete ? (
                          <div className="delete-confirm-chip">
                            <button
                              type="button"
                              className="btn-delete-confirm-sm"
                              onClick={() => handleDelete(project.id, project.name)}
                              aria-label="Confirm delete project"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="btn-card-action"
                              onClick={() => setDeletingId(null)}
                              title="Cancel delete"
                              aria-label="Cancel delete"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-card-action danger"
                            onClick={() => setDeletingId(project.id)}
                            title="Delete project"
                            aria-label="Delete project"
                          >
                            <Trash2 size={13} />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Title & Rename Input */}
                  <div className="project-card-body" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <div className="project-card-rename-row">
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
                          title="Save new name"
                          aria-label="Save new name"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-action cancel"
                          onClick={() => setEditingId(null)}
                          title="Cancel rename"
                          aria-label="Cancel rename"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <h2
                        className="project-card-title"
                        onClick={() => navigate(`/projects/${project.room_id}`)}
                        title={project.name}
                      >
                        {project.name}
                      </h2>
                    )}
                  </div>

                  {/* Room ID and metadata */}
                  <div className="project-card-meta">
                    <div
                      className="room-pill-chip"
                      onClick={(e) => handleCopyRoom(e, project.room_id)}
                      title="Click to copy Room ID"
                    >
                      <span className="room-pill-text">#{project.room_id}</span>
                      <Copy size={11} className="room-copy-icon" />
                    </div>

                    {/* Role Chip */}
                    <div className={`role-chip chip-${projectRole}`} title={`Your role: ${projectRole}`}>
                      {projectRole === 'owner' ? <ShieldCheck size={11} /> : projectRole === 'editor' ? <Shield size={11} /> : <ShieldAlert size={11} />}
                      <span>{projectRole === 'owner' ? 'Owner' : projectRole === 'editor' ? 'Editor' : 'Viewer'}</span>
                    </div>

                    {project.updated_at && (
                      <div className="date-chip">
                        <Calendar size={11} />
                        <span>{formatDate(project.updated_at)}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="project-card-footer">
                    <button
                      type="button"
                      className="btn-open-workspace"
                      onClick={() => navigate(`/projects/${project.room_id}`)}
                    >
                      <span>Open Workspace</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Collaborators Modal */}
      {activeProjectForCollab && (
        <CollaboratorsModal
          isOpen={Boolean(activeProjectForCollab)}
          onClose={() => setActiveProjectForCollab(null)}
          projectId={activeProjectForCollab.id}
          projectName={activeProjectForCollab.name}
          userRole={activeProjectForCollab.role || (activeProjectForCollab.owner_id === user?.id ? 'owner' : 'editor')}
          currentUserId={user?.id}
          onShowToast={showToast}
        />
      )}

      {/* Incoming Invitations Modal */}
      <IncomingInvitationsModal
        isOpen={isInvitesModalOpen}
        onClose={() => setIsInvitesModalOpen(false)}
        onShowToast={showToast}
        onAccepted={() => {
          refreshProjects();
        }}
      />

      {/* Toast Feedback */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
