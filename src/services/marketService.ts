import { NiftyMarketData, NiftyHistoryPoint } from '../types';
import { getIndexedDbItem, setIndexedDbItem } from './indexedDbCache';

const MARKET_CACHE_KEY = 'mftracker_nifty_market_data_v3';
const MARKET_SETTINGS_KEY = 'mftracker_market_alert_settings_v1';
const INDEX_FUND_BENCHMARK_SCHEME = '120716'; // UTI Nifty 50 Index Fund - Direct Plan - Growth

export interface MarketAlertSettings {
  drawdownThreshold: number; // default 15%
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

/**
 * Checks if market data is missing or older than 5 calendar days
 */
export function isMarketDataStale(data: NiftyMarketData | null | undefined): boolean {
  if (!data || !data.lastUpdated) return true;
  const updateTime = new Date(data.lastUpdated).getTime();
  if (isNaN(updateTime)) return true;
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  return Date.now() - updateTime > fiveDaysMs;
}

/**
 * Browser-side fallback: Fetches real daily Total Return history of a prominent Nifty 50 Direct Index Fund
 * directly via public CORS-enabled AMFI/mfapi endpoint when the local Node server proxy is unavailable.
 */
export async function fetchBrowserNiftyIndexFundFallback(): Promise<NiftyMarketData | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${INDEX_FUND_BENCHMARK_SCHEME}`, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`mfapi index fund fetch failed: HTTP ${res.status}`);
    }
    const json = await res.json();
    if (!json?.data || !Array.isArray(json.data) || json.data.length === 0) {
      throw new Error('Invalid index fund NAV series');
    }

    // Sort ascending by calendar date (DD-MM-YYYY)
    const parseNavDate = (dStr: string): Date => {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
      return new Date(dStr);
    };

    const sortedRows = [...json.data]
      .filter(r => r.date && r.nav && !isNaN(parseFloat(r.nav)))
      .map(r => ({
        date: parseNavDate(r.date),
        dateStr: r.date,
        nav: parseFloat(r.nav)
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (sortedRows.length === 0) return null;

    // Find all-time peak and current drawdown
    let runningPeak = 0;
    let peakDateStr = '';
    const history: NiftyHistoryPoint[] = [];

    // Subsample last 90 trading sessions for responsive rendering
    const recentRows = sortedRows.slice(-180);

    for (const r of recentRows) {
      if (r.nav > runningPeak) {
        runningPeak = r.nav;
        peakDateStr = r.dateStr;
      }
      const ddPct = runningPeak > 0 ? ((r.nav - runningPeak) / runningPeak) * 100 : 0;
      history.push({
        date: r.date.toISOString().split('T')[0],
        close: r.nav,
        peak: runningPeak,
        drawdownPercent: Number(ddPct.toFixed(2)),
        pe: 0,
        peTtm: 0,
        isDrawdownAlert: ddPct <= -15.0,
        isPeAlert: false
      });
    }

    const latest = sortedRows[sortedRows.length - 1];
    const prev = sortedRows.length >= 2 ? sortedRows[sortedRows.length - 2] : latest;
    const currentNav = latest.nav;
    const prevNav = prev.nav;
    const change = currentNav - prevNav;
    const changePercent = prevNav > 0 ? (change / prevNav) * 100 : 0;
    const currentDrawdownPct = runningPeak > 0 ? ((currentNav - runningPeak) / runningPeak) * 100 : 0;
    const pointDrop = Number((runningPeak - currentNav).toFixed(2));
    const triggerLevel15 = Number((runningPeak * 0.85).toFixed(2));
    const isDrawdownAlert = currentDrawdownPct <= -15.0;

    const data: NiftyMarketData = {
      symbol: 'NIFTY50_TRI',
      name: `Nifty 50 Total Return (via ${json.meta?.scheme_name || 'UTI Nifty 50 Index Fund'})`,
      currentClose: currentNav,
      previousClose: prevNav,
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      lastUpdated: latest.date.toISOString(),
      allTimePeak: runningPeak,
      allTimePeakDate: peakDateStr,
      pointDropFromPeak: pointDrop,
      percentDropFromPeak: Number(currentDrawdownPct.toFixed(2)),
      drawdownTriggerPercent: 15.0,
      isDrawdownAlertActive: isDrawdownAlert,
      triggerLevel15Percent: triggerLevel15,
      pointsTo15PercentTrigger: Number((currentNav - triggerLevel15).toFixed(2)),
      currentPe: 0, // P/E is not fabricated from index fund NAV; must come from live server or user input
      currentPeTtm: 0,
      peTtm: 0,
      peThreshold: 20.0,
      isPeAlertActive: false, // Suppress false P/E alert
      peZone: 'fair',
      pointsToPe20Threshold: 0,
      conciseSummary: `Nifty 50 TRI benchmark tracked at NAV ₹${currentNav.toFixed(2)} (${Math.abs(currentDrawdownPct).toFixed(2)}% below peak). P/E unavailable offline.`,
      history
    };

    return data;
  } catch (err) {
    console.warn('Browser index fund fallback failed:', err);
    return null;
  }
}

/**
 * Primary Market Data Fetcher:
 * 1. Tries local server proxy (/api/market/nifty)
 * 2. If unavailable, falls back to direct browser index fund fetch
 * 3. If both fail, checks cached data (flagging stale if > 5 days)
 * 4. Returns null if no authentic market data exists (NEVER returns invented figures)
 */
export async function fetchNiftyMarketData(): Promise<NiftyMarketData | null> {
  // 1. Try server proxy
  try {
    const res = await fetch('/api/market/nifty');
    if (res.ok) {
      const data: NiftyMarketData = await res.json();
      if (data && typeof data.currentClose === 'number' && data.currentClose > 0) {
        data.lastUpdated = data.lastUpdated || new Date().toISOString();
        // Check if data is stale
        if (isMarketDataStale(data)) {
          data.isDrawdownAlertActive = false;
          data.isPeAlertActive = false;
        }
        await setIndexedDbItem(MARKET_CACHE_KEY, data);
        try {
          localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(data));
        } catch {}
        return data;
      }
    }
  } catch (err) {
    console.warn('Server market proxy unavailable, trying browser index fund fallback:', err);
  }

  // 2. Try browser-side index fund benchmark fallback
  const browserFallback = await fetchBrowserNiftyIndexFundFallback();
  if (browserFallback) {
    await setIndexedDbItem(MARKET_CACHE_KEY, browserFallback);
    try {
      localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(browserFallback));
    } catch {}
    return browserFallback;
  }

  // 3. Try cached data from IndexedDB or localStorage
  try {
    const idbCached = await getIndexedDbItem<NiftyMarketData>(MARKET_CACHE_KEY);
    if (idbCached?.data && idbCached.data.currentClose > 0) {
      const cached = idbCached.data;
      if (isMarketDataStale(cached)) {
        cached.isDrawdownAlertActive = false;
        cached.isPeAlertActive = false;
      }
      return cached;
    }

    const lsCached = localStorage.getItem(MARKET_CACHE_KEY);
    if (lsCached) {
      const parsed = JSON.parse(lsCached);
      if (parsed && parsed.currentClose > 0) {
        if (isMarketDataStale(parsed)) {
          parsed.isDrawdownAlertActive = false;
          parsed.isPeAlertActive = false;
        }
        return parsed;
      }
    }
  } catch {}

  // 4. No authentic data available -> Return null (Never return fabricated data!)
  return null;
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
