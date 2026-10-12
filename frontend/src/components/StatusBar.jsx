import { CheckCircle2, GitBranch, Radio, WifiOff, Loader2 } from 'lucide-react';

export default function StatusBar({
  language = 'JavaScript',
  cursor = { line: 1, column: 1 },
  encoding = 'UTF-8',
  connectionStatus = 'connected',
  roomId = 'demo-room'
}) {
  const getLanguageLabel = (lang) => {
    switch (lang.toLowerCase()) {
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

        {/* Sync status: prioritized */}
        {renderSyncStatus()}
      </div>

      <div className="status-bar-right">
        {/* Cursor Ln/Col: hidden on very small phones */}
        <div className="status-item status-item-cursor" title="Cursor Line and Column">
          <span>Ln {cursor.line}, Col {cursor.column}</span>
        </div>

        {/* Encoding: hidden on mobile */}
        <div className="status-item status-item-encoding" title="File Encoding">
          <span>{encoding}</span>
        </div>

        {/* Language Mode: ALWAYS visible */}
        <div className="status-item language-badge" title="Active Language Mode">
          <span>{getLanguageLabel(language)}</span>
        </div>
      </div>
    </footer>
  );
}
