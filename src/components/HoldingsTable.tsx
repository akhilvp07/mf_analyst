import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Layers,
  ChevronRight
} from 'lucide-react';
import { PortfolioHolding } from '../types';
import { formatINR, formatNavDateDisplay, formatNavDateShort } from '../utils/financialCalculations';
import { PrivacyValue } from '../context/PrivacyContext';

interface HoldingsTableProps {
  holdings: PortfolioHolding[];
  onViewTransactions: (schemeCode: string) => void;
  onSyncSingleNav: (schemeCode: string, schemeName?: string, isin?: string) => Promise<any> | void;
  onSyncAllNavs?: () => void;
  isSyncingNavs?: boolean;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  holdings,
  onViewTransactions,
  onSyncSingleNav
}) => {
  const [syncingCode, setSyncingCode] = useState<string | null>(null);

  // Natural presentation: sorted by current value descending (standard portfolio order)
  const displayHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => b.currentValue - a.currentValue);
  }, [holdings]);

  const handleSyncNav = async (schemeCode: string, schemeName?: string, isin?: string) => {
    setSyncingCode(schemeCode);
    try {
      await onSyncSingleNav(schemeCode, schemeName, isin);
    } finally {
      setTimeout(() => setSyncingCode(null), 600);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mobile Card List View (Visible on small screens < md) */}
      <div className="block md:hidden space-y-3">
        {displayHoldings.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center text-neutral-400">
            <Layers className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
            <p className="font-semibold text-neutral-300">No mutual fund holdings found</p>
            <p className="text-xs text-neutral-500 mt-1">Import a CAS statement or add transactions to view holdings.</p>
          </div>
        ) : (
          displayHoldings.map((holding) => {
            const isProfit = holding.totalGain >= 0;
            const isSyncing = syncingCode === holding.schemeCode;
            const plan = holding.planType || 'Direct';
            const option = holding.optionType || 'Growth';

            return (
              <div
                key={`mobile_${holding.schemeCode}_${holding.folioNumber}`}
                onClick={() => onViewTransactions(holding.schemeCode)}
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 active:bg-neutral-800/60 rounded-2xl shadow-sm transition cursor-pointer p-4 space-y-3"
              >
                {/* Header: Scheme Name & Plan */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm text-neutral-100 leading-snug">
                      {holding.schemeName}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-neutral-400">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        plan === 'Regular'
                          ? 'bg-amber-950/70 text-amber-300 border border-amber-800/80'
                          : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                      }`}>
                        {plan}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-800 border border-neutral-700 text-neutral-300">
                        {option}
                      </span>
                      <span className="truncate max-w-[140px] text-neutral-400">{holding.category}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0 mt-1" />
                </div>

                {/* Folio, NAV & NAV Date Info */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 bg-neutral-950/60 px-3 py-2 rounded-xl border border-neutral-800/70">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">Folio: <strong className="font-mono text-neutral-300">{holding.folioNumber}</strong></span>
                    {holding.navDate && (
                      <span className="text-[10px] text-neutral-500 font-mono mt-0.5">
                        NAV as of: <span className="text-neutral-300 font-medium">{formatNavDateShort(holding.navDate)}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right">
                      <div className="font-mono font-semibold text-neutral-200">₹{holding.currentNav.toFixed(2)}</div>
                      {holding.navChange1D !== undefined && holding.navChange1D !== 0 && (
                        <div className={`text-[10px] font-mono flex items-center justify-end gap-0.5 ${(holding.navChange1D || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {(holding.navChange1D || 0) >= 0 ? '+' : ''}{holding.navChange1D.toFixed(2)}%
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSyncNav(holding.schemeCode, holding.schemeName, holding.isin);
                      }}
                      className="p-1.5 text-neutral-400 hover:text-emerald-400 rounded-lg hover:bg-neutral-800 transition min-w-[32px] min-h-[32px] flex items-center justify-center cursor-pointer"
                      title={`Sync live NAV (Current: as of ${holding.navDate ? formatNavDateDisplay(holding.navDate) : 'Live'})`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Financial Grid */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-800/80 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-500 block">Current Value</span>
                    <div className="font-bold text-white font-mono text-base mt-0.5">
                      <PrivacyValue value={formatINR(holding.currentValue)} />
                    </div>
                    <span className="text-[11px] text-neutral-400 block mt-0.5">
                      Inv: <PrivacyValue value={formatINR(holding.investedAmount, true)} />
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 block">Returns & XIRR</span>
                    <div className={`font-bold font-mono text-sm mt-0.5 flex items-center justify-end ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isProfit ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                      <PrivacyValue value={`${isProfit ? '+' : ''}${formatINR(holding.totalGain)} (${isProfit ? '+' : ''}${holding.totalGainPercentage.toFixed(1)}%)`} />
                    </div>
                    <div className="mt-1 flex items-center justify-end gap-1.5">
                      <span className="text-[10px] text-neutral-400">XIRR:</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
                        {holding.xirr > 0 ? `+${holding.xirr.toFixed(1)}%` : `${holding.xirr.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Allocation bar */}
                <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-400">
                  <div className="flex items-center gap-2 w-full">
                    <span>Portfolio Weight: <strong className="text-neutral-200">{holding.allocationPercentage.toFixed(1)}%</strong></span>
                    <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, holding.allocationPercentage * 2.5)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Holdings Table (Visible on md and larger screens) */}
      <div className="hidden md:block bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-800/70 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Scheme, Plan & Folio</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-3 text-right">Units & Avg NAV</th>
                <th className="py-3.5 px-3 text-right">Current NAV</th>
                <th className="py-3.5 px-3 text-right">Current Value</th>
                <th className="py-3.5 px-3 text-right">Total Gain / ROI</th>
                <th className="py-3.5 px-3 text-right">XIRR</th>
                <th className="py-3.5 px-3 text-right">Allocation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
              {displayHoldings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <Layers className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
                    <p className="font-semibold text-neutral-300">No mutual fund holdings found</p>
                    <p className="text-xs text-neutral-500 mt-1">Import a CAS statement or add transactions to view holdings.</p>
                  </td>
                </tr>
              ) : (
                displayHoldings.map((holding) => {
                  const isProfit = holding.totalGain >= 0;
                  const isDayUp = holding.navChange1D >= 0;
                  const isSyncing = syncingCode === holding.schemeCode;
                  const plan = holding.planType || 'Direct';
                  const option = holding.optionType || 'Growth';
                  const rowPy = 'py-3';

                  return (
                    <tr 
                      key={`${holding.schemeCode}_${holding.folioNumber}`}
                      onClick={() => onViewTransactions(holding.schemeCode)}
                      className="hover:bg-neutral-800/40 transition group cursor-pointer"
                      title="Click to view transactions in ledger"
                    >
                      {/* Scheme & Folio */}
                      <td className={`${rowPy} px-4`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-100 group-hover:text-emerald-400 transition text-sm">
                            {holding.schemeName}
                          </span>
                          
                          {/* Plan Badge */}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            plan === 'Regular'
                              ? 'bg-amber-950/70 text-amber-300 border border-amber-800/80'
                              : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                          }`}>
                            {plan}
                          </span>

                          {/* Option Badge */}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-800 border border-neutral-700 text-neutral-300">
                            {option}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1">
                          <span>AMC: <strong className="text-neutral-300">{holding.fundHouse}</strong></span>
                          <span>•</span>
                          <span>Code: <strong className="font-mono text-neutral-300">#{holding.schemeCode}</strong></span>
                          <span>•</span>
                          <span>Folio: <strong className="font-mono text-neutral-300">{holding.folioNumber}</strong></span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className={`${rowPy} px-3 whitespace-nowrap`}>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-neutral-800 border border-neutral-700 text-neutral-300">
                          {holding.category}
                        </span>
                      </td>

                      {/* Units & Avg Buy NAV */}
                      <td className={`${rowPy} px-3 text-right whitespace-nowrap`}>
                        <div className="font-mono font-medium text-neutral-200">
                          {holding.units.toFixed(3)} units
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Avg: ₹{holding.avgBuyNav.toFixed(2)}
                        </div>
                      </td>

                      {/* Current Live NAV */}
                      <td className={`${rowPy} px-3 text-right whitespace-nowrap`}>
                        <div className="font-mono font-bold text-neutral-100 flex items-center justify-end gap-1.5">
                          <span>₹{holding.currentNav >= 1000 ? holding.currentNav.toFixed(2) : Number.isInteger(holding.currentNav) ? holding.currentNav.toFixed(2) : holding.currentNav.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}</span>
                          <button
                            id={`sync-holding-${holding.schemeCode}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSyncNav(holding.schemeCode, holding.schemeName, holding.isin);
                            }}
                            title="Sync live NAV from AMFI"
                            className="text-neutral-500 hover:text-emerald-400 p-1 rounded cursor-pointer transition"
                          >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-[11px] font-medium mt-0.5">
                          <span className={isDayUp ? 'text-emerald-400' : 'text-rose-400'}>
                            {isDayUp ? '+' : ''}{holding.navChange1D.toFixed(2)}% (1D)
                          </span>
                          {holding.navDate && (
                            <span className="text-neutral-500 text-[10px]" title={`NAV Date: ${formatNavDateDisplay(holding.navDate)}`}>
                              • {formatNavDateShort(holding.navDate)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Current Value & Invested */}
                      <td className={`${rowPy} px-3 text-right whitespace-nowrap`}>
                        <div className="font-bold text-white text-sm font-mono">
                          <PrivacyValue value={formatINR(holding.currentValue)} />
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Inv: <PrivacyValue value={formatINR(holding.investedAmount, true)} />
                        </div>
                      </td>

                      {/* Total Profit / ROI */}
                      <td className={`${rowPy} px-3 text-right whitespace-nowrap`}>
                        <div className={`font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <PrivacyValue value={`${isProfit ? '+' : ''}${formatINR(holding.totalGain)}`} />
                        </div>
                        <div className={`text-[11px] font-semibold flex items-center justify-end ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                          {isProfit ? '+' : ''}{holding.totalGainPercentage.toFixed(2)}%
                        </div>
                      </td>

                      {/* XIRR */}
                      <td className={`${rowPy} px-3 text-right whitespace-nowrap`}>
                        <span className="px-2 py-0.5 rounded-md font-bold font-mono text-xs bg-teal-500/10 text-teal-300 border border-teal-500/20">
                          {holding.xirr > 0 ? `+${holding.xirr.toFixed(2)}%` : `${holding.xirr.toFixed(2)}%`}
                        </span>
                      </td>

                      {/* Allocation % */}
                      <td className={`${rowPy} px-3 text-right whitespace-nowrap`}>
                        <div className="font-semibold text-neutral-300">
                          {holding.allocationPercentage.toFixed(1)}%
                        </div>
                        <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden ml-auto mt-1">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, holding.allocationPercentage * 2.5)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
};
