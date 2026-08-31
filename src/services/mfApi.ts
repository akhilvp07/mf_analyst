import { MutualFundScheme, NavRecord } from '../types';

export interface MfApiSchemeDetail {
  meta: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
    isin_growth?: string;
    isin_div_reinvestment?: string;
  };
  data: {
    date: string; // "DD-MM-YYYY"
    nav: string;
  }[];
  status: string;
}

export interface MfSearchResult {
  schemeCode: number;
  schemeName: string;
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const CACHE_PREFIX = 'mftracker_nav_cache_';
const memCache = new Map<string, { data: MfApiSchemeDetail; timestamp: number }>();

/**
 * Fetch details and historical NAVs for a mutual fund scheme from MF API
 */
export async function fetchSchemeNavDetails(schemeCode: string | number): Promise<MfApiSchemeDetail | null> {
  const key = `${schemeCode}`;

  // 1. Memory cache
  const cachedMem = memCache.get(key);
  if (cachedMem && Date.now() - cachedMem.timestamp < CACHE_TTL_MS) {
    return cachedMem.data;
  }

  // 2. LocalStorage cache
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memCache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch {
    // Ignore storage parse error
  }

  // 3. Network fetch
  try {
    const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`MF API returned HTTP ${response.status}`);
    }

    const json: MfApiSchemeDetail = await response.json();
    if (json && json.status === 'SUCCESS' && json.data && json.data.length > 0) {
      const cachePayload = { data: json, timestamp: Date.now() };
      memCache.set(key, cachePayload);
      try {
        localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cachePayload));
      } catch {
        // Storage quota might be exceeded
      }
      return json;
    }
    return null;
  } catch (err) {
    console.warn(`[MF API] Error fetching scheme ${schemeCode}:`, err);
    return null;
  }
}

/**
 * Search mutual fund schemes by name or code
 */
export async function searchMutualFunds(query: string): Promise<MfSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query.trim())}`);
    if (!res.ok) return [];
    const data: MfSearchResult[] = await res.json();
    return data.slice(0, 25);
  } catch (err) {
    console.warn('[MF API] Search error:', err);
    return [];
  }
}

/**
 * Batch update current NAVs for a list of scheme codes
 */
export async function batchFetchLatestNavs(
  schemeCodes: string[]
): Promise<Record<string, { currentNav: number; navDate: string; navChange1D: number }>> {
  const result: Record<string, { currentNav: number; navDate: string; navChange1D: number }> = {};
  const uniqueCodes: string[] = Array.from(new Set(schemeCodes.filter(Boolean)));

  const promises = uniqueCodes.map(async (code) => {
    try {
      const detail = await fetchSchemeNavDetails(code);
      if (detail && detail.data && detail.data.length > 0) {
        const latest = detail.data[0];
        const previous = detail.data.length > 1 ? detail.data[1] : latest;

        const currentNav = parseFloat(latest.nav);
        const prevNav = parseFloat(previous.nav);
        const navChange1D = prevNav > 0 ? ((currentNav - prevNav) / prevNav) * 100 : 0;

        // Convert DD-MM-YYYY to YYYY-MM-DD
        const parts = latest.date.split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : latest.date;

        result[code] = {
          currentNav: isNaN(currentNav) ? 100 : currentNav,
          navDate: formattedDate,
          navChange1D: isNaN(navChange1D) ? 0 : Math.round(navChange1D * 100) / 100
        };
      }
    } catch {
      // Keep existing
    }
  });

  await Promise.allSettled(promises);
  return result;
}
