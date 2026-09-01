import React, { useState, useRef, useMemo } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  RefreshCw, 
  Database, 
  Eye, 
  EyeOff, 
  KeyRound, 
  FileCheck, 
  User, 
  CreditCard, 
  Calendar, 
  Layers, 
  Search, 
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TransactionRecord, MutualFundScheme } from '../types';
import { parseCasStatement, exportPortfolioToJson } from '../services/portfolioStorage';
import { parsePdfCasStatement, PdfParseResult } from '../services/pdfCasParser';
import { resolveSchemeLiveDetails } from '../services/mfApi';
import { cleanFundDisplayName, analyzeTransactionsMerge } from '../utils/financialCalculations';

interface CasImporterProps {
  transactions: TransactionRecord[];
  schemes: Record<string, MutualFundScheme>;
  onImportTransactions: (newTransactions: TransactionRecord[], replaceExisting: boolean, newSchemes?: Record<string, MutualFundScheme>) => void;
}

export const CasImporter: React.FC<CasImporterProps> = ({
  transactions,
  schemes,
  onImportTransactions
}) => {
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<TransactionRecord[]>([]);
  const [detectedSchemes, setDetectedSchemes] = useState<Record<string, MutualFundScheme>>({});
  const [replaceMode, setReplaceMode] = useState<boolean>(false);
  const [previewFilterTab, setPreviewFilterTab] = useState<'ALL' | 'NEW' | 'DUPLICATES'>('ALL');
  
  // PDF Password Management
  const [pdfPassword, setPdfPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);

  // Metadata extracted from CAMS statement
  const [statementMeta, setStatementMeta] = useState<{
    investorName?: string;
    pan?: string;
    period?: string;
    folioCount?: number;
  }>({});

  // Search filter for parsed preview
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process a PDF File with current password
  const processPdfBuffer = async (buffer: ArrayBuffer, fileName: string, passwordToUse: string) => {
    setImportStatus('parsing');
    setStatusMessage(`Decrypting and parsing CAMS PDF "${fileName}"...`);

    try {
      const result: PdfParseResult = await parsePdfCasStatement(buffer, passwordToUse);

      if (result.requiresPassword) {
        setImportStatus('error');
        setStatusMessage('Password required or incorrect. Please enter the valid PDF password to decrypt the statement.');
        return;
      }

      if (result.transactions.length > 0) {
        let activeTransactions = [...result.transactions];
        
        // Map detected schemes
        const schemeMap: Record<string, MutualFundScheme> = {};
        result.detectedSchemes.forEach(s => {
          if (s.schemeCode && s.schemeName) {
            const cleanName = cleanFundDisplayName(s.schemeName);
            schemeMap[s.schemeCode] = {
              schemeCode: s.schemeCode,
              schemeName: cleanName,
              fundHouse: s.fundHouse || 'Mutual Fund',
              category: s.category || 'Equity - Flexi Cap',
              planType: s.planType || 'Direct',
              optionType: s.optionType || 'Growth',
              currentNav: s.currentNav && s.currentNav > 0 ? s.currentNav : 85.0,
              navDate: s.navDate || new Date().toISOString().split('T')[0],
              navChange1D: s.navChange1D || 0,
              cagr3Y: 15,
              cagr5Y: 18,
              aumCr: 10000,
              expenseRatio: s.planType === 'Direct' ? 0.65 : 1.35,
              isin: s.isin || ''
            };
          }
        });

        setParsedPreview(activeTransactions);
        setDetectedSchemes(schemeMap);

        setStatementMeta({
          investorName: result.investorName,
          pan: result.pan,
          period: result.statementPeriod,
          folioCount: result.folioCount
        });

        setImportStatus('success');
        setStatusMessage(`Successfully extracted ${result.transactions.length} mutual fund transactions across ${result.folioCount} folio(s) from "${fileName}"! Resolving live NAVs...`);
        
        // Asynchronously resolve live AMFI scheme details and NAVs
        Promise.all(
          result.detectedSchemes.map(async (s) => {
            if (!s.schemeName) return null;
            try {
              const live = await resolveSchemeLiveDetails(
                s.schemeName,
                s.isin,
                s.currentNav,
                true,
                s.planType,
                s.optionType
              );
              return { oldCode: s.schemeCode, live, origPlan: s.planType, origOption: s.optionType };
            } catch {
              return null;
            }
          })
        ).then((resolved) => {
          const updatedSchemeMap = { ...schemeMap };
          let updatedTxs = [...activeTransactions];
          let didUpdate = false;

          resolved.forEach((item) => {
            if (item && item.live) {
              didUpdate = true;
              const { oldCode, live, origPlan, origOption } = item;
              if (oldCode && oldCode !== live.schemeCode) {
                delete updatedSchemeMap[oldCode];
                updatedTxs = updatedTxs.map(tx => tx.schemeCode === oldCode ? { 
                  ...tx, 
                  schemeCode: live.schemeCode, 
                  schemeName: live.schemeName,
                  planType: live.planType || origPlan || tx.planType,
                  optionType: live.optionType || origOption || tx.optionType
                } : tx);
              }
              updatedSchemeMap[live.schemeCode] = {
                schemeCode: live.schemeCode,
                schemeName: live.schemeName,
                fundHouse: live.fundHouse,
                category: live.category,
                planType: live.planType || origPlan || 'Direct',
                optionType: live.optionType || origOption || 'Growth',
                currentNav: live.currentNav,
                navDate: live.navDate,
                navChange1D: live.navChange1D,
                cagr3Y: 15,
                cagr5Y: 18,
                aumCr: 10000,
                expenseRatio: (live.planType || origPlan) === 'Direct' ? 0.65 : 1.35,
                isin: live.isin || ''
              };
            }
          });

          if (didUpdate) {
            setDetectedSchemes(updatedSchemeMap);
            setParsedPreview(updatedTxs);
            setStatusMessage(`Successfully extracted ${activeTransactions.length} transactions across ${result.folioCount} folio(s) with live NAVs resolved!`);
          }
        }).catch(() => {
          // Resolution fallback already set
        });

        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 }
          });
        } catch {
          // Confetti optional
        }
      } else {
        setImportStatus('error');
        setStatusMessage(result.error || 'Could not find any valid mutual fund transaction rows in the PDF. Please ensure this is a standard CAMS or KFintech CAS statement.');
      }
    } catch (err: any) {
      setImportStatus('error');
      setStatusMessage(`Error parsing PDF statement: ${err?.message || 'Invalid or corrupted PDF'}`);
    }
  };

  const handleFileProcess = async (file: File) => {
    const fileName = file.name;
    const isPdf = fileName.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

    if (isPdf) {
      setPendingPdfFile(file);
      const buffer = await file.arrayBuffer();
      await processPdfBuffer(buffer, fileName, pdfPassword);
    } else {
      // JSON / CSV / TXT
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const result = parseCasStatement(content);

          if (result.transactions.length > 0) {
            setParsedPreview(result.transactions);
            setStatementMeta(result.statementMeta || {});
            setImportStatus('success');
            setStatusMessage(`Successfully parsed ${result.transactions.length} transactions from "${fileName}"!`);
            
            try {
              confetti({
                particleCount: 60,
                spread: 50,
                origin: { y: 0.7 }
              });
            } catch {}
          } else {
            setImportStatus('error');
            setStatusMessage('Could not find any valid mutual fund transactions in the selected file. Please ensure it is a valid CAS JSON or CSV statement.');
          }
        } catch (err: any) {
          setImportStatus('error');
          setStatusMessage(`Error parsing statement file: ${err?.message || 'Invalid format'}`);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileProcess(file);
  };

  const handleRetryWithPassword = async () => {
    if (pendingPdfFile) {
      const buffer = await pendingPdfFile.arrayBuffer();
      await processPdfBuffer(buffer, pendingPdfFile.name, pdfPassword);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleCommitImport = () => {
    if (parsedPreview.length > 0) {
      if (!replaceMode && mergeAnalysis.addedCount === 0 && mergeAnalysis.duplicateCount > 0) {
        setStatusMessage(`All ${mergeAnalysis.duplicateCount} transactions already exist in your portfolio. No duplicate records were added.`);
        setImportStatus('success');
        setParsedPreview([]);
        return;
      }

      onImportTransactions(parsedPreview, replaceMode, detectedSchemes);
      setParsedPreview([]);
      setStatusMessage(
        replaceMode
          ? `Replaced entire portfolio with ${parsedPreview.length} transactions.`
          : mergeAnalysis.duplicateCount > 0
          ? `Merged successfully! Added ${mergeAnalysis.addedCount} new transactions (${mergeAnalysis.duplicateCount} duplicates safely skipped).`
          : `Merged successfully! Added all ${mergeAnalysis.addedCount} new transactions.`
      );
    }
  };

  const handleExportBackup = () => {
    const jsonStr = exportPortfolioToJson(transactions, schemes);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mftracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute smart merge and duplicate analysis in real-time
  const mergeAnalysis = useMemo(() => {
    return analyzeTransactionsMerge(transactions, parsedPreview);
  }, [transactions, parsedPreview]);

  // Filtered preview items based on tab and search
  const filteredPreviewItems = useMemo(() => {
    return mergeAnalysis.previewItems.filter(item => {
      const t = item.transaction;
      if (previewFilterTab === 'NEW' && item.isDuplicate) return false;
      if (previewFilterTab === 'DUPLICATES' && !item.isDuplicate) return false;
      if (!previewSearch) return true;
      const q = previewSearch.toLowerCase();
      return (
        t.schemeName.toLowerCase().includes(q) ||
        t.folioNumber.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.date.includes(q)
      );
    });
  }, [mergeAnalysis, previewFilterTab, previewSearch]);

  return (
    <div className="space-y-6">
      {/* Privacy Guarantee Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Consolidated Account Statement (CAS) Importer & Backup
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  100% Client-Side In-Browser Decryption
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Your password-protected CAMS / KFintech PDF statements are decrypted and parsed <strong>strictly on your device</strong>. No passwords, folios, or financial records leave your browser.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Statement Area */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-emerald-400" />
                Upload CAMS / KFintech Statement
              </h3>
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                PDF • JSON • CSV
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Upload your password-protected CAMS PDF CAS statement or standard JSON / CSV export.
            </p>

            {/* PDF Password Configuration Box */}
            <div className="mt-4 bg-neutral-950/70 border border-neutral-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  PDF Statement Password
                </label>
                <span className="text-[11px] text-neutral-500">Processed locally in-memory</span>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pendingPdfFile) {
                      e.preventDefault();
                      handleRetryWithPassword();
                    }
                  }}
                  placeholder="Enter your PDF statement password..."
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 font-mono outline-none pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 text-neutral-400 hover:text-neutral-200 cursor-pointer p-0.5"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <p className="text-[11px] text-neutral-500 leading-relaxed">
                For CAMS statements, this is typically your chosen password or PAN in lower/upper case.
              </p>

              {pendingPdfFile && (
                <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-neutral-300 flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="truncate max-w-[170px]">{pendingPdfFile.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRetryWithPassword}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition flex items-center gap-1 shadow-sm"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Parse / Re-parse PDF
                  </button>
                </div>
              )}
            </div>

            {/* Drag & Drop Area */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-4 border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition group ${
                isDragging 
                  ? 'border-emerald-500 bg-emerald-950/20' 
                  : 'border-neutral-700 hover:border-emerald-500/70 bg-neutral-800/40 hover:bg-neutral-800/80'
              }`}
            >
              <FileText className="w-10 h-10 mx-auto text-neutral-500 group-hover:text-emerald-400 transition mb-2" />
              <p className="text-sm font-semibold text-neutral-200 group-hover:text-white">
                Click to browse or drag & drop CAMS statement
              </p>
              <p className="text-xs text-neutral-400 mt-1 font-medium">
                Supports <span className="text-emerald-400 font-bold">.pdf</span> (Password Encrypted), <span className="text-neutral-300">.json</span>, <span className="text-neutral-300">.csv</span>
              </p>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".pdf,.json,.csv,.txt,application/pdf" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {/* Import Mode Selector */}
          <div className="border-t border-neutral-800 pt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-300">
              <span className="font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Import Mode:
              </span>
              <div className="flex items-center gap-1 bg-neutral-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setReplaceMode(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1 ${
                    !replaceMode 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Check className="w-3 h-3" />
                  <span>Smart Merge (Deduplicated)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReplaceMode(true)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition ${
                    replaceMode 
                      ? 'bg-rose-600 text-white shadow-sm' 
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Overwrite All
                </button>
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              {!replaceMode ? (
                <span className="text-emerald-400/90 font-medium">
                  ✓ <strong>Smart Merge Active:</strong> Duplicate transactions across overlapping statement periods are automatically detected and skipped. Common historical transactions will never be duplicated.
                </span>
              ) : (
                <span className="text-rose-400/90 font-medium">
                  ⚠️ <strong>Overwrite Mode:</strong> Completely replaces all existing portfolio transactions with this uploaded statement.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Backup & Statement Features Column */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-emerald-400" />
              Portfolio Backup & Data Vault
            </h3>
            <p className="text-xs text-neutral-400">
              Download your complete portfolio snapshot to keep an offline backup or transfer between devices.
            </p>

            <div className="space-y-3 mt-4">
              {/* Export Backup JSON */}
              <div className="bg-neutral-800/40 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Export Portfolio Backup (.json)</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Download complete snapshot of all {transactions.length} transactions, folios, and NAV records.
                  </p>
                </div>
                <button
                  onClick={handleExportBackup}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 hover:text-white cursor-pointer transition shrink-0 ml-3 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800/80 space-y-2 text-xs">
            <span className="font-semibold text-neutral-300 block">Deduplicating Merge Engine:</span>
            <ul className="text-neutral-400 text-[11px] space-y-1">
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Multi-period CAS merging without duplicate transactions</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Matches folios, clean scheme codes, dates, units, and amounts</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Safe to re-upload the same or overlapping 1-month / 1-year statements anytime</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Status Alerts */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
          importStatus === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
            : importStatus === 'parsing'
            ? 'bg-blue-950/40 border-blue-500/40 text-blue-300 animate-pulse'
            : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
        }`}>
          {importStatus === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
          ) : importStatus === 'parsing' ? (
            <RefreshCw className="w-5 h-5 shrink-0 mt-0.5 animate-spin text-blue-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          )}
          <div className="flex-1 font-medium">{statusMessage}</div>
        </div>
      )}

      {/* Extracted Metadata Card If Available */}
      {(statementMeta.investorName || statementMeta.pan || statementMeta.folioCount) && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
          <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
            Statement Metadata Detected
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statementMeta.investorName && (
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                  <User className="w-3 h-3 text-neutral-400" />
                  Investor Name
                </div>
                <div className="text-xs font-bold text-white mt-0.5 truncate">
                  {statementMeta.investorName}
                </div>
              </div>
            )}

            {statementMeta.pan && (
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-neutral-400" />
                  PAN Number
                </div>
                <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                  {statementMeta.pan}
                </div>
              </div>
            )}

            {statementMeta.folioCount !== undefined && (
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-neutral-400" />
                  Folios Detected
                </div>
                <div className="text-xs font-bold text-white mt-0.5">
                  {statementMeta.folioCount} Folio(s)
                </div>
              </div>
            )}

            {statementMeta.period && (
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-400" />
                  Statement Period
                </div>
                <div className="text-xs font-bold text-white mt-0.5 truncate">
                  {statementMeta.period}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Table & Merge Breakdown If File Just Uploaded */}
      {parsedPreview.length > 0 && (
        <div className="bg-neutral-900 border border-emerald-500/40 rounded-2xl p-6 shadow-lg space-y-5">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Parsed Statement Analysis ({parsedPreview.length} records in file)
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Ready to Merge
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Review extracted records and deduplication status before applying to your portfolio.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setParsedPreview([])}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleCommitImport}
                className={`px-4 py-2 text-xs font-bold rounded-lg text-white cursor-pointer shadow-md flex items-center gap-1.5 transition ${
                  replaceMode
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40'
                    : mergeAnalysis.addedCount === 0
                    ? 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {replaceMode
                    ? `Overwrite Portfolio (${parsedPreview.length} Records)`
                    : mergeAnalysis.addedCount > 0 && mergeAnalysis.duplicateCount > 0
                    ? `Smart Merge: Add ${mergeAnalysis.addedCount} New Records (${mergeAnalysis.duplicateCount} Duplicates Skipped)`
                    : mergeAnalysis.addedCount > 0
                    ? `Smart Merge: Add All ${mergeAnalysis.addedCount} Records`
                    : `All ${mergeAnalysis.duplicateCount} Records Already in Portfolio`}
                </span>
              </button>
            </div>
          </div>

          {/* Merge Statistics Breakdown Banner */}
          {!replaceMode && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-neutral-950 p-3.5 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">New Transactions</span>
                  <div className="text-lg font-bold text-white mt-0.5">
                    +{mergeAnalysis.addedCount} <span className="text-xs font-normal text-emerald-400">will be added</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  NEW
                </div>
              </div>

              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Duplicates Detected</span>
                  <div className="text-lg font-bold text-neutral-300 mt-0.5">
                    {mergeAnalysis.duplicateCount} <span className="text-xs font-normal text-neutral-400">safely skipped</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-400 flex items-center justify-center font-bold text-xs">
                  SKIP
                </div>
              </div>

              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Resulting Portfolio Total</span>
                  <div className="text-lg font-bold text-blue-400 mt-0.5">
                    {mergeAnalysis.totalResultingCount} <span className="text-xs font-normal text-neutral-400">records</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                  TOTAL
                </div>
              </div>
            </div>
          )}

          {/* Filter Tabs & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => setPreviewFilterTab('ALL')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer transition ${
                  previewFilterTab === 'ALL'
                    ? 'bg-neutral-800 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                All Records ({parsedPreview.length})
              </button>
              <button
                type="button"
                onClick={() => setPreviewFilterTab('NEW')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer transition ${
                  previewFilterTab === 'NEW'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-emerald-300'
                }`}
              >
                New Only ({mergeAnalysis.addedCount})
              </button>
              <button
                type="button"
                onClick={() => setPreviewFilterTab('DUPLICATES')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg cursor-pointer transition ${
                  previewFilterTab === 'DUPLICATES'
                    ? 'bg-neutral-800 text-neutral-200 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-300'
                }`}
              >
                Duplicates ({mergeAnalysis.duplicateCount})
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                placeholder="Search preview transactions..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-emerald-500/60"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 border border-neutral-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-800/90 text-neutral-400 sticky top-0 backdrop-blur z-10">
                <tr>
                  <th className="p-2.5 font-medium">Merge Status</th>
                  <th className="p-2.5 font-medium">Date</th>
                  <th className="p-2.5 font-medium">Folio</th>
                  <th className="p-2.5 font-medium">Scheme Name</th>
                  <th className="p-2.5 font-medium">Type</th>
                  <th className="p-2.5 text-right font-medium">Units</th>
                  <th className="p-2.5 text-right font-medium">NAV (₹)</th>
                  <th className="p-2.5 text-right font-medium">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-neutral-200">
                {filteredPreviewItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-neutral-500">
                      No transactions matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredPreviewItems.map((item, idx) => {
                    const t = item.transaction;
                    return (
                      <tr 
                        key={idx} 
                        className={`transition ${
                          item.isDuplicate && !replaceMode 
                            ? 'bg-neutral-950/40 text-neutral-400 hover:bg-neutral-800/20' 
                            : 'hover:bg-neutral-800/40'
                        }`}
                      >
                        <td className="p-2.5 whitespace-nowrap">
                          {replaceMode ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                              Overwrite
                            </span>
                          ) : item.isDuplicate ? (
                            <span 
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800/90 text-neutral-400 border border-neutral-700/80 inline-flex items-center gap-1"
                              title={`Matches existing transaction in portfolio on ${item.duplicateOf?.date || t.date} — will be skipped`}
                            >
                              <Check className="w-2.5 h-2.5 text-neutral-500" />
                              In Portfolio (Skip)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                              + New Record
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-neutral-400 whitespace-nowrap">{t.date}</td>
                        <td className="p-2.5 font-mono text-neutral-400 text-[11px] whitespace-nowrap">{t.folioNumber}</td>
                        <td className="p-2.5 truncate max-w-xs font-medium text-white">{t.schemeName}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type === 'SIP' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            t.type === 'LUMPSUM' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            t.type === 'REDEMPTION' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono">{t.units.toFixed(3)}</td>
                        <td className="p-2.5 text-right font-mono">₹{t.nav.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                          ₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
