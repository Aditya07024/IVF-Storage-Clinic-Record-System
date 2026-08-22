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

  const handleQuickDemoLogin = async (sId: string, pass: string) => {
    setStaffId(sId);
    setPassword(pass);
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ staffId: sId, password: pass }),
      });

      if (res.success) {
        localStorage.setItem('access_token', res.accessToken);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Quick demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-3xl shadow-xl relative z-10 border border-slate-200 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20 text-emerald-600">
            <UserCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clinic Staff Portal</h2>
          <p className="text-sm text-slate-500 mt-1">
            Layer 2 Staff Identity Authentication. Enter authorized ID & Password.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm shadow-2xs">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Quick Demo Login Buttons */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider text-center">
            ⚡ Quick 1-Click Demo Login:
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemoLogin('ADMIN001', 'AdminPassword123!')}
              disabled={loading}
              className="py-2.5 px-3 bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300 font-extrabold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <KeyRound className="w-3.5 h-3.5 text-purple-700" />
              <span>Admin Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickDemoLogin('STAFF001', 'StaffPassword123!')}
              disabled={loading}
              className="py-2.5 px-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 font-extrabold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Staff Dashboard</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleLogin} method="post" action="#" className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
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
            <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
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
                <span>Sign In to Account</span>
              </>
            )}
          </button>
        </form>

        {/* Password Manager AutoFill Hint */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium pt-1 border-t border-slate-100">
          <KeyRound className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Supports Apple Password & Google Password AutoFill</span>
        </div>
      </div>
    </div>
  );
};
