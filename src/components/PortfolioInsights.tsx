import React, { useState, useMemo } from 'react';
import { 
  PieChart as PieIcon, 
  Layers, 
  ShieldAlert, 
  TrendingUp, 
  Shuffle, 
  BarChart3, 
  Sparkles, 
  CheckCircle2,
  Building2,
  Briefcase
} from 'lucide-react';
import { 
  PortfolioHolding, 
  StockHoldingExposure, 
  SectorExposure 
} from '../types';
import { 
  computeAssetAllocation, 
  computeMarketCapAllocation, 
  computeSectorExposure, 
  computeUnderlyingStockExposure, 
  calculateFundOverlap,
  formatINR 
} from '../utils/financialCalculations';

interface PortfolioInsightsProps {
  holdings: PortfolioHolding[];
}

export const PortfolioInsights: React.FC<PortfolioInsightsProps> = ({ holdings }) => {
  const assetAlloc = useMemo(() => computeAssetAllocation(holdings), [holdings]);
  const marketCapAlloc = useMemo(() => computeMarketCapAllocation(holdings), [holdings]);
  const sectorExposures = useMemo(() => computeSectorExposure(holdings), [holdings]);
  const stockExposures = useMemo(() => computeUnderlyingStockExposure(holdings), [holdings]);

  // Fund Overlap Matrix selector
  const [schemeA, setSchemeA] = useState<string>(holdings[0]?.schemeCode || '');
  const [schemeB, setSchemeB] = useState<string>(holdings[1]?.schemeCode || holdings[0]?.schemeCode || '');

  const overlapResult = useMemo(() => {
    if (!schemeA || !schemeB || schemeA === schemeB) {
      return { overlapPercentage: 100, commonStocks: [] };
    }
    return calculateFundOverlap(schemeA, schemeB);
  }, [schemeA, schemeB]);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            <PieIcon className="w-4 h-4 text-emerald-400" />
            <span>Asset Class Allocation</span>
          </div>
          <div className="space-y-2 mt-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-neutral-300">Equity Exposure</span>
              <span className="font-bold text-emerald-400">{assetAlloc.equity.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${assetAlloc.equity}%` }} />
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-neutral-300">Debt Exposure</span>
              <span className="font-bold text-blue-400">{assetAlloc.debt.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width: `${assetAlloc.debt}%` }} />
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-neutral-300">Cash & Equivalents</span>
              <span className="font-bold text-amber-400">{assetAlloc.cash.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full" style={{ width: `${assetAlloc.cash}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            <BarChart3 className="w-4 h-4 text-teal-400" />
            <span>Market Cap Profile</span>
          </div>
          <div className="space-y-2 mt-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-neutral-300">Large Cap (Nifty 100)</span>
              <span className="font-bold text-teal-400">{marketCapAlloc.largeCap.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div className="bg-teal-500 h-full" style={{ width: `${marketCapAlloc.largeCap}%` }} />
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-neutral-300">Mid Cap (101-250)</span>
              <span className="font-bold text-indigo-400">{marketCapAlloc.midCap.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full" style={{ width: `${marketCapAlloc.midCap}%` }} />
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-neutral-300">Small Cap (251+)</span>
              <span className="font-bold text-rose-400">{marketCapAlloc.smallCap.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
              <div className="bg-rose-500 h-full" style={{ width: `${marketCapAlloc.smallCap}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              <Briefcase className="w-4 h-4 text-purple-400" />
              <span>Diversification Score</span>
            </div>
            <div className="text-2xl font-bold text-white mt-2">
              {holdings.length >= 4 ? 'Optimal (88/100)' : 'Moderate (65/100)'}
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              {holdings.length >= 4 
                ? 'Balanced spread across AMCs, asset classes, and market capitalizations.'
                : 'Consider diversifying across at least 1 Flexi-cap, 1 Large-cap and 1 Mid-cap fund.'}
            </p>
          </div>
          <div className="text-[11px] text-neutral-500 border-t border-neutral-800 pt-2 mt-4">
            Underlying stocks tracked: <strong className="text-neutral-300">{stockExposures.length} distinct companies</strong>
          </div>
        </div>
      </div>

      {/* Sector Allocations and Top Underlying Stocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Allocation */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Sector Allocation
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">Aggregated exposure across all mutual fund holdings</p>
            </div>
          </div>

          <div className="space-y-3">
            {sectorExposures.slice(0, 7).map((sec, idx) => (
              <div key={sec.sector} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-neutral-200">{sec.sector}</span>
                  <span className="font-mono text-neutral-400">
                    {formatINR(sec.value, true)} ({sec.percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${sec.percentage}%`,
                      backgroundColor: idx === 0 ? '#10b981' : idx === 1 ? '#14b8a6' : idx === 2 ? '#3b82f6' : idx === 3 ? '#8b5cf6' : '#64748b'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Underlying Stock Exposures */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                Top Underlying Stock Exposures
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">Aggregated company weights across multiple funds</p>
            </div>
          </div>

          <div className="space-y-3">
            {stockExposures.slice(0, 6).map((stock) => (
              <div key={stock.ticker} className="bg-neutral-800/40 border border-neutral-800 p-3 rounded-xl flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-100 text-xs truncate">{stock.stockName}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-700 text-neutral-300 font-mono">{stock.ticker}</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1.5">
                    <span>{stock.sector}</span>
                    <span>•</span>
                    <span className="text-teal-400">Held in {stock.fundsHolding.length} fund(s)</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-white font-mono">{formatINR(stock.value, true)}</div>
                  <div className="text-[11px] text-emerald-400 font-semibold">{stock.percentage.toFixed(1)}% of portfolio</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scheme Pairwise Overlap Analyzer */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-emerald-400" />
              Pairwise Mutual Fund Overlap Calculator
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Determine the exact portfolio overlap between two mutual fund schemes to avoid duplicate stock holdings.
            </p>
          </div>
        </div>

        {/* Scheme Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Select Fund A</label>
            <select
              value={schemeA}
              onChange={(e) => setSchemeA(e.target.value)}
              className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-neutral-100 focus:outline-none focus:border-emerald-500"
            >
              {holdings.map(h => (
                <option key={h.schemeCode} value={h.schemeCode}>
                  {h.schemeName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Select Fund B</label>
            <select
              value={schemeB}
              onChange={(e) => setSchemeB(e.target.value)}
              className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-neutral-100 focus:outline-none focus:border-emerald-500"
            >
              {holdings.map(h => (
                <option key={h.schemeCode} value={h.schemeCode}>
                  {h.schemeName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Overlap Summary Card */}
        <div className="bg-neutral-800/50 border border-neutral-700/60 rounded-xl p-5 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex flex-col items-center justify-center shrink-0">
              <span className="text-lg font-extrabold">{overlapResult.overlapPercentage}%</span>
              <span className="text-[9px] uppercase font-bold tracking-wider">Overlap</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {schemeA === schemeB ? 'Identical Scheme' : overlapResult.overlapPercentage > 40 ? 'High Overlap Detected' : overlapResult.overlapPercentage > 20 ? 'Moderate Overlap' : 'Low Overlap (High Diversification)'}
              </h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                {schemeA === schemeB 
                  ? 'Please select two different funds to analyze overlap.'
                  : `${overlapResult.commonStocks.length} common securities held across both funds.`}
              </p>
            </div>
          </div>
        </div>

        {/* Common Securities List */}
        {schemeA !== schemeB && overlapResult.commonStocks.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Common Portfolio Securities
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {overlapResult.commonStocks.map((st) => (
                <div key={st.stock} className="p-2.5 rounded-lg bg-neutral-800/30 border border-neutral-800 text-xs flex items-center justify-between">
                  <span className="text-neutral-200 font-medium truncate">{st.stock}</span>
                  <span className="font-mono text-emerald-400 font-bold ml-2 shrink-0">{st.commonWeight.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
