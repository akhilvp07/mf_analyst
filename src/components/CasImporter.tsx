import React, { useState, useRef } from 'react';
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
  Lock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TransactionRecord, MutualFundScheme } from '../types';
import { 
  parseCasStatement, 
  exportPortfolioToJson, 
  generateDemoTransactions 
} from '../services/portfolioStorage';

interface CasImporterProps {
  transactions: TransactionRecord[];
  schemes: Record<string, MutualFundScheme>;
  onImportTransactions: (newTransactions: TransactionRecord[], replaceExisting: boolean) => void;
  onResetDemoData: () => void;
}

export const CasImporter: React.FC<CasImporterProps> = ({
  transactions,
  schemes,
  onImportTransactions,
  onResetDemoData
}) => {
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<TransactionRecord[]>([]);
  const [replaceMode, setReplaceMode] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const result = parseCasStatement(content);

        if (result.transactions.length > 0) {
          setParsedPreview(result.transactions);
          setImportStatus('success');
          setStatusMessage(`Successfully parsed ${result.transactions.length} transactions from "${file.name}"!`);
          
          try {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.7 }
            });
          } catch {
            // Ignore confetti error
          }
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
  };

  const handleCommitImport = () => {
    if (parsedPreview.length > 0) {
      onImportTransactions(parsedPreview, replaceMode);
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

  return (
    <div className="space-y-6">
      {/* Privacy Guarantee Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-1">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Consolidated Account Statement (CAS) Importer & Backup
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  100% Client-Side Private
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Your statements and folios are processed entirely in your browser using IndexedDB & Web Workers. No financial records are ever sent to any external server.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2 Main Action Columns: Import & Quick Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Statement Area */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              Upload CAMS / KFintech / CSV Statement
            </h3>
            <p className="text-xs text-neutral-400">
              Supports CAMS eCAS JSON, KFintech statement JSON, or MFTracker export CSV.
            </p>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 border-2 border-dashed border-neutral-700 hover:border-emerald-500/70 bg-neutral-800/40 hover:bg-neutral-800/80 rounded-2xl p-8 text-center cursor-pointer transition group"
            >
              <FileText className="w-10 h-10 mx-auto text-neutral-500 group-hover:text-emerald-400 transition mb-3" />
              <p className="text-sm font-semibold text-neutral-200 group-hover:text-white">
                Click to browse statement file or drag and drop
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Supported formats: .json, .csv, .txt
              </p>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".json,.csv,.txt" 
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
                className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition ${replaceMode ? 'bg-emerald-600 text-white' : 'text-neutral-400'}`}
              >
                Replace Portfolio
              </button>
              <button
                type="button"
                onClick={() => setReplaceMode(false)}
                className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition ${!replaceMode ? 'bg-emerald-600 text-white' : 'text-neutral-400'}`}
              >
                Append / Merge
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions & Demo Reset */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-teal-400" />
              Presets & Backup Export
            </h3>
            <p className="text-xs text-neutral-400">
              Export encrypted snapshots or initialize with realistic sample data.
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
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white cursor-pointer transition shrink-0 ml-3"
                >
                  Load Demo
                </button>
              </div>

              {/* Export Backup JSON */}
              <div className="bg-neutral-800/40 border border-neutral-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Export Full Portfolio Backup (.json)</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Download complete snapshot of all {transactions.length} transactions, folios, and NAV states.
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

          <div className="text-[11px] text-neutral-500 border-t border-neutral-800 pt-3 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero tracker logs or third-party cookies stored.</span>
          </div>
        </div>
      </div>

      {/* Status Alerts */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 ${
          importStatus === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
            : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
        }`}>
          {importStatus === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <div className="flex-1 font-medium">{statusMessage}</div>
        </div>
      )}

      {/* Preview Table If File Just Uploaded */}
      {parsedPreview.length > 0 && (
        <div className="bg-neutral-900 border border-emerald-500/40 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">
                Parsed Transactions Preview ({parsedPreview.length} records)
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Review before committing to your active portfolio.
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
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-900/40"
              >
                Commit Import
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-60 border border-neutral-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-800 text-neutral-400 sticky top-0">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Scheme Name</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5 text-right">Units</th>
                  <th className="p-2.5 text-right">NAV</th>
                  <th className="p-2.5 text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800 text-neutral-200">
                {parsedPreview.slice(0, 10).map((t, idx) => (
                  <tr key={idx} className="hover:bg-neutral-800/40">
                    <td className="p-2.5 font-mono">{t.date}</td>
                    <td className="p-2.5 truncate max-w-xs">{t.schemeName}</td>
                    <td className="p-2.5">{t.type}</td>
                    <td className="p-2.5 text-right font-mono">{t.units.toFixed(3)}</td>
                    <td className="p-2.5 text-right font-mono">₹{t.nav.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-400">₹{t.amount.toFixed(2)}</td>
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
