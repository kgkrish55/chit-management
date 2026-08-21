'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Handwritten Ledger Chit Schedule
const MONTHLY_CHIT_SCHEDULE = [
  { month: 1, due: 6500, payout: 72000 },
  { month: 2, due: 6600, payout: 74000 },
  { month: 3, due: 6750, payout: 76000 },
  { month: 4, due: 7000, payout: 78000 },
  { month: 5, due: 7100, payout: 80000 },
  { month: 6, due: 7350, payout: 83000 },
  { month: 7, due: 7600, payout: 86000 },
  { month: 8, due: 7800, payout: 89000 },
  { month: 9, due: 8100, payout: 92000 },
  { month: 10, due: 8350, payout: 95000 },
  { month: 11, due: 8600, payout: 98000 },
  { month: 12, due: 8750, payout: 100000 },
];

interface PortalMember {
  id: string;
  full_name: string;
  phone_number: string;
}

interface PortalPayment {
  id: string;
  member_id: string;
  group_id: string | null;
  month_number: number;
  amount_paid: number;
  payment_mode: string;
  status: string;
  receipt_utr?: string | null;
  created_at?: string;
}

interface Banner {
  type: 'success' | 'error';
  text: string;
  detail?: string;
}

interface UploadOutcome {
  success: boolean;
  message?: string;
  error?: string;
  amount?: number;
  remainingDue?: number | null;
  skippedDuplicates?: string[];
  unreadable?: string[];
}

