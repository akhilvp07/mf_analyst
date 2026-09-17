import { PortfolioGoal, GoalAnalysisResult, PortfolioHolding } from '../types';
import { isEquityOrientedScheme } from './financialCalculations';

const STORAGE_KEY_GOALS = 'mftracker_portfolio_goals_v1';

/**
 * Default sample goals initialized if user has no saved goals yet
 */
export function getDefaultPortfolioGoals(holdings: PortfolioHolding[] = []): PortfolioGoal[] {
  const currentYear = new Date().getFullYear();

  // Pick some holdings if available
  const sampleAllocations: { schemeCode: string; percentage: number }[] = [];
  if (holdings.length > 0) {
    holdings.slice(0, 3).forEach(h => {
      sampleAllocations.push({ schemeCode: h.schemeCode, percentage: 100 });
    });
  }

  return [
    {
      id: 'goal_retirement',
      name: 'Retirement Corpus 2045',
      category: 'RETIREMENT',
      targetAmount: 30000000, // ₹3.0 Cr
      targetYear: currentYear + 19,
      expectedCagr: 12.0,
      monthlySip: 25000,
      allocatedHoldings: sampleAllocations,
      notes: 'Long-term financial independence corpus aiming for inflation-protected passive cashflow.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'goal_education',
      name: 'Child Higher Education',
      category: 'EDUCATION',
      targetAmount: 5000000, // ₹50 Lakhs
      targetYear: currentYear + 10,
      expectedCagr: 11.5,
      monthlySip: 15000,
      allocatedHoldings: [],
      notes: 'Undergraduate and postgraduate overseas education fund.',
      createdAt: new Date().toISOString()
    },
    {
      id: 'goal_emergency',
      name: 'Emergency Reserve (12M)',
      category: 'EMERGENCY',
      targetAmount: 600000, // ₹6 Lakhs
      targetYear: currentYear + 1,
      expectedCagr: 7.0,
      monthlySip: 10000,
      allocatedHoldings: [],
      notes: 'Liquid and short-duration buffer to cover 12 months of living expenses.',
      createdAt: new Date().toISOString()
    }
  ];
}

/**
 * Load goals from localStorage. Defaults to an empty list unless the user explicitly creates or loads goals.
 */
export function loadStoredGoals(holdings: PortfolioHolding[] = []): PortfolioGoal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GOALS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Upgrade any legacy goals to 100% allocation per linked fund
        return parsed.map((g: PortfolioGoal) => ({
          ...g,
          allocatedHoldings: (g.allocatedHoldings || []).map(a => ({
            ...a,
            percentage: 100
          }))
        }));
      }
    }
  } catch (err) {
    console.warn('Failed to load goals from localStorage:', err);
  }
  return [];
}

/**
 * Save goals to localStorage
 */
export function saveStoredGoals(goals: PortfolioGoal[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(goals));
  } catch (err) {
    console.warn('Failed to save goals:', err);
  }
}

/**
 * Calculate recommended Asset Split Glidepath based on years remaining and goal category
 */
export function getRecommendedGlidepath(yearsRemaining: number, category: string): {
  equityPct: number;
  debtPct: number;
  rationale: string;
} {
  if (category === 'EMERGENCY') {
    return {
      equityPct: 5,
      debtPct: 95,
      rationale: 'Emergency funds must remain safe from equity drawdown; prioritize 95%+ Debt/Liquid.'
    };
  }

  if (yearsRemaining >= 10) {
    return {
      equityPct: 80,
      debtPct: 20,
      rationale: 'Long runway (>10 years): High equity allocation (80%) maximizes compounding and inflation-beating alpha.'
    };
  } else if (yearsRemaining >= 7) {
    return {
      equityPct: 70,
      debtPct: 30,
      rationale: 'Medium-long horizon (7-10 years): Balanced growth with 70% Equity and 30% Debt ballast.'
    };
  } else if (yearsRemaining >= 4) {
    return {
      equityPct: 50,
      debtPct: 50,
      rationale: 'Intermediate horizon (4-7 years): Progressive de-risking (50:50) to protect accumulated gains.'
    };
  } else if (yearsRemaining >= 2) {
    return {
      equityPct: 30,
      debtPct: 70,
      rationale: 'Near-term maturity (2-4 years): Capital preservation mode. Shift heavily into low-volatility Debt.'
    };
  } else {
    return {
      equityPct: 10,
      debtPct: 90,
      rationale: 'Imminent withdrawal (<2 years): Shield capital from market swings. Maintain 90% Liquid/Debt.'
    };
  }
}

/**
 * Future value and required SIP calculation
 */
