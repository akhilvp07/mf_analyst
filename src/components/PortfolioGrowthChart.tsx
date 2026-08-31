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
import { PortfolioHolding, PortfolioSummary } from '../types';
import { formatINR, lttbDownsample } from '../utils/financialCalculations';
import { Activity, Zap, Check } from 'lucide-react';

interface PortfolioGrowthChartProps {
  holdings: PortfolioHolding[];
  summary: PortfolioSummary;
}

type Timeframe = '1M' | '6M' | '1Y' | '3Y' | 'ALL';

export const PortfolioGrowthChart: React.FC<PortfolioGrowthChartProps> = ({ holdings, summary }) => {
  const [timeframe, setTimeframe] = useState<Timeframe>('3Y');
  const [showBenchmark, setShowBenchmark] = useState<boolean>(true);
  const [useLttb, setUseLttb] = useState<boolean>(true);

  // Generate historical daily portfolio growth simulation series
  const rawChartData = useMemo(() => {
    const pointsCount = timeframe === '1M' ? 30 : timeframe === '6M' ? 180 : timeframe === '1Y' ? 365 : timeframe === '3Y' ? 1095 : 1825;
    const data: { x: number; date: string; netWorth: number; invested: number; nifty50: number }[] = [];
    
    const today = new Date();
    const finalValue = summary.totalCurrentValue || 1200000;
    const finalInvested = summary.totalInvestedAmount || 850000;

    const startInvestedRatio = timeframe === '1M' ? 0.95 : timeframe === '6M' ? 0.75 : timeframe === '1Y' ? 0.60 : 0.25;
    const startValueRatio = timeframe === '1M' ? 0.94 : timeframe === '6M' ? 0.68 : timeframe === '1Y' ? 0.50 : 0.20;

    let currentInvested = finalInvested * startInvestedRatio;
    let currentValue = finalValue * startValueRatio;
    let currentNifty = currentValue * 0.92;

    const investedIncrement = (finalInvested - currentInvested) / pointsCount;
    const valueGrowthFactor = Math.pow(finalValue / currentValue, 1 / pointsCount);
    const niftyGrowthFactor = Math.pow((finalValue * 0.88) / currentNifty, 1 / pointsCount);

    for (let i = 0; i <= pointsCount; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - (pointsCount - i));

      // Realistic market wobble
      const noise = (Math.sin(i * 0.15) * 0.008) + ((i % 7 === 0 ? 0.005 : -0.002));
      currentValue = (i === pointsCount) ? finalValue : currentValue * (valueGrowthFactor + noise);
      currentNifty = (i === pointsCount) ? finalValue * 0.88 : currentNifty * (niftyGrowthFactor + noise * 0.8);
      currentInvested += investedIncrement;

      data.push({
        x: i,
        date: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: timeframe === 'ALL' || timeframe === '3Y' ? '2-digit' : undefined }),
        netWorth: Math.round(currentValue),
        invested: Math.round(Math.min(finalInvested, currentInvested)),
        nifty50: Math.round(currentNifty)
      });
    }

    return data;
  }, [timeframe, summary.totalCurrentValue, summary.totalInvestedAmount]);

  // Apply LTTB downsampling for high-speed rendering
  const chartData = useMemo(() => {
    if (!useLttb || rawChartData.length < 80) return rawChartData;
    const targetPoints = 75; // Optimal for 60fps DOM animation
    
    // Downsample Net Worth series
    const netWorthPoints = rawChartData.map(d => ({ x: d.x, y: d.netWorth }));
    const sampled = lttbDownsample(netWorthPoints, targetPoints);
    const sampledXSet = new Set(sampled.map(s => s.x));

    return rawChartData.filter(d => sampledXSet.has(d.x));
  }, [rawChartData, useLttb]);

  return (
    <div className="space-y-4">
      {/* Controls & Timeframe Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Timeframe Pills */}
        <div className="flex items-center gap-1 bg-neutral-800/80 p-1 rounded-xl border border-neutral-700/60">
          {(['1M', '6M', '1Y', '3Y', 'ALL'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg font-medium border transition flex items-center gap-1.5 cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-lg font-medium border transition flex items-center gap-1.5 cursor-pointer ${
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
                  const netWorth = payload.find(p => p.dataKey === 'netWorth')?.value as number || 0;
                  const invested = payload.find(p => p.dataKey === 'invested')?.value as number || 0;
                  const nifty = payload.find(p => p.dataKey === 'nifty50')?.value as number;
                  const profit = netWorth - invested;
                  const roi = invested > 0 ? (profit / invested) * 100 : 0;

                  return (
                    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 shadow-xl text-xs space-y-1.5">
                      <div className="font-semibold text-neutral-300 border-b border-neutral-800 pb-1">{label}</div>
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
                        <strong className="font-mono">+{formatINR(profit)} (+{roi.toFixed(1)}%)</strong>
                      </div>
                      {showBenchmark && nifty && (
                        <div className="flex items-center justify-between gap-4 text-teal-400 border-t border-neutral-800 pt-1">
                          <span>Nifty 50 Equivalent:</span>
                          <strong className="font-mono">{formatINR(nifty)}</strong>
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
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
