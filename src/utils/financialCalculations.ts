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
 * Universal safe date parser for all Indian (DD-MM-YYYY, DD/MM/YYYY, DD-Mon-YYYY) and standard formats.
 * Always returns a valid Date object.
 */
export function parseDateSafe(dateInput: string | number | Date | undefined): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  const str = String(dateInput).trim();
  if (!str) return new Date();

  // Try direct standard ISO parse if YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}(?:T|\b)/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // Match DD-MMM-YYYY or DD MMM YYYY or DD-MMM-YY (e.g. 15-May-2023, 15-MAY-23, 15 May 2023)
  const dMonY = str.match(/^(\d{1,2})[-\s/]([a-zA-Z]{3,9})[-\s/](\d{2,4})/);
  if (dMonY) {
    const day = dMonY[1].padStart(2, '0');
    const monKey = dMonY[2].substring(0, 3).toLowerCase();
    const monNum = monthMap[monKey] || '01';
    let year = dMonY[3];
    if (year.length === 2) {
      year = parseInt(year, 10) >= 70 ? `19${year}` : `20${year}`;
    }
    const d = new Date(`${year}-${monNum}-${day}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[-\s/.](\d{1,2})[-\s/.](\d{2,4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) {
      year = parseInt(year, 10) >= 70 ? `19${year}` : `20${year}`;
    }
    const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymd = str.match(/^(\d{4})[-\s/.](\d{1,2})[-\s/.](\d{1,2})/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Universal timestamp parser
 */
export function parseDateToTimestamp(dateInput: string | number | Date | undefined): number {
  return parseDateSafe(dateInput).getTime();
}

/**
 * High-precision XIRR calculation using Newton-Raphson method with adaptive damping and bisection fallback.
 * cashflows: array of { date: Date, amount: number }
 * (investments/purchases are negative, current value or redemption is positive)
 */
export function calculateXirr(
  cashflows: { date: Date | string; amount: number }[],
  guess: number = 0.1
): number {
  if (!cashflows || cashflows.length < 2) return 0;

  // Normalize and filter out zero amount flows
  const validFlows = cashflows
    .map(f => ({
      date: parseDateSafe(f.date),
      amount: f.amount
    }))
    .filter(f => f.amount !== 0 && !isNaN(f.amount) && !isNaN(f.date.getTime()));

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
  // Strip common prefix labels like "Folio No:", "Folio:", "Folio Number:", "Account No:", "with ", "held in "
  f = f.replace(/^(?:Folio\s*(?:No\.?|Number|\#)?\s*[:\-\s]*|Account\s*(?:No\.?|Number|\#)?\s*[:\-\s]*|with\s+|held\s+in\s+)/i, '').trim();
  // Normalize whitespace around slashes: "91060243113 / 0" -> "91060243113/0"
  f = f.replace(/\s*\/\s*/g, '/');
  // Strip any trailing non-folio text after a hyphen or multiple spaces (e.g. "91060243113/0 - Name" -> "91060243113/0")
  f = f.replace(/\s+[-–—]\s+.*$/g, '');
  // Remove trailing slashes, colons, semicolons, commas
  f = f.replace(/[;:,.\s\/]+$/g, '').trim();
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
    .sort((a, b) => parseDateSafe(a.date).getTime() - parseDateSafe(b.date).getTime());

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

export interface GrowthDataPoint {
  x: number;
  date: string;
  fullDate: string;
  netWorth: number;
  invested: number;
  nifty50: number;
}

/**
 * Historical Nifty 50 Index anchor levels for precise benchmark simulation
 */
export const NIFTY_50_ANCHORS: [string, number][] = [
  ['2016-01-01', 7963],
  ['2016-06-01', 8160],
  ['2016-12-30', 8185],
  ['2017-06-01', 9621],
  ['2017-12-29', 10530],
  ['2018-06-01', 10696],
  ['2018-08-28', 11738],
  ['2018-12-31', 10862],
  ['2019-06-03', 12088],
  ['2019-12-31', 12168],
  ['2020-01-20', 12352],
  ['2020-03-23', 7610],
  ['2020-06-30', 10302],
  ['2020-11-10', 12631],
  ['2020-12-31', 13981],
  ['2021-02-15', 15314],
  ['2021-06-30', 15721],
  ['2021-10-18', 18477],
  ['2021-12-31', 17354],
  ['2022-03-08', 15863],
  ['2022-06-17', 15293],
  ['2022-12-01', 18812],
  ['2022-12-30', 18105],
  ['2023-03-20', 16988],
  ['2023-06-30', 19189],
  ['2023-09-15', 20192],
  ['2023-12-28', 21778],
  ['2024-03-01', 22338],
  ['2024-06-04', 21884],
  ['2024-09-27', 26216],
  ['2024-12-31', 23644],
  ['2025-06-30', 24800],
  ['2025-12-31', 25100],
  ['2026-06-30', 25180],
  ['2026-08-31', 25280],
  ['2026-09-01', 25300]
];

/**
 * Returns interpolated Nifty 50 index level for any given date
 */
export function getNifty50Level(date: Date): number {
  const time = date.getTime();
  const first = new Date(NIFTY_50_ANCHORS[0][0]).getTime();
  const last = new Date(NIFTY_50_ANCHORS[NIFTY_50_ANCHORS.length - 1][0]).getTime();

  if (time <= first) return NIFTY_50_ANCHORS[0][1];
  if (time >= last) return NIFTY_50_ANCHORS[NIFTY_50_ANCHORS.length - 1][1];

  for (let i = 0; i < NIFTY_50_ANCHORS.length - 1; i++) {
    const t1 = new Date(NIFTY_50_ANCHORS[i][0]).getTime();
    const t2 = new Date(NIFTY_50_ANCHORS[i + 1][0]).getTime();
    if (time >= t1 && time <= t2) {
      const fraction = (time - t1) / (t2 - t1);
      const v1 = NIFTY_50_ANCHORS[i][1];
      const v2 = NIFTY_50_ANCHORS[i + 1][1];
      return v1 + fraction * (v2 - v1);
    }
  }
  return 25300;
}

/**
 * Computes realistic, physically exact historical portfolio growth time series
 * comparing Capital Invested, Portfolio Net Worth, and Nifty 50 Benchmark.
 */
export function computeHistoricalPortfolioGrowth(
  transactions: TransactionRecord[] = [],
  holdings: PortfolioHolding[] = [],
  summary: PortfolioSummary,
  timeframe: '1M' | '6M' | '1Y' | '3Y' | 'ALL'
): GrowthDataPoint[] {
  const today = new Date();
  const todayTime = today.getTime();

  // 1. Prepare valid transactions sorted in ascending chronological order
  const validTxs = (transactions || [])
    .filter(t => t.status !== 'FAILED')
    .map(t => ({
      ...t,
      dateTime: new Date(t.date).getTime()
    }))
    .sort((a, b) => a.dateTime - b.dateTime);

  // If no transactions are available, synthesize a transaction baseline from holdings
  let effectiveTxs = validTxs;
  if (effectiveTxs.length === 0 && holdings.length > 0) {
    const syntheticTxs: typeof validTxs = [];
    holdings.forEach(h => {
      const txDate = h.lastTransactionDate ? new Date(h.lastTransactionDate) : new Date(todayTime - 365 * 86400000);
      syntheticTxs.push({
        id: `synth_${h.schemeCode}`,
        folioNumber: h.folioNumber || 'FOLIO-1',
        schemeCode: h.schemeCode,
        schemeName: h.schemeName,
        type: 'LUMPSUM',
        date: txDate.toISOString().split('T')[0],
        units: h.units,
        nav: h.avgBuyNav || (h.investedAmount / Math.max(1, h.units)),
        amount: h.investedAmount,
        status: 'COMPLETED',
        dateTime: txDate.getTime()
      });
    });
    effectiveTxs = syntheticTxs.sort((a, b) => a.dateTime - b.dateTime);
  }

  // 2. Determine chart start date based on selected timeframe
  let startTime = todayTime - 1095 * 86400000; // default 3Y
  if (timeframe === '1M') {
    startTime = todayTime - 30 * 86400000;
  } else if (timeframe === '6M') {
    startTime = todayTime - 180 * 86400000;
  } else if (timeframe === '1Y') {
    startTime = todayTime - 365 * 86400000;
  } else if (timeframe === '3Y') {
    startTime = todayTime - 1095 * 86400000;
  } else if (timeframe === 'ALL') {
    if (effectiveTxs.length > 0) {
      const earliest = effectiveTxs[0].dateTime;
      startTime = Math.min(earliest, todayTime - 365 * 86400000);
    } else {
      startTime = todayTime - 1095 * 86400000;
    }
  }

  // 3. Collect scheme historical NAV anchors
  // Map of schemeCode -> sorted array of { time: number, nav: number }
  const schemeNavAnchors = new Map<string, { time: number; nav: number }[]>();
  
  // From holdings (live NAV today)
  const holdingsMap = new Map<string, PortfolioHolding>();
  holdings.forEach(h => {
    holdingsMap.set(h.schemeCode, h);
    schemeNavAnchors.set(h.schemeCode, [
      { time: todayTime, nav: h.currentNav }
    ]);
  });

  // Add transaction NAVs
  effectiveTxs.forEach(tx => {
    if (!schemeNavAnchors.has(tx.schemeCode)) {
      schemeNavAnchors.set(tx.schemeCode, [{ time: todayTime, nav: tx.nav || 50 }]);
    }
    const list = schemeNavAnchors.get(tx.schemeCode)!;
    if (tx.nav > 0) {
      list.push({ time: tx.dateTime, nav: tx.nav });
    }
  });

  // Sort and deduplicate anchors for each scheme
  schemeNavAnchors.forEach((anchors) => {
    anchors.sort((a, b) => a.time - b.time);
  });

  // Helper function: estimate NAV of a scheme on any date T
  const getSchemeNavOnDate = (schemeCode: string, targetTime: number): number => {
    const anchors = schemeNavAnchors.get(schemeCode);
    const holding = holdingsMap.get(schemeCode);
    const currentNav = holding?.currentNav || 100;
    if (!anchors || anchors.length === 0) return currentNav;

    if (targetTime >= todayTime) return currentNav;
    const firstAnchor = anchors[0];
    const lastAnchor = anchors[anchors.length - 1];

    if (targetTime <= firstAnchor.time) {
      const niftyRatio = getNifty50Level(new Date(targetTime)) / getNifty50Level(new Date(firstAnchor.time));
      return Math.max(1, firstAnchor.nav * niftyRatio);
    }
    if (targetTime >= lastAnchor.time) {
      const niftyRatio = getNifty50Level(new Date(targetTime)) / getNifty50Level(new Date(lastAnchor.time));
      return Math.max(1, lastAnchor.nav * niftyRatio);
    }

    // Find the two surrounding anchors
    for (let i = 0; i < anchors.length - 1; i++) {
      const a1 = anchors[i];
      const a2 = anchors[i + 1];
      if (targetTime >= a1.time && targetTime <= a2.time) {
        if (a2.time === a1.time) return a1.nav;
        const progress = (targetTime - a1.time) / (a2.time - a1.time);
        const linearNav = a1.nav + progress * (a2.nav - a1.nav);

        // Modulate with realistic market index variation between the two dates
        const niftyStart = getNifty50Level(new Date(a1.time));
        const niftyTarget = getNifty50Level(new Date(targetTime));
        const niftyEnd = getNifty50Level(new Date(a2.time));
        const niftyExpectedLinear = niftyStart + progress * (niftyEnd - niftyStart);
        const niftyDeltaRatio = niftyExpectedLinear > 0 ? (niftyTarget - niftyExpectedLinear) / niftyStart : 0;

        const adjustedNav = linearNav + (a1.nav * niftyDeltaRatio * 0.75);
        return Math.max(1, adjustedNav);
      }
    }

    return currentNav;
  };

  // 4. Generate sampling points between startTime and today
  const pointsCount = timeframe === '1M' ? 30 : timeframe === '6M' ? 60 : timeframe === '1Y' ? 73 : timeframe === '3Y' ? 110 : 120;
  const stepMs = (todayTime - startTime) / pointsCount;

  const points: GrowthDataPoint[] = [];

  for (let i = 0; i <= pointsCount; i++) {
    const isTodayPoint = (i === pointsCount);
    const targetTime = isTodayPoint ? todayTime : startTime + i * stepMs;
    const targetDate = new Date(targetTime);

    // Compute portfolio state at targetTime
    // We iterate through all transactions that happened ON or BEFORE targetTime
    let cumulativeInvested = 0;
    let cumulativeNetWorth = 0;
    let cumulativeNiftyUnits = 0;

    const schemeUnitsMap = new Map<string, { units: number; invested: number }>();

    for (const tx of effectiveTxs) {
      if (tx.dateTime > targetTime) continue;

      const txTypeUpper = (tx.type || '').toUpperCase();
      const isRedemption = 
        txTypeUpper === 'REDEMPTION' || 
        txTypeUpper === 'SWITCH_OUT' || 
        txTypeUpper === 'SWP' || 
        txTypeUpper.includes('REDEEM') || 
        txTypeUpper.includes('SELL');

      const txUnits = Math.abs(tx.units || 0);
      const txAmount = Math.abs(tx.amount || 0);
      const niftyAtTx = getNifty50Level(new Date(tx.dateTime));

      if (!schemeUnitsMap.has(tx.schemeCode)) {
        schemeUnitsMap.set(tx.schemeCode, { units: 0, invested: 0 });
      }
      const entry = schemeUnitsMap.get(tx.schemeCode)!;

      if (isRedemption) {
        if (entry.units > 0) {
          const avgCost = entry.invested / entry.units;
          const costOfRedeemed = Math.min(entry.invested, txUnits * avgCost);
          entry.invested = Math.max(0, entry.invested - costOfRedeemed);
          entry.units = Math.max(0, entry.units - txUnits);
        } else {
          entry.units = Math.max(0, entry.units - txUnits);
        }

        // Deduct Nifty units equivalent to redemption amount
        if (niftyAtTx > 0) {
          cumulativeNiftyUnits = Math.max(0, cumulativeNiftyUnits - (txAmount / niftyAtTx));
        }
      } else {
        // Purchase (SIP / LUMPSUM / SWITCH_IN)
        entry.units += txUnits;
        entry.invested += txAmount;

        // Accumulate Nifty units bought on that date
        if (niftyAtTx > 0) {
          cumulativeNiftyUnits += (txAmount / niftyAtTx);
        }
      }
    }

    // Sum invested and compute net worth from active units
    schemeUnitsMap.forEach((entry, code) => {
      cumulativeInvested += entry.invested;
      if (entry.units > 0.0001) {
        const nav = getSchemeNavOnDate(code, targetTime);
        cumulativeNetWorth += entry.units * nav;
      }
    });

    const currentNiftyIndex = getNifty50Level(targetDate);
    const cumulativeNiftyValue = cumulativeNiftyUnits * currentNiftyIndex;

    // Format display date
    const dateFormatted = targetDate.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: (timeframe === 'ALL' || timeframe === '3Y' || timeframe === '1Y') ? '2-digit' : undefined
    });

    const fullDate = targetDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    if (isTodayPoint) {
      // Ensure the final point matches summary exact totals
      points.push({
        x: i,
        date: dateFormatted,
        fullDate,
        netWorth: Math.round(summary.totalCurrentValue || cumulativeNetWorth),
        invested: Math.round(summary.totalInvestedAmount || cumulativeInvested),
        nifty50: Math.round(cumulativeNiftyValue > 0 ? cumulativeNiftyValue : (summary.totalInvestedAmount * 1.12))
      });
    } else {
      points.push({
        x: i,
        date: dateFormatted,
        fullDate,
        netWorth: Math.round(cumulativeNetWorth),
        invested: Math.round(cumulativeInvested),
        nifty50: Math.round(cumulativeNiftyValue)
      });
    }
  }

  return points;
}

export interface MergeTransactionsResult {
  mergedTransactions: TransactionRecord[];
  addedCount: number;
  duplicateCount: number;
  updatedCount: number;
  totalCount: number;
  addedTransactions: TransactionRecord[];
  duplicateTransactions: TransactionRecord[];
}

export interface PreviewMergeItem {
  transaction: TransactionRecord;
  isDuplicate: boolean;
  duplicateOf?: TransactionRecord;
}

export interface PreviewMergeAnalysis {
  previewItems: PreviewMergeItem[];
  addedCount: number;
  duplicateCount: number;
  totalResultingCount: number;
}

/**
 * Normalizes transaction type into binary cashflow direction ('INFLOW' | 'OUTFLOW')
 */
export function getTransactionDirection(type?: string): 'INFLOW' | 'OUTFLOW' {
  const upper = (type || '').toUpperCase();
  if (
    upper === 'REDEMPTION' ||
    upper === 'SWITCH_OUT' ||
    upper === 'SWP' ||
    upper === 'SELL' ||
    upper.includes('REDEEM') ||
    upper.includes('OUT')
  ) {
    return 'OUTFLOW';
  }
  return 'INFLOW';
}

/**
 * Checks if two fund scheme identifiers refer to the exact same mutual fund scheme
 */
export function areSchemesEquivalent(
  code1: string,
  name1: string,
  code2: string,
  name2: string
): boolean {
  const c1 = (code1 || '').trim();
  const c2 = (code2 || '').trim();
  if (c1 && c2 && c1 === c2) return true;

  const n1 = cleanFundDisplayName(name1).toLowerCase().replace(/[^a-z0-9]/g, '');
  const n2 = cleanFundDisplayName(name2).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (n1 && n2) {
    if (n1 === n2) return true;
    if (n1.length > 8 && n2.length > 8) {
      if (n1.includes(n2) || n2.includes(n1)) return true;
    }
  }

  return false;
}

/**
 * Normalizes folios for comparison (stripping spaces, slashes, trailing zeros)
 */
export function areFoliosEquivalent(folio1?: string, folio2?: string): boolean {
  const f1 = normalizeFolioNumber(folio1).toLowerCase().replace(/[^a-z0-9]/g, '');
  const f2 = normalizeFolioNumber(folio2).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!f1 || !f2 || f1 === 'folio1' || f2 === 'folio1') {
    // If either folio is missing or default placeholder, allow matching based on scheme + date + amount
    return true;
  }

  if (f1 === f2) return true;
  if (f1.includes(f2) || f2.includes(f1)) return true;

  return false;
}

/**
 * Determines if two individual transaction records are duplicates
 */
export function areTransactionsDuplicate(
  t1: TransactionRecord,
  t2: TransactionRecord
): boolean {
  // 1. Exact ID match
  if (t1.id && t2.id && t1.id === t2.id) {
    return true;
  }

  // 2. Transaction direction (must both be Inflows or both Outflows)
  const dir1 = getTransactionDirection(t1.type);
  const dir2 = getTransactionDirection(t2.type);
  if (dir1 !== dir2) return false;

  // 3. Scheme check
  const schemeMatch = areSchemesEquivalent(t1.schemeCode, t1.schemeName, t2.schemeCode, t2.schemeName);
  if (!schemeMatch) return false;

  // 4. Folio check
  const folioMatch = areFoliosEquivalent(t1.folioNumber, t2.folioNumber);
  if (!folioMatch) return false;

  // 5. Date check
  const date1Str = (t1.date || '').split('T')[0];
  const date2Str = (t2.date || '').split('T')[0];
  const isSameDate = (date1Str === date2Str);

  const time1 = new Date(date1Str).getTime();
  const time2 = new Date(date2Str).getTime();
  const daysDiff = Math.abs(time1 - time2) / (1000 * 60 * 60 * 24);

  const u1 = Math.abs(t1.units || 0);
  const u2 = Math.abs(t2.units || 0);
  const a1 = Math.abs(t1.amount || 0);
  const a2 = Math.abs(t2.amount || 0);

  const unitsDiff = Math.abs(u1 - u2);
  const amountDiff = Math.abs(a1 - a2);

  // High-accuracy units match (within 0.005 units)
  const isUnitsMatch = (unitsDiff <= 0.005) || (u1 > 10 && (unitsDiff / u1) < 0.0005);
  // High-accuracy amount match (within ₹2.00 or 0.1% for stamp duty differences)
  const isAmountMatch = (amountDiff <= 2.0) || (a1 > 100 && (amountDiff / a1) < 0.001);

  // Exact same date match
  if (isSameDate) {
    if (isUnitsMatch && isAmountMatch) return true;
    if (isUnitsMatch && (a1 === 0 || a2 === 0)) return true;
    if (isAmountMatch && (u1 === 0 || u2 === 0)) return true;
    // Both units match very closely
    if (unitsDiff <= 0.001) return true;
    // Both amount match exact
    if (amountDiff <= 0.05 && u1 > 0 && u2 > 0 && unitsDiff <= 0.05) return true;
  }

  // Settlement offset match (within 1-2 days for T+1 / weekend posting)
  if (daysDiff <= 2.5) {
    if (unitsDiff <= 0.002 && amountDiff <= 1.0) return true;
  }

  return false;
}

/**
 * Intelligent transaction deduplication and merging engine.
 * Merges incoming transactions into existing portfolio without creating duplicates.
 * Safely handles:
 * - Duplicate uploads of the exact same CAS / JSON period
 * - Incremental recent period CAS uploads (e.g. 1-month statement over full history)
 * - Historical CAS uploads over recent imports
 * - Folio number format variations (e.g. "/0", leading/trailing spaces)
 * - Minor stamp duty and rounding differences in amounts/units
 */
export function mergeTransactions(
  existingTransactions: TransactionRecord[] = [],
  incomingTransactions: TransactionRecord[] = []
): MergeTransactionsResult {
  const mergedList: TransactionRecord[] = existingTransactions.map(t => ({ ...t }));
  const matchedExistingIndices = new Set<number>();
  const addedTransactions: TransactionRecord[] = [];
  const duplicateTransactions: TransactionRecord[] = [];
  let updatedCount = 0;

  // Build fast signature index for exact fast-path matches
  const makeKey = (tx: TransactionRecord) => {
    const dir = getTransactionDirection(tx.type);
    const date = (tx.date || '').split('T')[0];
    const code = (tx.schemeCode || '').trim();
    const cleanName = cleanFundDisplayName(tx.schemeName).toLowerCase().replace(/[^a-z0-9]/g, '');
    const folio = normalizeFolioNumber(tx.folioNumber).toLowerCase().replace(/[^a-z0-9]/g, '');
    const u = Math.abs(tx.units || 0).toFixed(3);
    const a = Math.round(Math.abs(tx.amount || 0));
    return `${dir}|${date}|${code || cleanName}|${folio}|${u}|${a}`;
  };

  const exactKeyMap = new Map<string, number>();
  existingTransactions.forEach((tx, idx) => {
    exactKeyMap.set(makeKey(tx), idx);
  });

  incomingTransactions.forEach((incomingTx, incIdx) => {
    let duplicateIndex = -1;

    // 1. Fast path: check exact signature
    const sigKey = makeKey(incomingTx);
    if (exactKeyMap.has(sigKey)) {
      const idx = exactKeyMap.get(sigKey)!;
      if (!matchedExistingIndices.has(idx)) {
        duplicateIndex = idx;
      }
    }

    // 2. Comprehensive check if fast-path didn't hit
    if (duplicateIndex === -1) {
      for (let i = 0; i < mergedList.length; i++) {
        if (matchedExistingIndices.has(i)) continue;
        if (areTransactionsDuplicate(incomingTx, mergedList[i])) {
          duplicateIndex = i;
          break;
        }
      }
    }

    if (duplicateIndex !== -1) {
      matchedExistingIndices.add(duplicateIndex);
      duplicateTransactions.push(incomingTx);

      // Enhance existing transaction metadata if incoming has better official AMFI code or clean fields
      const existing = mergedList[duplicateIndex];
      let didEnhance = false;
      const isOfficialAmfi = /^\d{5,7}$/.test(incomingTx.schemeCode);
      const isExistingPlaceholder = !/^\d{5,7}$/.test(existing.schemeCode);

      if (isOfficialAmfi && isExistingPlaceholder) {
        existing.schemeCode = incomingTx.schemeCode;
        existing.schemeName = incomingTx.schemeName;
        didEnhance = true;
      }

      if (incomingTx.planType && !existing.planType) {
        existing.planType = incomingTx.planType;
        didEnhance = true;
      }

      if (incomingTx.optionType && !existing.optionType) {
        existing.optionType = incomingTx.optionType;
        didEnhance = true;
      }

      if (didEnhance) {
        updatedCount++;
      }
    } else {
      // New transaction to add!
      const uniqueId = incomingTx.id && !mergedList.some(m => m.id === incomingTx.id)
        ? incomingTx.id
        : `tx_${Date.now()}_${incIdx}_${Math.random().toString(36).substr(2, 6)}`;

      const newTx: TransactionRecord = {
        ...incomingTx,
        id: uniqueId,
        folioNumber: normalizeFolioNumber(incomingTx.folioNumber),
        schemeName: cleanFundDisplayName(incomingTx.schemeName),
        status: incomingTx.status || 'COMPLETED'
      };

      mergedList.push(newTx);
      addedTransactions.push(newTx);
    }
  });

  // Sort merged transactions in descending chronological order (newest first)
  mergedList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    mergedTransactions: mergedList,
    addedCount: addedTransactions.length,
    duplicateCount: duplicateTransactions.length,
    updatedCount,
    totalCount: mergedList.length,
    addedTransactions,
    duplicateTransactions
  };
}

/**
 * Previews incoming transactions against existing portfolio to show which are new and which are duplicates
 */
export function analyzeTransactionsMerge(
  existingTransactions: TransactionRecord[] = [],
  incomingTransactions: TransactionRecord[] = []
): PreviewMergeAnalysis {
  const matchedExistingIndices = new Set<number>();
  const previewItems: PreviewMergeItem[] = [];
  let addedCount = 0;
  let duplicateCount = 0;

  incomingTransactions.forEach(incomingTx => {
    let duplicateOf: TransactionRecord | undefined = undefined;

    for (let i = 0; i < existingTransactions.length; i++) {
      if (matchedExistingIndices.has(i)) continue;
      if (areTransactionsDuplicate(incomingTx, existingTransactions[i])) {
        matchedExistingIndices.add(i);
        duplicateOf = existingTransactions[i];
        break;
      }
    }

    if (duplicateOf) {
      duplicateCount++;
      previewItems.push({
        transaction: incomingTx,
        isDuplicate: true,
        duplicateOf
      });
    } else {
      addedCount++;
      previewItems.push({
        transaction: incomingTx,
        isDuplicate: false
      });
    }
  });

  return {
    previewItems,
    addedCount,
    duplicateCount,
    totalResultingCount: existingTransactions.length + addedCount
  };
}

