'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      const next = searchParams.get('next');
      router.push(next && next.startsWith('/') ? next : '/');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 px-4 py-3 rounded-xl text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">
          Admin Email
        </label>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none text-white placeholder-slate-400 backdrop-blur transition"
          placeholder="admin@chitfund.com"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">
          Password
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 bg-white/10 border border-white/15 rounded-xl focus:ring-2 focus:ring-emerald-400 outline-none text-white placeholder-slate-400 backdrop-blur transition"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 transition"
      >
        {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Decorative gradient blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-600/30 blur-3xl" />
      <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-indigo-600/30 blur-3xl" />
      <div className="absolute top-1/3 left-2/3 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/30 mb-4">
              <span className="text-3xl">💰</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Chit Fund Admin
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Authorized access only · Command Center
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          🔒 Sessions are secured with encrypted cookies
        </p>
      </div>
    </div>
  );
}