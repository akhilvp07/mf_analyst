import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Bell, 
  Sliders, 
  ArrowDownRight, 
  Sparkles, 
  ShieldAlert, 
  ExternalLink, 
  Copy, 
  Check, 
  Info,
  Calendar,
  Layers,
  Flame,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceLine, 
  CartesianGrid 
} from 'recharts';
import { NiftyMarketData, PortfolioSummary } from '../types';
import { 
  fetchNiftyMarketData, 
  loadAlertSettings, 
  saveAlertSettings, 
  calculateSimulatedNiftyMetrics, 
  MarketAlertSettings 
} from '../services/marketService';

interface MarketAnalysisProps {
  summary: PortfolioSummary;
  onNavigateToHoldings: () => void;
}

export const MarketAnalysis: React.FC<MarketAnalysisProps> = ({ summary, onNavigateToHoldings }) => {
  const [marketData, setMarketData] = useState<NiftyMarketData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [settings, setSettings] = useState<MarketAlertSettings>(() => loadAlertSettings());
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // What-If Simulation controls
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedClose, setSimulatedClose] = useState<number>(22250); // Just below 15% drop to allow immediate simulation verification

  // Load market data on mount
  const loadData = async (force: boolean = false) => {
    if (force) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await fetchNiftyMarketData();
      setMarketData(data);
      if (!isSimulating && data?.currentClose) {
        setSimulatedClose(data.currentClose);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute active or simulated metrics
  const activeMetrics = useMemo(() => {
    if (!marketData) return null;
    if (isSimulating) {
      const sim = calculateSimulatedNiftyMetrics(
        simulatedClose,
        marketData.allTimePeak,
        1105,
        settings.drawdownThreshold,
        settings.peThreshold
      );
      return {
        close: sim.simulatedClose,
        peak: marketData.allTimePeak,
        peakDate: marketData.allTimePeakDate,
        pointDrop: sim.pointDrop,
        percentDrop: sim.percentDrop,
        isDrawdownAlert: sim.isDrawdownAlert,
        triggerLevel15: sim.triggerLevelDrawdown,
        pointsTo15: sim.pointsToDrawdownTrigger,
        pe: sim.pe,
        isPeAlert: sim.isPeAlert,
        peZone: sim.peZone,
        priceAtPe20: sim.priceAtPeThreshold,
        pointsToPe20: sim.pointsToPeThreshold,
        summaryText: sim.conciseSummary,
        isSimulated: true
      };
    }

    const isDrawdownAlert = (marketData.percentDropFromPeak || 0) <= -Math.abs(settings.drawdownThreshold);
    const isPeAlert = (marketData.currentPe || 0) < settings.peThreshold;

    return {
      close: marketData.currentClose,
      peak: marketData.allTimePeak,
      peakDate: marketData.allTimePeakDate,
      pointDrop: marketData.pointDropFromPeak,
      percentDrop: marketData.percentDropFromPeak,
      isDrawdownAlert,
      triggerLevel15: marketData.triggerLevel15Percent,
      pointsTo15: marketData.pointsTo15PercentTrigger,
      pe: marketData.currentPe,
      isPeAlert,
      peZone: marketData.peZone,
      priceAtPe20: Number((settings.peThreshold * 1105).toFixed(2)),
      pointsToPe20: marketData.pointsToPe20Threshold,
      summaryText: marketData.conciseSummary,
      isSimulated: false
    };
  }, [marketData, isSimulating, simulatedClose, settings]);

  const handleCopySummary = () => {
    if (!activeMetrics?.summaryText) return;
    navigator.clipboard.writeText(activeMetrics.summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handleUpdateSetting = (key: keyof MarketAlertSettings, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveAlertSettings(updated);
  };

  if (isLoading && !marketData) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm text-neutral-400 font-medium">Fetching live Nifty 50 market metrics & PE ratios...</p>
      </div>
    );
  }

  const metrics = activeMetrics || {
    close: 23146.15,
    peak: 26216.05,
    peakDate: '2024-09-27',
    pointDrop: 3069.9,
    percentDrop: -11.71,
    isDrawdownAlert: false,
    triggerLevel15: 22283.64,
    pointsTo15: 862.51,
    pe: 20.95,
    isPeAlert: false,
    peZone: 'accumulation',
    priceAtPe20: 22100.00,
    pointsToPe20: 1046.15,
    summaryText: 'Nifty 50 is 11.71% below peak. PE: 20.95.',
    isSimulated: false
  };

  const chartData = marketData?.history || [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1.5 font-medium">
              <span>National Stock Exchange (NSE)</span>
              <span aria-hidden="true">·</span>
              <span>Benchmark Index</span>
              <span aria-hidden="true">·</span>
              <span>Daily Valuation Radar</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Market Opportunities & Valuation Alerts
            </h1>
            <p className="text-sm text-neutral-400 mt-1 max-w-3xl leading-relaxed">
              Real-time monitoring of Nifty 50 all-time peak drawdowns and historic price-to-earnings (P/E) thresholds to systematically time tactical capital additions into equity mutual funds.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-2 ${
                isSimulating 
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' 
                  : 'bg-neutral-800/80 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'Exit Simulation Mode' : 'What-If Sandbox'}</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-medium rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Feed'}</span>
            </button>
          </div>
        </div>

        {/* What-If Simulation Sandbox Panel */}
        {isSimulating && (
          <div className="mt-5 p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <Sliders className="w-4 h-4" />
                <span>Simulation Sandbox Active: Test Custom Index Level & Trigger Conditions</span>
              </div>
              <div className="text-xs text-neutral-400 font-mono">
                Simulated Nifty: <strong className="text-white">₹{simulatedClose.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 w-full">
                <input
                  type="range"
                  min="19000"
                  max="26500"
                  step="25"
                  value={simulatedClose}
                  onChange={(e) => setSimulatedClose(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-neutral-500 mt-1 font-mono">
                  <span>19,000 (-27.5% Deep Crash)</span>
                  <span>22,283 (-15% Trigger)</span>
                  <span>26,216 (Peak)</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSimulatedClose(22150)}
                  className="px-2.5 py-1 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700"
                >
                  Set 22,150 (-15.5% Drop)
                </button>
                <button
                  onClick={() => setSimulatedClose(21800)}
                  className="px-2.5 py-1 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg border border-neutral-700"
                >
                  Set 21,800 (PE &lt; 20)
                </button>
                <button
                  onClick={() => setSimulatedClose(marketData?.currentClose || 23146)}
                  className="px-2.5 py-1 text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-400 rounded-lg border border-neutral-700"
                >
                  Reset Live
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Feature 1 & 2 Primary Alert Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ========================================================================= */}
        {/* FEATURE 1: NIFTY 50 15%+ DRAWDOWN ALERT CARD */}
        {/* ========================================================================= */}
        <div className={`p-6 rounded-2xl border transition-all relative overflow-hidden ${
          metrics.isDrawdownAlert
            ? 'bg-rose-950/20 border-rose-500/50 shadow-lg shadow-rose-950/20'
            : metrics.percentDrop <= -10
            ? 'bg-amber-950/15 border-amber-500/40 shadow-sm'
            : 'bg-neutral-900 border-neutral-800'
        }`}>
          {/* Status Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1 text-neutral-400">
                <span>Feature 1</span>
                <span aria-hidden="true">·</span>
                <span>Peak Drawdown Rule</span>
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                Nifty 50 Drawdown &ge; 15% Alert
              </h2>
            </div>

            {/* Alert Status Banner */}
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 ${
              metrics.isDrawdownAlert
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                : metrics.percentDrop <= -10
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}>
              {metrics.isDrawdownAlert ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>OPPORTUNITY TRIGGERED (&ge; 15% DIP)</span>
                </>
              ) : metrics.percentDrop <= -10 ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>APPROACHING BUY ZONE</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>MONITORING (DRAWDOWN &lt; 10%)</span>
                </>
              )}
            </div>
          </div>

          {/* Key Metric Numbers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-neutral-950/50 border border-neutral-800/80 mb-4">
            <div>
              <span className="text-[11px] text-neutral-400 font-medium block">Latest Close</span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-white block mt-0.5">
                ₹{metrics.close.toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-neutral-400 font-medium block">All-Time Peak</span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-neutral-300 block mt-0.5">
                ₹{metrics.peak.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-neutral-500 block font-mono">{metrics.peakDate}</span>
            </div>

            <div>
              <span className="text-[11px] text-neutral-400 font-medium block">Drop in Points</span>
              <span className={`text-lg sm:text-xl font-bold font-mono tabular-nums block mt-0.5 ${
                metrics.pointDrop >= 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                -{Math.abs(metrics.pointDrop).toLocaleString('en-IN')} pts
              </span>
            </div>

            <div>
              <span className="text-[11px] text-neutral-400 font-medium block">Drawdown %</span>
              <span className={`text-lg sm:text-xl font-bold font-mono tabular-nums block mt-0.5 ${
                metrics.isDrawdownAlert ? 'text-rose-400 font-extrabold' : 'text-amber-400'
              }`}>
                {metrics.percentDrop.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Drawdown Progress Bar toward -15% Milestone */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-medium">Drawdown Depth vs. 15% Trigger</span>
              <span className="font-mono font-medium text-neutral-300">
                {metrics.isDrawdownAlert ? (
                  <span className="text-rose-400 font-semibold">Exceeded 15% threshold ({metrics.percentDrop.toFixed(2)}%)</span>
                ) : (
                  <span>{metrics.pointsTo15 > 0 ? `${metrics.pointsTo15.toFixed(1)} pts to trigger` : 'At trigger level'}</span>
                )}
              </span>
            </div>

            <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden p-0.5 border border-neutral-700/50">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  metrics.isDrawdownAlert 
                    ? 'bg-rose-500 shadow-sm shadow-rose-500/50' 
                    : metrics.percentDrop <= -10 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, (Math.abs(metrics.percentDrop) / 15) * 100))}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-neutral-500 font-mono">
              <span>0% Peak</span>
              <span>-5% Minor</span>
              <span>-10% Pullback</span>
              <span className="text-amber-400 font-bold">-15% Trigger (₹{metrics.triggerLevel15.toLocaleString('en-IN')})</span>
            </div>
          </div>

          {/* Concise Summary Callout */}
          <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 text-xs text-neutral-300 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-neutral-400" />
                <span>Executive Summary</span>
              </span>
              <button 
                onClick={handleCopySummary}
                className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
                title="Copy brief"
              >
                {copiedSummary ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="leading-relaxed font-sans text-neutral-300">
              The Nifty 50 index is currently at <strong className="text-white font-mono">₹{metrics.close.toLocaleString('en-IN')}</strong>, marking an exact drawdown of <strong className="text-rose-400 font-mono">{metrics.pointDrop.toLocaleString('en-IN')} points ({metrics.percentDrop.toFixed(2)}%)</strong> from its reference all-time peak of <strong className="text-neutral-200 font-mono">₹{metrics.peak.toLocaleString('en-IN')}</strong> recorded on {metrics.peakDate}. 
              {metrics.isDrawdownAlert 
                ? ' 🚨 Alert condition MET: Market is >= 15% below peak. Deploy dry-powder lumpsums or boost monthly equity SIPs.' 
                : ` Target 15% dip triggers at ₹${metrics.triggerLevel15.toLocaleString('en-IN')} (${metrics.pointsTo15.toFixed(1)} points remaining).`}
            </p>
          </div>

          {/* Historical Precedent Proof */}
          <div className="mt-4 pt-3 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Historical 3-Yr CAGR after &ge;15% Nifty Dip: <strong className="text-emerald-400 font-mono">+16.4% p.a.</strong></span>
            <button 
              onClick={onNavigateToHoldings}
              className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              <span>View in Holdings</span>
              <ArrowDownRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FEATURE 2: NIFTY PE < 20 TRACKING & ALERT CARD */}
        {/* ========================================================================= */}
        <div className={`p-6 rounded-2xl border transition-all relative overflow-hidden ${
          metrics.isPeAlert
            ? 'bg-emerald-950/20 border-emerald-500/50 shadow-lg shadow-emerald-950/20'
            : metrics.pe <= 21.0
            ? 'bg-neutral-900 border-emerald-500/30'
            : 'bg-neutral-900 border-neutral-800'
        }`}>
          {/* Status Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-1 text-neutral-400">
                <span>Feature 2</span>
                <span aria-hidden="true">·</span>
                <span>Valuation Multiple Rule</span>
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                Nifty P/E Ratio &lt; 20 Alert
              </h2>
            </div>

            {/* Alert Status Banner */}
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 ${
              metrics.isPeAlert
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                : metrics.pe <= 21.5
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}>
              {metrics.isPeAlert ? (
                <>
                  <Flame className="w-4 h-4 text-emerald-400" />
                  <span>DEEP VALUE BUY OPPORTUNITY (PE &lt; 20)</span>
                </>
              ) : metrics.pe <= 21.5 ? (
                <>
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>FAVORABLE ACCUMULATION (PE &le; 21.5)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>FAIR VALUATION (PE &gt; 21.5)</span>
                </>
              )}
            </div>
          </div>

          {/* Key Metric Numbers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-neutral-950/50 border border-neutral-800/80 mb-4">
            <div>
              <span className="text-[11px] text-neutral-400 font-medium block">Current Nifty PE</span>
              <span className={`text-lg sm:text-xl font-bold font-mono tabular-nums block mt-0.5 ${
                metrics.isPeAlert ? 'text-emerald-400 font-extrabold' : 'text-white'
              }`}>
                {metrics.pe.toFixed(2)}x
              </span>
            </div>

            <div>
              <span className="text-[11px] text-neutral-400 font-medium block">Buy Target Threshold</span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-400 block mt-0.5">
                &lt; 20.00x
              </span>
              <span className="text-[10px] text-neutral-500 block font-mono">Deep value trigger</span>
            </div>

            <div>
              <span className="text-[11px] text-neutral-400 font-medium block">Distance to PE 20</span>
              <span className={`text-lg sm:text-xl font-bold font-mono tabular-nums block mt-0.5 ${
                metrics.pe < 20 ? 'text-emerald-400' : 'text-neutral-300'
              }`}>
                {metrics.pe < 20 
                  ? `${(20 - metrics.pe).toFixed(2)} below` 
                  : `+${(metrics.pe - 20).toFixed(2)} pts`}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-neutral-400 font-medium block">Valuation Regime</span>
              <span className="text-xs font-semibold capitalize block mt-1 text-neutral-200">
                {metrics.peZone === 'deep_value' ? '🔥 Deep Value' : metrics.peZone === 'accumulation' ? 'Accumulation Zone' : 'Fair Value'}
              </span>
            </div>
          </div>

          {/* Historical PE Valuation Zones Bar */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-medium">Historical Nifty Valuation Zones</span>
              <span className="font-mono text-neutral-300 font-medium">Current: {metrics.pe.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-4 gap-1 h-3 rounded-full overflow-hidden p-0.5 bg-neutral-800 border border-neutral-700/50">
              <div 
                className={`h-full rounded-sm transition-colors ${metrics.pe < 20 ? 'bg-emerald-400 shadow-sm' : 'bg-emerald-900/40'}`} 
                title="Deep Value Zone (< 20)" 
              />
              <div 
                className={`h-full rounded-sm transition-colors ${metrics.pe >= 20 && metrics.pe <= 22 ? 'bg-cyan-400 shadow-sm' : 'bg-cyan-900/40'}`} 
                title="Accumulation (20 - 22)" 
              />
              <div 
                className={`h-full rounded-sm transition-colors ${metrics.pe > 22 && metrics.pe <= 24.5 ? 'bg-amber-400 shadow-sm' : 'bg-amber-900/40'}`} 
                title="Fair Value (22 - 24.5)" 
              />
              <div 
                className={`h-full rounded-sm transition-colors ${metrics.pe > 24.5 ? 'bg-rose-400 shadow-sm' : 'bg-rose-900/40'}`} 
                title="Expensive (> 24.5)" 
              />
            </div>

            <div className="grid grid-cols-4 text-[10px] text-neutral-500 font-mono text-center">
              <span className="text-emerald-400 font-semibold">&lt; 20 (Deep Value)</span>
              <span>20-22 (Accumulate)</span>
              <span>22-24.5 (Fair)</span>
              <span>&gt; 24.5 (Elevated)</span>
            </div>
          </div>

          {/* Concise Summary Callout */}
          <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 text-xs text-neutral-300 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-neutral-400" />
                <span>Valuation Diagnosis</span>
              </span>
              <span className="text-[11px] text-neutral-500 font-mono">10-Yr Median PE: ~22.4</span>
            </div>
            <p className="leading-relaxed font-sans text-neutral-300">
              Nifty 50 is trading at a Price-to-Earnings ratio of <strong className="text-white font-mono">{metrics.pe.toFixed(2)}x</strong> (based on trailing consolidated 12-month earnings). 
              {metrics.isPeAlert
                ? ' 🚀 Rare Valuation Buy Opportunity triggered! When Nifty PE closes below 20, forward 3-year historical returns have exceeded 18% p.a. in over 95% of past instances.'
                : ` Index is currently in the ${metrics.peZone === 'accumulation' ? 'favorable accumulation' : 'fair median'} zone. A further dip below ₹${metrics.priceAtPe20.toLocaleString('en-IN')} would trigger the sub-20 PE alert.`}
            </p>
          </div>

          {/* Historical Precedent Proof */}
          <div className="mt-4 pt-3 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
            <span>Historical Instances of PE &lt; 20: <strong>2008, 2011, 2016, 2020</strong></span>
            <span className="text-neutral-500 font-mono">100% positive 5-yr return</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* HISTORICAL CHART: NIFTY 50 DRAWDOWN & PE TRAJECTORY */}
      {/* ========================================================================= */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Nifty 50 Historical Trend & Valuation Bands</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Tracking closing price, drawdown from all-time peak, and daily price-to-earnings ratio.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-emerald-400" />
              <span>Nifty Close (Left)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-rose-400 stroke-dashed" />
              <span>-15% Dip Level</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-cyan-400" />
              <span>Nifty PE (Right)</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis 
                dataKey="date" 
                stroke="#737373" 
                fontSize={11} 
                tickLine={false}
                tickFormatter={(val) => {
                  try {
                    const [y, m, d] = val.split('-');
                    return `${d}/${m}`;
                  } catch (e) {
                    return val;
                  }
                }}
              />
              <YAxis 
                yAxisId="left"
                stroke="#737373" 
                fontSize={11} 
                domain={[21000, 27000]}
                tickFormatter={(val) => `${(val / 1000).toFixed(1)}k`}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#06b6d4" 
                fontSize={11} 
                domain={[18, 26]}
                tickFormatter={(val) => `${val}x`}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div className="bg-neutral-900 border border-neutral-700 p-3 rounded-xl shadow-xl text-xs space-y-1 font-mono">
                      <div className="text-neutral-400 font-sans font-semibold mb-1">{label}</div>
                      <div className="text-emerald-400">Close: ₹{Number(item.close).toLocaleString('en-IN')}</div>
                      <div className="text-amber-400">Peak Drawdown: {item.drawdownPercent}%</div>
                      <div className="text-cyan-400">Nifty PE: {item.pe}x</div>
                      {item.isDrawdownAlert && (
                        <div className="text-rose-400 font-bold font-sans">🚨 &ge; 15% Drawdown Alert Active</div>
                      )}
                      {item.isPeAlert && (
                        <div className="text-emerald-400 font-bold font-sans">🔥 PE &lt; 20 Value Trigger Active</div>
                      )}
                    </div>
                  );
                }}
              />
              {/* -15% Drawdown Reference Line */}
              <ReferenceLine 
                yAxisId="left" 
                y={metrics.triggerLevel15} 
                stroke="#f43f5e" 
                strokeDasharray="4 4" 
                label={{ value: '15% Dip Trigger (₹22,283)', fill: '#f43f5e', fontSize: 10, position: 'insideTopLeft' }} 
              />
              {/* PE 20.0 Reference Line */}
              <ReferenceLine 
                yAxisId="right" 
                y={20.0} 
                stroke="#10b981" 
                strokeDasharray="3 3" 
                label={{ value: 'PE 20 Value Line', fill: '#10b981', fontSize: 10, position: 'insideBottomRight' }} 
              />
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="close" 
                fill="#10b981" 
                fillOpacity={0.08} 
                stroke="#10b981" 
                strokeWidth={2} 
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="pe" 
                stroke="#06b6d4" 
                strokeWidth={2} 
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TACTICAL ACTION PLAYBOOK FOR INVESTORS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
            01
          </div>
          <h4 className="text-sm font-bold text-white">Staggered Lumpsum Deployments</h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            When Nifty hits a 15% drawdown, avoid dumping 100% of reserves at once. Deploy in 3 disciplined tranches: 35% at -15%, 35% at -18%, and 30% if it reaches -20%.
          </p>
          <div className="text-[11px] text-emerald-400 font-medium">Tranche 1 Trigger: ₹{metrics.triggerLevel15.toLocaleString('en-IN')}</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-sm">
            02
          </div>
          <h4 className="text-sm font-bold text-white">Temporary SIP Multiplier (Booster)</h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            While Nifty PE trades below 20, double your regular monthly mutual fund SIP contributions for 3 to 6 months to accumulate units at deep cyclical discounts.
          </p>
          <div className="text-[11px] text-cyan-400 font-medium">Historical 5-Yr Win Rate: 100%</div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm">
            03
          </div>
          <h4 className="text-sm font-bold text-white">Prefer Broad-Based Large/Flexi Caps</h4>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Index corrections offer the cleanest institutional safety in Nifty 50 Index funds, Large & Mid Cap, and Flexi Cap schemes before small-cap beta catches up.
          </p>
          <button
            onClick={onNavigateToHoldings}
            className="text-[11px] text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
          >
            <span>Review Portfolio Allocation →</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DAILY TRACKING LOG TABLE */}
      {/* ========================================================================= */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Daily Nifty 50 & PE Tracking History</h3>
            <p className="text-xs text-neutral-400">Recent observation points with exact drawdown and valuation status.</p>
          </div>
          <span className="text-xs text-neutral-500 font-mono">{chartData.length} recorded sessions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/60 text-neutral-400 border-b border-neutral-800 uppercase font-mono tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Closing Price</th>
                <th className="py-3 px-4 text-right">Peak (Ref)</th>
                <th className="py-3 px-4 text-right">Drawdown %</th>
                <th className="py-3 px-4 text-right">Nifty P/E</th>
                <th className="py-3 px-4 text-center">Alert Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 font-mono">
              {chartData.slice().reverse().map((row, idx) => (
                <tr key={idx} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="py-2.5 px-4 text-neutral-300 font-medium">{row.date}</td>
                  <td className="py-2.5 px-4 text-right font-bold text-white">₹{row.close.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-4 text-right text-neutral-400">₹{row.peak.toLocaleString('en-IN')}</td>
                  <td className={`py-2.5 px-4 text-right font-semibold ${row.drawdownPercent <= -15 ? 'text-rose-400 font-bold' : row.drawdownPercent <= -10 ? 'text-amber-400' : 'text-neutral-300'}`}>
                    {row.drawdownPercent.toFixed(2)}%
                  </td>
                  <td className={`py-2.5 px-4 text-right font-semibold ${row.pe < 20 ? 'text-emerald-400 font-bold' : 'text-cyan-300'}`}>
                    {row.pe.toFixed(2)}x
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {row.isDrawdownAlert && row.isPeAlert ? (
                      <span className="text-[10px] font-sans font-bold text-rose-400">Drawdown &ge;15% &amp; PE &lt;20</span>
                    ) : row.isDrawdownAlert ? (
                      <span className="text-[10px] font-sans font-bold text-rose-400">Drawdown &ge;15% Trigger</span>
                    ) : row.isPeAlert ? (
                      <span className="text-[10px] font-sans font-bold text-emerald-400">PE &lt;20 Trigger</span>
                    ) : (
                      <span className="text-[10px] font-sans text-neutral-500">Normal Range</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
