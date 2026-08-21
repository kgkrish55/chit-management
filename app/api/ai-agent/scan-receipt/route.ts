import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, createPartFromBase64 } from '@google/genai';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  MONTHLY_DUE,
  computePaymentStatus,
  extractAmountFromText,
  extractMonthFromText,
  extractUtrFromText,
  normalizeMonthNumber,
  parseScannedJson,
} from '@/lib/paymentScanner';
import {
  ScanOutcome,
  buildReceiptUtr,
  computeRemainingDue,
  dedupeUploads,
  formatINR,
  sha256Hex,
} from '@/lib/paymentProcessing';

const DEFAULT_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'];
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const SCAN_PROMPT = `Analyze this payment receipt screenshot and return ONLY valid JSON with no markdown.
Schema: {"amount": <number>, "month": <number>, "utr": <string>}
- amount: the exact numeric amount paid in Indian Rupees (no commas, no currency symbol).
- month: the chit month number if visible in the text, otherwise 1.
- utr: the payment reference / UTR / transaction reference number if visible, otherwise "".`;

interface ScanResult {
  amount: number;
  month: number;
  utr: string | null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

function getGeminiModels(): string[] {
  const configured = (process.env.GEMINI_MODEL || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_MODELS;
}

async function scanWithGemini(base64Image: string, mimeType: string): Promise<ScanResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 12000 },
  });

  for (const model of getGeminiModels()) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: SCAN_PROMPT },
              createPartFromBase64(base64Image, mimeType || 'image/jpeg'),
            ],
          },
        ],
        config: { responseMimeType: 'application/json' },
      });

      const raw = response.text || '';
      const parsed = parseScannedJson(raw);
      if (parsed && parsed.amount !== null) {
        return { amount: parsed.amount, month: parsed.month, utr: parsed.utr };
      }
      console.error(`Gemini model ${model} returned no usable amount:`, raw.slice(0, 200));
    } catch (err) {
      console.error(`Gemini model ${model} OCR Error:`, err instanceof Error ? err.message : err);
    }
  }

  return null;
}

