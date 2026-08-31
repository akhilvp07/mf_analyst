import { MutualFundScheme, NavRecord, TransactionRecord, QueryScenario, CodeSnippet } from '../types';

export const SCHEMES: MutualFundScheme[] = [
  {
    schemeCode: '122639',
    schemeName: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth',
    fundHouse: 'PPFAS Mutual Fund',
    category: 'Equity - Flexi Cap',
    currentNav: 82.45,
    navDate: '2026-08-28',
    navChange1D: 0.85,
    cagr3Y: 22.4,
    cagr5Y: 24.1,
    aumCr: 68450,
    expenseRatio: 0.62,
    isin: 'INF879O01027'
  },
  {
    schemeCode: '119063',
    schemeName: 'HDFC Top 100 Fund - Direct Plan - Growth',
    fundHouse: 'HDFC Mutual Fund',
    category: 'Equity - Large Cap',
    currentNav: 1142.18,
    navDate: '2026-08-28',
    navChange1D: -0.32,
    cagr3Y: 18.9,
    cagr5Y: 19.5,
    aumCr: 34120,
    expenseRatio: 0.98,
    isin: 'INF179K01BE2'
  },
  {
    schemeCode: '120503',
    schemeName: 'Quant Small Cap Fund - Direct Plan - Growth',
    fundHouse: 'Quant Mutual Fund',
    category: 'Equity - Small Cap',
    currentNav: 248.90,
    navDate: '2026-08-28',
    navChange1D: 1.42,
    cagr3Y: 28.6,
    cagr5Y: 34.2,
    aumCr: 21890,
    expenseRatio: 0.77,
    isin: 'INF966L01986'
  },
  {
    schemeCode: '118834',
    schemeName: 'Mirae Asset Large Cap Fund - Direct Plan - Growth',
    fundHouse: 'Mirae Asset Mutual Fund',
    category: 'Equity - Large Cap',
    currentNav: 112.35,
    navDate: '2026-08-28',
    navChange1D: 0.12,
    cagr3Y: 16.4,
    cagr5Y: 17.8,
    aumCr: 41200,
    expenseRatio: 0.54,
    isin: 'INF769K01DH6'
  },
  {
    schemeCode: '125497',
    schemeName: 'Nippon India Small Cap Fund - Direct Plan - Growth',
    fundHouse: 'Nippon India Mutual Fund',
    category: 'Equity - Small Cap',
    currentNav: 165.78,
    navDate: '2026-08-28',
    navChange1D: 0.95,
    cagr3Y: 26.2,
    cagr5Y: 31.4,
    aumCr: 54300,
    expenseRatio: 0.69,
    isin: 'INF204K01UX4'
  },
  {
    schemeCode: '119551',
    schemeName: 'SBI Bluechip Fund - Direct Plan - Growth',
    fundHouse: 'SBI Mutual Fund',
    category: 'Equity - Large Cap',
    currentNav: 98.62,
    navDate: '2026-08-28',
    navChange1D: -0.15,
    cagr3Y: 17.2,
    cagr5Y: 18.1,
    aumCr: 46700,
    expenseRatio: 0.85,
    isin: 'INF200K01TS6'
  },
  {
    schemeCode: '120152',
    schemeName: 'Kotak Emerging Equity Fund - Direct Plan - Growth',
    fundHouse: 'Kotak Mahindra Mutual Fund',
    category: 'Equity - Mid Cap',
    currentNav: 135.40,
    navDate: '2026-08-28',
    navChange1D: 0.64,
    cagr3Y: 23.8,
    cagr5Y: 25.6,
    aumCr: 43800,
    expenseRatio: 0.48,
    isin: 'INF174K01LS2'
  }
];

