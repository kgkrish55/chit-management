import { describe, expect, it } from 'vitest';
import {
  ScanOutcome,
  buildReceiptUtr,
  computeRemainingDue,
  dedupeUploads,
  formatINR,
  sha256Hex,
} from '@/lib/paymentProcessing';

const scan = (overrides: Partial<ScanOutcome>): ScanOutcome => ({
  fileName: 'receipt.png',
  amount: 6500,
  month: 1,
  utr: null,
  imageHash: 'a'.repeat(64),
  ...overrides,
});

describe('sha256Hex', () => {
  it('produces a stable 64-char hash', () => {
    const h1 = sha256Hex(Buffer.from('hello'));
    const h2 = sha256Hex(Buffer.from('hello'));
    const h3 = sha256Hex(Buffer.from('world'));
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).not.toBe(h3);
  });
});

describe('buildReceiptUtr', () => {
  it('uses the extracted UTR when present', () => {
    expect(buildReceiptUtr('421234567890', 'b'.repeat(64))).toBe('421234567890');
  });

  it('normalizes a messy UTR', () => {
    expect(buildReceiptUtr(' utr 421234567890 ', 'b'.repeat(64))).toBe('UTR421234567890');
  });

  it('derives a deterministic id from the image hash when no UTR is found', () => {
    const hash = 'abcdef1234567890';
    const utr = buildReceiptUtr(null, hash);
    expect(utr).toBe(`IMG-${hash.slice(0, 12).toUpperCase()}`);
    expect(buildReceiptUtr(null, hash)).toBe(utr);
  });
});

describe('dedupeUploads', () => {
  it('keeps unique receipts', () => {
    const { unique, duplicates } = dedupeUploads([
      scan({ fileName: 'a.png', utr: '421234567890' }),
      scan({ fileName: 'b.png', utr: '421234567891' }),
    ]);
    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });

  it('flags a repeated UTR within one upload batch', () => {
    const { unique, duplicates } = dedupeUploads([
      scan({ fileName: 'a.png', utr: '421234567890' }),
      scan({ fileName: 'b.png', utr: '421234567890' }),
    ]);
    expect(unique).toHaveLength(1);
    expect(unique[0].fileName).toBe('a.png');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].fileName).toBe('b.png');
  });

  it('flags the identical image uploaded twice (no UTR)', () => {
    const { unique, duplicates } = dedupeUploads([
      scan({ fileName: 'a.png', imageHash: '1'.repeat(64) }),
      scan({ fileName: 'b.png', imageHash: '1'.repeat(64) }),
    ]);
    expect(unique).toHaveLength(1);
    expect(duplicates).toHaveLength(1);
  });

  it('treats different images without UTR as unique', () => {
    const { unique, duplicates } = dedupeUploads([
      scan({ fileName: 'a.png', imageHash: '1'.repeat(64) }),
      scan({ fileName: 'b.png', imageHash: '2'.repeat(64) }),
    ]);
    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });
});

describe('computeRemainingDue', () => {
  it('subtracts payments already recorded', () => {
    expect(computeRemainingDue(6500, 0, 1000)).toBe(5500);
    expect(computeRemainingDue(6500, 5000, 1000)).toBe(500);
  });

  it('never returns a negative balance', () => {
    expect(computeRemainingDue(6500, 6000, 1000)).toBe(0);
    expect(computeRemainingDue(6500, 0, 8000)).toBe(0);
  });
});

describe('formatINR', () => {
  it('formats with Indian digit grouping', () => {
    expect(formatINR(6500)).toBe('6,500');
    expect(formatINR(100000)).toBe('1,00,000');
  });
});