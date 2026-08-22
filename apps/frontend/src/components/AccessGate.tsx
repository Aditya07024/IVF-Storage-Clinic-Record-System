import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import { apiRequest } from '../api/client';

interface AccessGateProps {
  children: React.ReactNode;
}

export const AccessGate: React.FC<AccessGateProps> = ({ children }) => {
  const [accessKey, setAccessKey] = useState('');
  const [isGranted, setIsGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('app_access_key');
    if (stored) {
      setAccessKey(stored);
      setIsGranted(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest('/api/auth/access-key', {
        method: 'POST',
        body: JSON.stringify({ accessKey: accessKey.trim() }),
      });

      if (res.success) {
        localStorage.setItem('app_access_key', accessKey.trim());
        setIsGranted(true);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid application access key.');
    } finally {
      setLoading(false);
    }
  };

  if (isGranted) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Light theme green background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl relative z-10 border border-slate-200">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20 text-emerald-600">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security Access Gate</h1>
          <p className="text-sm text-slate-500 mt-2">
            Layer 1 Authorized Clinic System Security Verification. Enter your clinic access key to proceed.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} method="post" action="#" className="space-y-5">
          <div>
            <label htmlFor="accessKey" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Website Access Key
            </label>
            <div className="relative">
              <input
                id="accessKey"
                name="accessKey"
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Enter access key (Default: clinic2026)"
                required
                autoComplete="current-password"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Verify Access Gate</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            IVF Clinic Internal System • Security Key Hash Enforced
          </p>
        </div>
      </div>
    </div>
  );
};