// Generator for synthetic high-volume NAV history (e.g., 10+ years = 3650+ records per fund)
export function generateNavHistory(schemeCode: string, totalPoints: number = 3650, baseNav: number = 80): NavRecord[] {
  const records: NavRecord[] = [];
  let currentNav = baseNav;
  const startDate = new Date(2026, 7, 28); // Aug 28, 2026
  
  // Seed random deterministically based on scheme code
  let seed = 0;
  for (let i = 0; i < schemeCode.length; i++) {
    seed = (seed * 31 + schemeCode.charCodeAt(i)) % 100000;
  }
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = totalPoints - 1; i >= 0; i--) {
    const recordDate = new Date(startDate);
    recordDate.setDate(recordDate.getDate() - i);
    
    // Skip weekends for realistic market day simulation
    const dayOfWeek = recordDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Geometric Brownian Motion daily return with positive long term drift
    const drift = 0.00045; // ~12% annual drift
    const volatility = 0.012; // 1.2% daily stdev
    const shock = (pseudoRandom() + pseudoRandom() + pseudoRandom() - 1.5) * 2;
    const dailyReturn = drift + volatility * shock;
    currentNav = Math.max(10, currentNav * (1 + dailyReturn));

    records.push({
      id: records.length + 1,
      schemeCode,
      navDate: recordDate.toISOString().split('T')[0],
      nav: Number(currentNav.toFixed(4)),
      repurchasePrice: Number(currentNav.toFixed(4)),
      salePrice: Number((currentNav * 1.001).toFixed(4)),
    });
  }

  return records;
}

// Generate high-volume transaction history for testing lazy loading
export function generateTransactions(count: number = 5000): TransactionRecord[] {
  const types: TransactionRecord['type'][] = ['SIP', 'LUMPSUM', 'REDEMPTION', 'SWITCH_IN', 'SWITCH_OUT'];
  const transactions: TransactionRecord[] = [];
  const baseDate = new Date(2026, 7, 28);

  for (let i = 0; i < count; i++) {
    const scheme = SCHEMES[i % SCHEMES.length];
    const txnDate = new Date(baseDate);
    txnDate.setDate(txnDate.getDate() - Math.floor(i / 3));
    
    const type = i % 15 === 0 ? 'REDEMPTION' : i % 5 === 0 ? 'LUMPSUM' : 'SIP';
    const amount = type === 'SIP' ? (i % 3 === 0 ? 5000 : 10000) : (10000 + (i % 20) * 5000);
    const nav = scheme.currentNav * (0.6 + (0.4 * (count - i)) / count);
    const units = Number((amount / nav).toFixed(3));

    transactions.push({
      id: `TXN-${100000 + i}`,
      folioNumber: `FOLIO-98${(i % 12).toString().padStart(4, '0')}`,
      schemeCode: scheme.schemeCode,
      schemeName: scheme.schemeName,
      type,
      date: txnDate.toISOString().split('T')[0],
      units,
      nav: Number(nav.toFixed(4)),
      amount,
      status: 'COMPLETED'
    });
  }

  return transactions;
}

// Largest-Triangle-Three-Buckets (LTTB) Downsampling Algorithm for Large Time-Series
export function downsampleLTTB<T extends { navDate: string; nav: number }>(data: T[], threshold: number): T[] {
  if (threshold >= data.length || threshold === 0) {
    return data;
  }

  const sampled: T[] = [];
  const sampledLength = threshold;
  const every = (data.length - 2) / (sampledLength - 2);

  let a = 0;
  sampled.push(data[a]); // Always add the first point

  for (let i = 0; i < sampledLength - 2; i++) {
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * every) + 1;
    let avgRangeEnd = Math.floor((i + 2) * every) + 1;
    avgRangeEnd = avgRangeEnd < data.length ? avgRangeEnd : data.length;

    const avgRangeLength = avgRangeEnd - avgRangeStart;

    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      avgX += j;
      avgY += data[j].nav;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    // Get the range for this bucket
    const rangeOffs = Math.floor((i + 0) * every) + 1;
    const rangeTo = Math.floor((i + 1) * every) + 1;

    // Point a
    const pointAX = a;
    const pointAY = data[a].nav;

    let maxArea = -1;
    let maxAreaPoint = rangeOffs;

    for (let j = rangeOffs; j < rangeTo; j++) {
      // Calculate triangle area over three buckets
      const area = Math.abs(
        (pointAX - avgX) * (data[j].nav - pointAY) -
        (pointAX - j) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = j;
      }
    }

    sampled.push(data[maxAreaPoint]);
    a = maxAreaPoint;
  }

  sampled.push(data[data.length - 1]); // Always add the last point
  return sampled;
}

