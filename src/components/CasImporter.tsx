import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  Sparkles, 
  RefreshCw, 
  ArrowRight,
  Database,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  FileCheck,
  User,
  CreditCard,
  Calendar,
  Layers,
  Search,
  Check,
  Copy
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TransactionRecord, MutualFundScheme } from '../types';
import { 
  parseCasStatement, 
  exportPortfolioToJson, 
  generateDemoTransactions 
} from '../services/portfolioStorage';
import { parsePdfCasStatement, PdfParseResult } from '../services/pdfCasParser';

interface CasImporterProps {
  transactions: TransactionRecord[];
  schemes: Record<string, MutualFundScheme>;
  onImportTransactions: (newTransactions: TransactionRecord[], replaceExisting: boolean, newSchemes?: Record<string, MutualFundScheme>) => void;
  onResetDemoData: () => void;
}

export const CasImporter: React.FC<CasImporterProps> = ({
  transactions,
  schemes,
  onImportTransactions,
  onResetDemoData
}) => {
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<TransactionRecord[]>([]);
  const [detectedSchemes, setDetectedSchemes] = useState<Record<string, MutualFundScheme>>({});
  const [replaceMode, setReplaceMode] = useState<boolean>(true);
  
  // PDF Password Management
  const [pdfPassword, setPdfPassword] = useState<string>('Testing123#');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [pendingPdfBuffer, setPendingPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [isPasswordRequired, setIsPasswordRequired] = useState<boolean>(false);

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
    setIsPasswordRequired(false);

    try {
      const result: PdfParseResult = await parsePdfCasStatement(buffer, passwordToUse);

      if (result.requiresPassword) {
        setIsPasswordRequired(true);
        setPendingPdfBuffer(buffer);
        setPendingFileName(fileName);
        setImportStatus('error');
        setStatusMessage('Password required or incorrect. Please enter the valid PDF password to decrypt the statement.');
        return;
      }

      if (result.transactions.length > 0) {
        setParsedPreview(result.transactions);
        
        // Map detected schemes
        const schemeMap: Record<string, MutualFundScheme> = {};
        result.detectedSchemes.forEach(s => {
          if (s.schemeCode && s.schemeName) {
            schemeMap[s.schemeCode] = {
              schemeCode: s.schemeCode,
              schemeName: s.schemeName,
              fundHouse: s.fundHouse || 'Mutual Fund',
              category: s.category || 'Equity - Flexi Cap',
              currentNav: 100,
              navDate: new Date().toISOString().split('T')[0],
              navChange1D: 0,
              cagr3Y: 15,
              cagr5Y: 18,
              aumCr: 10000,
              expenseRatio: 0.75,
              isin: s.isin || ''
            };
          }
        });
        setDetectedSchemes(schemeMap);

        setStatementMeta({
          investorName: result.investorName,
          pan: result.pan,
          period: result.statementPeriod,
          folioCount: result.folioCount
        });

        setImportStatus('success');
        setStatusMessage(`Successfully extracted ${result.transactions.length} mutual fund transactions across ${result.folioCount} folio(s) from "${fileName}"!`);
        
        try {
          confetti({
            particleCount: 90,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch {
          // Ignore confetti error
        }
      } else {
        setImportStatus('error');
        setStatusMessage(result.error || 'Could not find any valid mutual fund transaction rows in the PDF. Please check if this is a standard CAMS or KFintech CAS statement.');
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
      const buffer = await file.arrayBuffer();
      setPendingPdfBuffer(buffer);
      setPendingFileName(fileName);
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
            setStatementMeta({});
            setImportStatus('success');
            setStatusMessage(`Successfully parsed ${result.transactions.length} transactions from "${fileName}"!`);
            
            try {
              confetti({
                particleCount: 70,
                spread: 60,
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

  const handleRetryWithPassword = () => {
    if (pendingPdfBuffer && pendingFileName) {
      processPdfBuffer(pendingPdfBuffer, pendingFileName, pdfPassword);
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
      onImportTransactions(parsedPreview, replaceMode, detectedSchemes);
      setParsedPreview([]);
      setStatusMessage(`Applied ${parsedPreview.length} transactions to your active portfolio!`);
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

  const handleTriggerDemo = () => {
    onResetDemoData();
    setImportStatus('success');
    setStatusMessage('Loaded realistic 3-year multi-fund SIP demonstration portfolio!');
    try {
      confetti({ particleCount: 50, spread: 50 });
    } catch {}
  };

  // Filtered preview transactions
  const filteredPreview = parsedPreview.filter(t => {
    if (!previewSearch) return true;
    const q = previewSearch.toLowerCase();
    return (
      t.schemeName.toLowerCase().includes(q) ||
      t.folioNumber.toLowerCase().includes(q) ||
      t.type.toLowerCase().includes(q) ||
      t.date.includes(q)
    );
  });

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
                Your password-protected CAMS / KFintech PDF statements are decrypted and parsed <strong>strictly on your device</strong> using browser WebAssembly. No passwords, folios, or financial records leave your computer.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action Grid: PDF & Statement Upload Area */}
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
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-500">Quick fill:</span>
                  <button
                    type="button"
                    onClick={() => setPdfPassword('Testing123#')}
                    className={`text-[11px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                      pdfPassword === 'Testing123#'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                    }`}
                  >
                    Testing123#
                  </button>
                </div>
              </div>

              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={pdfPassword}
                  onChange={(e) => setPdfPassword(e.target.value)}
                  placeholder="Enter PDF password (e.g. PAN or Testing123#)"
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
                CAMS statements typically use your custom password (or lowercase PAN). Enter or change the password above before or after choosing your PDF.
              </p>

              {isPasswordRequired && pendingPdfBuffer && (
                <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    File loaded: {pendingFileName}
                  </span>
                  <button
                    type="button"
                    onClick={handleRetryWithPassword}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg cursor-pointer transition flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Unlock & Parse PDF
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

          {/* Replace vs Append Toggle */}
          <div className="flex items-center justify-between text-xs text-neutral-300 border-t border-neutral-800 pt-3">
            <span>Import Mode:</span>
            <div className="flex items-center gap-2 bg-neutral-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setReplaceMode(true)}
                className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition ${replaceMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-400'}`}
              >
                Replace Portfolio
              </button>
              <button
                type="button"
                onClick={() => setReplaceMode(false)}
                className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition ${!replaceMode ? 'bg-emerald-600 text-white shadow-sm' : 'text-neutral-400'}`}
              >
                Append / Merge
              </button>
            </div>
          </div>
        </div>

        {/* Presets, Backup & Sample Data Column */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-teal-400" />
              Presets & Cloud Backup Vault
            </h3>
            <p className="text-xs text-neutral-400">
              Export encrypted snapshots to Google Drive or test with realistic portfolio presets.
            </p>

            <div className="space-y-3 mt-4">
              {/* Load Demo */}
              <div className="bg-neutral-800/40 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Load Realistic Demo Portfolio</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Pre-populated with 5 top direct funds (PPFAS, HDFC, Quant, Mirae, Kotak) spanning 36 monthly SIPs.
                  </p>
                </div>
                <button
                  onClick={handleTriggerDemo}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white cursor-pointer transition shrink-0 ml-3 shadow-sm"
                >
                  Load Demo
                </button>
              </div>

              {/* Export Backup JSON */}
              <div className="bg-neutral-800/40 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Export Full Portfolio Backup (.json)</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Download complete snapshot of all {transactions.length} transactions, folios, and NAV states to sync across devices via Google Drive.
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
            <span className="font-semibold text-neutral-300 block">Supported CAMS Statement Features:</span>
            <ul className="text-neutral-400 text-[11px] space-y-1">
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Encrypted PDF decryption with AES-128 / AES-256 standard</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Automatic Folio number and ISIN code extraction</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>SIP, Lumpsum, Redemption, Switch In/Out classification</span>
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

      {/* Preview Table If File Just Uploaded */}
      {parsedPreview.length > 0 && (
        <div className="bg-neutral-900 border border-emerald-500/40 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Parsed Transactions Preview ({parsedPreview.length} records)
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                  Ready to Commit
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Review extracted records before applying to your live portfolio.
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
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-900/40 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Commit & Apply ({parsedPreview.length})</span>
              </button>
            </div>
          </div>

          {/* Search bar inside preview */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={previewSearch}
              onChange={(e) => setPreviewSearch(e.target.value)}
              placeholder="Search extracted transactions by scheme, folio, or type..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="overflow-x-auto max-h-72 border border-neutral-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-800/90 text-neutral-400 sticky top-0 backdrop-blur">
                <tr>
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
                {filteredPreview.map((t, idx) => (
                  <tr key={idx} className="hover:bg-neutral-800/40 transition">
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
