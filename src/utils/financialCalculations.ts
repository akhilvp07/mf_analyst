import {
  TransactionRecord,
  PortfolioHolding,
  PortfolioSummary,
  MutualFundScheme,
  AssetAllocation,
  MarketCapAllocation,
  SectorExposure,
  StockHoldingExposure,
  TaxComputation
} from '../types';

/**
 * High-precision XIRR calculation using Newton-Raphson method with adaptive damping and bisection fallback.
 * cashflows: array of { date: Date, amount: number }
 * (investments/purchases are negative, current value or redemption is positive)
 */
export function calculateXirr(
  cashflows: { date: Date; amount: number }[],
  guess: number = 0.1
): number {
  if (!cashflows || cashflows.length < 2) return 0;

  // Filter out zero amount flows
  const validFlows = cashflows.filter(f => f.amount !== 0 && !isNaN(f.amount));
  if (validFlows.length < 2) return 0;

  // Must have at least one positive and one negative cashflow
  const hasPositive = validFlows.some(f => f.amount > 0);
  const hasNegative = validFlows.some(f => f.amount < 0);
  if (!hasPositive || !hasNegative) return 0;

  const minDate = new Date(Math.min(...validFlows.map(f => f.date.getTime())));

  // Calculate year fraction from minDate
  const flows = validFlows.map(f => ({
    years: (f.date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    amount: f.amount
  }));

  const npv = (rate: number): number => {
    let sum = 0;
    for (const f of flows) {
      if (1 + rate <= 0) return NaN;
      sum += f.amount / Math.pow(1 + rate, f.years);
    }
    return sum;
  };

  const derivativeNpv = (rate: number): number => {
    let sum = 0;
    for (const f of flows) {
      if (1 + rate <= 0) return NaN;
      sum += (-f.years * f.amount) / Math.pow(1 + rate, f.years + 1);
    }
    return sum;
  };

  let rate = guess;
  const maxIterations = 100;
  const tolerance = 1e-6;

  // 1. Newton-Raphson
  for (let i = 0; i < maxIterations; i++) {
    const val = npv(rate);
    if (isNaN(val)) break;
    if (Math.abs(val) < tolerance) {
      return rate * 100; // return as percentage
    }
    const deriv = derivativeNpv(rate);
    if (isNaN(deriv) || Math.abs(deriv) < 1e-10) break;

    const nextRate = rate - val / deriv;
    if (nextRate <= -0.99) {
      rate = (rate - 0.99) / 2;
    } else {
      rate = nextRate;
    }
  }

  // 2. Fallback: Bisection search between -90% and +500%
  let low = -0.90;
  let high = 5.0;
  let npvLow = npv(low);
  let npvHigh = npv(high);

  if (isNaN(npvLow) || isNaN(npvHigh) || npvLow * npvHigh > 0) {
    // If bisection range bracket doesn't cross zero, compute simple CAGR
    const totalInvested = Math.abs(validFlows.filter(f => f.amount < 0).reduce((s, f) => s + f.amount, 0));
    const finalVal = validFlows.filter(f => f.amount > 0).reduce((s, f) => s + f.amount, 0);
    const maxYears = Math.max(...flows.map(f => f.years));
    if (totalInvested > 0 && maxYears > 0) {
      const cagr = (Math.pow(finalVal / totalInvested, 1 / Math.max(1, maxYears)) - 1) * 100;
      return isFinite(cagr) ? cagr : 0;
    }
    return 0;
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const npvMid = npv(mid);
    if (Math.abs(npvMid) < tolerance) {
      return mid * 100;
    }
    if (npvLow * npvMid < 0) {
      high = mid;
      npvHigh = npvMid;
    } else {
      low = mid;
      npvLow = npvMid;
    }
  }

  return ((low + high) / 2) * 100;
}

/**
 * Roll up raw transaction records into portfolio holdings and calculate metrics
 */
export function computePortfolioHoldings(
  transactions: TransactionRecord[],
  schemeCatalog: Record<string, MutualFundScheme>
): { holdings: PortfolioHolding[]; summary: PortfolioSummary } {
  const schemeMap = new Map<string, {
    schemeCode: string;
    schemeName: string;
    folioNumber: string;
    units: number;
    investedAmount: number;
    transactions: TransactionRecord[];
  }>();

  // Group transactions by schemeCode + folioNumber
  for (const tx of transactions) {
    if (tx.status === 'FAILED') continue;
    const key = `${tx.schemeCode}_${tx.folioNumber || 'DEFAULT'}`;

    if (!schemeMap.has(key)) {
      schemeMap.set(key, {
        schemeCode: tx.schemeCode,
        schemeName: tx.schemeName,
        folioNumber: tx.folioNumber || 'FOLIO-1',
        units: 0,
        investedAmount: 0,
        transactions: []
      });
    }

    const item = schemeMap.get(key)!;
    item.transactions.push(tx);

    if (tx.type === 'SIP' || tx.type === 'LUMPSUM' || tx.type === 'SWITCH_IN' || tx.type === 'DIVIDEND_REINVEST') {
      item.units += tx.units;
      item.investedAmount += tx.amount;
    } else if (tx.type === 'REDEMPTION' || tx.type === 'SWITCH_OUT') {
      // For redemption, reduce units and proportional invested amount
      const unitRatio = item.units > 0 ? Math.min(1, tx.units / item.units) : 1;
      item.investedAmount = Math.max(0, item.investedAmount * (1 - unitRatio));
      item.units = Math.max(0, item.units - tx.units);
    }
  }

  let totalCurrentValue = 0;
  let totalInvestedAmount = 0;
  let totalDayGain = 0;
  const holdings: PortfolioHolding[] = [];

  const allCashflowsForPortfolio: { date: Date; amount: number }[] = [];

  schemeMap.forEach((val) => {
    if (val.units <= 0.0001 && val.investedAmount <= 0) return;

    const schemeMeta = schemeCatalog[val.schemeCode] || {
      schemeCode: val.schemeCode,
      schemeName: val.schemeName,
      fundHouse: 'Direct Mutual Fund',
      category: 'Equity - Flexi Cap',
      currentNav: val.transactions[val.transactions.length - 1]?.nav || 100,
      navDate: new Date().toISOString().split('T')[0],
      navChange1D: 0.5,
      cagr3Y: 18.5,
      cagr5Y: 20.2,
      aumCr: 15000,
      expenseRatio: 0.65,
      isin: ''
    };

    const currentNav = schemeMeta.currentNav || 100;
    const currentValue = val.units * currentNav;
    const avgBuyNav = val.units > 0 ? val.investedAmount / val.units : 0;
    const totalGain = currentValue - val.investedAmount;
    const totalGainPercentage = val.investedAmount > 0 ? (totalGain / val.investedAmount) * 100 : 0;

    const nav1DPercent = schemeMeta.navChange1D || 0;
    const dayGain = currentValue * (nav1DPercent / 100);
    const dayGainPercentage = nav1DPercent;

    // Calculate Scheme XIRR
    const schemeCashflows: { date: Date; amount: number }[] = [];
    val.transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      if (tx.type === 'SIP' || tx.type === 'LUMPSUM' || tx.type === 'SWITCH_IN' || tx.type === 'DIVIDEND_REINVEST') {
        schemeCashflows.push({ date: txDate, amount: -Math.abs(tx.amount) });
        allCashflowsForPortfolio.push({ date: txDate, amount: -Math.abs(tx.amount) });
      } else if (tx.type === 'REDEMPTION' || tx.type === 'SWITCH_OUT') {
        schemeCashflows.push({ date: txDate, amount: Math.abs(tx.amount) });
        allCashflowsForPortfolio.push({ date: txDate, amount: Math.abs(tx.amount) });
      }
    });

    // Add current terminal valuation as positive cashflow
    const today = new Date();
    schemeCashflows.push({ date: today, amount: currentValue });

    const schemeXirr = calculateXirr(schemeCashflows);

    const sortedTxs = [...val.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const lastTxDate = sortedTxs[0]?.date || new Date().toISOString().split('T')[0];

    totalCurrentValue += currentValue;
    totalInvestedAmount += val.investedAmount;
    totalDayGain += dayGain;

    holdings.push({
      schemeCode: val.schemeCode,
      schemeName: schemeMeta.schemeName || val.schemeName,
      fundHouse: schemeMeta.fundHouse,
      category: schemeMeta.category,
      folioNumber: val.folioNumber,
      isin: schemeMeta.isin,
      units: val.units,
      avgBuyNav,
      currentNav,
      navDate: schemeMeta.navDate,
      navChange1D: schemeMeta.navChange1D,
      investedAmount: val.investedAmount,
      currentValue,
      totalGain,
      totalGainPercentage,
      dayGain,
      dayGainPercentage,
      xirr: schemeXirr,
      allocationPercentage: 0, // Computed in next step
      transactionsCount: val.transactions.length,
      lastTransactionDate: lastTxDate
    });
  });

  // Calculate allocation %
  holdings.forEach(h => {
    h.allocationPercentage = totalCurrentValue > 0 ? (h.currentValue / totalCurrentValue) * 100 : 0;
  });

  // Sort holdings by current value descending
  holdings.sort((a, b) => b.currentValue - a.currentValue);

  // Portfolio level XIRR
  if (totalCurrentValue > 0) {
    allCashflowsForPortfolio.push({ date: new Date(), amount: totalCurrentValue });
  }
  const portfolioXirr = calculateXirr(allCashflowsForPortfolio);

  const totalGain = totalCurrentValue - totalInvestedAmount;
  const totalGainPercentage = totalInvestedAmount > 0 ? (totalGain / totalInvestedAmount) * 100 : 0;
  const dayGainPercentage = totalCurrentValue > 0 ? (totalDayGain / totalCurrentValue) * 100 : 0;

  const summary: PortfolioSummary = {
    totalCurrentValue,
    totalInvestedAmount,
    totalGain,
    totalGainPercentage,
    dayGain: totalDayGain,
    dayGainPercentage,
    xirr: portfolioXirr,
    holdingsCount: holdings.length,
    folionsCount: new Set(holdings.map(h => h.folioNumber)).size,
    transactionsCount: transactions.length,
    lastUpdated: new Date().toISOString()
  };

  return { holdings, summary };
}