// Real-world SQL Query Performance Scenarios & Indexing Optimization
export const QUERY_SCENARIOS: QueryScenario[] = [
  {
    id: 'latest-nav-lookup',
    title: '1. Portfolio Valuation: Latest NAV Lookup Across 50 Funds',
    description: 'Fetch the most recent daily NAV record for every scheme in a user portfolio to calculate current market value and daily P&L.',
    businessCase: 'Called on every portfolio dashboard page load and valuation refresh.',
    datasetSize: '15,000,000 rows in nav_history (3,500 schemes × 15 years daily NAV)',
    querySql: `SELECT DISTINCT ON (scheme_code) 
  scheme_code, nav_date, nav, repurchase_price 
FROM nav_history 
WHERE scheme_code IN ('122639', '119063', '120503', '118834', '125497', '119551', '120152', ...)
ORDER BY scheme_code, nav_date DESC;`,
    unindexed: {
      plan: {
        nodeType: 'Unique',
        startupCost: 145020.15,
        totalCost: 148920.80,
        planRows: 50,
        planWidth: 36,
        actualStartupTime: 840.25,
        actualTotalTime: 924.50,
        actualRows: 50,
        actualLoops: 1,
        sharedHitBlocks: 1240,
        sharedReadBlocks: 48900,
        bottlenecks: [
          'Full Table Sequential Scan (Seq Scan) across 15M rows',
          'Disk Read I/O: 382 MB raw table pages loaded into shared buffers',
          'CPU-heavy in-memory QuickSort on 15M rows to resolve ORDER BY'
        ]
      },
      executionTimeMs: 924.50,
      planningTimeMs: 4.82,
      sharedHitBuffers: 1240,
      sharedReadBuffers: 48900,
      heapFetches: 15000000,
      diskIoKb: 391200,
      bottlenecks: [
        'Seq Scan on nav_history: 924ms',
        'Sort Method: external merge disk sort (38MB temporary disk spill)',
        'Zero index filter pushdown'
      ]
    },
    indexed: {
      indexDdl: `CREATE INDEX idx_nav_scheme_date_desc 
ON nav_history (scheme_code, nav_date DESC) 
INCLUDE (nav, repurchase_price);`,
      indexType: 'B-Tree Multi-Column Covering Index (Index-Only Scan)',
      plan: {
        nodeType: 'Index Only Scan',
        indexName: 'idx_nav_scheme_date_desc',
        indexCond: '(scheme_code = ANY ($1))',
        startupCost: 0.43,
        totalCost: 12.85,
        planRows: 50,
        planWidth: 36,
        actualStartupTime: 0.045,
        actualTotalTime: 1.12,
        actualRows: 50,
        actualLoops: 1,
        sharedHitBlocks: 154,
        sharedReadBlocks: 0,
        heapFetches: 0
      },
      executionTimeMs: 1.12,
      planningTimeMs: 0.35,
      sharedHitBuffers: 154,
      sharedReadBuffers: 0,
      heapFetches: 0,
      diskIoKb: 0,
      speedupFactor: 825.4,
      optimizationsUsed: [
        'Index-Only Scan: Zero heap page lookups (all required columns nav, repurchase_price stored in index leaf pages via INCLUDE)',
        'Pre-sorted B-Tree branch traversal (nav_date DESC eliminates Sort step entirely)',
        'Cache hit ratio: 100% (154 buffer hits, 0 disk I/O reads)'
      ]
    }
  },
  {
    id: 'historical-range-chart',
    title: '2. Time-Series NAV Range Query (5-Year Scheme Chart)',
    description: 'Fetch historical daily NAV data for an individual mutual fund scheme between 2021-01-01 and 2026-08-28 for interactive chart rendering.',
    businessCase: 'Triggered when a user opens the fund details page or toggles 1Y/3Y/5Y/ALL timeframes.',
    datasetSize: '15,000,000 rows in nav_history',
    querySql: `SELECT nav_date, nav 
FROM nav_history 
WHERE scheme_code = '122639' 
  AND nav_date >= '2021-01-01' 
ORDER BY nav_date ASC;`,
    unindexed: {
      plan: {
        nodeType: 'Seq Scan',
        relationName: 'nav_history',
        filter: "((scheme_code = '122639'::text) AND (nav_date >= '2021-01-01'::date))",
        startupCost: 0.00,
        totalCost: 124800.00,
        planRows: 1400,
        planWidth: 16,
        actualStartupTime: 410.10,
        actualTotalTime: 685.30,
        actualRows: 1412,
        actualLoops: 1,
        sharedHitBlocks: 2100,
        sharedReadBlocks: 42000,
        bottlenecks: [
          'Scans entire 15M row table searching for 1,412 records',
          'Filter rejected 14,998,588 rows at runtime',
          'Sort required for nav_date ASC'
        ]
      },
      executionTimeMs: 685.30,
      planningTimeMs: 2.15,
      sharedHitBuffers: 2100,
      sharedReadBuffers: 42000,
      heapFetches: 15000000,
      diskIoKb: 336000,
      bottlenecks: [
        '15,000,000 rows evaluated to yield 1,412 rows (99.99% wasted work)',
        '42,000 8KB blocks loaded from disk cache'
      ]
    },
    indexed: {
      indexDdl: `CREATE INDEX idx_nav_scheme_date_asc_inc 
ON nav_history (scheme_code, nav_date ASC) 
INCLUDE (nav);`,
      indexType: 'Covering Composite Index (Scheme Code + Ascending Date)',
      plan: {
        nodeType: 'Index Only Scan',
        indexName: 'idx_nav_scheme_date_asc_inc',
        indexCond: "((scheme_code = '122639'::text) AND (nav_date >= '2021-01-01'::date))",
        startupCost: 0.42,
        totalCost: 18.45,
        planRows: 1400,
        planWidth: 16,
        actualStartupTime: 0.038,
        actualTotalTime: 0.85,
        actualRows: 1412,
        actualLoops: 1,
        sharedHitBlocks: 28,
        sharedReadBlocks: 0,
        heapFetches: 0
      },
      executionTimeMs: 0.85,
      planningTimeMs: 0.18,
      sharedHitBuffers: 28,
      sharedReadBuffers: 0,
      heapFetches: 0,
      diskIoKb: 0,
      speedupFactor: 806.2,
      optimizationsUsed: [
        'Bounded B-Tree Range Scan: directly jumps to first matching scheme leaf node',
        'Streaming sequential index block read (28 pages vs 44,100 pages)',
        'Zero heap visibility checks required with valid VACUUM VM map'
      ]
    }
  },
  {
    id: 'sip-due-partial-index',
    title: '3. Automated SIP Execution Job: Active Monthly Schedules',
    description: 'Find all active SIP mandates scheduled for today to trigger automated unit purchase orders and bank mandates.',
    businessCase: 'Executed by a daily cron background worker at 06:00 AM across millions of investor accounts.',
    datasetSize: '4,000,000 SIP records (where only ~120,000 are currently ACTIVE)',
    querySql: `SELECT id, user_id, scheme_code, amount, folio_number, frequency_day 
FROM sip_mandates 
WHERE status = 'ACTIVE' 
  AND frequency_day = 28;`,
    unindexed: {
      plan: {
        nodeType: 'Seq Scan',
        relationName: 'sip_mandates',
        filter: "((status = 'ACTIVE'::text) AND (frequency_day = 28))",
        startupCost: 0.00,
        totalCost: 48900.00,
        planRows: 4000,
        planWidth: 64,
        actualStartupTime: 95.20,
        actualTotalTime: 310.80,
        actualRows: 4120,
        actualLoops: 1,
        sharedHitBlocks: 850,
        sharedReadBlocks: 18400,
        bottlenecks: [
          'Full scan of 4,000,000 rows including 3.88M CANCELLED / PAUSED / COMPLETED records',
          'Heavy disk bandwidth contention during peak morning batch jobs'
        ]
      },
      executionTimeMs: 310.80,
      planningTimeMs: 1.40,
      sharedHitBuffers: 850,
      sharedReadBuffers: 18400,
      heapFetches: 4000000,
      diskIoKb: 147200,
      bottlenecks: [
        'Scans 3.88M dead/inactive SIP records unnecessarily',
        'Large RAM footprint in PostgreSQL buffer pool'
      ]
    },
    indexed: {
      indexDdl: `CREATE INDEX idx_sip_active_day 
ON sip_mandates (frequency_day) 
WHERE status = 'ACTIVE';`,
      indexType: 'Partial Index (Filtered B-Tree Index)',
      plan: {
        nodeType: 'Bitmap Index Scan',
        indexName: 'idx_sip_active_day',
        indexCond: '(frequency_day = 28)',
        startupCost: 4.80,
        totalCost: 22.40,
        planRows: 4000,
        planWidth: 64,
        actualStartupTime: 0.040,
        actualTotalTime: 1.45,
        actualRows: 4120,
        actualLoops: 1,
        sharedHitBlocks: 42,
        sharedReadBlocks: 0,
        heapFetches: 4120
      },
      executionTimeMs: 1.45,
      planningTimeMs: 0.22,
      sharedHitBuffers: 42,
      sharedReadBuffers: 0,
      heapFetches: 4120,
      diskIoKb: 0,
      speedupFactor: 214.3,
      optimizationsUsed: [
        'Partial Index Size: Only 2.8 MB (vs 92 MB for a full un-filtered index)',
        'Filters out 97% of obsolete / completed SIPs from index tree',
        'Lightning-fast bitmap index scan for target scheduled day'
      ]
    }
  },
  {
    id: 'portfolio-xirr-aggregate',
    title: '4. Multi-Year Portfolio XIRR & Capital Gains Computation',
    description: 'Aggregate user transaction ledger (SIP buys, switch-ins, redemptions) joined against historical NAVs for XIRR & capital gains calculation.',
    businessCase: 'Critical for generating portfolio performance reports and tax statements.',
    datasetSize: '10,000,000 transaction records joined with 15,000,000 NAV records',
    querySql: `SELECT 
  t.scheme_code,
  SUM(CASE WHEN t.type IN ('SIP', 'LUMPSUM', 'SWITCH_IN') THEN t.units ELSE -t.units END) AS total_units,
  SUM(CASE WHEN t.type IN ('SIP', 'LUMPSUM', 'SWITCH_IN') THEN t.amount ELSE -t.amount END) AS invested_amount,
  curr_nav.nav AS latest_nav,
  SUM(CASE WHEN t.type IN ('SIP', 'LUMPSUM', 'SWITCH_IN') THEN t.units ELSE -t.units END) * curr_nav.nav AS current_value
FROM transactions t
JOIN (
  SELECT DISTINCT ON (scheme_code) scheme_code, nav 
  FROM nav_history 
  ORDER BY scheme_code, nav_date DESC
) curr_nav ON t.scheme_code = curr_nav.scheme_code
WHERE t.user_id = 'usr_98412' AND t.status = 'COMPLETED'
GROUP BY t.scheme_code, curr_nav.nav;`,
    unindexed: {
      plan: {
        nodeType: 'HashAggregate',
        startupCost: 289400.00,
        totalCost: 295100.00,
        planRows: 12,
        planWidth: 80,
        actualStartupTime: 1250.00,
        actualTotalTime: 1540.20,
        actualRows: 8,
        actualLoops: 1,
        sharedHitBlocks: 4500,
        sharedReadBlocks: 68000,
        bottlenecks: [
          'Nested Hash Join with full table scan on transactions and nav_history',
          'High memory consumption causing work_mem overflow to disk',
          'Unindexed user_id filter forces scan of all 10M transactions'
        ]
      },
      executionTimeMs: 1540.20,
      planningTimeMs: 6.50,
      sharedHitBuffers: 4500,
      sharedReadBuffers: 68000,
      heapFetches: 25000000,
      diskIoKb: 544000,
      bottlenecks: [
        'Total latency 1.54s per user portfolio view',
        'Severely degrades server under concurrent traffic'
      ]
    },
    indexed: {
      indexDdl: `-- 1. User Transactions Composite Index
CREATE INDEX idx_txn_user_status_scheme 
ON transactions (user_id, status, scheme_code) 
INCLUDE (units, amount, type);

-- 2. Materialized View for Real-time Portfolio Snapshot
CREATE MATERIALIZED VIEW mv_user_portfolio_summary AS
SELECT 
  t.user_id,
  t.scheme_code,
  SUM(CASE WHEN t.type IN ('SIP', 'LUMPSUM', 'SWITCH_IN') THEN t.units ELSE -t.units END) AS total_units,
  SUM(CASE WHEN t.type IN ('SIP', 'LUMPSUM', 'SWITCH_IN') THEN t.amount ELSE -t.amount END) AS invested_amount
FROM transactions t
WHERE t.status = 'COMPLETED'
GROUP BY t.user_id, t.scheme_code;

CREATE UNIQUE INDEX idx_mv_user_portfolio ON mv_user_portfolio_summary (user_id, scheme_code);`,
      indexType: 'Composite Covering Index + Concurrently Refreshable Materialized View',
      plan: {
        nodeType: 'Nested Loop',
        startupCost: 0.55,
        totalCost: 16.20,
        planRows: 8,
        planWidth: 80,
        actualStartupTime: 0.055,
        actualTotalTime: 2.30,
        actualRows: 8,
        actualLoops: 1,
        sharedHitBlocks: 48,
        sharedReadBlocks: 0,
        heapFetches: 0
      },
      executionTimeMs: 2.30,
      planningTimeMs: 0.45,
      sharedHitBuffers: 48,
      sharedReadBuffers: 0,
      heapFetches: 0,
      diskIoKb: 0,
      speedupFactor: 669.6,
      optimizationsUsed: [
        'Pre-aggregated unit positions via Materialized View (zero transaction scanning)',
        'Refreshed asynchronously via background queue on transaction settlement',
        'Direct Index-Only lookup on latest NAV cache table'
      ]
    }
  }
];

