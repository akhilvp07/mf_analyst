import { describe, it, expect } from 'vitest';
import { 
  isEquityOrientedSchemeSafe, 
  determineHoldingTaxClassification,
  EQUITY_LTCG_EXEMPTION_LIMIT,
  EQUITY_LTCG_TAX_RATE,
  EQUITY_STCG_TAX_RATE
} from '../src/utils/taxConfig';
import { isEquityOrientedScheme } from '../src/utils/financialCalculations';

describe('Indian Tax Rules Engine (Budget 2024 Compliance)', () => {
  it('correctly respects the 365-day LTCG holding threshold for equity', () => {
    const buyDate = new Date('2023-01-01');
    const sellDateShort = new Date('2023-12-31'); // 364 days -> Short Term
    const sellDateLong = new Date('2024-01-02'); // > 365 days -> Long Term

    const shortClass = determineHoldingTaxClassification('Equity - Flexi Cap', 'Parag Parikh Flexi Cap', buyDate, sellDateShort);
    expect(shortClass.isLtcg).toBe(false);
    expect(shortClass.rate).toBe(EQUITY_STCG_TAX_RATE); // 20% post-July 2024

    const longClass = determineHoldingTaxClassification('Equity - Flexi Cap', 'Parag Parikh Flexi Cap', buyDate, sellDateLong);
    expect(longClass.isLtcg).toBe(true);
    expect(longClass.rate).toBe(EQUITY_LTCG_TAX_RATE); // 12.5% post-July 2024
  });

  it('correctly provides ₹1.25 Lakh LTCG exemption threshold under Section 112A', () => {
    expect(EQUITY_LTCG_EXEMPTION_LIMIT).toBe(125000);
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