/**
 * Breakdown Asset Classes
 */
export function computeAssetAllocation(holdings: PortfolioHolding[]): AssetAllocation {
  const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (total <= 0) return { equity: 100, debt: 0, hybrid: 0, gold: 0, cash: 0 };

  let equity = 0;
  let debt = 0;
  let hybrid = 0;
  let gold = 0;
  let cash = 0;

  holdings.forEach(h => {
    const cat = h.category.toLowerCase();
    if (cat.includes('small cap') || cat.includes('mid cap') || cat.includes('large cap') || cat.includes('flexi cap') || cat.includes('elss')) {
      equity += h.currentValue * 0.96;
      cash += h.currentValue * 0.04;
    } else if (cat.includes('debt') || cat.includes('liquid') || cat.includes('duration')) {
      debt += h.currentValue * 0.95;
      cash += h.currentValue * 0.05;
    } else if (cat.includes('hybrid') || cat.includes('balanced')) {
      equity += h.currentValue * 0.65;
      debt += h.currentValue * 0.30;
      cash += h.currentValue * 0.05;
    } else if (cat.includes('gold') || cat.includes('commodity')) {
      gold += h.currentValue;
    } else {
      equity += h.currentValue * 0.90;
      cash += h.currentValue * 0.10;
    }
  });

  return {
    equity: (equity / total) * 100,
    debt: (debt / total) * 100,
    hybrid: (hybrid / total) * 100,
    gold: (gold / total) * 100,
    cash: (cash / total) * 100
  };
}

