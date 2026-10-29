import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  Sparkles, 
  Info, 
  Printer, 
  FileSpreadsheet, 
  Calendar, 
  Layers,
  ShieldAlert,
  ArrowUpRight,
  Clock
} from 'lucide-react';
import { PortfolioHolding, TransactionRecord, CapitalGainsAuditRow } from '../types';
import { formatINR } from '../utils/financialCalculations';
import { runFifoLotEngine } from '../utils/fifoLotEngine';
import { PrivacyValue } from '../context/PrivacyContext';

interface TaxCalculatorProps {
  transactions: TransactionRecord[];
  holdings: PortfolioHolding[];
}

export const TaxCalculator: React.FC<TaxCalculatorProps> = ({ transactions, holdings }) => {
  const [selectedFy, setSelectedFy] = useState<string>('FY 2024-25');
  const [activeView, setActiveView] = useState<'summary' | 'audit_schedule'>('summary');
  const [filterType, setFilterType] = useState<'ALL' | 'REALIZED' | 'UNREALIZED' | 'LTCG' | 'STCG' | 'DEBT'>('ALL');

  // Compute FIFO lot-matched capital gains (both realized and unrealized)
  const engineResult = useMemo(() => {
    return runFifoLotEngine(transactions, holdings);
  }, [transactions, holdings]);

  const tax = engineResult.taxComputation;
  const auditScheduleRows = engineResult.allRows;

  // Filtered rows for audit schedule table
  const filteredAuditRows = useMemo(() => {
    if (filterType === 'ALL') return auditScheduleRows;
    if (filterType === 'REALIZED') return auditScheduleRows.filter(r => r.isRealized);
    if (filterType === 'UNREALIZED') return auditScheduleRows.filter(r => !r.isRealized);
    if (filterType === 'LTCG') return auditScheduleRows.filter(r => r.gainType === 'LTCG');
    if (filterType === 'STCG') return auditScheduleRows.filter(r => r.gainType === 'STCG');
    if (filterType === 'DEBT') return auditScheduleRows.filter(r => r.gainType === 'DEBT_SLAB');
    return auditScheduleRows;
  }, [auditScheduleRows, filterType]);

  // Export Capital Gains Schedule CSV (Labeled: Estimate, not for filing)
  const handleExportCsv = () => {
    const headers = [
      'ISIN',
      'Scheme Name',
      'Folio Number',
      'Asset Class',
      'Tax Section',
      'Status',
      'Date of Acquisition',
      'Date of Sale / Valuation',
      'Holding Period (Days)',
      'Units',
      'Buy NAV (INR)',
      'Sale / Valuation NAV (INR)',
      'Cost of Acquisition (INR)',
      '31-Jan-2018 Grandfathered Cost (INR)',
      'Grandfathering Status',
      'Sale / Consideration Value (INR)',
      'Gross Capital Gain / Loss (INR)',
      'Taxable Gain (INR)',
      'Tax Rate (%)',
      'Estimated Tax (INR)',
      'Note'
    ];

    const rows = auditScheduleRows.map(r => [
      `"${r.isin}"`,
      `"${r.schemeName.replace(/"/g, '""')}"`,
      `"${r.folioNumber}"`,
      `"${r.assetClass}"`,
      `"${r.sectionCode || (r.gainType === 'LTCG' ? 'Sec 112A' : r.gainType === 'STCG' ? 'Sec 111A' : 'Sec 50AA')}"`,
      `"${r.isRealized ? 'REALIZED' : 'UNREALIZED'}"`,
      `"${r.purchaseDate}"`,
      `"${r.sellDate}"`,
      r.holdingPeriodDays,
      r.units.toFixed(4),
      r.buyNav.toFixed(4),
      r.sellNav.toFixed(4),
      r.purchaseCost.toFixed(2),
      (r.grandfatheredCost ? r.grandfatheredCost.toFixed(2) : 'N/A'),
      `"${r.grandfatheringStatus || 'N/A'}"`,
      r.saleValue.toFixed(2),
      r.grossGain.toFixed(2),
      r.taxableGain.toFixed(2),
      r.applicableTaxRatePct,
      r.estimatedTax.toFixed(2),
      `"Estimate, not for filing"`
    ]);

    const disclaimerHeader = '# MFTracker Capital Gains Schedule - Estimates only. Not investment, tax or legal advice.';
    const csvContent = [disclaimerHeader, headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `MFTracker_Capital_Gains_Estimate_${selectedFy.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintAudit = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Universal Legal Notice */}
      <div className="flex items-center gap-2.5 p-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-300 shadow-sm">
        <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
        <span><strong>Estimates only. Not investment, tax or legal advice.</strong> Capital gains figures and grandfathering adjustments are computed for informational and planning purposes only. Verify with a Chartered Accountant or tax professional before filing ITR.</span>
      </div>

      {/* Header Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">
                Capital Gains & Indian Tax Estimator
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Budget 2024 & Pre-Budget Rates
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                FIFO Lot Engine
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              FIFO lot-matched Schedule 112A (Equity LTCG), Section 111A (STCG), and Section 50AA (Debt) with 31-Jan-2018 grandfathering support.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* FY Selector */}
            <div className="flex items-center gap-1.5 bg-neutral-800 border border-neutral-700 px-2.5 py-1.5 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={selectedFy}
                onChange={(e) => setSelectedFy(e.target.value)}
                className="bg-transparent text-neutral-200 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="FY 2024-25" className="bg-neutral-900 text-white">FY 2024-25 (AY 2025-26)</option>
                <option value="FY 2025-26" className="bg-neutral-900 text-white">FY 2025-26 (AY 2026-27)</option>
                <option value="FY 2026-27" className="bg-neutral-900 text-white">FY 2026-27 (AY 2027-28)</option>
              </select>
            </div>

            {/* 1-Click Export CSV (Notice: Estimate, not for filing) */}
            <button
              onClick={handleExportCsv}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Download FIFO Capital Gains calculation (Estimate, not for filing)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Schedule (Estimate)</span>
            </button>

            {/* Print Schedule */}
            <button
              onClick={handlePrintAudit}
              className="p-2 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition cursor-pointer"
              title="Print Capital Gains Audit Schedule"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-neutral-800 flex-wrap">
          <button
            onClick={() => setActiveView('summary')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeView === 'summary'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            Tax Liability Overview
          </button>
          <button
            onClick={() => setActiveView('audit_schedule')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeView === 'audit_schedule'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>FIFO Audit Schedule ({auditScheduleRows.length} Lots: {engineResult.realizedRows.length} Realized, {engineResult.unrealizedRows.length} Unrealized)</span>
          </button>
        </div>
      </div>

      {activeView === 'summary' ? (
        <>
          {/* Realized Gains Summary Callout (if any redemptions exist) */}
          {tax.realizedSummary && tax.realizedSummary.totalRealizedGain !== 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Realised Capital Gains from Redemptions ({engineResult.realizedRows.length} Matched Lots)
                  </h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                  FIFO Consumed
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/80">
                  <span className="text-neutral-400 block text-[11px]">Realised LTCG:</span>
                  <strong className="text-emerald-400 font-mono text-sm block mt-0.5">
                    <PrivacyValue value={formatINR(tax.realizedSummary.realizedLtcg)} />
                  </strong>
                </div>
                <div className="bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/80">
                  <span className="text-neutral-400 block text-[11px]">Realised STCG:</span>
                  <strong className="text-blue-400 font-mono text-sm block mt-0.5">
                    <PrivacyValue value={formatINR(tax.realizedSummary.realizedStcg)} />
                  </strong>
                </div>
                <div className="bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/80">
                  <span className="text-neutral-400 block text-[11px]">Realised Debt:</span>
                  <strong className="text-purple-400 font-mono text-sm block mt-0.5">
                    <PrivacyValue value={formatINR(tax.realizedSummary.realizedDebt)} />
                  </strong>
                </div>
                <div className="bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/80">
                  <span className="text-neutral-400 block text-[11px]">Est. Realised Tax:</span>
                  <strong className="text-rose-400 font-mono text-sm block mt-0.5">
                    <PrivacyValue value={formatINR(tax.realizedSummary.realizedTaxPayable)} />
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Grandfathering Benefit Callout (if pre-2018 equity lots benefited) */}
          {(tax.grandfatheringSavingsTotal || 0) > 0 && (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-300">Section 112A Grandfathering Applied (31 Jan 2018 FMV)</h4>
                  <p className="text-[11px] text-neutral-400">
                    Grandfathering protected <strong className="text-white"><PrivacyValue value={formatINR(tax.grandfatheringSavingsTotal || 0)} /></strong> of pre-2018 equity gains from LTCG taxation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tax Harvesting Opportunity Callout */}
          {tax.taxHarvestingOpportunity > 0 && (
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-300">
                    Section 112A Tax-Gain Harvesting Opportunity
                  </h3>
                  <p className="text-xs text-neutral-300 mt-0.5">
                    You have <strong className="text-white"><PrivacyValue value={formatINR(tax.taxHarvestingOpportunity)} /></strong> in eligible Long Term Capital Gains (LTCG) that can be booked <span className="text-emerald-400 font-semibold">100% tax-free</span> under the ₹1.25 Lakh annual exemption before March 31.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3 Tax Category Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Equity LTCG Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Equity LTCG (Holding &gt; 365 Days)
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono font-bold">
                    12.5% Tax
                  </span>
                </div>

                <div className="space-y-3 mt-4 text-xs">
                  <div className="flex justify-between text-neutral-300">
                    <span>Unrealized LTCG Gains:</span>
                    <strong className="font-mono text-white"><PrivacyValue value={formatINR(tax.equityLtcg.grossGain)} /></strong>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Annual Exemption Limit (Sec 112A):</span>
                    <strong className="font-mono text-emerald-400">- <PrivacyValue value={formatINR(tax.equityLtcg.exemptLimit)} /></strong>
                  </div>
                  <div className="flex justify-between text-neutral-300 border-t border-neutral-800 pt-2 font-medium">
                    <span>Taxable LTCG:</span>
                    <strong className="font-mono text-white"><PrivacyValue value={formatINR(tax.equityLtcg.taxableGain)} /></strong>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-800 pt-4 mt-6">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-neutral-300">Estimated LTCG Tax:</span>
                  <span className="text-base font-bold text-rose-400 font-mono">
                    <PrivacyValue value={formatINR(tax.equityLtcg.taxPayable)} />
                  </span>
                </div>
              </div>
            </div>

            {/* Equity STCG Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    Equity STCG (Holding &le; 365 Days)
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono font-bold">
                    20.0% Tax
                  </span>
                </div>

                <div className="space-y-3 mt-4 text-xs">
                  <div className="flex justify-between text-neutral-300">
                    <span>Unrealized STCG Gains:</span>
                    <strong className="font-mono text-white"><PrivacyValue value={formatINR(tax.equityStcg.grossGain)} /></strong>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Exemption Applicable:</span>
                    <span className="text-neutral-500 font-mono">None (Flat 20%)</span>
                  </div>
                  <div className="flex justify-between text-neutral-300 border-t border-neutral-800 pt-2 font-medium">
                    <span>Taxable STCG:</span>
                    <strong className="font-mono text-white"><PrivacyValue value={formatINR(tax.equityStcg.grossGain)} /></strong>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-800 pt-4 mt-6">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-neutral-300">Estimated STCG Tax:</span>
                  <span className="text-base font-bold text-rose-400 font-mono">
                    <PrivacyValue value={formatINR(tax.equityStcg.taxPayable)} />
                  </span>
                </div>
              </div>
            </div>

            {/* Debt Mutual Funds Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                    Debt & Specified Funds (Sec 50AA)
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono font-bold">
                    Slab Rate (~30%)
                  </span>
                </div>

                <div className="space-y-3 mt-4 text-xs">
                  <div className="flex justify-between text-neutral-300">
                    <span>Unrealized Debt Gains:</span>
                    <strong className="font-mono text-white"><PrivacyValue value={formatINR(tax.debtGains.grossGain)} /></strong>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Indexation Benefit:</span>
                    <span className="text-neutral-500">Removed (Post Apr 2023)</span>
                  </div>
                  <div className="flex justify-between text-neutral-300 border-t border-neutral-800 pt-2 font-medium">
                    <span>Taxable Amount:</span>
                    <strong className="font-mono text-white"><PrivacyValue value={formatINR(tax.debtGains.grossGain)} /></strong>
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-800 pt-4 mt-6">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-neutral-300">Estimated Debt Tax:</span>
                  <span className="text-base font-bold text-rose-400 font-mono">
                    <PrivacyValue value={formatINR(tax.debtGains.taxPayable)} />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Legal Disclaimer Box */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 text-xs text-neutral-400 space-y-2">
            <div className="flex items-center gap-2 text-neutral-200 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Tax Disclaimer: Estimate, not for filing</span>
            </div>
            <p className="text-neutral-400">
              Tax liabilities are estimated based on Indian Finance Act 2024 rules (12.5% LTCG with ₹1.25 Lakh exemption, 20% STCG, Section 50AA slab rates). This output is an analytical estimate for portfolio planning and does not constitute formal tax advice or an official ITR schedule. Consult a Chartered Accountant for filing.
            </p>
          </div>
        </>
      ) : (
        /* Detailed FIFO Lots Audit Schedule View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['ALL', 'REALIZED', 'UNREALIZED', 'LTCG', 'STCG', 'DEBT'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                    filterType === t
                      ? 'bg-emerald-500 text-neutral-950 font-bold'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {t === 'ALL' ? 'All Lots' : t === 'REALIZED' ? 'Realised Lots' : t === 'UNREALIZED' ? 'Unrealised Lots' : t === 'LTCG' ? 'Sec 112A (LTCG)' : t === 'STCG' ? 'Sec 111A (STCG)' : 'Debt (Sec 50AA)'}
                </button>
              ))}
            </div>

            <span className="text-neutral-400 whitespace-nowrap">
              Showing <strong className="text-white">{filteredAuditRows.length}</strong> FIFO tax lots
            </span>
          </div>

          <div className="overflow-x-auto border border-neutral-800 rounded-2xl bg-neutral-950/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-800/40 text-neutral-400 border-b border-neutral-800 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Scheme & Folio</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Tax Section</th>
                  <th className="py-3 px-3 text-right">Holding Days</th>
                  <th className="py-3 px-3 text-right">Units</th>
                  <th className="py-3 px-3 text-right">Cost (₹)</th>
                  <th className="py-3 px-3 text-right">Valuation / Sale (₹)</th>
                  <th className="py-3 px-3 text-right">Gain/Loss (₹)</th>
                  <th className="py-3 px-4 text-right">Est. Tax (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono">
                {filteredAuditRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-neutral-500 font-sans">
                      No tax lots match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredAuditRows.map((r) => {
                    const isGain = r.grossGain >= 0;
                    return (
                      <tr key={r.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-4 font-sans">
                          <span className="font-semibold text-white block text-xs truncate max-w-xs">{r.schemeName}</span>
                          <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>Folio: {r.folioNumber}</span>
                            <span>•</span>
                            <span>Buy: {r.purchaseDate}</span>
                            {r.isRealized && <span>• Sold: {r.sellDate}</span>}
                            {r.grandfatheringStatus === 'FMV_MISSING' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80" title={r.grandfatheringWarning || '31-Jan-2018 FMV missing'}>
                                ⚠️ FMV Missing
                              </span>
                            )}
                            {r.grandfatheringStatus === 'APPLIED' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80" title="Section 112A 31-Jan-2018 grandfathering applied">
                                ✓ Grandfathered
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.isRealized
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}>
                            {r.isRealized ? 'Realised' : 'Unrealised'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.gainType === 'LTCG'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : r.gainType === 'STCG'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}>
                            {r.sectionCode || (r.gainType === 'LTCG' ? '112A (12.5%)' : r.gainType === 'STCG' ? '111A (20%)' : '50AA (Slab)')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-neutral-300">{r.holdingPeriodDays}d</td>
                        <td className="py-3 px-3 text-right text-neutral-300">{r.units.toFixed(3)}</td>
                        <td className="py-3 px-3 text-right text-neutral-300"><PrivacyValue value={formatINR(r.purchaseCost, true)} /></td>
                        <td className="py-3 px-3 text-right text-white font-bold"><PrivacyValue value={formatINR(r.saleValue, true)} /></td>
                        <td className={`py-3 px-3 text-right font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <PrivacyValue value={`${isGain ? '+' : ''}${formatINR(r.grossGain, true)}`} />
                        </td>
                        <td className="py-3 px-4 text-right text-rose-400 font-bold">
                          <PrivacyValue value={formatINR(r.estimatedTax, true)} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
