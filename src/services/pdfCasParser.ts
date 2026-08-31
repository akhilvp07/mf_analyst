import * as pdfjsLib from 'pdfjs-dist';
import { TransactionRecord, MutualFundScheme } from '../types';
import { cleanFundDisplayName, isValidFolioNumber } from '../utils/financialCalculations';

// Set worker source for pdfjs-dist
try {
  // @ts-ignore
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('Could not set pdf workerSrc', e);
}

export interface PdfParseResult {
  transactions: TransactionRecord[];
  detectedSchemes: Partial<MutualFundScheme>[];
  folioCount: number;
  investorName?: string;
  pan?: string;
  statementPeriod?: string;
  error?: string;
  requiresPassword?: boolean;
}

/**
 * Normalizes dates like:
 * "10-Jan-2023", "10-Jan-23", "10/01/2023", "10/01/23", "10-01-2023", "10-01-23",
 * "10.01.2023", "10.01.23", "2023-01-10", "10-JAN-2024", "10 Jan 2024", "December 08, 2023"
 */
export function normalizeAnyDate(text: string): string | null {
  if (!text) return null;
  const clean = text.trim();

  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', may_: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  // 1. Match Month DD, YYYY (e.g. "December 08, 2023", "Dec 8 2023")
  const monDY = clean.match(/\b([a-zA-Z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})\b/);
  if (monDY) {
    const monKey = monDY[1].toLowerCase().substring(0, 3);
    const month = monthMap[monKey];
    const day = monDY[2].padStart(2, '0');
    let year = monDY[3];
    if (year.length === 2) {
      const yNum = parseInt(year, 10);
      year = yNum >= 70 ? `19${year}` : `20${year}`;
    }
    if (month) {
      const yInt = parseInt(year, 10);
      if (yInt >= 1990 && yInt <= 2030) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  // 2. Match DD-Mon-YYYY or DD-Mon-YY (e.g. 15-Mar-2024, 15-Mar-24, 15/Mar/2024, 15-MAR-2024, 15 Mar 2024)
  const dMonY = clean.match(/\b(\d{1,2})[-/ .]([a-zA-Z]{3,9})[-/ .](\d{2,4})\b/);
  if (dMonY) {
    const day = dMonY[1].padStart(2, '0');
    const monKey = dMonY[2].toLowerCase().substring(0, 3);
    const month = monthMap[monKey];
    if (month) {
      let year = dMonY[3];
      if (year.length === 2) {
        const yNum = parseInt(year, 10);
        year = yNum >= 70 ? `19${year}` : `20${year}`;
      }
      const yInt = parseInt(year, 10);
      if (yInt >= 1990 && yInt <= 2030) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  // 3. Match DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY or DD-MM-YY or DD/MM/YY
  const dmy = clean.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const dVal = parseInt(day, 10);
    const mVal = parseInt(month, 10);

    if (dVal >= 1 && dVal <= 31 && mVal >= 1 && mVal <= 12) {
      let year = dmy[3];
      if (year.length === 2) {
        const yNum = parseInt(year, 10);
        year = yNum >= 70 ? `19${year}` : `20${year}`;
      }
      const yInt = parseInt(year, 10);
      if (yInt >= 1990 && yInt <= 2030) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  // 4. Match YYYY-MM-DD
  const ymd = clean.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    const mVal = parseInt(month, 10);
    const dVal = parseInt(day, 10);
    const yInt = parseInt(year, 10);
    if (mVal >= 1 && mVal <= 12 && dVal >= 1 && dVal <= 31 && yInt >= 1990 && yInt <= 2030) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/**
 * Filter out disclaimers, name change notices, SEBI circulars, and header/footer noise
 */
export function isDisclaimerOrNoticeLine(line: string): boolean {
  if (!line || line.trim().length === 0) return true;
  const l = line.toLowerCase();
  
  // Administrative and scheme name change notices
  if (
    l.includes('name has been changed') ||
    (l.includes('name of') && l.includes('changed')) ||
    l.includes('has been changed to') ||
    l.includes('w.e.f') ||
    l.includes('with effect from') ||
    l.includes('pursuant to') ||
    l.includes('sebi circular') ||
    l.includes('sebi regulation') ||
    l.includes('categorization of mutual fund') ||
    l.includes('stamp duty') ||
    l.includes('stampduty') ||
    l.includes('stt paid') ||
    l.includes('securities transaction tax') ||
    l.includes('statutory levy') ||
    l.includes('subject to market risk') ||
    l.includes('read all scheme related') ||
    l.includes('dear investor') ||
    l.includes('toll free') ||
    l.includes('helpline') ||
    l.includes('grievance') ||
    l.includes('computer age management') ||
    l.includes('kfin technologies') ||
    l.includes('cams investor services') ||
    l.includes('registrar & transfer agent') ||
    l.includes('registered office') ||
    l.includes('nominee') ||
    l.includes('kyc status') ||
    l.includes('bank mandate') ||
    l.includes('bank name') ||
    l.includes('ifsc') ||
    l.includes('pan:') ||
    l.includes('cin:') ||
    l.includes('gstin:') ||
    l.includes('arn-') ||
    l.includes('euin-') ||
    l.includes('consolidated account statement') ||
    l.includes('summary of portfolio') ||
    l.includes('statement period') ||
    l.includes('closing unit balance') ||
    l.includes('opening unit balance') ||
    l.includes('opening balance') ||
    l.includes('total cost') ||
    l.includes('total market value') ||
    l.includes('total valuation') ||
    l.includes('market value as on') ||
    l.includes('valuation as on')
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if a line is a genuine Scheme Header
 */
export function isSchemeHeaderLine(line: string): boolean {
  if (isDisclaimerOrNoticeLine(line)) return false;

  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();

  // A genuine scheme header must NEVER start with a date!
  if (/^(\d{1,2}[-/ .][a-zA-Z]{3,9}|\d{1,2}[-/.]\d{1,2}|\d{4}[-/.]|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i.test(trimmed)) {
    return false;
  }

  // Must not be a folio-only or advisor-only line
  if (/^folio\s*(?:no|number|\#)?\s*[:\-\s]/i.test(trimmed) && !lower.includes('fund') && !lower.includes('growth')) {
    return false;
  }

  // Must contain mutual fund scheme identifiers
  const hasFundKeywords = 
    lower.includes('fund') || 
    lower.includes('growth') || 
    lower.includes('direct plan') || 
    lower.includes('regular plan') || 
    lower.includes('idcw') || 
    lower.includes('dividend') || 
    lower.includes('index fund') ||
    lower.includes('etf') ||
    lower.includes('scheme:') ||
    lower.includes('scheme name:');

  const hasIsin = /\bINF[A-Z0-9]{9}\b/i.test(line);

  return hasFundKeywords || hasIsin;
}

/**
 * Clean scheme header text to get proper scheme name
 */
export function cleanSchemeHeader(rawName: string): string {
  return cleanFundDisplayName(rawName);
}

/**
 * Generate scheme info with clean fund name, fund house, and category
 */
export function findOrGenerateSchemeInfo(rawName: string, isin?: string): { 
  code: string; 
  name: string; 
  category: MutualFundScheme['category']; 
  fundHouse: string;
  defaultNav: number;
} {
  const cleanRaw = cleanFundDisplayName(rawName);
  const lowerRaw = rawName.toLowerCase();

  // Derive fund house
  let fundHouse = 'Mutual Fund';
  if (lowerRaw.includes('parag parikh') || lowerRaw.includes('ppfas')) fundHouse = 'PPFAS Mutual Fund';
  else if (lowerRaw.includes('hdfc')) fundHouse = 'HDFC Mutual Fund';
  else if (lowerRaw.includes('sbi')) fundHouse = 'SBI Mutual Fund';
  else if (lowerRaw.includes('icici')) fundHouse = 'ICICI Prudential Mutual Fund';
  else if (lowerRaw.includes('quant')) fundHouse = 'Quant Mutual Fund';
  else if (lowerRaw.includes('kotak')) fundHouse = 'Kotak Mahindra Mutual Fund';
  else if (lowerRaw.includes('mirae')) fundHouse = 'Mirae Asset Mutual Fund';
  else if (lowerRaw.includes('nippon')) fundHouse = 'Nippon India Mutual Fund';
  else if (lowerRaw.includes('axis')) fundHouse = 'Axis Mutual Fund';
  else if (lowerRaw.includes('tata')) fundHouse = 'Tata Mutual Fund';
  else if (lowerRaw.includes('uti')) fundHouse = 'UTI Mutual Fund';
  else if (lowerRaw.includes('motilal')) fundHouse = 'Motilal Oswal Mutual Fund';
  else if (lowerRaw.includes('dsp')) fundHouse = 'DSP Mutual Fund';
  else if (lowerRaw.includes('bandhan') || lowerRaw.includes('idfc')) fundHouse = 'Bandhan Mutual Fund';
  else if (lowerRaw.includes('franklin')) fundHouse = 'Franklin Templeton Mutual Fund';

  // Derive category
  let category: MutualFundScheme['category'] = 'Equity - Flexi Cap';
  if (lowerRaw.includes('small cap') || lowerRaw.includes('smallcap') || lowerRaw.includes('small-cap')) category = 'Equity - Small Cap';
  else if (lowerRaw.includes('mid cap') || lowerRaw.includes('midcap') || lowerRaw.includes('mid-cap') || lowerRaw.includes('emerging')) category = 'Equity - Mid Cap';
  else if (lowerRaw.includes('large cap') || lowerRaw.includes('largecap') || lowerRaw.includes('top 100') || lowerRaw.includes('bluechip') || lowerRaw.includes('frontline')) category = 'Equity - Large Cap';
  else if (lowerRaw.includes('flexi cap') || lowerRaw.includes('flexicap') || lowerRaw.includes('multi cap') || lowerRaw.includes('multicap')) category = 'Equity - Flexi Cap';
  else if (lowerRaw.includes('elss') || lowerRaw.includes('tax saver') || lowerRaw.includes('tax adv')) category = 'Equity - ELSS';
  else if (lowerRaw.includes('nifty') || lowerRaw.includes('sensex') || lowerRaw.includes('index fund') || lowerRaw.includes('etf')) category = 'Index Fund';
  else if (lowerRaw.includes('liquid') || lowerRaw.includes('overnight') || lowerRaw.includes('money market') || lowerRaw.includes('cash')) category = 'Debt - Liquid';
  else if (lowerRaw.includes('debt') || lowerRaw.includes('gilt') || lowerRaw.includes('short duration') || lowerRaw.includes('bond') || lowerRaw.includes('corporate bond')) category = 'Debt - Short Duration';
  else if (lowerRaw.includes('hybrid') || lowerRaw.includes('balanced') || lowerRaw.includes('multi asset') || lowerRaw.includes('equity savings')) category = 'Hybrid - Aggressive';

  // Deterministic scheme code hash based on clean name
  let hash = 0;
  for (let i = 0; i < cleanRaw.length; i++) {
    hash = (hash << 5) - hash + cleanRaw.charCodeAt(i);
    hash |= 0;
  }
  const syntheticCode = `CAS-${Math.abs(hash % 900000) + 100000}`;

  return {
    code: syntheticCode,
    name: cleanRaw || 'Indian Mutual Fund Scheme',
    category,
    fundHouse,
    defaultNav: 85.0
  };
}

/**
 * Determine Transaction type from line text or description
 */
export function classifyTransactionType(desc: string): TransactionRecord['type'] {
  const d = desc.toUpperCase();
  if (d.includes('SWITCH OUT') || d.includes('SWITCH-OUT') || d.includes('STP OUT') || d.includes('STP-OUT') || d.includes('SWITCHOUT')) {
    return 'SWITCH_OUT';
  }
  if (d.includes('SWITCH IN') || d.includes('SWITCH-IN') || d.includes('STP IN') || d.includes('STP-IN') || d.includes('SWITCHIN')) {
    return 'SWITCH_IN';
  }
  if (d.includes('REDEMPTION') || d.includes('REDEEM') || d.includes('SELL') || d.includes('SWP') || d.includes('SYSTEMATIC WITHDRAWAL')) {
    return 'REDEMPTION';
  }
  if (d.includes('DIVIDEND REINVEST') || d.includes('REINVESTMENT') || d.includes('DIV REINV')) {
    return 'DIVIDEND_REINVEST';
  }
  if (d.includes('PURCHASE') || d.includes('LUMPSUM') || d.includes('ADDITIONAL') || d.includes('NFO') || d.includes('INITIAL') || d.includes('NEW PURCHASE')) {
    return 'LUMPSUM';
  }
  if (d.includes('SIP') || d.includes('SYSTEMATIC') || d.includes('AUTO DEBIT') || d.includes('MANDATE') || d.includes('NACH') || d.includes('SI PURCHASE')) {
    return 'SIP';
  }

  return 'SIP';
}

/**
 * Extracts numbers (amounts, units, NAV) from a string, handling Indian formats:
 * e.g. "15,000.00", "-15,000.00", "(15,000.00)", "311.203", "48.20", "1245.89"
 */
function extractFinancialNumbers(text: string): { original: string; value: number; isNegative: boolean }[] {
  const results: { original: string; value: number; isNegative: boolean }[] = [];
  
  const regex = /(?:\(([-+]?[\d,]+\.?\d*)\)|([-+]?[\d,]+\.?\d*))/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1] || match[2];
    if (!raw) continue;
    
    const isParenNeg = Boolean(match[1]);
    const cleanNum = raw.replace(/,/g, '');
    const num = parseFloat(cleanNum);
    
    // Ignore pure single-digit integers or numbers that look like years (1990-2030 without decimals)
    if (!isNaN(num) && num !== 0) {
      if (!raw.includes('.') && num >= 1990 && num <= 2030) {
        continue;
      }
      
      // Filter out huge numbers > 50,000,000 (likely helpline/reference numbers)
      if (Math.abs(num) > 50000000 && !raw.includes('.')) {
        continue;
      }

      if (raw.includes('.') || Math.abs(num) >= 50) {
        const isNegative = isParenNeg || num < 0 || cleanNum.startsWith('-');
        results.push({
          original: match[0],
          value: Math.abs(num),
          isNegative
        });
      }
    }
  }

  return results;
}

/**
 * Checks if a line contains mutual fund transaction action keywords
 */
function hasTransactionKeywords(text: string): boolean {
  const t = text.toUpperCase();
  return (
    t.includes('SIP') ||
    t.includes('PURCHASE') ||
    t.includes('SYSTEMATIC') ||
    t.includes('ADDITIONAL') ||
    t.includes('NEW PURCHASE') ||
    t.includes('NFO') ||
    t.includes('SWITCH IN') ||
    t.includes('SWITCH-IN') ||
    t.includes('SWITCH OUT') ||
    t.includes('SWITCH-OUT') ||
    t.includes('REDEMPTION') ||
    t.includes('REDEEM') ||
    t.includes('SELL') ||
    t.includes('DIVIDEND') ||
    t.includes('STP IN') ||
    t.includes('STP OUT') ||
    t.includes('SWP') ||
    t.includes('REINVEST') ||
    t.includes('AUTO DEBIT') ||
    t.includes('MANDATE') ||
    t.includes('NACH') ||
    t.includes('TRANSACTION')
  );
}

/**
 * Parse CAMS or KFintech PDF CAS statements with password decryption
 */
export async function parsePdfCasStatement(
  pdfBuffer: ArrayBuffer | Uint8Array,
  password?: string
): Promise<PdfParseResult> {
  const transactions: TransactionRecord[] = [];
  const detectedSchemesMap = new Map<string, Partial<MutualFundScheme>>();
  const schemeLastNavMap = new Map<string, { nav: number; date: string }>();
  const foliosSet = new Set<string>();

  try {
    // Allocate a dedicated Uint8Array copy to guarantee it is isolated
    const rawBytes = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
    const dataCopy = new Uint8Array(rawBytes.length);
    dataCopy.set(rawBytes);

    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      password: password || '',
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/'
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    let fullText = '';
    const allReconstructedLines: string[] = [];

    // Extract text from each page with adaptive vertical clustering
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const items = textContent.items.map((item: any) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        height: item.height || 10,
        width: item.width || 10
      }));

      // Sort vertically descending (top to bottom), then horizontally ascending (left to right)
      items.sort((a, b) => b.y - a.y || a.x - b.x);

      // Cluster items with adaptive vertical threshold (up to 6.5pt difference)
      const pageLines: { y: number; words: { x: number; text: string }[] }[] = [];
      
      items.forEach(item => {
        const text = item.str.trim();
        if (!text) return;

        let matchedLine = pageLines.find(line => Math.abs(line.y - item.y) <= 6.5);
        if (!matchedLine) {
          matchedLine = { y: item.y, words: [] };
          pageLines.push(matchedLine);
        }
        matchedLine.words.push({ x: item.x, text });
      });

      // Sort clusters top to bottom
      pageLines.sort((a, b) => b.y - a.y);

      // Reconstruct each line by sorting its words left-to-right
      pageLines.forEach(lineCluster => {
        lineCluster.words.sort((a, b) => a.x - b.x);
        const lineStr = lineCluster.words.map(w => w.text).join(' ');
        if (lineStr.trim()) {
          allReconstructedLines.push(lineStr);
        }
      });

      fullText += '\n' + allReconstructedLines.join('\n');
    }

    // Extract Statement Metadata (PAN, Investor Name, Period)
    let investorName: string | undefined;
    let pan: string | undefined;
    let statementPeriod: string | undefined;

    const panMatch = fullText.match(/PAN\s*[:\-\s]\s*([A-Z]{5}[0-9]{4}[A-Z])/i) || fullText.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
    if (panMatch) pan = panMatch[1].toUpperCase();

    const periodMatch = fullText.match(/(?:Statement Period|Period|For the period)\s*[:\-\s]\s*([^\n\r]+)/i);
    if (periodMatch) statementPeriod = periodMatch[1].trim();

    const nameMatch = fullText.match(/(?:Investor Name|Name|Dear Mr\.|Dear Ms\.|Dear Dr\.)\s*[:\-\s]*([A-Z\s]{3,40})/i);
    if (nameMatch) {
      const cleanName = nameMatch[1].trim();
      if (!cleanName.toLowerCase().includes('statement') && !cleanName.toLowerCase().includes('consolidated') && !cleanName.toLowerCase().includes('account')) {
        investorName = cleanName;
      }
    }

    // Active state tracking during sequential scan
    let currentFolio = 'FOLIO-1';
    let currentSchemeName = 'Indian Mutual Fund Scheme';
    let currentIsin = '';
    let currentSchemeCode = '120503';
    let currentCategory: MutualFundScheme['category'] = 'Equity - ELSS';
    let currentFundHouse = 'Axis Mutual Fund';
    let txIdCounter = 1;

    // Helper to register scheme
    const registerScheme = (rawName: string, isin?: string) => {
      const cleaned = cleanFundDisplayName(rawName);
      if (!cleaned || cleaned.length < 3) return;

      const info = findOrGenerateSchemeInfo(cleaned, isin || currentIsin);
      currentSchemeName = info.name;
      currentSchemeCode = info.code;
      currentCategory = info.category;
      currentFundHouse = info.fundHouse;
      if (isin) currentIsin = isin;

      if (!detectedSchemesMap.has(currentSchemeCode)) {
        detectedSchemesMap.set(currentSchemeCode, {
          schemeCode: currentSchemeCode,
          schemeName: info.name,
          category: info.category,
          fundHouse: info.fundHouse,
          currentNav: info.defaultNav,
          navDate: new Date().toISOString().split('T')[0],
          navChange1D: 0,
          isin: currentIsin || undefined
        });
      }
    };

    // -------------------------------------------------------------
    // PASS 1: Line-by-Line Structured Parsing
    // -------------------------------------------------------------
    for (let i = 0; i < allReconstructedLines.length; i++) {
      const line = allReconstructedLines[i];

      // 1. Check if line contains a closing NAV or valuation line for current scheme
      const closingNavMatch = line.match(/(?:NAV\s*(?:on|as\s*on|:|\s)\s*(?:INR|Rs\.?)?\s*|NAV\s*[:\-\s]\s*)([0-9,]+\.[0-9]{2,4})/i) ||
                              line.match(/at\s*NAV\s*(?:INR|Rs\.?)?\s*([0-9,]+\.[0-9]{2,4})/i);
      if (closingNavMatch && closingNavMatch[1]) {
        const cNav = parseFloat(closingNavMatch[1].replace(/,/g, ''));
        if (!isNaN(cNav) && cNav > 0 && cNav < 50000) {
          schemeLastNavMap.set(currentSchemeCode, {
            nav: cNav,
            date: new Date().toISOString().split('T')[0]
          });
        }
      }

      // 2. Detect Folio Number (strict validation: MUST contain digits & not be a stopword like 'with')
      const folioMatch = line.match(/(?:Folio\s*(?:No|Number|\#)?|Account\s*(?:No|Number|\#)?)\s*[:\-\s]\s*([A-Z0-9\/\-_]+)/i);
      if (folioMatch && folioMatch[1]) {
        const candidateFolio = folioMatch[1].trim();
        if (isValidFolioNumber(candidateFolio)) {
          currentFolio = candidateFolio;
          foliosSet.add(currentFolio);
        }
      }

      // 3. Detect ISIN code
      const isinMatch = line.match(/\b(INF[A-Z0-9]{9})\b/i);
      if (isinMatch) {
        currentIsin = isinMatch[1].toUpperCase();
      }

      // 4. Detect Scheme Header
      if (isSchemeHeaderLine(line)) {
        registerScheme(line, currentIsin);
        continue;
      }

      // If this line is a disclaimer or notice, completely skip it!
      if (isDisclaimerOrNoticeLine(line)) {
        continue;
      }

      // 5. Detect Transaction Row
      const dateMatches = line.match(/\b(\d{1,2}[-/ .][a-zA-Z]{3,9}[-/ .]\d{2,4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|[a-zA-Z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b/g);

      if (dateMatches && dateMatches.length > 0) {
        const dateCandidate = dateMatches[0];
        const parsedDate = normalizeAnyDate(dateCandidate);

        if (parsedDate) {
          const lineWithoutDate = line.replace(dateCandidate, ' ');
          const numbers = extractFinancialNumbers(lineWithoutDate);
          const hasTxWord = hasTransactionKeywords(line);

          if (numbers.length >= 1) {
            let amount = 0;
            let units = 0;
            let nav = 0;
            let isNegative = false;

            // Pattern A: 3+ numbers -> [Amount, Units, Price/NAV, Balance] or [Units, Price, Amount]
            if (numbers.length >= 3) {
              let foundTriplet = false;
              for (let a = 0; a < numbers.length; a++) {
                for (let u = 0; u < numbers.length; u++) {
                  if (a === u) continue;
                  for (let n = 0; n < numbers.length; n++) {
                    if (n === a || n === u) continue;
                    const aVal = numbers[a].value;
                    const uVal = numbers[u].value;
                    const nVal = numbers[n].value;

                    if (aVal >= 50 && uVal > 0 && nVal > 0) {
                      const product = uVal * nVal;
                      const diff = Math.abs(product - aVal);
                      const tolerance = Math.max(5.0, aVal * 0.03); // 3% tolerance for stamp duty
                      if (diff <= tolerance) {
                        amount = aVal;
                        units = uVal;
                        nav = nVal;
                        isNegative = numbers[a].isNegative || numbers[u].isNegative;
                        foundTriplet = true;
                        break;
                      }
                    }
                  }
                  if (foundTriplet) break;
                }
                if (foundTriplet) break;
              }

              // Standard CAMS order fallback: [Amount, Units, NAV, Balance]
              if (!foundTriplet && (hasTxWord || numbers[0].value >= 100)) {
                const n0 = numbers[0].value;
                const n1 = numbers[1].value;
                const n2 = numbers[2].value;

                if (n0 >= 50 && n1 > 0 && n2 > 0) {
                  amount = n0;
                  units = n1;
                  nav = n2;
                  isNegative = numbers[0].isNegative || numbers[1].isNegative;
                }
              }
            }

            // Pattern B: 2 numbers -> [Amount, Units]
            if (amount === 0 && numbers.length === 2 && hasTxWord) {
              const val1 = numbers[0].value;
              const val2 = numbers[1].value;
              
              if (val1 >= 50 && val2 > 0 && val2 < val1) {
                amount = val1;
                units = val2;
                nav = amount / units;
                isNegative = numbers[0].isNegative || numbers[1].isNegative;
              } else if (val2 >= 50 && val1 > 0 && val1 < val2) {
                amount = val2;
                units = val1;
                nav = amount / units;
                isNegative = numbers[0].isNegative || numbers[1].isNegative;
              }
            }

            // Pattern C: Wrapped CAMS table lookahead
            if (amount === 0 && numbers.length === 1 && hasTxWord && i + 1 < allReconstructedLines.length) {
              const nextLine = allReconstructedLines[i + 1];
              if (!isDisclaimerOrNoticeLine(nextLine) && !isSchemeHeaderLine(nextLine)) {
                const nextNumbers = extractFinancialNumbers(nextLine);
                const combined = [...numbers, ...nextNumbers];
                if (combined.length >= 2) {
                  const val1 = combined[0].value;
                  const val2 = combined[1].value;
                  if (val1 >= 50 && val2 > 0 && val2 < val1) {
                    amount = val1;
                    units = val2;
                    nav = combined.length >= 3 ? combined[2].value : amount / units;
                    isNegative = combined[0].isNegative || combined[1].isNegative;
                  }
                }
              }
            }

            // Reject if amount is unreasonably bloated (e.g. > 10 crore)
            if (amount > 100000000) {
              continue;
            }

            // If we have valid amount and units
            if (amount >= 50 && units > 0) {
              if (nav === 0 || isNaN(nav)) nav = amount / units;
              
              schemeLastNavMap.set(currentSchemeCode, {
                nav: Math.round(nav * 100) / 100,
                date: parsedDate
              });

              let txType = classifyTransactionType(line);
              
              const upperLine = line.toUpperCase();
              const isExplicitRedemption = 
                upperLine.includes('REDEMPTION') || 
                upperLine.includes('REDEEM') || 
                upperLine.includes('SELL') || 
                upperLine.includes('SWP') || 
                upperLine.includes('SWITCH OUT') || 
                upperLine.includes('SWITCH-OUT');

              if (isNegative && isExplicitRedemption) {
                txType = upperLine.includes('SWITCH OUT') ? 'SWITCH_OUT' : 'REDEMPTION';
              } else if (!isExplicitRedemption && (txType === 'REDEMPTION' || txType === 'SWITCH_OUT')) {
                txType = 'SIP';
              }

              transactions.push({
                id: `pdf-tx-${txIdCounter++}`,
                folioNumber: isValidFolioNumber(currentFolio) ? currentFolio : 'FOLIO-1',
                schemeCode: currentSchemeCode,
                schemeName: cleanFundDisplayName(currentSchemeName),
                type: txType,
                date: parsedDate,
                units: Math.round(units * 1000) / 1000,
                nav: Math.round(nav * 100) / 100,
                amount: Math.round(amount * 100) / 100,
                status: 'COMPLETED',
                notes: line.replace(/\s+/g, ' ').substring(0, 50).trim()
              });
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // PASS 2: Token-Window Stream Parser (Fallback if Pass 1 found 0 rows)
    // -------------------------------------------------------------
    if (transactions.length === 0) {
      const dateTokenRegex = /\b(\d{1,2}[-/ .][a-zA-Z]{3,9}[-/ .]\d{2,4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g;
      let dateMatch;
      const dateIndices: { dateStr: string; index: number; parsedDate: string }[] = [];

      while ((dateMatch = dateTokenRegex.exec(fullText)) !== null) {
        const pDate = normalizeAnyDate(dateMatch[1]);
        if (pDate) {
          dateIndices.push({
            dateStr: dateMatch[1],
            index: dateMatch.index,
            parsedDate: pDate
          });
        }
      }

      for (let d = 0; d < dateIndices.length; d++) {
        const curr = dateIndices[d];
        const nextIndex = d + 1 < dateIndices.length ? dateIndices[d + 1].index : curr.index + 300;
        const windowText = fullText.substring(curr.index, Math.min(curr.index + 250, nextIndex));
        
        if (isDisclaimerOrNoticeLine(windowText)) {
          continue;
        }

        if (!hasTransactionKeywords(windowText)) {
          continue;
        }

        const windowNumbers = extractFinancialNumbers(windowText.replace(curr.dateStr, ' '));
        if (windowNumbers.length >= 2) {
          let amount = 0;
          let units = 0;
          let nav = 0;
          let isNegative = false;

          if (windowNumbers.length >= 3) {
            amount = windowNumbers[0].value;
            units = windowNumbers[1].value;
            nav = windowNumbers[2].value;
            isNegative = windowNumbers[0].isNegative || windowNumbers[1].isNegative;
          } else {
            const v1 = windowNumbers[0].value;
            const v2 = windowNumbers[1].value;
            if (v1 >= 100 && v2 > 0) {
              amount = v1;
              units = v2;
              nav = v1 / v2;
            }
          }

          if (amount >= 50 && amount <= 100000000 && units > 0) {
            let txType = classifyTransactionType(windowText);
            const upperWin = windowText.toUpperCase();
            const isExplicitRedemption = upperWin.includes('REDEMPTION') || upperWin.includes('REDEEM') || upperWin.includes('SELL') || upperWin.includes('SWP');
            if (isNegative && isExplicitRedemption) {
              txType = 'REDEMPTION';
            } else if (!isExplicitRedemption && txType === 'REDEMPTION') {
              txType = 'SIP';
            }

            transactions.push({
              id: `pdf-fallback-tx-${txIdCounter++}`,
              folioNumber: isValidFolioNumber(currentFolio) ? currentFolio : 'FOLIO-1',
              schemeCode: currentSchemeCode,
              schemeName: cleanFundDisplayName(currentSchemeName),
              type: txType,
              date: curr.parsedDate,
              units: Math.round(units * 1000) / 1000,
              nav: Math.round(nav * 100) / 100,
              amount: Math.round(amount * 100) / 100,
              status: 'COMPLETED',
              notes: windowText.replace(/\s+/g, ' ').substring(0, 45)
            });
          }
        }
      }
    }

    // Deduplicate any duplicate entries on the same date, amount, units and folio
    const uniqueMap = new Map<string, TransactionRecord>();
    transactions.forEach(tx => {
      const key = `${tx.date}_${tx.amount}_${tx.units}_${tx.folioNumber}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, tx);
      }
    });

    const finalTransactions = Array.from(uniqueMap.values());
    finalTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Update detected schemes with clean names and real last NAV
    const detectedSchemesList: Partial<MutualFundScheme>[] = Array.from(detectedSchemesMap.values()).map(scheme => {
      const cleanName = cleanFundDisplayName(scheme.schemeName || 'Indian Mutual Fund Scheme');
      if (scheme.schemeCode && schemeLastNavMap.has(scheme.schemeCode)) {
        const lastNavInfo = schemeLastNavMap.get(scheme.schemeCode)!;
        return {
          ...scheme,
          schemeName: cleanName,
          currentNav: lastNavInfo.nav,
          navDate: lastNavInfo.date
        };
      }
      return {
        ...scheme,
        schemeName: cleanName
      };
    });

    return {
      transactions: finalTransactions,
      detectedSchemes: detectedSchemesList,
      folioCount: foliosSet.size || (finalTransactions.length > 0 ? 1 : 0),
      investorName,
      pan,
      statementPeriod
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    const isPasswordError = error?.name === 'PasswordException' || 
                            errorMsg.toLowerCase().includes('password') || 
                            errorMsg.toLowerCase().includes('encrypted');

    return {
      transactions: [],
      detectedSchemes: [],
      folioCount: 0,
      requiresPassword: isPasswordError,
      error: isPasswordError 
        ? 'This PDF statement is password-protected. Please enter your PDF password to unlock and extract transactions.' 
        : `Could not parse PDF: ${errorMsg}`
    };
  }
}
