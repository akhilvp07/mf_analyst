import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { PortfolioHolding, PortfolioSummary, TransactionRecord } from '../types';
import { 
  formatINR, 
  lttbDownsample, 
  computeHistoricalPortfolioGrowth, 
  computePeriodReturnMetrics,
  updateLatestNiftyAnchor,
  GrowthDataPoint 
} from '../utils/financialCalculations';
import { Zap, TrendingUp, ArrowUpRight, ArrowDownRight, Award, Info } from 'lucide-react';
import { fetchNiftyMarketData } from '../services/marketService';

interface PortfolioGrowthChartProps {
  holdings: PortfolioHolding[];
  summary: PortfolioSummary;
  transactions?: TransactionRecord[];
}

type Timeframe = '1M' | '6M' | '1Y' | '3Y' | 'ALL';

export const PortfolioGrowthChart: React.FC<PortfolioGrowthChartProps> = ({ 
  holdings, 
  summary, 
  transactions = [] 
}) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('3Y');
  const [showBenchmark, setShowBenchmark] = useState<boolean>(true);
  const [useLttb, setUseLttb] = useState<boolean>(true);

  // Synchronize live Nifty 50 market close on mount
  React.useEffect(() => {
    fetchNiftyMarketData()
      .then(data => {
        if (data?.currentClose && data.currentClose > 0) {
          updateLatestNiftyAnchor(data.currentClose, data.lastUpdated);
        }
      })
      .catch(() => {});
  }, []);

  // Compute physically exact historical portfolio growth time series
  const rawChartData = useMemo(() => {
    return computeHistoricalPortfolioGrowth(transactions, holdings, summary, timeframe);
  }, [transactions, holdings, summary, timeframe]);

  // Pre-warm cache for all timeframes in background so every period button click is 0ms instant
  React.useEffect(() => {
    const timeframes: Timeframe[] = ['1M', '6M', '1Y', '3Y', 'ALL'];
    const timer = setTimeout(() => {
      timeframes.forEach(tf => {
        computeHistoricalPortfolioGrowth(transactions, holdings, summary, tf);
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [transactions, holdings, summary]);

  // Apply LTTB downsampling for high-speed 60fps rendering if large dataset
  const chartData = useMemo(() => {
    if (!useLttb || rawChartData.length < 80) return rawChartData;
    const targetPoints = 75; // Optimal for 60fps DOM animation
    
    // Downsample Net Worth series
    const netWorthPoints = rawChartData.map(d => ({ x: d.x, y: d.netWorth }));
    const sampled = lttbDownsample(netWorthPoints, targetPoints);
    const sampledXSet = new Set(sampled.map(s => s.x));

    // Ensure first and last points are always included
    sampledXSet.add(rawChartData[0]?.x);
    sampledXSet.add(rawChartData[rawChartData.length - 1]?.x);

    return rawChartData.filter(d => sampledXSet.has(d.x));
  }, [rawChartData, useLttb]);

  // Period performance metrics calculated with authentic CAGR / XIRR and real Nifty 50 index levels
  const periodMetrics = useMemo(() => {
    return computePeriodReturnMetrics(timeframe, chartData, transactions, summary, holdings);
  }, [timeframe, chartData, transactions, summary, holdings]);

  return (
    <div className="space-y-4">
      {/* Controls & Timeframe Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Timeframe Pills */}
        <div className="flex items-center gap-1 bg-neutral-800/80 p-1 rounded-xl border border-neutral-700/60">
          {(['1M', '6M', '1Y', '3Y', 'ALL'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              id={`growth-timeframe-${tf}`}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                timeframe === tf
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Feature Toggles */}
        <div className="flex items-center gap-3">
          {/* Nifty 50 Benchmark toggle */}
          <button
            onClick={() => setShowBenchmark(!showBenchmark)}
            className={`px-3 py-1.5 rounded-lg font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showBenchmark
                ? 'bg-neutral-800 text-teal-400 border-teal-500/30'
                : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${showBenchmark ? 'bg-teal-400' : 'bg-neutral-600'}`}></div>
            <span>Nifty 50 Benchmark</span>
          </button>

          {/* LTTB Downsampling Badge / Toggle */}
          <button
            onClick={() => setUseLttb(!useLttb)}
            title="Toggle Largest-Triangle-Three-Buckets time-series downsampling for ultra high performance"
            className={`px-3 py-1.5 rounded-lg font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
              useLttb
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>LTTB 60fps {useLttb ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Period Performance Metrics (CAGR, XIRR & Authentic Benchmark Return) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        {/* Card 1: Portfolio Return (CAGR / XIRR) */}
        <div className="bg-neutral-800/40 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-medium">Portfolio Return ({timeframe})</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/80 text-emerald-400">
              {periodMetrics.portfolioMetricType}
            </span>
          </div>
          <div className={`text-sm sm:text-base font-bold font-mono ${periodMetrics.portfolioReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {periodMetrics.portfolioReturnLabel}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-between">
            <span>Period Gain: <strong className={`font-mono ${periodMetrics.portfolioGain >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{periodMetrics.portfolioGain >= 0 ? '+' : ''}{formatINR(periodMetrics.portfolioGain)}</strong></span>
          </div>
        </div>

        {/* Card 2: Capital Injected */}
        <div className="bg-neutral-800/40 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-medium">Capital Invested</span>
            <span className="text-[10px] text-neutral-500 font-mono">
              {periodMetrics.timeframeDescription}
            </span>
          </div>
          <div className="text-sm sm:text-base font-bold text-neutral-200 font-mono">
            +{formatINR(Math.max(0, periodMetrics.capitalAdded))}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-between">
            <span>End Net Worth: <strong className="font-mono text-neutral-200">{formatINR(periodMetrics.endNetWorth)}</strong></span>
          </div>
        </div>

        {/* Card 3: Nifty 50 Return (Real Index Values) */}
        <div className="bg-neutral-800/40 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-medium">Nifty 50 Return ({timeframe})</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-950/70 border border-teal-800/80 text-teal-300">
              {periodMetrics.niftyMetricType}
            </span>
          </div>
          <div className={`text-sm sm:text-base font-bold font-mono ${periodMetrics.niftyReturnPct >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
            {periodMetrics.niftyReturnLabel}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-between">
            <span>Index: <strong className="font-mono text-neutral-300">{periodMetrics.niftyStartLevel.toLocaleString('en-IN')} → {periodMetrics.niftyEndLevel.toLocaleString('en-IN')}</strong></span>
            <span className={`font-mono text-[10px] ${periodMetrics.niftyPointChange >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
              ({periodMetrics.niftyPointChange >= 0 ? '+' : ''}{periodMetrics.niftyPointChange.toLocaleString('en-IN')} pts)
            </span>
          </div>
        </div>

        {/* Card 4: Alpha vs Index */}
        <div className="bg-neutral-800/40 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-medium">Alpha vs Index ({timeframe})</span>
            <Award className={`w-3.5 h-3.5 ${periodMetrics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div className={`text-sm sm:text-base font-bold font-mono flex items-center gap-1.5 ${periodMetrics.isOutperforming ? 'text-emerald-400' : 'text-amber-400'}`}>
            {periodMetrics.alphaLabel}
          </div>
          <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-between">
            <span className={periodMetrics.isOutperforming ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
              {periodMetrics.isOutperforming ? 'Outperforming Benchmark' : 'Underperforming Benchmark'}
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Area Chart */}
      <div className="h-72 sm:h-80 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />

            <XAxis
              dataKey="date"
              stroke="#737373"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#333' }}
            />

            <YAxis
              stroke="#737373"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => formatINR(val, true)}
              domain={['auto', 'auto']}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const netWorth = (payload.find(p => p.dataKey === 'netWorth')?.value as number) || 0;
                  const invested = (payload.find(p => p.dataKey === 'invested')?.value as number) || 0;
                  const nifty = payload.find(p => p.dataKey === 'nifty50')?.value as number;
                  const pointData = payload[0]?.payload as GrowthDataPoint;
                  const displayDate = pointData?.fullDate || label;
                  const profit = netWorth - invested;
                  const roi = invested > 0 ? (profit / invested) * 100 : 0;
                  const alphaVsNiftyVal = (showBenchmark && nifty && nifty > 0) ? (netWorth - nifty) : null;

                  return (
                    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[220px]">
                      <div className="font-semibold text-neutral-200 border-b border-neutral-800 pb-1 flex items-center justify-between">
                        <span>{displayDate}</span>
                        <span className="text-[10px] text-neutral-400 font-normal">Historical Valuation</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-400">
                        <span>Portfolio Net Worth:</span>
                        <strong className="font-mono">{formatINR(netWorth)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-neutral-400">
                        <span>Capital Invested:</span>
                        <strong className="font-mono">{formatINR(invested)}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-emerald-300 font-medium">
                        <span>Unrealized Gain:</span>
                        <strong className="font-mono">{profit >= 0 ? '+' : ''}{formatINR(profit)} ({roi >= 0 ? '+' : ''}{roi.toFixed(1)}%)</strong>
                      </div>
                      {showBenchmark && nifty !== undefined && nifty > 0 && (
                        <div className="border-t border-neutral-800 pt-1.5 space-y-1 text-teal-400">
                          <div className="flex items-center justify-between gap-4">
                            <span>Nifty 50 Equivalent:</span>
                            <strong className="font-mono">{formatINR(nifty)}</strong>
                          </div>
                          {alphaVsNiftyVal !== null && (
                            <div className="flex items-center justify-between gap-4 text-[11px] text-neutral-300">
                              <span>Outperformance:</span>
                              <strong className={`font-mono ${alphaVsNiftyVal >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {alphaVsNiftyVal >= 0 ? '+' : ''}{formatINR(alphaVsNiftyVal)}
                              </strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              formatter={(value) => {
                if (value === 'netWorth') return <span className="text-xs text-emerald-400 font-medium">Portfolio Net Worth</span>;
                if (value === 'invested') return <span className="text-xs text-neutral-400 font-medium">Capital Invested</span>;
                if (value === 'nifty50') return <span className="text-xs text-teal-400 font-medium">Nifty 50 Benchmark</span>;
                return value;
              }}
            />

            <Area
              type="monotone"
              dataKey="netWorth"
              name="netWorth"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#netWorthGrad)"
              isAnimationActive={false}
              activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2, fill: '#052e16' }}
            />

            <Area
              type="monotone"
              dataKey="invested"
              name="invested"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fillOpacity={1}
              fill="url(#investedGrad)"
              isAnimationActive={false}
            />

            {showBenchmark && (
              <Area
                type="monotone"
                dataKey="nifty50"
                name="nifty50"
                stroke="#2dd4bf"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                fillOpacity={0}
                fill="none"
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
