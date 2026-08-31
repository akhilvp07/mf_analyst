import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  Plus, 
  Trash2, 
  Calendar, 
  Receipt, 
  Download, 
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Layers,
  ChevronDown
} from 'lucide-react';
import { TransactionRecord, TransactionType } from '../types';
import { formatINR } from '../utils/financialCalculations';
import { exportTransactionsToCsv } from '../services/portfolioStorage';

interface TransactionLedgerProps {
  transactions: TransactionRecord[];
  onOpenAddModal: (schemeCode?: string, schemeName?: string, folio?: string) => void;
  onDeleteTransaction: (id: string) => void;
  selectedSchemeFilter?: string;
  onClearSchemeFilter?: () => void;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  transactions,
  onOpenAddModal,
  onDeleteTransaction,
  selectedSchemeFilter,
  onClearSchemeFilter
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [sortAsc, setSortAsc] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50); // Virtualized window batching

  // Filter & sort
  const filteredTxs = useMemo(() => {
    return transactions
      .filter(tx => {
        const matchesSearch = 
          tx.schemeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.folioNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tx.schemeCode.includes(searchQuery);

        const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
        const matchesScheme = !selectedSchemeFilter || tx.schemeCode === selectedSchemeFilter;

        return matchesSearch && matchesType && matchesScheme;
      })
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return sortAsc ? timeA - timeB : timeB - timeA;
      });
  }, [transactions, searchQuery, typeFilter, selectedSchemeFilter, sortAsc]);

  // Totals for current filter
  const totals = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let units = 0;

    filteredTxs.forEach(tx => {
      if (tx.type === 'REDEMPTION' || tx.type === 'SWITCH_OUT') {
        outflow += tx.amount;
        units -= tx.units;
      } else {
        inflow += tx.amount;
        units += tx.units;
      }
    });

    return { inflow, outflow, netUnits: units, count: filteredTxs.length };
  }, [filteredTxs]);

  const handleExportCsv = () => {
    const csvContent = exportTransactionsToCsv(filteredTxs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `mftracker_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const displayedTxs = filteredTxs.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      {/* Ledger Stats Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Total Inflow (Invested)</span>
            <div className="text-xl font-bold text-white mt-1">{formatINR(totals.inflow)}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Total Outflow (Redeemed)</span>
            <div className="text-xl font-bold text-neutral-200 mt-1">{formatINR(totals.outflow)}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Total Transactions</span>
            <div className="text-xl font-bold text-teal-400 mt-1">{totals.count} records</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Scheme Filter Active Alert */}
      {selectedSchemeFilter && (
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Filtering transactions for Scheme Code: <strong>{selectedSchemeFilter}</strong></span>
          </div>
          <button
            onClick={onClearSchemeFilter}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-medium cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            id="tx-search-input"
            type="text"
            placeholder="Search scheme name, folio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-neutral-800/80 p-1 rounded-xl border border-neutral-700 text-xs shrink-0">
            {['ALL', 'SIP', 'LUMPSUM', 'REDEMPTION', 'SWITCH_IN'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer font-medium ${
                  typeFilter === t
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            title="Download CSV statement"
            className="px-3 py-2 text-xs font-medium rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {/* Add Tx */}
          <button
            onClick={() => onOpenAddModal()}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-sm shadow-emerald-900/40 cursor-pointer shrink-0 ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Transaction</span>
          </button>
        </div>
      </div>

      {/* Transaction List Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-800/70 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider">
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition"
                  onClick={() => setSortAsc(!sortAsc)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Scheme & Folio</th>
                <th className="py-3.5 px-3">Type</th>
                <th className="py-3.5 px-3 text-right">Units</th>
                <th className="py-3.5 px-3 text-right">NAV</th>
                <th className="py-3.5 px-4 text-right">Amount (INR)</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
              {displayedTxs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <Receipt className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
                    <p className="font-semibold text-neutral-300">No transactions recorded</p>
                    <p className="text-xs text-neutral-500 mt-1">Add your first SIP or lumpsum purchase to start tracking.</p>
                  </td>
                </tr>
              ) : (
                displayedTxs.map((tx) => {
                  const isRedemption = tx.type === 'REDEMPTION' || tx.type === 'SWITCH_OUT';
                  return (
                    <tr key={tx.id} className="hover:bg-neutral-800/40 transition">
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-neutral-300 font-medium">{tx.date}</div>
                      </td>

                      {/* Scheme & Folio */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-neutral-100 max-w-xs truncate" title={tx.schemeName}>
                          {tx.schemeName}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                          Folio: {tx.folioNumber}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.type === 'SIP' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : tx.type === 'LUMPSUM'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : tx.type === 'REDEMPTION'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}>
                          {tx.type}
                        </span>
                      </td>

                      {/* Units */}
                      <td className="py-3.5 px-3 text-right font-mono font-medium text-neutral-300 whitespace-nowrap">
                        {isRedemption ? '-' : '+'}{tx.units.toFixed(3)}
                      </td>

                      {/* NAV */}
                      <td className="py-3.5 px-3 text-right font-mono text-neutral-300 whitespace-nowrap">
                        ₹{tx.nav.toFixed(2)}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-bold">
                        <span className={isRedemption ? 'text-blue-400' : 'text-emerald-400'}>
                          {isRedemption ? '-' : '+'}{formatINR(tx.amount)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-md">
                          {tx.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          title="Delete transaction"
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 border border-neutral-700 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Virtualized Load More */}
        {filteredTxs.length > visibleCount && (
          <div className="p-4 border-t border-neutral-800 text-center bg-neutral-800/20">
            <button
              onClick={() => setVisibleCount(prev => prev + 50)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 transition cursor-pointer"
            >
              Showing {visibleCount} of {filteredTxs.length} transactions. Click to load 50 more
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
