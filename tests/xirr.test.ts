import { describe, it, expect } from 'vitest';
import { calculateXirr } from '../src/utils/financialCalculations';

describe('calculateXirr (Excel-Standard 365-Day Basis)', () => {
  it('returns null on empty or single flow (cannot compute IRR)', () => {
    expect(calculateXirr([])).toBeNull();
    expect(calculateXirr([{ date: new Date('2024-01-01'), amount: -10000 }])).toBeNull();
  });

  it('returns null when all cashflows are negative (outflows only)', () => {
    const flows = [
      { date: new Date('2024-01-01'), amount: -10000 },
      { date: new Date('2024-02-01'), amount: -10000 },
    ];
    expect(calculateXirr(flows)).toBeNull();
  });

  it('returns null when all cashflows are positive (inflows only)', () => {
    const flows = [
      { date: new Date('2024-01-01'), amount: 10000 },
      { date: new Date('2024-02-01'), amount: 12000 },
    ];
    expect(calculateXirr(flows)).toBeNull();
  });

  it('matches known Excel XIRR for a standard 1-year investment doubling', () => {
    // Invest 10,000 on 2023-01-01, receive 20,000 on 2024-01-01 (exactly 365 days)
    // Excel formula: =XIRR({-10000, 20000}, {"2023-01-01", "2024-01-01"}) -> 100.00%
    const flows = [
      { date: new Date('2023-01-01'), amount: -10000 },
      { date: new Date('2024-01-01'), amount: 20000 },
    ];
    const xirr = calculateXirr(flows);
    expect(xirr).not.toBeNull();
    expect(Math.round(xirr!)).toBe(100);
  });

  it('calculates regular monthly SIP correctly', () => {
    // 3 monthly installments of 10,000 and current valuation of 31,500
    const flows = [
      { date: new Date('2024-01-01'), amount: -10000 },
      { date: new Date('2024-02-01'), amount: -10000 },
      { date: new Date('2024-03-01'), amount: -10000 },
      { date: new Date('2024-04-01'), amount: 31500 },
    ];
    const xirr = calculateXirr(flows);
    expect(xirr).not.toBeNull();
    expect(xirr!).toBeGreaterThan(20);
    expect(xirr!).toBeLessThan(50);
  });

  it('correctly treats dividend payouts as positive investor inflows', () => {
    // Investor buys fund for 100,000, receives 5,000 dividend payout, ends with 102,000
    const flowsWithDividend = [
      { date: new Date('2023-01-01'), amount: -100000 },
      { date: new Date('2023-07-01'), amount: 5000 }, // Dividend cash inflow
      { date: new Date('2024-01-01'), amount: 102000 },
    ];
    const xirr = calculateXirr(flowsWithDividend);
    expect(xirr).not.toBeNull();
    expect(xirr!).toBeGreaterThan(6.5);
  });

  it('handles short holding period without exploding or crashing', () => {
    // 5 day hold with small profit
    const flows = [
      { date: new Date('2024-01-01'), amount: -100000 },
      { date: new Date('2024-01-06'), amount: 100500 },
    ];
    const xirr = calculateXirr(flows);
    expect(xirr).not.toBeNull();
    expect(xirr!).toBeGreaterThan(0);
  });
});
