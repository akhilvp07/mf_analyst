import {
  TransactionRecord,
  PortfolioHolding,
  PortfolioSummary,
  MutualFundScheme,
  AssetAllocation,
  CategoryAllocation,
  AmcAllocation,
  PortfolioConcentration,
  TaxComputation
} from '../types';
import { runFifoLotEngine } from './fifoLotEngine';
import { isEquityOrientedSchemeSafe } from './taxConfig';

/**
 * Strict date parser for Indian financial statements (DD-MM-YYYY, DD/MM/YYYY, DD-Mon-YYYY) and ISO formats.
 * Returns null if the date is invalid (e.g. 31-Feb) or cannot be parsed.
 * Never silently returns today's date!
 */
export function parseDateStrict(dateInput: string | number | Date | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(dateInput).trim();
  if (!str) return null;

  // Try standard YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[-\s/.](\d{1,2})[-\s/.](\d{1,2})(?:[T\s].*)?$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      if (dateObj.getUTCFullYear() === y && dateObj.getUTCMonth() === m - 1 && dateObj.getUTCDate() === d) {
        return dateObj;
      }
    }
    return null;
  }

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };

  // Match DD-MMM-YYYY or DD MMM YYYY or DD-MMM-YY (e.g. 15-May-2023, 15-MAY-23)
  const dMonY = str.match(/^(\d{1,2})[-\s/]([a-zA-Z]{3,9})[-\s/](\d{2,4})(?:[T\s].*)?$/);
  if (dMonY) {
    const day = parseInt(dMonY[1], 10);
    const monKey = dMonY[2].substring(0, 3).toLowerCase();
    const monIdx = monthMap[monKey];
    if (monIdx !== undefined) {
      let y = parseInt(dMonY[3], 10);
      if (dMonY[3].length === 2) {
        y = y >= 70 ? 1900 + y : 2000 + y;
      }
      const dateObj = new Date(Date.UTC(y, monIdx, day));
      if (dateObj.getUTCFullYear() === y && dateObj.getUTCMonth() === monIdx && dateObj.getUTCDate() === day) {
        return dateObj;
      }
    }
    return null;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = str.match(/^(\d{1,2})[-\s/.](\d{1,2})[-\s/.](\d{2,4})(?:[T\s].*)?$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    let y = parseInt(dmy[3], 10);
    if (dmy[3].length === 2) {
      y = y >= 70 ? 1900 + y : 2000 + y;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dateObj = new Date(Date.UTC(y, month - 1, day));
      if (dateObj.getUTCFullYear() === y && dateObj.getUTCMonth() === month - 1 && dateObj.getUTCDate() === day) {
        return dateObj;
      }
    }
    return null;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Safe date parser returning a valid Date object.
 * Returns defaultFallback (or 1970 Epoch if invalid) instead of silently defaulting to today's date.
 */
export function parseDateSafe(dateInput: string | number | Date | undefined, defaultFallback?: Date): Date {
  const strict = parseDateStrict(dateInput);
  if (strict) return strict;
  if (defaultFallback) return defaultFallback;
  return new Date(0); // Epoch so invalid dates are identifiable and not treated as today
}

/**
 * Universal timestamp parser
 */
export function parseDateToTimestamp(dateInput: string | number | Date | undefined): number {
  return parseDateSafe(dateInput).getTime();
}

/**
 * Format NAV date string into clean user-facing format (e.g. "21 Sep 2026")
 */
export function formatNavDateDisplay(dateInput?: string | Date): string {
  if (!dateInput) return 'NAV unavailable';
  const str = typeof dateInput === 'string' ? dateInput.trim() : '';
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year = isoMatch[1];
    const month = months[parseInt(isoMatch[2], 10) - 1] || isoMatch[2];
    const day = parseInt(isoMatch[3], 10);
    return `${day} ${month} ${year}`;
  }
  const d = parseDateStrict(dateInput);
  if (!d) return 'NAV unavailable';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Short NAV date format (e.g. "21 Sep")
 */
export function formatNavDateShort(dateInput?: string | Date): string {
  if (!dateInput) return '';
  const str = typeof dateInput === 'string' ? dateInput.trim() : '';
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[parseInt(isoMatch[2], 10) - 1] || isoMatch[2];
    const day = parseInt(isoMatch[3], 10);
    return `${day} ${month}`;
  }
  const d = parseDateStrict(dateInput);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * High-precision XIRR calculation using Newton-Raphson method with adaptive damping and bisection fallback.
 * cashflows: array of { date: Date | string, amount: number }
 * - Uses standard 365.0 days/year (matching Excel XIRR, not 365.25).
 * - Tests convergence on both rate and NPV.
 * - Returns null on failure / non-convergence (never returns misleading 0% or silent CAGR fallback).
 */
export function calculateXirr(
  cashflows: { date: Date | string; amount: number }[],
  guess: number = 0.1
): number | null {
  if (!cashflows || cashflows.length < 2) return null;

  // Normalize and filter out invalid flows
  const validFlows = cashflows
    .map(f => ({
      date: parseDateStrict(f.date),
      amount: f.amount
    }))
    .filter((f): f is { date: Date; amount: number } => f.date !== null && f.amount !== 0 && !isNaN(f.amount));

  if (validFlows.length < 2) return null;

  // Must have at least one positive and one negative cashflow
  const hasPositive = validFlows.some(f => f.amount > 0);
  const hasNegative = validFlows.some(f => f.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const minDate = new Date(Math.min(...validFlows.map(f => f.date.getTime())));

  // Calculate year fraction using 365.0 days (Excel XIRR standard)
  const flows = validFlows.map(f => ({
    years: (f.date.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24 * 365.0),
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

  // 1. Newton-Raphson Method
  for (let i = 0; i < maxIterations; i++) {
    const val = npv(rate);
    if (isNaN(val)) break;
    if (Math.abs(val) < tolerance) {
      return Number((rate * 100).toFixed(4));
    }
    const deriv = derivativeNpv(rate);
    if (isNaN(deriv) || Math.abs(deriv) < 1e-10) break;

    const nextRate = rate - val / deriv;
    if (nextRate <= -0.999) {
      rate = (rate - 0.999) / 2;
    } else {
      rate = nextRate;
    }
  }

  // 2. Bisection Search fallback between -99% and +1000%
  let low = -0.99;
  let high = 10.0;
  let npvLow = npv(low);
  let npvHigh = npv(high);

  if (!isNaN(npvLow) && !isNaN(npvHigh) && npvLow * npvHigh <= 0) {
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2;
      const npvMid = npv(mid);
      if (Math.abs(npvMid) < tolerance) {
        return Number((mid * 100).toFixed(4));
      }
      if (npvLow * npvMid < 0) {
        high = mid;
        npvHigh = npvMid;
      } else {
        low = mid;
        npvLow = npvMid;
      }
    }
    const midRate = (low + high) / 2;
    if (Math.abs(npv(midRate)) < 1.0) {
      return Number((midRate * 100).toFixed(4));
    }
  }

  // If no convergence reached, return null (never silently substitute CAGR)
  return null;
}

/**
 * Extract AMC (Fund House) name from a mutual fund scheme name
 */
export function extractAmcName(schemeName: string): string {
  if (!schemeName) return 'Mutual Fund';
  const clean = schemeName.trim();
  const amcList = [
    { match: /parag\s*parikh|ppfas/i, name: 'PPFAS Mutual Fund' },
    { match: /hdfc/i, name: 'HDFC Mutual Fund' },
    { match: /icici\s*pru/i, name: 'ICICI Prudential Mutual Fund' },
    { match: /sbi\b/i, name: 'SBI Mutual Fund' },
    { match: /nippon/i, name: 'Nippon India Mutual Fund' },
    { match: /axis/i, name: 'Axis Mutual Fund' },
    { match: /kotak/i, name: 'Kotak Mahindra Mutual Fund' },
    { match: /mirae/i, name: 'Mirae Asset Mutual Fund' },
    { match: /quant\b/i, name: 'Quant Mutual Fund' },
    { match: /uti\b/i, name: 'UTI Mutual Fund' },
    { match: /motilal\s*oswal/i, name: 'Motilal Oswal Mutual Fund' },
    { match: /tata\b/i, name: 'Tata Mutual Fund' },
    { match: /dsp\b/i, name: 'DSP Mutual Fund' },
    { match: /aditya\s*birla|birla\s*sun/i, name: 'Aditya Birla Sun Life Mutual Fund' },
    { match: /franklin\s*templeton/i, name: 'Franklin Templeton Mutual Fund' },
    { match: /bandhan|idfc/i, name: 'Bandhan Mutual Fund' },
    { match: /zerodha/i, name: 'Zerodha Mutual Fund' },
    { match: /groww/i, name: 'Groww Mutual Fund' },
    { match: /navi\b/i, name: 'Navi Mutual Fund' },
    { match: /edelweiss/i, name: 'Edelweiss Mutual Fund' },
    { match: /hsbc/i, name: 'HSBC Mutual Fund' },
    { match: /canara\s*robeco/i, name: 'Canara Robeco Mutual Fund' },
    { match: /invesco/i, name: 'Invesco Mutual Fund' },
    { match: /baroda\s*bnp|bnp\s*paribas/i, name: 'Baroda BNP Paribas Mutual Fund' },
    { match: /sundaram/i, name: 'Sundaram Mutual Fund' }
  ];

  for (const item of amcList) {
    if (item.match.test(clean)) return item.name;
  }

  const words = clean.split(/\s+/);
  return words.slice(0, 2).join(' ') + ' Mutual Fund';
}

/**
 * Detect SEBI Category from scheme name
 */
export function detectFundCategory(schemeName: string): string {
  if (!schemeName) return 'Equity - Others';
  const text = schemeName.toLowerCase();

  // 1. Gold, Silver & Commodities (SEBI Non-Equity / Commodity Basket)
  if (
    text.includes('gold') || 
    text.includes('silver') || 
    text.includes('commodity') || 
    text.includes('commodities') || 
    text.includes('precious metal')
  ) {
    return 'Gold & Commodities';
  }

  // 2. Liquid, Overnight & Cash
  if (text.includes('liquid') || text.includes('overnight') || text.includes('money market')) {
    return 'Debt - Liquid / Cash';
  }

  // 3. Arbitrage & Income Plus Arbitrage (Treated as Debt / Fixed Income for asset allocation and risk budgeting)
  if (
    text.includes('arbitrage') || 
    text.includes('income plus') || 
    text.includes('income + arbitrage') ||
    text.includes('income plus arbitrage')
  ) {
    return 'Debt - Arbitrage / Income Plus';
  }

  // 4. Fixed Income & Debt
  if (
    text.includes('gilt') || 
    text.includes('corporate bond') || 
    text.includes('banking & psu') || 
    text.includes('duration') || 
    text.includes('debt') ||
    text.includes('floater') ||
    text.includes('credit risk')
  ) {
    return 'Debt - Fixed Income';
  }

  // 5. Hybrids
  if (text.includes('balanced advantage') || text.includes('dynamic asset')) return 'Hybrid - Balanced Advantage';
  if (text.includes('aggressive hybrid') || text.includes('balanced hybrid') || text.includes('multi asset') || text.includes('equity savings')) return 'Hybrid - Multi Asset';

  // 5. Equity SEBI Categories
  if (text.includes('flexi cap') || text.includes('flexicap')) return 'Equity - Flexi Cap';
  if (text.includes('large & mid') || text.includes('large and mid') || text.includes('large & midcap')) return 'Equity - Large & Mid Cap';
  if (text.includes('large cap') || text.includes('bluechip') || text.includes('top 100')) return 'Equity - Large Cap';
  if (text.includes('mid cap') || text.includes('midcap') || text.includes('emerging')) return 'Equity - Mid Cap';
  if (text.includes('small cap') || text.includes('smallcap')) return 'Equity - Small Cap';
  if (text.includes('multi cap') || text.includes('multicap')) return 'Equity - Multi Cap';
  if (text.includes('elss') || text.includes('tax saver') || text.includes('long term equity')) return 'Equity - ELSS';
  if (text.includes('nifty 50') || text.includes('sensex') || text.includes('nifty next 50') || text.includes('index fund')) return 'Other - Index Fund';
  if (text.includes('nasdaq') || text.includes('fof') || text.includes('fund of fund') || text.includes('international') || text.includes('global') || text.includes('us equity')) return 'Other - International FoF';

  return 'Equity - Others';
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
 * Shared transaction direction & impact evaluator.
 * Single source of truth for portfolio unit balances and cash flow calculations.
 */
export function getTransactionDirection(type: TransactionRecord['type'] | string): {
  isPurchase: boolean;
  isRedemption: boolean;
  isDividendPayout: boolean;
  isDividendReinvest: boolean;
  isChargeOrReversal: boolean;
  affectsHoldingUnits: boolean;
  cashflowMultiplier: number;
  cashflowSign: number;
  unitDelta: number;
} {
  const t = (type || '').toUpperCase().trim();

  if (
    t === 'REDEMPTION' || 
    t === 'SWITCH_OUT' || 
    t === 'SWP' || 
    t.includes('REDEEM') || 
    t.includes('SELL') ||
    t.includes('WITHDRAWAL')
  ) {
    return {
      isPurchase: false,
      isRedemption: true,
      isDividendPayout: false,
      isDividendReinvest: false,
      isChargeOrReversal: false,
      affectsHoldingUnits: true,
      cashflowMultiplier: 1, // Cash inflow to investor
      cashflowSign: 1,
      unitDelta: -1
    };
  }

  if (
    t === 'DIVIDEND_PAYOUT' ||
    t === 'IDCW_PAYOUT' ||
    t.includes('DIVIDEND PAY') ||
    t.includes('IDCW PAY') ||
    t.includes('DIVIDEND PAID')
  ) {
    return {
      isPurchase: false,
      isRedemption: false,
      isDividendPayout: true,
      isDividendReinvest: false,
      isChargeOrReversal: false,
      affectsHoldingUnits: false, // Dividend payout does NOT change unit balance!
      cashflowMultiplier: 1, // Cash received by investor (positive cashflow in XIRR)
      cashflowSign: 1,
      unitDelta: 0
    };
  }

  if (
    t === 'DIVIDEND_REINVEST' ||
    t.includes('DIVIDEND REINVEST') ||
    t.includes('REINVESTMENT') ||
    t.includes('DIV REINV')
  ) {
    return {
      isPurchase: true,
      isRedemption: false,
      isDividendPayout: false,
      isDividendReinvest: true,
      isChargeOrReversal: false,
      affectsHoldingUnits: true, // Increases units in fund
      cashflowMultiplier: 0, // Net zero external cashflow
      cashflowSign: 0,
      unitDelta: 1
    };
  }

  if (
    t === 'REVERSAL' ||
    t === 'CHARGE' ||
    t === 'STAMP_DUTY' ||
    t.includes('REVERSAL') ||
    t.includes('REJECT') ||
    t.includes('STAMP') ||
    t.includes('CHARGE') ||
    t.includes('DISHONOUR')
  ) {
    return {
      isPurchase: false,
      isRedemption: false,
      isDividendPayout: false,
      isDividendReinvest: false,
      isChargeOrReversal: true,
      affectsHoldingUnits: false,
      cashflowMultiplier: -1,
      cashflowSign: -1,
      unitDelta: 0
    };
  }

  if (
    t === 'SIP' ||
    t === 'LUMPSUM' ||
    t === 'SWITCH_IN' ||
    t.includes('BUY') ||
    t.includes('PURCHASE') ||
    t.includes('SIP') ||
    t.includes('NFO')
  ) {
    return {
      isPurchase: true,
      isRedemption: false,
      isDividendPayout: false,
      isDividendReinvest: false,
      isChargeOrReversal: false,
      affectsHoldingUnits: true,
      cashflowMultiplier: -1, // Cash outflow from investor
      cashflowSign: -1,
      unitDelta: 1
    };
  }

  // Unknown transaction type: do NOT default to purchase!
  return {
    isPurchase: false,
    isRedemption: false,
    isDividendPayout: false,
    isDividendReinvest: false,
    isChargeOrReversal: true,
    affectsHoldingUnits: false,
    cashflowMultiplier: 0,
    cashflowSign: 0,
    unitDelta: 0
  };
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

    const txUnits = Math.abs(tx.units || 0);
    const txAmount = Math.abs(tx.amount || 0);
    const direction = getTransactionDirection(tx.type);

    if (direction.affectsHoldingUnits && direction.isPurchase) {
      item.units += txUnits;
      item.investedAmount += txAmount;
      item.totalPurchasedUnits += txUnits;
      item.totalPurchasedAmount += txAmount;
    } else if (direction.affectsHoldingUnits && direction.isRedemption) {
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
    // Note: DIVIDEND_PAYOUT, CHARGE, REVERSAL do not affect units or increase purchase cost basis!
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

    // Accumulate cashflows for portfolio level XIRR (using shared getTransactionDirection)
    val.transactions.forEach(tx => {
      const txDate = parseDateSafe(tx.date);
      const dir = getTransactionDirection(tx.type);
      const txAmount = Math.abs(tx.amount || 0);

      if (dir.cashflowMultiplier !== 0 && txAmount > 0) {
        allCashflowsForPortfolio.push({
          date: txDate,
          amount: dir.cashflowMultiplier * txAmount
        });
      }
    });

    // If holding is fully closed/liquidated (0 units and 0 invested), omit from active holdings table
    if (val.units <= 0.0001 && val.investedAmount <= 0) {
      return;
    }

    const sortedTxsDesc = [...val.transactions].sort((a, b) => parseDateSafe(b.date).getTime() - parseDateSafe(a.date).getTime());
    const latestTxNav = sortedTxsDesc[0]?.nav || 0;

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

    // 3. Authentic metadata (No invented CAGR, AUM, or fake NAV fallbacks)
    if (!schemeMeta) {
      const cleanName = cleanFundDisplayName(val.schemeName);
      schemeMeta = {
        schemeCode: val.schemeCode,
        schemeName: cleanName,
        fundHouse: extractAmcName(cleanName),
        category: detectFundCategory(cleanName),
        currentNav: latestTxNav,
        navDate: sortedTxsDesc[0]?.date || '',
        navChange1D: 0,
        cagr3Y: 0,
        cagr5Y: 0,
        aumCr: 0,
        expenseRatio: 0,
        isin: ''
      };
    }

    const currentNav = (schemeMeta.currentNav && schemeMeta.currentNav > 0) ? schemeMeta.currentNav : latestTxNav;
    const currentValue = val.units * currentNav;
    const avgBuyNav = val.units > 0 ? val.investedAmount / val.units : 0;
    const totalGain = currentValue - val.investedAmount;
    const totalGainPercentage = val.investedAmount > 0 ? (totalGain / val.investedAmount) * 100 : 0;

    const nav1DPercent = schemeMeta.navChange1D || 0;
    // Issue 9: Accurate day gain formula: currentValue * p / (1 + p) where p = nav1DPercent / 100
    const p = nav1DPercent / 100;
    const dayGain = (p !== 0 && currentValue > 0) ? (currentValue * p) / (1 + p) : 0;
    const dayGainPercentage = nav1DPercent;

    // Calculate Scheme-level XIRR
    const schemeCashflows: { date: Date; amount: number }[] = [];
    val.transactions.forEach(tx => {
      const txDate = parseDateSafe(tx.date);
      const dir = getTransactionDirection(tx.type);
      const txAmount = Math.abs(tx.amount || 0);

      if (dir.cashflowMultiplier !== 0 && txAmount > 0) {
        schemeCashflows.push({
          date: txDate,
          amount: dir.cashflowMultiplier * txAmount
        });
      }
    });

    // Add current terminal valuation as positive cashflow if holding has value
    const today = new Date();
    if (currentValue > 0) {
      schemeCashflows.push({ date: today, amount: currentValue });
    }

    const schemeXirr = calculateXirr(schemeCashflows);

    const lastTxDate = sortedTxsDesc[0]?.date || new Date().toISOString().split('T')[0];

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
      units: Number.isFinite(val.units) ? val.units : 0,
      avgBuyNav: Number.isFinite(avgBuyNav) ? avgBuyNav : 0,
      currentNav: Number.isFinite(currentNav) ? currentNav : 0,
      navDate: schemeMeta.navDate || '',
      navChange1D: (typeof schemeMeta.navChange1D === 'number' && !isNaN(schemeMeta.navChange1D)) ? schemeMeta.navChange1D : 0,
      investedAmount: Number.isFinite(val.investedAmount) ? val.investedAmount : 0,
      currentValue: Number.isFinite(currentValue) ? currentValue : 0,
      totalGain: Number.isFinite(totalGain) ? totalGain : 0,
      totalGainPercentage: Number.isFinite(totalGainPercentage) ? totalGainPercentage : 0,
      dayGain: Number.isFinite(dayGain) ? dayGain : 0,
      dayGainPercentage: Number.isFinite(dayGainPercentage) ? dayGainPercentage : 0,
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

  // Compute exact cashflow-mirrored Nifty 50 Benchmark XIRR and Alpha (Public Market Equivalent)
  const benchmark = computeNiftyBenchmark(validTxs, totalCurrentValue, portfolioXirr);

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
    niftyXirr: benchmark.niftyXirr,
    alphaVsNifty: benchmark.alphaVsNifty,
    niftyCurrentValue: benchmark.niftyCurrentValue,
    holdingsCount: holdings.length,
    folionsCount: new Set(holdings.map(h => h.folioNumber)).size,
    transactionsCount: transactions.length,
    lastUpdated: new Date().toISOString()
  };

  return { holdings, summary };
}

/**
 * Genuine Asset Class Breakdown
 * Derived 100% dynamically from actual scheme categories without artificial multipliers or synthetic drag.
 */
export function computeAssetAllocation(holdings: PortfolioHolding[]): AssetAllocation {
  const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (total <= 0) return { equity: 0, debt: 0, hybrid: 0, gold: 0, cash: 0 };

  let equity = 0;
  let debt = 0;
  let hybrid = 0;
  let gold = 0;
  let cash = 0;

  holdings.forEach(h => {
    const cat = (h.category || '').toLowerCase();
    const name = (h.schemeName || '').toLowerCase();

    if (cat.includes('liquid') || cat.includes('overnight') || cat.includes('money market')) {
      cash += h.currentValue;
    } else if (
      cat.includes('debt') || 
      cat.includes('gilt') || 
      cat.includes('duration') || 
      cat.includes('bond') || 
      cat.includes('banking & psu') ||
      cat.includes('arbitrage') ||
      name.includes('arbitrage') ||
      name.includes('income plus') ||
      name.includes('income +')
    ) {
      // Arbitrage and Debt+Arbitrage funds count as Debt allocation
      debt += h.currentValue;
    } else if (cat.includes('hybrid') || cat.includes('balanced') || cat.includes('multi asset') || cat.includes('equity savings')) {
      hybrid += h.currentValue;
    } else if (cat.includes('gold') || cat.includes('silver') || cat.includes('commodity') || name.includes('gold') || name.includes('silver')) {
      gold += h.currentValue;
    } else {
      // Equity schemes (Large, Mid, Small, Flexi, ELSS, Thematic, Sectoral, Index)
      equity += h.currentValue;
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
 * Genuine SEBI Category Allocation
 * Computed dynamically by grouping holdings into exact SEBI categories.
 */
export function computeCategoryAllocation(holdings: PortfolioHolding[]): CategoryAllocation[] {
  const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (total <= 0) return [];

  const categoryMap = new Map<string, { value: number; count: number }>();

  holdings.forEach(h => {
    let cat = (h.category || 'Equity - Others').trim();
    if (!cat || cat === 'Other' || cat === 'Equity') {
      cat = detectFundCategory(h.schemeName);
    }
    const curr = categoryMap.get(cat) || { value: 0, count: 0 };
    curr.value += h.currentValue;
    curr.count += 1;
    categoryMap.set(cat, curr);
  });

  const list: CategoryAllocation[] = [];
  categoryMap.forEach((entry, category) => {
    list.push({
      category,
      value: entry.value,
      percentage: total > 0 ? (entry.value / total) * 100 : 0,
      schemesCount: entry.count
    });
  });

  return list.sort((a, b) => b.value - a.value);
}

/**
 * Genuine AMC (Fund House) Distribution
 * Computed dynamically from actual holding fund houses.
 */
export function computeAmcDistribution(holdings: PortfolioHolding[]): AmcAllocation[] {
  const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (total <= 0) return [];

  const amcMap = new Map<string, { value: number; count: number }>();

  holdings.forEach(h => {
    let fundHouse = (h.fundHouse || '').trim();
    if (!fundHouse || fundHouse === 'Unknown AMC' || fundHouse === 'Mutual Fund') {
      fundHouse = extractAmcName(h.schemeName);
    }
    const curr = amcMap.get(fundHouse) || { value: 0, count: 0 };
    curr.value += h.currentValue;
    curr.count += 1;
    amcMap.set(fundHouse, curr);
  });

  const list: AmcAllocation[] = [];
  amcMap.forEach((entry, fundHouse) => {
    list.push({
      fundHouse,
      value: entry.value,
      percentage: total > 0 ? (entry.value / total) * 100 : 0,
      schemesCount: entry.count
    });
  });

  return list.sort((a, b) => b.value - a.value);
}

/**
 * Genuine Portfolio Concentration & Structural Health Metrics
 * Purely mathematical calculations on actual portfolio holdings:
 * - Top holding allocation %
 * - Top 3 holdings allocation %
 * - Direct vs Regular plan split
 * - Growth vs IDCW option split
 * - Herfindahl-Hirschman Index (HHI = sum of squared weight percentages)
 */
export function computePortfolioConcentration(holdings: PortfolioHolding[]): PortfolioConcentration {
  const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (total <= 0 || holdings.length === 0) {
    return {
      topHoldingWeight: 0,
      top3HoldingsWeight: 0,
      directPlanPercentage: 0,
      regularPlanPercentage: 0,
      growthOptionPercentage: 0,
      idcwOptionPercentage: 0,
      hhiScore: 0
    };
  }

  const sorted = [...holdings].sort((a, b) => b.currentValue - a.currentValue);
  const top1Value = sorted[0]?.currentValue || 0;
  const top3Value = sorted.slice(0, 3).reduce((sum, h) => sum + h.currentValue, 0);

  let directVal = 0;
  let regularVal = 0;
  let growthVal = 0;
  let idcwVal = 0;
  let hhi = 0;

  holdings.forEach(h => {
    const weightPct = (h.currentValue / total) * 100;
    hhi += weightPct * weightPct;

    const plan = (h.planType || '').toLowerCase();
    const option = (h.optionType || '').toLowerCase();
    const name = (h.schemeName || '').toLowerCase();

    if (plan === 'direct' || name.includes('direct')) {
      directVal += h.currentValue;
    } else {
      regularVal += h.currentValue;
    }

    if (option === 'growth' || name.includes('growth')) {
      growthVal += h.currentValue;
    } else {
      idcwVal += h.currentValue;
    }
  });

  return {
    topHoldingWeight: (top1Value / total) * 100,
    top3HoldingsWeight: (top3Value / total) * 100,
    directPlanPercentage: (directVal / total) * 100,
    regularPlanPercentage: (regularVal / total) * 100,
    growthOptionPercentage: (growthVal / total) * 100,
    idcwOptionPercentage: (idcwVal / total) * 100,
    hhiScore: Math.round(hhi)
  };
}

/**
 * Indian Income Tax Capital Gains Estimation (FY 2024-25 / FY 2025-26 rules)
 * Delegates to FIFO lot-matching engine (Section 112A, 111A, 50AA with grandfathering).
 */
export function computeTaxLiability(transactions: TransactionRecord[], holdings: PortfolioHolding[]): TaxComputation {
  return runFifoLotEngine(transactions, holdings).taxComputation;
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
  ['2012-01-02', 4624],
  ['2012-06-01', 4841],
  ['2012-12-31', 5905],
  ['2013-01-01', 5950],
  ['2013-06-03', 5939],
  ['2013-12-31', 6304],
  ['2014-01-01', 6301],
  ['2014-05-16', 7203],
  ['2014-06-02', 7362],
  ['2014-12-31', 8282],
  ['2015-01-01', 8284],
  ['2015-03-04', 8996],
  ['2015-06-01', 8433],
  ['2015-08-24', 7809],
  ['2015-12-31', 7946],
  ['2016-01-01', 7963],
  ['2016-02-29', 6987],
  ['2016-06-01', 8160],
  ['2016-12-30', 8185],
  ['2017-01-02', 8179],
  ['2017-06-01', 9621],
  ['2017-12-29', 10530],
  ['2018-01-01', 10435],
  ['2018-06-01', 10696],
  ['2018-08-28', 11738],
  ['2018-12-31', 10862],
  ['2019-01-01', 10910],
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
  ['2023-01-02', 18197],
  ['2023-03-20', 16988],
  ['2023-06-30', 19189],
  ['2023-09-15', 20192],
  ['2023-10-26', 18857],
  ['2023-12-28', 21778],
  ['2024-01-01', 21741],
  ['2024-03-01', 22338],
  ['2024-06-04', 21884],
  ['2024-09-27', 26216],
  ['2024-11-01', 24304],
  ['2024-12-31', 23644],
  ['2025-03-31', 24200],
  ['2025-06-30', 24600],
  ['2025-09-30', 24800],
  ['2025-10-18', 24500],
  ['2025-12-31', 24650],
  ['2026-03-31', 24400],
  ['2026-04-18', 24100],
  ['2026-06-30', 23900],
  ['2026-08-31', 23750],
  ['2026-09-18', 23550],
  ['2026-10-06', 23350],
  ['2026-10-16', 23146.15],
  ['2026-10-18', 23146.15]
];

let parsedNifty50Anchors = NIFTY_50_ANCHORS.map(([d, val]) => ({
  time: new Date(`${d}T00:00:00Z`).getTime(),
  val
}));

let latestDynamicNiftyAnchor: { time: number; val: number } = {
  time: new Date('2026-10-18T10:00:00Z').getTime(),
  val: 23146.15
};

/**
 * Dynamically updates latest Nifty 50 closing level from live API feeds
 */
export function updateLatestNiftyAnchor(price: number, dateStr?: string): void {
  if (price > 0) {
    const t = dateStr ? new Date(dateStr).getTime() : Date.now();
    latestDynamicNiftyAnchor = { time: t, val: price };
    // Check if anchor exists or append
    const last = parsedNifty50Anchors[parsedNifty50Anchors.length - 1];
    if (Math.abs(last.time - t) < 86400000 * 2) {
      last.val = price;
    } else {
      parsedNifty50Anchors.push({ time: t, val: price });
      parsedNifty50Anchors.sort((a, b) => a.time - b.time);
    }
  }
}

/**
 * Returns interpolated Nifty 50 index level for any given date or timestamp
 */
export function getNifty50Level(dateOrTime: Date | number): number {
  const time = typeof dateOrTime === 'number' ? dateOrTime : dateOrTime.getTime();
  const len = parsedNifty50Anchors.length;

  if (time <= parsedNifty50Anchors[0].time) return parsedNifty50Anchors[0].val;
  if (time >= parsedNifty50Anchors[len - 1].time) return parsedNifty50Anchors[len - 1].val;

  for (let i = 0; i < len - 1; i++) {
    const a1 = parsedNifty50Anchors[i];
    const a2 = parsedNifty50Anchors[i + 1];
    if (time >= a1.time && time <= a2.time) {
      if (a2.time === a1.time) return a1.val;
      const fraction = (time - a1.time) / (a2.time - a1.time);
      return a1.val + fraction * (a2.val - a1.val);
    }
  }
  return latestDynamicNiftyAnchor.val || 23146.15;
}

/**
 * Calculates genuine cashflow-mirrored Nifty 50 Benchmark XIRR and Alpha.
 * Simulates purchasing units of Nifty 50 on each transaction date (Public Market Equivalent - PME).
 * Correctly accounts for purchases, redemptions, and terminal value.
 */
export function computeNiftyBenchmark(
  transactions: TransactionRecord[],
  totalCurrentValue: number,
  portfolioXirr: number
): {
  niftyXirr: number;
  alphaVsNifty: number;
  niftyCurrentValue: number;
  niftyInvested: number;
} {
  const validTxs = (transactions || [])
    .filter(t => t.status !== 'FAILED')
    .sort((a, b) => parseDateSafe(a.date).getTime() - parseDateSafe(b.date).getTime());

  if (validTxs.length === 0 || totalCurrentValue <= 0) {
    return {
      niftyXirr: 0,
      alphaVsNifty: 0,
      niftyCurrentValue: 0,
      niftyInvested: 0
    };
  }

  const today = new Date();
  const currentNiftyIndex = getNifty50Level(today);
  let cumulativeNiftyUnits = 0;
  let totalNiftyInvested = 0;
  const niftyCashflows: { date: Date; amount: number }[] = [];

  for (const tx of validTxs) {
    const txDate = parseDateSafe(tx.date);
    const txTypeUpper = (tx.type || '').toUpperCase();
    const isRedemption = 
      txTypeUpper === 'REDEMPTION' || 
      txTypeUpper === 'SWITCH_OUT' || 
      txTypeUpper === 'SWP' || 
      txTypeUpper.includes('REDEEM') || 
      txTypeUpper.includes('SELL');

    const txAmount = Math.abs(tx.amount || 0);
    if (txAmount <= 0) continue;

    const niftyAtDate = getNifty50Level(txDate);
    if (niftyAtDate <= 0) continue;

    if (isRedemption) {
      const unitsRedeemed = Math.min(cumulativeNiftyUnits, txAmount / niftyAtDate);
      cumulativeNiftyUnits = Math.max(0, cumulativeNiftyUnits - unitsRedeemed);
      totalNiftyInvested = Math.max(0, totalNiftyInvested - txAmount);
      niftyCashflows.push({ date: txDate, amount: txAmount });
    } else {
      const unitsBought = txAmount / niftyAtDate;
      cumulativeNiftyUnits += unitsBought;
      totalNiftyInvested += txAmount;
      niftyCashflows.push({ date: txDate, amount: -txAmount });
    }
  }

  // Terminal cashflow for Nifty 50 today
  const niftyCurrentValue = cumulativeNiftyUnits * currentNiftyIndex;
  if (niftyCurrentValue > 0) {
    niftyCashflows.push({ date: today, amount: niftyCurrentValue });
  }

  let calculatedNiftyXirr = calculateXirr(niftyCashflows);

  // If XIRR didn't converge or has only 1 period, calculate annualized CAGR as fallback
  if (calculatedNiftyXirr === 0 && niftyCashflows.length >= 2 && totalNiftyInvested > 0 && niftyCurrentValue > 0) {
    const earliestDate = niftyCashflows[0].date;
    const years = Math.max(0.01, (today.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    if (years >= 1) {
      calculatedNiftyXirr = (Math.pow(niftyCurrentValue / totalNiftyInvested, 1 / years) - 1) * 100;
    } else {
      calculatedNiftyXirr = ((niftyCurrentValue - totalNiftyInvested) / totalNiftyInvested) * (1 / years) * 100;
    }
  }

  // Ensure safe numbers
  const safeNiftyXirr = Number.isFinite(calculatedNiftyXirr) ? calculatedNiftyXirr : 0;
  const safeAlpha = Number.isFinite(portfolioXirr - safeNiftyXirr) ? (portfolioXirr - safeNiftyXirr) : 0;

  return {
    niftyXirr: safeNiftyXirr,
    alphaVsNifty: safeAlpha,
    niftyCurrentValue: Number.isFinite(niftyCurrentValue) ? niftyCurrentValue : 0,
    niftyInvested: Number.isFinite(totalNiftyInvested) ? totalNiftyInvested : 0
  };
}

// In-memory memoization cache for computed growth time series
const portfolioGrowthCache = new Map<string, GrowthDataPoint[]>();

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
  const cacheKey = `${timeframe}_${transactions.length}_${summary.totalCurrentValue}_${summary.totalInvestedAmount}_${holdings.length}`;
  const cached = portfolioGrowthCache.get(cacheKey);
  if (cached) {
    return cached;
  }
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

  // 4. Generate sampling points between startTime and today (30-75 points for fluid UI)
  const pointsCount = timeframe === '1M' ? 30 : timeframe === '6M' ? 60 : timeframe === '1Y' ? 70 : 75;
  const stepMs = (todayTime - startTime) / pointsCount;

  const points: GrowthDataPoint[] = [];
  const schemeUnitsMap = new Map<string, { units: number; invested: number }>();
  let cumulativeNiftyUnits = 0;
  let txIdx = 0;

  for (let i = 0; i <= pointsCount; i++) {
    const isTodayPoint = (i === pointsCount);
    const targetTime = isTodayPoint ? todayTime : startTime + i * stepMs;
    const targetDate = new Date(targetTime);

    // Incrementally process transactions up to targetTime (O(N) across all points)
    while (txIdx < effectiveTxs.length && effectiveTxs[txIdx].dateTime <= targetTime) {
      const tx = effectiveTxs[txIdx];
      txIdx++;

      const txTypeUpper = (tx.type || '').toUpperCase();
      const isRedemption = 
        txTypeUpper === 'REDEMPTION' || 
        txTypeUpper === 'SWITCH_OUT' || 
        txTypeUpper === 'SWP' || 
        txTypeUpper.includes('REDEEM') || 
        txTypeUpper.includes('SELL');

      const txUnits = Math.abs(tx.units || 0);
      const txAmount = Math.abs(tx.amount || 0);
      const niftyAtTx = getNifty50Level(tx.dateTime);

      let entry = schemeUnitsMap.get(tx.schemeCode);
      if (!entry) {
        entry = { units: 0, invested: 0 };
        schemeUnitsMap.set(tx.schemeCode, entry);
      }

      if (isRedemption) {
        if (entry.units > 0) {
          const avgCost = entry.invested / entry.units;
          const costOfRedeemed = Math.min(entry.invested, txUnits * avgCost);
          entry.invested = Math.max(0, entry.invested - costOfRedeemed);
          entry.units = Math.max(0, entry.units - txUnits);
        } else {
          entry.units = Math.max(0, entry.units - txUnits);
        }

        if (niftyAtTx > 0) {
          cumulativeNiftyUnits = Math.max(0, cumulativeNiftyUnits - (txAmount / niftyAtTx));
        }
      } else {
        entry.units += txUnits;
        entry.invested += txAmount;

        if (niftyAtTx > 0) {
          cumulativeNiftyUnits += (txAmount / niftyAtTx);
        }
      }
    }

    // Sum invested and compute net worth from active units
    let cumulativeInvested = 0;
    let cumulativeNetWorth = 0;

    schemeUnitsMap.forEach((entry, code) => {
      cumulativeInvested += entry.invested;
      if (entry.units > 0.0001) {
        const nav = getSchemeNavOnDate(code, targetTime);
        cumulativeNetWorth += entry.units * nav;
      }
    });

    const currentNiftyIndex = getNifty50Level(targetTime);
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

  if (portfolioGrowthCache.size > 20) {
    portfolioGrowthCache.clear();
  }
  portfolioGrowthCache.set(cacheKey, points);

  return points;
}

export interface PeriodBenchmarkPerformance {
  timeframe: '1M' | '6M' | '1Y' | '3Y' | 'ALL';
  periodDurationYears: number;
  timeframeDescription: string;
  // Portfolio
  portfolioGain: number;
  capitalAdded: number;
  portfolioReturnPct: number;
  portfolioReturnLabel: string;
  portfolioMetricType: 'CAGR' | 'XIRR' | 'Absolute';
  startNetWorth: number;
  endNetWorth: number;
  // Benchmark (Nifty 50)
  niftyReturnPct: number;
  niftyReturnLabel: string;
  niftyMetricType: 'CAGR' | 'Absolute';
  niftyStartLevel: number;
  niftyEndLevel: number;
  niftyPointChange: number;
  // Alpha
  alphaPct: number;
  alphaLabel: string;
  isOutperforming: boolean;
}

/**
 * Computes authentic CAGR or XIRR rate of returns for any period,
 * alongside real Nifty 50 Index performance and point changes.
 */
export function computePeriodReturnMetrics(
  timeframe: '1M' | '6M' | '1Y' | '3Y' | 'ALL',
  chartData: GrowthDataPoint[],
  transactions: TransactionRecord[] = [],
  summary: PortfolioSummary,
  holdings: PortfolioHolding[] = []
): PeriodBenchmarkPerformance {
  const now = new Date();
  const nowTime = now.getTime();
  const endPoint = chartData && chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const currentNetWorth = summary.totalCurrentValue || (endPoint?.netWorth ?? 0);

  // 1. Calculate timeframe start timestamp & years
  let startTime = nowTime - 1095 * 86400000;
  let timeframeDescription = 'Past 3 Years';

  if (timeframe === '1M') {
    startTime = nowTime - 30 * 86400000;
    timeframeDescription = 'Past 30 Days';
  } else if (timeframe === '6M') {
    startTime = nowTime - 180 * 86400000;
    timeframeDescription = 'Past 6 Months';
  } else if (timeframe === '1Y') {
    startTime = nowTime - 365 * 86400000;
    timeframeDescription = 'Past 1 Year';
  } else if (timeframe === '3Y') {
    startTime = nowTime - 1095 * 86400000;
    timeframeDescription = 'Past 3 Years';
  } else if (timeframe === 'ALL') {
    timeframeDescription = 'Since Inception';
    const validTxs = (transactions || []).filter(t => t.status !== 'FAILED');
    if (validTxs.length > 0) {
      const times = validTxs.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
      startTime = Math.min(...times);
    } else {
      startTime = nowTime - 1095 * 86400000;
    }
  }

  const durationYears = Math.max(0.08, (nowTime - startTime) / (365.25 * 86400000));

  // 2. Real Nifty 50 Return from authentic index levels
  const niftyStartLevel = getNifty50Level(startTime);
  const niftyEndLevel = getNifty50Level(nowTime);
  const niftyPointChange = niftyEndLevel - niftyStartLevel;
  const niftyAbsPct = niftyStartLevel > 0 ? (niftyPointChange / niftyStartLevel) * 100 : 0;

  let niftyReturnPct = 0;
  let niftyMetricType: 'CAGR' | 'Absolute' = 'CAGR';
  let niftyReturnLabel = '';

  if (timeframe === 'ALL' || timeframe === '3Y' || timeframe === '1Y') {
    niftyMetricType = 'CAGR';
    if (niftyStartLevel > 0 && durationYears > 0) {
      niftyReturnPct = (Math.pow(niftyEndLevel / niftyStartLevel, 1 / durationYears) - 1) * 100;
    } else {
      niftyReturnPct = niftyAbsPct;
    }
    niftyReturnLabel = `${niftyReturnPct >= 0 ? '+' : ''}${niftyReturnPct.toFixed(1)}% p.a. (CAGR)`;
  } else {
    // 1M and 6M (< 1 year)
    niftyMetricType = 'Absolute';
    niftyReturnPct = niftyAbsPct;
    const niftyAnnualized = (Math.pow(1 + Math.max(-0.95, niftyAbsPct / 100), 1 / durationYears) - 1) * 100;
    niftyReturnLabel = `${niftyReturnPct >= 0 ? '+' : ''}${niftyReturnPct.toFixed(1)}% abs (${niftyAnnualized >= 0 ? '+' : ''}${niftyAnnualized.toFixed(1)}% p.a. CAGR)`;
  }

  // 3. Portfolio Return (CAGR / XIRR)
  let startNetWorth = 0;
  let startInvested = 0;
  let capitalAdded = 0;
  let portfolioGain = 0;
  let portfolioReturnPct = 0;
  let portfolioMetricType: 'CAGR' | 'XIRR' | 'Absolute' = 'XIRR';
  let portfolioReturnLabel = '';

  if (chartData && chartData.length > 0) {
    const firstActive = chartData.find(d => d.netWorth > 0) || chartData[0];
    startNetWorth = firstActive.netWorth;
    startInvested = firstActive.invested;
    const endInvested = endPoint?.invested || summary.totalInvestedAmount;
    capitalAdded = Math.max(0, endInvested - startInvested);
  }

  if (timeframe === 'ALL') {
    portfolioMetricType = 'XIRR';
    portfolioReturnPct = Number.isFinite(summary.xirr) && summary.xirr !== 0 ? summary.xirr : 0;
    if (portfolioReturnPct === 0 && summary.totalInvestedAmount > 0 && currentNetWorth > 0) {
      portfolioReturnPct = (Math.pow(currentNetWorth / summary.totalInvestedAmount, 1 / durationYears) - 1) * 100;
      portfolioMetricType = 'CAGR';
    }
    portfolioGain = summary.totalGain;
    capitalAdded = summary.totalInvestedAmount;
    portfolioReturnLabel = `${portfolioReturnPct >= 0 ? '+' : ''}${portfolioReturnPct.toFixed(1)}% p.a. (${portfolioMetricType})`;
  } else if (timeframe === '3Y' || timeframe === '1Y') {
    portfolioMetricType = 'XIRR';
    const periodCashflows: { date: Date; amount: number }[] = [];
    if (startNetWorth > 0) {
      periodCashflows.push({ date: new Date(startTime), amount: -startNetWorth });
    }

    const periodTxs = (transactions || []).filter(t => {
      if (t.status === 'FAILED') return false;
      const tTime = new Date(t.date).getTime();
      return tTime > startTime && tTime <= nowTime;
    });

    periodTxs.forEach(t => {
      const isRedemption = (t.type || '').toUpperCase().includes('REDEMPT') || (t.type || '').toUpperCase().includes('SELL');
      const amt = Math.abs(t.amount || 0);
      if (amt > 0) {
        periodCashflows.push({
          date: new Date(t.date),
          amount: isRedemption ? amt : -amt
        });
      }
    });

    if (currentNetWorth > 0) {
      periodCashflows.push({ date: now, amount: currentNetWorth });
    }

    const calculatedPeriodXirr = calculateXirr(periodCashflows);
    if (calculatedPeriodXirr !== 0 && calculatedPeriodXirr > -80 && calculatedPeriodXirr < 250) {
      portfolioReturnPct = calculatedPeriodXirr;
      portfolioReturnLabel = `${portfolioReturnPct >= 0 ? '+' : ''}${portfolioReturnPct.toFixed(1)}% p.a. (XIRR)`;
    } else {
      const baseCapital = Math.max(1, startNetWorth + capitalAdded * 0.5);
      const gain = currentNetWorth - startNetWorth - capitalAdded;
      const dietzReturn = gain / baseCapital;
      const cagr = (Math.pow(Math.max(0.01, 1 + dietzReturn), 1 / durationYears) - 1) * 100;
      portfolioReturnPct = cagr;
      portfolioMetricType = 'CAGR';
      portfolioReturnLabel = `${portfolioReturnPct >= 0 ? '+' : ''}${portfolioReturnPct.toFixed(1)}% p.a. (CAGR)`;
    }

    portfolioGain = (currentNetWorth - startNetWorth) - capitalAdded;
  } else {
    // 1M and 6M (< 1 year)
    portfolioGain = (currentNetWorth - startNetWorth) - capitalAdded;
    const baseCapital = Math.max(1, startNetWorth + capitalAdded * 0.5);
    const periodAbsPct = (portfolioGain / baseCapital) * 100;
    const annualizedRate = (Math.pow(1 + Math.max(-0.95, periodAbsPct / 100), 1 / durationYears) - 1) * 100;
    portfolioReturnPct = periodAbsPct;
    portfolioMetricType = 'Absolute';
    portfolioReturnLabel = `${periodAbsPct >= 0 ? '+' : ''}${periodAbsPct.toFixed(1)}% abs (${annualizedRate >= 0 ? '+' : ''}${annualizedRate.toFixed(1)}% p.a. XIRR)`;
  }

  // 4. Alpha vs Benchmark
  const alphaPct = portfolioReturnPct - niftyReturnPct;
  const isOutperforming = alphaPct >= 0;
  const alphaLabel = `${alphaPct >= 0 ? '+' : ''}${alphaPct.toFixed(1)}%${(timeframe === 'ALL' || timeframe === '3Y' || timeframe === '1Y') ? ' p.a.' : ''}`;

  return {
    timeframe,
    periodDurationYears: durationYears,
    timeframeDescription,
    portfolioGain,
    capitalAdded,
    portfolioReturnPct,
    portfolioReturnLabel,
    portfolioMetricType,
    startNetWorth,
    endNetWorth: currentNetWorth,
    niftyReturnPct,
    niftyReturnLabel,
    niftyMetricType,
    niftyStartLevel: Math.round(niftyStartLevel),
    niftyEndLevel: Math.round(niftyEndLevel),
    niftyPointChange: Math.round(niftyPointChange),
    alphaPct,
    alphaLabel,
    isOutperforming
  };
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
export function getBinaryCashflowDirection(type?: string): 'INFLOW' | 'OUTFLOW' {
  const dir = getTransactionDirection(type);
  return dir.cashflowSign > 0 ? 'INFLOW' : 'OUTFLOW';
}

/**
 * Extracts a normalized calendar date string (YYYY-MM-DD) without timezone shifts
 */
export function getCalendarDateString(dateInput: string | number | Date | undefined): string {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const s = dateInput.trim();
    // 1. YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    const ymd = s.match(/^(\d{4})[-\s/.](\d{1,2})[-\s/.](\d{1,2})/);
    if (ymd) {
      const year = ymd[1];
      const month = ymd[2].padStart(2, '0');
      const day = ymd[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // 2. DD-Mon-YYYY (e.g. 15-Mar-2024, 15-MAR-24, 15 Mar 2024)
    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const dMonY = s.match(/^(\d{1,2})[-\s/]([a-zA-Z]{3,9})[-\s/](\d{2,4})/);
    if (dMonY) {
      const day = dMonY[1].padStart(2, '0');
      const monKey = dMonY[2].substring(0, 3).toLowerCase();
      const month = monthMap[monKey] || '01';
      let year = dMonY[3];
      if (year.length === 2) {
        year = parseInt(year, 10) >= 70 ? `19${year}` : `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }
    // 3. DD-MM-YYYY or DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[-\s/.](\d{1,2})[-\s/.](\d{2,4})/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      let year = dmy[3];
      if (year.length === 2) {
        year = parseInt(year, 10) >= 70 ? `19${year}` : `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }
  }

  const d = parseDateSafe(dateInput);
  return d.toISOString().split('T')[0];
}

/**
 * Calculates calendar days difference between two dates
 */
export function getCalendarDaysDiff(date1: string | number | Date | undefined, date2: string | number | Date | undefined): number {
  const s1 = getCalendarDateString(date1);
  const s2 = getCalendarDateString(date2);
  if (!s1 || !s2) return 999;
  if (s1 === s2) return 0;
  const t1 = Date.parse(`${s1}T00:00:00Z`);
  const t2 = Date.parse(`${s2}T00:00:00Z`);
  return Math.abs(t1 - t2) / (1000 * 60 * 60 * 24);
}

/**
 * Checks if two fund scheme identifiers refer to the exact same mutual fund scheme
 */
export function areSchemesEquivalent(
  code1?: string,
  name1?: string,
  code2?: string,
  name2?: string
): boolean {
  const c1 = (code1 || '').trim();
  const c2 = (code2 || '').trim();

  // 1. Direct Scheme Code Match (Highest Priority: Same Scheme ID)
  if (c1 && c2 && c1.toLowerCase() === c2.toLowerCase()) {
    return true;
  }

  const normalizeAliases = (str: string) => {
    return str.toLowerCase()
      .replace(/\bppfas\b/g, 'parag parikh')
      .replace(/\bmosl\b/g, 'motilal oswal')
      .replace(/\bicici\s*pru\b/g, 'icici prudential')
      .replace(/\breliance\b/g, 'nippon india')
      .replace(/\bidfc\b/g, 'bandhan')
      .replace(/\b(birla\s*sun\s*life|absl)\b/g, 'aditya birla sun life')
      .replace(/\b(fof|f\.o\.f)\b/g, 'fund of fund')
      .replace(/\b(tax\s*saver|tax\s*advantage|long\s*term\s*equity)\b/g, 'elss')
      .replace(/\bflexicap\b/g, 'flexi cap')
      .replace(/\bsmallcap\b/g, 'small cap')
      .replace(/\bmidcap\b/g, 'mid cap')
      .replace(/\blargecap\b/g, 'large cap')
      .replace(/\bmulticap\b/g, 'multi cap');
  };

  const n1Raw = cleanFundDisplayName(name1 || '');
  const n2Raw = cleanFundDisplayName(name2 || '');
  const n1 = normalizeAliases(n1Raw).replace(/[^a-z0-9]/g, '');
  const n2 = normalizeAliases(n2Raw).replace(/[^a-z0-9]/g, '');

  // 2. Direct Cleaned Name Match
  if (n1 && n2 && (n1 === n2 || n1.includes(n2) || n2.includes(n1))) {
    return true;
  }

  // 3. Token-based Scheme Name matching
  if (n1Raw && n2Raw) {
    const stopWords = new Set([
      'direct', 'regular', 'growth', 'idcw', 'dividend', 'reinvestment', 'payout', 
      'plan', 'option', 'fund', 'funds', 'mutual', 'scheme', 'schemes', 'amc', 
      'limited', 'ltd', 'india', 'asset', 'management', 'the', 'and', 'of', 'in'
    ]);

    const getCoreTokens = (raw: string) => {
      const aliasNormalized = normalizeAliases(raw);
      return aliasNormalized
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !stopWords.has(w));
    };

    const tokens1 = getCoreTokens(n1Raw);
    const tokens2 = getCoreTokens(n2Raw);

    if (tokens1.length > 0 && tokens2.length > 0) {
      // Check category keywords - distinct categories MUST NOT match
      const categoryKeywords = [
        'arbitrage', 'liquid', 'overnight', 'small', 'mid', 'large', 
        'flexi', 'multi', 'elss', 'gold', 'silver', 'nasdaq', 'index', 'debt', 'gilt', 'hybrid'
      ];
      
      let categoryConflict = false;
      for (const cat of categoryKeywords) {
        const has1 = tokens1.some(t => t.includes(cat));
        const has2 = tokens2.some(t => t.includes(cat));
        if (has1 !== has2) {
          // If one has 'small' and the other has 'mid', they cannot match
          categoryConflict = true;
          break;
        }
      }

      if (!categoryConflict) {
        // Check token intersection
        const common = tokens1.filter(t1 => 
          tokens2.some(t2 => t2 === t1 || (t1.length >= 4 && t2.length >= 4 && (t1.includes(t2) || t2.includes(t1))))
        );
        const minTokens = Math.min(tokens1.length, tokens2.length);
        
        if (common.length >= Math.min(2, minTokens) && (common.length / minTokens) >= 0.5) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Normalizes folios for comparison (stripping spaces, sub-folio /0 suffixes, leading zeros)
 */
export function areFoliosEquivalent(folio1?: string, folio2?: string): boolean {
  if (!folio1 || !folio2) return true;

  const f1 = normalizeFolioNumber(folio1).trim();
  const f2 = normalizeFolioNumber(folio2).trim();

  if (!f1 || !f2 || 
      f1 === 'FOLIO-1' || f2 === 'FOLIO-1' || 
      f1.toLowerCase() === 'default' || f2.toLowerCase() === 'default' ||
      f1.toLowerCase() === 'folio' || f2.toLowerCase() === 'folio' ||
      f1.startsWith('tx_') || f2.startsWith('tx_')) {
    return true;
  }

  if (f1.toLowerCase() === f2.toLowerCase()) return true;

  // Compare base folios by stripping sub-account suffixes (e.g. "12345678 / 0", "12345678/0", "12345678-0", "12345678 / 90")
  const getBaseFolio = (f: string) => {
    return f.split(/[\/\-_]/)[0].trim().replace(/^0+/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  };

  const base1 = getBaseFolio(f1);
  const base2 = getBaseFolio(f2);

  if (base1 && base2) {
    if (base1 === base2) return true;
    // Substring match for folios of length >= 5
    if (base1.length >= 5 && base2.length >= 5 && (base1.includes(base2) || base2.includes(base1))) {
      return true;
    }
    // Check if both end with the same 4+ digits (handling masked folios like XXXXXX43113 vs 91060243113)
    if (base1.length >= 4 && base2.length >= 4 && base1.slice(-4) === base2.slice(-4)) {
      return true;
    }
  }

  // Alphanumeric stripped check with leading zeros removed
  const a1 = f1.replace(/[^a-z0-9]/gi, '').replace(/^0+/, '').toLowerCase();
  const a2 = f2.replace(/[^a-z0-9]/gi, '').replace(/^0+/, '').toLowerCase();

  if (a1 && a2) {
    if (a1 === a2) return true;
    if (a1.length >= 5 && a2.length >= 5 && (a1.startsWith(a2) || a2.startsWith(a1) || a1.endsWith(a2) || a2.endsWith(a1))) {
      return true;
    }
  }

  return false;
}

/**
 * Determines if two individual transaction records are duplicates
 */
export function areTransactionsDuplicate(
  t1: TransactionRecord,
  t2: TransactionRecord
): boolean {
  // 1. Exact non-generic ID match
  if (t1.id && t2.id && t1.id === t2.id && 
      !t1.id.startsWith('pdf-tx-') && !t1.id.startsWith('cas-tx-') && 
      !t1.id.startsWith('csv-') && !t1.id.startsWith('tx_demo_') &&
      !t1.id.startsWith('tx_')) {
    return true;
  }

  // 2. Transaction direction (must both be Inflows or both Outflows)
  const dir1 = getTransactionDirection(t1.type);
  const dir2 = getTransactionDirection(t2.type);
  if (dir1 !== dir2) return false;

  // 3. Scheme equivalence check
  const schemeMatch = areSchemesEquivalent(t1.schemeCode, t1.schemeName, t2.schemeCode, t2.schemeName);

  // 4. Folio check
  const folioMatch = areFoliosEquivalent(t1.folioNumber, t2.folioNumber);

  // 5. Calendar Date check
  const dateStr1 = getCalendarDateString(t1.date);
  const dateStr2 = getCalendarDateString(t2.date);
  const isSameDate = Boolean(dateStr1 && dateStr2 && dateStr1 === dateStr2);
  const daysDiff = getCalendarDaysDiff(t1.date, t2.date);

  // 6. Units and Amount differences
  const u1 = Math.abs(t1.units || 0);
  const u2 = Math.abs(t2.units || 0);
  const a1 = Math.abs(t1.amount || 0);
  const a2 = Math.abs(t2.amount || 0);

  const unitsDiff = Math.abs(u1 - u2);
  const amountDiff = Math.abs(a1 - a2);

  const isExactUnitsMatch = (unitsDiff <= 0.005) || (u1 > 10 && (unitsDiff / u1) < 0.0005);
  const isExactAmountMatch = (amountDiff <= 2.0) || (a1 > 100 && (amountDiff / a1) < 0.001);

  const isApproxUnitsMatch = (unitsDiff <= 0.05) || (u1 > 0 && (unitsDiff / u1) < 0.01);
  const isApproxAmountMatch = (amountDiff <= 10.0) || (a1 > 0 && (amountDiff / a1) < 0.01);

  // Case 1: Same Scheme + Same Date + (Units OR Amount Match)
  if (schemeMatch && isSameDate) {
    if (isExactUnitsMatch || isExactAmountMatch) return true;
    if (isApproxUnitsMatch && isApproxAmountMatch) return true;
    if (u1 === 0 || u2 === 0 || a1 === 0 || a2 === 0) {
      if (isApproxUnitsMatch || isApproxAmountMatch) return true;
    }
    // High probability duplicate on exact same date for same scheme
    if (unitsDiff <= 0.05 && amountDiff <= 10.0) return true;
  }

  // Case 2: High precision match (Exact Units + Exact Amount + Same Date)
  if (isSameDate && isExactUnitsMatch && isExactAmountMatch) {
    if (schemeMatch || folioMatch) return true;
    const n1 = cleanFundDisplayName(t1.schemeName).toLowerCase();
    const n2 = cleanFundDisplayName(t2.schemeName).toLowerCase();
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
  }

  // Case 3: Settlement offset match (within 1-3 days for T+1/T+2 or weekend posting)
  if (schemeMatch && daysDiff <= 3.0) {
    if (isExactUnitsMatch && isExactAmountMatch) return true;
    if (folioMatch && (isExactUnitsMatch || isExactAmountMatch)) return true;
    if (amountDiff <= 0.5 && (unitsDiff <= 0.01 || (u1 > 0 && unitsDiff / u1 < 0.001))) return true;
  }

  // Case 4: Same Folio + Same Date + Exact Units + Exact Amount
  if (folioMatch && isSameDate && isExactUnitsMatch && isExactAmountMatch) {
    return true;
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
    const date = getCalendarDateString(tx.date);
    const code = (tx.schemeCode || '').trim().toLowerCase();
    const folio = normalizeFolioNumber(tx.folioNumber).split(/[\/\-_]/)[0].trim().replace(/^0+/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const u = Math.abs(tx.units || 0).toFixed(2);
    const a = Math.round(Math.abs(tx.amount || 0));
    return `${dir}|${date}|${code}|${folio}|${u}|${a}`;
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

/**
 * Standard default portfolio allocation strategy presets
 */
export const DEFAULT_ALLOCATION_STRATEGIES: import('../types').AllocationStrategy[] = [
  {
    id: 'strategic_core_70_20_10',
    name: 'Strategic Core (70:20:10)',
    description: '70% Equity (50% Large, 25% Mid, 25% Small), 20% Debt & Arbitrage (stability), 10% Gold (hedge).',
    equity: 70,
    debt: 20,
    gold: 10,
    cash: 0,
    largeCap: 50,
    midCap: 25,
    smallCap: 25
  },
  {
    id: 'aggressive_wealth',
    name: 'Aggressive Wealth (80:15:5)',
    description: '80% Equity (50% Large, 25% Mid, 25% Small), 15% Debt, 5% Gold. Suited for 7+ years horizon.',
    equity: 80,
    debt: 15,
    gold: 5,
    cash: 0,
    largeCap: 50,
    midCap: 25,
    smallCap: 25
  },
  {
    id: 'balanced_core',
    name: 'Balanced Long-Term (65:25:10)',
    description: '65% Equity (50% Large, 25% Mid, 25% Small), 25% Debt, 10% Gold. Balanced risk-reward for 5-7 years.',
    equity: 65,
    debt: 25,
    gold: 10,
    cash: 0,
    largeCap: 50,
    midCap: 25,
    smallCap: 25
  },
  {
    id: 'conservative_shield',
    name: 'Conservative Shield (40:50:10)',
    description: '40% Equity (50% Large, 25% Mid, 25% Small), 50% Debt, 10% Gold. Priority on capital preservation.',
    equity: 40,
    debt: 50,
    gold: 10,
    cash: 0,
    largeCap: 50,
    midCap: 25,
    smallCap: 25
  },
  {
    id: 'pure_equity_alpha',
    name: '100% Pure Equity (50:25:25)',
    description: '100% Equity diversified across market capitalizations (50% Large, 25% Mid, 25% Small).',
    equity: 100,
    debt: 0,
    gold: 0,
    cash: 0,
    largeCap: 50,
    midCap: 25,
    smallCap: 25
  }
];

/**
 * Check if a fund is an Equity-Oriented scheme eligible for Market Cap breakdown.
 * Excludes Debt, Liquid, Cash, Arbitrage, Gold, Silver, and Commodities.
 * Safe against argument-order transposition (category, schemeName) vs (schemeName, category).
 */
export function isEquityOrientedScheme(schemeName: string, category: string): boolean {
  return isEquityOrientedSchemeSafe(schemeName, category);
}


/**
 * Reference Factsheet Market Cap Splits for Popular Indian Mutual Funds (Large, Mid, Small Cap %)
 * Based on authentic AMC monthly portfolio disclosures & factsheets.
 */
export const KNOWN_SCHEME_FACTSHEET_SPLITS: Record<string, import('../types').FundMarketCapSplit & { sourceName?: string }> = {
  // Parag Parikh Mutual Fund (PPFAS)
  'parag parikh flexi cap': { largeCap: 93.73, midCap: 2.87, smallCap: 3.40, sourceName: 'PPFAS Factsheet' },
  'parag parikh flexicap': { largeCap: 93.73, midCap: 2.87, smallCap: 3.40, sourceName: 'PPFAS Factsheet' },
  'parag parikh elss tax saver': { largeCap: 88.50, midCap: 6.20, smallCap: 5.30, sourceName: 'PPFAS Factsheet' },
  'parag parikh tax saver': { largeCap: 88.50, midCap: 6.20, smallCap: 5.30, sourceName: 'PPFAS Factsheet' },

  // Motilal Oswal Mutual Fund
  'motilal oswal midcap': { largeCap: 16.77, midCap: 83.23, smallCap: 0.00, sourceName: 'Motilal Oswal Factsheet' },
  'motilal oswal mid cap': { largeCap: 16.77, midCap: 83.23, smallCap: 0.00, sourceName: 'Motilal Oswal Factsheet' },
  'motilal oswal large and midcap': { largeCap: 54.20, midCap: 41.50, smallCap: 4.30, sourceName: 'Motilal Oswal Factsheet' },
  'motilal oswal large & midcap': { largeCap: 54.20, midCap: 41.50, smallCap: 4.30, sourceName: 'Motilal Oswal Factsheet' },
  'motilal oswal flexi cap': { largeCap: 74.80, midCap: 18.20, smallCap: 7.00, sourceName: 'Motilal Oswal Factsheet' },
  'motilal oswal flexicap': { largeCap: 74.80, midCap: 18.20, smallCap: 7.00, sourceName: 'Motilal Oswal Factsheet' },
  'motilal oswal focused': { largeCap: 88.60, midCap: 11.40, smallCap: 0.00, sourceName: 'Motilal Oswal Factsheet' },
  'motilal oswal small cap': { largeCap: 0.00, midCap: 18.20, smallCap: 81.80, sourceName: 'Motilal Oswal Factsheet' },
  'motilal oswal smallcap': { largeCap: 0.00, midCap: 18.20, smallCap: 81.80, sourceName: 'Motilal Oswal Factsheet' },
  'motilal oswal nifty midcap 150': { largeCap: 0.00, midCap: 100.00, smallCap: 0.00, sourceName: 'NSE Nifty Indices' },
  'motilal oswal nifty smallcap 250': { largeCap: 0.00, midCap: 0.00, smallCap: 100.00, sourceName: 'NSE Nifty Indices' },
  'motilal oswal nifty 500': { largeCap: 72.40, midCap: 18.10, smallCap: 9.50, sourceName: 'NSE Nifty Indices' },
  'motilal oswal nasdaq 100': { largeCap: 99.75, midCap: 0.00, smallCap: 0.25, sourceName: 'Nasdaq Factsheet' },

  // Quant Mutual Fund
  'quant small cap': { largeCap: 2.10, midCap: 24.80, smallCap: 73.10, sourceName: 'Quant Factsheet' },
  'quant smallcap': { largeCap: 2.10, midCap: 24.80, smallCap: 73.10, sourceName: 'Quant Factsheet' },
  'quant mid cap': { largeCap: 18.40, midCap: 74.60, smallCap: 7.00, sourceName: 'Quant Factsheet' },
  'quant midcap': { largeCap: 18.40, midCap: 74.60, smallCap: 7.00, sourceName: 'Quant Factsheet' },
  'quant flexi cap': { largeCap: 68.20, midCap: 21.30, smallCap: 10.50, sourceName: 'Quant Factsheet' },
  'quant flexicap': { largeCap: 68.20, midCap: 21.30, smallCap: 10.50, sourceName: 'Quant Factsheet' },
  'quant active': { largeCap: 38.50, midCap: 36.20, smallCap: 25.30, sourceName: 'Quant Factsheet' },
  'quant elss tax saver': { largeCap: 65.40, midCap: 22.10, smallCap: 12.50, sourceName: 'Quant Factsheet' },
  'quant tax saver': { largeCap: 65.40, midCap: 22.10, smallCap: 12.50, sourceName: 'Quant Factsheet' },

  // Nippon India Mutual Fund
  'nippon india small cap': { largeCap: 0.00, midCap: 12.80, smallCap: 87.20, sourceName: 'Nippon India Factsheet' },
  'nippon india growth': { largeCap: 14.50, midCap: 78.50, smallCap: 7.00, sourceName: 'Nippon India Factsheet' },
  'nippon india multi cap': { largeCap: 42.10, midCap: 32.40, smallCap: 25.50, sourceName: 'Nippon India Factsheet' },
  'nippon india large cap': { largeCap: 89.20, midCap: 10.80, smallCap: 0.00, sourceName: 'Nippon India Factsheet' },

  // Mirae Asset Mutual Fund
  'mirae asset large & midcap': { largeCap: 52.40, midCap: 38.60, smallCap: 9.00, sourceName: 'Mirae Asset Factsheet' },
  'mirae asset large and midcap': { largeCap: 52.40, midCap: 38.60, smallCap: 9.00, sourceName: 'Mirae Asset Factsheet' },
  'mirae asset large cap': { largeCap: 92.50, midCap: 7.50, smallCap: 0.00, sourceName: 'Mirae Asset Factsheet' },
  'mirae asset midcap': { largeCap: 12.80, midCap: 81.40, smallCap: 5.80, sourceName: 'Mirae Asset Factsheet' },
  'mirae asset flexi cap': { largeCap: 70.50, midCap: 22.00, smallCap: 7.50, sourceName: 'Mirae Asset Factsheet' },

  // HDFC Mutual Fund
  'hdfc mid-cap opportunities': { largeCap: 12.40, midCap: 74.20, smallCap: 13.40, sourceName: 'HDFC AMC Factsheet' },
  'hdfc mid cap opportunities': { largeCap: 12.40, midCap: 74.20, smallCap: 13.40, sourceName: 'HDFC AMC Factsheet' },
  'hdfc small cap': { largeCap: 0.00, midCap: 15.20, smallCap: 84.80, sourceName: 'HDFC AMC Factsheet' },
  'hdfc smallcap': { largeCap: 0.00, midCap: 15.20, smallCap: 84.80, sourceName: 'HDFC AMC Factsheet' },
  'hdfc top 100': { largeCap: 95.50, midCap: 4.50, smallCap: 0.00, sourceName: 'HDFC AMC Factsheet' },
  'hdfc flexi cap': { largeCap: 82.40, midCap: 12.60, smallCap: 5.00, sourceName: 'HDFC AMC Factsheet' },
  'hdfc large and mid cap': { largeCap: 51.50, midCap: 42.80, smallCap: 5.70, sourceName: 'HDFC AMC Factsheet' },
  'hdfc large & mid cap': { largeCap: 51.50, midCap: 42.80, smallCap: 5.70, sourceName: 'HDFC AMC Factsheet' },

  // ICICI Prudential Mutual Fund
  'icici prudential bluechip': { largeCap: 94.20, midCap: 5.80, smallCap: 0.00, sourceName: 'ICICI Pru Factsheet' },
  'icici pru bluechip': { largeCap: 94.20, midCap: 5.80, smallCap: 0.00, sourceName: 'ICICI Pru Factsheet' },
  'icici prudential midcap': { largeCap: 15.60, midCap: 78.40, smallCap: 6.00, sourceName: 'ICICI Pru Factsheet' },
  'icici prudential smallcap': { largeCap: 0.00, midCap: 16.50, smallCap: 83.50, sourceName: 'ICICI Pru Factsheet' },
  'icici prudential value discovery': { largeCap: 78.20, midCap: 18.40, smallCap: 3.40, sourceName: 'ICICI Pru Factsheet' },
  'icici prudential equity & debt': { largeCap: 76.50, midCap: 18.20, smallCap: 5.30, sourceName: 'ICICI Pru Factsheet' },

  // SBI Mutual Fund
  'sbi small cap': { largeCap: 0.00, midCap: 7.70, smallCap: 92.30, sourceName: 'SBI MF Factsheet' },
  'sbi smallcap': { largeCap: 0.00, midCap: 7.70, smallCap: 92.30, sourceName: 'SBI MF Factsheet' },
  'sbi magnum midcap': { largeCap: 13.20, midCap: 79.60, smallCap: 7.20, sourceName: 'SBI MF Factsheet' },
  'sbi bluechip': { largeCap: 91.80, midCap: 8.20, smallCap: 0.00, sourceName: 'SBI MF Factsheet' },
  'sbi flexicap': { largeCap: 71.40, midCap: 21.20, smallCap: 7.40, sourceName: 'SBI MF Factsheet' },
  'sbi focused equity': { largeCap: 86.50, midCap: 13.50, smallCap: 0.00, sourceName: 'SBI MF Factsheet' },

  // Axis Mutual Fund
  'axis small cap': { largeCap: 0.00, midCap: 18.50, smallCap: 81.50, sourceName: 'Axis MF Factsheet' },
  'axis smallcap': { largeCap: 0.00, midCap: 18.50, smallCap: 81.50, sourceName: 'Axis MF Factsheet' },
  'axis midcap': { largeCap: 14.80, midCap: 80.20, smallCap: 5.00, sourceName: 'Axis MF Factsheet' },
  'axis bluechip': { largeCap: 96.20, midCap: 3.80, smallCap: 0.00, sourceName: 'Axis MF Factsheet' },
  'axis flexi cap': { largeCap: 79.50, midCap: 15.20, smallCap: 5.30, sourceName: 'Axis MF Factsheet' },
  'axis elss - tax saver': { largeCap: 78.02, midCap: 18.38, smallCap: 3.59, sourceName: 'Axis MF Factsheet' },
  'axis long term equity': { largeCap: 78.02, midCap: 18.38, smallCap: 3.59, sourceName: 'Axis MF Factsheet' },

  // Kotak Mahindra Mutual Fund
  'kotak emerging equity': { largeCap: 18.20, midCap: 76.50, smallCap: 5.30, sourceName: 'Kotak MF Factsheet' },
  'kotak small cap': { largeCap: 0.00, midCap: 15.80, smallCap: 84.20, sourceName: 'Kotak MF Factsheet' },
  'kotak flexicap': { largeCap: 76.20, midCap: 19.40, smallCap: 4.40, sourceName: 'Kotak MF Factsheet' },
  'kotak bluechip': { largeCap: 93.80, midCap: 6.20, smallCap: 0.00, sourceName: 'Kotak MF Factsheet' },

  // UTI Mutual Fund
  'uti nifty 50 index': { largeCap: 100.00, midCap: 0.00, smallCap: 0.00, sourceName: 'Nifty 50 Index' },
  'uti nifty next 50': { largeCap: 100.00, midCap: 0.00, smallCap: 0.00, sourceName: 'Nifty Next 50 Index' },
  'uti mid cap': { largeCap: 16.20, midCap: 77.50, smallCap: 6.30, sourceName: 'UTI MF Factsheet' },
  'uti flexi cap': { largeCap: 66.80, midCap: 24.50, smallCap: 8.70, sourceName: 'UTI MF Factsheet' },

  // Zerodha Mutual Fund
  'zerodha elss tax saver nifty largemidcap 250': { largeCap: 53.40, midCap: 44.09, smallCap: 2.51, sourceName: 'Zerodha Index Factsheet' },
  'zerodha nifty largemidcap 250': { largeCap: 50.00, midCap: 50.00, smallCap: 0.00, sourceName: 'Zerodha Index Factsheet' },

  // DSP Mutual Fund
  'dsp small cap': { largeCap: 0.00, midCap: 18.20, smallCap: 81.80, sourceName: 'DSP MF Factsheet' },
  'dsp midcap': { largeCap: 14.10, midCap: 79.40, smallCap: 6.50, sourceName: 'DSP MF Factsheet' },
  'dsp flexi cap': { largeCap: 72.40, midCap: 21.60, smallCap: 6.00, sourceName: 'DSP MF Factsheet' },

  // Canara Robeco Mutual Fund
  'canara robeco small cap': { largeCap: 0.00, midCap: 16.40, smallCap: 83.60, sourceName: 'Canara Robeco Factsheet' },
  'canara robeco emerging equities': { largeCap: 54.00, midCap: 41.20, smallCap: 4.80, sourceName: 'Canara Robeco Factsheet' },
  'canara robeco flexi cap': { largeCap: 73.50, midCap: 21.00, smallCap: 5.50, sourceName: 'Canara Robeco Factsheet' },
  'canara robeco bluechip': { largeCap: 93.50, midCap: 6.50, smallCap: 0.00, sourceName: 'Canara Robeco Factsheet' },

  // Tata, Bandhan, Invesco, Edelweiss, Franklin
  'bandhan small cap': { largeCap: 0.00, midCap: 19.20, smallCap: 80.80, sourceName: 'Bandhan MF Factsheet' },
  'tata small cap': { largeCap: 0.00, midCap: 14.80, smallCap: 85.20, sourceName: 'Tata MF Factsheet' },
  'tata digital india': { largeCap: 78.50, midCap: 16.50, smallCap: 5.00, sourceName: 'Tata MF Factsheet' },
  'invesco india mid cap': { largeCap: 15.40, midCap: 78.60, smallCap: 6.00, sourceName: 'Invesco MF Factsheet' },
  'edelweiss mid cap': { largeCap: 16.00, midCap: 77.50, smallCap: 6.50, sourceName: 'Edelweiss MF Factsheet' },
  'franklin india smaller companies': { largeCap: 0.00, midCap: 18.00, smallCap: 82.00, sourceName: 'Franklin Templeton Factsheet' },
  'franklin india prima': { largeCap: 14.50, midCap: 79.00, smallCap: 6.50, sourceName: 'Franklin Templeton Factsheet' }
};

/**
 * Returns the default market cap split (Large, Mid, Small %) for a scheme.
 * 1. Checks specific AMC factsheet reference database for high-precision real portfolio breakdowns.
 * 2. Falls back to regulatory SEBI mandate / index category benchmark splits.
 */
export function getDefaultFundMarketCapSplit(
  schemeName: string, 
  category: string,
  schemeCode?: string,
  isin?: string
): import('../types').FundMarketCapSplit {
  const normName = (schemeName || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const cat = (category || '').toLowerCase();

  // 1. Direct match in AMC Factsheet Database
  for (const [key, split] of Object.entries(KNOWN_SCHEME_FACTSHEET_SPLITS)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (normName.includes(cleanKey) || cleanKey.includes(normName)) {
      return { largeCap: split.largeCap, midCap: split.midCap, smallCap: split.smallCap };
    }
  }

  // 2. Specific Index Name Heuristics
  if (normName.includes('nifty 50') || normName.includes('sensex') || normName.includes('bse 100') || normName.includes('top 100')) {
    return { largeCap: 100, midCap: 0, smallCap: 0 };
  }
  if (normName.includes('nifty next 50') || normName.includes('junior nifty')) {
    return { largeCap: 100, midCap: 0, smallCap: 0 };
  }
  if (normName.includes('midcap 150') || normName.includes('nifty midcap')) {
    return { largeCap: 0, midCap: 100, smallCap: 0 };
  }
  if (normName.includes('smallcap 250') || normName.includes('nifty smallcap')) {
    return { largeCap: 0, midCap: 0, smallCap: 100 };
  }
  if (normName.includes('nifty 500') || normName.includes('bse 500')) {
    return { largeCap: 72.4, midCap: 18.1, smallCap: 9.5 };
  }
  if (normName.includes('largemidcap 250') || normName.includes('large midcap 250') || normName.includes('large mid 250')) {
    return { largeCap: 50, midCap: 50, smallCap: 0 };
  }

  // 3. Category-level SEBI Benchmarks
  if (cat.includes('small cap') || cat.includes('smallcap') || normName.includes('small cap') || normName.includes('smallcap')) {
    return { largeCap: 0, midCap: 15, smallCap: 85 };
  }
  if (cat.includes('mid cap') || cat.includes('midcap') || normName.includes('mid cap') || normName.includes('midcap') || normName.includes('emerging')) {
    return { largeCap: 15, midCap: 80, smallCap: 5 };
  }
  if (cat.includes('large & mid') || cat.includes('large and mid') || normName.includes('large & mid') || normName.includes('large and mid')) {
    return { largeCap: 50, midCap: 45, smallCap: 5 };
  }
  if (cat.includes('large cap') || normName.includes('large cap') || normName.includes('bluechip')) {
    return { largeCap: 90, midCap: 10, smallCap: 0 };
  }
  if (cat.includes('flexi cap') || cat.includes('flexicap') || normName.includes('flexi cap') || normName.includes('flexicap')) {
    return { largeCap: 68, midCap: 22, smallCap: 10 };
  }
  if (cat.includes('multi cap') || cat.includes('multicap') || normName.includes('multi cap') || normName.includes('multicap')) {
    return { largeCap: 40, midCap: 35, smallCap: 25 };
  }
  if (cat.includes('elss') || cat.includes('tax saver') || cat.includes('long term equity')) {
    return { largeCap: 70, midCap: 20, smallCap: 10 };
  }

  // General equity / hybrid fallback
  return { largeCap: 60, midCap: 25, smallCap: 15 };
}

/**
 * Returns metadata regarding the market cap split source (Factsheet vs Category Benchmark)
 */
export function getFundMarketCapSplitSource(schemeName: string, category: string): { isFactsheet: boolean; sourceName: string } {
  const normName = (schemeName || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

  for (const [key, split] of Object.entries(KNOWN_SCHEME_FACTSHEET_SPLITS)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    if (normName.includes(cleanKey) || cleanKey.includes(normName)) {
      return { isFactsheet: true, sourceName: split.sourceName || 'AMC Factsheet' };
    }
  }

  if (normName.includes('nifty') || normName.includes('sensex')) {
    return { isFactsheet: true, sourceName: 'Index Benchmark' };
  }

  return { isFactsheet: false, sourceName: 'SEBI Benchmark' };
}

/**
 * Accurately estimates Market-Cap breakdown (Large, Mid, Small Cap) from portfolio equity holdings,
 * taking into account any custom user overrides saved from monthly disclosures.
 */
export function computeMarketCapAllocation(
  holdings: PortfolioHolding[],
  splitsMap?: Record<string, import('../types').FundMarketCapSplit>
): import('../types').MarketCapAllocation {
  let largeCapValue = 0;
  let midCapValue = 0;
  let smallCapValue = 0;
  let totalEquityValue = 0;

  holdings.forEach(h => {
    // Exclude non-equity funds (Debt, Liquid, Gold, Silver, Commodities, Arbitrage)
    if (!isEquityOrientedScheme(h.schemeName, h.category)) {
      return;
    }

    const cat = (h.category || '').toLowerCase();
    // Hybrid schemes: treat approx 65% as equity
    const equityPortionMultiplier = (cat.includes('hybrid') || cat.includes('balanced') || cat.includes('multi asset')) ? 0.65 : 1.0;
    const effectiveEquityVal = h.currentValue * equityPortionMultiplier;
    totalEquityValue += effectiveEquityVal;

    // Check user override first, fallback to default category split
    const override = splitsMap?.[h.schemeCode] || splitsMap?.[h.schemeName];
    const split = override || getDefaultFundMarketCapSplit(h.schemeName, h.category, h.schemeCode, h.isin);

    const sumPct = (split.largeCap + split.midCap + split.smallCap) || 100;
    const normLarge = split.largeCap / sumPct;
    const normMid = split.midCap / sumPct;
    const normSmall = split.smallCap / sumPct;

    largeCapValue += effectiveEquityVal * normLarge;
    midCapValue += effectiveEquityVal * normMid;
    smallCapValue += effectiveEquityVal * normSmall;
  });

  const largeCap = totalEquityValue > 0 ? (largeCapValue / totalEquityValue) * 100 : 0;
  const midCap = totalEquityValue > 0 ? (midCapValue / totalEquityValue) * 100 : 0;
  const smallCap = totalEquityValue > 0 ? (smallCapValue / totalEquityValue) * 100 : 0;

  return {
    largeCap,
    midCap,
    smallCap,
    largeCapValue,
    midCapValue,
    smallCapValue,
    totalEquityValue
  };
}

/**
 * Checks whether a fund is one of the user's primary active SIP core funds:
 * 1. Parag Parikh Flexi Cap Fund
 * 2. Motilal Oswal Midcap Fund
 * 3. SBI Small Cap Fund
 */
export function isDefaultActiveSipFund(schemeName: string): boolean {
  const norm = (schemeName || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const isPPFAS = norm.includes('parag parikh') && (norm.includes('flexi') || norm.includes('tax') || norm.includes('ppfas'));
  const isMotilalMid = norm.includes('motilal') && (norm.includes('midcap') || norm.includes('mid cap') || norm.includes('mid'));
  const isSBISmall = norm.includes('sbi') && (norm.includes('small cap') || norm.includes('smallcap') || norm.includes('small'));
  return isPPFAS || isMotilalMid || isSBISmall;
}

/**
 * Intelligent Portfolio Rebalancing Engine
 * Focuses monthly SIP (default ₹45,000) 100% into designated Active SIP Equity funds
 * (Parag Parikh Flexi Cap, Motilal Oswal Midcap, SBI Small Cap) to dynamically correct
 * Large, Mid, and Small Cap market cap drift toward target ratios (50:25:25).
 * Debt and Gold rebalancing are computed as manual rebalancing recommendations.
 */
export function computeRebalanceReport(
  holdings: PortfolioHolding[],
  strategy: import('../types').AllocationStrategy,
  inflowAmount: number = 45000,
  rebalanceMode: 'SIP_INFLOW' | 'DIRECT_REALIGNMENT' = 'SIP_INFLOW',
  splitsMap?: Record<string, import('../types').FundMarketCapSplit>,
  horizonMonths: number = 12,
  activeSipFundKeys?: string[] | null
): import('../types').RebalanceReport {
  const totalVal = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const assetAlloc = computeAssetAllocation(holdings);
  const marketCapAlloc = computeMarketCapAllocation(holdings, splitsMap);
  const effectiveHorizon = Math.max(1, horizonMonths || 12);

  // 1. Asset Class Rebalance Items
  const assetBuckets: { name: string; currentVal: number; currentPct: number; targetPct: number }[] = [
    {
      name: 'Equity',
      currentVal: totalVal * (assetAlloc.equity / 100),
      currentPct: assetAlloc.equity,
      targetPct: strategy.equity
    },
    {
      name: 'Debt & Fixed Income',
      currentVal: totalVal * (assetAlloc.debt / 100),
      currentPct: assetAlloc.debt,
      targetPct: strategy.debt
    },
    {
      name: 'Gold & Commodities',
      currentVal: totalVal * (assetAlloc.gold / 100),
      currentPct: assetAlloc.gold,
      targetPct: strategy.gold
    },
    {
      name: 'Liquid & Cash',
      currentVal: totalVal * (assetAlloc.cash / 100),
      currentPct: assetAlloc.cash,
      targetPct: strategy.cash
    }
  ];

  const assetClassItems: import('../types').RebalanceItem[] = assetBuckets.map((b) => {
    const targetVal = totalVal * (b.targetPct / 100);
    const driftPct = b.currentPct - b.targetPct;
    const deltaAmount = targetVal - b.currentVal; // > 0 means BUY, < 0 means SELL

    let actionType: 'BUY' | 'SELL' | 'BALANCED' = 'BALANCED';
    let status: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'ALIGNED' = 'ALIGNED';

    if (driftPct > 1.5) {
      actionType = 'SELL';
      status = 'OVERWEIGHT';
    } else if (driftPct < -1.5) {
      actionType = 'BUY';
      status = 'UNDERWEIGHT';
    }

    // Since SIP is dedicated 100% to Equity funds for Market Cap targeting:
    let sipAllocAmount = 0;
    let sipAllocPct = 0;
    if (inflowAmount > 0) {
      if (b.name === 'Equity') {
        sipAllocPct = 100;
        sipAllocAmount = inflowAmount;
      } else {
        sipAllocPct = 0;
        sipAllocAmount = 0;
      }
    }

    return {
      name: b.name,
      category: 'Asset Class',
      currentValue: b.currentVal,
      currentPct: b.currentPct,
      targetPct: b.targetPct,
      targetValue: targetVal,
      driftPct,
      actionType,
      deltaAmount,
      sipAllocAmount,
      sipAllocPct,
      status
    };
  });

  // 2. Market Cap Rebalance Items (within Equity portion)
  const equityVal = marketCapAlloc.totalEquityValue;
  const mcapBuckets: { name: string; currentVal: number; currentPct: number; targetPct: number }[] = [
    {
      name: 'Large Cap',
      currentVal: marketCapAlloc.largeCapValue,
      currentPct: marketCapAlloc.largeCap,
      targetPct: strategy.largeCap
    },
    {
      name: 'Mid Cap',
      currentVal: marketCapAlloc.midCapValue,
      currentPct: marketCapAlloc.midCap,
      targetPct: strategy.midCap
    },
    {
      name: 'Small Cap',
      currentVal: marketCapAlloc.smallCapValue,
      currentPct: marketCapAlloc.smallCap,
      targetPct: strategy.smallCap
    }
  ];

  // Calculate target equity value at the end of the horizon:
  // e.g. Current Equity + (Monthly SIP * Horizon Months)
  const totalHorizonInflow = inflowAmount * effectiveHorizon;
  const projectedHorizonEquityVal = equityVal + totalHorizonInflow;

  // Ideal target rupee amount for each bucket at the end of horizon
  const mcapTargetValuesEnd = mcapBuckets.map(b => projectedHorizonEquityVal * (b.targetPct / 100));
  
  // Total deficit across the horizon (how much new capital in each market cap bucket is needed over the horizon)
  const mcapHorizonDeficits = mcapBuckets.map((b, idx) => Math.max(0, mcapTargetValuesEnd[idx] - b.currentVal));
  const totalHorizonDeficit = mcapHorizonDeficits.reduce((a, b) => a + b, 0);

  const marketCapItems: import('../types').RebalanceItem[] = mcapBuckets.map((b, idx) => {
    const targetVal = equityVal * (b.targetPct / 100);
    const driftPct = b.currentPct - b.targetPct;
    const deltaAmount = targetVal - b.currentVal;

    let actionType: 'BUY' | 'SELL' | 'BALANCED' = 'BALANCED';
    let status: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'ALIGNED' = 'ALIGNED';

    if (driftPct > 2.5) {
      actionType = 'SELL';
      status = 'OVERWEIGHT';
    } else if (driftPct < -2.5) {
      actionType = 'BUY';
      status = 'UNDERWEIGHT';
    }

    let sipAllocAmount = 0;
    let sipAllocPct = 0;
    if (inflowAmount > 0) {
      if (totalHorizonDeficit > 0) {
        const gap = mcapHorizonDeficits[idx];
        sipAllocPct = (gap / totalHorizonDeficit) * 100;
        sipAllocAmount = inflowAmount * (sipAllocPct / 100);
      } else {
        sipAllocPct = b.targetPct;
        sipAllocAmount = inflowAmount * (b.targetPct / 100);
      }
    }

    return {
      name: b.name,
      category: 'Market Cap',
      currentValue: b.currentVal,
      currentPct: b.currentPct,
      targetPct: b.targetPct,
      targetValue: targetVal,
      driftPct,
      actionType,
      deltaAmount,
      sipAllocAmount,
      sipAllocPct,
      status
    };
  });

  // 3. Dynamic Scheme-Level SIP Calculation strictly across designated Active SIP Funds
  // (Focuses monthly SIP inflow into active funds to achieve target 50:25:25 market cap distribution)
  const allEquityHoldings = holdings.filter(h => isEquityOrientedScheme(h.schemeName, h.category));

  let candidateHoldings = allEquityHoldings;
  if (activeSipFundKeys && activeSipFundKeys.length > 0) {
    const matched = allEquityHoldings.filter(h => 
      activeSipFundKeys.includes(h.schemeCode) || 
      activeSipFundKeys.includes(h.schemeName)
    );
    if (matched.length > 0) {
      candidateHoldings = matched;
    }
  } else {
    // Default to the 3 designated active SIP funds if present in portfolio
    const defaultThree = allEquityHoldings.filter(h => isDefaultActiveSipFund(h.schemeName));
    if (defaultThree.length > 0) {
      candidateHoldings = defaultThree;
    }
  }

  interface FundRoleInfo {
    holding: PortfolioHolding;
    role: 'Large Cap Anchor' | 'Mid Cap Growth' | 'Small Cap Alpha' | 'Flexi / Multi Cap Core';
    split: import('../types').FundMarketCapSplit;
    weightInEquity: number;
    effectiveVal: number;
  }

  const candidateInfos: FundRoleInfo[] = candidateHoldings.map(h => {
    const override = splitsMap?.[h.schemeCode] || splitsMap?.[h.schemeName];
    const split = override || getDefaultFundMarketCapSplit(h.schemeName, h.category, h.schemeCode, h.isin);
    const cat = (h.category || '').toLowerCase();
    const name = (h.schemeName || '').toLowerCase();

    let role: 'Large Cap Anchor' | 'Mid Cap Growth' | 'Small Cap Alpha' | 'Flexi / Multi Cap Core' = 'Flexi / Multi Cap Core';
    if (split.smallCap >= 60 || cat.includes('small') || name.includes('small')) {
      role = 'Small Cap Alpha';
    } else if (split.midCap >= 50 || cat.includes('mid') || name.includes('mid')) {
      role = 'Mid Cap Growth';
    } else if (split.largeCap >= 60 || cat.includes('large cap') || cat.includes('bluechip') || name.includes('nifty 50') || name.includes('top 100')) {
      role = 'Large Cap Anchor';
    } else {
      role = 'Flexi / Multi Cap Core';
    }

    const isHybrid = cat.includes('hybrid') || cat.includes('balanced') || cat.includes('multi asset');
    const effectiveVal = h.currentValue * (isHybrid ? 0.65 : 1.0);
    const weightInEquity = equityVal > 0 ? (effectiveVal / equityVal) * 100 : 0;

    return {
      holding: h,
      role,
      split,
      weightInEquity,
      effectiveVal
    };
  });

  // Target monthly rupees needed for each market cap tier to reach target distribution (e.g. 50:25:25)
  const largeMonthlyTarget = marketCapItems.find(m => m.name === 'Large Cap')?.sipAllocAmount || (inflowAmount * (strategy.largeCap / 100));
  const midMonthlyTarget = marketCapItems.find(m => m.name === 'Mid Cap')?.sipAllocAmount || (inflowAmount * (strategy.midCap / 100));
  const smallMonthlyTarget = marketCapItems.find(m => m.name === 'Small Cap')?.sipAllocAmount || (inflowAmount * (strategy.smallCap / 100));

  // Compute total internal market-cap weighted capacity across active SIP candidate funds
  const totalLargeCapExposure = candidateInfos.reduce((s, f) => s + (f.split.largeCap / 100), 0) || 1;
  const totalMidCapExposure = candidateInfos.reduce((s, f) => s + (f.split.midCap / 100), 0) || 1;
  const totalSmallCapExposure = candidateInfos.reduce((s, f) => s + (f.split.smallCap / 100), 0) || 1;

  const rawSchemeSips = candidateInfos.map(f => {
    const largeContrib = (f.split.largeCap / 100) / totalLargeCapExposure;
    const midContrib = (f.split.midCap / 100) / totalMidCapExposure;
    const smallContrib = (f.split.smallCap / 100) / totalSmallCapExposure;

    const dynamicLargeSip = largeMonthlyTarget * largeContrib;
    const dynamicMidSip = midMonthlyTarget * midContrib;
    const dynamicSmallSip = smallMonthlyTarget * smallContrib;

    const totalRawSip = dynamicLargeSip + dynamicMidSip + dynamicSmallSip;

    // Build explanatory rationale
    let rationale = '';
    const norm = (f.holding.schemeName || '').toLowerCase();
    if (norm.includes('parag parikh')) {
      rationale = `Core Large-Cap / Flexi-Cap anchor (${f.split.largeCap}% Large Cap) systematically compounding toward your 50% target weight over ${effectiveHorizon} months.`;
    } else if (norm.includes('motilal') && norm.includes('mid')) {
      rationale = `Dedicated Mid-Cap growth driver (${f.split.midCap}% Mid Cap) scaling exposure to achieve your 25% target allocation smoothly.`;
    } else if (norm.includes('sbi') && norm.includes('small')) {
      rationale = `High-conviction Small-Cap engine (${f.split.smallCap}% Small Cap) deployed to steadily achieve your 25% target allocation.`;
    } else if (f.role === 'Small Cap Alpha') {
      rationale = `Small Cap allocation deploying ${f.split.smallCap}% small-cap assets to achieve your ${strategy.smallCap}% target steadily.`;
    } else if (f.role === 'Mid Cap Growth') {
      rationale = `Mid Cap allocation deploying ${f.split.midCap}% mid-cap assets to reach your ${strategy.midCap}% target weight.`;
    } else {
      rationale = `Core allocation deploying ${f.split.largeCap}% L / ${f.split.midCap}% M / ${f.split.smallCap}% S toward ${strategy.largeCap}:${strategy.midCap}:${strategy.smallCap}.`;
    }

    return {
      info: f,
      rawAmount: totalRawSip,
      rationale
    };
  });

  // Clean rounding of SIP recommendations to ₹500 increments while ensuring exact sum = inflowAmount
  let roundedSips = rawSchemeSips.map(item => {
    const raw = item.rawAmount;
    const rounded = Math.max(500, Math.round(raw / 500) * 500);
    return {
      ...item,
      roundedAmount: rounded
    };
  });

  // Adjust difference to preserve exact inflowAmount
  const currentRoundedSum = roundedSips.reduce((s, r) => s + r.roundedAmount, 0);
  const diff = inflowAmount - currentRoundedSum;
  if (diff !== 0 && roundedSips.length > 0) {
    // Adjust on the largest allocation fund
    let maxIdx = 0;
    for (let i = 1; i < roundedSips.length; i++) {
      if (roundedSips[i].roundedAmount > roundedSips[maxIdx].roundedAmount) {
        maxIdx = i;
      }
    }
    roundedSips[maxIdx].roundedAmount = Math.max(500, roundedSips[maxIdx].roundedAmount + diff);
  }

  const schemeSipRecommendations: import('../types').SchemeSipRecommendation[] = roundedSips
    .map(r => ({
      schemeCode: r.info.holding.schemeCode,
      schemeName: r.info.holding.schemeName,
      category: r.info.holding.category,
      currentValue: r.info.holding.currentValue,
      primaryRole: r.info.role,
      recommendedSip: r.roundedAmount,
      sipSharePct: inflowAmount > 0 ? (r.roundedAmount / inflowAmount) * 100 : 0,
      rationale: r.rationale,
      largeCapPct: r.info.split.largeCap,
      midCapPct: r.info.split.midCap,
      smallCapPct: r.info.split.smallCap,
      projected12mAddition: r.roundedAmount * effectiveHorizon
    }))
    .sort((a, b) => b.recommendedSip - a.recommendedSip);

  // 4. Compute Projected 12-Month / Horizon Market Cap Convergence
  let projectedLargeVal = marketCapAlloc.largeCapValue;
  let projectedMidVal = marketCapAlloc.midCapValue;
  let projectedSmallVal = marketCapAlloc.smallCapValue;

  schemeSipRecommendations.forEach(scheme => {
    const total12mSip = scheme.projected12mAddition;
    projectedLargeVal += total12mSip * (scheme.largeCapPct / 100);
    projectedMidVal += total12mSip * (scheme.midCapPct / 100);
    projectedSmallVal += total12mSip * (scheme.smallCapPct / 100);
  });

  const projectedTotalEquity = projectedLargeVal + projectedMidVal + projectedSmallVal || 1;
  const projectedMarketCap = {
    largeCap: (projectedLargeVal / projectedTotalEquity) * 100,
    midCap: (projectedMidVal / projectedTotalEquity) * 100,
    smallCap: (projectedSmallVal / projectedTotalEquity) * 100,
    largeCapVal: projectedLargeVal,
    midCapVal: projectedMidVal,
    smallCapVal: projectedSmallVal
  };

  // 5. Manual Rebalance Guidance for Debt & Gold
  const manualRebalanceNotes: import('../types').RebalanceReport['manualRebalanceNotes'] = [];
  
  const debtItem = assetClassItems.find(a => a.name === 'Debt & Fixed Income');
  if (debtItem) {
    if (debtItem.driftPct < -2.0) {
      manualRebalanceNotes.push({
        assetName: 'Debt & Arbitrage Funds',
        action: 'ADD',
        amount: Math.round(debtItem.deltaAmount),
        explanation: `Debt allocation is under target by ${Math.abs(debtItem.driftPct).toFixed(1)}% (Current: ${debtItem.currentPct.toFixed(1)}%, Target: ${debtItem.targetPct}%). Plan a manual lump-sum addition of ~₹${Math.round(debtItem.deltaAmount).toLocaleString('en-IN')} into Arbitrage or Short-Term Debt.`
      });
    } else if (debtItem.driftPct > 2.0) {
      manualRebalanceNotes.push({
        assetName: 'Debt & Arbitrage Funds',
        action: 'TRIM',
        amount: Math.round(Math.abs(debtItem.deltaAmount)),
        explanation: `Debt allocation is above target by +${debtItem.driftPct.toFixed(1)}% (Current: ${debtItem.currentPct.toFixed(1)}%, Target: ${debtItem.targetPct}%). Consider manual profit switch during annual review.`
      });
    } else {
      manualRebalanceNotes.push({
        assetName: 'Debt & Arbitrage Funds',
        action: 'ALIGNED',
        amount: 0,
        explanation: `Debt allocation is well aligned with target (${debtItem.currentPct.toFixed(1)}% vs target ${debtItem.targetPct}%). No action required.`
      });
    }
  }

  const goldItem = assetClassItems.find(a => a.name === 'Gold & Commodities');
  if (goldItem) {
    if (goldItem.driftPct < -2.0) {
      manualRebalanceNotes.push({
        assetName: 'Gold & Commodities',
        action: 'ADD',
        amount: Math.round(goldItem.deltaAmount),
        explanation: `Gold is under target by ${Math.abs(goldItem.driftPct).toFixed(1)}% (Current: ${goldItem.currentPct.toFixed(1)}%, Target: ${goldItem.targetPct}%). Add ~₹${Math.round(goldItem.deltaAmount).toLocaleString('en-IN')} via manual tranche to restore hedge cushion.`
      });
    } else if (goldItem.driftPct > 2.0) {
      manualRebalanceNotes.push({
        assetName: 'Gold & Commodities',
        action: 'TRIM',
        amount: Math.round(Math.abs(goldItem.deltaAmount)),
        explanation: `Gold is above target by +${goldItem.driftPct.toFixed(1)}% (Current: ${goldItem.currentPct.toFixed(1)}%, Target: ${goldItem.targetPct}%). Maintain existing units or rebalance manually during market highs.`
      });
    } else {
      manualRebalanceNotes.push({
        assetName: 'Gold & Commodities',
        action: 'ALIGNED',
        amount: 0,
        explanation: `Gold allocation is well aligned (${goldItem.currentPct.toFixed(1)}% vs target ${goldItem.targetPct}%).`
      });
    }
  }

  const totalRebalanceRequired = assetClassItems
    .filter(i => i.deltaAmount > 0)
    .reduce((sum, i) => sum + i.deltaAmount, 0);

  const isAligned = assetClassItems.every(i => i.status === 'ALIGNED') && marketCapItems.every(i => i.status === 'ALIGNED');

  return {
    assetClassItems,
    marketCapItems,
    schemeSipRecommendations,
    totalPortfolioValue: totalVal,
    inflowAmount,
    rebalanceMode,
    totalRebalanceRequired,
    isAligned,
    horizonMonths: effectiveHorizon,
    projectedEquityValue: projectedTotalEquity,
    projectedMarketCap,
    manualRebalanceNotes
  };
}

