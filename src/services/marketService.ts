import { NiftyMarketData } from '../types';

const MARKET_CACHE_KEY = 'mftracker_nifty_market_data_v2';
const MARKET_SETTINGS_KEY = 'mftracker_market_alert_settings_v1';

export interface MarketAlertSettings {
  drawdownThreshold: number; // default 15
  peThreshold: number; // default 20.0
  browserNotifications: boolean;
  soundAlerts: boolean;
  emailAlertNotes?: string;
}

export const DEFAULT_ALERT_SETTINGS: MarketAlertSettings = {
  drawdownThreshold: 15,
  peThreshold: 20.0,
  browserNotifications: false,
  soundAlerts: true
};

export const FALLBACK_MARKET_DATA: NiftyMarketData = {
  symbol: '^NSEI',
  name: 'NIFTY 50 Index',
  currentClose: 23146.15,
  previousClose: 24072.75,
  change: -926.6,
  changePercent: -3.85,
  lastUpdated: new Date().toISOString(),
  allTimePeak: 26216.05,
  allTimePeakDate: '2024-09-27',
  pointDropFromPeak: 3069.9,
  percentDropFromPeak: -11.71,
  drawdownTriggerPercent: 15.0,
  isDrawdownAlertActive: false,
  triggerLevel15Percent: 22283.64,
  pointsTo15PercentTrigger: 862.51,
  currentPe: 19.77,
  currentPeTtm: 19.77,
  peTtm: 19.77,
  peThreshold: 20.0,
  isPeAlertActive: true,
  peZone: 'deep_value',
  pointsToPe20Threshold: -269.25,
  conciseSummary: 'Nifty 50 closed at 23,146.15, which is 3,069.90 points (11.71%) below its all-time peak of 26,216.05 (27 Sep 2024). Current Nifty P/E Ratio (TTM) is 19.77 (Sub-20.00 valuation buy trigger ACTIVE).',
  history: [
    { date: '2024-09-27', close: 26216.05, peak: 26216.05, drawdownPercent: 0, pe: 22.39, peTtm: 22.39, isDrawdownAlert: false, isPeAlert: false },
    { date: '2024-10-15', close: 25057.35, peak: 26216.05, drawdownPercent: -4.42, pe: 21.40, peTtm: 21.40, isDrawdownAlert: false, isPeAlert: false },
    { date: '2024-11-04', close: 23995.35, peak: 26216.05, drawdownPercent: -8.47, pe: 20.49, peTtm: 20.49, isDrawdownAlert: false, isPeAlert: false },
    { date: '2024-11-20', close: 23518.50, peak: 26216.05, drawdownPercent: -10.29, pe: 20.09, peTtm: 20.09, isDrawdownAlert: false, isPeAlert: false },
    { date: '2024-12-20', close: 23812.80, peak: 26216.05, drawdownPercent: -9.17, pe: 20.34, peTtm: 20.34, isDrawdownAlert: false, isPeAlert: false },
    { date: '2025-01-15', close: 23205.10, peak: 26216.05, drawdownPercent: -11.49, pe: 19.82, peTtm: 19.82, isDrawdownAlert: false, isPeAlert: true },
    { date: '2025-02-05', close: 22850.40, peak: 26216.05, drawdownPercent: -12.84, pe: 19.52, peTtm: 19.52, isDrawdownAlert: false, isPeAlert: true },
    { date: '2025-02-28', close: 22179.90, peak: 26216.05, drawdownPercent: -15.39, pe: 18.94, peTtm: 18.94, isDrawdownAlert: true, isPeAlert: true },
    { date: '2025-03-15', close: 22622.70, peak: 26216.05, drawdownPercent: -13.71, pe: 19.32, peTtm: 19.32, isDrawdownAlert: false, isPeAlert: true },
    { date: '2025-03-25', close: 22997.35, peak: 26216.05, drawdownPercent: -12.28, pe: 19.64, peTtm: 19.64, isDrawdownAlert: false, isPeAlert: true },
    { date: '2026-10-16', close: 23146.15, peak: 26216.05, drawdownPercent: -11.71, pe: 19.77, peTtm: 19.77, isDrawdownAlert: false, isPeAlert: true }
  ]
};

export async function fetchNiftyMarketData(): Promise<NiftyMarketData> {
  try {
    const res = await fetch('/api/market/nifty');
    if (!res.ok) {
      throw new Error(`Market API returned HTTP ${res.status}`);
    }
    const data: NiftyMarketData = await res.json();
    if (data && typeof data.currentClose === 'number') {
      try {
        localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(data));
      } catch (e) {}
      return data;
    }
    throw new Error('Invalid market data payload');
  } catch (err) {
    console.warn('Failed to fetch live market data from server, using local cache / fallback:', err);
    try {
      const cached = localStorage.getItem(MARKET_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    return FALLBACK_MARKET_DATA;
  }
}

export function loadAlertSettings(): MarketAlertSettings {
  try {
    const s = localStorage.getItem(MARKET_SETTINGS_KEY);
    if (s) {
      return { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(s) };
    }
  } catch (e) {}
  return DEFAULT_ALERT_SETTINGS;
}

export function saveAlertSettings(settings: MarketAlertSettings): void {
  try {
    localStorage.setItem(MARKET_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

/**
 * Calculates dynamic metrics when the user simulates or customizes a closing price or PE level
 */
export function calculateSimulatedNiftyMetrics(
  simulatedClose: number,
  peak: number = 26216.05,
  ttmEps: number = 1105,
  drawdownThreshold: number = 15.0,
  peThreshold: number = 20.0
) {
  const pointDrop = Number((peak - simulatedClose).toFixed(2));
  const percentDrop = Number((((simulatedClose - peak) / peak) * 100).toFixed(2));
  const isDrawdownAlert = percentDrop <= -Math.abs(drawdownThreshold);
  const triggerLevelDrawdown = Number((peak * (1 - Math.abs(drawdownThreshold) / 100)).toFixed(2));
  const pointsToDrawdownTrigger = Number((simulatedClose - triggerLevelDrawdown).toFixed(2));

  const pe = Number((simulatedClose / ttmEps).toFixed(2));
  const isPeAlert = pe < peThreshold;
  const priceAtPeThreshold = Number((peThreshold * ttmEps).toFixed(2));
  const pointsToPeThreshold = Number((simulatedClose - priceAtPeThreshold).toFixed(2));

  let peZone: 'deep_value' | 'accumulation' | 'fair' | 'expensive' = 'fair';
  if (pe < 20.0) peZone = 'deep_value';
  else if (pe <= 22.0) peZone = 'accumulation';
  else if (pe <= 24.5) peZone = 'fair';
  else peZone = 'expensive';

  const conciseSummary = `Nifty 50 at ${simulatedClose.toLocaleString('en-IN')}: ${Math.abs(pointDrop).toLocaleString('en-IN')} points (${Math.abs(percentDrop)}%) below peak of ${peak.toLocaleString('en-IN')}. PE: ${pe.toFixed(2)} (Value trigger: < ${peThreshold.toFixed(2)}).`;

  return {
    simulatedClose,
    pointDrop,
    percentDrop,
    isDrawdownAlert,
    triggerLevelDrawdown,
    pointsToDrawdownTrigger,
    pe,
    isPeAlert,
    peZone,
    priceAtPeThreshold,
    pointsToPeThreshold,
    conciseSummary
  };
}
