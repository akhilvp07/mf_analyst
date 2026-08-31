import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Sparkles, 
  Award, 
  Clock, 
  DollarSign, 
  Percent, 
  ArrowUpRight 
} from 'lucide-react';
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
import { formatINR } from '../utils/financialCalculations';

export const SipSimulator: React.FC = () => {
  const [monthlySip, setMonthlySip] = useState<number>(25000);
  const [expectedCagr, setExpectedCagr] = useState<number>(14.0);
  const [years, setYears] = useState<number>(15);
  const [stepUpPercent, setStepUpPercent] = useState<number>(10);

  // Future projection calculation
  const { chartData, totalInvested, futureValue, totalWealthGain } = useMemo(() => {
    const data: { year: number; label: string; invested: number; futureValue: number }[] = [];
    
    let currentMonthly = monthlySip;
    let accumulatedInvested = 0;
    let accumulatedValue = 0;
    const monthlyRate = expectedCagr / 100 / 12;

    for (let yr = 1; yr <= years; yr++) {
      for (let m = 1; m <= 12; m++) {
        accumulatedInvested += currentMonthly;
        accumulatedValue = (accumulatedValue + currentMonthly) * (1 + monthlyRate);
      }

      data.push({
        year: yr,
        label: `Yr ${yr}`,
        invested: Math.round(accumulatedInvested),
        futureValue: Math.round(accumulatedValue)
      });

      // Apply annual step-up
      if (stepUpPercent > 0) {
        currentMonthly = currentMonthly * (1 + stepUpPercent / 100);
      }
    }

    return {
      chartData: data,
      totalInvested: accumulatedInvested,
      futureValue: accumulatedValue,
      totalWealthGain: accumulatedValue - accumulatedInvested
    };
  }, [monthlySip, expectedCagr, years, stepUpPercent]);

  // Milestone timeline calculation
  const milestones = [
    { target: 2500000, label: '₹25 Lakhs' },
    { target: 5000000, label: '₹50 Lakhs' },
    { target: 10000000, label: '₹1 Crore' },
    { target: 20000000, label: '₹2 Crores' },
    { target: 50000000, label: '₹5 Crores' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              SIP Wealth Compounding & Milestone Simulator
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Simulate the exponential power of compounding with regular SIPs and annual step-up investments.
            </p>
          </div>
        </div>
      </div>

      {/* Simulator Inputs & Result Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Sliders and Inputs */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-neutral-300">
            Investment Parameters
          </h3>

          {/* Monthly SIP Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Monthly SIP Amount</span>
              <span className="font-bold text-white font-mono">{formatINR(monthlySip)}</span>
            </div>
            <input
              type="range"
              min={1000}
              max={200000}
              step={1000}
              value={monthlySip}
              onChange={(e) => setMonthlySip(Number(e.target.value))}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Expected CAGR */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Expected Annual CAGR</span>
              <span className="font-bold text-teal-400 font-mono">{expectedCagr.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min={8}
              max={25}
              step={0.5}
              value={expectedCagr}
              onChange={(e) => setExpectedCagr(Number(e.target.value))}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
          </div>

          {/* Investment Horizon */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Investment Horizon</span>
              <span className="font-bold text-indigo-400 font-mono">{years} Years</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Step-up SIP Percentage */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Annual Step-up SIP</span>
              <span className="font-bold text-emerald-400 font-mono">+{stepUpPercent}% / yr</span>
            </div>
            <input
              type="range"
              min={0}
              max={25}
              step={1}
              value={stepUpPercent}
              onChange={(e) => setStepUpPercent(Number(e.target.value))}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>

        {/* Right 2 Cols: Future Corpus & Chart */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          {/* Summary Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-neutral-800/50 border border-neutral-700/60 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Total Capital Invested</span>
              <span className="text-lg font-bold text-white font-mono mt-1 block">
                {formatINR(totalInvested)}
              </span>
            </div>

            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Wealth Gain (Interest)</span>
              <span className="text-lg font-bold text-emerald-400 font-mono mt-1 block">
                +{formatINR(totalWealthGain)}
              </span>
            </div>

            <div className="bg-teal-950/30 border border-teal-500/30 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-teal-400 block">Maturity Corpus (Net Worth)</span>
              <span className="text-xl font-extrabold text-teal-300 font-mono mt-1 block">
                {formatINR(futureValue)}
              </span>
            </div>
          </div>

          {/* Area Chart */}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="futureGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="label" stroke="#737373" fontSize={11} tickLine={false} />
                <YAxis stroke="#737373" fontSize={11} tickLine={false} tickFormatter={(v) => formatINR(v, true)} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const fVal = payload.find(p => p.dataKey === 'futureValue')?.value as number || 0;
                      const inv = payload.find(p => p.dataKey === 'invested')?.value as number || 0;
                      return (
                        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 shadow-xl text-xs space-y-1">
                          <div className="font-bold text-white">{label}</div>
                          <div className="text-teal-400">Total Corpus: <strong>{formatINR(fVal)}</strong></div>
                          <div className="text-neutral-400">Total Invested: <strong>{formatINR(inv)}</strong></div>
                          <div className="text-emerald-400">Profit: <strong>+{formatINR(fVal - inv)}</strong></div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="futureValue" name="Corpus" stroke="#14b8a6" strokeWidth={2.5} fill="url(#futureGrad)" />
                <Area type="monotone" dataKey="invested" name="Invested" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Milestone Trackers */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-amber-400" />
          Milestone Wealth Targets
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {milestones.map((m) => {
            const hitYear = chartData.find(d => d.futureValue >= m.target)?.year;
            return (
              <div 
                key={m.label} 
                className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between ${
                  hitYear 
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-neutral-200' 
                    : 'bg-neutral-800/30 border-neutral-800 text-neutral-500'
                }`}
              >
                <div>
                  <span className="font-bold text-sm text-white block">{m.label}</span>
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    {hitYear ? `Achieved in Year ${hitYear}` : `> ${years} Years`}
                  </span>
                </div>
                {hitYear && (
                  <div className="mt-2 text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Target Reached
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
