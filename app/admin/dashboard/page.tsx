'use client';

import React, { useState } from 'react';

// Total Chit Schedule sum across all 12 months = ₹90,450
const TOTAL_CHIT_DUE_SUM = 90450;

// Handwritten Ledger Split-Up Reference Data
const HANDWRITTEN_LEDGER = [
  { month: 1, due: 6500 },
  { month: 2, due: 6600 },
  { month: 3, due: 6750 },
  { month: 4, due: 7000 },
  { month: 5, due: 7100 },
  { month: 6, due: 7350 },
  { month: 7, due: 7600 },
  { month: 8, due: 7800 },
  { month: 9, due: 8100 },
  { month: 10, due: 8350 },
  { month: 11, due: 8600 },
  { month: 12, due: 8750 },
];

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'batches' | 'participants' | 'receipts'>('batches');
  const [selectedBatch, setSelectedBatch] = useState(1);

  // Sample participants state
  const [participants] = useState([
    {
      id: '1',
      name: 'hari krishna K',
      phone: '+91 6369081109',
      total_paid: 200,
      months_cleared: 1,
    }
  ]);

  const handleMarkAsPaid = (member: any) => {
    alert(`Marked cash payment as paid for ${member.name}`);
  };

  const handleSendWhatsApp = (member: any) => {
    const message = encodeURIComponent(
      `Hello ${member.name}, here is your Chit Portal login link: https://yourdomain.com/member-portal`
    );
    window.open(`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('batches')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'batches'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            📦 Batches & Members (5)
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'participants'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            👥 All Participants (1)
          </button>
          <button
            onClick={() => setActiveTab('receipts')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === 'receipts'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            📑 Member Receipts (1)
          </button>
        </div>

        {/* Batch Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((batchNum) => {
            const isSelected = selectedBatch === batchNum;
            const startDate = batchNum === 1 ? '2026-09-01' : `2025-0${batchNum}-10`;
            return (
              <div
                key={batchNum}
                onClick={() => setSelectedBatch(batchNum)}
                className={`p-4 rounded-2xl cursor-pointer border transition-all duration-200 relative overflow-hidden ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-[1.02]'
                    : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    1 Lakh Chit
                  </span>
                  <span
                    className={`text-[10px] font-semibold ${
                      isSelected ? 'text-emerald-400' : 'text-emerald-600'
                    }`}
                  >
                    {startDate}
                  </span>
                </div>
                <h3 className="text-base font-extrabold">Batch {batchNum}</h3>
                <p className={`text-xs mt-1 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                  {batchNum === 1 ? '1 Enrolled' : '0 Enrolled'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Main Participants Table Section */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xl p-6 transition-all">
          
          {/* Table Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-5 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Batch {selectedBatch} — Participants
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Total Pool: <span className="text-emerald-600 font-bold">₹1,00,000</span> | 12-Month Ledger
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-50/80 p-2 rounded-xl border border-slate-200/80 shadow-inner">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Batch Start Date</span>
                <input
                  type="date"
                  defaultValue="2026-09-01"
                  className="text-xs font-semibold bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <div className="flex flex-col w-20">
                <span className="text-[10px] uppercase font-bold text-slate-400 px-1">Due Day</span>
                <input
                  type="number"
                  defaultValue="10"
                  className="text-xs font-semibold bg-white px-2 py-1 rounded-lg border border-slate-200 text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                />
              </div>
              <button className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 self-end">
                Set Date
              </button>
            </div>
          </div>

          {/* Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50/60 rounded-lg">
                  <th className="py-3 px-4">Participant</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Total Paid</th>
                  <th className="py-3 px-4">Remaining Due (Yet To Pay)</th>
                  <th className="py-3 px-4">Months Cleared</th>
                  <th className="py-3 px-4 text-center">In-Hand Cash</th>
                  <th className="py-3 px-4 text-center">WhatsApp Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {participants.map((member) => {
                  const totalPaid = Number(member.total_paid) || 0;
                  const monthsCleared = member.months_cleared || 0;
                  const remainingDue = Math.max(0, TOTAL_CHIT_DUE_SUM - totalPaid);

                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/80 transition-colors duration-150 group"
                    >
                      {/* Name */}
                      <td className="py-4 px-4 font-bold text-indigo-900 flex items-center gap-1.5 cursor-pointer group-hover:text-indigo-600">
                        <span>{member.name}</span>
                        <span className="text-xs opacity-60">🔍</span>
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-4 text-slate-600 font-mono">
                        {member.phone}
                      </td>

                      {/* Total Paid */}
                      <td className="py-4 px-4 font-extrabold text-emerald-600 text-sm">
                        ₹{totalPaid.toLocaleString()}
                      </td>

                      {/* Remaining Due / Yet to Pay Badge */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-full text-xs border ${
                            remainingDue > 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          }`}
                        >
                          {remainingDue > 0 ? `⚠️ ₹${remainingDue.toLocaleString()}` : '✅ Fully Paid'}
                        </span>
                      </td>

                      {/* Months Cleared */}
                      <td className="py-4 px-4">
                        <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-md text-[11px] border border-slate-200/60 shadow-sm">
                          {monthsCleared} / 12 Months
                        </span>
                      </td>

                      {/* Mark as Paid */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleMarkAsPaid(member)}
                          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                          💵 Mark as Paid
                        </button>
                      </td>

                      {/* WhatsApp Link */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleSendWhatsApp(member)}
                          className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
                        >
                          📲 Send Link
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Handwritten Ledger Split-Up Reference Footer */}
          <div className="mt-8 pt-5 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              📋 Handwritten Ledger Split-Up Reference
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {HANDWRITTEN_LEDGER.map((item) => (
                <div
                  key={item.month}
                  className="bg-slate-50/80 border border-slate-200/60 p-2.5 rounded-xl text-xs"
                >
                  <p className="font-bold text-slate-800">Month {item.month}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Due: <strong className="text-slate-900">₹{item.due.toLocaleString()}</strong>
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}