import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  MoreVertical, 
  RefreshCw, 
  Receipt, 
  Copy, 
  Check, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Building2, 
  Tag, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart, 
  Layers,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { PortfolioHolding, TransactionRecord } from '../types';
import { formatINR, formatNavDateDisplay, formatNavDateShort } from '../utils/financialCalculations';
import { PrivacyValue } from '../context/PrivacyContext';

interface HoldingDetailViewProps {
  holding: PortfolioHolding;
  transactions?: TransactionRecord[];
  onBack: () => void;
  onViewTransactions: (schemeCode: string) => void;
  onSyncSingleNav: (schemeCode: string, schemeName?: string, isin?: string) => Promise<any> | void;
}

export const HoldingDetailView: React.FC<HoldingDetailViewProps> = ({
  holding,
  transactions = [],
  onBack,
  onViewTransactions,
  onSyncSingleNav
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close 3-dots menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter transactions for this specific scheme and folio
  const schemeTransactions = transactions.filter(t => 
    t.schemeCode === holding.schemeCode || 
    (t.folioNumber && holding.folioNumber && t.folioNumber.trim() === holding.folioNumber.trim() && t.schemeName.toLowerCase() === holding.schemeName.toLowerCase())
  );

  // Sort transactions by date descending (latest first)
  const sortedTransactions = [...schemeTransactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const purchaseCount = sortedTransactions.filter(t => 
    t.type === 'SIP' || t.type === 'LUMPSUM' || t.type === 'SWITCH_IN' || t.type === 'DIVIDEND_REINVEST'
  ).length;

  const redemptionCount = sortedTransactions.filter(t => 
    t.type === 'REDEMPTION' || t.type === 'SWITCH_OUT'
  ).length;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const handleSyncNav = async () => {
    setIsSyncing(true);
    setIsMenuOpen(false);
    try {
      await onSyncSingleNav(holding.schemeCode, holding.schemeName, holding.isin);
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  const isProfit = (holding.totalGain || 0) >= 0;
  const navChange = Number.isFinite(holding.navChange1D) ? holding.navChange1D : 0;
  const isDayPositive = (holding.dayGain || 0) >= 0;
  const plan = holding.planType || 'Direct';
  const option = holding.optionType || 'Growth';
  const unitsVal = Number.isFinite(holding.units) ? holding.units : 0;
  const avgBuyNavVal = Number.isFinite(holding.avgBuyNav) ? holding.avgBuyNav : 0;
  const currentNavVal = Number.isFinite(holding.currentNav) ? holding.currentNav : 0;
  const totalGainPctVal = Number.isFinite(holding.totalGainPercentage) ? holding.totalGainPercentage : 0;
  const xirrVal = Number.isFinite(holding.xirr) ? holding.xirr : 0;
  const allocPctVal = Number.isFinite(holding.allocationPercentage) ? holding.allocationPercentage : 0;

  // Gain multiple e.g. 1.25x
  const returnMultiple = holding.investedAmount > 0 
    ? ((holding.currentValue || 0) / holding.investedAmount).toFixed(2)
    : '1.00';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Navigation & Action Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white px-3 py-2 -ml-2 rounded-xl hover:bg-neutral-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Holdings</span>
          </button>

          {/* Three dots action menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              id="holding-options-menu-btn"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition cursor-pointer flex items-center justify-center"
              title="More options"
              aria-label="Holding options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl py-2 z-50 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-neutral-800 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Holding Actions
                </div>

                {/* Primary Requested Option: View Ledger Transactions */}
                <button
                  type="button"
                  id="menu-view-ledger-txs"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onViewTransactions(holding.schemeCode);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-neutral-800 text-neutral-200 hover:text-emerald-400 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Receipt className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold">View Ledger Transactions</div>
                    <div className="text-[10px] text-neutral-400">View orders & statement history</div>
                  </div>
                </button>

                {/* Sync Live NAV */}
                <button
                  type="button"
                  onClick={handleSyncNav}
                  className="w-full text-left px-3 py-2.5 hover:bg-neutral-800 text-neutral-200 hover:text-neutral-100 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 text-teal-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
                  <div>
                    <div className="font-semibold">Sync Live NAV</div>
                    <div className="text-[10px] text-neutral-400">Fetch latest NAV from AMFI</div>
                  </div>
                </button>

                <div className="my-1 border-t border-neutral-800" />

                {/* Copy Folio Number */}
                <button
                  type="button"
                  onClick={() => {
                    handleCopy(holding.folioNumber, 'folio');
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    Copy Folio Number
                  </span>
                  {copiedItem === 'folio' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                {/* Copy AMFI Code */}
                <button
                  type="button"
                  onClick={() => {
                    handleCopy(holding.schemeCode, 'code');
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    Copy Scheme Code
                  </span>
                  {copiedItem === 'code' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>

                {/* Copy ISIN if present */}
                {holding.isin && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCopy(holding.isin!, 'isin');
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Copy className="w-3.5 h-3.5 text-neutral-400" />
                      Copy ISIN
                    </span>
                    {copiedItem === 'isin' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scheme Title & Badges */}
        <div className="mt-3">
          <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
            {holding.schemeName}
          </h1>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
              plan === 'Regular'
                ? 'bg-amber-950/70 text-amber-300 border border-amber-800/80'
                : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
            }`}>
              {plan}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 border border-neutral-700 text-neutral-300">
              {option}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-800/90 text-neutral-300 border border-neutral-700">
              {holding.category}
            </span>
            <span className="text-neutral-400 text-xs flex items-center gap-1 ml-1">
              <Building2 className="w-3.5 h-3.5 text-neutral-500" />
              {holding.fundHouse}
            </span>
          </div>
        </div>
      </div>

      {/* Main Valuation & Returns Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Current Valuation */}
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-400 block mb-1">
              Current Valuation
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
              <PrivacyValue value={formatINR(holding.currentValue)} />
            </div>
            <div className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1.5">
              <span>Invested:</span>
              <strong className="text-neutral-200 font-mono">
                <PrivacyValue value={formatINR(holding.investedAmount, true)} />
              </strong>
              <span className="text-neutral-500">({returnMultiple}x)</span>
            </div>
          </div>

          {/* Total Returns */}
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-400 block mb-1">
              Total Returns (Gain)
            </span>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight flex items-center ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfit ? <TrendingUp className="w-6 h-6 mr-1.5 shrink-0" /> : <TrendingDown className="w-6 h-6 mr-1.5 shrink-0" />}
              <PrivacyValue value={`${isProfit ? '+' : ''}${formatINR(holding.totalGain || 0)}`} />
            </div>
            <div className={`text-xs font-semibold mt-1.5 flex items-center gap-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span>{isProfit ? '+' : ''}{totalGainPctVal.toFixed(2)}% absolute ROI</span>
            </div>
          </div>

          {/* 1D Today's Movement & XIRR */}
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-neutral-400 block mb-1">
              Today's 1-Day Return
            </span>
            <div className={`text-xl sm:text-2xl font-bold font-mono tracking-tight flex items-center ${isDayPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isDayPositive ? <ArrowUpRight className="w-5 h-5 mr-1" /> : <ArrowDownRight className="w-5 h-5 mr-1" />}
              <PrivacyValue value={`${isDayPositive ? '+' : ''}${formatINR(holding.dayGain || 0)}`} />
              <span className="text-xs font-normal ml-1.5">
                ({isDayPositive ? '+' : ''}{navChange.toFixed(2)}%)
              </span>
            </div>
            <div className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1.5">
              <span>Annualized XIRR:</span>
              <span className="px-1.5 py-0.5 rounded text-xs font-bold font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
                {xirrVal > 0 ? `+${xirrVal.toFixed(2)}%` : `${xirrVal.toFixed(2)}%`} p.a.
              </span>
            </div>
          </div>
        </div>

        {/* Visual Progress Bar (Invested vs Current) */}
        <div className="mt-6 pt-5 border-t border-neutral-800/80">
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
            <span>Portfolio Allocation Weight</span>
            <span className="font-semibold text-neutral-200">{allocPctVal.toFixed(2)}% of total portfolio</span>
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(2, allocPctVal))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Core Holding Metrics Grid */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          Holding Overview & Unit Details
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {/* Units Held (prominently displayed) */}
          <div className="bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] uppercase font-bold text-neutral-400 block mb-1">
              Units Held
            </span>
            <div className="text-lg font-bold font-mono text-emerald-300">
              {unitsVal.toFixed(3)}
            </div>
            <span className="text-[11px] text-neutral-500 block mt-0.5">
              Exact: {unitsVal.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} units
            </span>
          </div>

          {/* Average Buy NAV */}
          <div className="bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] uppercase font-bold text-neutral-400 block mb-1">
              Average Buy NAV
            </span>
            <div className="text-lg font-bold font-mono text-white">
              ₹{avgBuyNavVal.toFixed(2)}
            </div>
            <span className="text-[11px] text-neutral-500 block mt-0.5">
              Weighted cost per unit
            </span>
          </div>

          {/* Current Live NAV */}
          <div className="bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase font-bold text-neutral-400 block">
                Current NAV
              </span>
              <button
                type="button"
                onClick={handleSyncNav}
                className="text-neutral-500 hover:text-emerald-400 p-0.5 rounded cursor-pointer transition"
                title="Sync live NAV"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
            <div className="text-lg font-bold font-mono text-white">
              ₹{currentNavVal.toFixed(2)}
            </div>
            <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1">
              <span>{holding.navDate ? formatNavDateDisplay(holding.navDate) : 'Latest'}</span>
              {navChange !== 0 && (
                <span className={navChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  ({navChange >= 0 ? '+' : ''}{navChange.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>

          {/* Capital Invested */}
          <div className="bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] uppercase font-bold text-neutral-400 block mb-1">
              Net Capital Invested
            </span>
            <div className="text-lg font-bold font-mono text-white">
              <PrivacyValue value={formatINR(holding.investedAmount || 0, true)} />
            </div>
            <span className="text-[11px] text-neutral-500 block mt-0.5">
              Active cost basis
            </span>
          </div>

          {/* Annualized XIRR */}
          <div className="bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] uppercase font-bold text-neutral-400 block mb-1">
              Annualized Return (XIRR)
            </span>
            <div className="text-lg font-bold font-mono text-teal-300">
              {xirrVal > 0 ? `+${xirrVal.toFixed(2)}%` : `${xirrVal.toFixed(2)}%`}
            </div>
            <span className="text-[11px] text-neutral-500 block mt-0.5">
              Compounded annual return
            </span>
          </div>

          {/* Portfolio Weight */}
          <div className="bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800/80">
            <span className="text-[11px] uppercase font-bold text-neutral-400 block mb-1">
              Portfolio Weight
            </span>
            <div className="text-lg font-bold font-mono text-white">
              {allocPctVal.toFixed(2)}%
            </div>
            <span className="text-[11px] text-neutral-500 block mt-0.5">
              Share of total assets
            </span>
          </div>
        </div>
      </div>

      {/* Fund Specifications & Folio Details */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4 flex items-center gap-2">
          <Tag className="w-4 h-4 text-emerald-400" />
          Fund & Account Specifications
        </h2>

        <div className="divide-y divide-neutral-800/60 text-xs sm:text-sm">
          {/* Folio Number */}
          <div className="py-2.5 flex items-center justify-between gap-4">
            <span className="text-neutral-400">Folio Number</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-neutral-200">{holding.folioNumber}</span>
              <button
                type="button"
                onClick={() => handleCopy(holding.folioNumber, 'folio-inline')}
                className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-800 transition cursor-pointer"
                title="Copy folio number"
              >
                {copiedItem === 'folio-inline' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Fund House (AMC) */}
          <div className="py-2.5 flex items-center justify-between gap-4">
            <span className="text-neutral-400">Fund House / AMC</span>
            <span className="font-medium text-neutral-200 text-right">{holding.fundHouse}</span>
          </div>

          {/* Category */}
          <div className="py-2.5 flex items-center justify-between gap-4">
            <span className="text-neutral-400">Asset Category</span>
            <span className="font-medium text-neutral-200 text-right">{holding.category}</span>
          </div>

          {/* Plan & Option */}
          <div className="py-2.5 flex items-center justify-between gap-4">
            <span className="text-neutral-400">Plan & Option</span>
            <span className="font-medium text-neutral-200 text-right">
              {plan} Plan • {option} Option
            </span>
          </div>

          {/* AMFI Scheme Code */}
          <div className="py-2.5 flex items-center justify-between gap-4">
            <span className="text-neutral-400">AMFI Scheme Code</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-neutral-300">#{holding.schemeCode}</span>
              <button
                type="button"
                onClick={() => handleCopy(holding.schemeCode, 'code-inline')}
                className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-800 transition cursor-pointer"
                title="Copy scheme code"
              >
                {copiedItem === 'code-inline' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* ISIN */}
          {holding.isin && (
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="text-neutral-400">ISIN</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-neutral-300">{holding.isin}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(holding.isin!, 'isin-inline')}
                  className="text-neutral-500 hover:text-white p-1 rounded hover:bg-neutral-800 transition cursor-pointer"
                  title="Copy ISIN"
                >
                  {copiedItem === 'isin-inline' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Last Transaction Date */}
          {holding.lastTransactionDate && (
            <div className="py-2.5 flex items-center justify-between gap-4">
              <span className="text-neutral-400">Last Transaction Date</span>
              <span className="font-medium text-neutral-200">
                {formatNavDateDisplay(holding.lastTransactionDate)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Primary Action Card: View Ledger Transactions */}
      <div 
        onClick={() => onViewTransactions(holding.schemeCode)}
        className="bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 hover:bg-neutral-850 rounded-2xl p-5 shadow-sm cursor-pointer transition group"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-neutral-100 group-hover:text-emerald-300 transition text-sm sm:text-base flex items-center gap-2">
                <span>View Ledger Transactions</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {sortedTransactions.length || holding.transactionsCount} entries
                </span>
              </div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {purchaseCount > 0 && `${purchaseCount} purchase${purchaseCount !== 1 ? 's' : ''}`}
                {purchaseCount > 0 && redemptionCount > 0 && ' • '}
                {redemptionCount > 0 && `${redemptionCount} redemption${redemptionCount !== 1 ? 's' : ''}`}
                {' — Click to view complete statement with SIP dates, units & NAV'}
              </div>
            </div>
          </div>
          <ArrowRightIcon className="w-5 h-5 text-neutral-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition shrink-0" />
        </div>
      </div>

      {/* Recent Orders Preview */}
      {sortedTransactions.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Recent Transactions in this Fund
            </h3>
            <button
              type="button"
              onClick={() => onViewTransactions(holding.schemeCode)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1"
            >
              All {sortedTransactions.length} in Ledger →
            </button>
          </div>

          <div className="divide-y divide-neutral-800/70 text-xs">
            {sortedTransactions.slice(0, 4).map((tx) => {
              const isRedeem = tx.type === 'REDEMPTION' || tx.type === 'SWITCH_OUT';
              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        isRedeem 
                          ? 'bg-rose-950/70 text-rose-300 border border-rose-800/80' 
                          : tx.type === 'SIP' 
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80' 
                          : 'bg-blue-950/70 text-blue-300 border border-blue-800/80'
                      }`}>
                        {tx.type}
                      </span>
                      <span className="text-neutral-400 text-[11px]">
                        {formatNavDateDisplay(tx.date)}
                      </span>
                    </div>
                    <div className="text-neutral-400 text-[11px] mt-1 font-mono">
                      {tx.units.toFixed(3)} units @ ₹{tx.nav.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className={`font-bold text-sm ${isRedeem ? 'text-rose-400' : 'text-neutral-100'}`}>
                      {isRedeem ? '-' : '+'}{formatINR(tx.amount)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper chevron icon
function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      fill="none" 
      viewBox="0 0 24 24" 
      strokeWidth={2} 
      stroke="currentColor" 
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