function MemberPortalInner() {
  const searchParams = useSearchParams();

  const phone = (searchParams.get('phone') || '').replace(/\D/g, '').slice(-10);

  const [loading, setLoading] = useState<boolean>(phone.length > 0);
  const [error, setError] = useState<string | null>(
    phone.length > 0
      ? null
      : 'No phone number provided. Please open the link sent to you on WhatsApp, or contact the admin.'
  );
  const [member, setMember] = useState<PortalMember | null>(null);
  const [payments, setPayments] = useState<PortalPayment[]>([]);
  const [batchNames, setBatchNames] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);

  const loadPayments = useCallback(async (memberId: string) => {
    const { data } = await supabase
      .from('member_payments')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });
    return (data as PortalPayment[] | null) || [];
  }, []);

  useEffect(() => {
    if (!phone) return;

    const loadMemberData = async () => {
      try {
        const { data: memberData, error: memberError } = await supabase
          .from('members')
          .select('id, full_name, phone_number')
          .eq('phone_number', phone)
          .maybeSingle();

        if (memberError) throw memberError;

        if (!memberData) {
          setError('No account found for this phone number. Please contact the admin.');
          return;
        }

        setMember(memberData);

        const { data: enrollments } = await supabase
          .from('group_enrollments')
          .select('group_id')
          .eq('member_id', memberData.id);

        const groupIds = (enrollments || []).map((e) => e.group_id);
        if (groupIds.length > 0) {
          const { data: groups } = await supabase
            .from('chit_groups')
            .select('group_name')
            .in('id', groupIds);
          setBatchNames((groups || []).map((g) => g.group_name));
        }

        const paymentData = await loadPayments(memberData.id);
        setPayments(paymentData);

        const nextUnpaid =
          MONTHLY_CHIT_SCHEDULE.find((s) => {
            const monthSum = paymentData
              .filter((p) => p.month_number === s.month)
              .reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
            return monthSum < s.due;
          }) || MONTHLY_CHIT_SCHEDULE[0];
        setSelectedMonth(nextUnpaid.month);
      } catch (err) {
        console.error('Database fetch error:', err);
        setError('Could not load your account. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadMemberData();
  }, [phone, loadPayments]);

  const totalPaidSum = payments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
  const formatINR = (val: number) => val.toLocaleString('en-IN');

  const monthPaidSum = (month: number) =>
    payments
      .filter((p) => p.month_number === month)
      .reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 5) {
      setBanner({
        type: 'error',
        text: 'You can upload a maximum of 5 screenshots at once.',
      });
      return;
    }
    setSelectedFiles(files);
    setBanner(null);
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) return;
    if (!member) return;

    setIsUploading(true);
    setBanner(null);

    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append('files', file);
      }
      formData.append('memberId', member.id);
      formData.append('month', String(selectedMonth));

      const res = await fetch('/api/ai-agent/scan-receipt', {
        method: 'POST',
        body: formData,
      });

      const data: UploadOutcome = await res.json();

      const updatedPayments = await loadPayments(member.id);
      setPayments(updatedPayments);

      if (!res.ok || !data.success) {
        setBanner({
          type: 'error',
          text: data.error || 'Failed to scan screenshot',
        });
        return;
      }

      const text = data.message || 'Receipt recorded successfully!';
      const detailParts: string[] = [];
      if (data.skippedDuplicates && data.skippedDuplicates.length > 0) {
        detailParts.push(`Duplicate(s) skipped: ${data.skippedDuplicates.join(', ')}`);
      }
      if (data.unreadable && data.unreadable.length > 0) {
        detailParts.push(`Could not read: ${data.unreadable.join(', ')}`);
      }
      setBanner({
        type: 'success',
        text,
        detail: detailParts.length > 0 ? detailParts.join(' · ') : undefined,
      });
      setSelectedFiles([]);
    } catch (err) {
      setBanner({
        type: 'error',
        text: 'Upload Error: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-400">Loading your account...</span>
        </div>
      </div>
    );
  }

  if (error || !member) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-white/5 backdrop-blur border border-white/10 p-8 rounded-3xl max-w-md text-center shadow-2xl">
          <span className="text-5xl">😕</span>
          <h1 className="text-xl font-black text-white mt-4">Member Portal</h1>
          <p className="text-sm text-slate-300 mt-2">
            {error ||
              'Could not load your account. Please try again later or contact the admin.'}
          </p>
          <p className="text-xs text-slate-500 mt-4">
            Please open the WhatsApp link shared by your chit fund admin.
          </p>
        </div>
      </div>
    );
  }

  const selectedSchedule = MONTHLY_CHIT_SCHEDULE[selectedMonth - 1];
  const selectedPaid = monthPaidSum(selectedMonth);
  const selectedRemaining = Math.max(selectedSchedule.due - selectedPaid, 0);

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 pb-12">
      {/* Hero */}
      <header className="relative bg-slate-950 text-white overflow-hidden">
        <div className="absolute -top-24 -right-20 w-96 h-96 rounded-full bg-emerald-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="relative max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-md">
                Member Portal
              </span>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-3">
                Welcome, {member.full_name} 👋
              </h1>
              <p className="text-xs font-medium text-slate-400 mt-1">
                Upload your payment screenshots and track your monthly due status.
              </p>
              {batchNames.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {batchNames.map((name, idx) => (
                    <span key={idx} className="text-[10px] bg-white/10 text-slate-200 font-bold px-2 py-0.5 rounded border border-white/10">
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 backdrop-blur px-5 py-3 rounded-2xl flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Total Paid</p>
                <p className="text-lg font-black text-emerald-400">₹{formatINR(totalPaidSum)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 -mt-6 space-y-6">
        {/* Upload Receipt Section */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                📥 Upload Monthly Payment Screenshot
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Our AI will scan your screenshot, verify the amount, and reject duplicates.
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Payment For Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="p-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {MONTHLY_CHIT_SCHEDULE.map((s) => {
                  const paid = monthPaidSum(s.month);
                  const label = paid >= s.due ? '✓ Paid' : paid > 0 ? `Bal ₹${formatINR(s.due - paid)}` : `Due ₹${formatINR(s.due)}`;
                  return (
                    <option key={s.month} value={s.month}>
                      Month {s.month} — {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Selected month summary */}
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-500">Due for Month {selectedMonth}</p>
              <p className="text-2xl font-black text-slate-900 mt-1">₹{formatINR(selectedSchedule.due)}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-emerald-700">Already Paid</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">₹{formatINR(selectedPaid)}</p>
            </div>
            <div
              className={`rounded-2xl p-4 text-center border ${
                selectedRemaining === 0
                  ? 'bg-emerald-100 border-emerald-300'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <p className={`text-[10px] font-bold uppercase ${selectedRemaining === 0 ? 'text-emerald-800' : 'text-amber-700'}`}>
                {selectedRemaining === 0 ? 'Month Completed' : 'Still Due'}
              </p>
              <p className={`text-2xl font-black mt-1 ${selectedRemaining === 0 ? 'text-emerald-800' : 'text-amber-700'}`}>
                {selectedRemaining === 0 ? '🎉' : `₹${formatINR(selectedRemaining)}`}
              </p>
            </div>
          </div>

          {banner && (
            <div
              className={`mb-4 p-4 rounded-xl border text-sm font-semibold ${
                banner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-rose-50 border-rose-300 text-rose-800'
              }`}
            >
              <p>{banner.type === 'success' ? '✅ ' : '⚠️ '}{banner.text}</p>
              {banner.detail && (
                <p className="text-xs font-medium text-slate-600 mt-1">{banner.detail}</p>
              )}
            </div>
          )}

          <label
            className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isUploading
                ? 'bg-amber-50/50 border-amber-300'
                : 'bg-slate-50/50 hover:bg-emerald-50/60 border-slate-300 hover:border-emerald-400'
            }`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesChange}
              disabled={isUploading}
              className="hidden"
            />

            {isUploading ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-700 mt-2">
                  🤖 AI Scanning Screenshot Amount...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <span className="text-4xl">🧾</span>
                <p className="text-sm font-bold text-slate-700">
                  Click or drag payment screenshots here (up to 5)
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Supports GPay, PhonePe, Paytm receipts (PNG, JPG) — you can upload two copies of the same payment
                </p>
              </div>
            )}
          </label>

          {selectedFiles.length > 0 && !isUploading && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    <span>🖼️</span>
                    <span className="max-w-40 truncate">{f.name}</span>
                    <span className="text-slate-400">({Math.round(f.size / 1024)} KB)</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={handleFileUpload}
                  disabled={isUploading}
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md transition"
                >
                  🚀 Scan & Record {selectedFiles.length > 1 ? `(${selectedFiles.length} screenshots)` : ''}
                </button>
                <button
                  onClick={() => {
                    setSelectedFiles([]);
                    setBanner(null);
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 12-Month Due Schedule Grid */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-slate-900">📋 12-Month Due Schedule</h2>
            <span className="text-[11px] font-semibold text-slate-400">
              Handwritten Ledger Split-up Reference
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {MONTHLY_CHIT_SCHEDULE.map((s) => {
              const monthPaid = monthPaidSum(s.month);
              const isFullyPaid = monthPaid >= s.due;
              const isPartial = monthPaid > 0 && monthPaid < s.due;
              const remainingMonthBalance = s.due - monthPaid;
              const isSelected = s.month === selectedMonth;

              return (
                <div
                  key={s.month}
                  className={`p-3.5 rounded-2xl border text-xs transition-all ${
                    isFullyPaid
                      ? 'bg-emerald-50/70 border-emerald-300/80'
                      : isPartial
                      ? 'bg-amber-50/70 border-amber-300/80'
                      : 'bg-slate-50/70 border-slate-200/80'
                  } ${isSelected ? 'ring-2 ring-emerald-400' : ''}`}
                >
                  <div className="flex justify-between items-center font-bold mb-2">
                    <span className="text-slate-800">Month {s.month}</span>

                    {isFullyPaid && (
                      <span className="text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded text-[10px] font-extrabold">
                        ✓ PAID
                      </span>
                    )}
                    {isPartial && (
                      <span className="text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded text-[10px] font-extrabold">
                        ⚠️ PARTIAL
                      </span>
                    )}
                    {!isFullyPaid && !isPartial && (
                      <span className="text-slate-500 bg-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        DUE
                      </span>
                    )}
                  </div>

                  <p className="text-slate-600 font-medium">
                    Due: <strong className="text-slate-900">₹{formatINR(s.due)}</strong>
                  </p>

                  {isPartial && (
                    <div className="mt-2 pt-2 border-t border-amber-200/80">
                      <p className="text-amber-900 font-bold text-[10px]">
                        Paid: ₹{formatINR(monthPaid)} | Bal: ₹{formatINR(remainingMonthBalance)}
                      </p>
                      <p className="text-rose-600 text-[9px] font-bold mt-0.5">
                        ⚠️ Please clear remaining ₹{formatINR(remainingMonthBalance)}
                      </p>
                    </div>
                  )}

                  {isFullyPaid && (
                    <p className="text-emerald-700 font-semibold text-[10px] mt-1.5">
                      Paid: ₹{formatINR(monthPaid)}
                    </p>
                  )}

                  <p className="text-emerald-600 text-[10px] mt-1.5 pt-1 border-t border-slate-200/40 font-medium">
                    Payout: ₹{formatINR(s.payout)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4">🧾 Payment History ({payments.length})</h2>
          {payments.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No payments recorded yet. Upload your first screenshot above.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.slice(0, 20).map((p) => (
                <div key={p.id} className="py-3 flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Month {p.month_number}
                      <span
                        className={`ml-2 text-[10px] font-extrabold px-2 py-0.5 rounded ${
                          p.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {p.status}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {p.payment_mode || 'UPI'} · Ref: {p.receipt_utr}
                      {p.created_at ? ` · ${new Date(p.created_at).toLocaleDateString('en-IN')}` : ''}
                    </p>
                  </div>
                  <span className="font-black text-emerald-600 text-base">₹{formatINR(Number(p.amount_paid) || 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MemberPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MemberPortalInner />
    </Suspense>
  );
}