import express from 'express';
import path from 'path';
import https from 'https';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import helmet from 'helmet';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Security headers with content security policy configured for development and external CDN assets
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '10mb' }));


// In-memory cache for AMFI NAV data
let cachedAmfiText = '';
let lastAmfiFetchTime = 0;

function fetchAmfiWithRedirects(targetUrl: string, maxRedirects: number = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      return reject(new Error('Too many redirects while fetching AMFI NAV data'));
    }

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/plain, text/html, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    };

    https
      .get(targetUrl, options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, targetUrl).toString();
          return resolve(fetchAmfiWithRedirects(redirectUrl, maxRedirects - 1));
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`AMFI returned HTTP status ${res.statusCode}`));
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// 1. Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 2. AMFI NAV proxy endpoint
app.get(['/api/amfi-nav', '/api/amfi/navall'], async (req, res) => {
  const isForce = req.query.force === 'true' || req.headers['cache-control']?.includes('no-cache');
  if (!isForce && cachedAmfiText && Date.now() - lastAmfiFetchTime < 1000 * 60 * 60) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end(cachedAmfiText);
  }

  try {
    const rawText = await fetchAmfiWithRedirects('https://portal.amfiindia.com/spages/NAVAll.txt');
    if (rawText && rawText.includes(';')) {
      cachedAmfiText = rawText;
      lastAmfiFetchTime = Date.now();
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.end(rawText);
    }
    throw new Error('Received incomplete response from AMFI');
  } catch (err: any) {
    if (cachedAmfiText) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(cachedAmfiText);
    }
    res.status(502).json({ error: 'Failed to fetch AMFI NAV data', details: err?.message });
  }
});


