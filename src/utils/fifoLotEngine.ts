/**
 * FIFO Lot-Matching Engine for Mutual Fund Capital Gains
 * Solves:
 * 1. Matching redemptions to purchase lots in strict First-In, First-Out order.
 * 2. Calculating realised gains on every redemption.
 * 3. Classifying LTCG / STCG per individual lot using that lot's purchase date (not fund aggregate).
 * 4. Applying Section 112A Grandfathering (31 Jan 2018) for equity lots acquired before Feb 1, 2018.
 */

import { TransactionRecord, PortfolioHolding, CapitalGainsAuditRow, TaxComputation } from '../types';
import { 
  classifyTaxAssetClass, 
  GRANDFATHERING_2018_FMV_NAV, 
  calculateGrandfatheredCost,
  INDIAN_TAX_CONFIG,
  getEquityTaxRatesForSaleDate 
} from './taxConfig';
import { parseDateSafe } from './financialCalculations';

interface PurchaseLot {
  id: string;
  schemeCode: string;
  schemeName: string;
  folioNumber: string;
  isin: string;
  buyDate: Date;
  buyDateStr: string;
  originalUnits: number;
  remainingUnits: number;
  buyNav: number;
  cost: number;
  fmv2018Nav?: number;
}

export interface FifoLotEngineResult {
  realizedRows: CapitalGainsAuditRow[];
  unrealizedRows: CapitalGainsAuditRow[];
  allRows: CapitalGainsAuditRow[];
  taxComputation: TaxComputation;
  realizedSummary: TaxComputation['realizedSummary'];
  unrealizedSummary: TaxComputation['unrealizedSummary'];
  totalGrandfatheringSavings: number;
}

