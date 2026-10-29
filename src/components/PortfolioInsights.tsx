import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  PieChart as PieIcon, 
  Layers, 
  Scale, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  RefreshCw, 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  Info,
  BarChart3,
  Zap,
  RotateCcw,
  Check,
  Target,
  Wallet,
  Copy,
  Clock,
  Calendar
} from 'lucide-react';
import Markdown from 'react-markdown';
import { 
  PortfolioHolding, 
  PortfolioSummary, 
  TransactionRecord, 
  AllocationStrategy, 
  RebalanceReport,
  FundMarketCapSplit
} from '../types';
import { 
  computeAssetAllocation, 
  computeMarketCapAllocation, 
  computeRebalanceReport, 
  computeTaxLiability,
  DEFAULT_ALLOCATION_STRATEGIES, 
  formatINR,
  isEquityOrientedScheme,
  getDefaultFundMarketCapSplit,
  getFundMarketCapSplitSource,
  isDefaultActiveSipFund
} from '../utils/financialCalculations';
import {
  loadFundMarketCapSplits,
  saveFundMarketCapSplits
} from '../services/portfolioStorage';

interface PortfolioInsightsProps {
  holdings: PortfolioHolding[];
  summary?: PortfolioSummary;
  transactions?: TransactionRecord[];
}

const STORAGE_KEY_STRATEGY = 'mftracker_allocation_strategy_v1';
const STORAGE_KEY_SELECTED_STRATEGY = 'mftracker_selected_strategy_id_v1';
const STORAGE_KEY_MONTHLY_INFLOW = 'mftracker_monthly_inflow_v1';
const STORAGE_KEY_HORIZON_MONTHS = 'mftracker_rebalance_horizon_v1';
const STORAGE_KEY_ACTIVE_SIP_FUNDS = 'mftracker_active_sip_funds_v1';
const STORAGE_KEY_DIAGNOSTIC_CACHE = 'mftracker_math_diagnostic_cache_v1';

