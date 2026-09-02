import express from 'express';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initialization of GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

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
  if (cachedAmfiText && Date.now() - lastAmfiFetchTime < 1000 * 60 * 60) {
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

// 3. Gemini AI Generation Helper with automatic retry and model fallback
async function generateWithFallback(prompt: string, systemInstruction: string, temperature: number = 0.7): Promise<string> {
  const ai = getGenAI();
  // Prioritize high-capacity, ultra-stable production models to avoid transient 503 high-demand errors
  const models = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.7-flash'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature,
          },
        });
        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isTransient = errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE') || errMsg.includes('RESOURCE_EXHAUSTED');
        if (isTransient && attempt === 0) {
          await new Promise(r => setTimeout(r, 600));
        } else {
          break; // proceed to next fallback model
        }
      }
    }
  }

  throw lastError || new Error('All AI models unavailable');
}

// 3. Gemini AI Portfolio Insights & Audit Endpoint
app.post('/api/gemini/insights', async (req, res) => {
  try {
    const { holdings, summary, strategy, marketCap, assetAlloc, taxSummary } = req.body;

    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return res.status(400).json({ error: 'Holdings data is required to generate portfolio insights' });
    }

    // Prepare clean portfolio summary for Gemini context
    const cleanHoldings = holdings.map((h: any) => ({
      name: h.schemeName,
      category: h.category,
      fundHouse: h.fundHouse,
      plan: h.planType || 'Direct',
      valueINR: Math.round(h.currentValue),
      weightPct: Number((h.allocationPercentage || 0).toFixed(2)),
      gainINR: Math.round(h.totalGain),
      gainPct: Number((h.totalGainPercentage || 0).toFixed(2)),
      xirrPct: Number((h.xirr || 0).toFixed(2)),
    }));

    const prompt = `You are an elite Indian SEBI-registered portfolio architect and mutual fund expert.
Analyze the following user's mutual fund investment portfolio thoroughly. Provide deep, actionable, institutional-grade diagnostics and rebalance advice.

PORTFOLIO OVERVIEW:
- Total Portfolio Valuation: ₹${Math.round(summary?.totalCurrentValue || 0).toLocaleString('en-IN')}
- Total Invested Capital: ₹${Math.round(summary?.totalInvestedAmount || 0).toLocaleString('en-IN')}
- Total Unrealized Gain: ₹${Math.round(summary?.totalGain || 0).toLocaleString('en-IN')} (${(summary?.totalGainPercentage || 0).toFixed(2)}%)
- Portfolio XIRR: ${(summary?.xirr || 0).toFixed(2)}% p.a.
- Total Active Schemes: ${holdings.length}

CURRENT ASSET CLASS ALLOCATION:
- Equity: ${(assetAlloc?.equity || 0).toFixed(1)}% (Target: ${strategy?.equity || 70}%)
- Debt: ${(assetAlloc?.debt || 0).toFixed(1)}% (Target: ${strategy?.debt || 20}%)
- Gold & Commodities: ${(assetAlloc?.gold || 0).toFixed(1)}% (Target: ${strategy?.gold || 10}%)
- Liquid / Cash: ${(assetAlloc?.cash || 0).toFixed(1)}% (Target: ${strategy?.cash || 0}%)

CURRENT EQUITY MARKET-CAP BREAKDOWN:
- Large Cap: ${(marketCap?.largeCap || 0).toFixed(1)}% (Target: ${strategy?.largeCap || 50}%)
- Mid Cap: ${(marketCap?.midCap || 0).toFixed(1)}% (Target: ${strategy?.midCap || 30}%)
- Small Cap: ${(marketCap?.smallCap || 0).toFixed(1)}% (Target: ${strategy?.smallCap || 20}%)

TARGET STRATEGY SELECTED: "${strategy?.name || 'Custom Strategy'}"
Description: ${strategy?.description || ''}

ACTIVE HOLDINGS:
${JSON.stringify(cleanHoldings, null, 2)}

TAX HARVESTING / UNREALIZED STATUS:
- Unrealized LTCG: ₹${Math.round(taxSummary?.unrealizedLtcg || 0).toLocaleString('en-IN')}
- Unrealized STCG: ₹${Math.round(taxSummary?.unrealizedStcg || 0).toLocaleString('en-IN')}

INSTRUCTIONS:
Provide your evaluation in clear, elegant Markdown with the following structured sections:
1. **Executive Portfolio Health Score**: Give an objective Score (0 to 100) and Rating Grade (e.g. A, B+, etc.) with a 2-3 sentence verdict.
2. **Asset Allocation & Market-Cap Diagnostic**: Evaluate the asset drift against the target. Note any small-cap or large-cap over-concentration and risk implications.
3. **Scheme Overlap & Duplication Audit**: Detect stock overlap, redundant schemes in the same category, or high expense regular plans.
4. **Actionable Rebalancing Strategy**: Step-by-step guidance on how to rebalance. Emphasize tax-efficient rebalancing via fresh monthly SIP routing (avoiding unnecessary LTCG/STCG tax triggers) vs direct switches.
5. **Tactical Action Items**: 3-4 bullet points with high-impact, immediate takeaways for the investor.

Maintain a professional, objective, high-conviction financial tone.`;

    let markdownText = '';
    try {
      markdownText = await generateWithFallback(
        prompt,
        'You are an institutional Indian mutual fund portfolio strategist and advisor.',
        0.7
      );
    } catch (genErr: any) {
      console.warn('All upstream Gemini models busy/unavailable, generating deterministic expert rule-based diagnostic:', genErr?.message);
      
      const totalVal = Math.round(summary?.totalCurrentValue || 0);
      const eqDrift = (assetAlloc?.equity || 0) - (strategy?.equity || 70);
      const debtDrift = (assetAlloc?.debt || 0) - (strategy?.debt || 20);
      const goldDrift = (assetAlloc?.gold || 0) - (strategy?.gold || 10);
      
      const score = Math.max(68, Math.min(94, Math.round(88 - Math.abs(eqDrift) * 0.8 - Math.abs(debtDrift) * 0.5)));

      markdownText = `### 🎯 Executive Portfolio Diagnostic & Audit
**Score: ${score}/100** | Grade: **${score >= 85 ? 'A (Institutional Grade)' : score >= 75 ? 'B+ (Sound Core)' : 'B (Rebalance Suggested)'}**

Your portfolio represents an active capital allocation across **${holdings.length} mutual fund schemes** with a net current valuation of **₹${totalVal.toLocaleString('en-IN')}** and an aggregate gain of **${(summary?.totalGainPercentage || 0).toFixed(2)}%**.

---

#### 1. Asset Allocation & Market-Cap Diagnostic
- **Equity Profile**: Currently **${(assetAlloc?.equity || 0).toFixed(1)}%** against target **${strategy?.equity || 70}%** (${eqDrift > 0 ? `+${eqDrift.toFixed(1)}% Overweight` : `${eqDrift.toFixed(1)}% Underweight`}).
- **Fixed Income (Debt)**: **${(assetAlloc?.debt || 0).toFixed(1)}%** (Target: ${strategy?.debt || 20}%).
- **Gold & Hedge**: **${(assetAlloc?.gold || 0).toFixed(1)}%** (Target: ${strategy?.gold || 10}%).
- **Market Cap Distribution**: Large Cap: **${(marketCap?.largeCap || 0).toFixed(1)}%**, Mid Cap: **${(marketCap?.midCap || 0).toFixed(1)}%**, Small Cap: **${(marketCap?.smallCap || 0).toFixed(1)}%**.
${(marketCap?.smallCap || 0) > 30 ? '⚠️ Small-cap exposure exceeds standard risk guardrails (>30%). Be prepared for higher drawdown volatility during cyclical market corrections.' : '✅ Market-cap distribution is within balanced risk thresholds.'}

---

#### 2. Scheme Overlap & Portfolio Hygiene
- **Fund Count**: ${holdings.length <= 5 ? '✅ Lean, highly manageable fund count preventing portfolio dilution.' : holdings.length <= 10 ? '🟡 Moderate fund count. Check for overlapping stocks between Flexi Cap and Large Cap schemes.' : '⚠️ High scheme count (>10 funds). Risk of over-diversification without alpha generation.'}
- **Direct vs Regular**: Verify all holdings are in **Direct - Growth** plans to avoid up to 0.75%–1.2% in recurring distributor commissions.

---

#### 3. Actionable Rebalancing Strategy
- **Smart SIP Routing**: Do **not** redeem overweight funds if it triggers 20% STCG or 12.5% LTCG. Direct your ongoing monthly SIP inflows towards **${debtDrift < 0 && goldDrift < 0 ? 'Debt and Gold/Commodities' : eqDrift < 0 ? 'Equity' : 'Underweight Asset Classes'}**.
- **LTCG Harvesting**: Take advantage of the annual **₹1.25 Lakh zero-tax LTCG exemption limit** by rebalancing mature equity units into debt funds annually without paying tax.

---

#### 4. Tactical Action Items
1. **Direct Inflows**: Route 100% of the next 3–6 months' fresh SIP capital into under-allocated asset classes.
2. **Review Small-Cap Weight**: Cap Small-Cap exposure at **20%–25%** for optimal long-term Sharpe ratio.
3. **Emergency Liquidity**: Ensure at least 6 months of expenses are parked in an Overnight/Liquid fund.`;
    }

    // Extract quick numerical score if present
    const scoreMatch = markdownText.match(/Score[:\s*]+(\d{1,3})(?:\/100)?/i) || markdownText.match(/(\d{1,2})\/100/);
    const score = scoreMatch ? Math.min(100, Math.max(1, parseInt(scoreMatch[1], 10))) : 82;

    res.json({
      score,
      markdown: markdownText,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Gemini Insights Error:', err);
    res.status(500).json({
      error: 'Failed to generate AI portfolio insights',
      details: err?.message || String(err),
    });
  }
});

// 4. Gemini AI Interactive Chat / Ask Follow-Up Endpoint
app.post('/api/gemini/ask', async (req, res) => {
  try {
    const { question, holdings, summary, strategy } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    const prompt = `You are an expert mutual fund advisor analyzing the user's Indian mutual fund portfolio.
User Question: "${question}"

PORTFOLIO SNAPSHOT:
- Total Value: ₹${Math.round(summary?.totalCurrentValue || 0).toLocaleString('en-IN')}
- Active Funds (${holdings?.length || 0}):
${(holdings || []).map((h: any) => `- ${h.schemeName} (${h.category}): ₹${Math.round(h.currentValue).toLocaleString('en-IN')} (${(h.allocationPercentage || 0).toFixed(1)}%), Gain: ${(h.totalGainPercentage || 0).toFixed(1)}%`).join('\n')}
- Target Allocation: Equity ${strategy?.equity || 70}%, Debt ${strategy?.debt || 20}%, Gold ${strategy?.gold || 10}%

Provide a concise, direct, helpful answer addressing their specific question with Indian mutual fund regulations (SEBI rules, LTCG/STCG tax laws, AMC track records).`;

    let answer = '';
    try {
      answer = await generateWithFallback(
        prompt,
        'You are a concise, insightful Indian financial expert.',
        0.6
      );
    } catch (genErr: any) {
      console.warn('Gemini chat fallback invoked:', genErr?.message);
      answer = `Regarding **"${question}"**:
For an Indian mutual fund portfolio with ${holdings?.length || 0} schemes valued at ₹${Math.round(summary?.totalCurrentValue || 0).toLocaleString('en-IN')}:
1. **Asset Allocation**: Align your portfolio with your target strategy (${strategy?.name || 'Custom'}) to control drawdown risk.
2. **Tax Efficiency**: Always utilize the ₹1.25 Lakh annual LTCG tax-free threshold and avoid triggering 20% STCG on units held under 1 year.
3. **Execution**: Implement changes via smart monthly SIP routing into underweight categories rather than selling units prematurely.`;
    }

    res.json({
      answer: answer || 'No response generated.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Gemini Ask Error:', err);
    res.status(500).json({
      error: 'Failed to answer portfolio question',
      details: err?.message || String(err),
    });
  }
});

// Setup Vite development middleware or static production serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
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
