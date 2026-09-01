import React, { useMemo } from 'react';
import { 
  PieChart as PieIcon, 
  Building2, 
  Layers, 
  ShieldCheck, 
  Percent, 
  CheckCircle2, 
  TrendingUp, 
  Briefcase,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { PortfolioHolding } from '../types';
import { 
  computeAssetAllocation, 
  computeCategoryAllocation, 
  computeAmcDistribution, 
  computePortfolioConcentration, 
  formatINR 
} from '../utils/financialCalculations';

interface PortfolioInsightsProps {
  holdings: PortfolioHolding[];
}

export const PortfolioInsights: React.FC<PortfolioInsightsProps> = ({ holdings }) => {
  const assetAlloc = useMemo(() => computeAssetAllocation(holdings), [holdings]);
  const categoryAlloc = useMemo(() => computeCategoryAllocation(holdings), [holdings]);
  const amcAlloc = useMemo(() => computeAmcDistribution(holdings), [holdings]);
  const concentration = useMemo(() => computePortfolioConcentration(holdings), [holdings]);

  const totalPortfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.currentValue, 0);
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
        <PieIcon className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-neutral-200">No Portfolio Data</h3>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
          Import your CAS statement or add transactions to view dynamic asset allocation, category distribution, and AMC exposures.
        </p>
      </div>
    );
  }

  // Calculate HHI concentration level description
  const getHhiStatus = (hhi: number) => {
    if (hhi <= 1500) {
      return {
        label: 'Well Diversified',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        description: 'Portfolio risk is broadly spread across multiple independent funds.'
      };
    }
    if (hhi <= 2500) {
      return {
        label: 'Moderately Concentrated',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        description: 'A few schemes form a substantial portion of your total portfolio weight.'
      };
    }
    return {
      label: 'Highly Concentrated',
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      description: 'Portfolio returns are heavily dominated by 1-2 major fund positions.'
    };
  };

  const hhiStatus = getHhiStatus(concentration.hhiScore);

  return (
    <div className="space-y-6">
      {/* Top Allocation & Concentration Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dynamic Asset Class Breakdown */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              Asset Class Allocation
            </span>
          </div>

          <div className="space-y-2.5 mt-3 text-xs">
            {assetAlloc.equity > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-neutral-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Equity Funds
                  </span>
                  <span className="font-semibold text-emerald-400">{assetAlloc.equity.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${assetAlloc.equity}%` }} />
                </div>
              </div>
            )}

            {assetAlloc.debt > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-neutral-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    Debt & Fixed Income
                  </span>
                  <span className="font-semibold text-blue-400">{assetAlloc.debt.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${assetAlloc.debt}%` }} />
                </div>
              </div>
            )}

            {assetAlloc.hybrid > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-neutral-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    Hybrid / Multi Asset
                  </span>
                  <span className="font-semibold text-purple-400">{assetAlloc.hybrid.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: `${assetAlloc.hybrid}%` }} />
                </div>
              </div>
            )}

            {assetAlloc.gold > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-neutral-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Gold & Commodities
                  </span>
                  <span className="font-semibold text-amber-400">{assetAlloc.gold.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: `${assetAlloc.gold}%` }} />
                </div>
              </div>
            )}

            {assetAlloc.cash > 0 && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-neutral-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                    Liquid & Money Market
                  </span>
                  <span className="font-semibold text-cyan-400">{assetAlloc.cash.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${assetAlloc.cash}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Plan & Option Structure */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              Plan & Option Efficiency
            </span>
          </div>

          <div className="space-y-4 mt-3 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-300">Direct Plan Ratio</span>
                <span className="font-semibold text-emerald-400">{concentration.directPlanPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${concentration.directPlanPercentage}%` }} title="Direct Plans" />
                <div className="bg-neutral-700 h-full" style={{ width: `${concentration.regularPlanPercentage}%` }} title="Regular Plans" />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                {concentration.directPlanPercentage >= 90 
                  ? 'Excellent: Zero distributor commissions paid.'
                  : `${concentration.regularPlanPercentage.toFixed(0)}% in Regular plans with distributor expense commissions.`}
              </p>
            </div>

            <div className="border-t border-neutral-800/80 pt-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-neutral-300">Growth Option Ratio</span>
                <span className="font-semibold text-teal-400">{concentration.growthOptionPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden flex">
                <div className="bg-teal-500 h-full" style={{ width: `${concentration.growthOptionPercentage}%` }} title="Growth" />
                <div className="bg-neutral-700 h-full" style={{ width: `${concentration.idcwOptionPercentage}%` }} title="IDCW (Dividend)" />
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Growth options maximize tax efficiency via unrealized compounding.
              </p>
            </div>
          </div>
        </div>

        {/* Portfolio Concentration & HHI */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-indigo-400" />
                Concentration Index
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${hhiStatus.color}`}>
                {hhiStatus.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-neutral-800/40 border border-neutral-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] uppercase font-medium text-neutral-400">Top Fund Weight</div>
                <div className="text-base font-bold text-white mt-0.5">{concentration.topHoldingWeight.toFixed(1)}%</div>
              </div>
              <div className="bg-neutral-800/40 border border-neutral-800 rounded-xl p-2.5 text-center">
                <div className="text-[10px] uppercase font-medium text-neutral-400">Top 3 Funds Weight</div>
                <div className="text-base font-bold text-white mt-0.5">{concentration.top3HoldingsWeight.toFixed(1)}%</div>
              </div>
            </div>

            <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
              {hhiStatus.description}
            </p>
          </div>

          <div className="text-[11px] text-neutral-500 border-t border-neutral-800 pt-2.5 mt-3 flex items-center justify-between">
            <span>HHI Score: <strong className="text-neutral-300 font-mono">{concentration.hhiScore}</strong></span>
            <span>{holdings.length} Active Schemes</span>
          </div>
        </div>
      </div>

      {/* Dynamic Breakdown: SEBI Categories & Fund Houses (AMCs) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEBI Category Breakdown */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                SEBI Category Allocation
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Calculated dynamically from real scheme mandates in your portfolio
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
              {categoryAlloc.length} Categories
            </span>
          </div>

          <div className="space-y-3.5">
            {categoryAlloc.map((cat, idx) => {
              const colors = [
                'bg-emerald-500',
                'bg-teal-500',
                'bg-blue-500',
                'bg-indigo-500',
                'bg-purple-500',
                'bg-amber-500',
                'bg-rose-500'
              ];
              const colorClass = colors[idx % colors.length];

              return (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-neutral-200 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${colorClass}`}></span>
                      {cat.category}
                      <span className="text-[10px] text-neutral-400 font-normal">
                        ({cat.schemesCount} {cat.schemesCount === 1 ? 'fund' : 'funds'})
                      </span>
                    </span>
                    <div className="text-right">
                      <span className="font-semibold text-white font-mono">{formatINR(cat.value, true)}</span>
                      <span className="text-neutral-400 ml-1.5 font-medium">({cat.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fund House (AMC) Breakdown */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-400" />
                Asset Management Company (AMC) Exposure
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Fund house concentration derived from your holdings
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
              {amcAlloc.length} AMCs
            </span>
          </div>

          <div className="space-y-3">
            {amcAlloc.map((amc, idx) => (
              <div 
                key={amc.fundHouse} 
                className="bg-neutral-800/40 border border-neutral-800/80 p-3.5 rounded-xl flex items-center justify-between hover:border-neutral-700 transition"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-100 text-xs truncate">
                      {amc.fundHouse}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                      {amc.schemesCount} {amc.schemesCount === 1 ? 'fund' : 'funds'}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-2">
                    <div 
                      className="bg-teal-500 h-full rounded-full" 
                      style={{ width: `${Math.min(amc.percentage, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-white font-mono">
                    {formatINR(amc.value, true)}
                  </div>
                  <div className="text-[11px] text-emerald-400 font-semibold">
                    {amc.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
