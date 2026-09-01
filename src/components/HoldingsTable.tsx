import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Layers, 
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { PortfolioHolding } from '../types';
import { formatINR } from '../utils/financialCalculations';

interface HoldingsTableProps {
  holdings: PortfolioHolding[];
  onViewTransactions: (schemeCode: string) => void;
  onSyncSingleNav: (schemeCode: string, schemeName?: string, isin?: string) => Promise<any> | void;
}

type SortField = 'currentValue' | 'totalGain' | 'totalGainPercentage' | 'dayGain' | 'xirr' | 'schemeName' | 'allocationPercentage';

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  holdings,
  onViewTransactions,
  onSyncSingleNav
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('currentValue');
  const [sortAsc, setSortAsc] = useState(false);
  const [syncingCode, setSyncingCode] = useState<string | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    holdings.forEach(h => set.add(h.category));
    return ['ALL', ...Array.from(set)];
  }, [holdings]);

  // Filter & Sort Holdings
  const filteredHoldings = useMemo(() => {
    return holdings
      .filter(h => {
        const matchesSearch = 
          h.schemeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.fundHouse.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.folioNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (h.planType && h.planType.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (h.schemeCode && h.schemeCode.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesCat = categoryFilter === 'ALL' || h.category === categoryFilter;
        return matchesSearch && matchesCat;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (typeof valA === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [holdings, searchQuery, categoryFilter, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleSyncNav = async (schemeCode: string, schemeName?: string, isin?: string) => {
    setSyncingCode(schemeCode);
    try {
      await onSyncSingleNav(schemeCode, schemeName, isin);
    } finally {
      setTimeout(() => setSyncingCode(null), 600);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            id="holdings-search-input"
            type="text"
            placeholder="Search fund name, AMC, folio, or Direct/Regular..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-800 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1 bg-neutral-800/80 p-1 rounded-xl border border-neutral-700 text-xs shrink-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition cursor-pointer font-medium ${
                  categoryFilter === cat
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {cat === 'ALL' ? 'All Categories' : cat.replace('Equity - ', '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-800/70 border-b border-neutral-800 text-neutral-400 font-semibold uppercase tracking-wider">
                <th 
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('schemeName')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Scheme, Plan & Folio</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-3 text-right">Units & Avg NAV</th>
                <th className="py-3.5 px-3 text-right">Current NAV</th>
                <th 
                  className="py-3.5 px-3 text-right cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('currentValue')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Current Value</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="py-3.5 px-3 text-right cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('totalGain')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Total Gain / ROI</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="py-3.5 px-3 text-right cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('xirr')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>XIRR</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th 
                  className="py-3.5 px-3 text-right cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('allocationPercentage')}
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Allocation</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
              {filteredHoldings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-neutral-400">
                    <Layers className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
                    <p className="font-semibold text-neutral-300">No mutual fund holdings found</p>
                    <p className="text-xs text-neutral-500 mt-1">Try resetting your search filters or import CAS statement.</p>
                  </td>
                </tr>
              ) : (
                filteredHoldings.map((holding) => {
                  const isProfit = holding.totalGain >= 0;
                  const isDayUp = holding.navChange1D >= 0;
                  const isSyncing = syncingCode === holding.schemeCode;
                  const plan = holding.planType || 'Direct';
                  const option = holding.optionType || 'Growth';

                  return (
                    <tr 
                      key={`${holding.schemeCode}_${holding.folioNumber}`}
                      onClick={() => onViewTransactions(holding.schemeCode)}
                      className="hover:bg-neutral-800/40 transition group cursor-pointer"
                      title="Click to view transactions in ledger"
                    >
                      {/* Scheme & Folio */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-neutral-100 group-hover:text-emerald-400 transition text-sm">
                            {holding.schemeName}
                          </span>
                          
                          {/* Plan Badge */}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            plan === 'Regular'
                              ? 'bg-amber-950/70 text-amber-300 border border-amber-800/80'
                              : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                          }`}>
                            {plan}
                          </span>

                          {/* Option Badge */}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-800 border border-neutral-700 text-neutral-300">
                            {option}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-1">
                          <span>AMC: <strong className="text-neutral-300">{holding.fundHouse}</strong></span>
                          <span>•</span>
                          <span>Code: <strong className="font-mono text-neutral-300">#{holding.schemeCode}</strong></span>
                          <span>•</span>
                          <span>Folio: <strong className="font-mono text-neutral-300">{holding.folioNumber}</strong></span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-neutral-800 border border-neutral-700 text-neutral-300">
                          {holding.category}
                        </span>
                      </td>

                      {/* Units & Avg Buy NAV */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-mono font-medium text-neutral-200">
                          {holding.units.toFixed(3)} units
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Avg: ₹{holding.avgBuyNav.toFixed(2)}
                        </div>
                      </td>

                      {/* Current Live NAV */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-neutral-100 flex items-center justify-end gap-1.5">
                          <span>₹{holding.currentNav >= 1000 ? holding.currentNav.toFixed(2) : Number.isInteger(holding.currentNav) ? holding.currentNav.toFixed(2) : holding.currentNav.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}</span>
                          <button
                            id={`sync-holding-${holding.schemeCode}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSyncNav(holding.schemeCode, holding.schemeName, holding.isin);
                            }}
                            title="Sync live NAV from AMFI"
                            className="text-neutral-500 hover:text-emerald-400 p-0.5 rounded cursor-pointer transition"
                          >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                          </button>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-[11px] font-medium mt-0.5">
                          <span className={isDayUp ? 'text-emerald-400' : 'text-rose-400'}>
                            {isDayUp ? '+' : ''}{holding.navChange1D.toFixed(2)}% (1D)
                          </span>
                          {holding.navDate && (
                            <span className="text-neutral-500 text-[10px]">
                              • {new Date(holding.navDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Current Value & Invested */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-bold text-white text-sm font-mono">
                          {formatINR(holding.currentValue)}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          Inv: {formatINR(holding.investedAmount, true)}
                        </div>
                      </td>

                      {/* Total Profit / ROI */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className={`font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}{formatINR(holding.totalGain)}
                        </div>
                        <div className={`text-[11px] font-semibold flex items-center justify-end ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                          {isProfit ? '+' : ''}{holding.totalGainPercentage.toFixed(2)}%
                        </div>
                      </td>

                      {/* XIRR */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md font-bold font-mono text-xs bg-teal-500/10 text-teal-300 border border-teal-500/20">
                          {holding.xirr > 0 ? `+${holding.xirr.toFixed(2)}%` : `${holding.xirr.toFixed(2)}%`}
                        </span>
                      </td>

                      {/* Allocation % */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="font-semibold text-neutral-300">
                          {holding.allocationPercentage.toFixed(1)}%
                        </div>
                        <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden ml-auto mt-1">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, holding.allocationPercentage * 2.5)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