// Production Code Recipes for MFTracker
export const CODE_SNIPPETS: CodeSnippet[] = [
  {
    id: 'frontend-virtualization',
    title: 'Frontend: Windowed Virtualization for 50,000+ Records',
    category: 'Frontend Virtualization',
    filename: 'src/components/VirtualizedNavList.tsx',
    language: 'typescript',
    explanation: 'Renders only the 12-15 rows visible in the viewport using absolute coordinate positioning, keeping DOM nodes minimal and eliminating UI jank.',
    keyBenefits: [
      'Constant ~15-20 DOM nodes regardless of 100,000+ item list size',
      'Smooth 60 FPS scrolling with zero memory leaks',
      'Sub-millisecond initial render time'
    ],
    code: `import React, { useRef, useState, useMemo } from 'react';
import { NavRecord } from '../types';

interface VirtualListProps {
  items: NavRecord[];
  rowHeight?: number;
  viewportHeight?: number;
}

export function VirtualizedNavList({
  items,
  rowHeight = 44,
  viewportHeight = 480,
}: VirtualListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate total virtual canvas height
  const totalHeight = items.length * rowHeight;

  // Determine the visible slice with an overscan buffer of 5 items
  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
    const visibleCount = Math.ceil(viewportHeight / rowHeight);
    const end = Math.min(items.length, start + visibleCount + 10);
    const top = start * rowHeight;
    return { startIndex: start, endIndex: end, offsetY: top };
  }, [scrollTop, items.length, rowHeight, viewportHeight]);

  const visibleItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  return (
    <div
      ref={containerRef}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="overflow-y-auto border border-neutral-200 rounded-lg bg-white relative"
      style={{ height: viewportHeight }}
    >
      {/* Phantom spacer for native scrollbar geometry */}
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {/* Rendered window slice shifted via transform */}
        <div
          style={{
            transform: \`translateY(\${offsetY}px)\`,
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
          }}
        >
          {visibleItems.map((item, idx) => {
            const actualIndex = startIndex + idx;
            return (
              <div
                key={item.id || actualIndex}
                className="flex items-center justify-between px-4 border-b border-neutral-100 text-sm hover:bg-neutral-50"
                style={{ height: rowHeight }}
              >
                <div className="font-mono text-neutral-500 w-16">#{actualIndex + 1}</div>
                <div className="text-neutral-700 w-32">{item.navDate}</div>
                <div className="font-semibold text-neutral-900 w-28 text-right">
                  ₹{item.nav.toFixed(4)}
                </div>
                <div className="text-xs text-neutral-400 w-32 text-right">
                  Repurchase: ₹{item.repurchasePrice.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}`
  },
  {
    id: 'lttb-chart-downsampling',
    title: 'Chart: LTTB Downsampling for 15-Year High Density NAVs',
    category: 'Frontend Virtualization',
    filename: 'src/utils/lttbDownsample.ts',
    language: 'typescript',
    explanation: 'Largest-Triangle-Three-Buckets (LTTB) algorithms preserves visual peaks, market troughs, and drawdowns while reducing 5,000 raw points down to 200 SVG elements.',
    keyBenefits: [
      'Reduces chart DOM / Canvas rendering time by 94%',
      'Eliminates Recharts SVG stutter during responsive window resize and zoom',
      'Preserves exact all-time high (ATH) and maximum drawdown points mathematically'
    ],
    code: `/**
 * Largest-Triangle-Three-Buckets (LTTB) Downsampling Algorithm
 * Optimizes time-series charts for Mutual Fund NAV curves.
 */
export function downsampleNavData<T extends { navDate: string; nav: number }>(
  data: T[],
  threshold: number = 200
): T[] {
  if (threshold >= data.length || threshold <= 2) return data;

  const sampled: T[] = [];
  const bucketSize = (data.length - 2) / (threshold - 2);

  let a = 0; // Point a in previous bucket
  sampled.push(data[a]); // Always retain the very first historical point

  for (let i = 0; i < threshold - 2; i++) {
    // Calculate average point for the next bucket (c)
    let avgX = 0;
    let avgY = 0;
    let nextBucketStart = Math.floor((i + 1) * bucketSize) + 1;
    let nextBucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);
    const nextBucketLength = nextBucketEnd - nextBucketStart;

    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgX += j;
      avgY += data[j].nav;
    }
    avgX /= nextBucketLength;
    avgY /= nextBucketLength;

    // Search current bucket (b) for point that maximizes triangle area (a, b, c)
    const currentBucketStart = Math.floor(i * bucketSize) + 1;
    const currentBucketEnd = Math.floor((i + 1) * bucketSize) + 1;

    const pointAX = a;
    const pointAY = data[a].nav;

    let maxArea = -1;
    let maxAreaIndex = currentBucketStart;

    for (let j = currentBucketStart; j < currentBucketEnd; j++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[j].nav - pointAY) -
        (pointAX - j) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = j;
      }
    }

    sampled.push(data[maxAreaIndex]);
    a = maxAreaIndex;
  }

  sampled.push(data[data.length - 1]); // Always retain the most recent NAV
  return sampled;
}`
  },
  {
    id: 'backend-cursor-pagination',
    title: 'Backend API: Keyset / Cursor Pagination (O(1) Seek)',
    category: 'API & Cursor Pagination',
    filename: 'server/controllers/navController.ts',
    language: 'typescript',
    explanation: 'Replaces slow `OFFSET` (which performs an O(N) sequential scan under the hood) with deterministic keyset filtering using `WHERE (nav_date, id) < (cursor_date, cursor_id)`.',
    keyBenefits: [
      'Eliminates page-depth performance degradation (Page 10,000 is as fast as Page 1)',
      'Prevents missing or duplicate items when new daily NAVs are ingested concurrently',
      'Encodes composite cursor into safe URL base64 tokens'
    ],
    code: `import { Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

interface NavCursor {
  navDate: string;
  id: number;
}

export async function getSchemeNavHistory(req: Request, res: Response) {
  const schemeCode = req.params.schemeCode;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const rawCursor = req.query.cursor as string | undefined;

  let cursor: NavCursor | null = null;
  if (rawCursor) {
    try {
      cursor = JSON.parse(Buffer.from(rawCursor, 'base64').toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid cursor encoding' });
    }
  }

  // Optimized keyset query utilizing composite B-Tree index (scheme_code, nav_date DESC, id DESC)
  const query = sql\`
    SELECT id, scheme_code, nav_date, nav, repurchase_price
    FROM nav_history
    WHERE scheme_code = \${schemeCode}
    \${cursor ? sql\`AND (nav_date, id) < (\${cursor.navDate}, \${cursor.id})\` : sql\`\`}
    ORDER BY nav_date DESC, id DESC
    LIMIT \${limit + 1};
  \`;

  const rows = await db.execute(query);
  const hasMore = rows.length > limit;
  const results = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && results.length > 0) {
    const lastItem = results[results.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({ navDate: lastItem.nav_date, id: lastItem.id })
    ).toString('base64');
  }

  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.json({
    data: results,
    pagination: {
      limit,
      hasMore,
      nextCursor
    }
  });
}`
  },
  {
    id: 'postgres-ddl-indexes',
    title: 'Database: Production Schema & Multi-Tier Index Architecture',
    category: 'Database Indexing',
    filename: 'migrations/0002_optimize_mftracker_indexes.sql',
    language: 'sql',
    explanation: 'Comprehensive PostgreSQL schema migration adding multi-column B-Trees, Covering indexes with `INCLUDE`, BRIN indexes for time-series compression, and Partial indexes for active records.',
    keyBenefits: [
      'Index-Only Scans for 98% of high-frequency read queries',
      'BRIN indexes save 95% disk space on historical daily NAV partitions',
      'Eliminates table lock contention with CONCURRENTLY index builds'
    ],
    code: `-- 1. Scheme Master Table
CREATE TABLE IF NOT EXISTS mutual_fund_schemes (
  scheme_code VARCHAR(20) PRIMARY KEY,
  isin VARCHAR(20) UNIQUE NOT NULL,
  scheme_name TEXT NOT NULL,
  fund_house TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  current_nav NUMERIC(10, 4),
  nav_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. High-Volume Historical Daily NAV Table
CREATE TABLE IF NOT EXISTS nav_history (
  id BIGSERIAL,
  scheme_code VARCHAR(20) NOT NULL REFERENCES mutual_fund_schemes(scheme_code),
  nav_date DATE NOT NULL,
  nav NUMERIC(10, 4) NOT NULL,
  repurchase_price NUMERIC(10, 4),
  sale_price NUMERIC(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (scheme_code, nav_date)
) PARTITION BY RANGE (nav_date);

-- Create Yearly Partitions (Example: 2024 to 2026)
CREATE TABLE nav_history_2024 PARTITION OF nav_history
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
CREATE TABLE nav_history_2025 PARTITION OF nav_history
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE nav_history_2026 PARTITION OF nav_history
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- 3. Composite Covering Index (Eliminates Heap Lookups for Chart & Valuation Queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nav_scheme_date_covering
ON nav_history (scheme_code, nav_date DESC)
INCLUDE (nav, repurchase_price);

-- 4. BRIN (Block Range Index) for Bulk Historical Time-Series Ingestion
-- BRIN takes ~200KB vs ~45MB for standard B-Tree on 10M rows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nav_history_date_brin
ON nav_history USING BRIN (nav_date)
WITH (pages_per_range = 128);

-- 5. User Transaction Ledger
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(40) PRIMARY KEY,
  user_id VARCHAR(40) NOT NULL,
  folio_number VARCHAR(30) NOT NULL,
  scheme_code VARCHAR(20) NOT NULL REFERENCES mutual_fund_schemes(scheme_code),
  type VARCHAR(20) NOT NULL, -- SIP, LUMPSUM, REDEMPTION
  transaction_date DATE NOT NULL,
  units NUMERIC(14, 4) NOT NULL,
  nav NUMERIC(10, 4) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
);

-- Covering index for User Portfolio Calculation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_txn_user_calc
ON transactions (user_id, status, scheme_code)
INCLUDE (units, amount, type, transaction_date);

-- 6. Partial Index for Active Monthly SIP Cron Jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sip_active_schedules
ON sip_mandates (frequency_day, scheme_code)
WHERE status = 'ACTIVE';`
  },
  {
    id: 'materialized-view-cache',
    title: 'Database: Materialized Views & Concurrently Refreshing Pipeline',
    category: 'Advanced Timescale & Partitioning',
    filename: 'migrations/0003_portfolio_materialized_views.sql',
    language: 'sql',
    explanation: 'Pre-aggregates total portfolio units and invested cost basis per user, turning 1.5-second runtime transaction calculations into sub-millisecond key-value lookups.',
    keyBenefits: [
      'Sub-millisecond portfolio overview queries',
      'Non-blocking continuous updates using REFRESH MATERIALIZED VIEW CONCURRENTLY',
      'Unique index ensures deterministic lock-free refresh'
    ],
    code: `-- Materialized view pre-aggregating portfolio unit holdings
CREATE MATERIALIZED VIEW mv_user_portfolio_positions AS
SELECT
  t.user_id,
  t.scheme_code,
  t.folio_number,
  SUM(CASE WHEN t.type IN ('SIP', 'LUMPSUM', 'SWITCH_IN') THEN t.units ELSE -t.units END) AS current_units,
  SUM(CASE WHEN t.type IN ('SIP', 'LUMPSUM', 'SWITCH_IN') THEN t.amount ELSE -t.amount END) AS net_invested_amount,
  MIN(t.transaction_date) AS first_investment_date,
  COUNT(t.id) AS total_transactions_count
FROM transactions t
WHERE t.status = 'COMPLETED'
GROUP BY t.user_id, t.scheme_code, t.folio_number
HAVING SUM(CASE WHEN t.type IN ('SIP', 'LUMPSUM', 'SWITCH_IN') THEN t.units ELSE -t.units END) > 0.0001;

-- UNIQUE Index required for non-blocking concurrent refresh
CREATE UNIQUE INDEX idx_mv_portfolio_user_scheme_folio 
ON mv_user_portfolio_positions (user_id, scheme_code, folio_number);

-- Index for fast user-specific portfolio retrieval
CREATE INDEX idx_mv_portfolio_user 
ON mv_user_portfolio_positions (user_id);

-- Scheduled Background Worker Command (runs upon transaction batch settlement):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_portfolio_positions;`
  }
];
