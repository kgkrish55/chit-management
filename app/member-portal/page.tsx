'use client';

import React, { useState, useEffect } from 'react';
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

export default function MemberPortalPage() {
  const [memberId, setMemberId] = useState<string>('');
  const [memberName, setMemberName] = useState<string>('Participant');
  const [payments, setPayments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Fetch real member data directly on mount
  useEffect(() => {
    setIsMounted(true);

    const loadMemberData = async () => {
      try {
        const { data: memberData } = await supabase
          .from('members')
          .select('id, name')
          .limit(1)
          .maybeSingle();

        if (memberData?.id) {
          setMemberId(memberData.id);
          setMemberName(memberData.name || 'Participant 1');

          const { data: paymentData } = await supabase
            .from('member_payments')
            .select('*')
            .eq('member_id', memberData.id);

          if (paymentData) {
            setPayments(paymentData);
          }
        }
      } catch (err) {
        console.error('Database fetch error:', err);
      }
    };

    loadMemberData();
  }, []);

  const totalPaidSum = payments.reduce(
    (sum, p) => sum + (Number(p.amount_paid) || 0),
    0
  );

  const formatINR = (val: number) => {
    if (!isMounted) return val.toString();
    return val.toLocaleString('en-IN');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (memberId) {
        formData.append('memberId', memberId);
      }

      const res = await fetch('/api/ai-agent/scan-receipt', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(`Receipt Scanning Error: ${data.error || 'Failed to scan screenshot'}`);
      } else {
        alert(data.message || 'Receipt scanned successfully!');
        
        // Sync the returned valid memberId & reload payments
        const activeId = data.memberId || memberId;
        if (activeId) {
          setMemberId(activeId);
          const { data: updatedPayments } = await supabase
            .from('member_payments')
            .select('*')
            .eq('member_id', activeId);

          if (updatedPayments) {
            setPayments(updatedPayments);
          }
        }
      }
    } catch (err: any) {
      alert(`Upload Error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md">
              Member Portal
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-2">
              Welcome, {memberName} 👋
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Upload your payment screenshots and track your monthly due status.
            </p>
          </div>

          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold">Total Paid: ₹{formatINR(totalPaidSum)}</span>
          </div>
        </div>

        {/* Upload Receipt Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              📥 Upload Monthly Payment Screenshot
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Our AI will scan your screenshot and verify the exact amount paid.
            </p>
          </div>

          <label className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isUploading 
              ? 'bg-amber-50/50 border-amber-300' 
              : 'bg-slate-50/50 hover:bg-slate-100/80 border-slate-300 hover:border-indigo-400'
          }`}>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden" 
            />

            {isUploading ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-700 mt-2">
                  🤖 AI Scanning Screenshot Amount...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <span className="text-3xl">🧾</span>
                <p className="text-xs font-bold text-slate-700">
                  Click or drag payment screenshot here
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Supports GPay, PhonePe, Paytm receipts (PNG, JPG)
                </p>
              </div>
            )}
          </label>
        </div>

        {/* 12-Month Due Schedule Grid */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-slate-900">
              📋 12-Month Due Schedule
            </h2>
            <span className="text-[11px] font-semibold text-slate-400">
              Handwritten Ledger Split-up Reference
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {MONTHLY_CHIT_SCHEDULE.map((s) => {
              const monthPayments = payments.filter(p => p.month_number === s.month);
              const monthPaidSum = monthPayments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);

              const isFullyPaid = monthPaidSum >= s.due;
              const isPartial = monthPaidSum > 0 && monthPaidSum < s.due;
              const isUnpaid = monthPaidSum === 0;
              const remainingMonthBalance = s.due - monthPaidSum;

              return (
                <div 
                  key={s.month} 
                  className={`p-3.5 rounded-xl border text-xs transition-all ${
                    isFullyPaid 
                      ? 'bg-emerald-50/70 border-emerald-300/80' 
                      : isPartial
                      ? 'bg-amber-50/70 border-amber-300/80'
                      : 'bg-slate-50/70 border-slate-200/80'
                  }`}
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
                    {isUnpaid && (
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
                        Paid: ₹{formatINR(monthPaidSum)} | Bal: ₹{formatINR(remainingMonthBalance)}
                      </p>
                      <p className="text-rose-600 text-[9px] font-bold mt-0.5">
                        ⚠️ Please clear remaining ₹{formatINR(remainingMonthBalance)}
                      </p>
                    </div>
                  )}

                  {isFullyPaid && (
                    <p className="text-emerald-700 font-semibold text-[10px] mt-1.5">
                      Paid: ₹{formatINR(monthPaidSum)}
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

      </div>
    </div>
  );
}