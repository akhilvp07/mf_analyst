import { MutualFundScheme } from '../types';
import { cleanFundDisplayName, detectPlanType, detectOptionType } from '../utils/financialCalculations';

export interface AmfiNavRecord {
  schemeCode: string;
  isinGrowth?: string;
  isinDivReinvestment?: string;
  isin: string; // The primary matched ISIN
  schemeName: string;
  rawSchemeName?: string;
  planType: 'Direct' | 'Regular';
  optionType: 'Growth' | 'IDCW';
  currentNav: number;
  navDate: string; // ISO "YYYY-MM-DD"
  fundHouse: string;
  category: MutualFundScheme['category'];
  rawRecord?: string;
}

// Built-in seed index for instant zero-latency lookup of primary Indian MF ISINs
const SEED_AMFI_RECORDS: Record<string, AmfiNavRecord> = {
  // Motilal Oswal Midcap Fund (Direct - Growth) - Scheme Code 127042
  'INF247L01445': {
    schemeCode: '127042',
    isin: 'INF247L01445',
    isinGrowth: 'INF247L01445',
    schemeName: 'Motilal Oswal Midcap Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 123.44,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Mid Cap'
  },
  // Motilal Oswal Midcap Fund (Regular - Growth) - Scheme Code 127041
  'INF247L01437': {
    schemeCode: '127041',
    isin: 'INF247L01437',
    isinGrowth: 'INF247L01437',
    schemeName: 'Motilal Oswal Midcap Fund',
    planType: 'Regular',
    optionType: 'Growth',
    currentNav: 110.20,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Mid Cap'
  },
  // Motilal Oswal Midcap Fund (Direct - IDCW) - Scheme Code 127040
  'INF247L01429': {
    schemeCode: '127040',
    isin: 'INF247L01429',
    isinGrowth: 'INF247L01429',
    schemeName: 'Motilal Oswal Midcap Fund',
    planType: 'Direct',
    optionType: 'IDCW',
    currentNav: 45.30,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Mid Cap'
  },
  // Motilal Oswal Midcap Fund (Regular - IDCW) - Scheme Code 127039
  'INF247L01411': {
    schemeCode: '127039',
    isin: 'INF247L01411',
    isinGrowth: 'INF247L01411',
    schemeName: 'Motilal Oswal Midcap Fund',
    planType: 'Regular',
    optionType: 'IDCW',
    currentNav: 41.10,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Mid Cap'
  },
  // Motilal Oswal Large and Midcap Fund (Direct - Growth) - Scheme Code 146985
  'INF247L01569': {
    schemeCode: '146985',
    isin: 'INF247L01569',
    isinGrowth: 'INF247L01569',
    schemeName: 'Motilal Oswal Large and Midcap Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 38.50,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Large & Mid Cap'
  },
  // Motilal Oswal Large and Midcap Fund (Regular - Growth) - Scheme Code 146984
  'INF247L01551': {
    schemeCode: '146984',
    isin: 'INF247L01551',
    isinGrowth: 'INF247L01551',
    schemeName: 'Motilal Oswal Large and Midcap Fund',
    planType: 'Regular',
    optionType: 'Growth',
    currentNav: 35.20,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Large & Mid Cap'
  },
  // Motilal Oswal Flexi Cap Fund (Direct - Growth) - Scheme Code 124973
  'INF247L01064': {
    schemeCode: '124973',
    isin: 'INF247L01064',
    isinGrowth: 'INF247L01064',
    schemeName: 'Motilal Oswal Flexi Cap Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 58.40,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Flexi Cap'
  },
  // Motilal Oswal Flexi Cap Fund (Regular - Growth) - Scheme Code 124972
  'INF247L01056': {
    schemeCode: '124972',
    isin: 'INF247L01056',
    isinGrowth: 'INF247L01056',
    schemeName: 'Motilal Oswal Flexi Cap Fund',
    planType: 'Regular',
    optionType: 'Growth',
    currentNav: 52.80,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Flexi Cap'
  },
  // Motilal Oswal Focused Fund (Direct - Growth) - Scheme Code 118251
  'INF247L01288': {
    schemeCode: '118251',
    isin: 'INF247L01288',
    isinGrowth: 'INF247L01288',
    schemeName: 'Motilal Oswal Focused Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 48.90,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Large Cap'
  },
  // Motilal Oswal Small Cap Fund (Direct - Growth) - Scheme Code 151122
  'INF247L01CQ1': {
    schemeCode: '151122',
    isin: 'INF247L01CQ1',
    isinGrowth: 'INF247L01CQ1',
    schemeName: 'Motilal Oswal Small Cap Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 16.80,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Equity - Small Cap'
  },
  // Motilal Oswal Nifty Midcap 150 Index Fund (Direct - Growth) - Scheme Code 147573
  'INF247L01999': {
    schemeCode: '147573',
    isin: 'INF247L01999',
    isinGrowth: 'INF247L01999',
    schemeName: 'Motilal Oswal Nifty Midcap 150 Index Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 36.25,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  // Motilal Oswal Nifty Midcap 150 Index Fund (Regular - Growth) - Scheme Code 147572
  'INF247L01981': {
    schemeCode: '147572',
    isin: 'INF247L01981',
    isinGrowth: 'INF247L01981',
    schemeName: 'Motilal Oswal Nifty Midcap 150 Index Fund',
    planType: 'Regular',
    optionType: 'Growth',
    currentNav: 34.80,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  // Motilal Oswal Nifty Smallcap 250 Index Fund (Direct - Growth) - Scheme Code 147571
  'INF247L01973': {
    schemeCode: '147571',
    isin: 'INF247L01973',
    isinGrowth: 'INF247L01973',
    schemeName: 'Motilal Oswal Nifty Smallcap 250 Index Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 35.10,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  // Motilal Oswal Nifty 500 Index Fund (Direct - Growth) - Scheme Code 147569
  'INF247L01957': {
    schemeCode: '147569',
    isin: 'INF247L01957',
    isinGrowth: 'INF247L01957',
    schemeName: 'Motilal Oswal Nifty 500 Index Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 28.90,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  // Motilal Oswal Nasdaq 100 Fund of Fund (Direct - Growth)
  'INF247L01718': {
    schemeCode: '145552',
    isin: 'INF247L01718',
    isinGrowth: 'INF247L01718',
    schemeName: 'Motilal Oswal Nasdaq 100 Fund of Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 70.45,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  'INF247L01031': {
    schemeCode: '145552',
    isin: 'INF247L01031',
    isinGrowth: 'INF247L01031',
    schemeName: 'Motilal Oswal Nasdaq 100 Fund of Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 70.45,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  'INF247L01536': {
    schemeCode: '145552',
    isin: 'INF247L01536',
    isinGrowth: 'INF247L01536',
    schemeName: 'Motilal Oswal Nasdaq 100 Fund of Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 70.45,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  'INF247L01544': {
    schemeCode: '145552',
    isin: 'INF247L01544',
    isinGrowth: 'INF247L01544',
    schemeName: 'Motilal Oswal Nasdaq 100 Fund of Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 70.45,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  'INF247L01528': {
    schemeCode: '145552',
    isin: 'INF247L01528',
    isinGrowth: 'INF247L01528',
    schemeName: 'Motilal Oswal Nasdaq 100 Fund of Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 70.45,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  // Motilal Oswal Nasdaq 100 Fund of Fund (Regular - Growth)
  'INF247L01700': {
    schemeCode: '145551',
    isin: 'INF247L01700',
    isinGrowth: 'INF247L01700',
    schemeName: 'Motilal Oswal Nasdaq 100 Fund of Fund',
    planType: 'Regular',
    optionType: 'Growth',
    currentNav: 63.80,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  'INF247L01049': {
    schemeCode: '145551',
    isin: 'INF247L01049',
    isinGrowth: 'INF247L01049',
    schemeName: 'Motilal Oswal Nasdaq 100 Fund of Fund',
    planType: 'Regular',
    optionType: 'Growth',
    currentNav: 63.80,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  'INF247L01510': {
    schemeCode: '145551',
    isin: 'INF247L01510',
    isinGrowth: 'INF247L01510',
    schemeName: 'Motilal Oswal Nasdaq 100 Fund of Fund',
    planType: 'Regular',
    optionType: 'Growth',
    currentNav: 63.80,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  // Motilal Oswal Nasdaq 100 ETF
  'INF247L01AP3': {
    schemeCode: '114984',
    isin: 'INF247L01AP3',
    isinGrowth: 'INF247L01AP3',
    schemeName: 'Motilal Oswal Nasdaq 100 ETF',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 274.50,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  'INF247L01015': {
    schemeCode: '114984',
    isin: 'INF247L01015',
    isinGrowth: 'INF247L01015',
    schemeName: 'Motilal Oswal Nasdaq 100 ETF',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 274.50,
    navDate: '2026-08-31',
    fundHouse: 'Motilal Oswal Mutual Fund',
    category: 'Index Fund'
  },
  // Zerodha ELSS Tax Saver Nifty LargeMidcap 250 Index Fund (Direct - Growth)
  'INF0R8F01026': {
    schemeCode: '152157',
    isin: 'INF0R8F01026',
    isinGrowth: 'INF0R8F01026',
    schemeName: 'Zerodha ELSS Tax Saver Nifty LargeMidcap 250 Index Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 14.65,
    navDate: '2026-08-31',
    fundHouse: 'Zerodha Mutual Fund',
    category: 'Equity - ELSS'
  },
  // Axis ELSS Tax Saver Fund (Direct - Growth)
  'INF846K01EW2': {
    schemeCode: '120503',
    isin: 'INF846K01EW2',
    isinGrowth: 'INF846K01EW2',
    schemeName: 'Axis ELSS- Tax Saver Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 112.93,
    navDate: '2026-08-31',
    fundHouse: 'Axis Mutual Fund',
    category: 'Equity - ELSS'
  },
  // Axis ELSS Tax Saver Fund (Direct - IDCW)
  'INF846K01EV4': {
    schemeCode: '120502',
    isin: 'INF846K01EV4',
    isinGrowth: 'INF846K01EV4',
    schemeName: 'Axis ELSS- Tax Saver Fund',
    planType: 'Direct',
    optionType: 'IDCW',
    currentNav: 24.15,
    navDate: '2026-08-31',
    fundHouse: 'Axis Mutual Fund',
    category: 'Equity - ELSS'
  },
  // Axis ELSS Tax Saver Fund (Regular - Growth)
  'INF846K01131': {
    schemeCode: '112323',
    isin: 'INF846K01131',
    isinGrowth: 'INF846K01131',
    schemeName: 'Axis ELSS- Tax Saver Fund',
    planType: 'Regular',
    optionType: 'Growth',
    currentNav: 101.80,
    navDate: '2026-08-31',
    fundHouse: 'Axis Mutual Fund',
    category: 'Equity - ELSS'
  },
  // Parag Parikh Flexi Cap Fund (Direct - Growth)
  'INF879O01027': {
    schemeCode: '122639',
    isin: 'INF879O01027',
    isinGrowth: 'INF879O01027',
    schemeName: 'Parag Parikh Flexi Cap Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 91.17,
    navDate: '2026-08-31',
    fundHouse: 'PPFAS Mutual Fund',
    category: 'Equity - Flexi Cap'
  },
  // Parag Parikh Flexi Cap Fund (Regular - Growth)
  'INF879O01019': {
    schemeCode: '122640',
    isin: 'INF879O01019',
    isinGrowth: 'INF879O01019',
    schemeName: 'Parag Parikh Flexi Cap Fund',
    planType: 'Regular',
    optionType: 'Growth',
    currentNav: 83.08,
    navDate: '2026-08-31',
    fundHouse: 'PPFAS Mutual Fund',
    category: 'Equity - Flexi Cap'
  },
  // Parag Parikh ELSS Tax Saver Fund (Direct - Growth)
  'INF879O01142': {
    schemeCode: '147481',
    isin: 'INF879O01142',
    isinGrowth: 'INF879O01142',
    schemeName: 'Parag Parikh ELSS Tax Saver Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 32.40,
    navDate: '2026-08-31',
    fundHouse: 'PPFAS Mutual Fund',
    category: 'Equity - ELSS'
  },
  // Quant Small Cap Fund (Direct - Growth)
  'INF966L01AA3': {
    schemeCode: '120828',
    isin: 'INF966L01AA3',
    isinGrowth: 'INF966L01AA3',
    schemeName: 'Quant Small Cap Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 254.80,
    navDate: '2026-08-31',
    fundHouse: 'Quant Mutual Fund',
    category: 'Equity - Small Cap'
  },
  // Mirae Asset Large & Midcap Fund (Direct - Growth)
  'INF769K01EZ2': {
    schemeCode: '118834',
    isin: 'INF769K01EZ2',
    isinGrowth: 'INF769K01EZ2',
    schemeName: 'Mirae Asset Large & Midcap Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 138.45,
    navDate: '2026-08-31',
    fundHouse: 'Mirae Asset Mutual Fund',
    category: 'Equity - Large Cap'
  },
  // HDFC Mid-Cap Opportunities Fund (Direct - Growth)
  'INF179K01CY1': {
    schemeCode: '118989',
    isin: 'INF179K01CY1',
    isinGrowth: 'INF179K01CY1',
    schemeName: 'HDFC Mid-Cap Opportunities Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 182.10,
    navDate: '2026-08-31',
    fundHouse: 'HDFC Mutual Fund',
    category: 'Equity - Mid Cap'
  },
  // Nippon India Small Cap Fund (Direct - Growth)
  'INF204K01W14': {
    schemeCode: '118778',
    isin: 'INF204K01W14',
    isinGrowth: 'INF204K01W14',
    schemeName: 'Nippon India Small Cap Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 168.30,
    navDate: '2026-08-31',
    fundHouse: 'Nippon India Mutual Fund',
    category: 'Equity - Small Cap'
  },
  // ICICI Prudential Bluechip Fund (Direct - Growth)
  'INF109K01Z48': {
    schemeCode: '120586',
    isin: 'INF109K01Z48',
    isinGrowth: 'INF109K01Z48',
    schemeName: 'ICICI Prudential Bluechip Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 114.75,
    navDate: '2026-08-31',
    fundHouse: 'ICICI Prudential Mutual Fund',
    category: 'Equity - Large Cap'
  },
  // UTI Nifty 50 Index Fund (Direct - Growth)
  'INF789F01EV8': {
    schemeCode: '120716',
    isin: 'INF789F01EV8',
    isinGrowth: 'INF789F01EV8',
    schemeName: 'UTI Nifty 50 Index Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 174.50,
    navDate: '2026-08-31',
    fundHouse: 'UTI Mutual Fund',
    category: 'Index Fund'
  },
  // Axis Small Cap Fund (Direct - Growth)
  'INF846K01K35': {
    schemeCode: '120465',
    isin: 'INF846K01K35',
    isinGrowth: 'INF846K01K35',
    schemeName: 'Axis Small Cap Fund',
    planType: 'Direct',
    optionType: 'Growth',
    currentNav: 106.80,
    navDate: '2026-08-31',
    fundHouse: 'Axis Mutual Fund',
    category: 'Equity - Small Cap'
  }
};

// Global in-memory cache of parsed AMFI database
let cachedIsinMap: Map<string, AmfiNavRecord> | null = null;
let cachedCodeMap: Map<string, AmfiNavRecord> | null = null;
let isFetchingAmfiNav = false;
let fetchPromise: Promise<{ isinMap: Map<string, AmfiNavRecord>; codeMap: Map<string, AmfiNavRecord> }> | null = null;

const AMFI_NAV_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt';
const STORAGE_KEY_AMFI_NAV = 'mftracker_amfi_nav_txt_v1';
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6; // 6 hours

/**
 * Format AMFI date strings (e.g. "31-Aug-2026", "31-08-2026", "31-Aug-24") to ISO "YYYY-MM-DD"
 */
export function parseAmfiDateToIso(dStr: string): string {
  if (!dStr) return new Date().toISOString().split('T')[0];
  const trimmed = dStr.trim();

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  // Match DD-MMM-YYYY or DD-MMM-YY
  const textMatch = trimmed.match(/^(\d{1,2})-([a-zA-Z]{3})-(\d{2,4})$/);
  if (textMatch) {
    const day = textMatch[1].padStart(2, '0');
    const mon = monthMap[textMatch[2].toLowerCase()] || '01';
    let year = textMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${mon}-${day}`;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const numMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (numMatch) {
    const day = numMatch[1].padStart(2, '0');
    const mon = numMatch[2].padStart(2, '0');
    let year = numMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${mon}-${day}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Derive fund house from fund name
 */
export function deriveFundHouseFromName(name: string, fallback: string = 'Mutual Fund'): string {
  const lower = name.toLowerCase();
  if (lower.includes('axis')) return 'Axis Mutual Fund';
  if (lower.includes('parag parikh') || lower.includes('ppfas')) return 'PPFAS Mutual Fund';
  if (lower.includes('hdfc')) return 'HDFC Mutual Fund';
  if (lower.includes('icici')) return 'ICICI Prudential Mutual Fund';
  if (lower.includes('sbi')) return 'SBI Mutual Fund';
  if (lower.includes('mirae')) return 'Mirae Asset Mutual Fund';
  if (lower.includes('nippon')) return 'Nippon India Mutual Fund';
  if (lower.includes('quant')) return 'Quant Mutual Fund';
  if (lower.includes('zerodha')) return 'Zerodha Mutual Fund';
  if (lower.includes('groww')) return 'Groww Mutual Fund';
  if (lower.includes('motilal') || lower.includes('motilal oswal')) return 'Motilal Oswal Mutual Fund';
  if (lower.includes('uti')) return 'UTI Mutual Fund';
  if (lower.includes('kotak')) return 'Kotak Mahindra Mutual Fund';
  if (lower.includes('tata')) return 'Tata Mutual Fund';
  if (lower.includes('franklin')) return 'Franklin Templeton Mutual Fund';
  if (lower.includes('bandhan') || lower.includes('idfc')) return 'Bandhan Mutual Fund';
  if (lower.includes('dsp')) return 'DSP Mutual Fund';
  if (lower.includes('canara') || lower.includes('robeco')) return 'Canara Robeco Mutual Fund';
  if (lower.includes('hsbc')) return 'HSBC Mutual Fund';
  if (lower.includes('invesco')) return 'Invesco Mutual Fund';
  if (lower.includes('sundaram')) return 'Sundaram Mutual Fund';
  if (lower.includes('edelweiss')) return 'Edelweiss Mutual Fund';
  if (lower.includes('navi')) return 'Navi Mutual Fund';
  if (lower.includes('aditya birla') || lower.includes('birla sun life')) return 'Aditya Birla Sun Life Mutual Fund';

  return fallback || 'Mutual Fund';
}

/**
 * Map raw scheme category text to standard Category enum
 */
export function mapAmfiCategory(rawCat: string = '', schemeName: string = ''): MutualFundScheme['category'] {
  const text = `${rawCat} ${schemeName}`.toLowerCase();
  if (text.includes('small cap')) return 'Equity - Small Cap';
  if (text.includes('mid cap') || text.includes('midcap')) return 'Equity - Mid Cap';
  if (text.includes('large cap') || text.includes('large & mid') || text.includes('bluechip') || text.includes('top 100')) return 'Equity - Large Cap';
  if (text.includes('elss') || text.includes('tax saver')) return 'Equity - ELSS';
  if (text.includes('index') || text.includes('nifty') || text.includes('sensex') || text.includes('etf')) return 'Index Fund';
  if (text.includes('liquid') || text.includes('overnight') || text.includes('money market')) return 'Debt - Liquid';
  if (text.includes('debt') || text.includes('bond') || text.includes('gilt') || text.includes('short duration') || text.includes('corporate bond')) return 'Debt - Short Duration';
  if (text.includes('hybrid') || text.includes('balanced') || text.includes('arbitrage') || text.includes('equity savings') || text.includes('multi asset')) return 'Hybrid - Aggressive';
  return 'Equity - Flexi Cap';
}

/**
 * Parse a single line from AMFI NAVAll.txt file
 * Supports both 8-column format and standard 6-column / 5-column AMFI formats:
 * Format A (8 cols): Scheme Code;ISIN Growth;ISIN Reinv;Scheme Name;Plan;Option;NAV;Date
 * Format B (6 cols): Scheme Code;ISIN Growth;ISIN Reinv;Scheme Name;NAV;Date
 */
export function parseAmfiNavLine(
  line: string,
  contextFundHouse: string = 'Mutual Fund',
  contextCategory: MutualFundScheme['category'] = 'Equity - Flexi Cap'
): AmfiNavRecord | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.includes(';')) return null;

  const parts = trimmed.split(';').map(p => p.trim());
  if (parts.length < 5) return null;

  const schemeCode = parts[0];
  if (!/^\d{5,7}$/.test(schemeCode)) return null;

  const isin1 = parts[1] && parts[1] !== '-' && parts[1].length >= 10 ? parts[1].toUpperCase() : undefined;
  const isin2 = parts[2] && parts[2] !== '-' && parts[2].length >= 10 ? parts[2].toUpperCase() : undefined;

  let rawSchemeName = '';
  let planStr = '';
  let optionStr = '';
  let navStr = '';
  let dateStr = '';

  if (parts.length >= 8) {
    // 8-column format: [code, isin1, isin2, schemeName, plan, option, nav, date]
    rawSchemeName = parts[3];
    planStr = parts[4];
    optionStr = parts[5];
    navStr = parts[6];
    dateStr = parts[7];
  } else if (parts.length === 7) {
    // 7-column format: [code, isin1, isin2, schemeName, planOrOption, nav, date]
    rawSchemeName = parts[3];
    planStr = parts[4];
    navStr = parts[5];
    dateStr = parts[6];
  } else if (parts.length === 6) {
    // Standard 6-column format: [code, isin1, isin2, schemeName, nav, date]
    rawSchemeName = parts[3];
    navStr = parts[4];
    dateStr = parts[5];
  } else if (parts.length === 5) {
    // 5-column format: [code, isin1, schemeName, nav, date]
    rawSchemeName = parts[2];
    navStr = parts[3];
    dateStr = parts[4];
  }

  // Parse NAV
  const parsedNav = parseFloat(navStr);
  const currentNav = isNaN(parsedNav) ? 0 : parsedNav;

  // Parse Date
  const navDate = parseAmfiDateToIso(dateStr);

  // Detect Plan Type
  let planType: 'Direct' | 'Regular' = 'Direct';
  if (planStr) {
    planType = planStr.toLowerCase().includes('direct') ? 'Direct' : 'Regular';
  } else {
    planType = detectPlanType(rawSchemeName, isin1 || isin2, schemeCode, 'Direct');
  }

  // Detect Option Type
  let optionType: 'Growth' | 'IDCW' = 'Growth';
  if (optionStr) {
    const oLower = optionStr.toLowerCase();
    optionType = (oLower.includes('idcw') || oLower.includes('dividend')) ? 'IDCW' : 'Growth';
  } else {
    optionType = detectOptionType(rawSchemeName, isin1 || isin2);
  }

  // Scheme Name: clean display name taken directly from AMFI!
  let schemeName = rawSchemeName;
  // If the AMFI scheme name line contains repetitive "Direct Plan Growth Option" in 6-col format, clean it
  if (!planStr && !optionStr) {
    schemeName = cleanFundDisplayName(rawSchemeName);
  } else {
    // In 8-col format, the name is already the base name! Clean any minor trailing hyphens
    schemeName = cleanFundDisplayName(rawSchemeName);
  }

  if (!schemeName || schemeName.length < 3) {
    schemeName = rawSchemeName;
  }

  const primaryIsin = isin1 || isin2 || '';
  const fundHouse = deriveFundHouseFromName(rawSchemeName, contextFundHouse);
  const category = mapAmfiCategory(contextCategory, rawSchemeName);

  return {
    schemeCode,
    isinGrowth: isin1,
    isinDivReinvestment: isin2,
    isin: primaryIsin,
    schemeName,
    rawSchemeName,
    planType,
    optionType,
    currentNav,
    navDate,
    fundHouse,
    category,
    rawRecord: trimmed
  };
}

/**
 * Parse full AMFI NAVAll.txt text into ISIN and SchemeCode lookup maps
 */
export function parseAmfiNavAllText(rawText: string): {
  isinMap: Map<string, AmfiNavRecord>;
  codeMap: Map<string, AmfiNavRecord>;
  records: AmfiNavRecord[];
} {
  const isinMap = new Map<string, AmfiNavRecord>();
  const codeMap = new Map<string, AmfiNavRecord>();
  const records: AmfiNavRecord[] = [];

  // Seed known records first
  Object.entries(SEED_AMFI_RECORDS).forEach(([isin, rec]) => {
    isinMap.set(isin.toUpperCase(), rec);
    codeMap.set(rec.schemeCode, rec);
  });

  const lines = rawText.split('\n');
  let currentFundHouse = 'Mutual Fund';
  let currentCategory: MutualFundScheme['category'] = 'Equity - Flexi Cap';

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Check for Category Header: e.g. "Open Ended Schemes( Equity Scheme - Large Cap Fund )"
    if (trimmed.toLowerCase().includes('schemes') && trimmed.includes('(')) {
      currentCategory = mapAmfiCategory(trimmed, '');
      continue;
    }

    // Check for Fund House Header: e.g. "Axis Mutual Fund"
    if (
      (trimmed.toLowerCase().includes('mutual fund') || trimmed.toLowerCase().includes('asset management')) &&
      !trimmed.includes(';')
    ) {
      currentFundHouse = trimmed;
      continue;
    }

    // Skip column headers
    if (trimmed.toLowerCase().startsWith('scheme code;')) {
      continue;
    }

    if (trimmed.includes(';')) {
      const rec = parseAmfiNavLine(trimmed, currentFundHouse, currentCategory);
      if (rec) {
        records.push(rec);
        codeMap.set(rec.schemeCode, rec);
        if (rec.isinGrowth && rec.isinGrowth.length >= 10) {
          isinMap.set(rec.isinGrowth.toUpperCase(), rec);
        }
        if (rec.isinDivReinvestment && rec.isinDivReinvestment.length >= 10) {
          isinMap.set(rec.isinDivReinvestment.toUpperCase(), rec);
        }
      }
    }
  }

  return { isinMap, codeMap, records };
}

/**
 * Initialize in-memory cache with seeded records
 */
function initMemoryCacheIfEmpty() {
  if (!cachedIsinMap) {
    cachedIsinMap = new Map<string, AmfiNavRecord>();
    cachedCodeMap = new Map<string, AmfiNavRecord>();
    Object.entries(SEED_AMFI_RECORDS).forEach(([isin, rec]) => {
      cachedIsinMap!.set(isin.toUpperCase(), rec);
      cachedCodeMap!.set(rec.schemeCode, rec);
    });
  }
}

/**
 * Fast synchronous lookup of an AMFI record by ISIN from memory / seed catalog
 */
export function lookupAmfiByIsin(isin?: string): AmfiNavRecord | null {
  if (!isin) return null;
  const isinUpper = isin.trim().toUpperCase();
  if (isinUpper.length < 10) return null;

  initMemoryCacheIfEmpty();
  return cachedIsinMap?.get(isinUpper) || SEED_AMFI_RECORDS[isinUpper] || null;
}

/**
 * Fast synchronous lookup of an AMFI record by Scheme Code from memory / seed catalog
 */
export function lookupAmfiBySchemeCode(code?: string): AmfiNavRecord | null {
  if (!code) return null;
  const codeTrimmed = code.trim();
  initMemoryCacheIfEmpty();
  return cachedCodeMap?.get(codeTrimmed) || null;
}

/**
 * Fast synchronous lookup of an AMFI record by scheme name and plan/option preference
 */
export function lookupAmfiBySchemeName(
  schemeName?: string,
  preferredPlan?: 'Direct' | 'Regular',
  preferredOption?: 'Growth' | 'IDCW'
): AmfiNavRecord | null {
  if (!schemeName || schemeName.trim().length < 3) return null;
  initMemoryCacheIfEmpty();

  const cleanQuery = cleanFundDisplayName(schemeName).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanQuery) return null;

  const targetPlan = preferredPlan || detectPlanType(schemeName, undefined, undefined, 'Direct');
  const targetOption = preferredOption || detectOptionType(schemeName);

  // Search across memory maps or seed records
  const allRecords: AmfiNavRecord[] = [];
  if (cachedCodeMap && cachedCodeMap.size > 0) {
    allRecords.push(...Array.from(cachedCodeMap.values()));
  } else {
    allRecords.push(...Object.values(SEED_AMFI_RECORDS));
  }

  let bestMatch: AmfiNavRecord | null = null;
  let bestScore = 0;

  for (const rec of allRecords) {
    const recClean = cleanFundDisplayName(rec.schemeName).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!recClean) continue;

    let score = 0;
    if (recClean === cleanQuery) {
      score = 100;
    } else if (recClean.includes(cleanQuery) || cleanQuery.includes(recClean)) {
      score = 85;
    } else {
      const queryWords = cleanFundDisplayName(schemeName)
        .toLowerCase()
        .split(/[\s\-&]+/)
        .filter(w => w.length > 2 && w !== 'fund' && w !== 'direct' && w !== 'regular' && w !== 'growth' && w !== 'plan');
      
      if (queryWords.length > 0) {
        const matched = queryWords.filter(w => rec.schemeName.toLowerCase().includes(w)).length;
        if (matched >= Math.min(queryWords.length, 3)) {
          score = 50 + (matched / queryWords.length) * 30;
        }
      }
    }

    if (score > 0) {
      if (rec.planType === targetPlan) score += 10;
      if (rec.optionType === targetOption) score += 5;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = rec;
      }
    }
  }

  if (bestScore >= 60) {
    return bestMatch;
  }

  return null;
}

/**
 * Fetch and load the latest AMFI NAVAll.txt database with caching and proxy support
 */
export async function loadAmfiNavDatabase(
  forceRefresh: boolean = false
): Promise<{ isinMap: Map<string, AmfiNavRecord>; codeMap: Map<string, AmfiNavRecord> }> {
  initMemoryCacheIfEmpty();

  // If already loaded and not forceRefresh, return immediately
  if (!forceRefresh && cachedIsinMap && cachedIsinMap.size > 50) {
    return { isinMap: cachedIsinMap, codeMap: cachedCodeMap! };
  }

  // If a fetch is already in progress, await that promise
  if (isFetchingAmfiNav && fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    isFetchingAmfiNav = true;
    try {
      // 1. Try local storage cache if available and fresh
      if (!forceRefresh) {
        try {
          const cachedRaw = localStorage.getItem(STORAGE_KEY_AMFI_NAV);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Date.now() - parsed.timestamp < CACHE_MAX_AGE_MS && parsed.text) {
              const result = parseAmfiNavAllText(parsed.text);
              cachedIsinMap = result.isinMap;
              cachedCodeMap = result.codeMap;
              return result;
            }
          }
        } catch {
          // Ignore cache parse errors
        }
      }

      // 2. Fetch from endpoints:
      // Priority A: Local /api/amfi-nav proxy
      // Priority B: Direct AMFI portal URL
      // Priority C: CORS proxy fallback
      const candidateUrls = [
        '/api/amfi-nav',
        '/api/amfi/navall',
        AMFI_NAV_URL,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(AMFI_NAV_URL)}`
      ];

      let rawText = '';
      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, {
            headers: {
              'Accept': 'text/plain, */*'
            }
          });
          if (res.ok) {
            const text = await res.text();
            if (text && text.includes(';') && (text.includes('120503') || text.includes('INF846K01EW2') || text.includes('Scheme Code'))) {
              rawText = text;
              break;
            }
          }
        } catch {
          // Try next URL
        }
      }

      if (rawText) {
        const result = parseAmfiNavAllText(rawText);
        cachedIsinMap = result.isinMap;
        cachedCodeMap = result.codeMap;

        try {
          localStorage.setItem(
            STORAGE_KEY_AMFI_NAV,
            JSON.stringify({
              timestamp: Date.now(),
              text: rawText
            })
          );
        } catch {}

        return result;
      }
    } catch (err) {
      console.warn('[AMFI NAV Service] Error fetching NAVAll.txt:', err);
    } finally {
      isFetchingAmfiNav = false;
      fetchPromise = null;
    }

    // Return current memory/seed cache if network fetch failed
    return { isinMap: cachedIsinMap!, codeMap: cachedCodeMap! };
  })();

  return fetchPromise;
}

/**
 * Preload AMFI NAV database in background
 */
export function preloadAmfiNavData(): void {
  loadAmfiNavDatabase(false).catch(() => {});
}