export const PortfolioInsights: React.FC<PortfolioInsightsProps> = ({ 
  holdings, 
  summary, 
  transactions = [] 
}) => {
  // Strategy state with local persistence
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SELECTED_STRATEGY);
      if (saved) return saved;
    } catch {}
    return 'strategic_core_70_20_10';
  });
  const [customStrategy, setCustomStrategy] = useState<AllocationStrategy>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STRATEGY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      id: 'custom',
      name: 'Custom Strategy',
      description: 'Custom tailored asset allocation and market cap targets.',
      equity: 70,
      debt: 20,
      gold: 10,
      cash: 0,
      largeCap: 50,
      midCap: 25,
      smallCap: 25
    };
  });

  // Strategy selection handler
  const handleSelectStrategy = (stratId: string) => {
    setSelectedStrategyId(stratId);
    try {
      localStorage.setItem(STORAGE_KEY_SELECTED_STRATEGY, stratId);
    } catch {}
  };

  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);
  const [rebalanceMode, setRebalanceMode] = useState<'SIP_INFLOW' | 'DIRECT_REALIGNMENT'>('SIP_INFLOW');
  const [monthlyInflow, setMonthlyInflow] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MONTHLY_INFLOW);
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    return 45000;
  });

  const [horizonMonths, setHorizonMonths] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HORIZON_MONTHS);
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    } catch {}
    return 12;
  });

  const handleMonthlyInflowChange = (val: number) => {
    const safeVal = Math.max(1000, val);
    setMonthlyInflow(safeVal);
    try {
      localStorage.setItem(STORAGE_KEY_MONTHLY_INFLOW, String(safeVal));
    } catch {}
  };

  const handleHorizonMonthsChange = (months: number) => {
    const safeVal = Math.max(1, months);
    setHorizonMonths(safeVal);
    try {
      localStorage.setItem(STORAGE_KEY_HORIZON_MONTHS, String(safeVal));
    } catch {}
  };

  const [copiedSipPlan, setCopiedSipPlan] = useState<boolean>(false);

  // User-defined fund market cap splits (persisted to localStorage)
  const [fundMarketCapSplits, setFundMarketCapSplits] = useState<Record<string, FundMarketCapSplit>>(() => {
    const loaded = loadFundMarketCapSplits();
    let updated = false;
    for (const key of Object.keys(loaded)) {
      const lower = key.toLowerCase();
      if (lower.includes('sbi') && (lower.includes('small cap') || lower.includes('smallcap'))) {
        if (loaded[key].smallCap === 93.3 || (loaded[key].midCap === 7.7 && loaded[key].smallCap !== 92.3)) {
          loaded[key] = { ...loaded[key], midCap: 7.7, smallCap: 92.3, largeCap: 0 };
          updated = true;
        }
      }
    }
    if (updated) {
      saveFundMarketCapSplits(loaded);
    }
    return loaded;
  });

  // Active SIP schemes to consider for monthly SIP recommendations (persisted to localStorage)
  const [activeSipFundKeys, setActiveSipFundKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_SIP_FUNDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const handleToggleActiveSipFund = (key: string) => {
    setActiveSipFundKeys(prev => {
      // If prev is empty, initialize with all equity holdings or the 3 active ones
      const currentList = prev.length > 0 ? prev : equityHoldingsBreakdown.filter(h => isDefaultActiveSipFund(h.schemeName)).map(h => h.key);
      const isAlreadyIn = currentList.includes(key);
      const next = isAlreadyIn ? currentList.filter(k => k !== key) : [...currentList, key];
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_SIP_FUNDS, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Client-Side Deterministic Mathematical Diagnostic State
  const [diagnosticReport, setDiagnosticReport] = useState<{ score: number; grade: string; markdown: string; timestamp: string } | null>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_DIAGNOSTIC_CACHE);
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  // Active strategy object
  const activeStrategy: AllocationStrategy = useMemo(() => {
    if (selectedStrategyId === 'custom') {
      return customStrategy;
    }
    const found = DEFAULT_ALLOCATION_STRATEGIES.find(s => s.id === selectedStrategyId);
    return found || DEFAULT_ALLOCATION_STRATEGIES[0];
  }, [selectedStrategyId, customStrategy]);

  // Compute live asset allocation and market cap breakdowns using user-defined splitsMap
  const assetAlloc = useMemo(() => computeAssetAllocation(holdings), [holdings]);
  const marketCapAlloc = useMemo(() => computeMarketCapAllocation(holdings, fundMarketCapSplits), [holdings, fundMarketCapSplits]);
  const taxSummary = useMemo(() => computeTaxLiability(transactions, holdings), [transactions, holdings]);

  // Equity Scheme Market Cap Decomposition (Filtered strictly for equity-oriented funds)
  const equityHoldingsBreakdown = useMemo(() => {
    return holdings
      .filter(h => isEquityOrientedScheme(h.schemeName, h.category))
      .map(h => {
        const isHybrid = (h.category || '').toLowerCase().includes('hybrid') || 
                         (h.category || '').toLowerCase().includes('balanced') || 
                         (h.category || '').toLowerCase().includes('multi asset');
        const equityMultiplier = isHybrid ? 0.65 : 1.0;
        const effectiveVal = h.currentValue * equityMultiplier;

        const key = h.schemeCode || h.schemeName;
        const customSplit = fundMarketCapSplits[key] || fundMarketCapSplits[h.schemeCode] || fundMarketCapSplits[h.schemeName];
        const defaultSplit = getDefaultFundMarketCapSplit(h.schemeName, h.category, h.schemeCode, h.isin);
        const sourceMeta = getFundMarketCapSplitSource(h.schemeName, h.category);
        const activeSplit = customSplit || defaultSplit;
        const isCustomized = Boolean(customSplit);

        const largePct = activeSplit.largeCap;
        const midPct = activeSplit.midCap;
        const smallPct = activeSplit.smallCap;
        const sumPct = Number((largePct + midPct + smallPct).toFixed(2));

        const largeCapVal = effectiveVal * (largePct / 100);
        const midCapVal = effectiveVal * (midPct / 100);
        const smallCapVal = effectiveVal * (smallPct / 100);

        return {
          schemeCode: h.schemeCode,
          schemeName: h.schemeName,
          category: h.category,
          currentValue: h.currentValue,
          effectiveEquityValue: effectiveVal,
          isHybrid,
          key,
          defaultSplit,
          activeSplit,
          isCustomized,
          isFactsheetDefault: sourceMeta.isFactsheet,
          sourceName: sourceMeta.sourceName,
          sumPct,
          largeCapVal,
          midCapVal,
          smallCapVal,
          largeCapPct: largePct,
          midCapPct: midPct,
          smallCapPct: smallPct,
          weightInEquity: marketCapAlloc.totalEquityValue > 0 ? (effectiveVal / marketCapAlloc.totalEquityValue) * 100 : 0
        };
      })
      .sort((a, b) => b.effectiveEquityValue - a.effectiveEquityValue);
  }, [holdings, marketCapAlloc.totalEquityValue, fundMarketCapSplits]);

  // Fund split update handlers
  const handleUpdateFundSplit = (key: string, updates: Partial<FundMarketCapSplit>, defaultSplit: FundMarketCapSplit) => {
    setFundMarketCapSplits(prev => {
      const existing = prev[key] || { ...defaultSplit };
      const merged: FundMarketCapSplit = {
        largeCap: updates.largeCap !== undefined ? Math.max(0, Math.min(100, updates.largeCap)) : existing.largeCap,
        midCap: updates.midCap !== undefined ? Math.max(0, Math.min(100, updates.midCap)) : existing.midCap,
        smallCap: updates.smallCap !== undefined ? Math.max(0, Math.min(100, updates.smallCap)) : existing.smallCap,
      };
      const nextMap = { ...prev, [key]: merged };
      saveFundMarketCapSplits(nextMap);
      return nextMap;
    });
  };

  const handleResetFundSplit = (key: string) => {
    setFundMarketCapSplits(prev => {
      const nextMap = { ...prev };
      delete nextMap[key];
      saveFundMarketCapSplits(nextMap);
      return nextMap;
    });
  };

  const handleResetAllFundSplits = () => {
    setFundMarketCapSplits({});
    saveFundMarketCapSplits({});
  };

  const handleNormalizeFundSplit = (key: string, defaultSplit: FundMarketCapSplit) => {
    setFundMarketCapSplits(prev => {
      const existing = prev[key] || { ...defaultSplit };
      const sum = (existing.largeCap || 0) + (existing.midCap || 0) + (existing.smallCap || 0);
      if (sum <= 0) {
        const nextMap = { ...prev, [key]: { largeCap: 100, midCap: 0, smallCap: 0 } };
        saveFundMarketCapSplits(nextMap);
        return nextMap;
      }
      const factor = 100 / sum;
      const l = Math.round(existing.largeCap * factor);
      const m = Math.round(existing.midCap * factor);
      const s = 100 - l - m;
      const nextMap = {
        ...prev,
        [key]: {
          largeCap: Math.max(0, l),
          midCap: Math.max(0, m),
          smallCap: Math.max(0, s),
        }
      };
      saveFundMarketCapSplits(nextMap);
      return nextMap;
    });
  };

  // Style tilt determination
  const styleTilt = useMemo(() => {
    if (marketCapAlloc.totalEquityValue <= 0) return { title: 'No Equity Holdings', desc: 'No active equity funds found in portfolio.' };
    if (marketCapAlloc.smallCap >= 35) {
      return {
        title: 'High Alpha / Small-Cap Heavy',
        desc: 'Elevated cyclical exposure. High potential CAGR with significant correction drawdowns.'
      };
    }
    if (marketCapAlloc.midCap >= 35) {
      return {
        title: 'Growth / Mid-Cap Tilted',
        desc: 'Targeting aggressive wealth expansion through emerging market leaders.'
      };
    }
    if (marketCapAlloc.largeCap >= 65) {
      return {
        title: 'Bluechip / Large-Cap Anchor',
        desc: 'High stability and downside protection via India’s top 100 market leaders.'
      };
    }
    return {
      title: 'Balanced Multi-Cap Blend',
      desc: 'Healthy proportional participation across Large, Mid, and Small Cap segments.'
    };
  }, [marketCapAlloc]);

  const totalPortfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.currentValue, 0);
  }, [holdings]);

  // Compute rebalancing suggestions
  const rebalanceReport: RebalanceReport = useMemo(() => {
    return computeRebalanceReport(
      holdings, 
      activeStrategy, 
      monthlyInflow, 
      rebalanceMode, 
      fundMarketCapSplits, 
      horizonMonths, 
      activeSipFundKeys.length > 0 ? activeSipFundKeys : null
    );
  }, [holdings, activeStrategy, monthlyInflow, rebalanceMode, fundMarketCapSplits, horizonMonths, activeSipFundKeys]);

  // Save custom strategy
  const handleSaveCustomStrategy = (newStrat: AllocationStrategy) => {
    setCustomStrategy(newStrat);
    setSelectedStrategyId('custom');
    try {
      localStorage.setItem(STORAGE_KEY_STRATEGY, JSON.stringify(newStrat));
    } catch {}
  };

  // Custom strategy sliders validation
  const assetSum = customStrategy.equity + customStrategy.debt + customStrategy.gold + customStrategy.cash;
  const mcapSum = customStrategy.largeCap + customStrategy.midCap + customStrategy.smallCap;

  // Generate 100% Client-Side Mathematical Diagnostic & Audit
  const handleRunDiagnostic = useCallback(() => {
    if (holdings.length === 0) return;
    setIsAuditing(true);

    const totalVal = Math.round(totalPortfolioValue || 0);
    const totalCost = Math.round(summary?.totalInvestedAmount || holdings.reduce((s, h) => s + h.investedAmount, 0));
    const totalGain = Math.round(summary?.totalGain || (totalVal - totalCost));
    const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    const xirrDisplay = summary?.xirr !== null && summary?.xirr !== undefined ? `${summary.xirr.toFixed(2)}%` : 'N/A';
    const alphaDisplay = summary?.alphaVsNifty !== null && summary?.alphaVsNifty !== undefined ? `${summary.alphaVsNifty > 0 ? '+' : ''}${summary.alphaVsNifty.toFixed(2)}%` : 'N/A';

    // 1. Asset Drift Calculations
    const eqDrift = assetAlloc.equity - activeStrategy.equity;
    const debtDrift = assetAlloc.debt - activeStrategy.debt;
    const goldDrift = assetAlloc.gold - activeStrategy.gold;
    const cashDrift = assetAlloc.cash - activeStrategy.cash;

    // 2. Market Cap Drift Calculations
    const largeDrift = marketCapAlloc.largeCap - activeStrategy.largeCap;
    const midDrift = marketCapAlloc.midCap - activeStrategy.midCap;
    const smallDrift = marketCapAlloc.smallCap - activeStrategy.smallCap;

    // 3. Plan Hygiene (Direct vs Regular)
    const regularHoldings = holdings.filter(h => (h.planType || '').toLowerCase().includes('regular'));
    const regularVal = regularHoldings.reduce((s, h) => s + h.currentValue, 0);
    const regularPct = totalVal > 0 ? (regularVal / totalVal) * 100 : 0;
    const estAnnualCommissionLoss = Math.round(regularVal * 0.01);

    // 4. Concentration & Diversification
    const numFunds = holdings.length;
    const topHolding = holdings.length > 0 ? holdings[0] : null;
    const topHoldingWeight = topHolding && totalVal > 0 ? (topHolding.currentValue / totalVal) * 100 : 0;

    // 5. Mathematical Scoring Engine (0-100)
    const assetPenalty = Math.min(30, (Math.abs(eqDrift) * 0.6) + (Math.abs(debtDrift) * 0.5) + (Math.abs(goldDrift) * 0.3));
    const mcapPenalty = Math.min(20, (Math.abs(largeDrift) * 0.25) + (Math.abs(midDrift) * 0.25) + (Math.abs(smallDrift) * 0.3));
    const regularPenalty = Math.min(15, (regularPct / 100) * 15);
    let countPenalty = 0;
    if (numFunds === 1) countPenalty = 10;
    else if (numFunds > 10) countPenalty = Math.min(15, (numFunds - 10) * 2.5);
    if (topHoldingWeight > 45) countPenalty = Math.min(15, countPenalty + (topHoldingWeight - 45) * 0.4);

    const rawScore = 100 - assetPenalty - mcapPenalty - regularPenalty - countPenalty;
    const score = Math.max(20, Math.min(98, Math.round(rawScore)));

    const grade = 
      score >= 88 ? 'A (Institutional Grade)' :
      score >= 78 ? 'B+ (Sound Core)' :
      score >= 65 ? 'B (Balanced with Minor Drift)' :
      score >= 50 ? 'C+ (Moderate Drift)' : 'C (Actionable Rebalance Advised)';

    const markdown = `### 🎯 Quantitative Portfolio Health Diagnostic & Audit
**Portfolio Health Score: ${score}/100** | Grade: **${grade}**  
*Evaluation Model: Deterministic Modern Portfolio Theory (MPT) & SEBI Categorization Mandates*

Your mutual fund portfolio comprises **${numFunds} schemes** holding a combined valuation of **${formatINR(totalVal, true)}** (Cost Basis: ${formatINR(totalCost, true)}) with an aggregate return of **${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%** and an annualized XIRR of **${xirrDisplay}** (Alpha vs Nifty 50: **${alphaDisplay}**).

---

#### 1. 📊 Asset Allocation Alignment
| Asset Class | Current Allocation | Target Strategy ("${activeStrategy.name}") | Drift | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Equity** | **${assetAlloc.equity.toFixed(1)}%** | ${activeStrategy.equity}% | ${eqDrift > 0 ? `+${eqDrift.toFixed(1)}%` : `${eqDrift.toFixed(1)}%`} | ${Math.abs(eqDrift) <= 3 ? '✅ Aligned' : eqDrift > 0 ? '⚠️ Overweight' : '🔻 Underweight'} |
| **Debt / Fixed Income** | **${assetAlloc.debt.toFixed(1)}%** | ${activeStrategy.debt}% | ${debtDrift > 0 ? `+${debtDrift.toFixed(1)}%` : `${debtDrift.toFixed(1)}%`} | ${Math.abs(debtDrift) <= 3 ? '✅ Aligned' : debtDrift > 0 ? '⚠️ Overweight' : '🔻 Underweight'} |
| **Gold & Commodities** | **${assetAlloc.gold.toFixed(1)}%** | ${activeStrategy.gold}% | ${goldDrift > 0 ? `+${goldDrift.toFixed(1)}%` : `${goldDrift.toFixed(1)}%`} | ${Math.abs(goldDrift) <= 2 ? '✅ Aligned' : goldDrift > 0 ? '⚠️ Overweight' : '🔻 Underweight'} |
| **Liquid / Cash** | **${assetAlloc.cash.toFixed(1)}%** | ${activeStrategy.cash}% | ${cashDrift > 0 ? `+${cashDrift.toFixed(1)}%` : `${cashDrift.toFixed(1)}%`} | ${Math.abs(cashDrift) <= 2 ? '✅ Aligned' : 'ℹ️ Buffer'} |

---

#### 2. 🏛️ Market-Cap Exposure & Risk Guardrails
- **Large Cap Core**: **${marketCapAlloc.largeCap.toFixed(1)}%** (Target: ${activeStrategy.largeCap}%) — Provides portfolio stability and drawdown protection.
- **Mid Cap Alpha**: **${marketCapAlloc.midCap.toFixed(1)}%** (Target: ${activeStrategy.midCap}%) — Accelerates medium-term compound earnings.
- **Small Cap Exposure**: **${marketCapAlloc.smallCap.toFixed(1)}%** (Target: ${activeStrategy.smallCap}%) ${marketCapAlloc.smallCap > 30 ? '— ⚠️ **Elevated Risk**: Small cap weight exceeds standard 25%-30% threshold. Expect higher drawdown volatility during market corrections.' : '— ✅ Balanced within recommended volatility limits.'}

---

#### 3. 🛡️ Plan Hygiene & Commission Audit
- **Direct vs Regular Plans**: ${regularPct <= 0.1 ? '✅ **100% Direct Plans**: Zero recurring broker commissions. You are saving the maximum possible ~0.75% to 1.25% in annual TER expense ratio.' : `⚠️ **Regular Plans Detected (${regularPct.toFixed(1)}% of portfolio)**: ~${formatINR(regularVal, true)} is invested in regular plans. Switching mature units (held >1 year) to Direct - Growth can save approximately **~${formatINR(estAnnualCommissionLoss, true)} every year** in avoided commissions.`}
- **Scheme Count (${numFunds} funds)**: ${numFunds >= 3 && numFunds <= 8 ? '✅ **Optimal Diversification**: Clean, focused portfolio structure without dilution.' : numFunds < 3 ? 'ℹ️ **Concentrated**: Consider broadening across flexi-cap or large & mid-cap cores.' : '⚠️ **High Fund Count (>8)**: Over-diversification can cause index hugging while paying multiple fund management fees.'}
- **Top Holding Weight**: ${topHolding ? `"${topHolding.schemeName}" accounts for **${topHoldingWeight.toFixed(1)}%** of the portfolio.` : ''}

---

#### 4. 💡 Tax-Optimized Mathematical Rebalance Plan
1. **Zero-Tax SIP Inflow Routing**: Direct incoming monthly SIP capital into **${rebalanceReport.assetClassItems.filter(i => i.status === 'UNDERWEIGHT').map(i => i.name).join(', ') || 'underweight assets'}** to restore target weights without triggering capital gains tax.
2. **Section 112A Annual Harvesting**: You have **${formatINR(taxSummary.unrealizedLtcg || 0, true)}** in unrealized Long-Term Capital Gains. Up to **₹1,25,000 per financial year is 100% tax-free** under Section 112A. ${taxSummary.taxHarvestingOpportunity > 0 ? `You can tax-harvest ~**${formatINR(taxSummary.taxHarvestingOpportunity, true)}** tax-free.` : 'Plan tax harvesting before March 31.'}
3. **Avoid STCG Lock-in**: Current unrealized Short-Term Capital Gains stand at **${formatINR(taxSummary.unrealizedStcg || 0, true)}**. Avoid selling these units before the 365-day threshold to prevent paying the 20% STCG tax rate.

---

#### 5. 📋 Systematic Action Checklist
1. **Rebalance Channel**: Use fresh monthly inflows for rebalancing rather than selling existing units.
2. **Direct Plan Switch**: Check for any Regular plan units that have crossed 365 days and switch to Direct - Growth.
3. **Emergency Cushion**: Keep at least 3–6 months of essential living expenses in an overnight or liquid fund.`;

    const report = {
      score,
      grade,
      markdown,
      timestamp: new Date().toISOString()
    };

    setDiagnosticReport(report);
    try {
      localStorage.setItem(STORAGE_KEY_DIAGNOSTIC_CACHE, JSON.stringify(report));
    } catch {}
    setIsAuditing(false);
  }, [holdings, summary, totalPortfolioValue, activeStrategy, marketCapAlloc, assetAlloc, taxSummary, rebalanceReport]);

  useEffect(() => {
    if (holdings.length > 0 && !diagnosticReport) {
      handleRunDiagnostic();
    }
  }, [holdings.length, diagnosticReport, handleRunDiagnostic]);

  if (holdings.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center">
        <PieIcon className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-neutral-200">No Portfolio Data</h3>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
          Import your CAS statement or add transactions to view dynamic asset allocation, market cap rebalancing, and mathematical health audit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Universal Legal Notice */}
      <div className="flex items-center gap-2.5 p-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-300 shadow-sm">
        <Info className="w-4 h-4 shrink-0 text-emerald-400" />
        <span><strong>Estimates only. Not investment, tax or legal advice.</strong> Asset allocation, rebalance projections, and portfolio metrics are mathematical calculations for informational purposes.</span>
      </div>

      {/* 1. Top Strategy Selector & Customizer */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Scale className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-white tracking-wide">Target Allocation Strategy</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Select or customize your benchmark asset allocation strategy to drive automated rebalance suggestions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCustomizing(!isCustomizing)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                isCustomizing 
                  ? 'bg-emerald-500 text-neutral-950 shadow-sm font-bold' 
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-neutral-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              {isCustomizing ? 'Hide Customizer' : 'Customize Strategy'}
              {isCustomizing ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          </div>
        </div>

        {/* Preset Strategy Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-4">
          {DEFAULT_ALLOCATION_STRATEGIES.map(strat => {
            const isSelected = selectedStrategyId === strat.id;
            return (
              <button
                key={strat.id}
                onClick={() => handleSelectStrategy(strat.id)}
                className={`p-3.5 rounded-xl text-left border transition relative overflow-hidden flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-sm' 
                    : 'bg-neutral-800/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? 'text-emerald-400' : 'text-neutral-200'}`}>
                      {strat.name}
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                    {strat.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-neutral-800/60 text-[10px] font-mono">
                  <span className="text-emerald-400">Eq: {strat.equity}%</span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-blue-400">Debt: {strat.debt}%</span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-amber-400">Gold: {strat.gold}%</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Expandable Custom Strategy Tuner */}
        {isCustomizing && (
          <div className="mt-4 pt-4 border-t border-neutral-800 bg-neutral-950/60 rounded-xl p-4 border border-neutral-800/80 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-neutral-200 flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Fine-Tune Strategy Percentages
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className={`font-mono font-bold ${assetSum === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Asset Class Sum: {assetSum}% {assetSum !== 100 && '(Must equal 100%)'}
                </span>
                <span className={`font-mono font-bold ${mcapSum === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  Market Cap Sum: {mcapSum}% {mcapSum !== 100 && '(Must equal 100%)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Asset Class Sliders */}
              <div className="space-y-3 bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800">
                <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
                  Macro Asset Classes
                </span>

                {/* Equity */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-300">Equity (%)</span>
                    <span className="font-bold text-emerald-400 font-mono">{customStrategy.equity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customStrategy.equity}
                    onChange={(e) => handleSaveCustomStrategy({ ...customStrategy, equity: Number(e.target.value) })}
                    className="w-full accent-emerald-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Debt */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-300">Debt & Fixed Income (%)</span>
                    <span className="font-bold text-blue-400 font-mono">{customStrategy.debt}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customStrategy.debt}
                    onChange={(e) => handleSaveCustomStrategy({ ...customStrategy, debt: Number(e.target.value) })}
                    className="w-full accent-blue-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Gold */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-300">Gold & Commodities (%)</span>
                    <span className="font-bold text-amber-400 font-mono">{customStrategy.gold}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customStrategy.gold}
                    onChange={(e) => handleSaveCustomStrategy({ ...customStrategy, gold: Number(e.target.value) })}
                    className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Cash */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-300">Liquid / Cash (%)</span>
                    <span className="font-bold text-cyan-400 font-mono">{customStrategy.cash}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customStrategy.cash}
                    onChange={(e) => handleSaveCustomStrategy({ ...customStrategy, cash: Number(e.target.value) })}
                    className="w-full accent-cyan-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Market Cap Sub-Allocation Sliders */}
              <div className="space-y-3 bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800">
                <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
                  Equity Market-Cap Targets (Within Equity)
                </span>

                {/* Large Cap */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-300">Large Cap (Nifty 100 / Bluechip)</span>
                    <span className="font-bold text-indigo-400 font-mono">{customStrategy.largeCap}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customStrategy.largeCap}
                    onChange={(e) => handleSaveCustomStrategy({ ...customStrategy, largeCap: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Mid Cap */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-300">Mid Cap (Emerging Growth)</span>
                    <span className="font-bold text-teal-400 font-mono">{customStrategy.midCap}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customStrategy.midCap}
                    onChange={(e) => handleSaveCustomStrategy({ ...customStrategy, midCap: Number(e.target.value) })}
                    className="w-full accent-teal-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Small Cap */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-300">Small Cap (High Alpha / Volatility)</span>
                    <span className="font-bold text-purple-400 font-mono">{customStrategy.smallCap}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={customStrategy.smallCap}
                    onChange={(e) => handleSaveCustomStrategy({ ...customStrategy, smallCap: Number(e.target.value) })}
                    className="w-full accent-purple-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Side-by-Side Macro Asset Allocation & Market Cap Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Macro Asset Class Drift */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-400" />
                Asset Class Drift & Target
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Current portfolio weight vs <strong className="text-neutral-200 font-medium">{activeStrategy.name}</strong>
              </p>
            </div>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
              rebalanceReport.assetClassItems.every(i => i.status === 'ALIGNED') 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {rebalanceReport.assetClassItems.every(i => i.status === 'ALIGNED') ? 'Asset Classes Aligned' : 'Rebalance Recommended'}
            </span>
          </div>

          <div className="space-y-4">
            {rebalanceReport.assetClassItems.map(item => {
              const colors: Record<string, string> = {
                'Equity': 'bg-emerald-500 text-emerald-400',
                'Debt & Fixed Income': 'bg-blue-500 text-blue-400',
                'Gold & Commodities': 'bg-amber-400 text-amber-400',
                'Liquid & Cash': 'bg-cyan-500 text-cyan-400',
              };
              const colorConfig = colors[item.name] || 'bg-emerald-500 text-emerald-400';
              const bgClass = colorConfig.split(' ')[0];
              const textClass = colorConfig.split(' ')[1];

              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-neutral-200 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${bgClass}`}></span>
                      {item.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-400 font-mono">
                        Target: <strong className="text-neutral-300 font-semibold">{item.targetPct}%</strong>
                      </span>
                      <span className="font-bold text-white font-mono">
                        {item.currentPct.toFixed(1)}%
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${
                        item.status === 'OVERWEIGHT' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                          : item.status === 'UNDERWEIGHT' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {item.driftPct > 0 ? `+${item.driftPct.toFixed(1)}%` : `${item.driftPct.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>

                  {/* Dual Bar (Actual with Target Marker) */}
                  <div className="relative w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${bgClass}`}
                      style={{ width: `${Math.min(item.currentPct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Equity Market Cap Sub-Allocation */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                Equity Market-Cap Sub-Allocation
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Large, Mid, and Small Cap distribution derived from scheme mandates
              </p>
            </div>
            <span className="text-xs font-mono text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700">
              Equity: {formatINR(marketCapAlloc.totalEquityValue, true)}
            </span>
          </div>

          <div className="space-y-4">
            {rebalanceReport.marketCapItems.map(item => {
              const mcapColors: Record<string, string> = {
                'Large Cap': 'bg-indigo-500 text-indigo-400',
                'Mid Cap': 'bg-teal-500 text-teal-400',
                'Small Cap': 'bg-purple-500 text-purple-400',
              };
              const colorConfig = mcapColors[item.name] || 'bg-indigo-500 text-indigo-400';
              const bgClass = colorConfig.split(' ')[0];

              return (
                <div key={item.name} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-neutral-200 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${bgClass}`}></span>
                      {item.name}
                      <span className="text-[10px] text-neutral-400 font-normal">
                        ({formatINR(item.currentValue, true)})
                      </span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-neutral-400 font-mono">
                        Target: <strong className="text-neutral-300 font-semibold">{item.targetPct}%</strong>
                      </span>
                      <span className="font-bold text-white font-mono">
                        {item.currentPct.toFixed(1)}%
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${
                        item.status === 'OVERWEIGHT' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                          : item.status === 'UNDERWEIGHT' 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {item.driftPct > 0 ? `+${item.driftPct.toFixed(1)}%` : `${item.driftPct.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>

                  <div className="relative w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${bgClass}`}
                      style={{ width: `${Math.min(item.currentPct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Flexi Cap and Multi Cap funds are categorized based on their underlying SEBI asset breakdown.</span>
          </div>
        </div>
      </div>

      {/* 3. Actionable Portfolio Rebalance Engine */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <RefreshCw className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-bold text-white tracking-wide">Automated Portfolio Rebalance Engine</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Actionable rupee rebalancing roadmap: route fresh SIPs without incurring taxes vs direct selling.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800 shrink-0">
            <button
              onClick={() => setRebalanceMode('SIP_INFLOW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                rebalanceMode === 'SIP_INFLOW'
                  ? 'bg-emerald-500 text-neutral-950 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Tax-Efficient SIP Routing (Recommended)
            </button>
            <button
              onClick={() => setRebalanceMode('DIRECT_REALIGNMENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                rebalanceMode === 'DIRECT_REALIGNMENT'
                  ? 'bg-neutral-800 text-white border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Direct Sell / Switch
            </button>
          </div>
        </div>

        {/* Mode Explanatory Notice & Inflow Input */}
        {rebalanceMode === 'SIP_INFLOW' ? (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-300">Equity Market-Cap Targeted SIP Rebalancer</span>
                    <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                      100% Equity Routing
                    </span>
                    <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {horizonMonths}-Month Gradual Alignment
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 max-w-2xl">
                    Dynamically weights your monthly SIP across all your existing flexi, mid, and small cap holdings using their internal SEBI market-cap asset allocations. Attains your target market-cap ratio smoothly over {horizonMonths} months without abruptly pausing any category.
                  </p>
                </div>
              </div>

              {/* Monthly SIP Input & Quick Presets */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                  {[25000, 45000, 50000, 75000, 100000].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleMonthlyInflowChange(preset)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition ${
                        monthlyInflow === preset
                          ? 'bg-emerald-500 text-neutral-950 shadow-sm'
                          : 'bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700'
                      }`}
                    >
                      {preset === 45000 ? '₹45k (Default)' : `₹${preset / 1000}k`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-mono">₹</span>
                    <input
                      type="number"
                      step="5000"
                      value={monthlyInflow}
                      onChange={(e) => handleMonthlyInflowChange(Number(e.target.value))}
                      className="w-28 bg-neutral-900 border border-neutral-700 rounded-lg pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Horizon Duration Selector & Target Projection Pill */}
            <div className="pt-3 border-t border-emerald-500/15 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Target Realignment Horizon:
                </span>
                <div className="flex items-center gap-1 bg-neutral-900/80 p-0.5 rounded-lg border border-neutral-800">
                  {[6, 12, 18, 24].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleHorizonMonthsChange(m)}
                      className={`px-2.5 py-1 rounded text-[10px] font-medium transition ${
                        horizonMonths === m
                          ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {m} Months {m === 12 && '(Target)'}
                    </button>
                  ))}
                </div>
              </div>

              {rebalanceReport.projectedMarketCap && (
                <div className="flex items-center gap-3 text-[11px] font-mono bg-neutral-900/90 px-3 py-1.5 rounded-lg border border-neutral-800">
                  <span className="text-neutral-400 font-sans font-medium text-[10px] uppercase">
                    Projected at Month {horizonMonths}:
                  </span>
                  <span className="text-indigo-400 font-semibold">
                    L: {rebalanceReport.projectedMarketCap.largeCap.toFixed(1)}% <span className="text-neutral-500 font-normal">(Target {activeStrategy.largeCap}%)</span>
                  </span>
                  <span className="text-teal-400 font-semibold">
                    M: {rebalanceReport.projectedMarketCap.midCap.toFixed(1)}% <span className="text-neutral-500 font-normal">(Target {activeStrategy.midCap}%)</span>
                  </span>
                  <span className="text-purple-400 font-semibold">
                    S: {rebalanceReport.projectedMarketCap.smallCap.toFixed(1)}% <span className="text-neutral-500 font-normal">(Target {activeStrategy.smallCap}%)</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-bold text-amber-300 block">Direct Rebalancing / Capital Switch Note</span>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Direct selling from overweight buckets may trigger STCG (20%) or LTCG (12.5% over ₹1.25 Lakh exempt limit). Consider tax harvesting before executing redemptions.
              </p>
            </div>
          </div>
        )}

        {/* Rebalance Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Asset / Category</th>
                <th className="py-2.5 px-3">Current Value</th>
                <th className="py-2.5 px-3">Actual %</th>
                <th className="py-2.5 px-3">Target %</th>
                <th className="py-2.5 px-3">Drift</th>
                <th className="py-2.5 px-3">
                  {rebalanceMode === 'SIP_INFLOW' ? 'Monthly SIP Distribution' : 'Direct Rebalance Amount'}
                </th>
                <th className="py-2.5 px-3 text-right">Target Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {/* Asset Classes */}
              {rebalanceReport.assetClassItems.map(item => (
                <tr key={item.name} className="hover:bg-neutral-800/30 transition">
                  <td className="py-3 px-3 font-semibold text-neutral-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {item.name}
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-300">{formatINR(item.currentValue, true)}</td>
                  <td className="py-3 px-3 font-mono font-semibold text-white">{item.currentPct.toFixed(1)}%</td>
                  <td className="py-3 px-3 font-mono text-neutral-400">{item.targetPct}%</td>
                  <td className="py-3 px-3 font-mono">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      item.status === 'OVERWEIGHT'
                        ? 'text-amber-400 bg-amber-500/10'
                        : item.status === 'UNDERWEIGHT'
                          ? 'text-blue-400 bg-blue-500/10'
                          : 'text-emerald-400 bg-emerald-500/10'
                    }`}>
                      {item.driftPct > 0 ? `+${item.driftPct.toFixed(1)}%` : `${item.driftPct.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    {rebalanceMode === 'SIP_INFLOW' ? (
                      item.name === 'Equity' ? (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                          <span>+{formatINR(item.sipAllocAmount)}</span>
                          <span className="text-[10px] text-emerald-300/80 font-normal">(100% of Monthly SIP)</span>
                        </div>
                      ) : (
                        <span className="text-neutral-500 text-[11px] font-normal italic">Manual Rebalance Only</span>
                      )
                    ) : (
                      item.deltaAmount > 0 ? (
                        <span className="text-emerald-400 font-bold font-mono">Buy +{formatINR(item.deltaAmount)}</span>
                      ) : item.deltaAmount < 0 ? (
                        <span className="text-amber-400 font-bold font-mono">Trim {formatINR(Math.abs(item.deltaAmount))}</span>
                      ) : (
                        <span className="text-neutral-500">Aligned</span>
                      )
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-right font-semibold text-neutral-200">
                    {formatINR(item.targetValue, true)}
                  </td>
                </tr>
              ))}

              {/* Market Cap Sub-Items Divider */}
              <tr className="bg-neutral-950/40">
                <td colSpan={7} className="py-2.5 px-3 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-indigo-400" />
                      Equity Market-Cap Sub-Targets (Dynamic SIP Alignment)
                    </span>
                    <span className="text-neutral-500 font-normal">
                      SIP routes to close under-allocated cap gaps
                    </span>
                  </div>
                </td>
              </tr>

              {rebalanceReport.marketCapItems.map(item => (
                <tr key={item.name} className="hover:bg-neutral-800/30 transition">
                  <td className="py-2.5 px-3 font-medium text-neutral-300 pl-6 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    {item.name}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-neutral-400">{formatINR(item.currentValue, true)}</td>
                  <td className="py-2.5 px-3 font-mono font-medium text-white">{item.currentPct.toFixed(1)}%</td>
                  <td className="py-2.5 px-3 font-mono text-neutral-400">{item.targetPct}%</td>
                  <td className="py-2.5 px-3 font-mono">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      item.status === 'OVERWEIGHT'
                        ? 'text-amber-400 bg-amber-500/10'
                        : item.status === 'UNDERWEIGHT'
                          ? 'text-blue-400 bg-blue-500/10'
                          : 'text-emerald-400 bg-emerald-500/10'
                    }`}>
                      {item.driftPct > 0 ? `+${item.driftPct.toFixed(1)}%` : `${item.driftPct.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    {rebalanceMode === 'SIP_INFLOW' ? (
                      item.sipAllocAmount > 0 ? (
                        <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                          <span>+{formatINR(item.sipAllocAmount)}</span>
                          <span className="text-[10px] text-neutral-400 font-normal">({item.sipAllocPct.toFixed(0)}% of SIP)</span>
                        </div>
                      ) : (
                        <span className="text-neutral-500 font-normal">Aligned / Low Deficit</span>
                      )
                    ) : (
                      item.deltaAmount > 0 ? (
                        <span className="text-indigo-400 font-bold font-mono">Allocate +{formatINR(item.deltaAmount)}</span>
                      ) : item.deltaAmount < 0 ? (
                        <span className="text-amber-400 font-bold font-mono">Reallocate {formatINR(Math.abs(item.deltaAmount))}</span>
                      ) : (
                        <span className="text-neutral-500">Aligned</span>
                      )
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-right font-medium text-neutral-300">
                    {formatINR(item.targetValue, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3B. Intelligent Scheme-by-Scheme Monthly SIP Routing Matrix */}
        {rebalanceMode === 'SIP_INFLOW' && rebalanceReport.schemeSipRecommendations.length > 0 && (
          <div className="mt-6 pt-5 border-t border-neutral-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Recommended Scheme-Level SIP Allocation (₹{monthlyInflow.toLocaleString('en-IN')}/Month)
                  </h3>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                    3 Active SIP Funds
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  SIP plan directed into your active SIP funds (<strong>Parag Parikh Flexi Cap</strong>, <strong>Motilal Oswal Midcap</strong>, and <strong>SBI Small Cap</strong>) to converge your equity portfolio to the <strong>50:25:25</strong> Large/Mid/Small Cap target over {horizonMonths} months.
                </p>
              </div>

              {/* Copy Plan Button */}
              <button
                onClick={() => {
                  const text = [
                    `📊 Monthly Equity SIP Allocation Plan (Target: ₹${monthlyInflow.toLocaleString('en-IN')})`,
                    ...rebalanceReport.schemeSipRecommendations.map(
                      r => `• ${r.schemeName} [${r.primaryRole}]: ₹${r.recommendedSip.toLocaleString('en-IN')}/mo (${r.sipSharePct.toFixed(1)}%) - ${r.rationale}`
                    )
                  ].join('\n');
                  navigator.clipboard.writeText(text);
                  setCopiedSipPlan(true);
                  setTimeout(() => setCopiedSipPlan(false), 2500);
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0 border border-neutral-700"
              >
                {copiedSipPlan ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Copy SIP Plan</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rebalanceReport.schemeSipRecommendations.map((scheme) => {
                const roleBadgeClass = 
                  scheme.primaryRole === 'Large Cap Anchor' 
                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' 
                    : scheme.primaryRole === 'Mid Cap Growth' 
                      ? 'bg-teal-500/10 text-teal-300 border-teal-500/30' 
                      : scheme.primaryRole === 'Small Cap Alpha' 
                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' 
                        : 'bg-blue-500/10 text-blue-300 border-blue-500/30';

                return (
                  <div 
                    key={scheme.schemeCode || scheme.schemeName}
                    className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 hover:border-neutral-700 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleBadgeClass}`}>
                          {scheme.primaryRole}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-emerald-400">
                          {scheme.sipSharePct.toFixed(1)}% of SIP
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-white leading-tight line-clamp-2" title={scheme.schemeName}>
                        {scheme.schemeName}
                      </h4>

                      <div className="mt-2 text-[11px] text-neutral-400 font-mono flex items-center gap-2">
                        <span>Current: {formatINR(scheme.currentValue, true)}</span>
                        <span>•</span>
                        <span>L:{scheme.largeCapPct}% M:{scheme.midCapPct}% S:{scheme.smallCapPct}%</span>
                      </div>

                      <p className="text-[11px] text-neutral-400 mt-2 italic bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/80">
                        {scheme.rationale}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-neutral-400 block">Target Monthly SIP</span>
                        {scheme.projected12mAddition && (
                          <span className="text-[10px] text-neutral-500 font-mono">
                            +₹{Math.round(scheme.projected12mAddition).toLocaleString('en-IN')} across {horizonMonths}m
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold font-mono text-white bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        ₹{scheme.recommendedSip.toLocaleString('en-IN')}/mo
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3C. Dedicated Manual Rebalancing Recommendations (Debt & Gold) */}
        {rebalanceReport.manualRebalanceNotes && rebalanceReport.manualRebalanceNotes.length > 0 && (
          <div className="mt-6 pt-5 border-t border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Manual Rebalancing Recommendations (Debt & Gold)
              </h3>
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-semibold">
                Lump-Sum / Periodic Switch
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rebalanceReport.manualRebalanceNotes.map((note) => (
                <div 
                  key={note.assetName}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                    note.action === 'ADD'
                      ? 'bg-blue-500/5 border-blue-500/20'
                      : note.action === 'TRIM'
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-emerald-500/5 border-emerald-500/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-white">{note.assetName}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      note.action === 'ADD'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : note.action === 'TRIM'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {note.action === 'ADD' ? 'Top-Up Needed' : note.action === 'TRIM' ? 'Overweight (Hold/Trim)' : 'Target Met'}
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    {note.explanation}
                  </p>

                  {note.amount > 0 && (
                    <div className="mt-3 pt-2 border-t border-neutral-800/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-neutral-400 font-sans">Recommended Lump-Sum Action:</span>
                      <span className={`font-bold ${note.action === 'ADD' ? 'text-blue-400' : 'text-amber-400'}`}>
                        {note.action === 'ADD' ? `+₹${note.amount.toLocaleString('en-IN')}` : `Trim ₹${note.amount.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Client-Side Mathematical Portfolio Diagnostic & Health Audit */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Portfolio Diagnostic & Health Audit</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  100% Client-Side Math Engine
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Deterministic mathematical audit of asset allocation drift, market cap risk, and tax-efficient rebalancing.
              </p>
              <p className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1 font-medium">
                <span>🔒 Zero Data Egress: All calculations run 100% locally in your browser. No portfolio data, holdings, folios, or PAN are ever shared with any AI agent or external server.</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleRunDiagnostic}
            disabled={isAuditing}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 font-bold text-xs shadow-md shadow-emerald-950/30 flex items-center gap-2 transition disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isAuditing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Auditing Portfolio...
              </>
            ) : (
              <>
                <Scale className="w-3.5 h-3.5" />
                {diagnosticReport ? 'Re-Audit Portfolio' : 'Run Portfolio Audit'}
              </>
            )}
          </button>
        </div>

        {/* Auditing Skeleton */}
        {isAuditing && (
          <div className="py-8 space-y-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold animate-pulse">
              <Scale className="w-3.5 h-3.5" />
              Computing asset allocation drift, market-cap guardrails, and tax harvesting opportunities...
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <div className="h-2.5 bg-neutral-800 rounded-full w-full animate-pulse"></div>
              <div className="h-2.5 bg-neutral-800 rounded-full w-4/5 mx-auto animate-pulse"></div>
              <div className="h-2.5 bg-neutral-800 rounded-full w-3/5 mx-auto animate-pulse"></div>
            </div>
          </div>
        )}

        {/* Diagnostic Report Content */}
        {!isAuditing && diagnosticReport && (
          <div className="mt-5 space-y-4">
            {/* Top Score Badge */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-950/60 border border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-base font-mono">
                  {diagnosticReport.score}
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Portfolio Health Score: {diagnosticReport.score}/100</span>
                  <span className="text-[11px] text-neutral-400">
                    Calculated locally: {new Date(diagnosticReport.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                {diagnosticReport.grade || (diagnosticReport.score >= 80 ? 'Institutional Grade' : diagnosticReport.score >= 65 ? 'Well Structured' : 'Needs Rebalance')}
              </span>
            </div>

            {/* Markdown Output */}
            <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-neutral-300 bg-neutral-950/40 p-5 rounded-xl border border-neutral-800/80">
              <Markdown>{diagnosticReport.markdown}</Markdown>
            </div>
          </div>
        )}

        {!isAuditing && !diagnosticReport && (
          <div className="py-8 text-center bg-neutral-950/30 rounded-xl border border-neutral-800/50 mt-4">
            <Scale className="w-10 h-10 text-neutral-600 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-neutral-300">Ready for Mathematical Portfolio Audit</h4>
            <p className="text-[11px] text-neutral-500 max-w-md mx-auto mt-1">
              Click &apos;Run Portfolio Audit&apos; to run an automated, deterministic analysis of scheme concentration, market-cap alignment, and tax-optimized rebalancing.
            </p>
          </div>
        )}
      </div>

      {/* 5. Equity Market-Cap Split & Scheme Breakdown */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Equity Market-Cap Split & Scheme Decomposition
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Granular Large, Mid, and Small Cap capital allocation derived dynamically across all mutual fund holdings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
              Equity: {formatINR(marketCapAlloc.totalEquityValue, true)}
            </span>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {styleTilt.title}
            </span>
          </div>
        </div>

        {/* Visual Proportional Horizon Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-neutral-400">Equity Market-Cap Distribution</span>
            <span className="text-neutral-300 font-semibold">{marketCapAlloc.totalEquityValue > 0 ? '100% Allocated' : 'No Equity Funds'}</span>
          </div>

          <div className="w-full h-4 bg-neutral-950 rounded-lg overflow-hidden flex border border-neutral-800 p-0.5 gap-0.5">
            {marketCapAlloc.largeCap > 0 && (
              <div
                className="h-full bg-indigo-500 rounded-sm transition-all duration-300 relative group"
                style={{ width: `${marketCapAlloc.largeCap}%` }}
                title={`Large Cap: ${marketCapAlloc.largeCap.toFixed(1)}%`}
              />
            )}
            {marketCapAlloc.midCap > 0 && (
              <div
                className="h-full bg-teal-500 rounded-sm transition-all duration-300 relative group"
                style={{ width: `${marketCapAlloc.midCap}%` }}
                title={`Mid Cap: ${marketCapAlloc.midCap.toFixed(1)}%`}
              />
            )}
            {marketCapAlloc.smallCap > 0 && (
              <div
                className="h-full bg-purple-500 rounded-sm transition-all duration-300 relative group"
                style={{ width: `${marketCapAlloc.smallCap}%` }}
                title={`Small Cap: ${marketCapAlloc.smallCap.toFixed(1)}%`}
              />
            )}
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1 font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></span>
              <span className="text-neutral-300">Large Cap (Top 100):</span>
              <strong className="text-white">{marketCapAlloc.largeCap.toFixed(1)}%</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-500"></span>
              <span className="text-neutral-300">Mid Cap (101–250):</span>
              <strong className="text-white">{marketCapAlloc.midCap.toFixed(1)}%</strong>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-500"></span>
              <span className="text-neutral-300">Small Cap (251+):</span>
              <strong className="text-white">{marketCapAlloc.smallCap.toFixed(1)}%</strong>
            </div>
          </div>
        </div>

        {/* 3 Pillar Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Large Cap Card */}
          <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                Large Cap (1–100)
              </span>
              <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                marketCapAlloc.largeCap > activeStrategy.largeCap + 3
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : marketCapAlloc.largeCap < activeStrategy.largeCap - 3
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {(marketCapAlloc.largeCap - activeStrategy.largeCap) > 0 
                  ? `+${(marketCapAlloc.largeCap - activeStrategy.largeCap).toFixed(1)}% Drift` 
                  : `${(marketCapAlloc.largeCap - activeStrategy.largeCap).toFixed(1)}% Drift`}
              </span>
            </div>

            <div>
              <div className="text-lg font-bold text-white font-mono">
                {formatINR(marketCapAlloc.largeCapValue, true)}
              </div>
              <div className="text-xs text-neutral-400 mt-0.5 flex items-center justify-between">
                <span>Weight: <strong className="text-neutral-200">{marketCapAlloc.largeCap.toFixed(1)}%</strong></span>
                <span>Target: <strong className="text-neutral-300">{activeStrategy.largeCap}%</strong></span>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
              Bluechip industry leaders with steady balance sheets, minimal drawdown volatility, and high liquidity.
            </div>
          </div>

          {/* Mid Cap Card */}
          <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                Mid Cap (101–250)
              </span>
              <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                marketCapAlloc.midCap > activeStrategy.midCap + 3
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : marketCapAlloc.midCap < activeStrategy.midCap - 3
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {(marketCapAlloc.midCap - activeStrategy.midCap) > 0 
                  ? `+${(marketCapAlloc.midCap - activeStrategy.midCap).toFixed(1)}% Drift` 
                  : `${(marketCapAlloc.midCap - activeStrategy.midCap).toFixed(1)}% Drift`}
              </span>
            </div>

            <div>
              <div className="text-lg font-bold text-white font-mono">
                {formatINR(marketCapAlloc.midCapValue, true)}
              </div>
              <div className="text-xs text-neutral-400 mt-0.5 flex items-center justify-between">
                <span>Weight: <strong className="text-neutral-200">{marketCapAlloc.midCap.toFixed(1)}%</strong></span>
                <span>Target: <strong className="text-neutral-300">{activeStrategy.midCap}%</strong></span>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
              Emerging sectoral champions with high growth runways, scalable revenue, and substantial market share gains.
            </div>
          </div>

          {/* Small Cap Card */}
          <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Small Cap (251+)
              </span>
              <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                marketCapAlloc.smallCap > activeStrategy.smallCap + 3
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : marketCapAlloc.smallCap < activeStrategy.smallCap - 3
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {(marketCapAlloc.smallCap - activeStrategy.smallCap) > 0 
                  ? `+${(marketCapAlloc.smallCap - activeStrategy.smallCap).toFixed(1)}% Drift` 
                  : `${(marketCapAlloc.smallCap - activeStrategy.smallCap).toFixed(1)}% Drift`}
              </span>
            </div>

            <div>
              <div className="text-lg font-bold text-white font-mono">
                {formatINR(marketCapAlloc.smallCapValue, true)}
              </div>
              <div className="text-xs text-neutral-400 mt-0.5 flex items-center justify-between">
                <span>Weight: <strong className="text-neutral-200">{marketCapAlloc.smallCap.toFixed(1)}%</strong></span>
                <span>Target: <strong className="text-neutral-300">{activeStrategy.smallCap}%</strong></span>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
              High-alpha engines for multi-year wealth compounding; requires discipline during standard cyclical drawdowns.
            </div>
          </div>
        </div>

        {/* Scheme-by-Scheme Market Cap Decomposition Table */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Scheme-Level Market Cap Contribution Table
              </h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Pre-populated with authentic AMC factsheet reference splits (e.g. Parag Parikh Flexi Cap 93.73% Large / 2.87% Mid / 3.40% Small) and SEBI benchmarks. Any custom edits you make here persist in your browser cache.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {Object.keys(fundMarketCapSplits).length > 0 && (
                <button
                  onClick={handleResetAllFundSplits}
                  className="px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 rounded-lg flex items-center gap-1.5 transition"
                  title="Reset all funds to default AMC factsheet and SEBI benchmark splits"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  Reset All to Defaults
                </button>
              )}
              <span className="text-[11px] font-mono px-2 py-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                {equityHoldingsBreakdown.length} Equity {equityHoldingsBreakdown.length === 1 ? 'Scheme' : 'Schemes'}
              </span>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {equityHoldingsBreakdown.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 bg-neutral-950/40 rounded-xl border border-neutral-800">
                No equity-oriented funds found in portfolio.
              </div>
            ) : (
              equityHoldingsBreakdown.map((item) => (
                <div 
                  key={`m_${item.schemeCode}_${item.schemeName}`}
                  className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-semibold text-white text-xs leading-snug">
                        {item.schemeName}
                      </h5>
                      <div className="text-[10px] text-neutral-400 flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="bg-neutral-800/80 px-1.5 py-0.5 rounded text-neutral-300">
                          {item.category}
                        </span>
                        {item.isHybrid && (
                          <span className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20">
                            65% Equity
                          </span>
                        )}
                        {item.isCustomized ? (
                          <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
                            Custom Override
                          </span>
                        ) : item.isFactsheetDefault ? (
                          <span className="bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 font-medium">
                            {item.sourceName || 'AMC Factsheet'}
                          </span>
                        ) : (
                          <span className="bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                            SEBI Benchmark
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold font-mono text-neutral-200">
                        {formatINR(item.effectiveEquityValue, true)}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        {item.weightInEquity.toFixed(1)}% of Eq
                      </div>
                    </div>
                  </div>

                  {/* Market Cap Inputs Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-800/80">
                    {/* Large Cap */}
                    <div className="bg-neutral-900/90 p-2 rounded-lg border border-neutral-800 text-center">
                      <span className="text-[10px] font-bold text-indigo-400 block mb-1">Large Cap</span>
                      <div className="flex items-center justify-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.largeCapPct}
                          onChange={(e) => handleUpdateFundSplit(item.key, { largeCap: Number(e.target.value) }, item.defaultSplit)}
                          className="w-14 text-center font-mono font-bold text-xs bg-neutral-950 border border-neutral-700 focus:border-indigo-500 rounded py-1 text-indigo-300 outline-none"
                        />
                        <span className="text-neutral-500 text-[10px] ml-0.5">%</span>
                      </div>
                      <span className="text-[9px] text-neutral-400 font-mono mt-1 block">
                        {formatINR(item.largeCapVal, true)}
                      </span>
                    </div>

                    {/* Mid Cap */}
                    <div className="bg-neutral-900/90 p-2 rounded-lg border border-neutral-800 text-center">
                      <span className="text-[10px] font-bold text-teal-400 block mb-1">Mid Cap</span>
                      <div className="flex items-center justify-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.midCapPct}
                          onChange={(e) => handleUpdateFundSplit(item.key, { midCap: Number(e.target.value) }, item.defaultSplit)}
                          className="w-14 text-center font-mono font-bold text-xs bg-neutral-950 border border-neutral-700 focus:border-teal-500 rounded py-1 text-teal-300 outline-none"
                        />
                        <span className="text-neutral-500 text-[10px] ml-0.5">%</span>
                      </div>
                      <span className="text-[9px] text-neutral-400 font-mono mt-1 block">
                        {formatINR(item.midCapVal, true)}
                      </span>
                    </div>

                    {/* Small Cap */}
                    <div className="bg-neutral-900/90 p-2 rounded-lg border border-neutral-800 text-center">
                      <span className="text-[10px] font-bold text-purple-400 block mb-1">Small Cap</span>
                      <div className="flex items-center justify-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.smallCapPct}
                          onChange={(e) => handleUpdateFundSplit(item.key, { smallCap: Number(e.target.value) }, item.defaultSplit)}
                          className="w-14 text-center font-mono font-bold text-xs bg-neutral-950 border border-neutral-700 focus:border-purple-500 rounded py-1 text-purple-300 outline-none"
                        />
                        <span className="text-neutral-500 text-[10px] ml-0.5">%</span>
                      </div>
                      <span className="text-[9px] text-neutral-400 font-mono mt-1 block">
                        {formatINR(item.smallCapVal, true)}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Status footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-xs">
                    <div>
                      {Math.abs(item.sumPct - 100) < 0.05 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Check className="w-3 h-3" />
                          Sum: {item.sumPct === 100 ? '100%' : `${item.sumPct}%`}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleNormalizeFundSplit(item.key, item.defaultSplit)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition"
                          title="Click to normalize Large, Mid, and Small Cap to exactly 100%"
                        >
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Sum: {item.sumPct}% (Normalize)
                        </button>
                      )}
                    </div>

                    {item.isCustomized && (
                      <button
                        onClick={() => handleResetFundSplit(item.key)}
                        className="text-[11px] text-neutral-400 hover:text-amber-400 flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset to default
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-800/40 text-neutral-400 border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold min-w-[220px]">Scheme Name & Category</th>
                  <th className="py-2.5 px-3 font-semibold text-right min-w-[110px]">Equity Value</th>
                  <th className="py-2.5 px-3 font-semibold text-right min-w-[90px]">Weight</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-indigo-400 min-w-[120px]">Large Cap (%)</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-teal-400 min-w-[120px]">Mid Cap (%)</th>
                  <th className="py-2.5 px-3 font-semibold text-center text-purple-400 min-w-[120px]">Small Cap (%)</th>
                  <th className="py-2.5 px-3 font-semibold text-center min-w-[130px]">Total & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {equityHoldingsBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">
                      No equity-oriented funds found in portfolio.
                    </td>
                  </tr>
                ) : (
                  equityHoldingsBreakdown.map((item) => (
                    <tr key={`${item.schemeCode}_${item.schemeName}`} className="hover:bg-neutral-800/30 transition group">
                      {/* Scheme Info */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-white max-w-xs sm:max-w-sm truncate" title={item.schemeName}>
                          {item.schemeName}
                        </div>
                        <div className="text-[11px] text-neutral-400 flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="bg-neutral-800/80 px-1.5 py-0.5 rounded text-[10px] text-neutral-300">
                            {item.category}
                          </span>
                          {item.isHybrid && (
                            <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20">
                              65% Equity Portion
                            </span>
                          )}
                          {item.isCustomized ? (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium" title="Saved custom override in browser cache">
                              Custom Override
                            </span>
                          ) : item.isFactsheetDefault ? (
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 font-medium" title={`Default from ${item.sourceName}`}>
                              {item.sourceName || 'AMC Factsheet'}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded" title="Standard SEBI category benchmark">
                              SEBI Benchmark
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Equity Value */}
                      <td className="py-3 px-3 font-mono text-right font-semibold text-neutral-200">
                        {formatINR(item.effectiveEquityValue, true)}
                      </td>

                      {/* Weight */}
                      <td className="py-3 px-3 font-mono text-right text-neutral-300">
                        {item.weightInEquity.toFixed(1)}%
                      </td>

                      {/* Large Cap Input */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.largeCapPct}
                              onChange={(e) => handleUpdateFundSplit(item.key, { largeCap: Number(e.target.value) }, item.defaultSplit)}
                              className="w-16 text-center font-mono font-bold text-xs bg-neutral-900 border border-neutral-700 focus:border-indigo-500 rounded-lg py-1 px-1.5 text-indigo-300 focus:outline-none shadow-inner"
                            />
                            <span className="text-neutral-500 text-xs ml-1 font-mono">%</span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono mt-1">
                            {formatINR(item.largeCapVal, true)}
                          </span>
                        </div>
                      </td>

                      {/* Mid Cap Input */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.midCapPct}
                              onChange={(e) => handleUpdateFundSplit(item.key, { midCap: Number(e.target.value) }, item.defaultSplit)}
                              className="w-16 text-center font-mono font-bold text-xs bg-neutral-900 border border-neutral-700 focus:border-teal-500 rounded-lg py-1 px-1.5 text-teal-300 focus:outline-none shadow-inner"
                            />
                            <span className="text-neutral-500 text-xs ml-1 font-mono">%</span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono mt-1">
                            {formatINR(item.midCapVal, true)}
                          </span>
                        </div>
                      </td>

                      {/* Small Cap Input */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.smallCapPct}
                              onChange={(e) => handleUpdateFundSplit(item.key, { smallCap: Number(e.target.value) }, item.defaultSplit)}
                              className="w-16 text-center font-mono font-bold text-xs bg-neutral-900 border border-neutral-700 focus:border-purple-500 rounded-lg py-1 px-1.5 text-purple-300 focus:outline-none shadow-inner"
                            />
                            <span className="text-neutral-500 text-xs ml-1 font-mono">%</span>
                          </div>
                          <span className="text-[10px] text-neutral-400 font-mono mt-1">
                            {formatINR(item.smallCapVal, true)}
                          </span>
                        </div>
                      </td>

                      {/* Total & Action */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          {Math.abs(item.sumPct - 100) < 0.05 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Check className="w-3 h-3" />
                              {item.sumPct === 100 ? '100%' : `${item.sumPct}%`}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleNormalizeFundSplit(item.key, item.defaultSplit)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition"
                              title="Click to normalize Large, Mid, and Small Cap to exactly 100%"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              {item.sumPct}% (Fix)
                            </button>
                          )}

                          {item.isCustomized && (
                            <button
                              onClick={() => handleResetFundSplit(item.key)}
                              className="text-[10px] text-neutral-400 hover:text-amber-400 flex items-center gap-1 transition mt-0.5"
                              title="Reset this fund to default SEBI benchmark split"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              Reset
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
