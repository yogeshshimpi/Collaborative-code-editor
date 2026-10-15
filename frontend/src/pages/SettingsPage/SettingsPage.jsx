import './SettingsPage.css';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Code2,
  User,
  Palette,
  Sliders,
  Users,
  Bell,
  Shield,
  AlertTriangle,
  FolderCode,
  ArrowLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { useSettings } from '../../context/useSettings';
import Toast from '../../components/Toast/Toast';

import ProfileSection from '../../components/settings/ProfileSection';
import ThemeSection from '../../components/settings/ThemeSection';
import EditorPreferencesSection from '../../components/settings/EditorPreferencesSection';
import CollaborationSection from '../../components/settings/CollaborationSection';
import NotificationsSection from '../../components/settings/NotificationsSection';
import SecuritySection from '../../components/settings/SecuritySection';
import DangerZoneSection from '../../components/settings/DangerZoneSection';

const CATEGORIES = [
  { id: 'profile', label: 'Profile', icon: User, desc: 'Name, avatar & bio' },
  { id: 'theme', label: 'Appearance & Theme', icon: Palette, desc: 'Whole project themes & colors' },
  { id: 'editor', label: 'Editor Preferences', icon: Sliders, desc: 'Font size, wrap, minimap' },
  { id: 'collaboration', label: 'Collaboration', icon: Users, desc: 'Cursors & auto-save' },
  { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Chat & mention alerts' },
  { id: 'security', label: 'Security', icon: Shield, desc: 'Password & active sessions' },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, desc: 'Delete account' }
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { loading: settingsLoading } = useSettings();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') || 'profile';
  const [activeCategory, setActiveCategory] = useState(
    CATEGORIES.some((c) => c.id === initialTab) ? initialTab : 'profile'
  );

  const [toast, setToast] = useState(null);

  // Sync category with URL search param
  const handleSelectCategory = (catId) => {
    setActiveCategory(catId);
    setSearchParams({ tab: catId }, { replace: true });
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  return (
    <div className="settings-page-layout">
      {/* Top Header Navbar */}
      <header className="settings-navbar">
        <div className="settings-navbar-left">
          <button
            type="button"
            className="btn-back-nav"
            onClick={() => navigate('/projects')}
            title="Back to Projects"
            aria-label="Back to Projects"
          >
            <ArrowLeft size={16} />
          </button>

          <div
            className="settings-brand"
            onClick={() => navigate('/projects')}
            role="button"
            tabIndex={0}
            title="CodeCollab Dashboard"
          >
            <div className="brand-icon">
              <Code2 size={16} />
            </div>
            <span className="brand-name">CodeCollab</span>
          </div>

          <span className="navbar-sep">/</span>
          <span className="navbar-crumb-active">Settings</span>
        </div>

        <div className="settings-navbar-right">
          <button
            type="button"
            className="btn btn-secondary btn-nav-projects"
            onClick={() => navigate('/projects')}
            title="Open Projects Dashboard"
          >
            <FolderCode size={14} />
            <span className="btn-text">My Projects</span>
          </button>

          <div
            className="settings-user-pill"
            title={`${user?.name} (${user?.email})`}
          >
            <div
              className="user-avatar-small"
              style={{ backgroundColor: user?.color || '#6366f1' }}
            >
              <span>{user?.initials || 'U'}</span>
            </div>
            <span className="user-pill-name">{user?.name}</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="settings-main-container">
        {/* Mobile Horizontal Category Scroller / Dropdown Tabs */}
        <nav className="settings-mobile-tabs" aria-label="Settings Categories">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`mobile-tab-btn ${isActive ? 'active' : ''} ${
                  cat.id === 'danger' ? 'danger-tab' : ''
                }`}
                onClick={() => handleSelectCategory(cat.id)}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="settings-grid-layout">
          {/* Desktop & Tablet Sidebar */}
          <aside className="settings-sidebar" aria-label="Settings Sidebar Navigation">
            <div className="sidebar-header">
              <span className="sidebar-header-title">Settings</span>
              <span className="sidebar-header-subtitle">Preferences & Account</span>
            </div>

            <div className="sidebar-nav-list" role="tablist">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                const isDanger = cat.id === 'danger';
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`sidebar-nav-item ${isActive ? 'active' : ''} ${
                      isDanger ? 'item-danger' : ''
                    }`}
                    onClick={() => handleSelectCategory(cat.id)}
                  >
                    <div className="nav-item-icon-wrap">
                      <Icon size={16} />
                    </div>
                    <div className="nav-item-text">
                      <span className="nav-item-label">{cat.label}</span>
                      <span className="nav-item-desc">{cat.desc}</span>
                    </div>
                    <ChevronRight size={14} className="nav-item-chevron" />
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Content Area */}
          <section className="settings-content-area" role="tabpanel">
            {settingsLoading ? (
              <div className="settings-loading-state">
                <Loader2 size={28} className="spin-icon" />
                <span>Loading your workspace preferences...</span>
              </div>
            ) : (
              <>
                {activeCategory === 'profile' && (
                  <ProfileSection onShowToast={showToast} />
                )}
                {activeCategory === 'theme' && (
                  <ThemeSection onShowToast={showToast} />
                )}
                {activeCategory === 'editor' && (
                  <EditorPreferencesSection onShowToast={showToast} />
                )}
                {activeCategory === 'collaboration' && (
                  <CollaborationSection onShowToast={showToast} />
                )}
                {activeCategory === 'notifications' && (
                  <NotificationsSection onShowToast={showToast} />
                )}
                {activeCategory === 'security' && (
                  <SecuritySection onShowToast={showToast} />
                )}
                {activeCategory === 'danger' && (
                  <DangerZoneSection onShowToast={showToast} />
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {/* Floating Toast Notification */}
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
