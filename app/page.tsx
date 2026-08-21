'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { getAppBaseUrl } from '@/lib/appUrl';

// Exact Chit Schedule matching handwritten ledger
const MONTHLY_CHIT_SCHEDULE = [
  { month: 1, duePerPerson: 6500, winnerPayout: 72000 },
  { month: 2, duePerPerson: 6600, winnerPayout: 74000 },
  { month: 3, duePerPerson: 6750, winnerPayout: 76000 },
  { month: 4, duePerPerson: 7000, winnerPayout: 78000 },
  { month: 5, duePerPerson: 7100, winnerPayout: 80000 },
  { month: 6, duePerPerson: 7350, winnerPayout: 83000 },
  { month: 7, duePerPerson: 7600, winnerPayout: 86000 },
  { month: 8, duePerPerson: 7800, winnerPayout: 89000 },
  { month: 9, duePerPerson: 8100, winnerPayout: 92000 },
  { month: 10, duePerPerson: 8350, winnerPayout: 95000 },
  { month: 11, duePerPerson: 8600, winnerPayout: 98000 },
  { month: 12, duePerPerson: 8750, winnerPayout: 100000 },
];

interface Member {
  id: string;
  full_name: string;
  phone_number: string;
  created_at?: string;
}

interface Batch {
  id: string;
  group_name: string;
  start_date: string | null;
  due_day: number | null;
}

interface Enrollment {
  id: string;
  member_id: string;
  group_id: string;
}

