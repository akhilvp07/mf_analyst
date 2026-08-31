import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { PortfolioOverview } from './components/PortfolioOverview';
import { HoldingsTable } from './components/HoldingsTable';
import { TransactionLedger } from './components/TransactionLedger';
import { PortfolioInsights } from './components/PortfolioInsights';
import { TaxCalculator } from './components/TaxCalculator';
import { SipSimulator } from './components/SipSimulator';
import { CasImporter } from './components/CasImporter';
import { GoogleHostingAndPerf } from './components/GoogleHostingAndPerf';
import { AddTransactionModal } from './components/AddTransactionModal';

import { TransactionRecord, MutualFundScheme, PortfolioHolding, PortfolioSummary } from './types';
import { 
  loadStoredTransactions, 
  saveStoredTransactions, 
  loadSchemeCatalog, 
  saveCustomScheme,
  generateDemoTransactions 
} from './services/portfolioStorage';
import { batchFetchLatestNavs } from './services/mfApi';
import { computePortfolioHoldings } from './utils/financialCalculations';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [schemes, setSchemes] = useState<Record<string, MutualFundScheme>>({});
  const [isSyncingNavs, setIsSyncingNavs] = useState<boolean>(false);
  const [ledgerSchemeFilter, setLedgerSchemeFilter] = useState<string | undefined>(undefined);

  // Add Transaction Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [modalInitialSchemeCode, setModalInitialSchemeCode] = useState<string | undefined>(undefined);
  const [modalInitialSchemeName, setModalInitialSchemeName] = useState<string | undefined>(undefined);
  const [modalInitialFolio, setModalInitialFolio] = useState<string | undefined>(undefined);

  // Load initial data on mount
  useEffect(() => {
    const loadedTxs = loadStoredTransactions();
    const loadedSchemes = loadSchemeCatalog();
    setTransactions(loadedTxs);
    setSchemes(loadedSchemes);
  }, []);

  // Compute live portfolio holdings and summary metrics whenever transactions or schemes change
  const { holdings, summary } = useMemo(() => {
    return computePortfolioHoldings(transactions, schemes);
  }, [transactions, schemes]);

  // Sync latest NAVs from AMFI API
  const handleSyncAllNavs = useCallback(async () => {
    const uniqueCodes: string[] = Array.from(new Set(transactions.map(t => t.schemeCode)));
    if (uniqueCodes.length === 0) return;

    setIsSyncingNavs(true);
    try {
      const navUpdates = await batchFetchLatestNavs(uniqueCodes);
      setSchemes(prev => {
        const next = { ...prev };
        Object.entries(navUpdates).forEach(([code, update]) => {
          if (next[code]) {
            next[code] = {
              ...next[code],
              currentNav: update.currentNav,
              navDate: update.navDate,
              navChange1D: update.navChange1D
            };
            saveCustomScheme(next[code]);
          }
        });
        return next;
      });
    } catch (err) {
      console.warn('Error syncing NAVs:', err);
    } finally {
      setIsSyncingNavs(false);
    }
  }, [transactions]);

  // Sync a single scheme NAV
  const handleSyncSingleNav = useCallback(async (schemeCode: string) => {
    const navUpdates = await batchFetchLatestNavs([schemeCode]);
    if (navUpdates[schemeCode]) {
      const update = navUpdates[schemeCode];
      setSchemes(prev => {
        const next = { ...prev };
        if (next[schemeCode]) {
          next[schemeCode] = {
            ...next[schemeCode],
            currentNav: update.currentNav,
            navDate: update.navDate,
            navChange1D: update.navChange1D
          };
          saveCustomScheme(next[schemeCode]);
        }
        return next;
      });
    }
  }, []);

  // Add new transaction handler
  const handleAddTransaction = useCallback((newTx: TransactionRecord, customScheme?: MutualFundScheme) => {
    setTransactions(prev => {
      const updated = [newTx, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });

    if (customScheme) {
      setSchemes(prev => {
        const updated = { ...prev, [customScheme.schemeCode]: customScheme };
        saveCustomScheme(customScheme);
        return updated;
      });
    }
  }, []);

  // Delete transaction handler
  const handleDeleteTransaction = useCallback((txId: string) => {
    setTransactions(prev => {
      const updated = prev.filter(t => t.id !== txId);
      saveStoredTransactions(updated);
      return updated;
    });
  }, []);

  // Delete all transactions for a holding
  const handleDeleteHolding = useCallback((schemeCode: string, folioNumber: string) => {
    if (window.confirm(`Are you sure you want to remove this scheme and its transactions from your portfolio?`)) {
      setTransactions(prev => {
        const updated = prev.filter(t => !(t.schemeCode === schemeCode && t.folioNumber === folioNumber));
        saveStoredTransactions(updated);
        return updated;
      });
    }
  }, []);

  // Import transactions from CAS statement
  const handleImportTransactions = useCallback((imported: TransactionRecord[], replaceExisting: boolean, newSchemes?: Record<string, MutualFundScheme>) => {
    setTransactions(prev => {
      const updated = replaceExisting ? imported : [...imported, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });
    if (newSchemes && Object.keys(newSchemes).length > 0) {
      setSchemes(prev => {
        const updated = { ...prev, ...newSchemes };
        Object.values(newSchemes).forEach(s => saveCustomScheme(s));
        return updated;
      });
    }
    setActiveTab('overview');
  }, []);

  // Reset to Demo Portfolio
  const handleResetDemoData = useCallback(() => {
    const demo = generateDemoTransactions();
    setTransactions(demo);
    saveStoredTransactions(demo);
    setActiveTab('overview');
  }, []);

  // Open modal with pre-filled scheme info
  const handleOpenAddModal = (code?: string, name?: string, folio?: string) => {
    setModalInitialSchemeCode(code);
    setModalInitialSchemeName(name);
    setModalInitialFolio(folio);
    setIsAddModalOpen(true);
  };

  // Jump to Ledger with scheme filter
  const handleViewSchemeLedger = (schemeCode: string) => {
    setLedgerSchemeFilter(schemeCode);
    setActiveTab('transactions');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans antialiased selection:bg-emerald-900 selection:text-emerald-100">
      {/* Header with Market Ticker & Tab Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        summary={summary}
        isSyncingNavs={isSyncingNavs}
        onSyncNavs={handleSyncAllNavs}
        onOpenAddModal={() => handleOpenAddModal()}
        onOpenImport={() => setActiveTab('import')}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <PortfolioOverview
            summary={summary}
            holdings={holdings}
            onNavigateTab={setActiveTab}
            onOpenAddModal={() => handleOpenAddModal()}
            onOpenImport={() => setActiveTab('import')}
          />
        )}

        {activeTab === 'holdings' && (
          <HoldingsTable
            holdings={holdings}
            onOpenAddModal={handleOpenAddModal}
            onViewTransactions={handleViewSchemeLedger}
            onDeleteHolding={handleDeleteHolding}
            onSyncSingleNav={handleSyncSingleNav}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionLedger
            transactions={transactions}
            onOpenAddModal={handleOpenAddModal}
            onDeleteTransaction={handleDeleteTransaction}
            selectedSchemeFilter={ledgerSchemeFilter}
            onClearSchemeFilter={() => setLedgerSchemeFilter(undefined)}
          />
        )}

        {activeTab === 'insights' && (
          <PortfolioInsights holdings={holdings} />
        )}

        {activeTab === 'tax' && (
          <TaxCalculator transactions={transactions} holdings={holdings} />
        )}

        {activeTab === 'simulator' && (
          <SipSimulator />
        )}

        {activeTab === 'import' && (
          <CasImporter
            transactions={transactions}
            schemes={schemes}
            onImportTransactions={handleImportTransactions}
            onResetDemoData={handleResetDemoData}
          />
        )}

        {activeTab === 'google-cloud' && (
          <GoogleHostingAndPerf />
        )}
      </main>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddTransaction={handleAddTransaction}
        initialSchemeCode={modalInitialSchemeCode}
        initialSchemeName={modalInitialSchemeName}
        initialFolio={modalInitialFolio}
        existingSchemes={schemes}
      />
    </div>
  );
}
