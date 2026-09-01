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
 * Clean scheme name to display only the core clean fund name without verbose 'Direct - Growth' / 'Demat' / ISIN suffixes.
 */
export function cleanFundDisplayName(rawName: string): string {
  if (!rawName) return 'Mutual Fund';
  let clean = rawName
    .replace(/[\r\n\t]+/g, ' ')
    // Remove parenthesized blocks containing ISIN, Advisor, Registrar, Folio, Demat, Broker, ARN, EUIN
    .replace(/\([^\)]*(?:ISIN|Advisor|Registrar|Folio|Demat|Broker|ARN|EUIN|RTA)[^\)]*\)/gi, '')
    .replace(/\[[^\]]*(?:ISIN|Advisor|Registrar|Folio|Demat|Broker|ARN|EUIN|RTA)[^\]]*\]/gi, '')
    // Remove ISIN fragments e.g. (ISIN: INF247L01536), ISIN: INF247L01536, ISIN:INF...
    .replace(/\(?\bISIN\b[\s:]*[A-Z0-9]+[A-Z0-9\)]*/gi, '')
    .replace(/\(ISIN:[^\)]*\)?/gi, '')
    // Remove Folio, Advisor, Registrar artifacts
    .replace(/Folio\s*(?:No|Number|\#)?\s*[:\-\s]*[A-Z0-9\/\-_]+/gi, '')
    .replace(/Advisor\s*[:\-\s]*[^\-\)\(\]]+/gi, '')
    .replace(/Registrar\s*[:\-\s]*[^\-\)\(\]]+/gi, '')
    // Remove Demat indicators e.g. (Demat), [Demat], Demat
    .replace(/\(?\[?\bDemat(?:\s+Account)?\b\]?\)?/gi, '')
    // Remove leading Scheme Name labels or AMC alphanumeric internal codes e.g. 127FMGDG-Motilal or 128TSDGG-Axis
    .replace(/^\s*(?:Scheme\s*Name\s*[:\-\s]*|Scheme\s*[:\-\s]*|[0-9A-Za-z]{2,14}\s*[-–—:]\s*)/i, '')
    // Normalize dashes surrounded by letters e.g. ELSS- Tax -> ELSS - Tax
    .replace(/([a-zA-Z0-9])-([a-zA-Z0-9])/g, '$1 - $2');

  // Strip Plan & Option descriptors comprehensively
  const removePatterns = [
    /[-–—]?\s*\b(?:Direct|Regular)\s+(?:Plan|Option)\s*[-–—]?\s*(?:Growth|IDCW|Dividend|Reinvestment|Payout)(?:\s+(?:Option|Plan))?\b/gi,
    /[-–—]?\s*\b(?:Direct|Regular)\s*[-–—]?\s*(?:Growth|IDCW|Dividend|Reinvestment|Payout)(?:\s+(?:Option|Plan))?\b/gi,
    /[-–—]?\s*\b(?:Growth|IDCW|Dividend|Reinvestment|Payout)\s+(?:Option|Plan)\b/gi,
    /[-–—]?\s*\b(?:Direct|Regular)\s+(?:Plan|Option)\b/gi,
    /[-–—]?\s*\b(?:Direct|Regular)\b/gi,
    /[-–—]?\s*\b(?:Growth|IDCW|Dividend|Reinvestment|Payout|Bonus|Cumulative)\b/gi,
    /[-–—]?\s*\b(?:Option|Options|Plan|Plans)\b/gi
  ];

  for (const pattern of removePatterns) {
    clean = clean.replace(pattern, ' ');
  }

  // Remove trailing and leading punctuation, hyphens, brackets
  clean = clean
    .replace(/\s*[-–—]\s*[-–—]\s*/g, ' - ')
    .replace(/[\(\[\{\)\]\}\-–—:,\.]+\s*$/g, '')
    .replace(/^\s*[\(\[\{\)\]\}\-–—:,\.]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Final cleanup of any trailing dangling hyphens, colons, dots, spaces
  clean = clean.replace(/[-–—\(\[\{\:\,\.\s]+$/, '').trim();

  // Standardize ELSS - Tax spacing
  clean = clean.replace(/\bELSS\s*-\s*Tax\b/gi, 'ELSS - Tax');
  clean = clean.replace(/\bELSS\s+Tax\b/gi, 'ELSS Tax');

  // Motilal Oswal Nasdaq 100 Fund of Fund formatting
  if (/motilal/i.test(clean) && /nasdaq/i.test(clean)) {
    if (/fund of fund|fof|f\.o\.f/i.test(rawName) || /fund of fund|fof|f\.o\.f/i.test(clean)) {
      clean = 'Motilal Oswal Nasdaq 100 Fund of Fund';
    }
  }

  // Remove any remaining dangling words like 'Option' or 'Plan' at the end
  clean = clean.replace(/\b(?:Option|Options|Plan|Plans)\b\s*$/gi, '').trim();
  clean = clean.replace(/[-–—\(\[\{\:\,\.\s]+$/, '').trim();

  return clean || rawName.trim();
}

/**
 * Detect whether fund is Direct or Regular Plan
 */
export function detectPlanType(
  nameOrText: string = '',
  isin?: string,
  schemeCode?: string,
  defaultPlan: 'Direct' | 'Regular' = 'Direct'
): 'Direct' | 'Regular' {
  const isinUpper = (isin || '').toUpperCase();
  if (
    isinUpper === 'INF879O01019' || // PPFAS Regular
    isinUpper === 'INF247L01700' || // Motilal Oswal FoF Regular
    isinUpper === 'INF247L01049' ||
    isinUpper === 'INF247L01510' ||
    isinUpper === 'INF846K01131' || // Axis ELSS Regular Growth
    isinUpper === 'INF846K01123' || // Axis ELSS Regular IDCW
    isinUpper === 'INF966L01AB1' || // Quant Small Cap Regular
    isinUpper === 'INF769K01111' || // Mirae Large & Midcap Regular
    isinUpper === 'INF179K01124' || // HDFC Mid-Cap Regular
    isinUpper === 'INF204K01633' || // Nippon Small Cap Regular
    isinUpper === 'INF109K01103' || // ICICI Bluechip Regular
    isinUpper === 'INF789F01740'    // UTI Nifty 50 Regular
  ) {
    return 'Regular';
  }

  if (
    isinUpper === 'INF879O01027' || // PPFAS Direct
    isinUpper === 'INF247L01718' || // Motilal Oswal FoF Direct
    isinUpper === 'INF247L01031' ||
    isinUpper === 'INF247L01536' ||
    isinUpper === 'INF0R8F01026' || // Zerodha ELSS Direct
    isinUpper === 'INF846K01EW2' || // Axis ELSS Direct Growth
    isinUpper === 'INF846K01EV4' || // Axis ELSS Direct IDCW
    isinUpper === 'INF966L01AA3' || // Quant Small Cap Direct
    isinUpper === 'INF769K01EZ2' || // Mirae Large & Midcap Direct
    isinUpper === 'INF179K01CY1' || // HDFC Mid-Cap Direct
    isinUpper === 'INF204K01W14' || // Nippon Small Cap Direct
    isinUpper === 'INF109K01Z48' || // ICICI Bluechip Direct
    isinUpper === 'INF789F01EV8'    // UTI Nifty 50 Direct
  ) {
    return 'Direct';
  }

  if (schemeCode === '122640' || schemeCode === '145551' || schemeCode === '112323' || schemeCode === '112322') return 'Regular';
  if (schemeCode === '122639' || schemeCode === '145552' || schemeCode === '152157' || schemeCode === '120503' || schemeCode === '120502') return 'Direct';

  const text = (nameOrText || '').toLowerCase();
  if (
    text.includes('regular plan') || 
    text.includes('regular') || 
    text.includes('- reg') || 
    text.includes('(reg)') ||
    text.includes(' reg ') ||
    text.includes('institutional')
  ) {
    return 'Regular';
  }
  if (
    text.includes('direct plan') || 
    text.includes('direct') || 
    text.includes('- dir') || 
    text.includes('(dir)') ||
    text.includes(' dir ')
  ) {
    return 'Direct';
  }
  return defaultPlan;
}

/**
 * Detect whether fund is Growth or IDCW (Dividend) Option
 */
export function detectOptionType(
  nameOrText: string = '',
  isin?: string
): 'Growth' | 'IDCW' {
  const isinUpper = (isin || '').toUpperCase();
  if (isinUpper === 'INF846K01EV4' || isinUpper === 'INF846K01123') return 'IDCW';

  const text = (nameOrText || '').toLowerCase();
  if (
    text.includes('idcw') ||
    text.includes('dividend') ||
    text.includes('payout') ||
    text.includes('reinvestment') ||
    text.includes('re-investment') ||
    text.includes('bonus')
  ) {
    return 'IDCW';
  }
  return 'Growth';
}

/**
 * Normalize and clean up folio numbers from CAMS / KFintech statements
 */
export function normalizeFolioNumber(folio?: string): string {
  if (!folio) return 'FOLIO-1';
  let f = folio.trim();
  // Strip common prefix labels like "Folio No:", "Folio:", "Folio Number:", "with "
  f = f.replace(/^(?:Folio\s*(?:No|Number|\#)?\s*[:\-\s]*|with\s+|held\s+in\s+)/i, '').trim();
  // Remove trailing "/ 0", "/0", " / 0", " /", "/"
  f = f.replace(/\s*\/\s*0$/g, '').replace(/\s*\/$/g, '').trim();
  return f || 'FOLIO-1';
}

/**
 * Validate if a string is a genuine folio number (must contain at least one digit and not be a stop word)
 */
export function isValidFolioNumber(folio?: string): boolean {
  if (!folio) return false;
  const f = normalizeFolioNumber(folio);
  if (f.length < 2) return false;
  if (!/\d/.test(f)) return false; // Genuine folios in India must contain digits
  const stopWords = /^(with|for|and|to|held|in|the|by|as|at|from|is|are|was|were|details|summary|statement|period|date|name|total|valuation|single|joint|status|active|mode|tax|kyc|pan|nominee|bank|mandate|direct|growth|regular|idcw|demat|cams|kfintech|karvy|amc|mf|folio|account|number|no)$/i;
  return !stopWords.test(f);
}

/**
 * Roll up raw transaction records into portfolio holdings and calculate metrics.
 * Correctly accounts for redemptions and switch-outs by deducting units and proportional cost basis chronologically.
 */
export function computePortfolioHoldings(
  transactions: TransactionRecord[],
  schemeCatalog: Record<string, MutualFundScheme>
): { holdings: PortfolioHolding[]; summary: PortfolioSummary } {
  // 1. Sort transactions in ascending chronological order (oldest first) so purchases precede redemptions
  const validTxs = transactions
    .filter(t => t.status !== 'FAILED')
    .map(t => ({
      ...t,
      folioNumber: normalizeFolioNumber(t.folioNumber),
      schemeName: cleanFundDisplayName(t.schemeName)
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 2. Identify the primary/canonical folio for each schemeCode
  const schemeDefaultFolioMap = new Map<string, string>();
  for (const tx of validTxs) {
    if (isValidFolioNumber(tx.folioNumber) && !schemeDefaultFolioMap.has(tx.schemeCode)) {
      schemeDefaultFolioMap.set(tx.schemeCode, tx.folioNumber);
    }
  }

  // 3. Group transactions by schemeCode + normalized folio
  const schemeMap = new Map<string, {
    schemeCode: string;
    schemeName: string;
    folioNumber: string;
    units: number;
    investedAmount: number;
    totalPurchasedUnits: number;
    totalPurchasedAmount: number;
    totalRedeemedUnits: number;
    totalRedeemedAmount: number;
    transactions: TransactionRecord[];
  }>();

  for (const tx of validTxs) {
    let sanitizedFolio = tx.folioNumber;
    if (!isValidFolioNumber(sanitizedFolio)) {
      sanitizedFolio = schemeDefaultFolioMap.get(tx.schemeCode) || 'FOLIO-1';
    }

    const cleanName = cleanFundDisplayName(tx.schemeName);
    const key = `${tx.schemeCode}_${sanitizedFolio}`;

    if (!schemeMap.has(key)) {
      schemeMap.set(key, {
        schemeCode: tx.schemeCode,
        schemeName: cleanName,
        folioNumber: sanitizedFolio,
        units: 0,
        investedAmount: 0,
        totalPurchasedUnits: 0,
        totalPurchasedAmount: 0,
        totalRedeemedUnits: 0,
        totalRedeemedAmount: 0,
        transactions: []
      });
    }

    const item = schemeMap.get(key)!;
    item.transactions.push(tx);

    const txTypeUpper = (tx.type || '').toUpperCase();
    const txUnits = Math.abs(tx.units || 0);
    const txAmount = Math.abs(tx.amount || 0);

    const isRedemption = 
      txTypeUpper === 'REDEMPTION' || 
      txTypeUpper === 'SWITCH_OUT' || 
      txTypeUpper === 'SWP' || 
      txTypeUpper.includes('REDEEM') || 
      txTypeUpper.includes('SELL') || 
      txTypeUpper.includes('SWITCH_OUT');

    const isPurchase = 
      txTypeUpper === 'SIP' || 
      txTypeUpper === 'LUMPSUM' || 
      txTypeUpper === 'SWITCH_IN' || 
      txTypeUpper === 'DIVIDEND_REINVEST' || 
      txTypeUpper.includes('BUY') || 
      txTypeUpper.includes('PURCHASE') ||
      !isRedemption;

    if (isPurchase && !isRedemption) {
      item.units += txUnits;
      item.investedAmount += txAmount;
      item.totalPurchasedUnits += txUnits;
      item.totalPurchasedAmount += txAmount;
    } else if (isRedemption) {
      item.totalRedeemedUnits += txUnits;
      item.totalRedeemedAmount += txAmount;

      // Reduce invested amount proportionally based on average cost per unit prior to redemption
      if (item.units > 0) {
        const avgCost = item.investedAmount / item.units;
        const costOfRedeemed = Math.min(item.investedAmount, txUnits * avgCost);
        item.investedAmount = Math.max(0, item.investedAmount - costOfRedeemed);
        item.units = Math.max(0, item.units - txUnits);
      } else {
        item.units = Math.max(0, item.units - txUnits);
      }
    }
  }

  let totalCurrentValue = 0;
  let totalInvestedAmount = 0;
  let totalDayGain = 0;
  const holdings: PortfolioHolding[] = [];
  const allCashflowsForPortfolio: { date: Date; amount: number }[] = [];

  schemeMap.forEach((val) => {
    // Exact net units validation
    const netUnits = Math.max(0, val.totalPurchasedUnits - val.totalRedeemedUnits);
    if (netUnits <= 0.0001) {
      val.units = 0;
      val.investedAmount = 0;
    } else {
      val.units = Math.round(netUnits * 1000) / 1000;
      // If investedAmount became 0 or mismatched due to rounding, reconstruct proportional remaining cost
      if (val.investedAmount <= 0 && val.totalPurchasedUnits > 0) {
        const avgCost = val.totalPurchasedAmount / val.totalPurchasedUnits;
        val.investedAmount = val.units * avgCost;
      }
    }

    // Accumulate cashflows for portfolio level XIRR (even if fully redeemed)
    val.transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const txTypeUpper = (tx.type || '').toUpperCase();
      const isRedemption = 
        txTypeUpper === 'REDEMPTION' || 
        txTypeUpper === 'SWITCH_OUT' || 
        txTypeUpper === 'SWP' || 
        txTypeUpper.includes('REDEEM') || 
        txTypeUpper.includes('SELL');

      if (isRedemption) {
        allCashflowsForPortfolio.push({ date: txDate, amount: Math.abs(tx.amount) });
      } else {
        allCashflowsForPortfolio.push({ date: txDate, amount: -Math.abs(tx.amount) });
      }
    });

    // If holding is fully closed/liquidated (0 units and 0 invested), omit from active holdings table
    if (val.units <= 0.0001 && val.investedAmount <= 0) {
      return;
    }

    const sortedTxsDesc = [...val.transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latestTxNav = sortedTxsDesc[0]?.nav || 85.0;

    // 1. Look up directly by schemeCode in catalog
    let schemeMeta: MutualFundScheme | undefined = schemeCatalog[val.schemeCode];

    // 2. If not found, look up in catalog by normalized schemeName
    if (!schemeMeta) {
      const cleanValName = cleanFundDisplayName(val.schemeName).toLowerCase();
      const match = Object.values(schemeCatalog).find(
        s => cleanFundDisplayName(s.schemeName).toLowerCase() === cleanValName
      );
      if (match) {
        schemeMeta = match;
      }
    }

    // 3. Fallback defaults
    if (!schemeMeta) {
      const cleanName = cleanFundDisplayName(val.schemeName);
      const lower = cleanName.toLowerCase();
      let defaultCurrentNav = latestTxNav;
      let defaultNavDate = sortedTxsDesc[0]?.date || '2026-08-28';
      let default1D = 0.5;

      if (lower.includes('parag parikh') && lower.includes('flexi cap')) {
        defaultCurrentNav = 91.1767;
        defaultNavDate = '2026-08-28';
        default1D = 0.54;
      } else if (lower.includes('axis') && (lower.includes('elss') || lower.includes('tax saver') || lower.includes('long term'))) {
        defaultCurrentNav = 112.9;
        defaultNavDate = '2026-08-28';
        default1D = 0.42;
      }

      schemeMeta = {
        schemeCode: val.schemeCode,
        schemeName: cleanName,
        fundHouse: lower.includes('parag parikh') ? 'PPFAS Mutual Fund' : lower.includes('axis') ? 'Axis Mutual Fund' : 'Direct Mutual Fund',
        category: lower.includes('elss') || lower.includes('tax') ? 'Equity - ELSS' : lower.includes('small') ? 'Equity - Small Cap' : lower.includes('mid') ? 'Equity - Mid Cap' : 'Equity - Flexi Cap',
        currentNav: defaultCurrentNav,
        navDate: defaultNavDate,
        navChange1D: default1D,
        cagr3Y: 18.5,
        cagr5Y: 20.2,
        aumCr: 15000,
        expenseRatio: 0.65,
        isin: ''
      };
    }

    const currentNav = (schemeMeta.currentNav && schemeMeta.currentNav > 0) ? schemeMeta.currentNav : latestTxNav;
    const currentValue = val.units * currentNav;
    const avgBuyNav = val.units > 0 ? val.investedAmount / val.units : 0;
    const totalGain = currentValue - val.investedAmount;
    const totalGainPercentage = val.investedAmount > 0 ? (totalGain / val.investedAmount) * 100 : 0;

    const nav1DPercent = schemeMeta.navChange1D || 0;
    const dayGain = currentValue * (nav1DPercent / 100);
    const dayGainPercentage = nav1DPercent;

    // Calculate Scheme-level XIRR
    const schemeCashflows: { date: Date; amount: number }[] = [];
    val.transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const txTypeUpper = (tx.type || '').toUpperCase();
      const isRedemption = 
        txTypeUpper === 'REDEMPTION' || 
        txTypeUpper === 'SWITCH_OUT' || 
        txTypeUpper === 'SWP' || 
        txTypeUpper.includes('REDEEM') || 
        txTypeUpper.includes('SELL');

      if (isRedemption) {
        schemeCashflows.push({ date: txDate, amount: Math.abs(tx.amount) });
      } else {
        schemeCashflows.push({ date: txDate, amount: -Math.abs(tx.amount) });
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

    const finalDisplayName = cleanFundDisplayName(schemeMeta.schemeName || val.schemeName);
    const txPlan = val.transactions.find(t => t.planType)?.planType;
    const txOption = val.transactions.find(t => t.optionType)?.optionType;
    const resolvedPlanType = schemeMeta.planType || txPlan || detectPlanType(val.schemeName, schemeMeta.isin, val.schemeCode);
    const resolvedOptionType = schemeMeta.optionType || txOption || detectOptionType(val.schemeName, schemeMeta.isin);

    holdings.push({
      schemeCode: val.schemeCode,
      schemeName: finalDisplayName,
      fundHouse: schemeMeta.fundHouse,
      category: schemeMeta.category,
      planType: resolvedPlanType,
      optionType: resolvedOptionType,
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
  '120503': [ // Axis ELSS - Tax Saver Fund (Direct Plan)
    { stock: 'Axis Bank Ltd', ticker: 'AXISBANK', sector: 'Financial Services', weight: 8.5 },
    { stock: 'ICICI Bank Ltd', ticker: 'ICICIBANK', sector: 'Financial Services', weight: 7.8 },
    { stock: 'Avenue Supermarts Ltd (DMart)', ticker: 'DMART', sector: 'Consumer Services', weight: 6.9 },
    { stock: 'Bajaj Finance Ltd', ticker: 'BAJFINANCE', sector: 'Financial Services', weight: 6.2 },
    { stock: 'Tata Consultancy Services', ticker: 'TCS', sector: 'Technology', weight: 5.6 },
    { stock: 'HDFC Bank Ltd', ticker: 'HDFCBANK', sector: 'Financial Services', weight: 5.1 },
    { stock: 'Infosys Ltd', ticker: 'INFY', sector: 'Technology', weight: 4.5 },
    { stock: 'Nestle India Ltd', ticker: 'NESTLEIND', sector: 'FMCG', weight: 4.1 },
    { stock: 'Pidilite Industries Ltd', ticker: 'PIDILITIND', sector: 'Chemicals', weight: 3.8 },
    { stock: 'Torrent Power Ltd', ticker: 'TORNTPOWER', sector: 'Utilities', weight: 3.4 }
  ],
  '120828': [ // Quant Small Cap Fund
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