export function analyzeGoal(goal: PortfolioGoal, holdings: PortfolioHolding[]): GoalAnalysisResult {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const targetMonth = goal.targetMonth || 12;
  
  const totalMonthsRemaining = Math.max(
    1,
    (goal.targetYear - currentYear) * 12 + (targetMonth - currentMonth)
  );
  const yearsRemaining = totalMonthsRemaining / 12;

  // Group holdings by schemeCode (handling multi-folio holdings for the same scheme)
  const holdingsByScheme = new Map<string, PortfolioHolding[]>();
  holdings.forEach(h => {
    const code = (h.schemeCode || '').trim();
    const list = holdingsByScheme.get(code) || [];
    list.push(h);
    holdingsByScheme.set(code, list);
  });

  let goalCurrentValue = 0;
  let goalInvestedAmount = 0;
  let totalEquityVal = 0;
  let totalDebtVal = 0;
  let totalHybridVal = 0;
  let totalGoldVal = 0;

  goal.allocatedHoldings.forEach(alloc => {
    const code = (alloc.schemeCode || '').trim();
    let matchingHoldings = holdingsByScheme.get(code) || [];

    // Fallback matching by schemeName or ISIN if schemeCode string changed slightly
    if (matchingHoldings.length === 0) {
      matchingHoldings = holdings.filter(h => 
        (h.schemeName && code && h.schemeName.toLowerCase() === code.toLowerCase()) ||
        (h.isin && code && h.isin.toLowerCase() === code.toLowerCase())
      );
    }

    matchingHoldings.forEach(h => {
      // In mutually exclusive goal bucketing, 100% of the allocated fund belongs to the goal
      const share = alloc.percentage > 0 ? (alloc.percentage <= 0 ? 0 : 1.0) : 0;
      const currVal = h.currentValue * share;
      const invVal = h.investedAmount * share;

      goalCurrentValue += currVal;
      goalInvestedAmount += invVal;

      const catLower = (h.category || '').toLowerCase();
      if (isEquityOrientedScheme(h.category, h.schemeName)) {
        if (catLower.includes('hybrid') || catLower.includes('balanced')) {
          totalHybridVal += currVal;
          totalEquityVal += currVal * 0.65;
          totalDebtVal += currVal * 0.35;
        } else {
          totalEquityVal += currVal;
        }
      } else if (catLower.includes('gold') || catLower.includes('silver') || catLower.includes('commodity')) {
        totalGoldVal += currVal;
      } else {
        totalDebtVal += currVal;
      }
    });
  });

  const totalGain = goalCurrentValue - goalInvestedAmount;
  const totalGainPct = goalInvestedAmount > 0 ? (totalGain / goalInvestedAmount) * 100 : 0;
  const progressPct = goal.targetAmount > 0 ? Math.min(100, (goalCurrentValue / goal.targetAmount) * 100) : 0;
  const targetDeficit = Math.max(0, goal.targetAmount - goalCurrentValue);

  // Asset Split percentages
  const totalAssetVal = goalCurrentValue > 0 ? goalCurrentValue : 1;
  const currentAssetSplit = {
    equityPct: (totalEquityVal / totalAssetVal) * 100,
    debtPct: (totalDebtVal / totalAssetVal) * 100,
    hybridPct: (totalHybridVal / totalAssetVal) * 100,
    goldPct: (totalGoldVal / totalAssetVal) * 100,
    cashPct: Math.max(0, 100 - (totalEquityVal + totalDebtVal + totalGoldVal) / totalAssetVal * 100)
  };

  // Glidepath recommendation
  const glidepath = getRecommendedGlidepath(yearsRemaining, goal.category);
  
  let riskStatus: 'OPTIMAL' | 'TOO_AGGRESSIVE' | 'TOO_CONSERVATIVE' = 'OPTIMAL';
  if (goalCurrentValue > 0) {
    if (currentAssetSplit.equityPct > glidepath.equityPct + 18) {
      riskStatus = 'TOO_AGGRESSIVE';
    } else if (currentAssetSplit.equityPct < glidepath.equityPct - 25 && goal.category !== 'EMERGENCY') {
      riskStatus = 'TOO_CONSERVATIVE';
    }
  }

  // Compound Interest Calculation
  const annualRate = Math.max(0.01, goal.expectedCagr / 100);
  const monthlyRate = annualRate / 12;
  const n = totalMonthsRemaining;

  // FV of current corpus
  const fvLumpsum = goalCurrentValue * Math.pow(1 + monthlyRate, n);

  // FV of monthly SIP: PMT * [((1 + r)^n - 1) / r] * (1 + r)
  const sipMultiplier = ((Math.pow(1 + monthlyRate, n) - 1) / monthlyRate) * (1 + monthlyRate);
  const fvSip = goal.monthlySip * sipMultiplier;

  const projectedMaturityValue = Math.round(fvLumpsum + fvSip);
  const isFunded = projectedMaturityValue >= goal.targetAmount;
  const shortfallOrSurplus = projectedMaturityValue - goal.targetAmount;

  // Required Monthly SIP to hit target
  let requiredMonthlySip = 0;
  const neededFromSip = Math.max(0, goal.targetAmount - fvLumpsum);
  if (neededFromSip > 0 && sipMultiplier > 0) {
    requiredMonthlySip = Math.round(neededFromSip / sipMultiplier);
  }

  const additionalSipNeeded = Math.max(0, requiredMonthlySip - goal.monthlySip);

  return {
    goal,
    currentValue: goalCurrentValue,
    investedAmount: goalInvestedAmount,
    gain: totalGain,
    gainPct: totalGainPct,
    progressPct,
    remainingMonths: totalMonthsRemaining,
    targetDeficit,
    projectedMaturityValue,
    isFunded,
    shortfallOrSurplus,
    requiredMonthlySip,
    additionalSipNeeded,
    currentAssetSplit,
    recommendedAssetSplit: {
      ...glidepath,
      riskStatus
    }
  };
}
