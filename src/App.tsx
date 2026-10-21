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
import { MarketAnalysis } from './components/MarketAnalysis';
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
import { computePortfolioHoldings, mergeTransactions, formatNavDateDisplay } from './utils/financialCalculations';
import { loadAmfiNavDatabase } from './services/amfiNavService';

import { User as FirebaseUser } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken } from './services/googleAuth';
import { 
  syncPortfolioWithDrive, 
  getLastSyncedTime, 
  markLocalDataModified 
} from './services/googleDriveSync';
import { SyncVisualState } from './components/GoogleDriveSyncIndicator';
import { GoogleSignInModal } from './components/GoogleSignInModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<ActiveTab>>(() => new Set<ActiveTab>(['overview']));
  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => loadStoredTransactions());
  const [schemes, setSchemes] = useState<Record<string, MutualFundScheme>>(() => loadSchemeCatalog());
  const [isSyncingNavs, setIsSyncingNavs] = useState<boolean>(false);
  const [ledgerSchemeFilter, setLedgerSchemeFilter] = useState<string | undefined>(undefined);
  const [syncToast, setSyncToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Google Sign-In & Drive Sync State
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [syncState, setSyncState] = useState<SyncVisualState>('idle');
  const [lastSyncedDriveAt, setLastSyncedDriveAt] = useState<string | null>(() => getLastSyncedTime());
  const [isSignInModalOpen, setIsSignInModalOpen] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [signInError, setSignInError] = useState<string | null>(null);

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

  // Execute Google Drive Cloud Sync
  const handlePerformDriveSync = useCallback(async (token?: string, forceDirection: 'pull' | 'push' | 'auto' = 'auto') => {
    let currentToken = token;
    if (!currentToken) {
      currentToken = (await getAccessToken()) || undefined;
    }
    if (!currentToken) {
      setIsSignInModalOpen(true);
      return;
    }

    setSyncState('syncing');
    try {
      const localTxs = loadStoredTransactions();
      const localSchemes = loadSchemeCatalog();
      const result = await syncPortfolioWithDrive(
        currentToken,
        { transactions: localTxs, schemes: localSchemes },
        { forceDirection }
      );

      if (result.success) {
        setLastSyncedDriveAt(result.syncedAt);
        setSyncState(result.conflict ? 'conflict_resolved' : 'synced');

        if (result.payload) {
          if (result.action === 'pulled' || result.action === 'merged_conflict') {
            const remoteTxs = result.payload.transactions || [];
            const remoteSchemes = result.payload.schemes || {};
            setTransactions(remoteTxs);
            setSchemes(remoteSchemes);
            saveStoredTransactions(remoteTxs);
            saveAllSchemes(remoteSchemes);
            persistPortfolioToIndexedDb(remoteTxs, remoteSchemes);
          }
        }

        setSyncToast({
          message: result.message,
          type: 'success'
        });
        setTimeout(() => setSyncToast(null), 4500);
      } else {
        setSyncState('error');
        setSyncToast({
          message: result.message || 'Drive sync failed. Offline cache active.',
          type: 'error'
        });
        setTimeout(() => setSyncToast(null), 4500);
      }
    } catch (err: any) {
      setSyncState('error');
      setSyncToast({
        message: `Sync error: ${err.message}`,
        type: 'error'
      });
      setTimeout(() => setSyncToast(null), 4500);
    }
  }, []);

  // Handle Google Interactive Sign In with optional email hint
  const handleGoogleSignIn = useCallback(async (emailHint?: string) => {
    setIsSigningIn(true);
    setSignInError(null);
    try {
      const result = await googleSignIn(emailHint);
      if (result) {
        setAuthUser(result.user);
        setIsSignInModalOpen(false);
        sessionStorage.removeItem('mftracker_dismissed_signin');
        setSyncToast({
          message: `Signed in as ${result.user.email}! Syncing your portfolio from Google Drive...`,
          type: 'success'
        });
        setTimeout(() => setSyncToast(null), 3500);
        await handlePerformDriveSync(result.accessToken, 'auto');
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      let errMsg = err?.message || 'Failed to sign in with Google.';
      if (err?.code === 'auth/popup-closed-by-user') {
        errMsg = 'The sign-in popup was closed before completing. If you saw "Error 403: access_denied / not completed Google verification", see the instructions below.';
      } else if (errMsg.includes('403') || errMsg.includes('access_denied')) {
        errMsg = 'Google Error 403: access_denied. This app is in Google Cloud testing mode, so only approved test accounts or the developer account can sign in.';
      }
      setSignInError(errMsg);
    } finally {
      setIsSigningIn(false);
    }
  }, [handlePerformDriveSync]);

  // Handle Sign Out
  const handleSignOut = useCallback(async () => {
    await logout();
    setAuthUser(null);
    setSyncState('idle');
    setSyncToast({
      message: 'Signed out of Google account. Local offline data preserved.',
      type: 'success'
    });
    setTimeout(() => setSyncToast(null), 3500);
  }, []);

  // Listen for Google Auth state and prompt on initial load
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        setAuthUser(user);
        setIsSignInModalOpen(false);
        handlePerformDriveSync(token, 'auto');
      },
      () => {
        setAuthUser(null);
        // Prompt on initial launch if not dismissed in this session
        const dismissed = sessionStorage.getItem('mftracker_dismissed_signin');
        if (!dismissed) {
          setIsSignInModalOpen(true);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [handlePerformDriveSync]);

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
      const navDateFormatted = syncedObj?.navDate ? formatNavDateDisplay(syncedObj.navDate) : 'Live';
      setSyncToast({
        message: syncedObj?.currentNav 
          ? `Updated NAV for ${syncedObj.schemeName}: ₹${syncedObj.currentNav.toFixed(2)} (${navDateFormatted})`
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

  // Handle CAS Import (Replace or Merge) with Auto Drive Cloud Sync
  const handleImportTransactions = useCallback(async (imported: TransactionRecord[], replaceExisting = false, newSchemes?: Record<string, MutualFundScheme>) => {
    let finalTxs: TransactionRecord[] = [];
    let stats = { added: imported.length, duplicates: 0, total: imported.length };

    const mergedSchemes = { ...schemes, ...(newSchemes || {}) };
    if (newSchemes && Object.keys(newSchemes).length > 0) {
      setSchemes(mergedSchemes);
      saveAllSchemes(mergedSchemes);
    }

    if (replaceExisting) {
      finalTxs = imported;
      setTransactions(imported);
      saveStoredTransactions(imported);
      persistPortfolioToIndexedDb(imported, mergedSchemes);
    } else {
      const existing = loadStoredTransactions();
      const mergeResult = mergeTransactions(existing, imported);
      finalTxs = mergeResult.mergedTransactions;
      setTransactions(mergeResult.mergedTransactions);
      saveStoredTransactions(mergeResult.mergedTransactions);
      persistPortfolioToIndexedDb(mergeResult.mergedTransactions, mergedSchemes);
      stats = {
        added: mergeResult.addedCount,
        duplicates: mergeResult.duplicateCount,
        total: mergeResult.totalCount
      };
    }

    markLocalDataModified();

    // If signed into Google, automatically update the JSON in Drive
    const token = await getAccessToken();
    if (token) {
      setSyncState('syncing');
      syncPortfolioWithDrive(
        token,
        { transactions: finalTxs, schemes: mergedSchemes },
        { forceDirection: 'push' }
      ).then(syncResult => {
        if (syncResult.success) {
          setSyncState('synced');
          setLastSyncedDriveAt(syncResult.syncedAt);
          setSyncToast({
            message: `CAS statement imported & automatically synced to Google Drive! (${finalTxs.length} transactions total)`,
            type: 'success'
          });
          setTimeout(() => setSyncToast(null), 4500);
        }
      }).catch(err => {
        console.warn('Drive sync after CAS import error:', err);
      });
    } else {
      setSyncToast({
        message: replaceExisting
          ? `Portfolio replaced with ${imported.length} transactions (Cached locally).`
          : stats.duplicates > 0
          ? `Merged successfully! Added ${stats.added} new transactions (${stats.duplicates} duplicates safely skipped). Cached locally.`
          : `Merged successfully! Added ${stats.added} new transactions. Cached locally.`,
        type: 'success'
      });
      setTimeout(() => setSyncToast(null), 4500);
    }

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
          authUser={authUser}
          syncState={syncState}
          lastSyncedDriveAt={lastSyncedDriveAt}
          onOpenSignIn={() => setIsSignInModalOpen(true)}
          onDriveSync={() => handlePerformDriveSync(undefined, 'auto')}
          onSignOut={handleSignOut}
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
                transactions={transactions}
                summary={summary}
                onViewTransactions={handleViewSchemeLedger}
                onSyncSingleNav={handleSyncSingleNav}
                onSyncAllNavs={handleSyncAllNavs}
                isSyncingNavs={isSyncingNavs}
                onNavigateToMarket={() => handleTabChange('market')}
              />
            </div>
          )}

          {visitedTabs.has('market') && (
            <div className={activeTab === 'market' ? 'block' : 'hidden'}>
              <MarketAnalysis
                summary={summary}
                onNavigateToHoldings={() => handleTabChange('holdings')}
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
                isGoogleSignedIn={Boolean(authUser)}
                onOpenGoogleSignIn={() => setIsSignInModalOpen(true)}
                lastSyncedDriveAt={lastSyncedDriveAt}
              />
            </div>
          )}
        </main>

        {/* Google Account Sign-In Prompt Modal */}
        <GoogleSignInModal
          isOpen={isSignInModalOpen}
          onClose={() => {
            setIsSignInModalOpen(false);
            sessionStorage.setItem('mftracker_dismissed_signin', 'true');
          }}
          onSignIn={handleGoogleSignIn}
          isLoading={isSigningIn}
          errorMessage={signInError}
        />
      </div>
    </PrivacyProvider>
  );
}
