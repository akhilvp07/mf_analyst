# MFTracker: Corrected Review and Fix Plan

Remaining fixes for the MFTracker repo (akhilvp07/mf\_analyst), checked against the latest ZIP: 27 Vitest tests pass, `tsc` lint is clean and the production build succeeds. Work through the sections in order. Every item gives the file, the problem, numbered steps and a done-when check.

## Ground rules for the agent

- All portfolio data stays in the browser (IndexedDB and `localStorage`). No analytics, and nothing about holdings is sent anywhere.
- The app runs in Google AI Studio, which hosts it as a Node server (`server.ts`) on Cloud Run. Keep `server.ts`. Never send portfolio data to it. It may only fetch public NAV and market data.
- NAV and market data come from free external APIs. Calling them is fine. Data and services from Google (Drive, Firebase sign-in, other Google-hosted APIs) are also acceptable.
- The only sync is the JSON snapshot in the user's Google Drive `appDataFolder` (`drive.appdata` scope), so all devices share the same data.
- Keep the existing 27 tests passing and add tests with every fix. Before finishing each item run `npm run lint && npm test && npm run build`.

## Already fixed (do not redo)

- Per-lot FIFO engine with realised gains and grandfathering logic (`fifoLotEngine.ts`, `taxConfig.ts`)
- The swapped `isEquityOrientedScheme` arguments
- Explicit transaction types and shared `getTransactionDirection`
- XIRR returns `null` on failure and uses a 365-day year
- Invalid dates no longer become today's date
- Day-gain formula
- Drive token no longer stored in `localStorage`
- Package name, duplicate `vite` and `bun.lock` cleanup
- Vitest suite and GitHub Actions CI (lint, test, build)

## 1. Accuracy and data trust (highest priority)

### 1.1 Remove fabricated market data

**Where:** `src/services/marketService.ts`, `MarketAnalysis.tsx`, `MarketOpportunityBanner.tsx`

**Issue:** When the live fetch fails, the app returns `FALLBACK_MARKET_DATA` with a hardcoded Nifty close of 23,146.15, P/E 19.77, a dated history and a "buy trigger ACTIVE" message. This looks like live data but is invented.

**Steps:**

1. Delete `FALLBACK_MARKET_DATA` and its hardcoded history.
2. Make `fetchNiftyMarketData` return `null` (or `{status: 'unavailable'}`) when there is no live and no cached result. Keep the fetch time with any cached result.
3. In the market UI show "Market data unavailable" or "Last updated \<date>". Suppress every alert when data is missing or older than 5 days.
4. Add a test: a failed fetch produces no alert and no numbers.

**Done when:** with the network blocked, the market tab shows no invented figures and no alerts.

### 1.2 Browser-side fallback for market and benchmark data

**Where:** `marketService.ts` (calls `/api/market/nifty`), `NIFTY_50_ANCHORS` in `financialCalculations.ts`

**Issue:** `marketService.ts` depends on `/api/market/nifty` from `server.ts`. It works while the AI Studio server runs, but when that call fails there is no other live source and the app falls back to invented data (see 1.1). The benchmark line is also built from hand-typed price-index anchors with linear interpolation, so alpha is overstated by roughly the dividend yield.

**Steps:**

1. Keep `/api/market/nifty` as the primary source.
2. As a fallback, pick one large Nifty 50 index fund (Direct Growth), find its scheme code through `https://api.mfapi.in/mf/search?q=`, and fetch its NAV history from `https://api.mfapi.in/mf/{code}` in the browser. Cache the series in IndexedDB with a timestamp.
3. Use that series for drawdown from the all-time peak and as the benchmark for growth charts and XIRR comparison. It includes dividends, so alpha is no longer overstated.
4. Show P/E only when the server returns it. Otherwise hide the P/E alert, or accept a value the user types in.
5. Keep `NIFTY_50_ANCHORS` only as a clearly labelled "approximate offline benchmark".

**Done when:** with `/api/market/nifty` blocked, the market tab shows the index-fund series with its as-of date and no invented values.

### 1.3 Tax rates must depend on the sale date

**Where:** `src/utils/taxConfig.ts` (`determineHoldingTaxClassification`), `fifoLotEngine.ts`, `tests/taxRules.test.ts`

**Issue:** Budget 2024 rates (20% STCG, 12.5% LTCG, ₹1.25 lakh exemption) apply only to sales on or after 23 Jul 2024. Earlier sales used 15%, 10% and ₹1 lakh. The current code and a test apply the new rates to a 2023 sale.

**Steps:**

1. Add a rate table keyed by sale date: before 2024-07-23 use 15% / 10% / ₹1,00,000; on or after use 20% / 12.5% / ₹1,25,000.
2. Pass the sale date into the classification and into the annual exemption calculation (exemption applies per financial year).
3. Fix the 2023-sale assertion in `taxRules.test.ts` and add boundary tests for 22 Jul and 23 Jul 2024.
4. Have the owner confirm the rates with a tax professional before release.