export function runFifoLotEngine(
  transactions: TransactionRecord[],
  holdingsOrNavs: PortfolioHolding[] | Record<string, number> = [],
  today: Date = new Date()
): FifoLotEngineResult {
  const realizedRows: CapitalGainsAuditRow[] = [];
  const unrealizedRows: CapitalGainsAuditRow[] = [];

  const holdingsMap = new Map<string, PortfolioHolding>();
  const navOverrides = new Map<string, number>();

  if (Array.isArray(holdingsOrNavs)) {
    holdingsOrNavs.forEach(h => {
      holdingsMap.set(`${h.schemeCode}_${h.folioNumber}`, h);
      if (!holdingsMap.has(h.schemeCode)) {
        holdingsMap.set(h.schemeCode, h);
      }
    });
  } else if (holdingsOrNavs && typeof holdingsOrNavs === 'object') {
    Object.entries(holdingsOrNavs).forEach(([key, val]) => {
      if (typeof val === 'number') {
        navOverrides.set(key, val);
      }
    });
  }

  // 1. Group valid transactions by schemeCode + folioNumber
  const txGroups = new Map<string, TransactionRecord[]>();
  
  const sortedTxs = [...transactions]
    .filter(t => t.status !== 'FAILED' && !t.deleted)
    .sort((a, b) => parseDateSafe(a.date).getTime() - parseDateSafe(b.date).getTime());

  for (const tx of sortedTxs) {
    const key = `${tx.schemeCode}_${tx.folioNumber || 'FOLIO-1'}`;
    if (!txGroups.has(key)) {
      txGroups.set(key, []);
    }
    txGroups.get(key)!.push(tx);
  }

  let totalGrandfatheringSavings = 0;
  let counter = 1;

  // Process each scheme-folio group through FIFO
  for (const [key, groupTxs] of txGroups.entries()) {
    const holding = holdingsMap.get(key) || holdingsMap.get(groupTxs[0].schemeCode);
    const schemeCode = groupTxs[0].schemeCode;
    const schemeName = holding?.schemeName || groupTxs[0].schemeName;
    const folioNumber = groupTxs[0].folioNumber || holding?.folioNumber || 'FOLIO-1';
    const isin = holding?.isin || '';
    const overrideNav = navOverrides.get(schemeCode) ?? (isin ? navOverrides.get(isin) : undefined);
    const currentNav = overrideNav !== undefined && overrideNav > 0 
      ? overrideNav 
      : (holding?.currentNav && holding.currentNav > 0 ? holding.currentNav : (groupTxs[groupTxs.length - 1]?.nav || 0));
    const category = holding?.category || '';
    const assetClassType = classifyTaxAssetClass(schemeName, category);
    const isEquity = assetClassType === 'EQUITY';

    const purchaseLots: PurchaseLot[] = [];

    for (const tx of groupTxs) {
      const txTypeUpper = (tx.type || '').toUpperCase();
      const txDate = parseDateSafe(tx.date);
      const units = Math.abs(tx.units || 0);
      const amount = Math.abs(tx.amount || 0);
      const nav = tx.nav && tx.nav > 0 ? tx.nav : (units > 0 ? amount / units : 0);

      const isRedemption = 
        txTypeUpper === 'REDEMPTION' || 
        txTypeUpper === 'SWITCH_OUT' || 
        txTypeUpper === 'SWP' || 
        txTypeUpper.includes('REDEEM') || 
        txTypeUpper.includes('SELL');

      const isPurchase = 
        txTypeUpper === 'SIP' || 
        txTypeUpper === 'LUMPSUM' || 
        txTypeUpper === 'SWITCH_IN' || 
        txTypeUpper === 'DIVIDEND_REINVEST' || 
        txTypeUpper.includes('BUY') || 
        txTypeUpper.includes('PURCHASE');

      if (isPurchase && units > 0) {
        // Find 2018 FMV NAV if pre-2018
        let fmv2018: number | undefined;
        if (txDate <= new Date('2018-01-31T23:59:59Z') && isEquity) {
          fmv2018 = GRANDFATHERING_2018_FMV_NAV[schemeCode] || (isin ? GRANDFATHERING_2018_FMV_NAV[isin] : undefined);
        }

        purchaseLots.push({
          id: tx.id || `lot-${counter++}`,
          schemeCode,
          schemeName,
          folioNumber,
          isin,
          buyDate: txDate,
          buyDateStr: tx.date,
          originalUnits: units,
          remainingUnits: units,
          buyNav: nav,
          cost: amount,
          fmv2018Nav: fmv2018
        });
      } else if (isRedemption && units > 0) {
        // Consume purchase lots in strict FIFO order
        let unitsToRedeem = units;
        const sellNav = nav;
        const sellDate = txDate;
        const sellDateStr = tx.date;

        while (unitsToRedeem > 0.0001 && purchaseLots.length > 0) {
          const earliestLot = purchaseLots[0];
          const matchedUnits = Math.min(earliestLot.remainingUnits, unitsToRedeem);
          earliestLot.remainingUnits -= matchedUnits;
          unitsToRedeem -= matchedUnits;

          // Compute holding period from lot's purchase date to redemption date
          const holdingDays = Math.max(1, Math.round((sellDate.getTime() - earliestLot.buyDate.getTime()) / (1000 * 60 * 60 * 24)));
          
          let isLtcg = false;
          let gainType: 'LTCG' | 'STCG' | 'DEBT_SLAB' = 'STCG';
          let taxRatePct = 20.0;
          let sectionCode = 'Sec 111A';

          if (isEquity) {
            const equityRates = getEquityTaxRatesForSaleDate(sellDate);
            isLtcg = holdingDays > INDIAN_TAX_CONFIG.rates.equity.stcgDays;
            gainType = isLtcg ? 'LTCG' : 'STCG';
            taxRatePct = isLtcg ? equityRates.ltcgRate : equityRates.stcgRate;
            sectionCode = isLtcg ? equityRates.sectionCodeLtcg : equityRates.sectionCodeStcg;
          } else if (assetClassType === 'DEBT') {
            // Post-April 2023 debt rules (Sec 50AA): slab rate
            gainType = 'DEBT_SLAB';
            taxRatePct = INDIAN_TAX_CONFIG.marginalSlabRateEstimated;
            sectionCode = 'Sec 50AA';
          } else {
            // Hybrid / Gold / FoF
            isLtcg = holdingDays > INDIAN_TAX_CONFIG.rates.hybridAndOther.stcgDays;
            gainType = isLtcg ? 'LTCG' : 'STCG';
            taxRatePct = isLtcg ? INDIAN_TAX_CONFIG.rates.hybridAndOther.ltcgRate : INDIAN_TAX_CONFIG.rates.hybridAndOther.stcgRate;
            sectionCode = isLtcg ? INDIAN_TAX_CONFIG.rates.hybridAndOther.sectionLtcg : INDIAN_TAX_CONFIG.rates.hybridAndOther.sectionStcg;
          }

          const originalLotCost = matchedUnits * earliestLot.buyNav;
          const saleValue = matchedUnits * sellNav;
          const grossGain = saleValue - originalLotCost;

          // Grandfathering adjustment for equity
          let grandfatheredCost: number | undefined;
          let taxableGain = grossGain;
          let grandfatheringStatus: 'APPLIED' | 'NOT_APPLICABLE' | 'FMV_MISSING' | undefined = undefined;
          let grandfatheringWarning: string | undefined = undefined;

          if (isEquity && earliestLot.buyDate <= new Date('2018-01-31T23:59:59Z')) {
            if (earliestLot.fmv2018Nav && earliestLot.fmv2018Nav > 0) {
              const { adjustedCostNav, grandfatheringBenefitPerUnit } = calculateGrandfatheredCost(
                earliestLot.buyNav,
                sellNav,
                earliestLot.fmv2018Nav
              );
              if (grandfatheringBenefitPerUnit > 0) {
                grandfatheredCost = matchedUnits * adjustedCostNav;
                taxableGain = Math.max(0, saleValue - grandfatheredCost);
                const savings = grossGain - taxableGain;
                if (savings > 0) {
                  totalGrandfatheringSavings += savings;
                }
                grandfatheringStatus = 'APPLIED';
              } else {
                grandfatheringStatus = 'NOT_APPLICABLE';
              }
            } else {
              grandfatheringStatus = 'FMV_MISSING';
              grandfatheringWarning = 'Grandfathering not applied: 31-Jan-2018 FMV NAV missing';
            }
          }

          const estimatedTax = Math.max(0, taxableGain) * (taxRatePct / 100);

          realizedRows.push({
            id: `realized_${schemeCode}_${earliestLot.id}_${counter++}`,
            isin: earliestLot.isin || 'N/A',
            schemeCode,
            schemeName,
            folioNumber,
            assetClass: isEquity ? 'EQUITY' : assetClassType === 'DEBT' ? 'DEBT' : 'HYBRID',
            holdingPeriodDays: holdingDays,
            gainType,
            purchaseDate: earliestLot.buyDateStr,
            sellDate: sellDateStr,
            isRealized: true,
            units: matchedUnits,
            buyNav: earliestLot.buyNav,
            sellNav,
            saleNav: sellNav,
            currentNav: sellNav,
            purchaseCost: originalLotCost,
            saleValue,
            grossGain,
            gainOrLoss: grossGain,
            fmv2018Nav: earliestLot.fmv2018Nav,
            grandfatheredCost,
            grandfatheringStatus,
            grandfatheringWarning,
            taxableGain,
            applicableTaxRatePct: taxRatePct,
            estimatedTax,
            sectionCode
          });

          if (earliestLot.remainingUnits <= 0.0001) {
            purchaseLots.shift();
          }
        }
      }
    }

    // Remaining unconsumed lots generate UNREALISED rows with exact lot-level purchase dates!
    for (const lot of purchaseLots) {
      if (lot.remainingUnits <= 0.0001) continue;

      const units = lot.remainingUnits;
      const holdingDays = Math.max(1, Math.round((today.getTime() - lot.buyDate.getTime()) / (1000 * 60 * 60 * 24)));

      let isLtcg = false;
      let gainType: 'LTCG' | 'STCG' | 'DEBT_SLAB' = 'STCG';
      let taxRatePct = 20.0;
      let sectionCode = 'Sec 111A';

      if (isEquity) {
        const equityRates = getEquityTaxRatesForSaleDate(today);
        isLtcg = holdingDays > INDIAN_TAX_CONFIG.rates.equity.stcgDays;
        gainType = isLtcg ? 'LTCG' : 'STCG';
        taxRatePct = isLtcg ? equityRates.ltcgRate : equityRates.stcgRate;
        sectionCode = isLtcg ? equityRates.sectionCodeLtcg : equityRates.sectionCodeStcg;
      } else if (assetClassType === 'DEBT') {
        gainType = 'DEBT_SLAB';
        taxRatePct = INDIAN_TAX_CONFIG.marginalSlabRateEstimated;
        sectionCode = 'Sec 50AA';
      } else {
        isLtcg = holdingDays > INDIAN_TAX_CONFIG.rates.hybridAndOther.stcgDays;
        gainType = isLtcg ? 'LTCG' : 'STCG';
        taxRatePct = isLtcg ? INDIAN_TAX_CONFIG.rates.hybridAndOther.ltcgRate : INDIAN_TAX_CONFIG.rates.hybridAndOther.stcgRate;
        sectionCode = isLtcg ? INDIAN_TAX_CONFIG.rates.hybridAndOther.sectionLtcg : INDIAN_TAX_CONFIG.rates.hybridAndOther.sectionStcg;
      }

      const purchaseCost = units * lot.buyNav;
      const valuationValue = units * currentNav;
      const grossGain = valuationValue - purchaseCost;

      let grandfatheredCost: number | undefined;
      let taxableGain = grossGain;
      let grandfatheringStatus: 'APPLIED' | 'NOT_APPLICABLE' | 'FMV_MISSING' | undefined = undefined;
      let grandfatheringWarning: string | undefined = undefined;

      if (isEquity && lot.buyDate <= new Date('2018-01-31T23:59:59Z')) {
        if (lot.fmv2018Nav && lot.fmv2018Nav > 0) {
          if (isLtcg) {
            const { adjustedCostNav, grandfatheringBenefitPerUnit } = calculateGrandfatheredCost(
              lot.buyNav,
              currentNav,
              lot.fmv2018Nav
            );
            if (grandfatheringBenefitPerUnit > 0) {
              grandfatheredCost = units * adjustedCostNav;
              taxableGain = Math.max(0, valuationValue - grandfatheredCost);
              const savings = grossGain - taxableGain;
              if (savings > 0) {
                totalGrandfatheringSavings += savings;
              }
              grandfatheringStatus = 'APPLIED';
            } else {
              grandfatheringStatus = 'NOT_APPLICABLE';
            }
          } else {
            grandfatheringStatus = 'NOT_APPLICABLE';
          }
        } else {
          grandfatheringStatus = 'FMV_MISSING';
          grandfatheringWarning = 'Grandfathering not applied: 31-Jan-2018 FMV NAV missing';
        }
      }

      const estimatedTax = Math.max(0, taxableGain) * (taxRatePct / 100);

      unrealizedRows.push({
        id: `unrealized_${schemeCode}_${lot.id}_${counter++}`,
        isin: lot.isin || 'N/A',
        schemeCode,
        schemeName,
        folioNumber,
        assetClass: isEquity ? 'EQUITY' : assetClassType === 'DEBT' ? 'DEBT' : 'HYBRID',
        holdingPeriodDays: holdingDays,
        gainType,
        purchaseDate: lot.buyDateStr,
        sellDate: 'Unrealized (Valuation)',
        isRealized: false,
        units,
        buyNav: lot.buyNav,
        sellNav: currentNav,
        saleNav: currentNav,
        currentNav: currentNav,
        purchaseCost,
        saleValue: valuationValue,
        grossGain,
        gainOrLoss: grossGain,
        fmv2018Nav: lot.fmv2018Nav,
        grandfatheredCost,
        grandfatheringStatus,
        grandfatheringWarning,
        taxableGain,
        applicableTaxRatePct: taxRatePct,
        estimatedTax,
        sectionCode
      });
    }
  }

  // Realised aggregations
  let realizedLtcg = 0;
  let realizedStcg = 0;
  let realizedDebt = 0;
  let realizedTaxPayable = 0;

  for (const r of realizedRows) {
    if (r.gainType === 'LTCG') {
      realizedLtcg += r.taxableGain;
      realizedTaxPayable += r.estimatedTax;
    } else if (r.gainType === 'STCG') {
      realizedStcg += r.taxableGain;
      realizedTaxPayable += r.estimatedTax;
    } else {
      realizedDebt += r.taxableGain;
      realizedTaxPayable += r.estimatedTax;
    }
  }

  // Unrealised aggregations
  let unrealizedLtcg = 0;
  let unrealizedStcg = 0;
  let unrealizedDebt = 0;
  let unrealizedTaxPayable = 0;

  for (const u of unrealizedRows) {
    if (u.gainType === 'LTCG') {
      unrealizedLtcg += Math.max(0, u.taxableGain);
    } else if (u.gainType === 'STCG') {
      unrealizedStcg += Math.max(0, u.taxableGain);
    } else {
      unrealizedDebt += Math.max(0, u.taxableGain);
    }
  }

  const exemptLimit = INDIAN_TAX_CONFIG.equityLtcgExemptionLimit;
  const taxableUnrealizedLtcg = Math.max(0, unrealizedLtcg - exemptLimit);
  const unrealizedLtcgTax = taxableUnrealizedLtcg * (INDIAN_TAX_CONFIG.rates.equity.ltcgRate / 100);
  const unrealizedStcgTax = unrealizedStcg * (INDIAN_TAX_CONFIG.rates.equity.stcgRate / 100);
  const unrealizedDebtTax = unrealizedDebt * (INDIAN_TAX_CONFIG.marginalSlabRateEstimated / 100);
  unrealizedTaxPayable = unrealizedLtcgTax + unrealizedStcgTax + unrealizedDebtTax;

  const taxHarvestingOpportunity = Math.max(0, Math.min(unrealizedLtcg, exemptLimit));

  const taxComputation: TaxComputation = {
    financialYear: 'FY 2024-25 / FY 2025-26 (Budget 2024)',
    equityLtcg: {
      grossGain: unrealizedLtcg,
      exemptLimit,
      taxableGain: taxableUnrealizedLtcg,
      taxRate: INDIAN_TAX_CONFIG.rates.equity.ltcgRate,
      taxPayable: unrealizedLtcgTax
    },
    equityStcg: {
      grossGain: unrealizedStcg,
      taxRate: INDIAN_TAX_CONFIG.rates.equity.stcgRate,
      taxPayable: unrealizedStcgTax
    },
    debtGains: {
      grossGain: unrealizedDebt,
      taxRateEstimated: INDIAN_TAX_CONFIG.marginalSlabRateEstimated,
      taxPayable: unrealizedDebtTax
    },
    realizedSummary: {
      totalRealizedGain: realizedLtcg + realizedStcg + realizedDebt,
      realizedLtcg,
      realizedStcg,
      realizedDebt,
      realizedTaxPayable
    },
    unrealizedSummary: {
      totalUnrealizedGain: unrealizedLtcg + unrealizedStcg + unrealizedDebt,
      unrealizedLtcg,
      unrealizedStcg,
      unrealizedDebt,
      unrealizedTaxPayable
    },
    totalEstimatedTax: realizedTaxPayable + unrealizedTaxPayable,
    unrealizedLtcg,
    unrealizedStcg,
    taxHarvestingOpportunity,
    grandfatheringSavingsTotal: totalGrandfatheringSavings
  };

  return {
    realizedRows,
    unrealizedRows,
    allRows: [...realizedRows, ...unrealizedRows],
    taxComputation,
    realizedSummary: taxComputation.realizedSummary,
    unrealizedSummary: taxComputation.unrealizedSummary,
    totalGrandfatheringSavings
  };
}
