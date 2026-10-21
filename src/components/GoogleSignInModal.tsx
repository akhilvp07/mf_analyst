import React, { useState } from 'react';
import { Shield, Cloud, Smartphone, Lock, X, AtSign } from 'lucide-react';

interface GoogleSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: (emailHint?: string) => Promise<void>;
  isLoading: boolean;
  errorMessage?: string | null;
}

export const GoogleSignInModal: React.FC<GoogleSignInModalProps> = ({
  isOpen,
  onClose,
  onSignIn,
  isLoading,
  errorMessage
}) => {
  const [preferredEmail, setPreferredEmail] = useState('');
  const [showAdvancedEmail, setShowAdvancedEmail] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignIn(preferredEmail.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-neutral-900 border border-neutral-700/80 rounded-2xl p-6 sm:p-7 shadow-2xl text-neutral-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-modal-title"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-neutral-950 font-bold mb-4">
          <Cloud className="w-6 h-6 text-neutral-950" />
        </div>

        {/* Title & Description */}
        <h2 id="signin-modal-title" className="text-xl font-bold tracking-tight text-white">
          Sign In to Sync Your Portfolio
        </h2>
        <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
          Connect your Google account to automatically sync your holdings, transactions, and CAS imports across all your devices using a private JSON file in your Google Drive.
        </p>

        {/* Privacy & Feature Highlights */}
        <div className="my-4 space-y-2.5 bg-neutral-800/60 border border-neutral-700/50 rounded-xl p-3.5 text-xs text-neutral-300">
          <div className="flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">100% Free & Personal Google Drive (0 Cost):</span>
              <span className="text-neutral-400 block text-[11px] mt-0.5">
                Uses your own existing personal Google Drive (free 15 GB storage). The portfolio file is only ~50 KB. <strong className="text-emerald-300">No paid services, no credit card, and no billing required.</strong>
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Private Single File of Truth:</span>
              <span className="text-neutral-400 block text-[11px] mt-0.5">
                Stored in your Drive's private AppData folder. Works with any account (e.g. your primary or secondary Google account). Only you can access it.
              </span>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Multi-Device Sync & CAS Import:</span>
              <span className="text-neutral-400 block text-[11px] mt-0.5">
                Import CAS on one device, and it immediately syncs to your Drive so your other devices stay up-to-date.
              </span>
            </div>
          </div>
        </div>

        {/* Error alert with specialized 403 guidance */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 mt-1"></span>
              <div className="font-semibold text-rose-300">
                {errorMessage.toLowerCase().includes('403') || errorMessage.toLowerCase().includes('access_denied') || errorMessage.toLowerCase().includes('tester')
                  ? 'Access Blocked (Error 403: Testing Mode Restricted)'
                  : 'Sign-In Error'}
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-200/90 pl-4">
              {errorMessage}
            </p>

            {(errorMessage.toLowerCase().includes('403') || 
              errorMessage.toLowerCase().includes('access_denied') || 
              errorMessage.toLowerCase().includes('tester') ||
              errorMessage.toLowerCase().includes('verification')) && (
              <div className="mt-2 pl-4 pt-2 border-t border-rose-500/20 text-[11px] text-neutral-300 space-y-1.5">
                <p className="font-semibold text-amber-300">How to fix this:</p>
                <div className="space-y-1 text-neutral-300 text-[11px]">
                  <div>
                    <strong className="text-white">Option 1 (Instant):</strong> Sign in using your primary Google account (the developer account that created this project).
                  </div>
                  <div>
                    <strong className="text-white">Option 2 (To use an alternate account):</strong> Add your alternate email to the Google Cloud Console Test Users:
                    <ol className="list-decimal list-inside pl-1 text-[10px] text-neutral-400 mt-1 space-y-0.5">
                      <li>Open <a href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0049174366" target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300">Google Cloud Consent Screen</a></li>
                      <li>Scroll down to <strong>Test users</strong> and click <strong>+ ADD USERS</strong></li>
                      <li>Type your alternate email and click <strong>Save</strong></li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Optional Alternate Email Input Accordion */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAdvancedEmail(!showAdvancedEmail)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <AtSign className="w-3 h-3" />
                <span>{showAdvancedEmail ? 'Hide email target field' : 'Target specific account (optional)'}</span>
              </button>
              {preferredEmail && (
                <span className="text-[10px] text-neutral-400 font-mono truncate max-w-[150px]">
                  {preferredEmail}
                </span>
              )}
            </div>

            {showAdvancedEmail && (
              <div className="animate-in fade-in duration-150 pt-1">
                <input
                  type="email"
                  value={preferredEmail}
                  onChange={(e) => setPreferredEmail(e.target.value)}
                  placeholder="e.g. yourname@gmail.com (or leave empty to choose)"
                  className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 font-mono outline-none transition"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  Google's account chooser will open. If specified, this email will be pre-selected in Google's prompt.
                </p>
              </div>
            )}
          </div>

          {/* Official Google Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            )}
            <span>
              {isLoading 
                ? 'Connecting with Google...' 
                : preferredEmail 
                ? `Sign in as ${preferredEmail}` 
                : 'Sign in with Google'}
            </span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-400 hover:text-neutral-200 text-xs font-medium transition cursor-pointer border border-neutral-700/60"
          >
            Continue in Offline / Local Mode
          </button>
        </form>

        <p className="mt-4 text-[10px] text-center text-neutral-500">
          Uses Google Drive App Data scope (<span className="font-mono text-neutral-400">drive.appdata</span>). Your files remain private and confidential.
        </p>
      </div>
    </div>
  );
};