**Done when:** a 2023 sale uses 15% / 10% and a late-2024 sale uses 20% / 12.5%.

### 1.4 Grandfathering data is thin and unverified

**Where:** `taxConfig.ts` (`GRANDFATHERING_2018_FMV_NAV`), `fifoLotEngine.ts`

**Issue:** The table holds about 10 hand-typed FMV values. Pre-Feb-2018 equity lots for any other fund silently get no grandfathering, so tax is overstated.

**Steps:**

1. Check the existing values against the official 31 Jan 2018 NAVs.
2. Move the data to a bundled static file (for example `public/data/fmv2018.json`) keyed by ISIN and scheme code, loaded lazily.
3. When a pre-Feb-2018 equity lot has no FMV, mark the lot "grandfathering not applied: FMV missing" in the Tax tab and in exports.
4. Add tests for a lot with FMV and a lot without.

**Done when:** no pre-2018 equity lot is treated as having no grandfathering without a visible warning.

### 1.5 Label stale NAVs and remove invented fund metrics

**Where:** `src/services/mfApi.ts` (seed tables dated 2026-08-28 and 2026-08-31), `amfiNavService.ts` seed records

**Issue:** Seed NAVs about two months old can be used as current values, and the seed data includes invented CAGR, AUM and expense ratios. No component shows a stale flag.

**Steps:**

1. Show "NAV as of \<date>" next to every NAV and every value built from it.
2. Show a "stale" chip when the NAV date is more than 5 calendar days old.
3. Never value holdings from seed data without that chip. Remove the invented CAGR, AUM and expense-ratio fields.

**Done when:** every NAV on screen has a date and stale values are visibly flagged.

### 1.6 CAS parser gaps

**Where:** `src/services/pdfCasParser.ts` (`amount >= 50` near line 1357, `FOLIO-1` near line 1007), `CasImporter.tsx`

**Issue:** Rows under ₹50 are dropped, so small SIPs and dividend reinvestments go missing. Unknown folios collapse into `FOLIO-1`. `reconciliationWarnings` exists but is not shown clearly.

**Steps:**

1. Replace the ₹50 cut-off with a plain sanity check (amount > 0 and units > 0).
2. Use a per-scheme placeholder such as `UNKNOWN-<schemeCode>` instead of `FOLIO-1`.
3. In `CasImporter.tsx` show reconciliation warnings per folio (computed units vs statement closing units) and require the user to confirm before merging.
4. Add anonymised CAMS and KFintech text fixtures under `tests/fixtures`.

**Done when:** a statement with a small SIP imports it and a unit mismatch is shown before merging.

### 1.7 Disclaimers

**Where:** Insights tab, Tax tab, exports

**Issue:** No visible "not advice" notice.

**Steps:** Add "Estimates only. Not investment, tax or legal advice." to the Insights and Tax screens and to exported files, and label tax figures "estimate".

**Done when:** the notice appears on both tabs and in the export header.

## 2. Google Drive sync (the one allowed exception)

### 2.1 Merging cannot propagate deletes or edits

**Where:** `src/services/googleDriveSync.ts`, `mergeTransactions` in `financialCalculations.ts`, `types.ts`

**Issue:** A conflict is resolved by taking the union of transactions without duplicates. A transaction deleted on one device comes back from another device, and an edit can be undone by a stale copy.

**Steps:**