/**
 * Market Cap Allocation (Large, Mid, Small)
 */
export function computeMarketCapAllocation(holdings: PortfolioHolding[]): MarketCapAllocation {
  const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (total <= 0) return { largeCap: 60, midCap: 25, smallCap: 15 };

  let large = 0;
  let mid = 0;
  let small = 0;

  holdings.forEach(h => {
    const cat = h.category.toLowerCase();
    if (cat.includes('large cap') || cat.includes('index') || cat.includes('bluechip') || cat.includes('top 100')) {
      large += h.currentValue * 0.88;
      mid += h.currentValue * 0.10;
      small += h.currentValue * 0.02;
    } else if (cat.includes('mid cap') || cat.includes('emerging')) {
      large += h.currentValue * 0.15;
      mid += h.currentValue * 0.75;
      small += h.currentValue * 0.10;
    } else if (cat.includes('small cap')) {
      large += h.currentValue * 0.05;
      mid += h.currentValue * 0.20;
      small += h.currentValue * 0.75;
    } else if (cat.includes('flexi cap') || cat.includes('multi cap')) {
      large += h.currentValue * 0.65;
      mid += h.currentValue * 0.22;
      small += h.currentValue * 0.13;
    } else {
      large += h.currentValue * 0.60;
      mid += h.currentValue * 0.25;
      small += h.currentValue * 0.15;
    }
  });

  const equityTotal = large + mid + small;
  if (equityTotal <= 0) return { largeCap: 60, midCap: 25, smallCap: 15 };

  return {
    largeCap: (large / equityTotal) * 100,
    midCap: (mid / equityTotal) * 100,
    smallCap: (small / equityTotal) * 100
  };
}