// Helper to fetch live official Nifty 50 Consolidated P/E Ratio (TTM)
function fetchOfficialNiftyPeTtm(): Promise<number | null> {
  return new Promise((resolve) => {
    const req = https.get('https://nifty-pe-ratio.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 3500
    }, (resp) => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => {
        const m = d.match(/Nifty 50 PE ratio is ([0-9]+(?:\.[0-9]+)?)/i) || 
                  d.match(/Nifty 50 PE Ratio Today:\s*([0-9]+(?:\.[0-9]+)?)/i);
        if (m && m[1]) {
          const val = parseFloat(m[1]);
          if (val > 10 && val < 45) {
            return resolve(Number(val.toFixed(2)));
          }
        }
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// 5. Nifty 50 Market Analysis & Opportunity Alerts Endpoint
app.get('/api/market/nifty', async (req, res) => {
  try {
    const fetchYahooNifty = (): Promise<any> => {
      return new Promise((resolve, reject) => {
        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json',
          },
          timeout: 4000,
        };
        // Fetch up to 1 year of daily history to dynamically compute true peak
        https.get('https://query2.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=1y&interval=1d', options, (resp) => {
          let raw = '';
          resp.on('data', c => raw += c);
          resp.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              resolve(parsed);
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });
    };

    let latestClose = 23146.15;
    let prevClose = 22997.35;
    let history: Array<{ date: string; close: number; peak: number; drawdownPercent: number; pe: number | null; peTtm: number | null; isDrawdownAlert: boolean; isPeAlert: boolean }> = [];
    let lastTradeTimestamp = Date.now();
    let isStale = false;
    let dynamicPeak = 26216.05;
    let dynamicPeakDate = '2024-09-27';

    const [yahooData, fetchedPeTtm] = await Promise.all([
      fetchYahooNifty().catch((err) => {
        console.warn('Yahoo Finance Nifty fetch error:', err?.message);
        return null;
      }),
      fetchOfficialNiftyPeTtm().catch(() => null)
    ]);

    const currentPeTtm: number | null = fetchedPeTtm;

    if (yahooData?.chart?.result?.[0]) {
      const result = yahooData.chart.result[0];
      const meta = result.meta;
      latestClose = Number(meta.regularMarketPrice || latestClose);
      prevClose = Number(meta.chartPreviousClose || meta.previousClose || prevClose);
      if (meta.regularMarketTime) {
        lastTradeTimestamp = meta.regularMarketTime * 1000;
        // Check if market data is older than 5 days (e.g. prolonged weekend/holiday or stale connection)
        if (Date.now() - lastTradeTimestamp > 5 * 24 * 60 * 60 * 1000) {
          isStale = true;
        }
      }

      const timestamps: number[] = result.timestamp || [];
      const quotes: number[] = result.indicators?.quote?.[0]?.close || [];

      // Find true dynamic peak across the entire retrieved dataset
      for (let idx = 0; idx < quotes.length; idx++) {
        const c = quotes[idx];
        if (c && !isNaN(c) && c > dynamicPeak) {
          dynamicPeak = Number(c.toFixed(2));
          if (timestamps[idx]) {
            dynamicPeakDate = new Date(timestamps[idx] * 1000).toISOString().split('T')[0];
          }
        }
      }

      // Compute trailing EPS if PE is known
      const currentCloseVal = Number(latestClose.toFixed(2));
      const effectiveTtmEps = currentPeTtm && currentPeTtm > 0 ? (currentCloseVal / currentPeTtm) : null;

      let runningPeak = 0;
      history = timestamps.map((ts, idx) => {
        const c = quotes[idx];
        if (!c || isNaN(c)) return null;
        const roundedClose = Number(c.toFixed(2));
        if (roundedClose > runningPeak) runningPeak = roundedClose;
        const dd = Number((((roundedClose - runningPeak) / runningPeak) * 100).toFixed(2));
        const isLatestPoint = (idx === timestamps.length - 1);
        const peVal = isLatestPoint 
          ? currentPeTtm 
          : (effectiveTtmEps ? Number((roundedClose / effectiveTtmEps).toFixed(2)) : null);
        const dStr = new Date(ts * 1000).toISOString().split('T')[0];
        return {
          date: dStr,
          close: roundedClose,
          peak: runningPeak,
          drawdownPercent: dd,
          pe: peVal,
          peTtm: peVal,
          isDrawdownAlert: !isStale && dd <= -15.0,
          isPeAlert: !isStale && peVal !== null && peVal < 20.0
        };
      }).filter(Boolean) as any[];
    } else {
      isStale = true;
    }

    const currentClose = Number(latestClose.toFixed(2));
    const pointDrop = Number((dynamicPeak - currentClose).toFixed(2));
    const percentDrop = Number((((currentClose - dynamicPeak) / dynamicPeak) * 100).toFixed(2));
    const is15PercentDropAlert = !isStale && percentDrop <= -15.0;
    const triggerLevel15Percent = Number((dynamicPeak * 0.85).toFixed(2));
    const pointsTo15Drop = Number((currentClose - triggerLevel15Percent).toFixed(2));

    const isPeBelow20Alert = !isStale && currentPeTtm !== null && currentPeTtm < 20.0;
    let peZone: 'deep_value' | 'accumulation' | 'fair' | 'expensive' | 'unknown' = 'unknown';
    if (currentPeTtm !== null) {
      if (currentPeTtm < 20.0) peZone = 'deep_value';
      else if (currentPeTtm <= 22.0) peZone = 'accumulation';
      else if (currentPeTtm <= 24.5) peZone = 'fair';
      else peZone = 'expensive';
    }

    const changePts = Number((currentClose - prevClose).toFixed(2));
    const changePct = Number(((changePts / prevClose) * 100).toFixed(2));

    // Conditional concise summary (never blindly claims Buy Opportunity Triggered)
    let conciseSummary = `Nifty 50 closed at ${currentClose.toLocaleString('en-IN')}, which is ${Math.abs(pointDrop).toLocaleString('en-IN')} points (${Math.abs(percentDrop)}%) below peak ${dynamicPeak.toLocaleString('en-IN')} (${dynamicPeakDate}).`;
    if (isStale) {
      conciseSummary += ' (Market feed is currently stale; opportunity alerts suppressed).';
    } else if (isPeBelow20Alert) {
      conciseSummary += ` Current Nifty P/E (TTM) is ${currentPeTtm?.toFixed(2)} (< 20.00 Valuation Buy Opportunity Active).`;
    } else if (currentPeTtm !== null) {
      conciseSummary += ` Current Nifty P/E (TTM) is ${currentPeTtm.toFixed(2)} (${peZone} zone).`;
    } else {
      conciseSummary += ' (Live P/E data currently unavailable).';
    }

    res.json({
      symbol: '^NSEI',
      name: 'NIFTY 50 Index',
      currentClose,
      previousClose: prevClose,
      change: changePts,
      changePercent: changePct,
      lastUpdated: new Date(lastTradeTimestamp).toISOString(),
      isStale,
      allTimePeak: dynamicPeak,
      allTimePeakDate: dynamicPeakDate,
      pointDropFromPeak: pointDrop,
      percentDropFromPeak: percentDrop,
      drawdownTriggerPercent: 15.0,
      isDrawdownAlertActive: is15PercentDropAlert,
      triggerLevel15Percent,
      pointsTo15PercentTrigger: pointsTo15Drop,
      currentPe: currentPeTtm,
      currentPeTtm,
      peTtm: currentPeTtm,
      peThreshold: 20.0,
      isPeAlertActive: isPeBelow20Alert,
      peZone,
      pointsToPe20Threshold: null,
      conciseSummary,
      history,
    });
  } catch (err: any) {
    console.error('Nifty Market API error:', err);
    res.status(500).json({ error: 'Failed to retrieve market data' });
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MFTracker Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
