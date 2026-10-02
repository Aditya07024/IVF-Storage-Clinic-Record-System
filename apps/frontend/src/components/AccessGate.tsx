import React, { useState, useEffect } from 'react';
import brandLogo from '../assets/image.png';
import { KeyRound, ShieldAlert, Clock, Lock } from 'lucide-react';
import { apiRequest } from '../api/client';

interface AccessGateProps {
  children: React.ReactNode;
}

const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 7 Days in Milliseconds

export const AccessGate: React.FC<AccessGateProps> = ({ children }) => {
  const [accessKey, setAccessKey] = useState('');
  const [isGranted, setIsGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Real-time Lockout Clock State
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [initialLockoutSeconds, setInitialLockoutSeconds] = useState<number>(900);

  const processError = (err: any) => {
    const msg = err?.message || 'Invalid application access key.';
    setError(msg);

    const isLockout =
      msg.includes('Too many failed login attempts') ||
      msg.includes('Access locked') ||
      msg.includes('locked for') ||
      !!err?.retryAfterSeconds;

    if (isLockout) {
      let seconds = err?.retryAfterSeconds;
      if (!seconds) {
        const match = msg.match(/(\d+)\s*(?:minutes|minute|mins|min)/i);
        seconds = match && match[1] ? parseInt(match[1], 10) * 60 : 900;
      }
      setInitialLockoutSeconds(seconds);
      setRemainingSeconds(seconds);
      setLockoutEndTime(Date.now() + seconds * 1000);
    }
  };

  // Real-time ticking interval effect (updates every 1000ms)
  useEffect(() => {
    if (!lockoutEndTime) return;

    const tick = () => {
      const now = Date.now();
      const left = Math.max(0, Math.ceil((lockoutEndTime - now) / 1000));
      setRemainingSeconds(left);

      if (left <= 0) {
        setLockoutEndTime(null);
        setError(null);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutEndTime]);

  const formatClock = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isLockedOut = Boolean(lockoutEndTime && remainingSeconds > 0);

  useEffect(() => {
    const stored = localStorage.getItem('app_access_key');
    const storedTime = localStorage.getItem('app_access_key_timestamp');

    if (stored && storedTime) {
      const elapsed = Date.now() - parseInt(storedTime, 10);
      if (elapsed < WEEK_IN_MS) {
        setAccessKey(stored);
        setIsGranted(true);
      } else {
        // Expire key after 7 days automatically
        localStorage.removeItem('app_access_key');
        localStorage.removeItem('app_access_key_timestamp');
        setIsGranted(false);
      }
    } else if (stored && !storedTime) {
      // Legacy fallback: timestamp it now
      localStorage.setItem('app_access_key_timestamp', Date.now().toString());
      setAccessKey(stored);
      setIsGranted(true);
    }
  }, []);

  const grantAccess = (key: string) => {
    localStorage.setItem('app_access_key', key);
    localStorage.setItem('app_access_key_timestamp', Date.now().toString());
    setAccessKey(key);
    setIsGranted(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) return;

    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest('/api/auth/access-key', {
        method: 'POST',
        body: JSON.stringify({ accessKey: accessKey.trim() }),
      });

      if (res.success) {
        grantAccess(accessKey.trim());
      }
    } catch (err: any) {
      processError(err);
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
          <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm overflow-hidden p-1">
            <img src={brandLogo} alt="IVF Clinic Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security Access Gate</h1>
          <p className="text-sm text-slate-500 mt-2">
            Layer 1 Authorized Clinic System Security Verification. Enter your clinic access key to proceed.
          </p>
        </div>

        {/* 1-Click Quick Access Key Button (Development Mode Only - Hidden when NODE_ENV=production) */}
        {import.meta.env.DEV &&
          !import.meta.env.VITE_IS_PRODUCTION_ENV &&
          import.meta.env.VITE_NODE_ENV !== 'production' &&
          !import.meta.env.PROD && (
            <div className="mb-5 p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-2">
            <button
              type="button"
              onClick={async () => {
                if (isLockedOut) return;
                const demoKey = import.meta.env.VITE_APP_ACCESS_KEY || 'ivf@srgm';
                setAccessKey(demoKey);
                setError(null);
                setLoading(true);
                try {
                  const res = await apiRequest('/api/auth/access-key', {
                    method: 'POST',
                    body: JSON.stringify({ accessKey: demoKey }),
                  });
                  if (res.success) {
                    grantAccess(demoKey);
                  }
                } catch (err: any) {
                  processError(err);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading || isLockedOut}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-emerald-200" />
              <span>Unlock Website with Demo Access Key ({import.meta.env.VITE_APP_ACCESS_KEY || 'ivf@srgm'})</span>
            </button>
          </div>
        )}

        {/* Real-time Lockout Clock Card OR standard error display */}
        {error && isLockedOut ? (
          <div className="mb-6 p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-3 text-rose-900 shadow-md">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-200/80 rounded-xl text-rose-700 shrink-0 mt-0.5">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-extrabold text-xs uppercase tracking-wider text-rose-800">
                    Security Lockout Active
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-200 text-rose-800 border border-rose-300">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                    Live Clock
                  </span>
                </div>
                <p className="text-xs text-rose-700 font-medium leading-relaxed">{error}</p>
              </div>
            </div>

            {/* Real-time Digital Countdown Clock Box */}
            <div className="bg-gradient-to-r from-rose-900 via-slate-900 to-rose-950 p-4 rounded-xl text-white shadow-inner flex flex-col items-center justify-center gap-2 border border-rose-800">
              <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold uppercase tracking-widest">
                <Clock className="w-4 h-4 text-rose-400 animate-spin" style={{ animationDuration: '4s' }} />
                <span>Access Lock Resets In</span>
              </div>
              <div className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-white drop-shadow-md flex items-center justify-center gap-1">
                <span>{formatClock(remainingSeconds)}</span>
              </div>
              <p className="text-[11px] text-rose-300/80 text-center font-medium">
                System will automatically unlock when timer hits 00:00
              </p>

              {/* Dynamic Real-time Progress Bar */}
              <div className="w-full bg-rose-950/80 h-2 rounded-full overflow-hidden border border-rose-800/60 mt-1">
                <div
                  className="bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 h-full transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, (remainingSeconds / initialLockoutSeconds) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
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
                disabled={isLockedOut}
                placeholder="Enter access key"
                required
                autoComplete="current-password"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isLockedOut}
            className={`w-full font-semibold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isLockedOut
                ? 'bg-slate-700 text-rose-200 border border-rose-900/50 shadow-none'
                : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-emerald-600/20'
            }`}
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isLockedOut ? (
              <>
                <Lock className="w-5 h-5 text-rose-300 animate-pulse" />
                <span>Access Locked ({formatClock(remainingSeconds)})</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Verify Access Key</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-400">
            IVF Clinic Internal System
          </p>
        </div>
      </div>
    </div>
  );
};

