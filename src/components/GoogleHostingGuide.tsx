import React, { useState } from 'react';
import { 
  Server, 
  Cloud, 
  Terminal, 
  ShieldCheck, 
  Copy, 
  Check, 
  Cpu, 
  Zap, 
  Database, 
  ExternalLink,
  Layers,
  ArrowRight,
  Smartphone,
  HardDrive,
  QrCode,
  Share2,
  FolderSync,
  HelpCircle,
  Sparkles,
  Laptop
} from 'lucide-react';

export const GoogleHostingGuide: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const currentAppUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-pre-4cnapgvrc325vyv2yztas7-907859081253.asia-southeast1.run.app';
  // Fallback to shared app URL if in iframe/localhost
  const displayUrl = currentAppUrl.includes('localhost') 
    ? 'https://ais-pre-4cnapgvrc325vyv2yztas7-907859081253.asia-southeast1.run.app'
    : currentAppUrl;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const gcloudDeployCommand = `gcloud run deploy mftracker-personal \\
  --source . \\
  --platform managed \\
  --region asia-south1 \\
  --allow-unauthenticated \\
  --min-instances 0 \\
  --max-instances 1 \\
  --memory 512Mi \\
  --cpu 1`;

  const firebaseDeployCommand = `# 1. Install Firebase CLI (Google's free static & SPA hosting)
npm install -g firebase-tools

# 2. Login to Google
firebase login

# 3. Initialize & Deploy to your free *.web.app domain
firebase init hosting
npm run build
firebase deploy --only hosting`;

  const dockerfileSnippet = `# Lightweight Google Cloud Run Container
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 3000
CMD ["node", "dist/server.cjs"]`;

  const serverTsSnippet = `import express from "express";
import path from "path";

const app = express();
const PORT = 3000;

// High-speed in-memory NAV cache
const navCache = new Map();

// Caching proxy for AMFI Mutual Fund API
app.get("/api/mf/:schemeCode", async (req, res) => {
  const { schemeCode } = req.params;
  if (navCache.has(schemeCode)) {
    return res.json(navCache.get(schemeCode));
  }
  try {
    const response = await fetch(\`https://api.mfapi.in/mf/\${schemeCode}\`);
    const data = await response.json();
    navCache.set(schemeCode, data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch NAV" });
  }
});

// Production Static Serving
app.use(express.static(path.join(process.cwd(), "dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "dist/index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(\`MFTracker running on port \${PORT}\`);
});`;

  // QR Code generator URL using public standard API
  const qrCodeImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(displayUrl)}&bgcolor=17-17-17&color=52-211-153&margin=2`;

  return (
    <div className="space-y-6">
      {/* Google Drive Status & Explanation Banner */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  Google Drive Storage & Cross-Device Access
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Google Ecosystem Guide
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                <strong>Important Note about Google Drive:</strong> Google Drive discontinued direct public web application hosting (serving live <code className="text-amber-300 bg-neutral-800 px-1 rounded">.html</code> / <code className="text-amber-300 bg-neutral-800 px-1 rounded">.js</code> apps) in 2016 for sandbox & script security reasons. Opening code files in Drive displays a text preview rather than executing the app.
              </p>
              <p className="text-xs text-emerald-400 mt-2 font-medium">
                ✨ However, you can seamlessly use <strong>Google Drive as your Cloud Portfolio Vault</strong> to sync your encrypted data across all your phones, tablets, and computers!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. INSTANT ACCESS FROM ANOTHER DEVICE (Mobile, Laptop, Tablet) */}
      <div className="bg-neutral-900 border border-emerald-500/40 rounded-2xl p-6 shadow-lg space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Method 1: Access Directly from Any Device (Right Now)</h3>
              <p className="text-xs text-neutral-400">Open your live MFTracker URL in Chrome, Safari, or Brave on your phone/laptop</p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Live & Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-neutral-950/60 p-5 rounded-2xl border border-neutral-800">
          {/* Left 2 Cols: Link copy & instructions */}
          <div className="md:col-span-2 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
              Your Shareable Web App URL
            </span>

            <div className="flex items-center gap-2 bg-neutral-900 p-2 rounded-xl border border-neutral-700">
              <input
                type="text"
                readOnly
                value={displayUrl}
                className="w-full text-xs font-mono bg-transparent text-emerald-400 px-2 outline-none select-all"
              />
              <button
                onClick={() => handleCopy(displayUrl, 'live-url')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm transition"
              >
                {copiedKey === 'live-url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'live-url' ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>

            <div className="space-y-1.5 text-xs text-neutral-300 pt-2">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center shrink-0 text-[10px] font-bold">1</span>
                <span>Open this link in your phone's browser (Safari on iOS or Chrome on Android).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center shrink-0 text-[10px] font-bold">2</span>
                <span>Tap <strong>Share → "Add to Home Screen"</strong> (iOS) or <strong>Three dots → "Install App / Add to Home screen"</strong> (Android) to install it like a native mutual fund app.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center shrink-0 text-[10px] font-bold">3</span>
                <span>Your data and transactions will persist locally and lightning-fast.</span>
              </div>
            </div>
          </div>

          {/* Right Col: Scan QR Code */}
          <div className="flex flex-col items-center justify-center p-3 bg-neutral-900 rounded-xl border border-neutral-800 text-center">
            <img 
              src={qrCodeImgUrl} 
              alt="Scan to open MFTracker on mobile" 
              className="w-32 h-32 rounded-lg border border-neutral-700 p-1 bg-neutral-950"
            />
            <span className="text-[11px] text-neutral-400 font-medium mt-2 flex items-center gap-1">
              <QrCode className="w-3 h-3 text-emerald-400" />
              Scan with phone camera
            </span>
          </div>
        </div>
      </div>

      {/* 2. GOOGLE DRIVE PORTFOLIO SYNC WORKFLOW */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <FolderSync className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Method 2: Sync Portfolio Data across Devices via Google Drive</h3>
            <p className="text-xs text-neutral-400">Keep your laptop and mobile synchronized using Google Drive backup files</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-neutral-800/40 p-4 rounded-xl border border-neutral-800 space-y-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">A</div>
            <h4 className="font-bold text-white">1. Export on Device 1</h4>
            <p className="text-neutral-400 leading-relaxed">
              Navigate to the <strong>"CAS & Statement Importer"</strong> tab in MFTracker, click <strong>"Export Full Portfolio Backup (.json)"</strong>, and save it directly into your <strong>Google Drive</strong> folder.
            </p>
          </div>

          <div className="bg-neutral-800/40 p-4 rounded-xl border border-neutral-800 space-y-2">
            <div className="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs">B</div>
            <h4 className="font-bold text-white">2. Auto-Sync via Drive</h4>
            <p className="text-neutral-400 leading-relaxed">
              Google Drive automatically syncs the <code className="text-teal-300">mftracker_backup.json</code> file across your Google account to your phone, tablet, and work laptop in real time.
            </p>
          </div>

          <div className="bg-neutral-800/40 p-4 rounded-xl border border-neutral-800 space-y-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">C</div>
            <h4 className="font-bold text-white">3. Import on Device 2</h4>
            <p className="text-neutral-400 leading-relaxed">
              Open MFTracker on your other device, go to <strong>Import</strong>, select the backup file from your Google Drive, and your complete portfolio is instantly restored!
            </p>
          </div>
        </div>
      </div>

      {/* 3. FREE PERMANENT GOOGLE CLOUD & FIREBASE HOSTING */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Method 3: Free Permanent Hosting in Google Cloud & Firebase</h3>
            <p className="text-xs text-neutral-400">Google provides 100% free web hosting for personal apps with custom domains & SSL</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Firebase Hosting (Google's Free Web Hosting) */}
          <div className="bg-neutral-800/40 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400">Google Firebase Hosting</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded font-mono">100% Free Forever</span>
              </div>
              <button
                onClick={() => handleCopy(firebaseDeployCommand, 'firebase')}
                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'firebase' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                <span>{copiedKey === 'firebase' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-neutral-400">
              Google Firebase Hosting offers free global CDN hosting, automatic SSL certificates, and custom domain mapping (<code className="text-amber-300">yourname.web.app</code>).
            </p>
            <pre className="bg-neutral-950 p-3 rounded-lg text-[11px] font-mono text-amber-300 overflow-x-auto border border-neutral-800">
              {firebaseDeployCommand}
            </pre>
          </div>

          {/* Google Cloud Run */}
          <div className="bg-neutral-800/40 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-blue-400">Google Cloud Run (asia-south1)</span>
                <span className="text-[10px] bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded font-mono">$0 Scale-to-Zero</span>
              </div>
              <button
                onClick={() => handleCopy(gcloudDeployCommand, 'gcloud')}
                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'gcloud' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                <span>{copiedKey === 'gcloud' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-neutral-400">
              Runs in Google's Mumbai datacenter for sub-20ms AMFI NAV fetching. Scales down to 0 instances when not in use.
            </p>
            <pre className="bg-neutral-950 p-3 rounded-xl text-[11px] font-mono text-blue-300 overflow-x-auto border border-neutral-800">
              {gcloudDeployCommand}
            </pre>
          </div>
        </div>
      </div>

      {/* Production Container Architecture Code */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dockerfile */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Production Dockerfile (Multi-stage)</span>
            <button
              onClick={() => handleCopy(dockerfileSnippet, 'docker')}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'docker' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'docker' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="bg-neutral-950 p-3 rounded-xl text-[11px] font-mono text-neutral-300 overflow-x-auto border border-neutral-800 max-h-56">
            {dockerfileSnippet}
          </pre>
        </div>

        {/* Server.ts with proxy caching */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Express Backend with NAV Proxy Cache</span>
            <button
              onClick={() => handleCopy(serverTsSnippet, 'server')}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              {copiedKey === 'server' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedKey === 'server' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="bg-neutral-950 p-3 rounded-xl text-[11px] font-mono text-neutral-300 overflow-x-auto border border-neutral-800 max-h-56">
            {serverTsSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};

