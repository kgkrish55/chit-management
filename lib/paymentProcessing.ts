import { createHash } from 'node:crypto';
import { normalizeUtr } from './paymentScanner';

export interface ScanOutcome {
  fileName: string;
  amount: number;
  month: number;
  utr: string | null;
  imageHash: string;
}

export function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function buildReceiptUtr(utr: string | null, imageHash: string): string {
  const normalized = normalizeUtr(utr);
  if (normalized) return normalized;
  return `IMG-${imageHash.slice(0, 12).toUpperCase()}`;
}

export interface DedupeResult {
  unique: ScanOutcome[];
  duplicates: { fileName: string; utr: string }[];
}

export function dedupeUploads(scans: ScanOutcome[]): DedupeResult {
  const seen = new Set<string>();
  const unique: ScanOutcome[] = [];
  const duplicates: { fileName: string; utr: string }[] = [];

  for (const scan of scans) {
    const key = buildReceiptUtr(scan.utr, scan.imageHash);
    if (seen.has(key)) {
      duplicates.push({ fileName: scan.fileName, utr: key });
    } else {
      seen.add(key);
      unique.push(scan);
    }
  }
  return { unique, duplicates };
}

export function computeRemainingDue(
  monthlyDue: number,
  alreadyPaidForMonth: number,
  newAmount: number
): number {
  const remaining = monthlyDue - alreadyPaidForMonth - newAmount;
  return remaining > 0 ? remaining : 0;
}

export function formatINR(value: number): string {
  return value.toLocaleString('en-IN');
}