interface Payment {
  id: string;
  member_id: string;
  group_id: string | null;
  month_number: number;
  amount_paid: number;
  payment_mode: string;
  receipt_utr: string | null;
  status: string;
  members?: { full_name: string; phone_number: string } | null;
  chit_groups?: { group_name: string } | null;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

interface BatchSettingsFormProps {
  batch: Batch;
  onSaved: () => Promise<void>;
}

function BatchSettingsForm({ batch, onSaved }: BatchSettingsFormProps) {
  const [startDate, setStartDate] = useState(batch.start_date || '2025-01-10');
  const [dueDay, setDueDay] = useState<number>(batch.due_day || 10);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('chit_groups')
        .update({ start_date: startDate, due_day: Number(dueDay) })
        .eq('id', batch.id);

      if (error) throw error;

      alert(`✅ Updated Batch Start Date to ${startDate}!`);
      await onSaved();
    } catch (err) {
      alert('Error updating batch: ' + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
          Batch Start Date
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-900"
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Due Day</label>
        <input
          type="number"
          min={1}
          max={31}
          value={dueDay}
          onChange={(e) => setDueDay(Number(e.target.value))}
          className="p-2 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-900 w-20"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
      >
        {saving ? 'Saving...' : 'Set Date'}
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'batches' | 'members' | 'receipts'>('batches');

  const [members, setMembers] = useState<Member[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [appBaseUrl, setAppBaseUrl] = useState<string>('');

  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Form & Cash Payment States
  const [newMember, setNewMember] = useState({ name: '', phone: '', batchId: '' });
  const [cashPayModal, setCashPayModal] = useState<{ open: boolean; member: Member | null }>({ open: false, member: null });
  const [cashAmount, setCashAmount] = useState<number>(6500);
  const [cashMonth, setCashMonth] = useState<number>(1);

  const fetchData = useCallback(async () => {
    try {
      const { data: membersData, error: membersError } = await supabase.from('members').select('*').order('created_at', { ascending: false });
      const { data: batchesData, error: batchesError } = await supabase.from('chit_groups').select('*').order('id', { ascending: true });
      const { data: enrollmentsData, error: enrollmentsError } = await supabase.from('group_enrollments').select('*');
      const { data: paymentsData, error: paymentsError } = await supabase.from('member_payments').select('*, members(full_name, phone_number), chit_groups(group_name)');

      const firstError = membersError || batchesError || enrollmentsError || paymentsError;
      if (firstError) {
        setDataError(firstError.message);
        return;
      }

      if (membersData) setMembers(membersData);
      if (batchesData) setBatches(batchesData);
      if (enrollmentsData) setEnrollments(enrollmentsData);
      if (paymentsData) setPayments(paymentsData);
      setDataError('');

      // Default selections to the first batch once data is available.
      if (batchesData && batchesData.length > 0) {
        setSelectedBatchId((current) =>
          current && batchesData.some((b) => b.id === current) ? current : batchesData[0].id
        );
        setNewMember((current) =>
          current.batchId && batchesData.some((b) => b.id === current.batchId)
            ? current
            : { ...current, batchId: batchesData[0].id }
        );
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setDataError(getErrorMessage(err) || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const data = await res.json();
      if (data.appBaseUrl) setAppBaseUrl(data.appBaseUrl);
      if (!data.authenticated) router.replace('/login');
    } catch (err) {
      console.error("Session check error:", err);
    }
  }, [router]);

  useEffect(() => {
    const load = async () => {
      await Promise.resolve();
      checkSession();
      fetchData();
    };
    load();
  }, [checkSession, fetchData]);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error("Logout error:", err);
    }
    router.push('/login');
    router.refresh();
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name || !newMember.phone) return alert('Please enter both name and phone number.');

    const cleanPhone = newMember.phone.trim().replace(/\D/g, '').slice(-10);

    try {
      const { data: existingMember } = await supabase
        .from('members')
        .select('id')
        .eq('phone_number', cleanPhone)
        .maybeSingle();

      let memberId = existingMember?.id;

      if (!memberId) {
        const { data: createdMember, error: mError } = await supabase
          .from('members')
          .insert([{ full_name: newMember.name, phone_number: cleanPhone }])
          .select('id')
          .single();

        if (mError) throw mError;
        memberId = createdMember.id;
      }

      if (newMember.batchId && memberId) {
        const { data: existingEnrollment } = await supabase
          .from('group_enrollments')
          .select('*')
          .eq('member_id', memberId)
          .eq('group_id', newMember.batchId)
          .maybeSingle();

        if (existingEnrollment) {
          alert('Participant is already enrolled in this batch!');
        } else {
          await supabase.from('group_enrollments').insert([
            { member_id: memberId, group_id: newMember.batchId }
          ]);
          alert('✅ Participant added and reflected across Batches!');
        }
      }

      setNewMember({ name: '', phone: '', batchId: newMember.batchId });
      await fetchData();
    } catch (err) {
      alert('Error: ' + getErrorMessage(err));
    }
  };

  const handleMarkCashPaid = async () => {
    if (!cashPayModal.member) return;

    try {
      const { error } = await supabase.from('member_payments').insert([
        {
          member_id: cashPayModal.member.id,
          group_id: selectedBatchId,
          amount_paid: cashAmount,
          month_number: cashMonth,
          payment_mode: 'CASH',
          receipt_utr: `CASH-HAND-${Date.now().toString().slice(-6)}`,
          status: 'PAID'
        }
      ]);

      if (error) throw error;

      alert(`✅ Cash payment of ₹${cashAmount} recorded for Month ${cashMonth}!`);
      setCashPayModal({ open: false, member: null });
      await fetchData();
    } catch (err) {
      alert('Error recording cash payment: ' + getErrorMessage(err));
    }
  };

  const sendWhatsApp = (phone: string, name: string) => {
    if (!phone) return alert('Phone number is missing!');
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    // Production member-portal link: server-computed Vercel URL (via /api/auth/session),
    // falling back to NEXT_PUBLIC_APP_URL / current origin.
    const host = appBaseUrl || getAppBaseUrl();
    const portalUrl = `${host}/member-portal?phone=${cleanPhone}`;

    const message = `CHIT FUND ACCOUNT STATEMENT

Hello ${name},

Your account statement is ready! Click the link below to view your account details, monthly dues, and paid receipts:

${portalUrl}

Reply HELP if you need assistance.`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const getMemberPaidStats = (memberId: string, batchId: string) => {
    const memberPayments = payments.filter(p => p.member_id === memberId && (p.group_id === batchId || !p.group_id));
    const totalPaid = memberPayments.reduce((acc, curr) => acc + (Number(curr.amount_paid) || 0), 0);
    const monthsPaidCount = new Set(memberPayments.map(p => p.month_number)).size;

    return { totalPaid, monthsPaidCount, memberPayments };
  };

  const getMemberOutstanding = (memberId: string) => {
    const memberPayments = payments.filter(p => p.member_id === memberId);
    let outstanding = 0;
    for (const s of MONTHLY_CHIT_SCHEDULE) {
      const paid = memberPayments
        .filter(p => p.month_number === s.month)
        .reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
      outstanding += Math.max(s.duePerPerson - paid, 0);
    }
    return outstanding;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-slate-400">Loading Command Center...</span>
        </div>
      </div>
    );
  }

  const selectedBatchObj = batches.find(b => b.id === selectedBatchId) || batches[0];
  const membersInSelectedBatch = enrollments
    .filter(e => e.group_id === selectedBatchObj?.id)
    .map(e => members.find(m => m.id === e.member_id))
    .filter((m): m is Member => Boolean(m));

  const totalCollected = payments.reduce((sum, p) => sum + (Number(p.amount_paid) || 0), 0);
  const totalOutstanding = members.reduce((sum, m) => sum + getMemberOutstanding(m.id), 0);

  return (
    <div className="min-h-screen bg-slate-100 font-sans pb-12 text-slate-900">
      {/* Header */}
      <header className="relative bg-slate-950 text-white overflow-hidden">
        <div className="absolute -top-24 -right-20 w-96 h-96 rounded-full bg-emerald-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center gap-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-emerald-400">
                Chit Fund Management System
              </p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
                CHIT ADMIN COMMAND CENTER
              </h1>
              <p className="text-xs text-slate-400 mt-1">1 Lakh (12-Month) · Manage batches, members & receipts</p>
            </div>
            <button onClick={handleLogout} className="bg-rose-500/90 hover:bg-rose-500 text-xs font-bold px-4 py-2 rounded-lg text-white transition">
              Logout
            </button>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur">
              <p className="text-[10px] font-bold uppercase text-slate-400">Participants</p>
              <p className="text-2xl font-black text-white mt-1">{members.length}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur">
              <p className="text-[10px] font-bold uppercase text-slate-400">Batches</p>
              <p className="text-2xl font-black text-white mt-1">{batches.length}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur">
              <p className="text-[10px] font-bold uppercase text-slate-400">Collected</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">₹{totalCollected.toLocaleString('en-IN')}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur">
              <p className="text-[10px] font-bold uppercase text-slate-400">Outstanding</p>
              <p className="text-2xl font-black text-amber-400 mt-1">₹{totalOutstanding.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        {dataError && (
          <div className="bg-red-50 border border-red-300 text-red-800 text-sm font-semibold px-4 py-3 rounded-xl mb-6">
            ⚠️ Could not load data: {dataError}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {([
            ['batches', '📦', `Batches & Members (${batches.length})`],
            ['members', '👥', `All Participants (${members.length})`],
            ['receipts', '🧾', `Member Receipts (${payments.length})`],
          ] as const).map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeTab === key
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* TAB 1: BATCHES */}
        {activeTab === 'batches' && (
          <div className="space-y-8">
            {/* Batch Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {batches.map((b) => {
                const count = enrollments.filter(e => e.group_id === b.id).length;
                const isSelected = selectedBatchId === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBatchId(b.id)}
                    className={`cursor-pointer p-5 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-900 shadow-xl'
                        : 'bg-white text-slate-900 border-slate-200 hover:border-emerald-400 hover:shadow-md'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isSelected ? 'bg-slate-800 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                        1 Lakh Chit
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{b.start_date || 'N/A'}</span>
                    </div>
                    <h3 className="text-lg font-black mt-2">🎯 {b.group_name}</h3>
                    <p className={`text-xs mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{count} Enrolled</p>
                    <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min((count / 20) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Batch Details */}
            {selectedBatchObj && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div className="flex flex-col md:flex-row justify-between md:items-center pb-6 border-b gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">{selectedBatchObj.group_name} — Participants</h2>
                    <p className="text-xs text-slate-500 mt-1">Total Pool: ₹1,00,000 | 12-Month Ledger</p>
                  </div>
                  <BatchSettingsForm key={selectedBatchObj.id} batch={selectedBatchObj} onSaved={fetchData} />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase bg-slate-50">
                        <th className="py-3 px-4">Participant</th>
                        <th className="py-3 px-4">Phone Number</th>
                        <th className="py-3 px-4">Total Paid</th>
                        <th className="py-3 px-4">Outstanding</th>
                        <th className="py-3 px-4">Months Cleared</th>
                        <th className="py-3 px-4">In-Hand Cash</th>
                        <th className="py-3 px-4">WhatsApp Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {membersInSelectedBatch.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-500">No participants enrolled in this batch yet.</td>
                        </tr>
                      ) : (
                        membersInSelectedBatch.map((m) => {
                          const stats = getMemberPaidStats(m.id, selectedBatchObj.id);
                          const outstanding = getMemberOutstanding(m.id);
                          return (
                            <tr key={m.id} className="hover:bg-emerald-50/40 transition">
                              <td className="py-4 px-4 font-bold text-slate-900">
                                <button onClick={() => setSelectedMember(m)} className="text-indigo-600 hover:text-indigo-700 hover:underline font-bold text-left">
                                  {m.full_name} 🔍
                                </button>
                              </td>
                              <td className="py-4 px-4 text-slate-700 font-medium">+91 {m.phone_number}</td>
                              <td className="py-4 px-4 font-black text-emerald-600">₹{stats.totalPaid.toLocaleString()}</td>
                              <td className="py-4 px-4">
                                {outstanding > 0 ? (
                                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-md border border-amber-200">
                                    ₹{outstanding.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-md border border-emerald-200">
                                    ✓ Clear
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4">
                                <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-md border border-slate-200">
                                  {stats.monthsPaidCount} / 12 Months
                                </span>
                              </td>
                              <td className="py-4 px-4">
                                <button
                                  onClick={() => setCashPayModal({ open: true, member: m })}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition"
                                >
                                  💵 Mark as Paid
                                </button>
                              </td>
                              <td className="py-4 px-4">
                                <button
                                  onClick={() => sendWhatsApp(m.phone_number, m.full_name)}
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition"
                                >
                                  📲 Send Link
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Ledger Reference Breakdown */}
                <div className="pt-6 border-t">
                  <h3 className="text-xs font-bold uppercase text-slate-600 mb-3">📋 Handwritten Ledger Split-Up Reference</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {MONTHLY_CHIT_SCHEDULE.map((sch) => (
                      <div key={sch.month} className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs hover:border-emerald-300 transition">
                        <span className="font-black text-slate-900">Month {sch.month}</span>
                        <div className="mt-1 text-slate-600">Due: <strong className="text-slate-900">₹{sch.duePerPerson}</strong></div>
                        <div className="text-emerald-700 font-bold mt-0.5">Payout: ₹{sch.winnerPayout.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PARTICIPANTS FORM */}
        {activeTab === 'members' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-1">
              <h2 className="text-xl font-black text-slate-900 mb-1">Add Participant</h2>
              <p className="text-xs text-slate-500 mb-6">Creates participant and adds to batch</p>

              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter full name"
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 font-medium placeholder-slate-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="10-digit mobile number"
                    value={newMember.phone}
                    onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 font-medium placeholder-slate-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Assign Batch</label>
                  <select
                    value={newMember.batchId}
                    onChange={(e) => setNewMember({ ...newMember, batchId: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500 font-medium outline-none"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>{b.group_name} ({b.start_date || 'N/A'})</option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3.5 rounded-xl shadow-md transition mt-4">
                  Save Participant
                </button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-2">
              <h2 className="text-xl font-black text-slate-900 mb-4">Participant Directory ({members.length})</h2>
              <div className="divide-y divide-slate-100">
                {members.map((m) => {
                  const enrolledBatches = enrollments
                    .filter(e => e.member_id === m.id)
                    .map(e => batches.find(b => b.id === e.group_id)?.group_name)
                    .filter(Boolean);

                  return (
                    <div key={m.id} className="py-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900 text-base">{m.full_name}</p>
                        <p className="text-xs text-slate-500">📱 +91 {m.phone_number}</p>
                        <div className="flex gap-1.5 mt-1">
                          {enrolledBatches.map((bName, idx) => (
                            <span key={idx} className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-100">
                              {bName}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => sendWhatsApp(m.phone_number, m.full_name)}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                      >
                        📲 Send Link
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RECEIPTS */}
        {activeTab === 'receipts' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-4">Member Receipts History ({payments.length})</h2>
            <div className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <p className="py-10 text-center text-slate-500 text-sm">No receipts recorded yet.</p>
              ) : (
                payments.map((p) => {
                  const statusPaid = p.status === 'PAID';
                  return (
                    <div key={p.id} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900">
                          {p.members?.full_name || 'Member'}
                          <span
                            className={`ml-2 text-[10px] font-extrabold px-2 py-0.5 rounded ${
                              statusPaid
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.status || 'PARTIAL'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Month {p.month_number} • Mode: <span className="font-bold text-slate-700">{p.payment_mode || 'UPI'}</span> • Ref: {p.receipt_utr}
                        </p>
                      </div>
                      <p className="font-black text-emerald-600 text-base">₹{p.amount_paid?.toLocaleString()}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* MARK CASH PAID MODAL */}
      {cashPayModal.open && cashPayModal.member && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900">💵 Record Cash Payment</h3>
            <p className="text-xs text-slate-500 mt-0.5">Member: <strong>{cashPayModal.member.full_name}</strong></p>

            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Select Month</label>
                <select
                  value={cashMonth}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setCashMonth(m);
                    setCashAmount(MONTHLY_CHIT_SCHEDULE[m - 1]?.duePerPerson || 6500);
                  }}
                  className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 font-medium bg-white outline-none"
                >
                  {MONTHLY_CHIT_SCHEDULE.map((s) => (
                    <option key={s.month} value={s.month}>Month {s.month} (Due: ₹{s.duePerPerson})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Amount Collected (₹)</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(Number(e.target.value))}
                  className="w-full p-3 border border-slate-200 rounded-xl text-slate-900 font-bold text-lg bg-white outline-none"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setCashPayModal({ open: false, member: null })} className="w-1/2 bg-slate-200 text-slate-800 font-bold py-3 rounded-xl hover:bg-slate-300 transition">
                  Cancel
                </button>
                <button onClick={handleMarkCashPaid} className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition">
                  Confirm Paid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEMBER DRILL DOWN MODAL */}
      {selectedMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">{selectedMember.full_name}</h3>
                <p className="text-xs text-slate-500">📱 +91 {selectedMember.phone_number}</p>
              </div>
              <button onClick={() => setSelectedMember(null)} className="text-slate-400 hover:text-slate-900 font-bold text-lg">✕</button>
            </div>

            <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
              <h4 className="text-xs font-bold text-slate-500 uppercase">Payment Receipts</h4>
              {payments.filter(p => p.member_id === selectedMember.id).length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No payment receipts uploaded yet.</p>
              ) : (
                payments.filter(p => p.member_id === selectedMember.id).map((p) => (
                  <div key={p.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-slate-900">Month {p.month_number}</span>
                      <p className="text-[11px] text-slate-500">Mode: {p.payment_mode || 'UPI'} • {p.receipt_utr}</p>
                    </div>
                    <span className="font-black text-emerald-600 text-sm">₹{p.amount_paid?.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>

            <button onClick={() => setSelectedMember(null)} className="w-full mt-6 bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}