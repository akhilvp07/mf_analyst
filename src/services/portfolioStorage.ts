import { TransactionRecord, MutualFundScheme } from '../types';
import { cleanFundDisplayName, isValidFolioNumber, detectPlanType, detectOptionType } from '../utils/financialCalculations';

const STORAGE_KEYS = {
  TRANSACTIONS: 'mftracker_transactions_v2',
  CUSTOM_SCHEMES: 'mftracker_custom_schemes_v2',
  SETTINGS: 'mftracker_settings_v2'
};

export interface AppSettings {
  currency: string;
  theme: 'dark' | 'light' | 'system';
  enableLiveNavSync: boolean;
  benchmark: 'NIFTY50' | 'NIFTY500' | 'SENSEX';
  lastSyncedAt?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'INR',
  theme: 'dark',
  enableLiveNavSync: true,
  benchmark: 'NIFTY50'
};

/**
 * Load transactions from local storage (returns empty array if none)
 */
export function loadStoredTransactions(): TransactionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(tx => ({
          ...tx,
          schemeName: cleanFundDisplayName(tx.schemeName),
          folioNumber: isValidFolioNumber(tx.folioNumber) ? tx.folioNumber.trim() : (tx.folioNumber || 'FOLIO-1')
        }));
      }
    }
  } catch (err) {
    console.error('Failed to load stored transactions:', err);
  }

  return [];
}

/**
 * Save transactions to local storage
 */
export function saveStoredTransactions(transactions: TransactionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  } catch (err) {
    console.error('Failed to save transactions:', err);
  }
}

/**
 * Load custom scheme catalog overrides
 */
export function loadSchemeCatalog(): Record<string, MutualFundScheme> {
  const map: Record<string, MutualFundScheme> = {};

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_SCHEMES);
    if (raw) {
      const custom = JSON.parse(raw);
      Object.assign(map, custom);
    }
  } catch {
    // Ignore error
  }

  return map;
}

/**
 * Save scheme catalog additions
 */
export function saveCustomScheme(scheme: MutualFundScheme): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_SCHEMES);
    const existing = raw ? JSON.parse(raw) : {};
    existing[scheme.schemeCode] = scheme;
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SCHEMES, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to save custom scheme:', err);
  }
}

/**
 * Save all schemes to local storage
 */
export function saveAllSchemes(schemes: Record<string, MutualFundScheme>): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_SCHEMES, JSON.stringify(schemes));
  } catch (err) {
    console.error('Failed to save all schemes:', err);
  }
}

/**
 * Load user settings
 */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore error
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save user settings
 */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

/**
 * Export complete portfolio state to JSON file
 */
