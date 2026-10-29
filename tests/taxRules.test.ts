import { describe, it, expect } from 'vitest';
import { 
  isEquityOrientedSchemeSafe, 
  determineHoldingTaxClassification,
  getEquityTaxRatesForSaleDate,
  EQUITY_LTCG_EXEMPTION_LIMIT,
  EQUITY_LTCG_TAX_RATE,
  EQUITY_STCG_TAX_RATE
} from '../src/utils/taxConfig';
import { isEquityOrientedScheme } from '../src/utils/financialCalculations';
import { runFifoLotEngine } from '../src/utils/fifoLotEngine';
import { TransactionRecord } from '../src/types';

describe('Indian Tax Rules Engine (Budget 2024 & Sale Date Compliance)', () => {
  it('correctly uses pre-Budget 2024 rates (15% STCG / 10% LTCG) for sales before 23-Jul-2024', () => {
    const buyDate = new Date('2023-01-01');
    const sellDateShort = new Date('2023-12-31'); // 364 days -> Short Term in 2023
    const sellDateLong = new Date('2024-01-02'); // > 365 days -> Long Term in early 2024

    const shortClass = determineHoldingTaxClassification('Equity - Flexi Cap', 'Parag Parikh Flexi Cap', buyDate, sellDateShort);
    expect(shortClass.isLtcg).toBe(false);
    expect(shortClass.rate).toBe(15.0); // 15% pre-Budget 2024
    expect(shortClass.exemptionLimit).toBe(100000);

    const longClass = determineHoldingTaxClassification('Equity - Flexi Cap', 'Parag Parikh Flexi Cap', buyDate, sellDateLong);
    expect(longClass.isLtcg).toBe(true);
    expect(longClass.rate).toBe(10.0); // 10% pre-Budget 2024
    expect(longClass.exemptionLimit).toBe(100000);
  });

  it('correctly handles the 22-Jul-2024 vs 23-Jul-2024 Budget boundary', () => {
    const preDate = new Date('2024-07-22T23:59:59Z');
    const postDate = new Date('2024-07-23T00:00:00Z');

    const preRates = getEquityTaxRatesForSaleDate(preDate);
    expect(preRates.stcgRate).toBe(15.0);
    expect(preRates.ltcgRate).toBe(10.0);
    expect(preRates.exemptionLimit).toBe(100000);
    expect(preRates.isBudget2024OrLater).toBe(false);

    const postRates = getEquityTaxRatesForSaleDate(postDate);
    expect(postRates.stcgRate).toBe(20.0);
    expect(postRates.ltcgRate).toBe(12.5);
    expect(postRates.exemptionLimit).toBe(125000);
    expect(postRates.isBudget2024OrLater).toBe(true);
  });

  it('correctly provides ₹1.25 Lakh LTCG exemption threshold under Section 112A for post-Budget 2024', () => {
    expect(EQUITY_LTCG_EXEMPTION_LIMIT).toBe(125000);
    expect(EQUITY_LTCG_TAX_RATE).toBe(12.5);
    expect(EQUITY_STCG_TAX_RATE).toBe(20.0);
  });

  it('distinguishes equity vs debt vs hybrid taxation classifications', () => {
    const buyDate = new Date('2023-01-01');
    const sellDate = new Date('2024-06-01');

    // Equity
    const eq = determineHoldingTaxClassification('Equity - Small Cap', 'Quant Small Cap', buyDate, sellDate);
    expect(eq.taxCategory).toBe('EQUITY');

    // Debt (Section 50AA slab rate)
    const debt = determineHoldingTaxClassification('Debt - Liquid', 'HDFC Liquid Fund', buyDate, sellDate);
    expect(debt.taxCategory).toBe('DEBT_POST_2023');
    expect(debt.sectionCode).toBe('SEC_50AA');

    // Arbitrage (Taxed as Equity under SEBI/IT Act)
    const arb = determineHoldingTaxClassification('Hybrid - Arbitrage', 'Kotak Equity Arbitrage Fund', buyDate, sellDate);
    expect(arb.taxCategory).toBe('EQUITY');
  });

  it('correctly flags pre-2018 grandfathering status with FMV vs without FMV', () => {
    // 1. Lot with FMV (122639 PPFAS Flexi Cap has FMV 25.1432)
    const txWithFmv: TransactionRecord[] = [
      {
        id: 'tx-1',
        schemeCode: '122639',
        schemeName: 'Parag Parikh Flexi Cap Fund Direct Growth',
        folioNumber: 'F1',
        type: 'LUMPSUM',
        date: '2017-06-15',
        units: 100,
        nav: 15.0,
        amount: 1500,
        status: 'COMPLETED'
      }
    ];

    const resWithFmv = runFifoLotEngine(txWithFmv, { '122639': 50.0 }, new Date('2025-01-01'));
    expect(resWithFmv.unrealizedRows).toHaveLength(1);
    const rowWithFmv = resWithFmv.unrealizedRows[0];
    expect(rowWithFmv.grandfatheringStatus).toBe('APPLIED');
    expect(rowWithFmv.fmv2018Nav).toBe(25.1432);
    expect(rowWithFmv.grandfatheredCost).toBe(100 * 25.1432);

    // 2. Pre-2018 lot WITHOUT FMV in table
    const txWithoutFmv: TransactionRecord[] = [
      {
        id: 'tx-2',
        schemeCode: '999999',
        schemeName: 'Obscure Old Equity Fund Direct Growth',
        folioNumber: 'F2',
        type: 'LUMPSUM',
        date: '2017-06-15',
        units: 100,
        nav: 10.0,
        amount: 1000,
        status: 'COMPLETED'
      }
    ];

    const resWithoutFmv = runFifoLotEngine(txWithoutFmv, { '999999': 30.0 }, new Date('2025-01-01'));
    expect(resWithoutFmv.unrealizedRows).toHaveLength(1);
    const rowWithoutFmv = resWithoutFmv.unrealizedRows[0];
    expect(rowWithoutFmv.grandfatheringStatus).toBe('FMV_MISSING');
    expect(rowWithoutFmv.grandfatheringWarning).toContain('FMV NAV missing');
  });

  it('Issue 3 check: isEquityOrientedScheme is order-safe whether called as (name, cat) or (cat, name)', () => {
    // Correct argument order: (schemeName, category)
    const order1 = isEquityOrientedScheme('Parag Parikh Flexi Cap Fund', 'Equity - Flexi Cap');
    expect(order1).toBe(true);

    // Swapped argument order: (category, schemeName) -> MUST NOT fail or return false
    const order2 = isEquityOrientedScheme('Equity - Flexi Cap', 'Parag Parikh Flexi Cap Fund');
    expect(order2).toBe(true);

    // Debt scheme in either order returns false
    expect(isEquityOrientedScheme('HDFC Overnight Fund', 'Debt - Liquid')).toBe(false);
    expect(isEquityOrientedScheme('Debt - Liquid', 'HDFC Overnight Fund')).toBe(false);
  });
});
