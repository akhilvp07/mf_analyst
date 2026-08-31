import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  Layers, 
  Check, 
  RefreshCw 
} from 'lucide-react';
import { TransactionRecord, TransactionType, MutualFundScheme } from '../types';
import { searchMutualFunds, fetchSchemeNavDetails, MfSearchResult } from '../services/mfApi';
import { SCHEMES } from '../data/mockData';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: TransactionRecord, customScheme?: MutualFundScheme) => void;
  initialSchemeCode?: string;
  initialSchemeName?: string;
  initialFolio?: string;
  existingSchemes: Record<string, MutualFundScheme>;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onAddTransaction,
  initialSchemeCode,
  initialSchemeName,
  initialFolio,
  existingSchemes
}) => {
  const [schemeCode, setSchemeCode] = useState(initialSchemeCode || '122639');
  const [schemeName, setSchemeName] = useState(initialSchemeName || 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth');
  const [folioNumber, setFolioNumber] = useState(initialFolio || 'FOLIO-101');
  const [type, setType] = useState<TransactionType>('SIP');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number>(10000);
  const [nav, setNav] = useState<number>(82.45);
  const [units, setUnits] = useState<number>(121.285);
  const [notes, setNotes] = useState<string>('');

  // Scheme search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MfSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isFetchingNav, setIsFetchingNav] = useState(false);

  useEffect(() => {
    if (initialSchemeCode) {
      setSchemeCode(initialSchemeCode);
      if (initialSchemeName) setSchemeName(initialSchemeName);
      if (initialFolio) setFolioNumber(initialFolio);
      const scheme = existingSchemes[initialSchemeCode];
      if (scheme) {
        setNav(scheme.currentNav);
        if (amount > 0 && scheme.currentNav > 0) {
          setUnits(Math.round((amount / scheme.currentNav) * 1000) / 1000);
        }
      }
    }
  }, [initialSchemeCode, initialSchemeName, initialFolio, isOpen]);

  // Debounced search for AMFI mutual funds
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchMutualFunds(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectScheme = async (res: MfSearchResult) => {
    setSchemeCode(String(res.schemeCode));
    setSchemeName(res.schemeName);
    setShowSearchResults(false);
    setSearchQuery('');

    // Fetch latest NAV from AMFI
    setIsFetchingNav(true);
    const detail = await fetchSchemeNavDetails(res.schemeCode);
    if (detail && detail.data && detail.data.length > 0) {
      const currentNav = parseFloat(detail.data[0].nav) || 100;
      setNav(currentNav);
      if (amount > 0) {
        setUnits(Math.round((amount / currentNav) * 1000) / 1000);
      }
    }
    setIsFetchingNav(false);
  };

  const handleAmountChange = (newAmount: number) => {
    setAmount(newAmount);
    if (nav > 0) {
      setUnits(Math.round((newAmount / nav) * 1000) / 1000);
    }
  };

  const handleUnitsChange = (newUnits: number) => {
    setUnits(newUnits);
    if (nav > 0) {
      setAmount(Math.round(newUnits * nav * 100) / 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      folioNumber: folioNumber.trim() || 'FOLIO-1',
      schemeCode,
      schemeName,
      type,
      date,
      units: Math.abs(Number(units)),
      nav: Math.abs(Number(nav)),
      amount: Math.abs(Number(amount)),
      status: 'COMPLETED',
      notes: notes.trim()
    };

    const customScheme: MutualFundScheme = {
      schemeCode,
      schemeName,
      fundHouse: schemeName.split(' ')[0] + ' Mutual Fund',
      category: schemeName.toLowerCase().includes('small') ? 'Equity - Small Cap' : schemeName.toLowerCase().includes('mid') ? 'Equity - Mid Cap' : 'Equity - Flexi Cap',
      currentNav: nav,
      navDate: date,
      navChange1D: 0.2,
      cagr3Y: 18.0,
      cagr5Y: 20.0,
      aumCr: 20000,
      expenseRatio: 0.65,
      isin: ''
    };

    onAddTransaction(newTx, customScheme);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Add Mutual Fund Transaction</h3>
              <p className="text-xs text-neutral-400">Record a SIP, lumpsum, or redemption entry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Scheme Selection with Search */}
          <div className="space-y-1.5 relative">
            <label className="block text-xs font-semibold text-neutral-300">
              Mutual Fund Scheme
            </label>
            <div className="relative">
              <input
                type="text"
                value={showSearchResults ? searchQuery : schemeName}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                placeholder="Search by AMC or fund name..."
                className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3.5 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                required
              />
              {isSearching && (
                <RefreshCw className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-emerald-400" />
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-neutral-800 border border-neutral-700 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-neutral-700">
                {searchResults.map((res) => (
                  <button
                    key={res.schemeCode}
                    type="button"
                    onClick={() => handleSelectScheme(res)}
                    className="w-full text-left p-2.5 hover:bg-neutral-700/80 text-xs text-neutral-200 transition flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate pr-2">{res.schemeName}</span>
                    <span className="text-[10px] text-neutral-400 font-mono shrink-0">#{res.schemeCode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Folio & Transaction Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Folio Number</label>
              <input
                type="text"
                value={folioNumber}
                onChange={(e) => setFolioNumber(e.target.value)}
                placeholder="e.g. 109283-A"
                className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-100 font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Transaction Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="SIP">SIP (Systematic Plan)</option>
                <option value="LUMPSUM">Lumpsum (One-Time)</option>
                <option value="REDEMPTION">Redemption (Sell)</option>
                <option value="SWITCH_IN">Switch-In</option>
                <option value="SWITCH_OUT">Switch-Out</option>
              </select>
            </div>
          </div>

          {/* Date & NAV */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Transaction Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-100 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1 flex items-center justify-between">
                <span>NAV (Price/Unit)</span>
                {isFetchingNav && <span className="text-[10px] text-emerald-400">Fetching...</span>}
              </label>
              <input
                type="number"
                step="0.01"
                value={nav}
                onChange={(e) => {
                  const newNav = Number(e.target.value);
                  setNav(newNav);
                  if (amount > 0 && newNav > 0) {
                    setUnits(Math.round((amount / newNav) * 1000) / 1000);
                  }
                }}
                className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-100 font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Amount & Units (Auto calculating) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Amount (INR ₹)</label>
              <input
                type="number"
                step="1"
                value={amount}
                onChange={(e) => handleAmountChange(Number(e.target.value))}
                className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">Allotted Units</label>
              <input
                type="number"
                step="0.001"
                value={units}
                onChange={(e) => handleUnitsChange(Number(e.target.value))}
                className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-200 font-mono focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly auto-debit / salary SIP"
              className="w-full text-xs bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/40 cursor-pointer"
            >
              Save Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
