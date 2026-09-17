export interface MutualFundScheme {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: 'Equity - Flexi Cap' | 'Equity - Large Cap' | 'Equity - Mid Cap' | 'Equity - Small Cap' | 'Equity - Large & Mid Cap' | 'Debt - Liquid' | 'Hybrid - Aggressive' | 'Debt - Short Duration' | 'Equity - ELSS' | 'Index Fund' | 'Gold & Commodities' | string;
  planType?: 'Direct' | 'Regular';
  optionType?: 'Growth' | 'IDCW';
  currentNav: number;
  navDate: string;
  navChange1D: number;
  cagr3Y: number;
  cagr5Y: number;
  aumCr: number;
  expenseRatio: number;
  isin: string;
}

export interface NavRecord {
  id: number;
  schemeCode: string;
  navDate: string;
  nav: number;
  repurchasePrice?: number;
  salePrice?: number;
}

export type TransactionType = 'SIP' | 'LUMPSUM' | 'REDEMPTION' | 'SWITCH_IN' | 'SWITCH_OUT' | 'DIVIDEND_REINVEST';

export interface TransactionRecord {
  id: string;
  folioNumber: string;
  schemeCode: string;
  schemeName: string;
  planType?: 'Direct' | 'Regular';
  optionType?: 'Growth' | 'IDCW';
  type: TransactionType;
  date: string; // YYYY-MM-DD
  units: number;
  nav: number;
  amount: number;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  notes?: string;
}

export interface PortfolioHolding {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  planType?: 'Direct' | 'Regular';
  optionType?: 'Growth' | 'IDCW';
  folioNumber: string;
  isin?: string;
  units: number;
  avgBuyNav: number;
  currentNav: number;
  navDate: string;
  navChange1D: number;
  investedAmount: number;
  currentValue: number;
  totalGain: number;
  totalGainPercentage: number;
  dayGain: number;
  dayGainPercentage: number;
  xirr: number;
  allocationPercentage: number;
  transactionsCount: number;
  lastTransactionDate: string;
}

export interface PortfolioSummary {
  totalCurrentValue: number;
  totalInvestedAmount: number;
  totalGain: number;
  totalGainPercentage: number;
  dayGain: number;
  dayGainPercentage: number;
  xirr: number;
  holdingsCount: number;
  folionsCount: number;
  transactionsCount: number;
  lastUpdated: string;
}

export interface AssetAllocation {
  equity: number;
  debt: number;
  hybrid: number;
  gold: number;
  cash: number;
}

export interface CategoryAllocation {
  category: string;
  value: number;
  percentage: number;
  schemesCount: number;
}

export interface AmcAllocation {
  fundHouse: string;
  value: number;
  percentage: number;
  schemesCount: number;
}

export interface PortfolioConcentration {
  topHoldingWeight: number;
  top3HoldingsWeight: number;
  directPlanPercentage: number;
  regularPlanPercentage: number;
  growthOptionPercentage: number;
  idcwOptionPercentage: number;
  hhiScore: number;
}

export interface TaxComputation {
  financialYear: string;
  equityLtcg: {
    grossGain: number;
    exemptLimit: number;
    taxableGain: number;
    taxRate: number; // 12.5%
    taxPayable: number;
  };
  equityStcg: {
    grossGain: number;
    taxRate: number; // 20%
    taxPayable: number;
  };
  debtGains: {
    grossGain: number;
    taxRateEstimated: number; // slab approx 30%
    taxPayable: number;
  };
  totalEstimatedTax: number;
  unrealizedLtcg: number;
  unrealizedStcg: number;
  taxHarvestingOpportunity: number;
}

export interface AllocationStrategy {
  id: string;
  name: string;
  description: string;
  // Asset class percentages (sum = 100)
  equity: number;
  debt: number;
  gold: number;
  cash: number;
  // Equity market cap sub-percentages (sum = 100)
  largeCap: number;
  midCap: number;
  smallCap: number;
}

export interface MarketCapAllocation {
  largeCap: number;
  midCap: number;
  smallCap: number;
  largeCapValue: number;
  midCapValue: number;
  smallCapValue: number;
  totalEquityValue: number;
}

