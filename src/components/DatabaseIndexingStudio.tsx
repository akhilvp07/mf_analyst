import React, { useState, useMemo } from 'react';
import { QUERY_SCENARIOS } from '../data/mockData';
import { QueryScenario } from '../types';
import { 
  Database, 
  Zap, 
  AlertOctagon, 
  CheckCircle2, 
  ArrowRight, 
  Terminal, 
  Copy, 
  Check, 
  Layers, 
  Clock, 
  HardDrive, 
  Server,
  Sparkles,
  Search,
  Filter,
  BarChart3
} from 'lucide-react';

export function DatabaseIndexingStudio() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(QUERY_SCENARIOS[0].id);
  const [copiedIndex, setCopiedIndex] = useState<boolean>(false);
  const [customIndexType, setCustomIndexType] = useState<'none' | 'single' | 'composite' | 'covering' | 'brin' | 'partial'>('covering');

  const scenario = useMemo(() => {
    return QUERY_SCENARIOS.find(s => s.id === selectedScenarioId) || QUERY_SCENARIOS[0];
  }, [selectedScenarioId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(true);
    setTimeout(() => setCopiedIndex(false), 2000);
  };

  // Dynamic calculation for custom index sandbox
  const sandboxStats = useMemo(() => {
    switch (customIndexType) {
      case 'none':
        return {
          scanType: 'Sequential Scan (Seq Scan)',
          latencyMs: scenario.unindexed.executionTimeMs,
          costScore: scenario.unindexed.plan.totalCost,
          bufferHits: scenario.unindexed.sharedHitBuffers,
          bufferReads: scenario.unindexed.sharedReadBuffers,
          heapFetches: scenario.unindexed.heapFetches,
          indexSizeMb: 0,
          writePenalty: '0% (Fastest Writes)',
          description: 'Reads every table block from disk. 100% CPU bottleneck on large tables.'
        };
      case 'single':
        return {
          scanType: 'Bitmap Index Scan + Heap Filter',
          latencyMs: Number((scenario.unindexed.executionTimeMs * 0.18).toFixed(2)),
          costScore: 2450.0,
          bufferHits: 1200,
          bufferReads: 450,
          heapFetches: 14000,
          indexSizeMb: 45,
          writePenalty: '3-5% write overhead',
          description: 'Filters on scheme_code but still performs extensive Heap Page reads and in-memory sorting.'
        };
      case 'composite':
        return {
          scanType: 'Index Scan (Pre-sorted B-Tree)',
          latencyMs: Number((scenario.indexed.executionTimeMs * 3.2).toFixed(2)),
          costScore: 48.5,
          bufferHits: 320,
          bufferReads: 12,
          heapFetches: 240,
          indexSizeMb: 78,
          writePenalty: '6-8% write overhead',
          description: 'Leverages composite (scheme_code, nav_date DESC) to satisfy both WHERE and ORDER BY.'
        };
      case 'covering':
        return {
          scanType: 'Index-Only Scan (Covering with INCLUDE)',
          latencyMs: scenario.indexed.executionTimeMs,
          costScore: scenario.indexed.plan.totalCost,
          bufferHits: scenario.indexed.sharedHitBuffers,
          bufferReads: scenario.indexed.sharedReadBuffers,
          heapFetches: 0,
          indexSizeMb: 94,
          writePenalty: '8-10% write overhead',
          description: 'Zero Heap Fetches! All requested columns (nav, repurchase_price) are stored in index leaf blocks.'
        };
      case 'brin':
        return {
          scanType: 'BRIN Range Scan (Block Range)',
          latencyMs: Number((scenario.indexed.executionTimeMs * 4.5).toFixed(2)),
          costScore: 180.0,
          bufferHits: 210,
          bufferReads: 85,
          heapFetches: 1800,
          indexSizeMb: 2.1,
          writePenalty: '0.2% write overhead (Ultra Lightweight)',
          description: 'Takes 95% less RAM & disk than B-Tree; ideal for append-only sequential date partitions.'
        };
      case 'partial':
        return {
          scanType: 'Filtered Partial Index Scan',
          latencyMs: 1.45,
          costScore: 22.4,
          bufferHits: 42,
          bufferReads: 0,
          heapFetches: 4120,
          indexSizeMb: 2.8,
          writePenalty: '1% write overhead',
          description: 'Indexes only rows matching WHERE status = "ACTIVE", keeping index tree ultra compact.'
        };
    }
  }, [customIndexType, scenario]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-sm border border-emerald-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mb-2">
              <Database className="w-3.5 h-3.5 text-emerald-300" />
              SQL Optimization & Query Plan Studio
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              PostgreSQL / Relational Indexing Strategies for MFTracker
            </h2>
            <p className="text-sm text-emerald-100/90 mt-1 leading-relaxed">
              Without proper index coverage, NAV lookups, historical range queries, and user portfolio calculations trigger full table sequential scans (O(N)), exhausting shared buffers and spiking CPU.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
            <div>
              <div className="text-xs text-emerald-200 uppercase font-medium tracking-wider">Average Speedup</div>
              <div className="text-2xl font-bold text-emerald-300">
                {scenario.indexed.speedupFactor.toFixed(0)}x <span className="text-xs font-normal text-emerald-100">Faster</span>
              </div>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div>
              <div className="text-xs text-emerald-200 uppercase font-medium tracking-wider">Disk I/O Reads</div>
              <div className="text-2xl font-bold text-white">
                0 KB <span className="text-xs font-normal text-emerald-200">100% Cache</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Selector Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {QUERY_SCENARIOS.map((sc, index) => (
          <button
            key={sc.id}
            id={`scenario-btn-${sc.id}`}
            onClick={() => setSelectedScenarioId(sc.id)}
            className={`text-left p-3 rounded-xl border transition-all ${
              selectedScenarioId === sc.id
                ? 'bg-emerald-50/80 border-emerald-500 shadow-xs ring-1 ring-emerald-500'
                : 'bg-white border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                selectedScenarioId === sc.id ? 'bg-emerald-600 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}>
                Scenario #{index + 1}
              </span>
              <span className="text-xs font-semibold text-emerald-700">
                {sc.indexed.speedupFactor.toFixed(0)}x speedup
              </span>
            </div>
            <h4 className="text-xs font-bold text-neutral-900 line-clamp-2">
              {sc.title.replace(/^\d+\.\s*/, '')}
            </h4>
            <p className="text-[11px] text-neutral-500 line-clamp-1 mt-1">
              {sc.businessCase}
            </p>
          </button>
        ))}
      </div>

      {/* Scenario Details & SQL Query Box */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base font-bold text-neutral-900">
              {scenario.title}
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              {scenario.description} • <span className="font-mono text-neutral-500">{scenario.datasetSize}</span>
            </p>
          </div>
          <button
            onClick={() => handleCopy(scenario.querySql)}
            className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 self-start md:self-auto"
          >
            {copiedIndex ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            Copy SQL Query
          </button>
        </div>

        {/* Query SQL */}
        <div className="bg-neutral-950 rounded-lg p-3.5 font-mono text-xs text-emerald-400 overflow-x-auto border border-neutral-800">
          <pre>{scenario.querySql}</pre>
        </div>
      </div>

      {/* Side-by-Side Comparison: Unindexed vs Indexed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Unindexed Sequential Scan */}
        <div className="bg-white border-2 border-rose-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-rose-100">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                <AlertOctagon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900">Unindexed Execution Plan</h4>
                <p className="text-xs text-rose-600 font-medium">Full Table Sequential Scan (Seq Scan)</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-500 font-mono">LATENCY</div>
              <div className="text-xl font-bold text-rose-600 font-mono">
                {scenario.unindexed.executionTimeMs} ms
              </div>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200">
              <div className="text-[10px] text-neutral-500 uppercase font-mono">Cost Score</div>
              <div className="text-sm font-bold text-neutral-800 font-mono">
                {scenario.unindexed.plan.totalCost.toLocaleString()}
              </div>
            </div>
            <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200">
              <div className="text-[10px] text-neutral-500 uppercase font-mono">Shared Reads</div>
              <div className="text-sm font-bold text-rose-600 font-mono">
                {scenario.unindexed.sharedReadBuffers.toLocaleString()} blocks
              </div>
            </div>
            <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200">
              <div className="text-[10px] text-neutral-500 uppercase font-mono">Disk I/O Spill</div>
              <div className="text-sm font-bold text-rose-600 font-mono">
                {(scenario.unindexed.diskIoKb / 1024).toFixed(1)} MB
              </div>
            </div>
          </div>

          {/* Plan Breakdown */}
          <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 text-xs font-mono space-y-1 text-neutral-700">
            <div className="text-neutral-500 font-bold">{'->'} {scenario.unindexed.plan.nodeType}</div>
            <div className="text-neutral-600 pl-3">Total Cost: {scenario.unindexed.plan.totalCost}</div>
            <div className="text-neutral-600 pl-3">Rows Evaluated: {scenario.unindexed.heapFetches.toLocaleString()}</div>
            {scenario.unindexed.plan.filter && (
              <div className="text-rose-600 pl-3">Filter: {scenario.unindexed.plan.filter}</div>
            )}
          </div>

          {/* Identified Bottlenecks */}
          <div className="space-y-1.5">
            <h5 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Critical Bottlenecks:</h5>
            <ul className="text-xs text-neutral-600 space-y-1">
              {scenario.unindexed.bottlenecks.map((bn, i) => (
                <li key={i} className="flex items-start text-rose-700">
                  <span className="mr-1.5">•</span>
                  <span>{bn}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: Optimized Covering / Composite Index */}
        <div className="bg-white border-2 border-emerald-300 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900">Optimized Execution Plan</h4>
                <p className="text-xs text-emerald-700 font-medium">{scenario.indexed.indexType}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-500 font-mono">LATENCY</div>
              <div className="text-xl font-bold text-emerald-600 font-mono flex items-center justify-end gap-1">
                {scenario.indexed.executionTimeMs} ms
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {scenario.indexed.speedupFactor.toFixed(0)}x
                </span>
              </div>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200">
              <div className="text-[10px] text-neutral-500 uppercase font-mono">Cost Score</div>
              <div className="text-sm font-bold text-emerald-700 font-mono">
                {scenario.indexed.plan.totalCost.toFixed(2)}
              </div>
            </div>
            <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200">
              <div className="text-[10px] text-neutral-500 uppercase font-mono">Shared Reads</div>
              <div className="text-sm font-bold text-emerald-700 font-mono">
                0 blocks (100% Cache)
              </div>
            </div>
            <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200">
              <div className="text-[10px] text-neutral-500 uppercase font-mono">Heap Fetches</div>
              <div className="text-sm font-bold text-emerald-700 font-mono">
                {scenario.indexed.heapFetches} (Index Only)
              </div>
            </div>
          </div>

          {/* Index DDL */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-700 mb-1">
              <span>RECOMMENDED INDEX DDL</span>
              <button
                onClick={() => handleCopy(scenario.indexed.indexDdl)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                Copy DDL
              </button>
            </div>
            <div className="bg-neutral-950 rounded-lg p-3 font-mono text-xs text-emerald-400 overflow-x-auto border border-neutral-800">
              <pre>{scenario.indexed.indexDdl}</pre>
            </div>
          </div>

          {/* Optimizations Achieved */}
          <div className="space-y-1.5">
            <h5 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Optimizations Achieved:</h5>
            <ul className="text-xs text-neutral-700 space-y-1">
              {scenario.indexed.optimizationsUsed.map((opt, i) => (
                <li key={i} className="flex items-start text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mr-1.5 shrink-0 mt-0.5" />
                  <span>{opt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Interactive Index Sandbox & Strategy Lab */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Interactive Indexing Strategy Simulator
            </h3>
            <p className="text-xs text-neutral-500">
              Test how different database index structures impact query execution plans, storage overhead, and write write penalties.
            </p>
          </div>
        </div>

        {/* Index Strategy Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { type: 'none', label: '1. No Index (Seq Scan)' },
            { type: 'single', label: '2. Single B-Tree' },
            { type: 'composite', label: '3. Composite B-Tree' },
            { type: 'covering', label: '4. Covering (INCLUDE)' },
            { type: 'brin', label: '5. BRIN (Time-Series)' },
            { type: 'partial', label: '6. Partial Index' },
          ].map((item) => (
            <button
              key={item.type}
              id={`index-type-${item.type}`}
              onClick={() => setCustomIndexType(item.type as any)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold text-center border transition-all ${
                customIndexType === item.type
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Dynamic Sandbox Output Card */}
        <div className="bg-neutral-900 text-white rounded-xl p-4 border border-neutral-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-neutral-800">
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase">Simulated Latency</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {sandboxStats.latencyMs} ms
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase">Scan Engine</div>
              <div className="text-xs font-bold text-neutral-200 font-mono truncate">
                {sandboxStats.scanType}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase">Index Storage</div>
              <div className="text-xl font-bold font-mono text-neutral-200">
                {sandboxStats.indexSizeMb} MB
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase">Write Overhead</div>
              <div className="text-xs font-bold text-amber-400 font-mono">
                {sandboxStats.writePenalty}
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-300 mt-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{sandboxStats.description}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
