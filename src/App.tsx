import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { PortfolioOverview } from './components/PortfolioOverview';
import { HoldingsTable } from './components/HoldingsTable';
import { TransactionLedger } from './components/TransactionLedger';
import { PortfolioInsights } from './components/PortfolioInsights';
import { GoalTracker } from './components/GoalTracker';
import { TaxCalculator } from './components/TaxCalculator';
import { SipSimulator } from './components/SipSimulator';
import { CasImporter } from './components/CasImporter';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { PrivacyProvider } from './context/PrivacyContext';

import { TransactionRecord, MutualFundScheme } from './types';
import { 
  loadStoredTransactions, 
  saveStoredTransactions, 
  loadSchemeCatalog, 
  saveAllSchemes
} from './services/portfolioStorage';
import { 
  loadCachedPortfolio, 
  persistPortfolioToIndexedDb 
} from './services/indexedDbCache';
import { syncSchemesForHoldings, SchemeSyncTarget } from './services/mfApi';
import { computePortfolioHoldings, mergeTransactions } from './utils/financialCalculations';
import { loadAmfiNavDatabase } from './services/amfiNavService';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<ActiveTab>>(() => new Set<ActiveTab>(['overview']));
  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => loadStoredTransactions());
  const [schemes, setSchemes] = useState<Record<string, MutualFundScheme>>(() => loadSchemeCatalog());
  const [isSyncingNavs, setIsSyncingNavs] = useState<boolean>(false);
  const [ledgerSchemeFilter, setLedgerSchemeFilter] = useState<string | undefined>(undefined);
  const [syncToast, setSyncToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Fast zero-delay tab switching
  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  // Load initial SWR data on mount and trigger auto-sync
  useEffect(() => {
    // 1. Instant background attempt from IndexedDB SWR cache
    loadCachedPortfolio().then((cached) => {
      if (cached && cached.transactions.length > 0) {
        setTransactions(cached.transactions);
        if (Object.keys(cached.schemes).length > 0) {
          setSchemes(cached.schemes);
        }
      }
    });

    // 2. Preload official AMFI master database in the background
    loadAmfiNavDatabase().catch(() => {});

    const loadedTxs = loadStoredTransactions();
    const loadedSchemes = loadSchemeCatalog();
    setTransactions(loadedTxs);
    setSchemes(loadedSchemes);

    if (loadedTxs.length > 0) {
      // Collect unique scheme targets strictly from active transactions
      const targetMap = new Map<string, SchemeSyncTarget>();
      loadedTxs.forEach(t => {
        if (!targetMap.has(t.schemeCode)) {
          targetMap.set(t.schemeCode, {
            schemeCode: t.schemeCode,
            schemeName: t.schemeName,
            folioNumber: t.folioNumber,
            planType: t.planType,
            optionType: t.optionType,
            isin: loadedSchemes[t.schemeCode]?.isin
          });
        }
      });

      const targets = Array.from(targetMap.values());
      syncSchemesForHoldings(targets, { forceRefresh: false })
        .then(({ updatedSchemes, codeMigrations }) => {
          if (Object.keys(updatedSchemes).length > 0) {
            setSchemes(prev => {
              const next = { ...prev, ...updatedSchemes };
              saveAllSchemes(next);
              persistPortfolioToIndexedDb(loadedTxs, next);
              return next;
            });
          }
          if (Object.keys(codeMigrations).length > 0) {
            setTransactions(prev => {
              let hasChanges = false;
              const nextTxs = prev.map(tx => {
                const newCode = codeMigrations[tx.schemeCode];
                if (newCode && newCode !== tx.schemeCode) {
                  hasChanges = true;
                  const resolved = updatedSchemes[newCode];
                  return {
                    ...tx,
                    schemeCode: newCode,
                    schemeName: resolved?.schemeName || tx.schemeName
                  };
                }
                return tx;
              });
              if (hasChanges) {
                saveStoredTransactions(nextTxs);
                persistPortfolioToIndexedDb(nextTxs, loadedSchemes);
                return nextTxs;
              }
              return prev;
            });
          }
        })
        .catch(err => console.warn('Background NAV sync failed:', err));
    }
  }, []);

  // Compute live portfolio holdings and summary metrics whenever transactions or schemes change
  const { holdings, summary } = useMemo(() => {
    return computePortfolioHoldings(transactions, schemes);
  }, [transactions, schemes]);

  // Sync latest NAVs from AMFI API strictly for active portfolio holdings
  const handleSyncAllNavs = useCallback(async () => {
    const targetMap = new Map<string, SchemeSyncTarget>();
    
    // Priority 1: Synchronize only the schemes present in the active portfolio holdings
    holdings.forEach(h => {
      const code = h.schemeCode;
      if (!targetMap.has(code)) {
        targetMap.set(code, {
          schemeCode: code,
          schemeName: h.schemeName,
          folioNumber: h.folioNumber,
          planType: h.planType,
          isin: h.isin
        });
      }
    });

    // Priority 2 (Fallback): If no active holdings yet, collect distinct schemes from transactions
    if (targetMap.size === 0) {
      transactions.forEach(t => {
        const code = t.schemeCode;
        if (!targetMap.has(code)) {
          targetMap.set(code, {
            schemeCode: code,
            schemeName: t.schemeName,
            folioNumber: t.folioNumber,
            planType: t.planType,
            optionType: t.optionType
          });
        }
      });
    }

    const targets = Array.from(targetMap.values());
    if (targets.length === 0) {
      setSyncToast({
        message: 'No active holdings in your portfolio to synchronize.',
        type: 'error'
      });
      setTimeout(() => setSyncToast(null), 3000);
      return;
    }

    setIsSyncingNavs(true);
    try {
      const { updatedSchemes, codeMigrations, totalSynced } = await syncSchemesForHoldings(targets, { forceRefresh: true });

      setSchemes(prev => {
        const next = { ...prev, ...updatedSchemes };
        saveAllSchemes(next);
        persistPortfolioToIndexedDb(transactions, next);
        return next;
      });

      if (Object.keys(codeMigrations).length > 0) {
        setTransactions(prev => {
          let hasChanges = false;
          const nextTxs = prev.map(tx => {
            const newCode = codeMigrations[tx.schemeCode];
            if (newCode && newCode !== tx.schemeCode) {
              hasChanges = true;
              const resolved = updatedSchemes[newCode];
              return {
                ...tx,
                schemeCode: newCode,
                schemeName: resolved?.schemeName || tx.schemeName
              };
            }
            return tx;
          });
          if (hasChanges) {
            saveStoredTransactions(nextTxs);
            persistPortfolioToIndexedDb(nextTxs, updatedSchemes);
            return nextTxs;
          }
          return prev;
        });
      }

      setSyncToast({
        message: `Successfully synchronized live AMFI NAVs for ${totalSynced} holding${totalSynced !== 1 ? 's' : ''}.`,
        type: 'success'
      });
      setTimeout(() => setSyncToast(null), 3500);
    } catch (err: any) {
      setSyncToast({
        message: err.message || 'Failed to sync NAVs from AMFI API.',
        type: 'error'
      });
      setTimeout(() => setSyncToast(null), 4000);
    } finally {
      setIsSyncingNavs(false);
    }
  }, [holdings, transactions]);

  // Sync a single holding NAV on-demand
  const handleSyncSingleNav = useCallback(async (schemeCode: string, schemeName?: string, isin?: string) => {
    try {
      const { updatedSchemes, codeMigrations } = await syncSchemesForHoldings([
        { schemeCode, schemeName, isin }
      ], { forceRefresh: true });

      if (Object.keys(updatedSchemes).length > 0) {
        setSchemes(prev => {
          const next = { ...prev, ...updatedSchemes };
          saveAllSchemes(next);
          persistPortfolioToIndexedDb(transactions, next);
          return next;
        });
      }

      if (Object.keys(codeMigrations).length > 0) {
        setTransactions(prev => {
          let hasChanges = false;
          const nextTxs = prev.map(tx => {
            const newCode = codeMigrations[tx.schemeCode];
            if (newCode && newCode !== tx.schemeCode) {
              hasChanges = true;
              const resolved = updatedSchemes[newCode];
              return {
                ...tx,
                schemeCode: newCode,
                schemeName: resolved?.schemeName || tx.schemeName
              };
            }
            return tx;
          });
          if (hasChanges) {
            saveStoredTransactions(nextTxs);
            persistPortfolioToIndexedDb(nextTxs, updatedSchemes);
            return nextTxs;
          }
          return prev;
        });
      }

      const syncedObj = Object.values(updatedSchemes)[0];
      setSyncToast({
        message: syncedObj?.currentNav 
          ? `Updated NAV for ${syncedObj.schemeName}: ₹${syncedObj.currentNav.toFixed(2)} (${syncedObj.navDate || 'Live'})`
          : `NAV refreshed successfully.`,
        type: 'success'
      });
      setTimeout(() => setSyncToast(null), 3500);
    } catch (err: any) {
      setSyncToast({
        message: `Failed to update NAV: ${err.message}`,
        type: 'error'
      });
      setTimeout(() => setSyncToast(null), 3500);
    }
  }, [transactions]);

  // Handle CAS Import (Replace or Merge)
  const handleImportTransactions = useCallback((imported: TransactionRecord[], replaceExisting = false) => {
    let stats = { added: imported.length, duplicates: 0, total: imported.length };

    if (replaceExisting) {
      setTransactions(imported);
      saveStoredTransactions(imported);
      persistPortfolioToIndexedDb(imported, schemes);
    } else {
      const existing = loadStoredTransactions();
      const mergeResult = mergeTransactions(existing, imported);
      setTransactions(mergeResult.mergedTransactions);
      saveStoredTransactions(mergeResult.mergedTransactions);
      persistPortfolioToIndexedDb(mergeResult.mergedTransactions, schemes);
      stats = {
        added: mergeResult.addedCount,
        duplicates: mergeResult.duplicateCount,
        total: mergeResult.totalCount
      };
    }

    setSyncToast({
      message: replaceExisting
        ? `Portfolio replaced with ${imported.length} transactions.`
        : stats.duplicates > 0
        ? `Merged successfully! Added ${stats.added} new transactions (${stats.duplicates} duplicates safely skipped). Total: ${stats.total}`
        : `Merged successfully! Added ${stats.added} new transactions. Total: ${stats.total}`,
      type: 'success'
    });
    setTimeout(() => setSyncToast(null), 4500);

    handleTabChange('overview');
    setTimeout(() => {
      handleSyncAllNavs();
    }, 100);
  }, [handleSyncAllNavs, handleTabChange, schemes]);

  // Jump to Ledger with scheme filter
  const handleViewSchemeLedger = (schemeCode: string) => {
    setLedgerSchemeFilter(schemeCode);
    handleTabChange('transactions');
  };

  return (
    <PrivacyProvider>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans antialiased selection:bg-emerald-900 selection:text-emerald-100">
        {/* Toast Notification */}
        {syncToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className={`px-4 py-3 rounded-xl shadow-xl border flex items-center gap-2.5 text-sm font-medium ${
              syncToast.type === 'success' 
                ? 'bg-neutral-900 border-emerald-500/40 text-emerald-300 shadow-emerald-950/30' 
                : 'bg-neutral-900 border-rose-500/40 text-rose-300 shadow-rose-950/30'
            }`}>
              {syncToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{syncToast.message}</span>
            </div>
          </div>
        )}

        {/* Header with Market Ticker & Tab Navigation */}
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          summary={summary}
          isSyncingNavs={isSyncingNavs}
          onSyncNavs={handleSyncAllNavs}
          onOpenImport={() => handleTabChange('import')}
        />

        {/* Main View Container - Visited tabs kept in DOM for instant 0ms switching */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {visitedTabs.has('overview') && (
            <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
              <PortfolioOverview
                summary={summary}
                holdings={holdings}
                transactions={transactions}
                onNavigateTab={handleTabChange}
                onOpenImport={() => handleTabChange('import')}
              />
            </div>
          )}

          {visitedTabs.has('holdings') && (
            <div className={activeTab === 'holdings' ? 'block' : 'hidden'}>
              <HoldingsTable
                holdings={holdings}
                onViewTransactions={handleViewSchemeLedger}
                onSyncSingleNav={handleSyncSingleNav}
              />
            </div>
          )}

          {visitedTabs.has('transactions') && (
            <div className={activeTab === 'transactions' ? 'block' : 'hidden'}>
              <TransactionLedger
                transactions={transactions}
                selectedSchemeFilter={ledgerSchemeFilter}
                onClearSchemeFilter={() => setLedgerSchemeFilter(undefined)}
              />
            </div>
          )}

          {visitedTabs.has('goals') && (
            <div className={activeTab === 'goals' ? 'block' : 'hidden'}>
              <GoalTracker holdings={holdings} />
            </div>
          )}

          {visitedTabs.has('insights') && (
            <div className={activeTab === 'insights' ? 'block' : 'hidden'}>
              <PortfolioInsights 
                holdings={holdings} 
                summary={summary} 
                transactions={transactions} 
              />
            </div>
          )}

          {visitedTabs.has('tax') && (
            <div className={activeTab === 'tax' ? 'block' : 'hidden'}>
              <TaxCalculator transactions={transactions} holdings={holdings} />
            </div>
          )}

          {visitedTabs.has('simulator') && (
            <div className={activeTab === 'simulator' ? 'block' : 'hidden'}>
              <SipSimulator summary={summary} holdings={holdings} />
            </div>
          )}

          {visitedTabs.has('import') && (
            <div className={activeTab === 'import' ? 'block' : 'hidden'}>
              <CasImporter
                transactions={transactions}
                schemes={schemes}
                onImportTransactions={handleImportTransactions}
              />
            </div>
          )}
        </main>
      </div>
    </PrivacyProvider>
  );
}
