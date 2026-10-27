import { describe, it, expect } from 'vitest';
import { parseDateStrict, parseDateSafe } from '../src/utils/financialCalculations';
import { normalizeAnyDate } from '../src/services/pdfCasParser';

describe('Date Parsing Engine (Strict & Normalized)', () => {
  it('parses standard ISO YYYY-MM-DD correctly', () => {
    const d = parseDateStrict('2024-03-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(2); // 0-indexed March
    expect(d!.getDate()).toBe(15);
  });

  it('parses DD-MMM-YYYY accurately', () => {
    const d = parseDateStrict('15-Jan-2024');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(15);
  });

  it('parses DD/MM/YYYY accurately', () => {
    const d = parseDateStrict('25/12/2023');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2023);
    expect(d!.getMonth()).toBe(11);
    expect(d!.getDate()).toBe(25);
  });

  it('parses two-digit years (e.g. 24 -> 2024, 98 -> 1998)', () => {
    const d24 = parseDateStrict('10-Feb-24');
    expect(d24).not.toBeNull();
    expect(d24!.getFullYear()).toBe(2024);

    const norm98 = normalizeAnyDate('15-May-98');
    expect(norm98).toBe('1998-05-15');
  });

  it('rejects invalid dates like 31-Feb and returns null (no silent fallback to today)', () => {
    const feb31 = parseDateStrict('31-Feb-2024');
    expect(feb31).toBeNull();

    const april31 = parseDateStrict('31-Apr-2024');
    expect(april31).toBeNull();
  });

  it('rejects malformed strings and returns null', () => {
    expect(parseDateStrict('')).toBeNull();
    expect(parseDateStrict('invalid-date')).toBeNull();
    expect(parseDateStrict('99-99-9999')).toBeNull();
  });

  it('normalizes various CAS statement date formats via normalizeAnyDate', () => {
    expect(normalizeAnyDate('12-Mar-2023')).toBe('2023-03-12');
    expect(normalizeAnyDate('12/03/2023')).toBe('2023-03-12');
    expect(normalizeAnyDate('December 08, 2023')).toBe('2023-12-08');
  });
});