export interface RebalanceItem {
  name: string;
  category: 'Asset Class' | 'Market Cap';
  currentValue: number;
  currentPct: number;
  targetPct: number;
  targetValue: number;
  driftPct: number; // currentPct - targetPct
  actionType: 'BUY' | 'SELL' | 'BALANCED';
  deltaAmount: number; // positive = buy, negative = sell
  sipAllocAmount: number; // allocated share of fresh SIP/inflow
  sipAllocPct: number;
  status: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'ALIGNED';
}

export interface SchemeSipRecommendation {
  schemeCode: string;
  schemeName: string;
  category: string;
  currentValue: number;
  primaryRole: 'Large Cap Anchor' | 'Mid Cap Growth' | 'Small Cap Alpha' | 'Flexi / Multi Cap Core';
  recommendedSip: number;
  sipSharePct: number;
  rationale: string;
  largeCapPct: number;
  midCapPct: number;
  smallCapPct: number;
  projected12mAddition: number;
}

export interface RebalanceReport {
  assetClassItems: RebalanceItem[];
  marketCapItems: RebalanceItem[];
  schemeSipRecommendations: SchemeSipRecommendation[];
  totalPortfolioValue: number;
  inflowAmount: number;
  rebalanceMode: 'SIP_INFLOW' | 'DIRECT_REALIGNMENT';
  totalRebalanceRequired: number;
  isAligned: boolean;
  horizonMonths: number;
  projectedEquityValue: number;
  projectedMarketCap: {
    largeCap: number;
    midCap: number;
    smallCap: number;
    largeCapVal: number;
    midCapVal: number;
    smallCapVal: number;
  };
  manualRebalanceNotes: {
    assetName: string;
    action: 'ADD' | 'TRIM' | 'ALIGNED';
    amount: number;
    explanation: string;
  }[];
}

export interface AiPortfolioInsight {
  score: number;
  grade: string;
  executiveSummary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  rebalanceAdvice: string;
  rawMarkdown?: string;
  timestamp: string;
}

export interface FundMarketCapSplit {
  largeCap: number; // 0-100%
  midCap: number;   // 0-100%
  smallCap: number; // 0-100%
}

export type GoalCategory = 
  | 'RETIREMENT' 
  | 'EDUCATION' 
  | 'EMERGENCY' 
  | 'WEALTH' 
  | 'PROPERTY' 
  | 'VEHICLE' 
  | 'TRAVEL' 
  | 'CUSTOM';

export interface GoalHoldingAllocation {
  schemeCode: string;
  schemeName?: string;
  percentage: number; // 0 to 100% of this holding allocated to this goal
}

export interface PortfolioGoal {
  id: string;
  name: string;
  category: GoalCategory;
  targetAmount: number;
  targetYear: number;
  targetMonth?: number;
  expectedCagr: number; // e.g. 12%
  monthlySip: number;   // current monthly SIP earmarked for this goal
  allocatedHoldings: GoalHoldingAllocation[];
  notes?: string;
  createdAt: string;
}

export interface GoalAnalysisResult {
  goal: PortfolioGoal;
  currentValue: number;
  investedAmount: number;
  gain: number;
  gainPct: number;
  progressPct: number;
  remainingMonths: number;
  targetDeficit: number;
  projectedMaturityValue: number;
  isFunded: boolean;
  shortfallOrSurplus: number;
  requiredMonthlySip: number;
  additionalSipNeeded: number;
  currentAssetSplit: {
    equityPct: number;
    debtPct: number;
    hybridPct: number;
    goldPct: number;
    cashPct: number;
  };
  recommendedAssetSplit: {
    equityPct: number;
    debtPct: number;
    rationale: string;
    riskStatus: 'OPTIMAL' | 'TOO_AGGRESSIVE' | 'TOO_CONSERVATIVE';
  };
}

export interface CapitalGainsAuditRow {
  id: string;
  isin: string;
  schemeCode: string;
  schemeName: string;
  folioNumber: string;
  assetClass: 'EQUITY' | 'DEBT' | 'HYBRID' | 'OTHER';
  holdingPeriodDays: number;
  gainType: 'LTCG' | 'STCG' | 'DEBT_SLAB';
  purchaseDate: string;
  sellDate: string; // or valuation date for unrealized
  isRealized: boolean;
  units: number;
  buyNav: number;
  sellNav: number;
  purchaseCost: number;
  saleValue: number;
  grossGain: number;
  fmv2018Nav?: number;
  taxableGain: number;
  applicableTaxRatePct: number;
  estimatedTax: number;
}