/**
 * Stock Holding Overlap Aggregator
 * Known stock exposures for common top direct Indian mutual funds
 */
export const SCHEME_STOCK_PORTFOLIOS: Record<string, { stock: string; ticker: string; sector: string; weight: number }[]> = {
  '122639': [ // Parag Parikh Flexi Cap
    { stock: 'HDFC Bank Ltd', ticker: 'HDFCBANK', sector: 'Financial Services', weight: 8.2 },
    { stock: 'Bajaj Holdings & Inv Ltd', ticker: 'BAJAJHLDNG', sector: 'Financial Services', weight: 7.4 },
    { stock: 'ITC Ltd', ticker: 'ITC', sector: 'FMCG', weight: 6.9 },
    { stock: 'ICICI Bank Ltd', ticker: 'ICICIBANK', sector: 'Financial Services', weight: 6.5 },
    { stock: 'Power Grid Corp', ticker: 'POWERGRID', sector: 'Utilities', weight: 5.8 },
    { stock: 'Coal India Ltd', ticker: 'COALINDIA', sector: 'Energy & Mining', weight: 5.1 },
    { stock: 'Alphabet Inc (Google)', ticker: 'GOOGL', sector: 'Technology', weight: 4.8 },
    { stock: 'Microsoft Corp', ticker: 'MSFT', sector: 'Technology', weight: 4.2 },
    { stock: 'HCL Technologies', ticker: 'HCLTECH', sector: 'Technology', weight: 3.9 },
    { stock: 'Maruti Suzuki India', ticker: 'MARUTI', sector: 'Automobile', weight: 3.6 }
  ],
  '119063': [ // HDFC Top 100
    { stock: 'HDFC Bank Ltd', ticker: 'HDFCBANK', sector: 'Financial Services', weight: 9.8 },
    { stock: 'ICICI Bank Ltd', ticker: 'ICICIBANK', sector: 'Financial Services', weight: 8.6 },
    { stock: 'Reliance Industries Ltd', ticker: 'RELIANCE', sector: 'Energy', weight: 8.1 },
    { stock: 'Infosys Ltd', ticker: 'INFY', sector: 'Technology', weight: 6.5 },
    { stock: 'Larsen & Toubro Ltd', ticker: 'LT', sector: 'Capital Goods', weight: 5.4 },
    { stock: 'Tata Consultancy Services', ticker: 'TCS', sector: 'Technology', weight: 4.9 },
    { stock: 'Axis Bank Ltd', ticker: 'AXISBANK', sector: 'Financial Services', weight: 4.2 },
    { stock: 'Bharti Airtel Ltd', ticker: 'BHARTIARTL', sector: 'Telecommunication', weight: 3.8 },
    { stock: 'State Bank of India', ticker: 'SBIN', sector: 'Financial Services', weight: 3.5 },
    { stock: 'ITC Ltd', ticker: 'ITC', sector: 'FMCG', weight: 3.2 }
  ],
  '120503': [ // Quant Small Cap
    { stock: 'Reliance Industries Ltd', ticker: 'RELIANCE', sector: 'Energy', weight: 7.2 },
    { stock: 'Jio Financial Services', ticker: 'JIOFIN', sector: 'Financial Services', weight: 5.4 },
    { stock: 'Bikaji Foods International', ticker: 'BIKAJI', sector: 'FMCG', weight: 4.8 },
    { stock: 'Aegis Logistics Ltd', ticker: 'AEGISCHEM', sector: 'Energy', weight: 4.3 },
    { stock: 'Adani Power Ltd', ticker: 'ADANIPOWER', sector: 'Utilities', weight: 3.9 },
    { stock: 'HFCL Ltd', ticker: 'HFCL', sector: 'Telecommunication', weight: 3.6 },
    { stock: 'IRB Infrastructure', ticker: 'IRB', sector: 'Infrastructure', weight: 3.4 },
    { stock: 'Arvind Ltd', ticker: 'ARVIND', sector: 'Textiles', weight: 3.1 },
    { stock: 'Steel Authority of India', ticker: 'SAIL', sector: 'Metals', weight: 2.8 },
    { stock: 'Hindustan Copper Ltd', ticker: 'HINDCOPPER', sector: 'Metals', weight: 2.5 }
  ],
  '118834': [ // Mirae Asset Large Cap
    { stock: 'HDFC Bank Ltd', ticker: 'HDFCBANK', sector: 'Financial Services', weight: 9.4 },
    { stock: 'ICICI Bank Ltd', ticker: 'ICICIBANK', sector: 'Financial Services', weight: 8.2 },
    { stock: 'Reliance Industries Ltd', ticker: 'RELIANCE', sector: 'Energy', weight: 7.9 },
    { stock: 'Infosys Ltd', ticker: 'INFY', sector: 'Technology', weight: 6.2 },
    { stock: 'Tata Consultancy Services', ticker: 'TCS', sector: 'Technology', weight: 4.8 },
    { stock: 'Larsen & Toubro Ltd', ticker: 'LT', sector: 'Capital Goods', weight: 4.5 },
    { stock: 'Bharti Airtel Ltd', ticker: 'BHARTIARTL', sector: 'Telecommunication', weight: 4.1 },
    { stock: 'Axis Bank Ltd', ticker: 'AXISBANK', sector: 'Financial Services', weight: 3.9 },
    { stock: 'State Bank of India', ticker: 'SBIN', sector: 'Financial Services', weight: 3.4 },
    { stock: 'Sun Pharmaceutical', ticker: 'SUNPHARMA', sector: 'Healthcare', weight: 2.9 }
  ],
  '125497': [ // Nippon India Small Cap
    { stock: 'Tube Investments of India', ticker: 'TIINDIA', sector: 'Automobile', weight: 3.4 },
    { stock: 'HDFC Bank Ltd', ticker: 'HDFCBANK', sector: 'Financial Services', weight: 2.8 },
    { stock: 'Apar Industries Ltd', ticker: 'APARINDS', sector: 'Capital Goods', weight: 2.6 },
    { stock: 'Multi Commodity Exchange', ticker: 'MCX', sector: 'Financial Services', weight: 2.3 },
    { stock: 'KPIT Technologies Ltd', ticker: 'KPITTECH', sector: 'Technology', weight: 2.1 },
    { stock: 'Voltamp Transformers', ticker: 'VOLTAMP', sector: 'Capital Goods', weight: 1.9 },
    { stock: 'Birlasoft Ltd', ticker: 'BSOFT', sector: 'Technology', weight: 1.8 },
    { stock: 'Carborundum Universal', ticker: 'CARBORUNIV', sector: 'Capital Goods', weight: 1.7 },
    { stock: 'Power Mech Projects', ticker: 'POWERMECH', sector: 'Infrastructure', weight: 1.6 },
    { stock: 'Kirloskar Oil Engines', ticker: 'KIRLOSENG', sector: 'Capital Goods', weight: 1.5 }
  ],
  '119551': [ // SBI Bluechip
    { stock: 'HDFC Bank Ltd', ticker: 'HDFCBANK', sector: 'Financial Services', weight: 9.1 },
    { stock: 'ICICI Bank Ltd', ticker: 'ICICIBANK', sector: 'Financial Services', weight: 8.5 },
    { stock: 'Reliance Industries Ltd', ticker: 'RELIANCE', sector: 'Energy', weight: 7.6 },
    { stock: 'Infosys Ltd', ticker: 'INFY', sector: 'Technology', weight: 5.9 },
    { stock: 'Larsen & Toubro Ltd', ticker: 'LT', sector: 'Capital Goods', weight: 5.1 },
    { stock: 'ITC Ltd', ticker: 'ITC', sector: 'FMCG', weight: 4.4 },
    { stock: 'Bharti Airtel Ltd', ticker: 'BHARTIARTL', sector: 'Telecommunication', weight: 3.9 },
    { stock: 'Tata Motors Ltd', ticker: 'TATAMOTORS', sector: 'Automobile', weight: 3.5 },
    { stock: 'Mahindra & Mahindra', ticker: 'M&M', sector: 'Automobile', weight: 3.1 },
    { stock: 'Titan Company Ltd', ticker: 'TITAN', sector: 'Consumer Discretionary', weight: 2.8 }
  ],
  '120152': [ // Kotak Emerging Equity
    { stock: 'Supreme Industries Ltd', ticker: 'SUPREMEIND', sector: 'Industrial Products', weight: 4.2 },
    { stock: 'Cummins India Ltd', ticker: 'CUMMINSIND', sector: 'Capital Goods', weight: 3.9 },
    { stock: 'Schaeffler India Ltd', ticker: 'SCHAEFFLER', sector: 'Automobile', weight: 3.5 },
    { stock: 'Solar Industries India', ticker: 'SOLARINDS', sector: 'Chemicals', weight: 3.2 },
    { stock: 'Persistent Systems Ltd', ticker: 'PERSISTENT', sector: 'Technology', weight: 3.0 },
    { stock: 'Thermax Ltd', ticker: 'THERMAX', sector: 'Capital Goods', weight: 2.8 },
    { stock: 'Bharat Forge Ltd', ticker: 'BHARATFORG', sector: 'Automobile', weight: 2.6 },
    { stock: 'Max Financial Services', ticker: 'MFSL', sector: 'Financial Services', weight: 2.5 },
    { stock: 'Balkrishna Industries', ticker: 'BALKRISIND', sector: 'Automobile', weight: 2.3 },
    { stock: 'Coforge Ltd', ticker: 'COFORGE', sector: 'Technology', weight: 2.1 }
  ]
};