1. Add `updatedAt` (ISO string) and `deleted` (boolean) to `TransactionRecord`.
2. Make deletes soft: set `deleted: true` and a new `updatedAt`. Keep these tombstones for a fixed period (for example 90 days), then purge.
3. Merge per record by `id`: the record with the newer `updatedAt` wins. Hide deleted records in the UI.
4. Raise the snapshot `formatVersion` to 3 and migrate version 2 files (set `updatedAt` to the file's `updatedAt`, `deleted: false`).
5. Add tests: delete on device A then sync on B, edit on A and B, and a version 2 file migrating correctly.

**Done when:** a transaction deleted on one device stays deleted after syncing all devices.

### 2.2 Minimise and optionally encrypt the snapshot

**Where:** `googleDriveSync.ts`, `portfolioStorage.ts` (`exportPortfolioToJson`)

**Issue:** The snapshot contains the full transaction history, folio numbers and scheme names. The narrow `drive.appdata` scope is correct, but the file itself is readable plain JSON.

**Steps:**

1. Make sure the snapshot never contains PAN, email, phone or investor name. Strip them before writing.
2. Add an optional "encrypt backup" setting. Use the WebCrypto API (AES-GCM with a key derived from a passphrase using PBKDF2 or Argon2). Store the salt and IV in the file.
3. Never store the passphrase. Warn the user that a lost passphrase cannot be recovered, and ask for it on each new device.
4. Add a test for an encrypt-then-decrypt round trip and for a wrong passphrase.

**Done when:** an encrypted snapshot is unreadable in Drive and restores correctly with the passphrase.

### 2.3 Guard against newer file versions

**Where:** `googleDriveSync.ts`

**Issue:** An old app version could overwrite a snapshot written by a newer version and lose fields.

**Steps:** Before pushing, compare `formatVersion`. If the remote one is newer, do not overwrite. Show "Please refresh to the latest version" and pull read-only.

**Done when:** an older build cannot overwrite a newer snapshot.

## 3. UI/UX

### 3.1 Text is too small

**Where:** all components

**Issue:** `text-[10px]` appears about 153 times and `text-[11px]` about 141 times, which is hard to read on phones.

**Steps:** Set a 12px minimum for all numbers and body text. Keep 10 to 11px only for captions. Replace the arbitrary values with a small set of named sizes.

### 3.2 Accessibility

**Issue:** The whole app has about 13 `aria-*` attributes and 2 `role` attributes. Many icon-only buttons have no label. Gains and losses rely on colour.

**Steps:**

1. Add `aria-label` to every icon-only button.
2. Give the tab bar `role="tablist"` with `role="tab"` and `aria-selected`, and the panels `role="tabpanel"`.
3. Add visible focus rings.
4. Show a + or − sign (or arrow) with every gain and loss, not just colour.
5. Run an automated check (for example axe) once and fix serious findings.

### 3.3 Theme and reduced motion

**Issue:** Dark theme only, and animations and confetti ignore reduced-motion settings.

**Steps:** Respect `prefers-color-scheme` with a light theme and a manual toggle. Respect `prefers-reduced-motion`: skip confetti and shorten transitions.

### 3.4 Installable app and metadata

**Where:** `index.html`, `metadata.json`

**Issue:** No manifest, `theme-color` or favicon. The description still reads "for Google Cloud Run".

**Steps:** Add a web manifest, icons, `theme-color` and a favicon. Rewrite the description in plain language (a private, in-browser mutual fund tracker). Add a service worker so the app shell loads offline only if it works on the deployed AI Studio URL. The AI Studio preview runs in an iframe and may not support it, so make it optional.

### 3.5 Loading states

**Issue:** About 20 loading references across the whole app.

**Steps:** Add skeleton placeholders for the overview cards and charts, and a per-fund spinner while NAVs refresh.

### 3.6 Explain the numbers

**Issue:** XIRR can now be `null`, tax is an estimate, and NAVs have dates.

**Steps:** Show "N/A" with a tooltip giving the reason, tag tax figures "estimate", and show the NAV date near valuations.

### 3.7 First-run experience and privacy notice

**Steps:**

1. Add an empty-state guide: download the CAS statement, upload it, enter the password.
2. Add a "try demo portfolio" button that stays local.
3. Add a short notice listing what leaves the browser: fund-code lookups to the NAV API, and the optional Google Drive snapshot. Nothing else.

### 3.8 Mobile navigation

**Issue:** Eight tabs sit in a horizontal scroll bar.

**Steps:** Use a bottom navigation with 4 to 5 main items and a "More" sheet (`MobileBottomSheet.tsx` exists).

### 3.9 Import review screen

**Steps:** Before merging a CAS import, show a summary: transactions found, duplicates skipped, folios with unit mismatches. Let the user cancel.

## 4. Performance (browser only)

### 4.1 Code splitting

**Where:** `src/App.tsx`, `vite.config.ts`

**Issue:** The build produces one 1.89 MB script (518 KB gzipped). There are no `lazy(` calls, so pdf.js, recharts, firebase, react-markdown and confetti all load up front.

**Steps:**

1. Load each tab with `React.lazy` and a `Suspense` skeleton.
2. Import pdf.js dynamically only when the user starts an import, and `canvas-confetti` only on success.
3. Add `build.rollupOptions.output.manualChunks` for recharts and firebase.
4. Keep the "visited tabs stay mounted" behaviour.

**Done when:** the initial JavaScript is under about 300 KB gzipped.

### 4.2 AMFI NAV file caching

**Where:** `src/services/amfiNavService.ts` (cache write near line 1033), `indexedDbCache.ts`

**Issue:** The whole NAV file is parsed in the browser and the raw text is stored in `localStorage`. It likely exceeds the quota. The write failure is silently swallowed, so the file is downloaded again every session.

**Steps:**

1. Parse once and store only the fields the app needs in IndexedDB (`indexedDbCache.ts` exists), with a timestamp.
2. Reuse the cache until the next day.
3. Parse in a Web Worker so the page stays responsive.
4. Show a visible status when the refresh fails.

**Done when:** a second page load makes no NAV file download on the same day.

### 4.3 Bundle pdf.js assets

**Where:** `src/services/pdfCasParser.ts` (worker and cMap URLs)

**Issue:** The worker loads from cdnjs, and cMaps and fonts load from jsDelivr pinned to v4.10.38, while the installed package is v6. Statement parsing breaks offline or if a CDN fails, and the versions can mismatch.

**Steps:**

1. Import the worker from the installed package using Vite's `?url` suffix and set `GlobalWorkerOptions.workerSrc` to it.
2. Copy the package's `cmaps` and `standard_fonts` into `public/` and point `cMapUrl` and `standardFontDataUrl` at them.
3. Remove the CDN URLs.

**Done when:** a statement imports with the network disabled after the first load.

### 4.4 Avoid re-rendering every tab

**Issue:** All visited tabs stay mounted and re-render on any change. Several large tabs use few memo hooks.

**Steps:** Compute XIRR, FIFO and tax once in a shared memoised layer. Wrap heavy tab components in `React.memo`. Check with the React profiler that a transaction edit does not re-render hidden tabs.

### 4.5 PDF parsing off the main thread

**Issue:** Large statements parse on the main thread and can freeze the page.

**Steps:** Run parsing in a Web Worker (or yield between pages) and show page-by-page progress.

### 4.6 Split large modules

**Issue:** `financialCalculations.ts` is 3,216 lines, `PortfolioInsights.tsx` 1,950 lines and `mfApi.ts` 1,366 lines, much of it static tables.

**Steps:** Split by feature, and move static tables (known schemes, market-cap splits, FMV data) to lazily loaded JSON. Do this after the tests in section 5 are in place.

### 4.7 Storage writes

**Where:** `portfolioStorage.ts`

**Issue:** The full transaction list is stringified into `localStorage` on every change (up to 4 MB).

**Steps:** Use IndexedDB as the only store for transactions and debounce writes (for example 500 ms). Migrate existing `localStorage` data once, then stop writing it.

## 5. Tests and CI (runs automatically, never by the user)

The Vitest suite and the GitHub Actions workflow (`.github/workflows/ci.yml`) already run lint, tests and build on every push and pull request to `main`. Extend them as follows.

### 5.1 Extend the tests

**Steps:** Add tests for these cases, each in `tests/`:

- Tax: sale before and after 23 Jul 2024, and the ₹1 lakh vs ₹1.25 lakh exemption.
- Grandfathering: a pre-2018 lot with FMV and one without.
- FIFO: partial redemption across several lots, switch in and out.
- XIRR: a value checked against Excel, and failure cases returning `null`.
- CAS parser: anonymised CAMS and KFintech fixtures with a small SIP, dividend payout, reversal and stamp duty line.
- Sync: delete and edit merging from section 2.1, and encrypt-decrypt round trip from 2.2.
- Market data: failed fetch shows no values (section 1.1).

### 5.2 Keep data in the browser, enforced

**Steps:**

1. Add a test that scans `src/` for `fetch(` and URL hosts and fails if a host is not on an allowlist: the NAV API, Google Drive and sign-in hosts, other Google hosts the app uses, and the app's own `/api` routes.
2. Optional: add a Content-Security-Policy with `connect-src` limited to the same allowlist. AI Studio shows the app inside an iframe, so allow it in `frame-ancestors`, and test sign-in, Drive sync and the preview before merging. If the preview breaks, skip the CSP and keep the test.

### 5.3 Make CI a required check

**Steps:** In the repository settings, protect `main` and require the CI job to pass before merging.

## 6. Optional cleanup (low priority)

- **Own-server routes:** keep them. In AI Studio `server.ts` runs, and `/api/amfi-nav`, `/api/amfi/navall` and `/api/market/nifty` are the primary sources. Do not remove them, or `express`, `helmet` and `dotenv`.
- **Server must stay data-free:** check that `server.ts` routes only return public NAV and market data, and never receive or log portfolio data.
- **Third-party proxy:** `api.allorigins.win` is the last NAV fallback. Add a timeout and a visible "using backup source" status.
- **Unused packages:** `express-rate-limit` and `zod` are installed but not used. Remove them or use them.

## Suggested order of work

1. Section 1.1 and 1.2 (no invented market data, a browser-side fallback source).
2. Section 1.3 to 1.5 (tax rates by date, grandfathering data, stale NAV labels).
3. Section 5.1 and 5.2 (tests and the data-stays-local check), so later changes are protected.
4. Section 2 (Drive sync correctness and optional encryption).
5. Section 1.6 and 1.7 (parser gaps, disclaimers).
6. Section 4.1 to 4.3 (bundle size, NAV caching, pdf.js assets).
7. Section 3 (UI/UX) and the rest of section 4.
8. Section 6 (optional cleanup).
