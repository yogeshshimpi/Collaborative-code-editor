import './StatusBar.css';
import { CheckCircle2, GitBranch, Radio, WifiOff, Loader2, Shield, ShieldCheck, Eye } from 'lucide-react';
import SyncStatus from '../SyncStatus/SyncStatus';

export default function StatusBar({
  language = 'JavaScript',
  cursor = { line: 1, column: 1 },
  encoding = 'UTF-8',
  connectionStatus = 'connected',
  roomId = 'demo-room',
  saveStatus = 'saved',
  userRole = 'editor',
  onRetrySave = null,
  lastSavedAt = null
}) {
  const getLanguageLabel = (lang) => {
    if (!lang) return 'Plain Text';
    switch (lang.toLowerCase()) {
      case 'live preview':
        return 'Live Preview';
      case 'javascript':
        return 'JavaScript';
      case 'html':
        return 'HTML';
      case 'css':
        return 'CSS';
      case 'json':
        return 'JSON';
      case 'markdown':
        return 'Markdown';
      default:
        return lang.toUpperCase();
    }
  };

  const renderSyncStatus = () => {
    if (connectionStatus === 'connected') {
      return (
        <div className="status-item status-live" title={`Real-time sync active in ${roomId}`}>
          <Radio size={12} className="text-success" />
          <span className="status-sync-text">Sync: {roomId}</span>
          <span className="status-sync-short">Synced</span>
        </div>
      );
    }
    if (connectionStatus === 'connecting') {
      return (
        <div className="status-item status-connecting-item" title="Connecting to sync server...">
          <Loader2 size={12} className="spinner text-warning" />
          <span>Syncing...</span>
        </div>
      );
    }
    return (
      <div className="status-item text-danger" title="Offline (Changes local only)">
        <WifiOff size={12} />
        <span>Offline</span>
      </div>
    );
  };

  const renderSaveStatus = () => {
    if (saveStatus === 'saving') {
      return (
        <div className="status-item text-warning" title="Saving the latest edit to the cloud database">
          <Loader2 size={12} className="spinner" />
          <span>Saving...</span>
        </div>
      );
    }
    if (saveStatus === 'saved') {
      return (
        <div className="status-item status-save-success" title="The latest edit was confirmed by the cloud database">
          <Cloud size={12} />
          <span>Saved to cloud</span>
        </div>
      );
    }
    if (saveStatus === 'error') {
      return (
        <div className="status-item text-danger" title="The latest edit could not be saved to the cloud database">
          <CloudOff size={12} />
          <span>Save failed</span>
        </div>
      );
    }
    return null;
  };

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        {/* Branch: hidden on narrow screens */}
        <div className="status-item status-item-branch" title="Current Branch">
          <GitBranch size={13} />
          <span>main</span>
        </div>

        {/* Health status: hidden on narrow screens */}
        <div className="status-item status-item-health" title="Code Health Status">
          <CheckCircle2 size={13} className="text-success" />
          <span>No errors</span>
        </div>

        {/* Sync & Save status: prioritized */}
        {renderSyncStatus()}
        <SyncStatus
          status={saveStatus}
          onRetry={onRetrySave}
          lastSavedAt={lastSavedAt}
          className="status-item-sync-status"
        />
      </div>

      <div className="status-bar-right">
        {/* Cursor Ln/Col: hidden when preview tab active or on very small phones */}
        {cursor && (
          <div className="status-item status-item-cursor" title="Cursor Line and Column">
            <span>Ln {cursor.line}, Col {cursor.column}</span>
          </div>
        )}

        {/* Encoding: hidden on mobile */}
        <div className="status-item status-item-encoding" title="File Encoding">
          <span>{encoding}</span>
        </div>

        {/* Role badge */}
        <div
          className={`status-item status-role-item ${userRole === 'viewer' ? 'status-role-viewer' : userRole === 'owner' ? 'status-role-owner' : ''}`}
          title={`Your project access: ${userRole.toUpperCase()}`}
        >
          {userRole === 'owner' ? <ShieldCheck size={12} /> : userRole === 'viewer' ? <Eye size={12} /> : <Shield size={12} />}
          <span>{userRole === 'owner' ? 'Owner' : userRole === 'viewer' ? 'Read-Only' : 'Editor'}</span>
        </div>

        {/* Language Mode: ALWAYS visible */}
        <div className="status-item language-badge" title="Active Language Mode">
          <span>{getLanguageLabel(language)}</span>
        </div>
      </div>
    </footer>
  );
}
