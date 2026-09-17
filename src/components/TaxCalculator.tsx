import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  Sparkles, 
  Info, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  Calendar, 
  CheckCircle2, 
  Layers
} from 'lucide-react';
import { PortfolioHolding, TransactionRecord, CapitalGainsAuditRow } from '../types';
import { computeTaxLiability, formatINR, isEquityOrientedScheme } from '../utils/financialCalculations';
import { PrivacyValue } from '../context/PrivacyContext';

interface TaxCalculatorProps {
  transactions: TransactionRecord[];
  holdings: PortfolioHolding[];
}

export const TaxCalculator: React.FC<TaxCalculatorProps> = ({ transactions, holdings }) => {
  const [selectedFy, setSelectedFy] = useState<string>('FY 2024-25');
  const [activeView, setActiveView] = useState<'summary' | 'audit_schedule'>('summary');
  const [filterType, setFilterType] = useState<'ALL' | 'LTCG' | 'STCG' | 'DEBT'>('ALL');

  const tax = useMemo(() => computeTaxLiability(transactions, holdings), [transactions, holdings]);

  // Generate granular Capital Gains Audit Schedule Rows for ITR Filing
  const auditScheduleRows = useMemo((): CapitalGainsAuditRow[] => {
    const rows: CapitalGainsAuditRow[] = [];
    const today = new Date();

    // 1. Process Unrealized Holdings
    holdings.forEach((h, hIdx) => {
      const isEquity = isEquityOrientedScheme(h.category, h.schemeName);
      
      // Look at transactions for this scheme to determine acquisition dates
      const schemeTxs = transactions
        .filter(t => t.schemeCode === h.schemeCode && (t.type === 'SIP' || t.type === 'LUMPSUM' || t.type === 'SWITCH_IN' || t.type === 'DIVIDEND_REINVEST'))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (schemeTxs.length === 0) {
        // Fallback to holding aggregate
        const holdingPeriodDays = Math.max(1, Math.round((today.getTime() - new Date(h.lastTransactionDate || '2023-01-01').getTime()) / (1000 * 60 * 60 * 24)));
        const isLtcg = isEquity && holdingPeriodDays > 365;
        const gainType = !isEquity ? 'DEBT_SLAB' : isLtcg ? 'LTCG' : 'STCG';
        const gain = h.currentValue - h.investedAmount;
        const taxRate = !isEquity ? 30 : isLtcg ? 12.5 : 20;

        rows.push({
          id: `unrealized_${h.schemeCode}_${hIdx}`,
          isin: h.isin || 'N/A',
          schemeCode: h.schemeCode,
          schemeName: h.schemeName,
          folioNumber: h.folioNumber || 'N/A',
          assetClass: isEquity ? 'EQUITY' : 'DEBT',
          holdingPeriodDays,
          gainType,
          purchaseDate: h.lastTransactionDate || 'N/A',
          sellDate: 'Unrealized (Valuation)',
          isRealized: false,
          units: h.units,
          buyNav: h.avgBuyNav,
          sellNav: h.currentNav,
          purchaseCost: h.investedAmount,
          saleValue: h.currentValue,
          grossGain: gain,
          taxableGain: isLtcg ? Math.max(0, gain) : gain,
          applicableTaxRatePct: taxRate,
          estimatedTax: Math.max(0, gain) * (taxRate / 100)
        });
      } else {
        // Detailed FIFO / Lot level breakdown
        schemeTxs.forEach((tx, txIdx) => {
          const buyDate = new Date(tx.date);
          const days = Math.max(1, Math.round((today.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)));
          const isLtcg = isEquity && days > 365;
          const gainType = !isEquity ? 'DEBT_SLAB' : isLtcg ? 'LTCG' : 'STCG';
          
          const lotCost = tx.amount;
          const lotValue = tx.units * h.currentNav;
          const lotGain = lotValue - lotCost;
          const taxRate = !isEquity ? 30 : isLtcg ? 12.5 : 20;

          rows.push({
            id: `lot_${h.schemeCode}_${tx.id || txIdx}`,
            isin: h.isin || 'N/A',
            schemeCode: h.schemeCode,
            schemeName: h.schemeName,
            folioNumber: tx.folioNumber || h.folioNumber || 'N/A',
            assetClass: isEquity ? 'EQUITY' : 'DEBT',
            holdingPeriodDays: days,
            gainType,
            purchaseDate: tx.date,
            sellDate: 'Unrealized (Valuation)',
            isRealized: false,
            units: tx.units,
            buyNav: tx.nav,
            sellNav: h.currentNav,
            purchaseCost: lotCost,
            saleValue: lotValue,
            grossGain: lotGain,
            taxableGain: lotGain,
            applicableTaxRatePct: taxRate,
            estimatedTax: Math.max(0, lotGain) * (taxRate / 100)
          });
        });
      }
    });

    return rows;
  }, [holdings, transactions]);

  // Filtered rows for audit schedule table
  const filteredAuditRows = useMemo(() => {
    if (filterType === 'ALL') return auditScheduleRows;
    return auditScheduleRows.filter(r => r.gainType === filterType || (filterType === 'DEBT' && r.gainType === 'DEBT_SLAB'));
  }, [auditScheduleRows, filterType]);

  // Export ITR Schedule 112A / 111A Capital Gains CSV
  const handleExportItrCsv = () => {
    const headers = [
      'ISIN',
      'Scheme Name',
      'Folio Number',
      'Asset Class',
      'Tax Section',
      'Date of Acquisition',
      'Date of Valuation/Sale',
      'Holding Period (Days)',
      'Units',
      'Buy NAV (Rs)',
      'Sale/Current NAV (Rs)',
      'Cost of Acquisition (Rs)',
      'Full Value of Consideration (Rs)',
      'Gross Capital Gain/Loss (Rs)',
      'Tax Rate (%)',
      'Estimated Tax Payable (Rs)'
    ];

    const rows = auditScheduleRows.map(r => [
      `"${r.isin}"`,
      `"${r.schemeName.replace(/"/g, '""')}"`,
      `"${r.folioNumber}"`,
      `"${r.assetClass}"`,
      `"${r.gainType === 'LTCG' ? 'Sec 112A (LTCG)' : r.gainType === 'STCG' ? 'Sec 111A (STCG)' : 'Sec 50AA (Debt)'}"`,
      `"${r.purchaseDate}"`,
      `"${r.sellDate}"`,
      r.holdingPeriodDays,
      r.units.toFixed(4),
      r.buyNav.toFixed(4),
      r.sellNav.toFixed(4),
      r.purchaseCost.toFixed(2),
      r.saleValue.toFixed(2),
      r.grossGain.toFixed(2),
      r.applicableTaxRatePct,
      r.estimatedTax.toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `MFTracker_ITR_Schedule_112A_${selectedFy.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintAudit = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">
                Capital Gains & Indian Tax Estimator
              </h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Budget 2024 (12.5% LTCG / 20% STCG)
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Automated Schedule 112A (Equity LTCG), Section 111A (STCG), and Section 50AA (Debt) computation with grandfathering support.
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

            {/* 1-Click Export CSV */}
            <button
              onClick={handleExportItrCsv}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Download Schedule 112A Tax Excel/CSV workbook"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export ITR Schedule</span>
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
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-neutral-800">
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
            <span>Detailed ITR Audit Schedule ({auditScheduleRows.length} Lots)</span>
          </button>
        </div>
      </div>

      {activeView === 'summary' ? (
        <>
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
                    You have <strong className="text-white"><PrivacyValue value={formatINR(tax.taxHarvestingOpportunity)} /></strong> in eligible Long Term Capital Gains (LTCG) that can be redeemed and reinvested <span className="text-emerald-400 font-semibold">100% tax-free</span> under the ₹1.25 Lakh annual exemption before March 31.
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
                    Equity LTCG (Holding &gt; 12m)
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
                    Equity STCG (Holding &le; 12m)
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
                    Debt Funds (Sec 50AA)
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

          {/* Rules Information Box */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 text-xs text-neutral-400 space-y-2">
            <div className="flex items-center gap-2 text-neutral-200 font-bold">
              <Info className="w-4 h-4 text-teal-400" />
              <span>Indian Mutual Fund Tax Rules Reference (Finance Act 2024)</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-neutral-400 pl-2">
              <li><strong>Equity Mutual Funds:</strong> Funds with &gt;= 65% domestic equity exposure. LTCG applies after 12 months at 12.5% with ₹1.25 Lakh exemption. STCG applies within 12 months at 20%.</li>
              <li><strong>Tax Harvesting:</strong> Redeeming and immediately reinvesting up to ₹1.25 Lakh of long-term gains every financial year resets your purchase NAV higher, legally saving taxes in future years.</li>
              <li><strong>Grandfathering:</strong> Gains made on equity funds up to January 31, 2018 remain grandfathered and fully exempt from LTCG.</li>
            </ul>
          </div>
        </>
      ) : (
        /* Detailed ITR Audit Schedule View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900 p-4 rounded-xl border border-neutral-800 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['ALL', 'LTCG', 'STCG', 'DEBT'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    filterType === t
                      ? 'bg-emerald-500 text-neutral-950 font-bold'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {t === 'ALL' ? 'All Tax Lots' : t === 'LTCG' ? 'Sec 112A (LTCG)' : t === 'STCG' ? 'Sec 111A (STCG)' : 'Debt (Sec 50AA)'}
                </button>
              ))}
            </div>

            <span className="text-neutral-400">
              Showing <strong className="text-white">{filteredAuditRows.length}</strong> tax lots
            </span>
          </div>

          <div className="overflow-x-auto border border-neutral-800 rounded-2xl bg-neutral-950/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-800/40 text-neutral-400 border-b border-neutral-800 text-[11px]">
                <tr>
                  <th className="py-3 px-4">Scheme & Folio</th>
                  <th className="py-3 px-3">Tax Section</th>
                  <th className="py-3 px-3 text-right">Holding Days</th>
                  <th className="py-3 px-3 text-right">Units</th>
                  <th className="py-3 px-3 text-right">Cost (₹)</th>
                  <th className="py-3 px-3 text-right">Valuation (₹)</th>
                  <th className="py-3 px-3 text-right">Gain/Loss (₹)</th>
                  <th className="py-3 px-4 text-right">Est. Tax (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono">
                {filteredAuditRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-neutral-500">
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
                          <span className="text-[10px] text-neutral-500 font-mono">Folio: {r.folioNumber} • Buy: {r.purchaseDate}</span>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.gainType === 'LTCG'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : r.gainType === 'STCG'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}>
                            {r.gainType === 'LTCG' ? '112A (12.5%)' : r.gainType === 'STCG' ? '111A (20%)' : '50AA (Slab)'}
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
