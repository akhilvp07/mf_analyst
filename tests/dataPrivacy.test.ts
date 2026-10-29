import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        getAllSourceFiles(fullPath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('Data Stays Local & Zero-Egress Guard (Privacy Enforcement)', () => {
  const srcDir = path.resolve(__dirname, '../src');
  const sourceFiles = getAllSourceFiles(srcDir);

  it('scans all src files to ensure no prohibited network APIs (WebSocket, sendBeacon, EventSource)', () => {
    const prohibitedApis = ['sendBeacon', 'EventSource', 'new WebSocket('];
    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const api of prohibitedApis) {
        expect(
          content.includes(api),
          `Prohibited network API '${api}' detected in ${path.relative(srcDir, filePath)}`
        ).toBe(false);
      }
    }
  });

  it('verifies all network fetch destinations match the strictly approved allowlist', () => {
    // Approved destinations:
    // 1. Local relative /api/ proxy endpoints
    // 2. Official AMFI NAV data service (api.mfapi.in)
    // 3. User-owned Google Drive appDataFolder sync (googleapis.com / accounts.google.com)
    // 4. Bundled local static assets (/data/fmv2018.json, etc.)
    const allowedPatterns = [
      '/api/',
      'api.mfapi.in',
      'www.googleapis.com',
      'accounts.google.com',
      '/data/fmv2018.json',
      'blob:',
      'data:'
    ];

    const fetchUrlRegex = /fetch\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/g;

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      let match;
      while ((match = fetchUrlRegex.exec(content)) !== null) {
        const url = match[1];
        const isAllowed = allowedPatterns.some(pattern => url.includes(pattern));
        expect(
          isAllowed,
          `Unauthorized external network fetch to "${url}" found in ${path.relative(srcDir, filePath)}`
        ).toBe(true);
      }
    }
  });

  it('ensures no AI or Gemini generation endpoints are present in frontend source code', () => {
    const forbiddenKeywords = ['@google/genai', 'generateContent', 'gemini-2.5', 'gemini-1.5', 'api.generativelanguage.googleapis.com'];
    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const kw of forbiddenKeywords) {
        expect(
          content.includes(kw),
          `Forbidden AI/Gemini reference '${kw}' found in ${path.relative(srcDir, filePath)}`
        ).toBe(false);
      }
    }
  });
});
