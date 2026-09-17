import React, { useState, useMemo } from 'react';
import { 
  Target, 
  Plus, 
  Trash2, 
  Edit3, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  Clock, 
  Compass, 
  Zap, 
  RotateCcw,
  AlertTriangle,
  ArrowRightLeft,
  X,
  Sparkles
} from 'lucide-react';
import { PortfolioGoal, PortfolioHolding, GoalCategory } from '../types';
import { 
  loadStoredGoals, 
  saveStoredGoals, 
  analyzeGoal, 
  getDefaultPortfolioGoals 
} from '../utils/goalCalculations';
import { formatINR } from '../utils/financialCalculations';
import { PrivacyValue } from '../context/PrivacyContext';

interface GoalTrackerProps {
  holdings: PortfolioHolding[];
}

const CATEGORY_CONFIG: Record<GoalCategory, { label: string; icon: string; bg: string; text: string }> = {
  RETIREMENT: { label: 'Retirement & FIRE', icon: '🏖️', bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-400' },
  EDUCATION: { label: 'Child Education', icon: '🎓', bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-400' },
  EMERGENCY: { label: 'Emergency Fund', icon: '🛡️', bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400' },
  PROPERTY: { label: 'Home / Property', icon: '🏡', bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400' },
  WEALTH: { label: 'Wealth Compounding', icon: '💎', bg: 'bg-cyan-500/10 border-cyan-500/30', text: 'text-cyan-400' },
  VEHICLE: { label: 'Car / Vehicle', icon: '🚗', bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
  TRAVEL: { label: 'Dream Vacation', icon: '✈️', bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400' },
  CUSTOM: { label: 'Custom Financial Goal', icon: '🎯', bg: 'bg-neutral-800 border-neutral-700', text: 'text-neutral-300' }
};

export const GoalTracker: React.FC<GoalTrackerProps> = ({ holdings }) => {
  const [goals, setGoals] = useState<PortfolioGoal[]>(() => loadStoredGoals(holdings));
  const [editingGoal, setEditingGoal] = useState<PortfolioGoal | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [allocatingGoalId, setAllocatingGoalId] = useState<string | null>(null);

  // In-app Modal Confirmation States (eliminates dependency on window.confirm)
  const [deletingGoal, setDeletingGoal] = useState<PortfolioGoal | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  // Form State for Create / Edit
  const [formData, setFormData] = useState<{
    name: string;
    category: GoalCategory;
    targetAmount: number;
    targetYear: number;
    expectedCagr: number;
    monthlySip: number;
    notes: string;
  }>({
    name: '',
    category: 'RETIREMENT',
    targetAmount: 5000000,
    targetYear: new Date().getFullYear() + 10,
    expectedCagr: 12.0,
    monthlySip: 15000,
    notes: ''
  });

  // Group holdings by unique schemeCode for clean fund-level allocation
  const uniqueFundHoldings = useMemo(() => {
    const map = new Map<string, {
      schemeCode: string;
      schemeName: string;
      category: string;
      currentValue: number;
      investedAmount: number;
      folios: string[];
    }>();

    holdings.forEach(h => {
      const code = (h.schemeCode || '').trim();
      if (!map.has(code)) {
        map.set(code, {
          schemeCode: code,
          schemeName: h.schemeName,
          category: h.category,
          currentValue: h.currentValue,
          investedAmount: h.investedAmount,
          folios: h.folioNumber ? [h.folioNumber] : []
        });
      } else {
        const item = map.get(code)!;
        item.currentValue += h.currentValue;
        item.investedAmount += h.investedAmount;
        if (h.folioNumber && !item.folios.includes(h.folioNumber)) {
          item.folios.push(h.folioNumber);
        }
      }
    });

    return Array.from(map.values());
  }, [holdings]);

  // Calculate assigned funds map across ALL goals for strict mutual exclusivity
  // Each fund (schemeCode) can belong to at most ONE goal.
  const assignedFundsMap = useMemo(() => {
    const map = new Map<string, { goalId: string; goalName: string; percentage: number }>();
    goals.forEach(g => {
      g.allocatedHoldings.forEach(a => {
        if (a.percentage > 0) {
          map.set(a.schemeCode, {
            goalId: g.id,
            goalName: g.name,
            percentage: a.percentage
          });
        }
      });
    });
    return map;
  }, [goals]);

  // Unassigned holdings calculation
  const unassignedHoldings = useMemo(() => {
    return uniqueFundHoldings.filter(h => !assignedFundsMap.has(h.schemeCode));
  }, [uniqueFundHoldings, assignedFundsMap]);

  const unassignedTotalValue = useMemo(() => {
    return unassignedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  }, [unassignedHoldings]);

  const totalPortfolioValue = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.currentValue, 0);
  }, [holdings]);

  const handleOpenCreate = (category?: GoalCategory) => {
    const cat = category || 'RETIREMENT';
    const currentYear = new Date().getFullYear();
    setFormData({
      name: cat === 'RETIREMENT' ? 'Retirement Corpus' : cat === 'EDUCATION' ? 'Child Higher Education' : cat === 'EMERGENCY' ? 'Emergency Fund' : 'New Financial Goal',
      category: cat,
      targetAmount: cat === 'RETIREMENT' ? 25000000 : cat === 'EDUCATION' ? 5000000 : cat === 'EMERGENCY' ? 600000 : 2000000,
      targetYear: cat === 'RETIREMENT' ? currentYear + 20 : cat === 'EDUCATION' ? currentYear + 10 : cat === 'EMERGENCY' ? currentYear + 1 : currentYear + 5,
      expectedCagr: cat === 'EMERGENCY' ? 7.0 : 12.0,
      monthlySip: cat === 'RETIREMENT' ? 20000 : cat === 'EDUCATION' ? 15000 : cat === 'EMERGENCY' ? 10000 : 10000,
      notes: ''
    });
    setEditingGoal(null);
    setIsCreatingNew(true);
  };

  const handleOpenEdit = (goal: PortfolioGoal) => {
    setFormData({
      name: goal.name,
      category: goal.category,
      targetAmount: goal.targetAmount,
      targetYear: goal.targetYear,
      expectedCagr: goal.expectedCagr,
      monthlySip: goal.monthlySip,
      notes: goal.notes || ''
    });
    setEditingGoal(goal);
    setIsCreatingNew(true);
  };

  const handleSaveGoal = () => {
    if (!formData.name.trim()) return;

    if (editingGoal) {
      // Update existing
      const updated = goals.map(g => g.id === editingGoal.id ? {
        ...g,
        name: formData.name,
        category: formData.category,
        targetAmount: formData.targetAmount,
        targetYear: formData.targetYear,
        expectedCagr: formData.expectedCagr,
        monthlySip: formData.monthlySip,
        notes: formData.notes
      } : g);
      setGoals(updated);
      saveStoredGoals(updated);
    } else {
      // Create new
      const newGoal: PortfolioGoal = {
        id: `goal_${Date.now()}`,
        name: formData.name,
        category: formData.category,
        targetAmount: formData.targetAmount,
        targetYear: formData.targetYear,
        expectedCagr: formData.expectedCagr,
        monthlySip: formData.monthlySip,
        allocatedHoldings: [],
        notes: formData.notes,
        createdAt: new Date().toISOString()
      };
      const updated = [newGoal, ...goals];
      setGoals(updated);
      saveStoredGoals(updated);
    }

    setIsCreatingNew(false);
    setEditingGoal(null);
  };

  // Perform confirmed deletion
  const handleConfirmDelete = () => {
    if (!deletingGoal) return;
    const updated = goals.filter(g => g.id !== deletingGoal.id);
    setGoals(updated);
    saveStoredGoals(updated);
    if (allocatingGoalId === deletingGoal.id) {
      setAllocatingGoalId(null);
    }
    setDeletingGoal(null);
  };

  // Reset Actions
  const handleClearAllBuckets = () => {
    setGoals([]);
    saveStoredGoals([]);
    setAllocatingGoalId(null);
    setIsResetModalOpen(false);
  };

  const handleLoadRecommendedTemplates = () => {
    const defaults = getDefaultPortfolioGoals(holdings);
    setGoals(defaults);
    saveStoredGoals(defaults);
    setAllocatingGoalId(null);
    setIsResetModalOpen(false);
  };

  /**
   * Enforce Fund Exclusivity:
   * When a fund is added or assigned to `targetGoalId`, it is automatically removed
   * from any other goal so it can never be in multiple buckets simultaneously.
   */
  const handleUpdateHoldingAllocation = (targetGoalId: string, schemeCode: string, percentage: number) => {
    const updated = goals.map(g => {
      if (g.id === targetGoalId) {
        // Update in target goal
        const existing = g.allocatedHoldings.filter(a => a.schemeCode !== schemeCode);
        if (percentage > 0) {
          existing.push({ schemeCode, percentage });
        }
        return { ...g, allocatedHoldings: existing };
      } else {
        // Enforce exclusivity: remove from all other goals
        const existing = g.allocatedHoldings.filter(a => a.schemeCode !== schemeCode);
        return { ...g, allocatedHoldings: existing };
      }
    });

    setGoals(updated);
    saveStoredGoals(updated);
  };

  // Analyze all goals
  const analyzedGoals = useMemo(() => {
    return goals.map(g => analyzeGoal(g, holdings));
  }, [goals, holdings]);

  // Overall Goals Summary
  const overallMetrics = useMemo(() => {
    let totalTarget = 0;
    let totalCurrentCorpus = 0;
    let totalMonthlySip = 0;
    let totalProjectedMaturity = 0;

    analyzedGoals.forEach(a => {
      totalTarget += a.goal.targetAmount;
      totalCurrentCorpus += a.currentValue;
      totalMonthlySip += a.goal.monthlySip;
      totalProjectedMaturity += a.projectedMaturityValue;
    });

    const overallProgress = totalTarget > 0 ? (totalCurrentCorpus / totalTarget) * 100 : 0;

    return {
      totalTarget,
      totalCurrentCorpus,
      totalMonthlySip,
      totalProjectedMaturity,
      overallProgress
    };
  }, [analyzedGoals]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              Goal-Based Bucketing & Glidepath Tracker
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Earmark mutual fund holdings exclusively to real-life financial milestones. Monitor automated age-based asset allocation glidepaths to protect compounding capital.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              id="reset-goals-strategy-btn"
              onClick={() => setIsResetModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer min-h-[40px]"
              title="Reset or manage bucketing strategies"
            >
              <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
              <span>Reset Strategy</span>
            </button>

            <button
              id="add-new-goal-btn"
              onClick={() => handleOpenCreate()}
              className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Goal Bucket</span>
            </button>
          </div>
        </div>

        {/* Aggregate Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-neutral-800/80">
          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Total Goal Targets</span>
            <span className="text-base sm:text-lg font-extrabold text-white font-mono mt-0.5 block">
              <PrivacyValue value={formatINR(overallMetrics.totalTarget, true)} />
            </span>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Earmarked Corpus</span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-400 font-mono mt-0.5 block">
              <PrivacyValue value={formatINR(overallMetrics.totalCurrentCorpus, true)} />
            </span>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Earmarked Monthly SIP</span>
            <span className="text-base sm:text-lg font-extrabold text-teal-400 font-mono mt-0.5 block">
              <PrivacyValue value={formatINR(overallMetrics.totalMonthlySip, true)} />/mo
            </span>
          </div>

          <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3.5">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Unassigned Portfolio</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-base sm:text-lg font-extrabold text-amber-400 font-mono">
                <PrivacyValue value={formatINR(unassignedTotalValue, true)} />
              </span>
              <span className="text-[10px] font-medium text-neutral-500">
                ({unassignedHoldings.length} fund{unassignedHoldings.length !== 1 ? 's' : ''} free)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Goal Cards List */}
      <div className="space-y-4">
        {analyzedGoals.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 sm:p-14 text-center">
            <Target className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">No Goal Buckets Configured Yet</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1 mb-6">
              Create your custom goal buckets to earmark specific mutual funds (e.g. Retirement, Children Education, Emergency Fund, Home Purchase) with exclusive one-to-one fund mapping and automated glidepath tracking.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => handleOpenCreate()}
                className="px-4 py-2.5 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition inline-flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create Custom Goal</span>
              </button>
              <button
                onClick={handleLoadRecommendedTemplates}
                className="px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Load Sample Strategy Templates</span>
              </button>
            </div>
          </div>
        ) : (
          analyzedGoals.map((ag) => {
            const { goal, currentValue, progressPct, targetDeficit, projectedMaturityValue, isFunded, requiredMonthlySip, additionalSipNeeded, currentAssetSplit, recommendedAssetSplit, remainingMonths } = ag;
            const config = CATEGORY_CONFIG[goal.category] || CATEGORY_CONFIG.CUSTOM;
            const yearsLeft = (remainingMonths / 12).toFixed(1);

            return (
              <div 
                key={goal.id} 
                className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700/80 rounded-2xl p-5 md:p-6 transition shadow-sm space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-neutral-800 flex items-center justify-center text-xl shrink-0 shadow-inner">
                      {config.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">{goal.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${config.bg} ${config.text}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 flex items-center gap-2 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        Target: <strong className="text-neutral-200">{goal.targetYear}</strong> ({yearsLeft} years / {remainingMonths} mos remaining)
                        <span>•</span>
                        Expected CAGR: <strong className="text-emerald-400">{goal.expectedCagr}%</strong>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      id={`link-funds-btn-${goal.id}`}
                      onClick={() => setAllocatingGoalId(allocatingGoalId === goal.id ? null : goal.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 cursor-pointer min-h-[36px] ${
                        allocatingGoalId === goal.id
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                      }`}
                      title="Assign mutual fund holdings exclusively to this goal"
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{goal.allocatedHoldings.length > 0 ? `${goal.allocatedHoldings.length} Fund${goal.allocatedHoldings.length !== 1 ? 's' : ''} Linked` : 'Link Funds'}</span>
                    </button>

                    <button
                      id={`edit-goal-btn-${goal.id}`}
                      onClick={() => handleOpenEdit(goal)}
                      className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                      title="Edit Goal"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      id={`delete-goal-btn-${goal.id}`}
                      onClick={() => setDeletingGoal(goal)}
                      className="p-2 text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 rounded-lg transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                      title="Delete Goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Amount Row */}
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-end text-xs">
                    <div>
                      <span className="text-neutral-400 block text-[11px]">Accumulated Corpus</span>
                      <strong className="text-lg font-bold text-white font-mono">
                        <PrivacyValue value={formatINR(currentValue, true)} />
                      </strong>
                    </div>

                    <div className="text-right">
                      <span className="text-neutral-400 block text-[11px]">Target Corpus ({progressPct.toFixed(1)}% Achieved)</span>
                      <strong className="text-lg font-bold text-neutral-200 font-mono">
                        <PrivacyValue value={formatINR(goal.targetAmount, true)} />
                      </strong>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden p-0.5 flex">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        progressPct >= 100 ? 'bg-emerald-400' : progressPct >= 60 ? 'bg-teal-400' : progressPct >= 30 ? 'bg-indigo-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(progressPct, 2))}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-neutral-400">
                    <span>Deficit: <strong className="text-neutral-200 font-mono"><PrivacyValue value={formatINR(targetDeficit, true)} /></strong></span>
                    <span>Monthly SIP: <strong className="text-teal-400 font-mono"><PrivacyValue value={formatINR(goal.monthlySip)} /></strong></span>
                  </div>
                </div>

                {/* Glidepath & Projection Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {/* Glidepath Advice Card */}
                  <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-indigo-400" />
                        Asset Allocation Glidepath
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        recommendedAssetSplit.riskStatus === 'OPTIMAL'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : recommendedAssetSplit.riskStatus === 'TOO_AGGRESSIVE'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {recommendedAssetSplit.riskStatus === 'OPTIMAL' ? '✓ Glidepath Optimal' : recommendedAssetSplit.riskStatus === 'TOO_AGGRESSIVE' ? '⚠️ High Equity Volatility' : '⚠️ Conservative Drag'}
                      </span>
                    </div>

                    {/* Compare Splits */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800/80">
                        <span className="text-[10px] text-neutral-400 block">Current Linked Mix</span>
                        <div className="flex items-center gap-2 mt-0.5 font-mono font-bold text-xs">
                          <span className="text-indigo-400">{currentAssetSplit.equityPct.toFixed(0)}% Eq</span>
                          <span className="text-neutral-500">/</span>
                          <span className="text-emerald-400">{currentAssetSplit.debtPct.toFixed(0)}% Debt</span>
                        </div>
                      </div>

                      <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800/80">
                        <span className="text-[10px] text-neutral-400 block">Target Glidepath</span>
                        <div className="flex items-center gap-2 mt-0.5 font-mono font-bold text-xs">
                          <span className="text-indigo-400">{recommendedAssetSplit.equityPct}% Eq</span>
                          <span className="text-neutral-500">/</span>
                          <span className="text-emerald-400">{recommendedAssetSplit.debtPct}% Debt</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-400 leading-snug">
                      {recommendedAssetSplit.rationale}
                    </p>
                  </div>

                  {/* Future Compounding & SIP Guidance */}
                  <div className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-teal-400" />
                          Projected Maturity Value
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isFunded ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {isFunded ? '✓ On Track' : '⚡ SIP Gap Detected'}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 mt-1.5">
                        <span className="text-base font-bold font-mono text-emerald-400">
                          <PrivacyValue value={formatINR(projectedMaturityValue, true)} />
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          {isFunded ? `(Surplus of ${formatINR(projectedMaturityValue - goal.targetAmount, true)})` : `(Deficit of ${formatINR(goal.targetAmount - projectedMaturityValue, true)})`}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-800 text-[11px] text-neutral-300">
                      {additionalSipNeeded > 0 ? (
                        <div className="flex items-center gap-1.5 text-amber-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Increase SIP by <strong className="font-mono text-white"><PrivacyValue value={formatINR(additionalSipNeeded)} />/mo</strong> (Total: <PrivacyValue value={formatINR(requiredMonthlySip)} />) to hit target by {goal.targetYear}.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Current SIP of <PrivacyValue value={formatINR(goal.monthlySip)} />/mo is fully sufficient to achieve this goal by {goal.targetYear}.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Linked Holdings Panel (Expanded) */}
                {allocatingGoalId === goal.id && (
                  <div className="mt-4 pt-4 border-t border-neutral-800 bg-neutral-950/80 p-4 rounded-xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <Layers className="w-4 h-4 text-emerald-400" />
                          Assign Portfolio Holdings Exclusively to "{goal.name}"
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Funds linked here are strictly reserved for this bucket. Reassigning a fund automatically moves it from any other bucket.
                        </p>
                      </div>
                      <button
                        onClick={() => setAllocatingGoalId(null)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition cursor-pointer"
                      >
                        Done
                      </button>
                    </div>

                    {uniqueFundHoldings.length === 0 ? (
                      <p className="text-xs text-neutral-500 py-3">No portfolio holdings found. Please import your CAS statement first.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                        {uniqueFundHoldings.map((h) => {
                          const isAllocatedToThisGoal = goal.allocatedHoldings.some(a => a.schemeCode === h.schemeCode && a.percentage > 0);
                          const otherGoalAssignment = assignedFundsMap.get(h.schemeCode);
                          const isAllocatedToOtherGoal = !isAllocatedToThisGoal && !!otherGoalAssignment;

                          return (
                            <div 
                              key={h.schemeCode} 
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 transition ${
                                isAllocatedToThisGoal 
                                  ? 'bg-emerald-950/30 border-emerald-500/50 shadow-sm' 
                                  : isAllocatedToOtherGoal
                                  ? 'bg-neutral-900/60 border-neutral-800/80 opacity-80'
                                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-semibold text-white block truncate text-[11px]">{h.schemeName}</span>
                                <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono mt-0.5">
                                  <span>{formatINR(h.currentValue, true)}</span>
                                  <span>•</span>
                                  <span className="truncate">{h.category}</span>
                                  {h.folios.length > 1 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-neutral-500">{h.folios.length} folios</span>
                                    </>
                                  )}
                                </div>
                                {isAllocatedToOtherGoal && (
                                  <span className="inline-block text-[10px] text-amber-400/90 font-medium mt-1">
                                    Currently in: {otherGoalAssignment.goalName}
                                  </span>
                                )}
                              </div>

                              <div className="shrink-0">
                                {isAllocatedToThisGoal ? (
                                  <button
                                    onClick={() => handleUpdateHoldingAllocation(goal.id, h.schemeCode, 0)}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 transition cursor-pointer"
                                    title="Unassign fund from this goal"
                                  >
                                    Unassign
                                  </button>
                                ) : isAllocatedToOtherGoal ? (
                                  <button
                                    onClick={() => handleUpdateHoldingAllocation(goal.id, h.schemeCode, 100)}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition cursor-pointer flex items-center gap-1"
                                    title={`Move exclusively from "${otherGoalAssignment.goalName}" to "${goal.name}"`}
                                  >
                                    <ArrowRightLeft className="w-3 h-3" />
                                    <span>Move Here</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateHoldingAllocation(goal.id, h.schemeCode, 100)}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500 text-neutral-950 hover:bg-emerald-400 transition cursor-pointer shadow-sm"
                                    title="Assign 100% of this fund to this goal"
                                  >
                                    + Assign Fund
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* IN-APP MODAL: Delete Goal Confirmation Dialog (Guaranteed functional, no window.confirm) */}
      {deletingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Goal Bucket?</h3>
                <p className="text-xs text-neutral-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/50 p-3.5 rounded-xl border border-neutral-800/80">
              Are you sure you want to delete <strong className="text-white">"{deletingGoal.name}"</strong>? 
              {deletingGoal.allocatedHoldings.length > 0 && (
                <span className="block mt-1 text-emerald-400">
                  All {deletingGoal.allocatedHoldings.length} linked mutual fund holdings will automatically be returned to your unassigned portfolio pool.
                </span>
              )}
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingGoal(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl cursor-pointer transition min-h-[38px]"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-goal-btn"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl cursor-pointer transition shadow-sm shadow-rose-900/30 min-h-[38px]"
              >
                Yes, Delete Bucket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: Reset Bucketing Strategy Options (Guaranteed functional, no window.confirm) */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-400" />
                Reset Bucketing Strategy
              </h3>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Choose how you would like to reset or reconfigure your mutual fund goal buckets:
            </p>

            <div className="space-y-3 pt-1">
              {/* Option 1: Clear All to Start Clean */}
              <button
                id="clear-all-goals-btn"
                onClick={handleClearAllBuckets}
                className="w-full text-left p-3.5 rounded-xl border border-neutral-800 bg-neutral-950 hover:border-neutral-700 hover:bg-neutral-800/60 transition cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-white group-hover:text-rose-400 transition">
                    Clear All Buckets (Start Fresh)
                  </span>
                  <Trash2 className="w-4 h-4 text-neutral-500 group-hover:text-rose-400" />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                  Removes all existing goal buckets. All mutual funds become unassigned so you can construct a fresh custom bucketing layout from scratch.
                </p>
              </button>

              {/* Option 2: Load Sample Strategy Templates */}
              <button
                id="load-sample-strategy-btn"
                onClick={handleLoadRecommendedTemplates}
                className="w-full text-left p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50 hover:bg-emerald-950/30 transition cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-emerald-300">
                    Load Recommended Strategy Templates
                  </span>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                  Re-populates standard life milestones: Retirement Corpus (2045), Child Higher Education, and Emergency Reserve (12M buffer).
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-800">
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog for Add / Edit Goal */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              {editingGoal ? 'Edit Financial Goal' : 'Define New Goal & Glidepath'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 font-medium block mb-1">Goal Name</label>
                <input
                  id="goal-form-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Retirement 2045, Harvard Master's..."
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 min-h-[40px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 font-medium block mb-1">Category</label>
                  <select
                    id="goal-form-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as GoalCategory })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 min-h-[40px]"
                  >
                    <option value="RETIREMENT">Retirement & FIRE</option>
                    <option value="EDUCATION">Child Higher Education</option>
                    <option value="EMERGENCY">Emergency Fund</option>
                    <option value="PROPERTY">House / Real Estate</option>
                    <option value="WEALTH">Wealth Compounding</option>
                    <option value="VEHICLE">Car / Vehicle</option>
                    <option value="TRAVEL">Dream Vacation</option>
                    <option value="CUSTOM">Custom Goal</option>
                  </select>
                </div>

                <div>
                  <label className="text-neutral-400 font-medium block mb-1">Target Year</label>
                  <input
                    id="goal-form-year"
                    type="number"
                    min={new Date().getFullYear()}
                    max={new Date().getFullYear() + 45}
                    value={formData.targetYear}
                    onChange={(e) => setFormData({ ...formData, targetYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 min-h-[40px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 font-medium block mb-1">Target Corpus (₹)</label>
                  <input
                    id="goal-form-target-amount"
                    type="number"
                    step="50000"
                    value={formData.targetAmount}
                    onChange={(e) => setFormData({ ...formData, targetAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 min-h-[40px]"
                  />
                </div>

                <div>
                  <label className="text-neutral-400 font-medium block mb-1">Expected CAGR (%)</label>
                  <input
                    id="goal-form-cagr"
                    type="number"
                    step="0.5"
                    min="1"
                    max="25"
                    value={formData.expectedCagr}
                    onChange={(e) => setFormData({ ...formData, expectedCagr: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 min-h-[40px]"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 font-medium block mb-1">Current Monthly SIP for this Goal (₹)</label>
                <input
                  id="goal-form-monthly-sip"
                  type="number"
                  step="1000"
                  value={formData.monthlySip}
                  onChange={(e) => setFormData({ ...formData, monthlySip: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500 min-h-[40px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setIsCreatingNew(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white bg-neutral-800 rounded-xl cursor-pointer min-h-[38px]"
              >
                Cancel
              </button>
              <button
                id="goal-form-save-btn"
                onClick={handleSaveGoal}
                className="px-4 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl cursor-pointer min-h-[38px]"
              >
                {editingGoal ? 'Save Changes' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
