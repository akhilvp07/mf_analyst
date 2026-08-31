import * as pdfjsLib from 'pdfjs-dist';
import { TransactionRecord, MutualFundScheme } from '../types';
import { SCHEMES } from '../data/mockData';

// Set worker source for pdfjs-dist
// Using unpkg / cdnjs fallback or bundled worker URL for browser compatibility
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
 * Match a raw scheme string to an AMFI Scheme or create fallback scheme metadata
 */
function findOrGenerateSchemeInfo(rawName: string, isin?: string): { code: string; name: string; category: MutualFundScheme['category']; fundHouse: string } {
  const cleanRaw = rawName.replace(/[\r\n\t]+/g, ' ').trim();
  
  // Try matching ISIN if present
  if (isin) {
    const matchedByIsin = SCHEMES.find(s => s.isin && s.isin.toUpperCase() === isin.toUpperCase());
    if (matchedByIsin) {
      return {
        code: matchedByIsin.schemeCode,
        name: matchedByIsin.schemeName,
        category: matchedByIsin.category,
        fundHouse: matchedByIsin.fundHouse
      };
    }
  }

  // Try matching scheme name in catalog
  const lowerRaw = cleanRaw.toLowerCase();
  for (const scheme of SCHEMES) {
    const sLower = scheme.schemeName.toLowerCase();
    // Match significant tokens
    if (sLower.includes('parag parikh') && lowerRaw.includes('parag parikh')) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
    if (sLower.includes('quant small cap') && lowerRaw.includes('quant') && lowerRaw.includes('small')) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
    if (sLower.includes('hdfc top 100') && lowerRaw.includes('hdfc') && (lowerRaw.includes('top 100') || lowerRaw.includes('top100'))) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
    if (sLower.includes('mirae asset large cap') && lowerRaw.includes('mirae') && lowerRaw.includes('large')) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
    if (sLower.includes('kotak emerging equity') && lowerRaw.includes('kotak') && (lowerRaw.includes('emerging') || lowerRaw.includes('mid'))) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
    if (sLower.includes('sbi small cap') && lowerRaw.includes('sbi') && lowerRaw.includes('small')) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
    if (sLower.includes('icici prudential') && lowerRaw.includes('icici') && lowerRaw.includes('bluechip')) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
    if (sLower.includes('uti nifty 50') && lowerRaw.includes('uti') && lowerRaw.includes('nifty')) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
    if (sLower.includes('nippon india small cap') && lowerRaw.includes('nippon') && lowerRaw.includes('small')) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
    if (sLower.includes('axis small cap') && lowerRaw.includes('axis') && lowerRaw.includes('small')) return { code: scheme.schemeCode, name: scheme.schemeName, category: scheme.category, fundHouse: scheme.fundHouse };
  }

  // Derive fund house and category from text
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

  let category: MutualFundScheme['category'] = 'Equity - Flexi Cap';
  if (lowerRaw.includes('small cap') || lowerRaw.includes('smallcap')) category = 'Equity - Small Cap';
  else if (lowerRaw.includes('mid cap') || lowerRaw.includes('midcap')) category = 'Equity - Mid Cap';
  else if (lowerRaw.includes('large cap') || lowerRaw.includes('largecap') || lowerRaw.includes('top 100') || lowerRaw.includes('bluechip')) category = 'Equity - Large Cap';
  else if (lowerRaw.includes('flexi cap') || lowerRaw.includes('flexicap')) category = 'Equity - Flexi Cap';
  else if (lowerRaw.includes('elss') || lowerRaw.includes('tax saver')) category = 'Equity - ELSS';
  else if (lowerRaw.includes('nifty') || lowerRaw.includes('sensex') || lowerRaw.includes('index')) category = 'Index Fund';
  else if (lowerRaw.includes('liquid') || lowerRaw.includes('overnight') || lowerRaw.includes('money market')) category = 'Debt - Liquid';
  else if (lowerRaw.includes('debt') || lowerRaw.includes('gilt') || lowerRaw.includes('short duration') || lowerRaw.includes('bond')) category = 'Debt - Short Duration';
  else if (lowerRaw.includes('hybrid') || lowerRaw.includes('balanced') || lowerRaw.includes('multi asset')) category = 'Hybrid - Aggressive';

  // Generate deterministic synthetic scheme code if unknown
  let hash = 0;
  for (let i = 0; i < cleanRaw.length; i++) {
    hash = (hash << 5) - hash + cleanRaw.charCodeAt(i);
    hash |= 0;
  }
  const syntheticCode = `CAS-${Math.abs(hash % 900000) + 100000}`;

  return {
    code: syntheticCode,
    name: cleanRaw,
    category,
    fundHouse
  };
}

