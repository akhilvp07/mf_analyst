export interface MutualFundScheme {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: 'Equity - Flexi Cap' | 'Equity - Large Cap' | 'Equity - Mid Cap' | 'Equity - Small Cap' | 'Debt - Liquid' | 'Hybrid - Aggressive' | 'Debt - Short Duration' | 'Equity - ELSS' | 'Index Fund';
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

export interface MarketCapAllocation {
  largeCap: number;
  midCap: number;
  smallCap: number;
}

export interface SectorExposure {
  sector: string;
  percentage: number;
  value: number;
}

export interface StockHoldingExposure {
  stockName: string;
  ticker: string;
  sector: string;
  percentage: number;
  value: number;
  fundsHolding: string[];
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

export interface QueryPlanStep {
  nodeType: string;
  relationName?: string;
  indexName?: string;
  indexCond?: string;
  filter?: string;
  startupCost: number;
  totalCost: number;
  planRows: number;
  planWidth: number;
  actualStartupTime: number;
  actualTotalTime: number;
  actualRows: number;
  actualLoops: number;
  sharedHitBlocks: number;
  sharedReadBlocks: number;
  heapFetches?: number;
  bottlenecks?: string[];
  children?: QueryPlanStep[];
}

export interface QueryScenario {
  id: string;
  title: string;
  description: string;
  businessCase: string;
  querySql: string;
  datasetSize: string;
  unindexed: {
    plan: QueryPlanStep;
    executionTimeMs: number;
    planningTimeMs: number;
    sharedHitBuffers: number;
    sharedReadBuffers: number;
    heapFetches: number;
    diskIoKb: number;
    bottlenecks: string[];
  };
  indexed: {
    indexDdl: string;
    indexType: string;
    plan: QueryPlanStep;
    executionTimeMs: number;
    planningTimeMs: number;
    sharedHitBuffers: number;
    sharedReadBuffers: number;
    heapFetches: number;
    diskIoKb: number;
    speedupFactor: number;
    optimizationsUsed: string[];
  };
}

export interface CodeSnippet {
  id: string;
  title: string;
  category: 'Frontend Virtualization' | 'API & Cursor Pagination' | 'Database Indexing' | 'Advanced Timescale & Partitioning' | 'Google Cloud Run Hosting';
  filename: string;
  language: string;
  code: string;
  explanation: string;
  keyBenefits: string[];
}

export interface BenchmarkMetrics {
  renderTimeMs: number;
  domNodesCount: number;
  fps: number;
  memoryEstimateMb: number;
  datasetSize: number;
  mode: 'naive' | 'virtualized' | 'infinite';
}
