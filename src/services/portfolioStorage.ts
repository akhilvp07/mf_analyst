import { TransactionRecord, MutualFundScheme } from '../types';
import { SCHEMES } from '../data/mockData';

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
 * Generate a realistic demo portfolio spanning ~3 years of regular monthly SIPs across 5 direct mutual funds
 */
export function generateDemoTransactions(): TransactionRecord[] {
  const txs: TransactionRecord[] = [];
  let idCounter = 1;

  const demoHoldings = [
    {
      schemeCode: '122639',
      schemeName: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
      folioNumber: 'PPF-902184-B',
      sipAmount: 15000,
      startNav: 48.2,
      growthRatePerMonth: 0.013,
      months: 36
    },
    {
      schemeCode: '119063',
      schemeName: 'HDFC Top 100 Fund - Direct Plan - Growth',
      folioNumber: 'HDF-109283-A',
      sipAmount: 10000,
      startNav: 720.5,
      growthRatePerMonth: 0.011,
      months: 36
    },
    {
      schemeCode: '120503',
      schemeName: 'Quant Small Cap Fund - Direct Plan - Growth',
      folioNumber: 'QNT-443210-C',
      sipAmount: 12000,
      startNav: 110.0,
      growthRatePerMonth: 0.019,
      months: 30
    },
    {
      schemeCode: '118834',
      schemeName: 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
      folioNumber: 'MIR-776512-K',
      sipAmount: 8000,
      startNav: 78.4,
      growthRatePerMonth: 0.010,
      months: 36
    },
    {
      schemeCode: '120152',
      schemeName: 'Kotak Emerging Equity Fund - Direct Plan - Growth',
      folioNumber: 'KTK-319804-M',
      sipAmount: 10000,
      startNav: 68.9,
      growthRatePerMonth: 0.015,
      months: 24
    }
  ];

  const today = new Date();

  demoHoldings.forEach(holding => {
    let currentSimNav = holding.startNav;
    for (let m = holding.months; m >= 1; m--) {
      const txDate = new Date(today);
      txDate.setMonth(today.getMonth() - m);
      txDate.setDate(10); // 10th of every month SIP

      // Add a little realistic market volatility
      const volatility = 1 + (Math.sin(m * 0.7) * 0.02) + (Math.random() * 0.01 - 0.005);
      currentSimNav = currentSimNav * (1 + holding.growthRatePerMonth) * volatility;
      const units = holding.sipAmount / currentSimNav;

      txs.push({
        id: `tx-${idCounter++}`,
        folioNumber: holding.folioNumber,
        schemeCode: holding.schemeCode,
        schemeName: holding.schemeName,
        type: 'SIP',
        date: txDate.toISOString().split('T')[0],
        units: Math.round(units * 1000) / 1000,
        nav: Math.round(currentSimNav * 100) / 100,
        amount: holding.sipAmount,
        status: 'COMPLETED'
      });
    }

    // Add 1 lumpsum investment 18 months ago
    const lumpsumDate = new Date(today);
    lumpsumDate.setMonth(today.getMonth() - 18);
    lumpsumDate.setDate(15);
    const lumpsumNav = holding.startNav * 1.25;
    const lumpsumAmount = 50000;

    txs.push({
      id: `tx-${idCounter++}`,
      folioNumber: holding.folioNumber,
      schemeCode: holding.schemeCode,
      schemeName: holding.schemeName,
      type: 'LUMPSUM',
      date: lumpsumDate.toISOString().split('T')[0],
      units: Math.round((lumpsumAmount / lumpsumNav) * 1000) / 1000,
      nav: Math.round(lumpsumNav * 100) / 100,
      amount: lumpsumAmount,
      status: 'COMPLETED',
      notes: 'Bonus allocation'
    });
  });

  return txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Load transactions from local storage, or default to demo data on first visit
 */
export function loadStoredTransactions(): TransactionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load stored transactions:', err);
  }

  // First time initialization with demo portfolio
  const initial = generateDemoTransactions();
  saveStoredTransactions(initial);
  return initial;
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
  SCHEMES.forEach(s => {
    map[s.schemeCode] = s;
  });

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
    source: 'MFTracker - Google Cloud Run Optimized Edition',
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
 * Parse CAS statements (JSON or CSV format)
 */
export function parseCasStatement(fileContent: string): { transactions: TransactionRecord[]; detectedSchemes: MutualFundScheme[]; summary: { imported: number; errors: number } } {
  const resultTxs: TransactionRecord[] = [];
  const detectedSchemes: MutualFundScheme[] = [];
  let idCounter = Date.now();

  try {
    // Attempt 1: CAS JSON Format (CAMS / KFintech / MFTracker export)
    const json = JSON.parse(fileContent);
    if (json.transactions && Array.isArray(json.transactions)) {
      json.transactions.forEach((tx: any) => {
        if (tx.schemeCode && tx.amount) {
          resultTxs.push({
            id: tx.id || `cas-${idCounter++}`,
            folioNumber: tx.folioNumber || 'FOLIO-1',
            schemeCode: String(tx.schemeCode),
            schemeName: tx.schemeName || 'Direct Mutual Fund',
            type: tx.type || 'SIP',
            date: tx.date || new Date().toISOString().split('T')[0],
            units: Math.abs(parseFloat(tx.units) || 0),
            nav: parseFloat(tx.nav) || 100,
            amount: Math.abs(parseFloat(tx.amount) || 0),
            status: 'COMPLETED',
            notes: tx.notes || 'Imported via CAS'
          });
        }
      });
      return { transactions: resultTxs, detectedSchemes, summary: { imported: resultTxs.length, errors: 0 } };
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
        const folio = cols[1] || 'FOLIO-1';
        const schemeCode = cols[2] || '122639';
        const schemeName = cols[3] || 'Mutual Fund Scheme';
        const typeRaw = cols[4]?.toUpperCase() || 'SIP';
        const units = Math.abs(parseFloat(cols[5]) || 0);
        const nav = parseFloat(cols[6]) || 100;
        const amount = Math.abs(parseFloat(cols[7]) || (units * nav));

        let txType: TransactionRecord['type'] = 'SIP';
        if (typeRaw.includes('REDEMPTION') || typeRaw.includes('SELL')) txType = 'REDEMPTION';
        else if (typeRaw.includes('LUMP') || typeRaw.includes('PURCHASE')) txType = 'LUMPSUM';
        else if (typeRaw.includes('SWITCH_IN')) txType = 'SWITCH_IN';
        else if (typeRaw.includes('SWITCH_OUT')) txType = 'SWITCH_OUT';

        resultTxs.push({
          id: `csv-${idCounter++}`,
          folioNumber: folio,
          schemeCode,
          schemeName,
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

  return { transactions: resultTxs, detectedSchemes, summary: { imported: resultTxs.length, errors: errorCount } };
}
