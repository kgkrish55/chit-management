import { describe, expect, it } from 'vitest';
import {
  MONTHLY_DUE,
  computePaymentStatus,
  extractAmountFromText,
  extractMonthFromText,
  extractUtrFromText,
  normalizeMonthNumber,
  normalizeUtr,
  parseScanAmount,
  parseScannedJson,
} from '@/lib/paymentScanner';

describe('MONTHLY_DUE', () => {
  it('contains the full 12-month schedule', () => {
    expect(Object.keys(MONTHLY_DUE)).toHaveLength(12);
    expect(MONTHLY_DUE[1]).toBe(6500);
    expect(MONTHLY_DUE[12]).toBe(8750);
  });

  it('increases across the cycle', () => {
    for (let m = 2; m <= 12; m++) {
      expect(MONTHLY_DUE[m]).toBeGreaterThan(MONTHLY_DUE[m - 1]);
    }
  });
});

describe('parseScanAmount', () => {
  it('accepts valid positive amounts', () => {
    expect(parseScanAmount(6500)).toBe(6500);
    expect(parseScanAmount('6500')).toBe(6500);
    expect(parseScanAmount(6500.4)).toBe(6500);
  });

  it('rejects invalid values', () => {
    expect(parseScanAmount(0)).toBeNull();
    expect(parseScanAmount(-5)).toBeNull();
    expect(parseScanAmount(Number.NaN)).toBeNull();
    expect(parseScanAmount('abc')).toBeNull();
    expect(parseScanAmount(undefined)).toBeNull();
  });
});

describe('normalizeMonthNumber', () => {
  it('prefers a real scanned month other than 1', () => {
    expect(normalizeMonthNumber(4, 1)).toBe(4);
  });

  it('uses the requested month when scan defaults to 1', () => {
    expect(normalizeMonthNumber(1, 7)).toBe(7);
  });

  it('falls back to the scanned month when nothing is usable', () => {
    expect(normalizeMonthNumber(1, 0)).toBe(1);
    expect(normalizeMonthNumber(1, 99)).toBe(1);
  });
});

describe('computePaymentStatus', () => {
  it('marks full payment as PAID', () => {
    expect(computePaymentStatus(6500, 1)).toBe('PAID');
    expect(computePaymentStatus(8750, 12)).toBe('PAID');
  });

  it('marks partial payment as PARTIAL', () => {
    expect(computePaymentStatus(5000, 1)).toBe('PARTIAL');
    expect(computePaymentStatus(0, 1)).toBe('PARTIAL');
  });
});

describe('extractAmountFromText', () => {
  it('prefers a currency-qualified amount', () => {
    expect(extractAmountFromText('Total ₹6,500 paid. Ref: 123456789')).toBe(6500);
    expect(extractAmountFromText('Paid Rs. 8750.00 today')).toBe(8750);
    expect(extractAmountFromText('INR 6,500')).toBe(6500);
  });

  it('uses the largest number when no currency symbol is present', () => {
    expect(extractAmountFromText('UPI Ref 123456789 amount 6500')).toBe(6500);
  });

  it('returns 0 when nothing looks like an amount', () => {
    expect(extractAmountFromText('')).toBe(0);
    expect(extractAmountFromText('hello world')).toBe(0);
  });
});

describe('extractMonthFromText', () => {
  it('parses month keywords', () => {
    expect(extractMonthFromText('Month 4 installment')).toBe(4);
    expect(extractMonthFromText('Instalment #9')).toBe(9);
    expect(extractMonthFromText('installment: 12')).toBe(12);
  });

  it('defaults to 1 when no month is mentioned', () => {
    expect(extractMonthFromText('Payment of 6500')).toBe(1);
    expect(extractMonthFromText('')).toBe(1);
  });

  it('clamps out-of-range values to 1', () => {
    expect(extractMonthFromText('month 99')).toBe(1);
  });
});

describe('parseScannedJson', () => {
  it('parses a clean JSON payload', () => {
    expect(parseScannedJson('{"amount": 6500, "month": 4}')).toEqual({
      amount: 6500,
      month: 4,
      utr: null,
    });
  });

  it('strips markdown code fences', () => {
    expect(parseScannedJson('```json\n{"amount": 7100, "month": 5}\n```')).toEqual({
      amount: 7100,
      month: 5,
      utr: null,
    });
  });

  it('parses a UTR reference', () => {
    expect(parseScannedJson('{"amount": 6500, "month": 4, "utr": "421234567890"}')).toEqual({
      amount: 6500,
      month: 4,
      utr: '421234567890',
    });
  });

  it('rejects invalid amounts', () => {
    expect(parseScannedJson('{"amount": 0, "month": 1}')).toBeNull();
    expect(parseScannedJson('{"month": 1}')).toBeNull();
  });

  it('defaults missing month to 1', () => {
    expect(parseScannedJson('{"amount": 6500}')).toEqual({ amount: 6500, month: 1, utr: null });
  });

  it('returns null for malformed JSON', () => {
    expect(parseScannedJson('not json')).toBeNull();
    expect(parseScannedJson('')).toBeNull();
  });
});

describe('normalizeUtr', () => {
  it('uppercases and strips noise', () => {
    expect(normalizeUtr('  abc-123456  ')).toBe('ABC123456');
  });

  it('rejects non-string or too-short values', () => {
    expect(normalizeUtr(null)).toBeNull();
    expect(normalizeUtr(12345)).toBeNull();
    expect(normalizeUtr('ab')).toBeNull();
  });
});

describe('extractUtrFromText', () => {
  it('finds a UTR-labelled reference', () => {
    expect(extractUtrFromText('UTR 421234567890 paid 6500')).toBe('421234567890');
    expect(extractUtrFromText('UPI Ref: 421234567890')).toBe('421234567890');
  });

  it('falls back to a bare 12-digit number', () => {
    expect(extractUtrFromText('Txn 421234567890')).toBe('421234567890');
  });

  it('returns null when nothing matches', () => {
    expect(extractUtrFromText('paid 6500 only')).toBeNull();
    expect(extractUtrFromText('')).toBeNull();
  });
});