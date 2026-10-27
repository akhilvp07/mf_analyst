/**
 * Centralized Indian Mutual Fund Tax Rules & Thresholds Configuration
 * Compliant with Finance Act 2024 / Budget 2024:
 * - Equity LTCG: 12.5% with ₹1.25 Lakh exemption (Sec 112A)
 * - Equity STCG: 20.0% (Sec 111A)
 * - Specified Mutual Funds (<=35% Equity, post-Apr 2023): Slab rate (~30%) (Sec 50AA)
 * - Section 112A 31-Jan-2018 Grandfathering Rules
 */

export type TaxAssetClass = 'EQUITY' | 'DEBT' | 'HYBRID_NON_EQUITY' | 'GOLD_COMMODITY' | 'INTERNATIONAL_FOF';

export interface TaxRuleConfig {
  assetClass: TaxAssetClass;
  stcgPeriodDays: number; // e.g. 365 for equity, 730 for hybrid post-2024
  stcgRatePct: number;    // e.g. 20%
  ltcgRatePct: number;    // e.g. 12.5%
  ltcgExemptionLimit: number; // ₹1,25,000 for equity Sec 112A
  isIndexationAllowed: boolean;
  sectionCodeLtcg: string; // '112A', '112', '50AA'
  sectionCodeStcg: string; // '111A', '50AA'
}

export const INDIAN_TAX_CONFIG = {
  budget2024EffectiveDate: '2024-07-23',
  equityLtcgExemptionLimit: 125000, // ₹1.25 Lakh annual exemption
  grandfatheringCutoffDate: '2018-01-31',
  debtSection50AaCutoffDate: '2023-04-01',
  marginalSlabRateEstimated: 30.0, // Assumed marginal tax bracket for debt gains
  rates: {
    equity: {
      stcgDays: 365,
      stcgRate: 20.0,
      ltcgRate: 12.5,
      exemptionLimit: 125000,
      sectionLtcg: 'Sec 112A',
      sectionStcg: 'Sec 111A'
    },
    specifiedDebtPost2023: {
      // <= 35% equity, acquired on/after 1 Apr 2023 (Sec 50AA)
      stcgDays: Infinity, // all gains treated as short term
      stcgRate: 30.0,
      ltcgRate: 30.0,
      exemptionLimit: 0,
      sectionLtcg: 'Sec 50AA',
      sectionStcg: 'Sec 50AA'
    },
    hybridAndOther: {
      // > 35% and < 65% equity (Balanced hybrid, Multi-Asset, International FoFs, Gold/Silver)
      // Post Budget 2024: 24 months holding threshold, 12.5% LTCG without indexation
      stcgDays: 730, // 24 months
      stcgRate: 30.0, // slab
      ltcgRate: 12.5,
      exemptionLimit: 0,
      sectionLtcg: 'Sec 112',
      sectionStcg: 'Sec 50AA / Slab'
    }
  }
};

/**
 * Historical 31-Jan-2018 NAV reference anchors for Section 112A grandfathering computation
 */
export const GRANDFATHERING_2018_FMV_NAV: Record<string, number> = {
  // PPFAS Flexi Cap Direct Growth
  '122639': 25.1432,
  'INF879O01027': 25.1432,
  // PPFAS Flexi Cap Regular Growth
  '122640': 24.3211,
  'INF879O01019': 24.3211,
  // Axis ELSS Tax Saver Direct Growth
  '120503': 46.12,
  'INF846K01EW2': 46.12,
  // Axis ELSS Tax Saver Regular Growth
  '112323': 42.85,
  'INF846K01131': 42.85,
  // Mirae Asset Large & Midcap Direct Growth
  '118834': 51.30,
  'INF769K01EZ2': 51.30,
  // HDFC Mid-Cap Opportunities Direct Growth
  '118989': 58.74,
  'INF179K01CY1': 58.74,
  // Nippon India Small Cap Direct Growth
  '118778': 49.92,
  'INF204K01W14': 49.92,
  // ICICI Bluechip Direct Growth
  '120586': 43.15,
  'INF109K01Z48': 43.15,
  // UTI Nifty 50 Index Direct Growth
  '120716': 69.45,
  'INF789F01EV8': 69.45,
  // Quant Small Cap Direct Growth
  '120828': 64.20,
  'INF966L01AA3': 64.20
};

/**
 * Classify a fund into its precise tax asset class based on SEBI category and name.
 * Correctly distinguishes:
 * - Equity-oriented (Flexi, Large, Mid, Small, ELSS, Arbitrage, Index) >= 65% domestic equity
 * - Pure Debt / Liquid / Cash (<= 35% equity)
 * - Gold / Commodities
 * - International FoF
 * - Hybrid
 */
