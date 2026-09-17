import React from 'react';
import { 
  TrendingUp, 
  RefreshCw, 
  UploadCloud, 
  Layers, 
  PieChart, 
  Receipt, 
  Calculator,
  Target,
  Eye,
  EyeOff
} from 'lucide-react';
import { formatINR } from '../utils/financialCalculations';
import { PortfolioSummary } from '../types';
import { usePrivacy, PrivacyValue } from '../context/PrivacyContext';

export type ActiveTab = 
  | 'overview' 
  | 'holdings' 
  | 'transactions' 
  | 'goals'
  | 'insights' 
  | 'tax' 
  | 'simulator' 
  | 'import';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  summary: PortfolioSummary;
  isSyncingNavs: boolean;
  onSyncNavs: () => void;
  onOpenImport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  summary,
  isSyncingNavs,
  onSyncNavs
}) => {
  const isPositiveDay = summary.dayGain >= 0;
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();

  const navItems = [
    { id: 'overview' as ActiveTab, label: 'Dashboard', icon: TrendingUp },
    { id: 'holdings' as ActiveTab, label: 'Holdings', icon: Layers, badge: summary.holdingsCount },
    { id: 'transactions' as ActiveTab, label: 'Ledger', icon: Receipt, badge: summary.transactionsCount },
    { id: 'goals' as ActiveTab, label: 'Goal Buckets & Glidepath', icon: Target },
    { id: 'insights' as ActiveTab, label: 'Asset Allocation', icon: PieChart },
    { id: 'tax' as ActiveTab, label: 'Capital Gains & Tax', icon: Receipt },
    { id: 'simulator' as ActiveTab, label: 'SIP Compounding', icon: Calculator },
    { id: 'import' as ActiveTab, label: 'CAS Import & Backup', icon: UploadCloud }
  ];

  return (
    <header className="sticky top-0 z-40 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 text-neutral-100 shadow-md">
      {/* Top Banner / Ticker */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-neutral-950 font-bold text-lg">
            MF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                MFTracker
                <span className="text-[11px] font-medium tracking-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Portfolio Manager
                </span>
              </h1>
            </div>
            <p className="text-xs text-neutral-400 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              AMFI Live Sync • Newton-Raphson XIRR • Instant SWR Caching
            </p>
          </div>
        </div>

        {/* Quick Ticker Pill & Action Buttons */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
          <div className="bg-neutral-800/80 border border-neutral-700/60 rounded-xl px-3.5 py-1.5 flex items-center gap-4 text-xs shrink-0">
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-medium">Net Worth</span>
              <span className="font-semibold text-white text-sm font-mono">
                <PrivacyValue value={formatINR(summary.totalCurrentValue, true)} />
              </span>
            </div>
            <div className="w-px h-6 bg-neutral-700"></div>
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-medium">Annualized XIRR</span>
              <span className="font-semibold text-emerald-400 text-sm font-mono">
                {summary.xirr > 0 ? `+${summary.xirr.toFixed(2)}%` : `${summary.xirr.toFixed(2)}%`}
              </span>
            </div>
            <div className="w-px h-6 bg-neutral-700"></div>
            <div>
              <span className="text-neutral-400 block text-[10px] uppercase font-medium">1D Change</span>
              <span className={`font-semibold text-sm font-mono ${isPositiveDay ? 'text-emerald-400' : 'text-rose-400'}`}>
                <PrivacyValue value={`${isPositiveDay ? '+' : ''}${formatINR(summary.dayGain, true)} (${isPositiveDay ? '+' : ''}${summary.dayGainPercentage.toFixed(2)}%)`} />
              </span>
            </div>
          </div>

          {/* Privacy Toggle & Sync Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="privacy-toggle-btn"
              onClick={togglePrivacyMode}
              title={isPrivacyMode ? 'Disable Privacy Mode (Show Figures)' : 'Enable Privacy Mode (Mask Figures for Public Screen)'}
              className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                isPrivacyMode 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/10' 
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white border-neutral-700'
              }`}
              aria-label="Toggle Privacy Mode"
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
            </button>

            <button
              id="sync-nav-btn"
              onClick={onSyncNavs}
              disabled={isSyncingNavs}
              title="Sync live NAVs from AMFI"
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-sm shadow-emerald-900/30 cursor-pointer disabled:opacity-50 min-h-[36px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNavs ? 'animate-spin' : ''}`} />
              <span>{isSyncingNavs ? 'Syncing...' : 'Sync NAVs'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 overflow-x-auto no-scrollbar border-t border-neutral-800/80 py-1.5 text-xs font-medium" aria-label="Tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-btn-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap transition-colors duration-75 cursor-pointer ${
                  isActive
                    ? 'bg-neutral-800 text-emerald-400 border border-neutral-700 font-semibold shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-neutral-500'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
