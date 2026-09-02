import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  Sparkles, 
  Award, 
  Percent, 
  CheckCircle2,
  Wallet,
  ArrowRight,
  Layers,
  Plus,
  Minus,
  RotateCcw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { PortfolioHolding, PortfolioSummary } from '../types';
import { formatINR } from '../utils/financialCalculations';

interface SipSimulatorProps {
  summary?: PortfolioSummary;
  holdings?: PortfolioHolding[];
}

export const SipSimulator: React.FC<SipSimulatorProps> = ({ summary, holdings = [] }) => {
  const currentPortfolioVal = Math.round(summary?.totalCurrentValue || 0);

  // Toggle to include current portfolio as initial corpus
  const [includePortfolio, setIncludePortfolio] = useState<boolean>(currentPortfolioVal > 0);
  const [initialLumpSum, setInitialLumpSum] = useState<number>(currentPortfolioVal > 0 ? currentPortfolioVal : 100000);
  const [monthlySip, setMonthlySip] = useState<number>(25000);
  const [expectedCagr, setExpectedCagr] = useState<number>(14.0);
  const [years, setYears] = useState<number>(15);
  const [stepUpPercent, setStepUpPercent] = useState<number>(10);

  // Effective starting lump sum
  const effectiveStartingCapital = includePortfolio ? initialLumpSum : 0;

  // Future projection calculation
  const { chartData, totalInvested, futureValue, totalWealthGain, sipOnlyInvested } = useMemo(() => {
    const data: { 
      year: number; 
      label: string; 
      invested: number; 
      initialCapitalGrowth: number;
      futureValue: number; 
    }[] = [];
    
    let currentMonthly = monthlySip;
    let accumulatedSipInvested = 0;
    let accumulatedSipValue = 0;
    const monthlyRate = expectedCagr / 100 / 12;

    for (let yr = 1; yr <= years; yr++) {
      for (let m = 1; m <= 12; m++) {
        accumulatedSipInvested += currentMonthly;
        accumulatedSipValue = (accumulatedSipValue + currentMonthly) * (1 + monthlyRate);
      }

      // Initial lump sum growth compounding formula: P * (1 + r)^t
      const lumpSumValue = effectiveStartingCapital * Math.pow(1 + expectedCagr / 100, yr);
      const totalAccumulatedInvested = effectiveStartingCapital + accumulatedSipInvested;
      const totalCombinedValue = lumpSumValue + accumulatedSipValue;

      data.push({
        year: yr,
        label: `Yr ${yr}`,
        invested: Math.round(totalAccumulatedInvested),
        initialCapitalGrowth: Math.round(lumpSumValue),
        futureValue: Math.round(totalCombinedValue)
      });

      // Apply annual step-up
      if (stepUpPercent > 0) {
        currentMonthly = currentMonthly * (1 + stepUpPercent / 100);
      }
    }

    const finalLumpSumValue = effectiveStartingCapital * Math.pow(1 + expectedCagr / 100, years);
    const finalTotalInvested = effectiveStartingCapital + accumulatedSipInvested;
    const finalFutureValue = finalLumpSumValue + accumulatedSipValue;

    return {
      chartData: data,
      totalInvested: finalTotalInvested,
      sipOnlyInvested: accumulatedSipInvested,
      futureValue: finalFutureValue,
      totalWealthGain: finalFutureValue - finalTotalInvested
    };
  }, [effectiveStartingCapital, monthlySip, expectedCagr, years, stepUpPercent]);

  // Dynamic Milestones
  const milestones = useMemo(() => {
    return [
      { target: 2500000, label: '₹25 Lakhs' },
      { target: 5000000, label: '₹50 Lakhs' },
      { target: 10000000, label: '₹1 Crore' },
      { target: 20000000, label: '₹2 Crores' },
      { target: 50000000, label: '₹5 Crores' },
      { target: 100000000, label: '₹10 Crores' }
    ];
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                SIP Wealth Compounding & Milestone Simulator
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Simulate portfolio compounding with live holdings base, recurring monthly SIPs, and annual step-up.
              </p>
            </div>
          </div>

          {currentPortfolioVal > 0 && (
            <button
              onClick={() => {
                setIncludePortfolio(!includePortfolio);
                if (!includePortfolio) {
                  setInitialLumpSum(currentPortfolioVal);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                includePortfolio 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-neutral-800/80 border-neutral-700 text-neutral-400 hover:text-white'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              {includePortfolio ? 'Current Portfolio Linked' : 'Link Current Portfolio'}
            </button>
          )}
        </div>
      </div>

      {/* Simulator Inputs & Result Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Editable Modern Number Inputs, Steppers & Sliders */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-1 border-b border-neutral-800/80">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Investment Parameters
            </h3>
            <span className="text-[10px] text-teal-400 uppercase tracking-wider font-semibold bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
              Interactive
            </span>
          </div>

          {/* Initial Portfolio / Lump Sum Principal */}
          <div className="space-y-2.5 pb-3 border-b border-neutral-800/80">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="initialCapital" className="text-neutral-300 font-medium flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="enableInitialCapital"
                  checked={includePortfolio}
                  onChange={(e) => setIncludePortfolio(e.target.checked)}
                  className="rounded border-neutral-700 text-teal-500 focus:ring-teal-500 h-4 w-4 bg-neutral-800 cursor-pointer"
                />
                <span>Starting Base Corpus</span>
              </label>
              {currentPortfolioVal > 0 && includePortfolio && (
                <button 
                  type="button"
                  onClick={() => setInitialLumpSum(currentPortfolioVal)}
                  className="text-[10px] text-teal-400 hover:text-teal-300 font-semibold bg-teal-950/50 px-2 py-0.5 rounded border border-teal-500/30 transition cursor-pointer"
                >
                  Sync: {formatINR(currentPortfolioVal, true)}
                </button>
              )}
            </div>

            {includePortfolio && (
              <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                {/* Modern Stepper Input Box */}
                <div className="flex items-center bg-neutral-950 border border-neutral-800 focus-within:border-teal-500/80 rounded-xl p-1 shadow-inner transition">
                  <button
                    type="button"
                    onClick={() => setInitialLumpSum(prev => Math.max(0, prev - 50000))}
                    className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                    title="Decrease by ₹50,000"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 flex items-center px-2">
                    <span className="text-xs font-mono text-neutral-500 mr-1 select-none">₹</span>
                    <input
                      id="initialCapital"
                      type="number"
                      min={0}
                      max={100000000}
                      step={10000}
                      value={initialLumpSum === 0 ? '' : initialLumpSum}
                      placeholder="0"
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setInitialLumpSum(Math.max(0, val));
                      }}
                      className="w-full bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setInitialLumpSum(prev => prev + 50000)}
                    className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                    title="Increase by ₹50,000"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick preset chips */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[100000, 500000, 1000000, 2500000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setInitialLumpSum(amt)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition cursor-pointer ${
                        initialLumpSum === amt
                          ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                          : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                      }`}
                    >
                      {formatINR(amt, true)}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.max(5000000, initialLumpSum * 1.3)}
                  step={10000}
                  value={initialLumpSum}
                  onChange={(e) => setInitialLumpSum(Number(e.target.value))}
                  className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>
            )}
          </div>

          {/* Monthly SIP Amount */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="monthlySipInput" className="text-neutral-300 font-medium">Monthly SIP</label>
              <span className="text-[11px] font-mono font-bold text-emerald-400">
                {formatINR(monthlySip)}/mo
              </span>
            </div>

            {/* Modern Stepper Input Box */}
            <div className="flex items-center bg-neutral-950 border border-neutral-800 focus-within:border-emerald-500/80 rounded-xl p-1 shadow-inner transition">
              <button
                type="button"
                onClick={() => setMonthlySip(prev => Math.max(500, prev - 2500))}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Decrease by ₹2,500"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 flex items-center px-2">
                <span className="text-xs font-mono text-neutral-500 mr-1 select-none">₹</span>
                <input
                  id="monthlySipInput"
                  type="number"
                  min={500}
                  max={1000000}
                  step={1000}
                  value={monthlySip === 0 ? '' : monthlySip}
                  placeholder="0"
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                    setMonthlySip(Math.max(0, val));
                  }}
                  className="w-full bg-transparent text-right text-xs font-mono font-bold text-white focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setMonthlySip(prev => prev + 2500)}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Increase by ₹2,500"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {[10000, 25000, 50000, 100000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setMonthlySip(amt)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition cursor-pointer ${
                    monthlySip === amt
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                      : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                  }`}
                >
                  {formatINR(amt, true)}
                </button>
              ))}
            </div>

            <input
              type="range"
              min={1000}
              max={200000}
              step={1000}
              value={Math.min(monthlySip, 200000)}
              onChange={(e) => setMonthlySip(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* Expected CAGR */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="expectedCagrInput" className="text-neutral-300 font-medium">Expected CAGR</label>
              <span className="text-[11px] font-mono font-bold text-teal-400">
                {expectedCagr.toFixed(1)}% p.a.
              </span>
            </div>

            {/* Modern Stepper Input Box */}
            <div className="flex items-center bg-neutral-950 border border-neutral-800 focus-within:border-teal-500/80 rounded-xl p-1 shadow-inner transition">
              <button
                type="button"
                onClick={() => setExpectedCagr(prev => Math.max(1, Number((prev - 0.5).toFixed(1))))}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Decrease by 0.5%"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 flex items-center px-2 justify-end">
                <input
                  id="expectedCagrInput"
                  type="number"
                  min={1}
                  max={40}
                  step={0.1}
                  value={expectedCagr}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setExpectedCagr(Math.max(0.1, Math.min(40, val)));
                  }}
                  className="w-full bg-transparent text-right text-xs font-mono font-bold text-teal-400 focus:outline-none"
                />
                <span className="text-xs font-mono text-neutral-500 ml-1 select-none">%</span>
              </div>
              <button
                type="button"
                onClick={() => setExpectedCagr(prev => Math.min(40, Number((prev + 0.5).toFixed(1))))}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Increase by 0.5%"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {[12, 14, 16, 18].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setExpectedCagr(rate)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition cursor-pointer ${
                    expectedCagr === rate
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                      : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>

            <input
              type="range"
              min={6}
              max={30}
              step={0.5}
              value={expectedCagr}
              onChange={(e) => setExpectedCagr(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
          </div>

          {/* Investment Horizon */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="horizonYearsInput" className="text-neutral-300 font-medium">Investment Horizon</label>
              <span className="text-[11px] font-mono font-bold text-indigo-400">
                {years} {years === 1 ? 'Year' : 'Years'}
              </span>
            </div>

            {/* Modern Stepper Input Box */}
            <div className="flex items-center bg-neutral-950 border border-neutral-800 focus-within:border-indigo-500/80 rounded-xl p-1 shadow-inner transition">
              <button
                type="button"
                onClick={() => setYears(prev => Math.max(1, prev - 1))}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Decrease by 1 Year"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 flex items-center px-2 justify-end">
                <input
                  id="horizonYearsInput"
                  type="number"
                  min={1}
                  max={40}
                  step={1}
                  value={years}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 1;
                    setYears(Math.max(1, Math.min(40, val)));
                  }}
                  className="w-full bg-transparent text-right text-xs font-mono font-bold text-indigo-400 focus:outline-none"
                />
                <span className="text-xs font-mono text-neutral-500 ml-1 select-none">Yrs</span>
              </div>
              <button
                type="button"
                onClick={() => setYears(prev => Math.min(40, prev + 1))}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Increase by 1 Year"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {[5, 10, 15, 20, 25].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setYears(yr)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition cursor-pointer ${
                    years === yr
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                      : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                  }`}
                >
                  {yr}Y
                </button>
              ))}
            </div>

            <input
              type="range"
              min={1}
              max={35}
              step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Annual Step-up Percentage */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="stepUpInput" className="text-neutral-300 font-medium">Annual Step-Up</label>
              <span className="text-[11px] font-mono font-bold text-amber-400">
                +{stepUpPercent}% yearly
              </span>
            </div>

            {/* Modern Stepper Input Box */}
            <div className="flex items-center bg-neutral-950 border border-neutral-800 focus-within:border-amber-500/80 rounded-xl p-1 shadow-inner transition">
              <button
                type="button"
                onClick={() => setStepUpPercent(prev => Math.max(0, prev - 1))}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Decrease by 1%"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <div className="flex-1 flex items-center px-2 justify-end">
                <input
                  id="stepUpInput"
                  type="number"
                  min={0}
                  max={50}
                  step={1}
                  value={stepUpPercent}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setStepUpPercent(Math.max(0, Math.min(50, val)));
                  }}
                  className="w-full bg-transparent text-right text-xs font-mono font-bold text-amber-400 focus:outline-none"
                />
                <span className="text-xs font-mono text-neutral-500 ml-1 select-none">%</span>
              </div>
              <button
                type="button"
                onClick={() => setStepUpPercent(prev => Math.min(50, prev + 1))}
                className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Increase by 1%"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 pt-0.5">
              {[0, 5, 10, 15].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setStepUpPercent(pct)}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-mono transition cursor-pointer ${
                    stepUpPercent === pct
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                      : 'bg-neutral-800/60 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                  }`}
                >
                  {pct === 0 ? 'None (0%)' : `${pct}%`}
                </button>
              ))}
            </div>

            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={stepUpPercent}
              onChange={(e) => setStepUpPercent(Number(e.target.value))}
              className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>

        {/* Right 2 Cols: Future Corpus & Dynamic Area Chart */}
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          {/* Summary Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-neutral-800/50 border border-neutral-700/60 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-neutral-400 block">Total Principal Invested</span>
              <span className="text-lg font-bold text-white font-mono mt-1 block">
                {formatINR(totalInvested)}
              </span>
              {effectiveStartingCapital > 0 && (
                <span className="text-[10px] text-neutral-400 block mt-0.5">
                  Base: {formatINR(effectiveStartingCapital, true)} + SIPs: {formatINR(sipOnlyInvested, true)}
                </span>
              )}
            </div>

            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Wealth Gain (Compounded)</span>
              <span className="text-lg font-bold text-emerald-400 font-mono mt-1 block">
                +{formatINR(totalWealthGain)}
              </span>
              <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                {totalInvested > 0 ? `${((totalWealthGain / totalInvested) * 100).toFixed(0)}% absolute profit` : '0%'}
              </span>
            </div>

            <div className="bg-teal-950/30 border border-teal-500/30 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-teal-400 block">Projected Maturity Corpus</span>
              <span className="text-xl font-extrabold text-teal-300 font-mono mt-1 block">
                {formatINR(futureValue)}
              </span>
              <span className="text-[10px] text-teal-400/80 block mt-0.5">
                In {years} Years @ {expectedCagr}% CAGR
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
                          <div className="text-teal-400">Total Projected Corpus: <strong>{formatINR(fVal)}</strong></div>
                          <div className="text-neutral-400">Cumulative Invested: <strong>{formatINR(inv)}</strong></div>
                          <div className="text-emerald-400">Compounded Growth: <strong>+{formatINR(fVal - inv)}</strong></div>
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            Milestone Wealth Targets & Timeline
          </h3>
          <span className="text-xs text-neutral-400">
            Based on {formatINR(monthlySip)}/mo SIP {effectiveStartingCapital > 0 ? `+ ${formatINR(effectiveStartingCapital, true)} base` : ''} @ {expectedCagr}%
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
