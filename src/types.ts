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

