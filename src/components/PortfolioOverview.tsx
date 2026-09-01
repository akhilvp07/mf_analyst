import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart as PieIcon, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  ShieldCheck, 
  Award,
  Sparkles,
  Zap,
  Info,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { PortfolioHolding, PortfolioSummary, AssetAllocation, MarketCapAllocation, TransactionRecord } from '../types';
import { formatINR, computeAssetAllocation, computeMarketCapAllocation } from '../utils/financialCalculations';
import { PortfolioGrowthChart } from './PortfolioGrowthChart';

interface PortfolioOverviewProps {
  summary: PortfolioSummary;
  holdings: PortfolioHolding[];
  transactions?: TransactionRecord[];
  onNavigateTab: (tab: any) => void;
  onOpenImport: () => void;
}

export const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({
  summary,
  holdings,
  transactions = [],
  onNavigateTab,
  onOpenImport
}) => {
  const assetAllocation = computeAssetAllocation(holdings);
  const marketCapAllocation = computeMarketCapAllocation(holdings);

  const isDayPositive = summary.dayGain >= 0;
  const isTotalPositive = summary.totalGain >= 0;

  // Benchmark stats (Historical Nifty averages for comparison)
  const nifty50Cagr = 14.8;
  const nifty500Cagr = 16.2;
  const alphaVsNifty50 = summary.xirr - nifty50Cagr;

  return (
    <div className="space-y-6">
      {/* Hero Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Portfolio Value */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Current Portfolio Value</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {formatINR(summary.totalCurrentValue)}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs border-t border-neutral-800/80 pt-2.5">
            <span className="text-neutral-400">Total Capital Invested</span>
            <span className="font-semibold text-neutral-200">{formatINR(summary.totalInvestedAmount)}</span>
          </div>
        </div>

        {/* Total Overall Gain / Return */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Profit / Returns</span>
            <div className={`w-8 h-8 rounded-lg ${isTotalPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'} flex items-center justify-center`}>
              {isTotalPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isTotalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isTotalPositive ? '+' : ''}{formatINR(summary.totalGain)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs border-t border-neutral-800/80 pt-2.5">
            <span className="text-neutral-400">Absolute ROI</span>
            <span className={`font-semibold flex items-center ${isTotalPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isTotalPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
              {isTotalPositive ? '+' : ''}{summary.totalGainPercentage.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Annualized XIRR */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Annualized XIRR</span>
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-teal-400 tracking-tight">
              {summary.xirr > 0 ? `+${summary.xirr.toFixed(2)}%` : `${summary.xirr.toFixed(2)}%`}
            </span>
            <span className="text-xs text-neutral-500 font-medium">p.a.</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs border-t border-neutral-800/80 pt-2.5">
            <span className="text-neutral-400">Alpha vs Nifty 50</span>
            <span className={`font-semibold flex items-center ${alphaVsNifty50 >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {alphaVsNifty50 >= 0 ? `+${alphaVsNifty50.toFixed(2)}%` : `${alphaVsNifty50.toFixed(2)}%`}
            </span>
          </div>
        </div>

        {/* Today's 1-Day Movement */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-neutral-700 transition">
          <div className="flex items-center justify-between text-neutral-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Day Gain</span>
            <div className={`w-8 h-8 rounded-lg ${isDayPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'} flex items-center justify-center`}>
              {isDayPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isDayPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isDayPositive ? '+' : ''}{formatINR(summary.dayGain)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs border-t border-neutral-800/80 pt-2.5">
            <span className="text-neutral-400">Day Change %</span>
            <span className={`font-semibold ${isDayPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isDayPositive ? '+' : ''}{summary.dayGainPercentage.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Growth Curve Chart with LTTB & Benchmarks */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Portfolio Growth & Benchmark Performance
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Net worth trajectory compared against capital invested and Nifty index returns (Rendered with LTTB downsampling for 60fps responsiveness).
            </p>
          </div>
        </div>

        <PortfolioGrowthChart holdings={holdings} summary={summary} transactions={transactions} />
      </div>

      {/* Two Columns: Asset Allocation & Top Performing Funds */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Top Holdings Quick View */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                Active Schemes & Holdings ({holdings.length})
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">Ranked by allocation weighting</p>
            </div>
            <button
              onClick={() => onNavigateTab('holdings')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              View Full Table <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {holdings.slice(0, 4).map((holding) => {
              const isHoldingProfit = holding.totalGain >= 0;
              return (
                <div 
                  key={holding.schemeCode}
                  className="bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-100 text-sm truncate">
                        {holding.schemeName}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-700/60 text-neutral-300 shrink-0">
                        {holding.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-neutral-400 mt-1">
                      <span>Folio: <strong className="text-neutral-300 font-mono">{holding.folioNumber}</strong></span>
                      <span>Units: <strong className="text-neutral-300">{holding.units.toFixed(2)}</strong></span>
                      <span>NAV: <strong className="text-neutral-300">₹{holding.currentNav.toFixed(2)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 text-right">
                    <div>
                      <div className="text-sm font-bold text-white">
                        {formatINR(holding.currentValue)}
                      </div>
                      <div className="text-xs text-neutral-400">
                        Invested: {formatINR(holding.investedAmount, true)}
                      </div>
                    </div>

                    <div className="w-24 text-right">
                      <div className={`text-xs font-bold ${isHoldingProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isHoldingProfit ? '+' : ''}{holding.totalGainPercentage.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-teal-400 font-medium">
                        XIRR: {holding.xirr > 0 ? `+${holding.xirr.toFixed(1)}%` : `${holding.xirr.toFixed(1)}%`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {holdings.length > 4 && (
            <div className="mt-3 text-center">
              <button
                onClick={() => onNavigateTab('holdings')}
                className="text-xs text-neutral-400 hover:text-neutral-200 py-1 font-medium cursor-pointer"
              >
                + {holdings.length - 4} more funds in your portfolio. Click to view all.
              </button>
            </div>
          )}
        </div>

        {/* Right 1 Col: Asset Class & Market Cap Distribution */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          {/* Asset Allocation */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-400" />
                Asset Class Split
              </h3>
              <button
                onClick={() => onNavigateTab('insights')}
                className="text-xs font-medium text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                Overlap <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Visual multi-segmented bar */}
            <div className="h-3 rounded-full bg-neutral-800 overflow-hidden flex mb-3">
              <div style={{ width: `${assetAllocation.equity}%` }} className="bg-emerald-500 h-full" title={`Equity: ${assetAllocation.equity.toFixed(1)}%`} />
              <div style={{ width: `${assetAllocation.debt}%` }} className="bg-blue-500 h-full" title={`Debt: ${assetAllocation.debt.toFixed(1)}%`} />
              <div style={{ width: `${assetAllocation.hybrid}%` }} className="bg-purple-500 h-full" title={`Hybrid: ${assetAllocation.hybrid.toFixed(1)}%`} />
              <div style={{ width: `${assetAllocation.cash}%` }} className="bg-amber-500 h-full" title={`Cash: ${assetAllocation.cash.toFixed(1)}%`} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-800/40 border border-neutral-800">
                <span className="flex items-center gap-1.5 text-neutral-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Equity
                </span>
                <span className="font-semibold text-white">{assetAllocation.equity.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-800/40 border border-neutral-800">
                <span className="flex items-center gap-1.5 text-neutral-400">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span> Debt
                </span>
                <span className="font-semibold text-white">{assetAllocation.debt.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Market Cap Breakdown */}
          <div className="border-t border-neutral-800 pt-4">
            <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2.5">
              Equity Market Cap Exposure
            </h4>
            <div className="space-y-2 text-xs">
              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Large Cap</span>
                  <span className="font-semibold text-neutral-200">{marketCapAllocation.largeCap.toFixed(1)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="bg-teal-500 h-full rounded-full" style={{ width: `${marketCapAllocation.largeCap}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Mid Cap</span>
                  <span className="font-semibold text-neutral-200">{marketCapAllocation.midCap.toFixed(1)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${marketCapAllocation.midCap}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-neutral-400 mb-1">
                  <span>Small Cap</span>
                  <span className="font-semibold text-neutral-200">{marketCapAllocation.smallCap.toFixed(1)}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${marketCapAllocation.smallCap}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons Card */}
          <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs text-neutral-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Import CAMS / KFintech Statement</span>
            </div>
            <button
              onClick={onOpenImport}
              className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer transition shrink-0"
            >
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
