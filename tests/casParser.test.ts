import { describe, it, expect } from 'vitest';
import { classifyTransactionType } from '../src/services/pdfCasParser';
import { getTransactionDirection } from '../src/utils/financialCalculations';

describe('CAS Parser Transaction Classification & Direction Engine', () => {
  it('correctly classifies standard purchases and SIPs', () => {
    expect(classifyTransactionType('SIP Purchase - Bank Auto Debit')).toBe('SIP');
    expect(classifyTransactionType('Systematic Investment Purchase')).toBe('SIP');
    expect(classifyTransactionType('Additional Purchase / Lumpsum')).toBe('LUMPSUM');
    expect(classifyTransactionType('New Fund Offer (NFO)')).toBe('LUMPSUM');
  });

  it('correctly classifies redemptions and switch-outs', () => {
    expect(classifyTransactionType('Redemption by Investor - Direct Credit')).toBe('REDEMPTION');
    expect(classifyTransactionType('Switch-Out to Liquid Fund')).toBe('SWITCH_OUT');
    expect(classifyTransactionType('STP Out to Equity Fund')).toBe('SWITCH_OUT');
    expect(classifyTransactionType('Systematic Withdrawal Plan (SWP)')).toBe('REDEMPTION');
  });

  it('correctly classifies dividend payouts vs dividend reinvestments', () => {
    expect(classifyTransactionType('Dividend Payout to Bank Account')).toBe('DIVIDEND_PAYOUT');
    expect(classifyTransactionType('IDCW Payout')).toBe('DIVIDEND_PAYOUT');
    expect(classifyTransactionType('Dividend Reinvestment')).toBe('DIVIDEND_REINVEST');
  });

  it('correctly classifies stamp duty, reversals and charges', () => {
    expect(classifyTransactionType('Stamp Duty on Purchase')).toBe('STAMP_DUTY');
    expect(classifyTransactionType('SIP Auto-Debit Reversal / Bounce')).toBe('REVERSAL');
    expect(classifyTransactionType('TDS / Tax Deduction at Source')).toBe('CHARGE');
  });

  it('flags unclassified arbitrary lines as UNKNOWN rather than defaulting to SIP', () => {
    expect(classifyTransactionType('Random bank advisory note or KYC acknowledgement')).toBe('UNKNOWN');
  });

  it('assigns correct sign and cashflow direction to all transaction types via getTransactionDirection', () => {
    // Purchases are investor cash outflow (-), unit addition (+)
    const sipDir = getTransactionDirection('SIP');
    expect(sipDir.cashflowSign).toBe(-1);
    expect(sipDir.unitDelta).toBe(1);

    // Redemptions are investor cash inflow (+), unit subtraction (-)
    const redeemDir = getTransactionDirection('REDEMPTION');
    expect(redeemDir.cashflowSign).toBe(1);
    expect(redeemDir.unitDelta).toBe(-1);

    // Dividend Payout is cash inflow (+), but does NOT change units (0)
    const divDir = getTransactionDirection('DIVIDEND_PAYOUT');
    expect(divDir.cashflowSign).toBe(1);
    expect(divDir.unitDelta).toBe(0);

    // Stamp duty is cost outflow (-), does not add units (0)
    const stampDir = getTransactionDirection('STAMP_DUTY');
    expect(stampDir.cashflowSign).toBe(-1);
    expect(stampDir.unitDelta).toBe(0);
  });
});