/**
 * Aggregates top underlying stock exposures across all portfolio holdings
 */
export function computeUnderlyingStockExposure(holdings: PortfolioHolding[]): StockHoldingExposure[] {
  const stockMap = new Map<string, {
    stockName: string;
    ticker: string;
    sector: string;
    value: number;
    fundsHolding: Set<string>;
  }>();

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (totalPortfolioValue <= 0) return [];

  holdings.forEach(holding => {
    const holdingsList = SCHEME_STOCK_PORTFOLIOS[holding.schemeCode] || [
      { stock: 'HDFC Bank Ltd', ticker: 'HDFCBANK', sector: 'Financial Services', weight: 7.5 },
      { stock: 'ICICI Bank Ltd', ticker: 'ICICIBANK', sector: 'Financial Services', weight: 6.5 },
      { stock: 'Reliance Industries Ltd', ticker: 'RELIANCE', sector: 'Energy', weight: 6.0 },
      { stock: 'Infosys Ltd', ticker: 'INFY', sector: 'Technology', weight: 5.0 },
      { stock: 'Larsen & Toubro Ltd', ticker: 'LT', sector: 'Capital Goods', weight: 4.0 }
    ];

    holdingsList.forEach(stockItem => {
      const stockEffectiveValue = holding.currentValue * (stockItem.weight / 100);
      if (!stockMap.has(stockItem.ticker)) {
        stockMap.set(stockItem.ticker, {
          stockName: stockItem.stock,
          ticker: stockItem.ticker,
          sector: stockItem.sector,
          value: 0,
          fundsHolding: new Set<string>()
        });
      }
      const entry = stockMap.get(stockItem.ticker)!;
      entry.value += stockEffectiveValue;
      entry.fundsHolding.add(holding.schemeName.split('-')[0].trim());
    });
  });

  const result: StockHoldingExposure[] = [];
  stockMap.forEach(item => {
    result.push({
      stockName: item.stockName,
      ticker: item.ticker,
      sector: item.sector,
      value: item.value,
      percentage: (item.value / totalPortfolioValue) * 100,
      fundsHolding: Array.from(item.fundsHolding)
    });
  });

  result.sort((a, b) => b.value - a.value);
  return result;
}

