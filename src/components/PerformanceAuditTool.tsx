import React, { useState, useMemo } from 'react';
import { 
  Cpu, 
  Database, 
  TrendingUp, 
  Zap, 
  CheckCircle2, 
  Sliders, 
  HardDrive, 
  BarChart, 
  Layers, 
  ShieldCheck,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export function PerformanceAuditTool() {
  // Input parameters
  const [trackedSchemes, setTrackedSchemes] = useState<number>(3500);
  const [historyYears, setHistoryYears] = useState<number>(10);
  const [activeUsers, setActiveUsers] = useState<number>(50000);
  const [dailySips, setDailySips] = useState<number>(25000);

  // Derived calculations
  const metrics = useMemo(() => {
    const marketDaysPerYear = 250;
    const totalNavRows = trackedSchemes * historyYears * marketDaysPerYear;
    const unindexedAvgMs = 850;
    const indexedAvgMs = 1.2;
    const latencySavedPct = (((unindexedAvgMs - indexedAvgMs) / unindexedAvgMs) * 100).toFixed(1);
    
    // Disk I/O calculations
    const queriesPerDay = activeUsers * 4; // average 4 portfolio/chart views per user
    const unindexedDiskGbPerMonth = (queriesPerDay * 30 * 0.38).toFixed(0); // ~380KB read per unindexed query
    const indexedDiskGbPerMonth = (queriesPerDay * 30 * 0.00015).toFixed(1); // 0.15KB index block read

    // Bandwidth with LTTB
    const rawChartPayloadKb = 180; // 3650 points JSON
    const lttbChartPayloadKb = 8.5; // 160 points JSON
    const bandwidthSavedMonthlyGb = ((queriesPerDay * 30 * (rawChartPayloadKb - lttbChartPayloadKb)) / (1024 * 1024)).toFixed(1);

    // Client DOM Memory
    const naiveDomNodes = 3650 * 5; // 18,250 DOM nodes
    const virtualDomNodes = 18;

    return {
      totalNavRows,
      unindexedAvgMs,
      indexedAvgMs,
      latencySavedPct,
      queriesPerDay,
      unindexedDiskGbPerMonth,
      indexedDiskGbPerMonth,
      bandwidthSavedMonthlyGb,
      naiveDomNodes,
      virtualDomNodes
    };
  }, [trackedSchemes, historyYears, activeUsers, dailySips]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-neutral-900 rounded-2xl p-6 text-white shadow-sm border border-amber-900">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30 mb-2">
            <Cpu className="w-3.5 h-3.5 text-amber-300" />
            Capacity & Performance ROI Calculator
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            MFTracker Performance Sizing & Impact Model
          </h2>
          <p className="text-sm text-amber-100/90 mt-1 leading-relaxed">
            Estimate latency reductions, server memory conservation, and database disk I/O savings under real-world Mutual Fund production workloads.
          </p>
        </div>
      </div>

      {/* Interactive Workload Sliders */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-600" />
          Mutual Fund Workload Configuration
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Schemes Count */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-neutral-600">Tracked AMFI Schemes</span>
              <span className="font-bold text-blue-600">{trackedSchemes.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={500}
              max={8000}
              step={100}
              value={trackedSchemes}
              onChange={(e) => setTrackedSchemes(Number(e.target.value))}
              className="w-full accent-blue-600 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-neutral-400 font-mono mt-1 flex justify-between">
              <span>500</span>
              <span>8,000</span>
            </div>
          </div>

          {/* History Years */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-neutral-600">NAV History Length</span>
              <span className="font-bold text-emerald-600">{historyYears} Years</span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={historyYears}
              onChange={(e) => setHistoryYears(Number(e.target.value))}
              className="w-full accent-emerald-600 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-neutral-400 font-mono mt-1 flex justify-between">
              <span>1 yr</span>
              <span>20 yrs</span>
            </div>
          </div>

          {/* Active Users */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-neutral-600">Active Portfolio Users</span>
              <span className="font-bold text-indigo-600">{activeUsers.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={5000}
              max={200000}
              step={5000}
              value={activeUsers}
              onChange={(e) => setActiveUsers(Number(e.target.value))}
              className="w-full accent-indigo-600 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-neutral-400 font-mono mt-1 flex justify-between">
              <span>5k</span>
              <span>200k</span>
            </div>
          </div>

          {/* Daily SIPs */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-neutral-600">Daily SIP Mandates</span>
              <span className="font-bold text-amber-600">{dailySips.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={1000}
              max={100000}
              step={1000}
              value={dailySips}
              onChange={(e) => setDailySips(Number(e.target.value))}
              className="w-full accent-amber-600 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
            />
            <div className="text-[10px] text-neutral-400 font-mono mt-1 flex justify-between">
              <span>1k</span>
              <span>100k</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calculated Impact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
          <div className="text-xs text-neutral-500 font-medium mb-1 flex items-center justify-between">
            <span>Total NAV Table Rows</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 font-mono">
            {(metrics.totalNavRows / 1000000).toFixed(2)}M
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5">
            {metrics.totalNavRows.toLocaleString()} total historical daily records
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
          <div className="text-xs text-neutral-500 font-medium mb-1 flex items-center justify-between">
            <span>Query Latency Drop</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">
            {metrics.latencySavedPct}%
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5">
            {metrics.unindexedAvgMs}ms → {metrics.indexedAvgMs}ms per query
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
          <div className="text-xs text-neutral-500 font-medium mb-1 flex items-center justify-between">
            <span>Monthly Disk Read I/O</span>
            <HardDrive className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 font-mono">
            -{metrics.unindexedDiskGbPerMonth} GB
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5">
            Saved from shared buffer misses & disk scans
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-xs">
          <div className="text-xs text-neutral-500 font-medium mb-1 flex items-center justify-between">
            <span>Chart Bandwidth Saved</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 font-mono">
            {metrics.bandwidthSavedMonthlyGb} GB/mo
          </div>
          <p className="text-[11px] text-neutral-500 mt-1.5">
            Via LTTB downsampling (180KB → 8.5KB per payload)
          </p>
        </div>
      </div>

      {/* Prioritized Architecture Action Matrix */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Prioritized Implementation Matrix for MFTracker
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Phase 1: Quick Wins */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white">
                Phase 1: Quick Wins
              </span>
              <span className="text-xs font-semibold text-emerald-800">1-2 Days Effort</span>
            </div>
            <h4 className="text-xs font-bold text-emerald-950">Covering B-Tree Indexes</h4>
            <ul className="text-xs text-emerald-900 space-y-1.5">
              <li className="flex items-start">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5 shrink-0 mt-0.5" />
                <span>Add <code className="bg-white px-1 py-0.5 rounded text-[11px] font-mono">idx_nav_covering (scheme_code, nav_date DESC) INCLUDE (nav)</code></span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5 shrink-0 mt-0.5" />
                <span>Add Partial index on <code className="bg-white px-1 py-0.5 rounded text-[11px] font-mono">sip_mandates (frequency_day) WHERE status = 'ACTIVE'</code></span>
              </li>
            </ul>
          </div>

          {/* Phase 2: Frontend & API Virtualization */}
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white">
                Phase 2: Frontend & API
              </span>
              <span className="text-xs font-semibold text-blue-800">3-4 Days Effort</span>
            </div>
            <h4 className="text-xs font-bold text-blue-950">Virtualization & Cursor Keyset</h4>
            <ul className="text-xs text-blue-900 space-y-1.5">
              <li className="flex items-start">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-1.5 shrink-0 mt-0.5" />
                <span>Implement windowed virtualization for scheme search and transaction ledgers</span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-1.5 shrink-0 mt-0.5" />
                <span>Replace offset pagination with keyset cursor queries <code className="bg-white px-1 py-0.5 rounded text-[11px] font-mono">WHERE (nav_date, id) &lt; cursor</code></span>
              </li>
            </ul>
          </div>

          {/* Phase 3: Architectural Upgrades */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-600 text-white">
                Phase 3: Scale Architecture
              </span>
              <span className="text-xs font-semibold text-indigo-800">1 Week Effort</span>
            </div>
            <h4 className="text-xs font-bold text-indigo-950">Partitioning & Materialized Views</h4>
            <ul className="text-xs text-indigo-900 space-y-1.5">
              <li className="flex items-start">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 mr-1.5 shrink-0 mt-0.5" />
                <span>Add Materialized Views for User Portfolio Holdings with <code className="bg-white px-1 py-0.5 rounded text-[11px] font-mono">CONCURRENT REFRESH</code></span>
              </li>
              <li className="flex items-start">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 mr-1.5 shrink-0 mt-0.5" />
                <span>Partition <code className="bg-white px-1 py-0.5 rounded text-[11px] font-mono">nav_history</code> by year and apply lightweight BRIN indexes</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
