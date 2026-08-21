export const MONTHLY_DUE: Record<number, number> = {
  1: 6500,
  2: 6600,
  3: 6750,
  4: 7000,
  5: 7100,
  6: 7350,
  7: 7600,
  8: 7800,
  9: 8100,
  10: 8350,
  11: 8600,
  12: 8750,
};

export const MAX_MONTH = 12;
export const DEFAULT_MONTH = 1;

export function isMonthNumber(value: unknown): value is number {
  return Number.isFinite(value) && (value as number) >= 1 && (value as number) <= MAX_MONTH;
}

export function parseScanAmount(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

export function normalizeMonthNumber(scannedMonth: number, requestedMonth: number): number {
  if (isMonthNumber(scannedMonth) && scannedMonth !== DEFAULT_MONTH) return scannedMonth;
  if (isMonthNumber(requestedMonth)) return requestedMonth;
  return isMonthNumber(scannedMonth) ? scannedMonth : DEFAULT_MONTH;
}

export function computePaymentStatus(scannedAmount: number, monthNumber: number): 'PAID' | 'PARTIAL' {
  return scannedAmount >= (MONTHLY_DUE[monthNumber] || MONTHLY_DUE[DEFAULT_MONTH]) ? 'PAID' : 'PARTIAL';
}

export function extractAmountFromText(text: string): number {
  const currencyMatches = [...text.matchAll(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi)];
  if (currencyMatches.length > 0) {
    const candidate = Number(currencyMatches[0][1].replace(/,/g, ''));
    if (Number.isFinite(candidate) && candidate > 0) return candidate;
  }

  const allNumbers = [...text.matchAll(/\b(\d{2,6}(?:,\d{3})*)\b/g)]
    .map((m) => Number(m[1].replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (allNumbers.length > 0) return Math.max(...allNumbers);
  return 0;
}

export function extractMonthFromText(text: string): number {
  const monthMatch = text.match(/(?:month|instalment|installment)\s*[#:]*\s*(\d{1,2})/i);
  const month = monthMatch ? Number(monthMatch[1]) : DEFAULT_MONTH;
  return isMonthNumber(month) ? month : DEFAULT_MONTH;
}

export function normalizeUtr(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const utr = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (utr.length < 6) return null;
  return utr;
}

export function extractUtrFromText(text: string): string | null {
  const patterns = [
    /(?:UTR|U\.T\.R\.|Ref(?:erence)?\.?|Txn\.?|UPI Ref)\s*[#:]?\s*([A-Z0-9]{8,20})/gi,
    /\b(\d{12})\b/g,
  ];

  for (const pattern of patterns) {
    const match = [...text.matchAll(pattern)];
    if (match.length > 0) {
      const utr = normalizeUtr(match[0][1]);
      if (utr) return utr;
    }
  }
  return null;
}

export interface ScannedJson {
  amount: number | null;
  month: number;
  utr: string | null;
}

export function parseScannedJson(raw: string): ScannedJson | null {
  const cleanJson = raw.replace(/```json|```/g, '').trim();
  if (!cleanJson) return null;

  try {
    const parsed = JSON.parse(cleanJson) as {
      amount?: unknown;
      month?: unknown;
      utr?: unknown;
    };
    const amount = parseScanAmount(parsed.amount);
    if (amount === null) return null;
    return {
      amount,
      month: isMonthNumber(parsed.month) ? Math.round(parsed.month as number) : DEFAULT_MONTH,
      utr: normalizeUtr(parsed.utr),
    };
  } catch {
    return null;
  }
}