import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const MONTHLY_DUE: Record<number, number> = {
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

interface ScanResult {
  amount: number;
  month: number;
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

async function scanWithGemini(base64Image: string, mimeType: string): Promise<ScanResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;

  // Gemini keys start with "AIza"; anything else is not usable with this API.
  if (!apiKey || !apiKey.startsWith('AIza')) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analyze this payment receipt screenshot and return ONLY valid JSON with no markdown.
Schema: {"amount": <number>, "month": <number>}
- amount: the exact numeric amount paid in Indian Rupees (no commas, no currency symbol).
- month: the chit month number if visible in the text, otherwise 1.`,
                },
                {
                  inline_data: {
                    mime_type: mimeType || 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API Non-OK Response:', response.status, await response.text());
      return null;
    }

    const aiData = await response.json();
    const responseText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = responseText.replace(/```json|```/g, '').trim();

    if (!cleanJson) return null;

    const parsed = JSON.parse(cleanJson) as { amount?: unknown; month?: unknown };
    const amount = Number(parsed.amount);
    const month = Number(parsed.month);

    if (!Number.isFinite(amount) || amount <= 0) return null;
    return {
      amount: Math.round(amount),
      month: Number.isFinite(month) && month >= 1 && month <= 12 ? Math.round(month) : 1,
    };
  } catch (err) {
    console.error('Gemini Fetch OCR Error:', err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function scanWithTesseract(buffer: Buffer): Promise<ScanResult | null> {
  try {
    const Tesseract = (await import('tesseract.js')).default;
    const result = await withTimeout(
      Tesseract.recognize(buffer, 'eng', { logger: () => {} }),
      8000
    );
    if (!result) {
      console.error('Tesseract OCR timed out or failed');
      return null;
    }
    const text = result.data.text || '';

    // Prefer amounts written with a currency symbol, else the largest number.
    const currencyMatches = [...text.matchAll(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/gi)];
    const allNumbers = [...text.matchAll(/\b(\d{2,6}(?:,\d{3})*)\b/g)].map(
      (m) => Number(m[1].replace(/,/g, ''))
    );

    let amount = 0;
    if (currencyMatches.length > 0) {
      const candidate = Number(currencyMatches[0][1].replace(/,/g, ''));
      if (Number.isFinite(candidate) && candidate > 0) amount = candidate;
    } else if (allNumbers.length > 0) {
      amount = Math.max(...allNumbers);
    }

    if (amount <= 0) return null;

    const monthMatch = text.match(/(?:month|instalment|installment)\s*[#:]*\s*(\d{1,2})/i);
    const month = monthMatch ? Number(monthMatch[1]) : 1;

    return {
      amount,
      month: month >= 1 && month <= 12 ? month : 1,
    };
  } catch (err) {
    console.error('Tesseract OCR Error:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const memberId = (formData.get('memberId') as string) || '';
    const requestedMonth = Number(formData.get('month')) || 1;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Please upload an image file (PNG/JPG)' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Image is too large. Maximum size is 10 MB.' },
        { status: 400 }
      );
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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    let result = await scanWithGemini(base64Image, file.type);
    if (!result) {
      result = await scanWithTesseract(buffer);
    }

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Could not read the amount from this screenshot. Please try a clearer image.',
        },
        { status: 422 }
      );
    }

    const monthNumber =
      result.month >= 1 && result.month <= 12 && result.month !== 1
        ? result.month
        : requestedMonth >= 1 && requestedMonth <= 12
        ? requestedMonth
        : result.month;
    const scannedAmount = result.amount;
    const dueForMonth = MONTHLY_DUE[monthNumber] || MONTHLY_DUE[1];

    // Attach the member's primary batch if they have one.
    const { data: enrollment } = await supabaseAdmin
      .from('group_enrollments')
      .select('group_id')
      .eq('member_id', member.id)
      .limit(1)
      .maybeSingle();

    const { error: paymentError } = await supabaseAdmin.from('member_payments').insert([
      {
        member_id: member.id,
        group_id: enrollment?.group_id || null,
        amount_paid: scannedAmount,
        month_number: monthNumber,
        payment_mode: 'UPI',
        receipt_utr: `UPI-${Date.now().toString().slice(-8)}`,
        status: scannedAmount >= dueForMonth ? 'PAID' : 'PARTIAL',
      },
    ]);

    if (paymentError) {
      console.error('Payment insert error:', paymentError);
      return NextResponse.json(
        { success: false, error: paymentError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Receipt scanned! Recorded ₹${scannedAmount.toLocaleString('en-IN')} for Month ${monthNumber}.`,
      memberId: member.id,
      amount: scannedAmount,
      month: monthNumber,
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