export function exportPortfolioToJson(transactions: TransactionRecord[], schemes: Record<string, MutualFundScheme>): string {
  const payload = {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    source: 'MFTracker - Mutual Fund Portfolio Analytics',
    transactionsCount: transactions.length,
    transactions,
    customSchemes: schemes
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Export transactions to CSV format
 */
export function exportTransactionsToCsv(transactions: TransactionRecord[]): string {
  const headers = ['Date', 'Folio Number', 'Scheme Code', 'Scheme Name', 'Type', 'Units', 'NAV (INR)', 'Amount (INR)', 'Status', 'Notes'];
  const rows = transactions.map(t => [
    t.date,
    `"${(t.folioNumber || '').replace(/"/g, '""')}"`,
    t.schemeCode,
    `"${(t.schemeName || '').replace(/"/g, '""')}"`,
    t.type,
    t.units.toFixed(4),
    t.nav.toFixed(2),
    t.amount.toFixed(2),
    t.status,
    `"${(t.notes || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Parse CAS statements (JSON or CSV format) with comprehensive format support
 */
export function parseCasStatement(fileContent: string): { 
  transactions: TransactionRecord[]; 
  detectedSchemes: MutualFundScheme[]; 
  summary: { imported: number; errors: number };
  statementMeta?: {
    investorName?: string;
    pan?: string;
    folioCount?: number;
    period?: string;
  };
} {
  const resultTxs: TransactionRecord[] = [];
  const detectedSchemes: MutualFundScheme[] = [];
  let idCounter = Date.now();
  let metaInvestorName: string | undefined;
  let metaPan: string | undefined;
  let metaPeriod: string | undefined;

  try {
    // Attempt 1: CAS JSON Format
    const json = JSON.parse(fileContent);

    if (json.investorName || json.investor_name || json.name || json.investor) {
      metaInvestorName = json.investorName || json.investor_name || json.name || json.investor;
    }
    if (json.pan || json.pan_number || json.panCard) {
      metaPan = json.pan || json.pan_number || json.panCard;
    }
    if (json.statementPeriod || json.period || json.statement_period) {
      metaPeriod = json.statementPeriod || json.period || json.statement_period;
    }
    
    // 1A. Custom schemes map if present
    if (json.customSchemes && typeof json.customSchemes === 'object') {
      Object.values(json.customSchemes).forEach((s: any) => {
        if (s && s.schemeCode) {
          detectedSchemes.push({
            ...s,
            schemeName: cleanFundDisplayName(s.schemeName),
            planType: s.planType || detectPlanType(s.schemeName, s.isin, undefined, 'Direct'),
            optionType: s.optionType || detectOptionType(s.schemeName, s.isin)
          });
        }
      });
    }

    // 1B. Standard flat transactions array
    const rawTxArray = Array.isArray(json) 
      ? json 
      : (Array.isArray(json.transactions) ? json.transactions : (Array.isArray(json.data) ? json.data : []));

    if (rawTxArray.length > 0) {
      rawTxArray.forEach((tx: any) => {
        if ((tx.schemeCode || tx.scheme || tx.schemeName) && (tx.amount !== undefined || tx.units !== undefined)) {
          const rawName = tx.schemeName || tx.scheme || 'Direct Mutual Fund';
          const plan = tx.planType || detectPlanType(rawName, tx.isin, undefined, 'Direct');
          const option = tx.optionType || detectOptionType(rawName, tx.isin);
          const u = Math.abs(parseFloat(tx.units) || 0);
          const n = parseFloat(tx.nav) || 100;
          const a = Math.abs(parseFloat(tx.amount) || (u * n));

          let tType: TransactionRecord['type'] = tx.type || 'SIP';
          const upper = String(tx.type || tx.description || '').toUpperCase();
          if (upper.includes('REDEMPTION') || upper.includes('SELL') || upper.includes('SWITCH OUT') || upper.includes('SWITCH_OUT')) {
            tType = 'REDEMPTION';
          } else if (upper.includes('LUMP') || upper.includes('PURCHASE')) {
            tType = 'LUMPSUM';
          } else if (upper.includes('SWITCH IN') || upper.includes('SWITCH_IN')) {
            tType = 'SWITCH_IN';
          }

          resultTxs.push({
            id: tx.id || `cas-${idCounter++}`,
            folioNumber: normalizeFolioNumber(tx.folioNumber || tx.folio || 'FOLIO-1'),
            schemeCode: String(tx.schemeCode || tx.amfi || tx.scheme_code || '122639'),
            schemeName: cleanFundDisplayName(rawName),
            planType: plan,
            optionType: option,
            type: tType,
            date: (tx.date || new Date().toISOString()).split('T')[0],
            units: u,
            nav: n,
            amount: a,
            status: 'COMPLETED',
            notes: tx.notes || tx.description || 'Imported via CAS JSON'
          });
        }
      });
      if (resultTxs.length > 0) {
        const uniqueFolios = new Set(resultTxs.map(t => normalizeFolioNumber(t.folioNumber)).filter(isValidFolioNumber));
        return { 
          transactions: resultTxs, 
          detectedSchemes, 
          summary: { imported: resultTxs.length, errors: 0 },
          statementMeta: {
            investorName: metaInvestorName,
            pan: metaPan,
            period: metaPeriod,
            folioCount: uniqueFolios.size || 1
          }
        };
      }
    }

    // 1C. Nested CAS JSON structure: folios[].schemes[].transactions[]
    if (json.folios && Array.isArray(json.folios)) {
      json.folios.forEach((folioItem: any) => {
        const folioNo = normalizeFolioNumber(folioItem.folio || folioItem.folio_number || folioItem.folioNumber || 'FOLIO-1');
        const schemesList = Array.isArray(folioItem.schemes) ? folioItem.schemes : [];

        schemesList.forEach((schemeItem: any) => {
          const rawSchemeName = schemeItem.scheme || schemeItem.scheme_name || schemeItem.name || 'Mutual Fund';
          const schemeCode = String(schemeItem.amfi || schemeItem.scheme_code || schemeItem.schemeCode || '122639');
          const isin = schemeItem.isin || '';
          const plan = schemeItem.planType || detectPlanType(rawSchemeName, isin, schemeCode, 'Direct');
          const option = schemeItem.optionType || detectOptionType(rawSchemeName, isin);

          const txsList = Array.isArray(schemeItem.transactions) ? schemeItem.transactions : [];
          txsList.forEach((tx: any) => {
            const u = Math.abs(parseFloat(tx.units) || 0);
            const n = parseFloat(tx.nav) || 100;
            const a = Math.abs(parseFloat(tx.amount) || (u * n));

            let tType: TransactionRecord['type'] = 'SIP';
            const desc = String(tx.description || tx.type || '').toUpperCase();
            if (desc.includes('REDEMPTION') || desc.includes('SELL') || desc.includes('SWITCH OUT') || desc.includes('SWITCH_OUT')) {
              tType = 'REDEMPTION';
            } else if (desc.includes('LUMP') || desc.includes('PURCHASE')) {
              tType = 'LUMPSUM';
            } else if (desc.includes('SWITCH IN') || desc.includes('SWITCH_IN')) {
              tType = 'SWITCH_IN';
            }

            resultTxs.push({
              id: tx.id || `cas-${idCounter++}`,
              folioNumber: folioNo,
              schemeCode,
              schemeName: cleanFundDisplayName(rawSchemeName),
              planType: plan,
              optionType: option,
              type: tType,
              date: (tx.date || new Date().toISOString()).split('T')[0],
              units: u,
              nav: n,
              amount: a,
              status: 'COMPLETED',
              notes: tx.description || tx.notes || 'Imported via CAS'
            });
          });
        });
      });

      if (resultTxs.length > 0) {
        const uniqueFolios = new Set(resultTxs.map(t => normalizeFolioNumber(t.folioNumber)).filter(isValidFolioNumber));
        return { 
          transactions: resultTxs, 
          detectedSchemes, 
          summary: { imported: resultTxs.length, errors: 0 },
          statementMeta: {
            investorName: metaInvestorName,
            pan: metaPan,
            period: metaPeriod,
            folioCount: uniqueFolios.size || json.folios.length
          }
        };
      }
    }
  } catch {
    // Not standard JSON, proceed to CSV / line-by-line parsing
  }

  // Attempt 2: CSV Parsing
  const lines = fileContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let errorCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = line.split(',').map(c => c.replace(/^["']|["']$/g, '').trim());

    if (cols.length >= 6) {
      try {
        const dateStr = cols[0];
        const folio = normalizeFolioNumber(cols[1] || 'FOLIO-1');
        const schemeCode = cols[2] || '122639';
        const rawSchemeName = cols[3] || 'Mutual Fund Scheme';
        const typeRaw = cols[4]?.toUpperCase() || 'SIP';
        const units = Math.abs(parseFloat(cols[5]) || 0);
        const nav = parseFloat(cols[6]) || 100;
        const amount = Math.abs(parseFloat(cols[7]) || (units * nav));

        let txType: TransactionRecord['type'] = 'SIP';
        if (typeRaw.includes('REDEMPTION') || typeRaw.includes('SELL')) txType = 'REDEMPTION';
        else if (typeRaw.includes('LUMP') || typeRaw.includes('PURCHASE')) txType = 'LUMPSUM';
        else if (typeRaw.includes('SWITCH_IN')) txType = 'SWITCH_IN';
        else if (typeRaw.includes('SWITCH_OUT')) txType = 'SWITCH_OUT';

        const plan = detectPlanType(rawSchemeName, undefined, undefined, 'Direct');
        const option = detectOptionType(rawSchemeName);

        resultTxs.push({
          id: `csv-${idCounter++}`,
          folioNumber: folio,
          schemeCode,
          schemeName: cleanFundDisplayName(rawSchemeName),
          planType: plan,
          optionType: option,
          type: txType,
          date: dateStr,
          units,
          nav,
          amount,
          status: 'COMPLETED',
          notes: 'Imported from CSV statement'
        });
      } catch {
        errorCount++;
      }
    }
  }

  const uniqueFolios = new Set(resultTxs.map(t => normalizeFolioNumber(t.folioNumber)).filter(isValidFolioNumber));
  return { 
    transactions: resultTxs, 
    detectedSchemes, 
    summary: { imported: resultTxs.length, errors: errorCount },
    statementMeta: {
      investorName: metaInvestorName,
      pan: metaPan,
      period: metaPeriod,
      folioCount: uniqueFolios.size || (resultTxs.length > 0 ? 1 : 0)
    }
  };
}
