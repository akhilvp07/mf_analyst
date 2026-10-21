import React, { useState, useRef, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  LogOut, 
  User, 
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  Download
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

export type SyncVisualState = 'idle' | 'syncing' | 'synced' | 'conflict_resolved' | 'error' | 'offline';

interface GoogleDriveSyncIndicatorProps {
  user: FirebaseUser | null;
  syncState: SyncVisualState;
  lastSyncedAt: string | null;
  onOpenSignIn: () => void;
  onSyncNow: () => void;
  onSignOut: () => void;
}

export const GoogleDriveSyncIndicator: React.FC<GoogleDriveSyncIndicatorProps> = ({
  user,
  syncState,
  lastSyncedAt,
  onOpenSignIn,
  onSyncNow,
  onSignOut
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format relative or friendly time
  const formatSyncTime = (isoTime: string | null) => {
    if (!isoTime) return 'Never synced';
    const date = new Date(isoTime);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleDownloadBackup = () => {
    try {
      const transactions = JSON.parse(localStorage.getItem('mftracker_transactions') || '[]');
      const schemes = JSON.parse(localStorage.getItem('mftracker_mf_schemes') || '{}');
      const splits = JSON.parse(localStorage.getItem('mftracker_fund_splits') || '{}');
      const payload = {
        formatVersion: 1,
        app: 'MFTracker',
        updatedAt: new Date().toISOString(),
        transactions,
        schemes,
        fundMcapSplits: splits
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mftracker_portfolio_data.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export JSON backup:', e);
    }
  };

  // Not signed in
  if (!user) {
    return (
      <button
        onClick={onOpenSignIn}
        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700/80 border border-neutral-700 text-xs font-medium text-neutral-200 hover:text-white flex items-center gap-2 transition cursor-pointer shadow-sm shrink-0"
        title="Sign in with your Google account to sync your portfolio across all your devices"
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
        </svg>
        <span className="hidden sm:inline">Sign in to Sync</span>
        <span className="sm:hidden">Sync</span>
      </button>
    );
  }

  // Signed in user
  const isSyncing = syncState === 'syncing';

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        onClick={() => setIsMenuOpen(prev => !prev)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-800/90 hover:bg-neutral-750 border border-neutral-700/80 text-xs text-neutral-200 transition cursor-pointer shadow-sm"
        title="Google Drive Sync Status"
        aria-expanded={isMenuOpen}
      >
        {/* User avatar or placeholder */}
        {user.photoURL ? (
          <img 
            src={user.photoURL} 
            alt={user.displayName || 'User'} 
            className="w-5 h-5 rounded-full border border-neutral-600 object-cover shrink-0" 
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-emerald-600/30 text-emerald-300 font-bold flex items-center justify-center text-[10px] shrink-0">
            {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
          </div>
        )}

        {/* Sync Status Badge */}
        <div className="flex items-center gap-1.5">
          {syncState === 'syncing' ? (
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
          ) : syncState === 'synced' ? (
            <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : syncState === 'conflict_resolved' ? (
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          ) : syncState === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          )}

          <span className="hidden sm:inline font-medium text-neutral-300">
            {syncState === 'syncing' ? 'Syncing...' : formatSyncTime(lastSyncedAt)}
          </span>
        </div>

        <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0 ml-0.5" />
      </button>

      {/* Popover Dropdown Menu */}
      {isMenuOpen && (
        <div className="absolute right-0 mt-2 w-76 bg-neutral-900 border border-neutral-700/90 rounded-xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
          {/* User Info Header */}
          <div className="pb-3 border-b border-neutral-800 flex items-center gap-3">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                className="w-9 h-9 rounded-full border border-neutral-700 shrink-0" 
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-600/30 text-emerald-300 font-bold flex items-center justify-center text-sm shrink-0">
                {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <p className="font-semibold text-white truncate text-xs">
                {user.displayName || 'Personal Google Account'}
              </p>
              <p className="text-[11px] text-neutral-400 truncate">
                {user.email}
              </p>
            </div>
          </div>

          {/* Sync Status Details */}
          <div className="py-2.5 space-y-2 border-b border-neutral-800 text-[11px]">
            <div className="flex items-center justify-between text-neutral-400">
              <span>Drive Cloud Status:</span>
              <span className={`font-semibold flex items-center gap-1 ${
                syncState === 'synced' ? 'text-emerald-400' :
                syncState === 'syncing' ? 'text-emerald-300' :
                syncState === 'conflict_resolved' ? 'text-amber-400' :
                syncState === 'error' ? 'text-rose-400' : 'text-neutral-400'
              }`}>
                {syncState === 'synced' && <CheckCircle2 className="w-3 h-3" />}
                {syncState === 'synced' ? 'In Sync' :
                 syncState === 'syncing' ? 'Syncing now...' :
                 syncState === 'conflict_resolved' ? 'Merged Conflict' :
                 syncState === 'error' ? 'Sync Issue' : 'Offline Mode'}
              </span>
            </div>

            <div className="flex items-center justify-between text-neutral-400">
              <span>Last Synchronized:</span>
              <span className="text-neutral-200 font-mono text-[10px]">
                {formatSyncTime(lastSyncedAt)}
              </span>
            </div>

            <div className="flex items-center justify-between text-neutral-400">
              <span>Storage Location:</span>
              <span className="text-emerald-400/90 font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Drive: appDataFolder
              </span>
            </div>

            <div className="flex items-center justify-between text-neutral-400">
              <span>Cost & Service:</span>
              <span className="text-emerald-400 font-medium text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                $0 Free (Personal Drive)
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 space-y-1.5">
            <button
              onClick={() => {
                onSyncNow();
                setIsMenuOpen(false);
              }}
              disabled={isSyncing}
              className="w-full py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Portfolio...' : 'Sync Now with Drive'}</span>
            </button>

            <button
              onClick={handleDownloadBackup}
              className="w-full py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white font-medium flex items-center justify-center gap-1.5 transition cursor-pointer text-[11px] border border-neutral-700/60"
              title="Download the exact mftracker_portfolio_data.json file synced to your Drive"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span>Download Synced JSON File</span>
            </button>

            <button
              onClick={() => {
                setIsMenuOpen(false);
                onSignOut();
              }}
              className="w-full py-1.5 px-2.5 rounded-lg text-neutral-400 hover:text-rose-300 hover:bg-neutral-800 font-medium flex items-center justify-center gap-1.5 transition cursor-pointer text-[11px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Google</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