/**
 * Normalizes dates like "10-Jan-2023", "10/01/2023", "2023-01-10", "10-01-2023" to YYYY-MM-DD
 */
function normalizeDate(raw: string): string | null {
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const text = raw.trim();

  // Match DD-Mon-YYYY (e.g., 15-Mar-2024 or 15/Mar/2024 or 15-MAR-2024)
  const dMonY = text.match(/^(\d{1,2})[-/ ]([a-zA-Z]{3,9})[-/ ](\d{4})/);
  if (dMonY) {
    const day = dMonY[1].padStart(2, '0');
    const monKey = dMonY[2].toLowerCase().substring(0, 3);
    const month = monthMap[monKey] || '01';
    const year = dMonY[3];
    return `${year}-${month}-${day}`;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // Match YYYY-MM-DD
  const ymd = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * Determine Transaction type from line text or description
 */
function classifyTransactionType(desc: string, amount: number, units: number): TransactionRecord['type'] {
  const d = desc.toUpperCase();
  if (d.includes('SWITCH IN') || d.includes('SWITCH-IN') || d.includes('STP IN') || d.includes('STP-IN')) return 'SWITCH_IN';
  if (d.includes('SWITCH OUT') || d.includes('SWITCH-OUT') || d.includes('STP OUT') || d.includes('STP-OUT')) return 'SWITCH_OUT';
  if (d.includes('REDEMPTION') || d.includes('REDEEM') || d.includes('SELL') || d.includes('SWP')) return 'REDEMPTION';
  if (d.includes('SIP') || d.includes('SYSTEMATIC') || d.includes('AUTO DEBIT') || d.includes('MANDATE')) return 'SIP';
  if (d.includes('PURCHASE') || d.includes('LUMPSUM') || d.includes('ADDITIONAL') || d.includes('NFO') || d.includes('INITIAL')) return 'LUMPSUM';
  if (d.includes('DIVIDEND REINVEST') || d.includes('REINVESTMENT') || d.includes('DIVIDEND')) return 'DIVIDEND_REINVEST';

  // Fallback based on signs
  if (units < 0 || amount < 0) return 'REDEMPTION';
  return 'SIP';
}

/**
 * Parse CAMS or KFintech PDF CAS statements with password decryption
 */
export async function parsePdfCasStatement(
  pdfBuffer: ArrayBuffer,
  password?: string
): Promise<PdfParseResult> {
  const transactions: TransactionRecord[] = [];
  const detectedSchemesMap = new Map<string, Partial<MutualFundScheme>>();
  const foliosSet = new Set<string>();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      password: password || '',
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/'
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    let fullText = '';
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Sort items by vertical position (Y) then horizontal (X) to reconstruct lines accurately
      const items = textContent.items.map((item: any) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        height: item.height || 10
      }));

      // Group items on roughly the same line (within 3 points Y tolerance)
      items.sort((a, b) => b.y - a.y || a.x - b.x);

      const lines: string[] = [];
      let currentY: number | null = null;
      let currentLineWords: string[] = [];

      items.forEach(item => {
        if (!item.str.trim()) return;
        if (currentY === null || Math.abs(item.y - currentY) > 3.5) {
          if (currentLineWords.length > 0) {
            lines.push(currentLineWords.join(' '));
          }
          currentY = item.y;
          currentLineWords = [item.str.trim()];
        } else {
          currentLineWords.push(item.str.trim());
        }
      });

      if (currentLineWords.length > 0) {
        lines.push(currentLineWords.join(' '));
      }

      const pageJoined = lines.join('\n');
      pageTexts.push(pageJoined);
      fullText += `\n--- PAGE ${pageNum} ---\n` + pageJoined;
    }

    // Extract Metadata (Investor Name, PAN, Statement Period)
    let investorName: string | undefined;
    let pan: string | undefined;
    let statementPeriod: string | undefined;

    const panMatch = fullText.match(/PAN\s*[:\-\s]\s*([A-Z]{5}[0-9]{4}[A-Z])/i) || fullText.match(/([A-Z]{5}[0-9]{4}[A-Z])/);
    if (panMatch) pan = panMatch[1].toUpperCase();

    const periodMatch = fullText.match(/(?:Statement Period|Period)\s*[:\-\s]\s*([^\n\r]+)/i);
    if (periodMatch) statementPeriod = periodMatch[1].trim();

    const nameMatch = fullText.match(/(?:Investor Name|Name|Dear Mr\.|Dear Ms\.|Dear Dr\.)\s*[:\-\s]*([A-Z\s]{3,40})/i);
    if (nameMatch) investorName = nameMatch[1].trim();

    // Parse Sections: Iterate through lines to track current Folio, Scheme, ISIN, and Transactions
    let currentFolio = 'FOLIO-1';
    let currentSchemeName = '';
    let currentIsin = '';
    let currentSchemeCode = '122639';
    let currentCategory = 'Equity - Flexi Cap';
    let currentFundHouse = 'Mutual Fund';
    let txIdCounter = 1;

    const allLines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i];

      // 1. Detect Folio Number
      // Matches "Folio No: 123456/78" or "Folio Number: 902184" or "Folio : 10293848"
      const folioMatch = line.match(/Folio\s*(?:No|Number|\#)?\s*[:\-\s]\s*([A-Z0-9\/\-_]+)/i);
      if (folioMatch && folioMatch[1] && folioMatch[1].length >= 3) {
        currentFolio = folioMatch[1].trim();
        foliosSet.add(currentFolio);
      }

      // 2. Detect Scheme Name / ISIN Header
      // Patterns in CAMS/KFintech:
      // "Parag Parikh Flexi Cap Fund - Direct Plan - Growth (ISIN: INF879O01027)"
      // "122639 - Parag Parikh Flexi Cap Fund - Direct"
      // "Scheme: HDFC Top 100 Fund - Direct Plan - Growth"
      const isinMatch = line.match(/ISIN\s*[:\-\s]\s*(INF[A-Z0-9]{9})/i) || line.match(/(INF[A-Z0-9]{9})/i);
      if (isinMatch) {
        currentIsin = isinMatch[1].toUpperCase();
      }

      const schemeHeaderMatch = line.match(/(?:Scheme\s*[:\-\s])\s*([A-Za-z0-9\s\-()&.]+)/i) ||
                                (line.includes('Fund') && (line.includes('Direct') || line.includes('Regular') || line.includes('Growth') || line.includes('Plan')) && !line.includes('Total') && !line.includes('Closing'));
      
      if (schemeHeaderMatch) {
        const potentialScheme = typeof schemeHeaderMatch === 'string' ? line : (schemeHeaderMatch[1] || line);
        // Exclude generic header lines
        if (!potentialScheme.toLowerCase().includes('consolidated') && 
            !potentialScheme.toLowerCase().includes('summary') && 
            !potentialScheme.toLowerCase().includes('statement')) {
          currentSchemeName = potentialScheme.replace(/\(ISIN:[^\)]+\)/i, '').trim();
          const info = findOrGenerateSchemeInfo(currentSchemeName, currentIsin);
          currentSchemeCode = info.code;
          currentCategory = info.category;
          currentFundHouse = info.fundHouse;

          if (!detectedSchemesMap.has(currentSchemeCode)) {
            detectedSchemesMap.set(currentSchemeCode, {
              schemeCode: currentSchemeCode,
              schemeName: info.name,
              category: info.category,
              fundHouse: info.fundHouse,
              isin: currentIsin || undefined
            });
          }
        }
      }

      // 3. Detect Transaction Row
      // Common CAMS line pattern:
      // "10-Jan-2023  SIP Purchase - Auto Debit  15,000.00  311.203  48.20  1,245.890"
      // "15/03/2023  Systematic Investment  10,000.00  138.792  72.05  450.120"
      // "22-Aug-2023  Purchase  50,000.00  540.540  92.50  1,500.000"
      // "05-Nov-2023  Redemption  -20,000.00  -180.180  111.00  1,319.820"
      const dateFirstWord = line.split(/\s+/)[0];
      const parsedDate = normalizeDate(dateFirstWord);

      if (parsedDate) {
        // Extract numbers from the line
        // We look for amounts, units, NAV
        const remainingText = line.substring(dateFirstWord.length).trim();
        
        // Find all numeric values with decimals or commas (e.g. 15,000.00 or 311.203 or -50,000.00)
        const numberMatches = remainingText.match(/[-+]?[\d,]+\.\d{2,4}|[-+]?[\d,]{3,}/g);
        
        if (numberMatches && numberMatches.length >= 2) {
          const numbers = numberMatches.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => !isNaN(n));
          
          let amount = 0;
          let units = 0;
          let nav = 0;

          // CAMS standard columns: Amount, Units, Price/NAV, Unit Balance
          if (numbers.length >= 3) {
            // Usually [Amount, Units, Price, Balance] or [Units, Price, Amount]
            const sortedByMagnitude = [...numbers].sort((a, b) => Math.abs(b) - Math.abs(a));
            const largest = Math.abs(sortedByMagnitude[0]); // Usually total amount or balance
            
            // In CAMS: Col 1 = Amount (₹), Col 2 = Units, Col 3 = Price (NAV)
            if (numbers[0] > 100 && numbers[1] > 0 && numbers[2] > 0) {
              amount = Math.abs(numbers[0]);
              units = Math.abs(numbers[1]);
              nav = numbers[2];
            } else if (numbers.length >= 3) {
              // Try computing product match: amount ≈ units * nav
              for (let a = 0; a < numbers.length; a++) {
                for (let u = 0; u < numbers.length; u++) {
                  for (let n = 0; n < numbers.length; n++) {
                    if (a !== u && u !== n && a !== n) {
                      const prod = Math.abs(numbers[u] * numbers[n]);
                      if (Math.abs(prod - Math.abs(numbers[a])) < 2.0 && numbers[a] > 0) {
                        amount = Math.abs(numbers[a]);
                        units = Math.abs(numbers[u]);
                        nav = Math.abs(numbers[n]);
                        break;
                      }
                    }
                  }
                }
              }
            }
          }

          if (amount === 0 && numbers.length >= 2) {
            // Fallback pair: [Units, NAV] or [Amount, Units]
            if (numbers[0] > 500 && numbers[1] > 0 && numbers[1] < numbers[0]) {
              amount = Math.abs(numbers[0]);
              units = Math.abs(numbers[1]);
              nav = units > 0 ? amount / units : 100;
            }
          }

          if (amount > 0 && units > 0) {
            if (nav === 0) nav = amount / units;
            const txType = classifyTransactionType(remainingText, amount, units);

            transactions.push({
              id: `pdf-tx-${txIdCounter++}`,
              folioNumber: currentFolio,
              schemeCode: currentSchemeCode,
              schemeName: currentSchemeName || 'Mutual Fund Scheme',
              type: txType,
              date: parsedDate,
              units: Math.round(units * 1000) / 1000,
              nav: Math.round(nav * 100) / 100,
              amount: Math.round(amount * 100) / 100,
              status: 'COMPLETED',
              notes: remainingText.substring(0, 40)
            });
          }
        }
      }
    }

    // Sort chronologically
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      transactions,
      detectedSchemes: Array.from(detectedSchemesMap.values()),
      folioCount: foliosSet.size || 1,
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
        ? 'This PDF statement is password-protected. Please enter the password to unlock and parse.' 
        : `Could not parse PDF: ${errorMsg}`
    };
  }
}
