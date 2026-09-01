import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { PortfolioOverview } from './components/PortfolioOverview';
import { HoldingsTable } from './components/HoldingsTable';
import { TransactionLedger } from './components/TransactionLedger';
import { PortfolioInsights } from './components/PortfolioInsights';
import { TaxCalculator } from './components/TaxCalculator';
import { SipSimulator } from './components/SipSimulator';
import { CasImporter } from './components/CasImporter';
import { CheckCircle2, AlertCircle } from 'lucide-react';

import { TransactionRecord, MutualFundScheme } from './types';
import { 
  loadStoredTransactions, 
  saveStoredTransactions, 
  loadSchemeCatalog, 
  saveAllSchemes
} from './services/portfolioStorage';
import { syncSchemesForHoldings, SchemeSyncTarget } from './services/mfApi';
import { computePortfolioHoldings, mergeTransactions } from './utils/financialCalculations';
import { loadAmfiNavDatabase } from './services/amfiNavService';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [schemes, setSchemes] = useState<Record<string, MutualFundScheme>>({});
  const [isSyncingNavs, setIsSyncingNavs] = useState<boolean>(false);
  const [ledgerSchemeFilter, setLedgerSchemeFilter] = useState<string | undefined>(undefined);
  const [syncToast, setSyncToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Load initial data on mount and trigger auto-sync
  useEffect(() => {
    // Preload official AMFI master database in the background
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
            return nextTxs;
          }
          return prev;
        });
      }

      setSyncToast({
        message: `Successfully synchronized ${totalSynced} active holding${totalSynced === 1 ? '' : 's'} with official AMFI live NAVs!`,
        type: 'success'
      });
      setTimeout(() => setSyncToast(null), 3500);
    } catch (err) {
      console.warn('Error syncing NAVs:', err);
      setSyncToast({
        message: 'Could not reach AMFI server. Displaying latest available NAVs.',
        type: 'error'
      });
      setTimeout(() => setSyncToast(null), 3500);
    } finally {
      setIsSyncingNavs(false);
    }
  }, [holdings, transactions]);

  // Sync a single scheme NAV
  const handleSyncSingleNav = useCallback(async (schemeCode: string, schemeName?: string, isin?: string) => {
    try {
      const target: SchemeSyncTarget = {
        schemeCode,
        schemeName: schemeName || schemes[schemeCode]?.schemeName,
        isin: isin || schemes[schemeCode]?.isin
      };

      const { updatedSchemes, codeMigrations } = await syncSchemesForHoldings([target], { forceRefresh: true });

      if (Object.keys(updatedSchemes).length > 0) {
        setSchemes(prev => {
          const next = { ...prev, ...updatedSchemes };
          saveAllSchemes(next);
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
              return nextTxs;
            }
            return prev;
          });
        }

        const syncedScheme = updatedSchemes[schemeCode] || Object.values(updatedSchemes)[0];
        setSyncToast({
          message: `Live NAV updated: ${syncedScheme.schemeName} → ₹${syncedScheme.currentNav} (as of ${syncedScheme.navDate})`,
          type: 'success'
        });
        setTimeout(() => setSyncToast(null), 3500);
      }
    } catch (err) {
      console.warn(`Error syncing NAV for scheme ${schemeCode}:`, err);
    }
  }, [schemes]);

  // Import transactions from CAS statement with smart deduplication merge
  const handleImportTransactions = useCallback((imported: TransactionRecord[], replaceExisting: boolean = false, newSchemes?: Record<string, MutualFundScheme>) => {
    let stats = { added: imported.length, duplicates: 0, total: imported.length };

    setTransactions(prev => {
      let updated: TransactionRecord[];
      if (replaceExisting) {
        updated = imported;
        stats = { added: imported.length, duplicates: 0, total: imported.length };
      } else {
        const mergeRes = mergeTransactions(prev, imported);
        updated = mergeRes.mergedTransactions;
        stats = {
          added: mergeRes.addedCount,
          duplicates: mergeRes.duplicateCount,
          total: mergeRes.totalCount
        };
      }
      saveStoredTransactions(updated);
      return updated;
    });

    if (newSchemes && Object.keys(newSchemes).length > 0) {
      setSchemes(prev => {
        const updated = { ...prev, ...newSchemes };
        saveAllSchemes(updated);
        return updated;
      });
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

    setActiveTab('overview');
    setTimeout(() => {
      handleSyncAllNavs();
    }, 100);
  }, [handleSyncAllNavs]);

  // Jump to Ledger with scheme filter
  const handleViewSchemeLedger = (schemeCode: string) => {
    setLedgerSchemeFilter(schemeCode);
    setActiveTab('transactions');
  };

  return (
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
        setActiveTab={setActiveTab}
        summary={summary}
        isSyncingNavs={isSyncingNavs}
        onSyncNavs={handleSyncAllNavs}
        onOpenImport={() => setActiveTab('import')}
      />

      {/* Main View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <PortfolioOverview
            summary={summary}
            holdings={holdings}
            transactions={transactions}
            onNavigateTab={setActiveTab}
            onOpenImport={() => setActiveTab('import')}
          />
        )}

        {activeTab === 'holdings' && (
          <HoldingsTable
            holdings={holdings}
            onViewTransactions={handleViewSchemeLedger}
            onSyncSingleNav={handleSyncSingleNav}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionLedger
            transactions={transactions}
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
          />
        )}
      </main>
    </div>
  );
}