/**
 * Sector exposure aggregation
 */
export function computeSectorExposure(holdings: PortfolioHolding[]): SectorExposure[] {
  const stockExposures = computeUnderlyingStockExposure(holdings);
  const sectorMap = new Map<string, number>();
  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  stockExposures.forEach(s => {
    const curr = sectorMap.get(s.sector) || 0;
    sectorMap.set(s.sector, curr + s.value);
  });

  const sectors: SectorExposure[] = [];
  sectorMap.forEach((val, key) => {
    sectors.push({
      sector: key,
      value: val,
      percentage: totalPortfolioValue > 0 ? (val / totalPortfolioValue) * 100 : 0
    });
  });

  sectors.sort((a, b) => b.value - a.value);
  return sectors;
}

/**
 * Calculate Pairwise Portfolio Fund Overlap percentage between 2 funds
 */
export function calculateFundOverlap(schemeCodeA: string, schemeCodeB: string): { overlapPercentage: number; commonStocks: { stock: string; weightA: number; weightB: number; commonWeight: number }[] } {
  const listA = SCHEME_STOCK_PORTFOLIOS[schemeCodeA] || [];
  const listB = SCHEME_STOCK_PORTFOLIOS[schemeCodeB] || [];

  if (listA.length === 0 || listB.length === 0) {
    return { overlapPercentage: 0, commonStocks: [] };
  }

  const mapB = new Map(listB.map(item => [item.ticker, item]));
  const commonStocks: { stock: string; weightA: number; weightB: number; commonWeight: number }[] = [];
  let totalOverlap = 0;

  listA.forEach(itemA => {
    const itemB = mapB.get(itemA.ticker);
    if (itemB) {
      const minWeight = Math.min(itemA.weight, itemB.weight);
      totalOverlap += minWeight;
      commonStocks.push({
        stock: itemA.stock,
        weightA: itemA.weight,
        weightB: itemB.weight,
        commonWeight: minWeight
      });
    }
  });

  commonStocks.sort((a, b) => b.commonWeight - a.commonWeight);
  return {
    overlapPercentage: Math.round(totalOverlap * 10) / 10,
    commonStocks
  };
}

