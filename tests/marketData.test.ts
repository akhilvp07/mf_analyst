import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isMarketDataStale, fetchNiftyMarketData } from '../src/services/marketService';
import { NiftyMarketData } from '../src/types';

describe('Market Data & Stale Alert Suppression', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly flags market data older than 5 calendar days as stale', () => {
    const freshDate = new Date();
    freshDate.setDate(freshDate.getDate() - 2);

    const freshData: NiftyMarketData = {
      symbol: '^NSEI',
      name: 'NIFTY 50',
      currentClose: 24500,
      previousClose: 24400,
      change: 100,
      changePercent: 0.41,
      lastUpdated: freshDate.toISOString(),
      allTimePeak: 26277.35,
      allTimePeakDate: '2024-09-27',
      pointDropFromPeak: 1777.35,
      percentDropFromPeak: 6.76,
      drawdownTriggerPercent: 15.0,
      isDrawdownAlertActive: false,
      triggerLevel15Percent: 22335.75,
      pointsTo15PercentTrigger: 2164.25,
      currentPe: 22.5,
      currentPeTtm: 22.5,
      peTtm: 22.5,
      peThreshold: 20.0,
      isPeAlertActive: false,
      peZone: 'fair',
      pointsToPe20Threshold: 2722.2,
      conciseSummary: 'Market in fair valuation zone.',
      history: []
    };

    expect(isMarketDataStale(freshData)).toBe(false);

    // Stale data: 10 days old
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 10);
    const staleData: NiftyMarketData = {
      ...freshData,
      lastUpdated: staleDate.toISOString()
    };

    expect(isMarketDataStale(staleData)).toBe(true);
  });

  it('returns null instead of hardcoded numbers when market fetch fails', async () => {
    // Mock global fetch to fail
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')));

    const result = await fetchNiftyMarketData();
    // Must return null, NEVER invented fallback numbers
    expect(result).toBeNull();
  });
});