async function scanWithTesseract(buffer: Buffer): Promise<ScanResult | null> {
  try {
    const Tesseract = (await import('tesseract.js')).default;
    const result = await withTimeout(
      Tesseract.recognize(buffer, 'eng', {
        langPath: `${process.cwd()}/public/tessdata`,
        gzip: true,
        logger: () => {},
      }),
      8000
    );
    if (!result) {
      console.error('Tesseract OCR timed out or failed');
      return null;
    }
    const text = result.data.text || '';
    const amount = extractAmountFromText(text);
    if (amount <= 0) return null;

    return {
      amount,
      month: extractMonthFromText(text),
      utr: extractUtrFromText(text),
    };
  } catch (err) {
    console.error('Tesseract OCR Error:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function collectFiles(formData: FormData): Promise<File[]> {
  const files: File[] = [];
  const direct = formData.get('file');
  if (direct instanceof File) files.push(direct);
  const multi = formData.getAll('files');
  for (const f of multi) {
    if (f instanceof File) files.push(f);
  }

  const seen = new Set<string>();
  return files.filter((f) => {
    const key = `${f.name}:${f.size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const memberId = (formData.get('memberId') as string) || '';
    const requestedMonth = Number(formData.get('month')) || 1;

    const files = await collectFiles(formData);

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { success: false, error: `You can upload a maximum of ${MAX_FILES} screenshots at once.` },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { success: false, error: `"${file.name}" is not an image file (PNG/JPG only).` },
          { status: 400 }
        );
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { success: false, error: `"${file.name}" is too large. Maximum size is 10 MB per image.` },
          { status: 400 }
        );
      }
    }

    // Resolve and validate the member before touching the database.
    let member: { id: string; full_name: string; phone_number: string } | null = null;
    if (memberId) {
      const { data, error } = await supabaseAdmin
        .from('members')
        .select('id, full_name, phone_number')
        .eq('id', memberId)
        .maybeSingle();

      if (error) {
        console.error('Member lookup error:', error);
        return NextResponse.json(
          { success: false, error: 'Could not verify member account.' },
          { status: 500 }
        );
      }
      member = data;
    }

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Member not found. Please open the link from your WhatsApp message.' },
        { status: 400 }
      );
    }

    // Scan every uploaded screenshot.
    const scanned: ScanOutcome[] = [];
    const failures: { fileName: string; reason: string }[] = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const imageHash = sha256Hex(buffer);
      const base64Image = buffer.toString('base64');

      let result = await scanWithGemini(base64Image, file.type);
      if (!result) result = await scanWithTesseract(buffer);

      if (!result) {
        failures.push({
          fileName: file.name,
          reason: 'Could not read the amount from this screenshot.',
        });
        continue;
      }

      scanned.push({
        fileName: file.name,
        amount: result.amount,
        month: normalizeMonthNumber(result.month, requestedMonth),
        utr: result.utr,
        imageHash,
      });
    }

    if (scanned.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            failures.length > 0
              ? failures[0].reason
              : 'Could not read the amount from these screenshots. Please try clearer images.',
        },
        { status: 422 }
      );
    }

    // Reject duplicates already present in this upload batch.
    const { unique, duplicates: batchDuplicates } = dedupeUploads(scanned);

    // Reject screenshots whose receipt reference was already recorded.
    const keys = unique.map((s) => buildReceiptUtr(s.utr, s.imageHash));
    const { data: existingRows } = await supabaseAdmin
      .from('member_payments')
      .select('receipt_utr')
      .eq('member_id', member.id)
      .in('receipt_utr', keys);

    const existingUtrs = new Set((existingRows || []).map((r) => r.receipt_utr));
    const dbDuplicates = unique.filter((s) => existingUtrs.has(buildReceiptUtr(s.utr, s.imageHash)));
    const toInsert = unique.filter((s) => !existingUtrs.has(buildReceiptUtr(s.utr, s.imageHash)));

    if (toInsert.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This screenshot was already recorded. Please upload a different screenshot (check your UTR / reference number).',
          duplicateCount: batchDuplicates.length + dbDuplicates.length,
        },
        { status: 409 }
      );
    }

    // Existing per-month totals for this member (for status + remaining due).
    const { data: priorPayments } = await supabaseAdmin
      .from('member_payments')
      .select('month_number, amount_paid')
      .eq('member_id', member.id);

    const paidPerMonth = new Map<number, number>();
    for (const p of priorPayments || []) {
      const m = Number(p.month_number);
      paidPerMonth.set(m, (paidPerMonth.get(m) || 0) + (Number(p.amount_paid) || 0));
    }

    // Attach the member's primary batch if they have one.
    const { data: enrollment } = await supabaseAdmin
      .from('group_enrollments')
      .select('group_id')
      .eq('member_id', member.id)
      .limit(1)
      .maybeSingle();

    const groupId = enrollment?.group_id || null;

    // New totals per month coming from this batch (drives per-row status).
    const monthNewTotals = new Map<number, number>();
    for (const scan of toInsert) {
      monthNewTotals.set(scan.month, (monthNewTotals.get(scan.month) || 0) + scan.amount);
    }

    const inserted: Array<{
      month_number: number;
      amount_paid: number;
      receipt_utr: string;
      status: string;
    }> = [];

    for (const scan of toInsert) {
      const utr = buildReceiptUtr(scan.utr, scan.imageHash);
      const finalMonthTotal = (paidPerMonth.get(scan.month) || 0) + (monthNewTotals.get(scan.month) || 0);
      const status = computePaymentStatus(finalMonthTotal, scan.month);

      const { data, error } = await supabaseAdmin
        .from('member_payments')
        .insert([
          {
            member_id: member.id,
            group_id: groupId,
            amount_paid: scan.amount,
            month_number: scan.month,
            payment_mode: 'UPI',
            receipt_utr: utr,
            status,
          },
        ])
        .select('month_number, amount_paid, receipt_utr, status')
        .single();

      if (error) {
        console.error('Payment insert error:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      inserted.push(data);
    }

    const recordedAmount = inserted.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
    const allDuplicates = [...batchDuplicates, ...dbDuplicates];

    // Build a human-friendly summary.
    const monthNumbers = [...new Set(inserted.map((p) => p.month_number))].sort((a, b) => a - b);
    const monthLabel =
      monthNumbers.length === 1 ? `Month ${monthNumbers[0]}` : `Months ${monthNumbers.join(', ')}`;

    let message: string;
    if (monthNumbers.length === 1) {
      const month = monthNumbers[0];
      const due = MONTHLY_DUE[month] || MONTHLY_DUE[1];
      const remaining = computeRemainingDue(
        due,
        paidPerMonth.get(month) || 0,
        monthNewTotals.get(month) || 0
      );
      message =
        remaining === 0
          ? `Month ${month} is now fully paid! 🎉 (₹${formatINR(due)})`
          : `Recorded ₹${formatINR(recordedAmount)} for ${monthLabel}. Still due ₹${formatINR(remaining)}.`;
    } else {
      message = `Recorded ₹${formatINR(recordedAmount)} for ${monthLabel}.`;
    }

    if (allDuplicates.length > 0) {
      message += ` Skipped ${allDuplicates.length} duplicate screenshot(s).`;
    }
    if (failures.length > 0) {
      message += ` Could not read ${failures.length} screenshot(s).`;
    }

    const remainingDue =
      monthNumbers.length === 1
        ? computeRemainingDue(
            MONTHLY_DUE[monthNumbers[0]] || MONTHLY_DUE[1],
            paidPerMonth.get(monthNumbers[0]) || 0,
            monthNewTotals.get(monthNumbers[0]) || 0
          )
        : null;

    return NextResponse.json({
      success: true,
      message,
      memberId: member.id,
      amount: recordedAmount,
      month: monthNumbers.length === 1 ? monthNumbers[0] : monthNumbers,
      remainingDue,
      recordedCount: inserted.length,
      skippedDuplicates: allDuplicates.map((d) => d.fileName),
      unreadable: failures.map((f) => f.fileName),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('Scan receipt error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}