export function classifyTaxAssetClass(schemeName: string = '', category: string = ''): TaxAssetClass {
  const cat = (category || '').toLowerCase();
  const name = (schemeName || '').toLowerCase();

  // 1. Gold & Precious Metals
  if (
    cat.includes('gold') || 
    cat.includes('silver') || 
    cat.includes('commodity') || 
    name.includes('gold') || 
    name.includes('silver') ||
    name.includes('commodity')
  ) {
    return 'GOLD_COMMODITY';
  }

  // 2. International FoF / Foreign Equity (Taxed as Non-Equity)
  if (
    cat.includes('international') || 
    cat.includes('global') || 
    name.includes('nasdaq') || 
    name.includes('fof') || 
    name.includes('fund of fund') ||
    name.includes('us equity') ||
    name.includes('greater china') ||
    name.includes('global')
  ) {
    return 'INTERNATIONAL_FOF';
  }

  // 3. Pure Fixed Income / Debt / Liquid
  if (
    cat.includes('liquid') || 
    cat.includes('overnight') || 
    cat.includes('money market') ||
    cat.includes('gilt') || 
    cat.includes('corporate bond') || 
    cat.includes('banking & psu') || 
    cat.includes('duration') || 
    cat.includes('debt') ||
    cat.includes('floater') ||
    cat.includes('credit risk')
  ) {
    return 'DEBT';
  }

  // 4. Arbitrage Funds: under Indian Income Tax Act Sec 10(23D), Arbitrage Funds maintain >= 65%
  // gross equity & equity derivative exposure, and are legally classified as EQUITY for capital gains tax!
  if (
    cat.includes('arbitrage') || 
    name.includes('arbitrage')
  ) {
    return 'EQUITY';
  }

  // 5. Hybrids
  if (
    cat.includes('balanced advantage') || 
    cat.includes('dynamic asset') || 
    cat.includes('aggressive hybrid')
  ) {
    // Aggressive hybrid & standard BAFs maintain >= 65% equity for tax status
    return 'EQUITY';
  }

  if (
    cat.includes('conservative hybrid') || 
    cat.includes('multi asset') || 
    cat.includes('equity savings') ||
    name.includes('conservative')
  ) {
    return 'HYBRID_NON_EQUITY';
  }

  // 6. Default to Equity (Large, Mid, Small, Flexi, Multi, ELSS, Index, Sectoral)
  return 'EQUITY';
}

/**
 * Robust check if a fund is equity-oriented for tax purposes.
 * Accepts arguments in either order (schemeName, category) or (category, schemeName)
 * to guard against call-site transposition while logging cleanly.
 */
export function isEquityOrientedSchemeSafe(arg1: string = '', arg2: string = ''): boolean {
  const assetClass1 = classifyTaxAssetClass(arg1, arg2);
  const assetClass2 = classifyTaxAssetClass(arg2, arg1);
  return assetClass1 === 'EQUITY' || assetClass2 === 'EQUITY';
}

/**
 * Compute Section 112A Grandfathered Cost of Acquisition for a pre-2018 purchase lot
 */
export function calculateGrandfatheredCost(
  buyNav: number,
  saleOrCurrentNav: number,
  fmv2018Nav?: number
): { adjustedCostNav: number; grandfatheringBenefitPerUnit: number } {
  if (!fmv2018Nav || fmv2018Nav <= 0) {
    return { adjustedCostNav: buyNav, grandfatheringBenefitPerUnit: 0 };
  }

  // Step 1: Lower of FMV as on 31 Jan 2018 and Sale/Current NAV
  const lowerOfFmvAndSale = Math.min(fmv2018Nav, saleOrCurrentNav);

  // Step 2: Higher of Actual Buy NAV and Step 1
  const adjustedCostNav = Math.max(buyNav, lowerOfFmvAndSale);

  const grandfatheringBenefitPerUnit = Math.max(0, adjustedCostNav - buyNav);

  return { adjustedCostNav, grandfatheringBenefitPerUnit };
}

export const EQUITY_LTCG_EXEMPTION_LIMIT = INDIAN_TAX_CONFIG.equityLtcgExemptionLimit;
export const EQUITY_LTCG_TAX_RATE = INDIAN_TAX_CONFIG.rates.equity.ltcgRate;
export const EQUITY_STCG_TAX_RATE = INDIAN_TAX_CONFIG.rates.equity.stcgRate;

/**
 * Determine holding tax classification for a specific lot
 */
export function determineHoldingTaxClassification(
  arg1: string = '',
  arg2: string = '',
  buyDate: Date,
  sellDate: Date
): {
  taxCategory: 'EQUITY' | 'DEBT_POST_2023' | 'DEBT_PRE_2023' | 'HYBRID_NON_EQUITY' | 'GOLD_COMMODITY' | 'INTERNATIONAL_FOF';
  isLtcg: boolean;
  rate: number;
  sectionCode: string;
} {
  const isEquity = isEquityOrientedSchemeSafe(arg1, arg2);
  const holdingDays = Math.max(0, Math.round((sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)));

  if (isEquity) {
    const isLtcg = holdingDays > INDIAN_TAX_CONFIG.rates.equity.stcgDays;
    return {
      taxCategory: 'EQUITY',
      isLtcg,
      rate: isLtcg ? INDIAN_TAX_CONFIG.rates.equity.ltcgRate : INDIAN_TAX_CONFIG.rates.equity.stcgRate,
      sectionCode: isLtcg ? 'SEC_112A' : 'SEC_111A'
    };
  }

  const rawClass1 = classifyTaxAssetClass(arg1, arg2);
  const rawClass2 = classifyTaxAssetClass(arg2, arg1);
  const isDebt = rawClass1 === 'DEBT' || rawClass2 === 'DEBT';

  if (isDebt) {
    return {
      taxCategory: 'DEBT_POST_2023',
      isLtcg: false,
      rate: INDIAN_TAX_CONFIG.marginalSlabRateEstimated,
      sectionCode: 'SEC_50AA'
    };
  }

  const chosenClass = rawClass1 !== 'EQUITY' ? rawClass1 : rawClass2;
  const isLtcg = holdingDays > INDIAN_TAX_CONFIG.rates.hybridAndOther.stcgDays;
  return {
    taxCategory: chosenClass,
    isLtcg,
    rate: isLtcg ? INDIAN_TAX_CONFIG.rates.hybridAndOther.ltcgRate : INDIAN_TAX_CONFIG.rates.hybridAndOther.stcgRate,
    sectionCode: isLtcg ? 'SEC_112' : 'SEC_50AA'
  };
}
