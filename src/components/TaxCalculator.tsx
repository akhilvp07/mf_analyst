import React, { useMemo } from 'react';
import { 
  Receipt, 
  ShieldCheck, 
  Sparkles, 
  HelpCircle, 
  ArrowUpRight, 
  Info, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { PortfolioHolding, TransactionRecord } from '../types';
import { computeTaxLiability, formatINR } from '../utils/financialCalculations';

interface TaxCalculatorProps {
  transactions: TransactionRecord[];
  holdings: PortfolioHolding[];
}

export const TaxCalculator: React.FC<TaxCalculatorProps> = ({ transactions, holdings }) => {
  const tax = useMemo(() => computeTaxLiability(transactions, holdings), [transactions, holdings]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              Capital Gains & Indian Tax Estimator
              <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                {tax.financialYear}
              </span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Estimated tax liability calculated according to the updated Union Budget tax provisions (Equity LTCG @ 12.5% above ₹1.25L, STCG @ 20%).
            </p>
          </div>

          <div className="text-left sm:text-right bg-neutral-800/60 p-3 rounded-xl border border-neutral-700/60">
            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Total Estimated Tax</span>
            <span className="text-xl font-extrabold text-rose-400 font-mono">
              {formatINR(tax.totalEstimatedTax)}
            </span>
          </div>
        </div>
      </div>

      {/* Tax Harvesting Opportunity Callout */}
      {tax.taxHarvestingOpportunity > 0 && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-300">
                Tax-Loss / Tax-Gain Harvesting Opportunity
              </h3>
              <p className="text-xs text-neutral-300 mt-0.5">
                You have <strong className="text-white">{formatINR(tax.taxHarvestingOpportunity)}</strong> in eligible Long Term Capital Gains (LTCG) that can be booked <span className="text-emerald-400 font-semibold">100% tax-free</span> under the ₹1.25 Lakh annual exemption before the end of this financial year.
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
                <strong className="font-mono text-white">{formatINR(tax.equityLtcg.grossGain)}</strong>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Annual Exemption Limit:</span>
                <strong className="font-mono text-emerald-400">- {formatINR(tax.equityLtcg.exemptLimit)}</strong>
              </div>
              <div className="flex justify-between text-neutral-300 border-t border-neutral-800 pt-2 font-medium">
                <span>Taxable LTCG:</span>
                <strong className="font-mono text-white">{formatINR(tax.equityLtcg.taxableGain)}</strong>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-4 mt-6">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-neutral-300">Estimated LTCG Tax:</span>
              <span className="text-base font-bold text-rose-400 font-mono">
                {formatINR(tax.equityLtcg.taxPayable)}
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
                <strong className="font-mono text-white">{formatINR(tax.equityStcg.grossGain)}</strong>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Exemption Applicable:</span>
                <span className="text-neutral-500 font-mono">None (Flat 20%)</span>
              </div>
              <div className="flex justify-between text-neutral-300 border-t border-neutral-800 pt-2 font-medium">
                <span>Taxable STCG:</span>
                <strong className="font-mono text-white">{formatINR(tax.equityStcg.grossGain)}</strong>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-4 mt-6">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-neutral-300">Estimated STCG Tax:</span>
              <span className="text-base font-bold text-rose-400 font-mono">
                {formatINR(tax.equityStcg.taxPayable)}
              </span>
            </div>
          </div>
        </div>

        {/* Debt Mutual Funds Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Debt Funds (Post Apr 2023)
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono font-bold">
                Slab Rate (~30%)
              </span>
            </div>

            <div className="space-y-3 mt-4 text-xs">
              <div className="flex justify-between text-neutral-300">
                <span>Unrealized Debt Gains:</span>
                <strong className="font-mono text-white">{formatINR(tax.debtGains.grossGain)}</strong>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Indexation Benefit:</span>
                <span className="text-neutral-500">Removed</span>
              </div>
              <div className="flex justify-between text-neutral-300 border-t border-neutral-800 pt-2 font-medium">
                <span>Taxable Amount:</span>
                <strong className="font-mono text-white">{formatINR(tax.debtGains.grossGain)}</strong>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-800 pt-4 mt-6">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-neutral-300">Estimated Debt Tax:</span>
              <span className="text-base font-bold text-rose-400 font-mono">
                {formatINR(tax.debtGains.taxPayable)}
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
    </div>
  );
};
