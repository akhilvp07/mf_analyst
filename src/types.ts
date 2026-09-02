export interface MutualFundScheme {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: 'Equity - Flexi Cap' | 'Equity - Large Cap' | 'Equity - Mid Cap' | 'Equity - Small Cap' | 'Equity - Large & Mid Cap' | 'Debt - Liquid' | 'Hybrid - Aggressive' | 'Debt - Short Duration' | 'Equity - ELSS' | 'Index Fund';
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

export interface RebalanceReport {
  assetClassItems: RebalanceItem[];
  marketCapItems: RebalanceItem[];
  totalPortfolioValue: number;
  inflowAmount: number;
  rebalanceMode: 'SIP_INFLOW' | 'DIRECT_REALIGNMENT';
  totalRebalanceRequired: number;
  isAligned: boolean;
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

