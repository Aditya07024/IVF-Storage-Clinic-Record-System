import React, { useState } from 'react';
import { UserCheck, ShieldAlert, LogIn, Eye, EyeOff, KeyRound } from 'lucide-react';
import { apiRequest } from '../api/client';

interface LoginFormProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [staffId, setStaffId] = useState('STAFF001');
  const [password, setPassword] = useState('StaffPassword123!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ staffId: staffId.trim(), password }),
      });

      if (res.success) {
        localStorage.setItem('access_token', res.accessToken);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your staff ID and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-3xl shadow-xl relative z-10 border border-slate-200">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20 text-emerald-600">
            <UserCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clinic Staff Portal</h2>
          <p className="text-sm text-slate-500 mt-2">
            Layer 2 Staff Identity Authentication. Enter your authorized ID & Password.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} method="post" action="#" className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Staff ID / Email / Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder="e.g. STAFF001"
              required
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-4 pr-11 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Staff Login</span>
              </>
            )}
          </button>
        </form>

        {/* Password Manager AutoFill Hint */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
          <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
          <span>Supports Apple Password & Google Password AutoFill</span>
        </div>

        <div className="mt-6 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-xs text-slate-600 space-y-1">
          <div className="font-semibold text-emerald-900">Development Demo Accounts:</div>
          <div>Staff ID: <code className="text-emerald-700 font-mono font-bold">STAFF001</code> | Password: <code className="text-emerald-700 font-mono">StaffPassword123!</code></div>
          <div>Admin ID: <code className="text-emerald-700 font-mono font-bold">ADMIN001</code> | Password: <code className="text-emerald-700 font-mono">AdminPassword123!</code></div>
        </div>
      </div>
    </div>
  );
};