/**
 * Indian Income Tax Capital Gains Estimation (FY 2024-25 / 2025-26 rules)
 * Equity LTCG: > 1 year holding, 12.5% tax with ₹1.25 Lakh exemption
 * Equity STCG: <= 1 year holding, 20% flat tax
 * Debt Mutual Funds (bought after 1 Apr 2023): Taxed at individual slab rate (assumed ~30%)
 */
export function computeTaxLiability(transactions: TransactionRecord[], holdings: PortfolioHolding[]): TaxComputation {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  let ltcgUnrealized = 0;
  let stcgUnrealized = 0;
  let debtUnrealized = 0;

  holdings.forEach(h => {
    const isDebt = h.category.toLowerCase().includes('debt') || h.category.toLowerCase().includes('liquid');
    const isOldPurchase = new Date(h.lastTransactionDate) <= oneYearAgo;

    if (isDebt) {
      debtUnrealized += Math.max(0, h.totalGain);
    } else {
      if (isOldPurchase) {
        ltcgUnrealized += Math.max(0, h.totalGain);
      } else {
        stcgUnrealized += Math.max(0, h.totalGain);
      }
    }
  });

  const exemptLimit = 125000; // ₹1,25,000 LTCG exemption
  const taxableLtcg = Math.max(0, ltcgUnrealized - exemptLimit);
  const taxPayableLtcg = taxableLtcg * 0.125; // 12.5%
  const taxPayableStcg = stcgUnrealized * 0.20; // 20%
  const taxPayableDebt = debtUnrealized * 0.30; // ~30% marginal slab rate

  // Tax harvesting opportunity: If LTCG < 1.25L, user can book remaining profit tax-free
  const taxHarvestingOpportunity = Math.max(0, Math.min(ltcgUnrealized, exemptLimit));

  return {
    financialYear: 'FY 2024-25 / FY 2025-26',
    equityLtcg: {
      grossGain: ltcgUnrealized,
      exemptLimit,
      taxableGain: taxableLtcg,
      taxRate: 12.5,
      taxPayable: taxPayableLtcg
    },
    equityStcg: {
      grossGain: stcgUnrealized,
      taxRate: 20.0,
      taxPayable: taxPayableStcg
    },
    debtGains: {
      grossGain: debtUnrealized,
      taxRateEstimated: 30.0,
      taxPayable: taxPayableDebt
    },
    totalEstimatedTax: taxPayableLtcg + taxPayableStcg + taxPayableDebt,
    unrealizedLtcg: ltcgUnrealized,
    unrealizedStcg: stcgUnrealized,
    taxHarvestingOpportunity
  };
}

/**
 * LTTB Downsampling algorithm for 60fps chart rendering
 */
export function lttbDownsample<T extends { x: number; y: number }>(data: T[], threshold: number): T[] {
  if (threshold >= data.length || threshold === 0) {
    return data;
  }

  const sampled: T[] = [];
  let sampledIndex = 0;

  const every = (data.length - 2) / (threshold - 2);
  let a = 0;

  sampled[sampledIndex++] = data[a];

  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * every) + 1;
    let avgRangeEnd = Math.floor((i + 2) * every) + 1;
    avgRangeEnd = avgRangeEnd < data.length ? avgRangeEnd : data.length;

    const avgRangeLength = avgRangeEnd - avgRangeStart;

    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
    }

    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    let rangeOffs = Math.floor(i * every) + 1;
    let rangeTo = Math.floor((i + 1) * every) + 1;

    const pointAX = data[a].x;
    const pointAY = data[a].y;

    let maxArea = -1;
    let nextA = rangeOffs;

    for (let j = rangeOffs; j < rangeTo; j++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[j].y - pointAY) -
        (pointAX - data[j].x) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }

    sampled[sampledIndex++] = data[nextA];
    a = nextA;
  }

  sampled[sampledIndex++] = data[data.length - 1];
  return sampled;
}

/**
 * Currency formatter for Indian Rupees (₹ Lac / Cr / standard Lakhs)
 */
export function formatINR(val: number, compact: boolean = false): string {
  if (isNaN(val) || val === null || val === undefined) return '₹0';

  if (compact) {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 10000000) { // 1 Crore
      return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
    }
    if (abs >= 100000) { // 1 Lakh
      return `${sign}₹${(abs / 100000).toFixed(2)} L`;
    }
    if (abs >= 1000) {
      return `${sign}₹${(abs / 1000).toFixed(1)} k`;
    }
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(val);
}
