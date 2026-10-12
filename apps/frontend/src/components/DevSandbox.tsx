import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Database,
  Trash2,
  AlertTriangle,
  RefreshCw,
  ImageOff,
  UserPlus,
  Layers,
  Sparkles,
  ShieldAlert,
  HardDrive,
  CheckCircle2,
  FileText,
  Clock,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { apiRequest, isDevelopmentMode, clearApiCache } from '../api/client';

export const DevSandbox: React.FC = () => {
  const isDev = isDevelopmentMode();

  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Single Straw Deletion Input
  const [strawInputId, setStrawInputId] = useState('');

  // Single Cycle Deletion Input
  const [batchInputId, setBatchInputId] = useState('');

  // Confirmation Keywords
  const [wipeConfirmKey, setWipeConfirmKey] = useState('');
  const [includePhotosInWipe, setIncludePhotosInWipe] = useState(true);
  const [factoryConfirmKey, setFactoryConfirmKey] = useState('');

  // Modal State
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  // Developer Sandbox Master Password Lock State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('dev_sandbox_password') === 'sgrmIVFdev';
  });
  const [devPasswordInput, setDevPasswordInput] = useState('');
  const [showDevPassword, setShowDevPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (isUnlocked) {
      fetchStats();
    }
  }, [isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (devPasswordInput === 'sgrmIVFdev') {
      sessionStorage.setItem('dev_sandbox_password', 'sgrmIVFdev');
      setIsUnlocked(true);
      setPasswordError(null);
      setDevPasswordInput('');
    } else {
      setPasswordError('Incorrect developer password. Access denied.');
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem('dev_sandbox_password');
    setIsUnlocked(false);
    setStats(null);
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await apiRequest('/api/dev/stats');
      if (res.success) {
        setStats(res);
      } else if (res.error) {
        setFeedback({ type: 'error', message: res.error });
      }
    } catch (err: any) {
      console.warn('[DevSandbox] Error fetching stats:', err.message);
      setFeedback({ type: 'error', message: err.message || 'Developer stats are disabled on this backend.' });
    } finally {
      setLoadingStats(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 6000);
  };

  // 1. Delete Individual Straw
  const handleDeleteStraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = strawInputId.trim();
    if (!id) return;

    setActionLoading(true);
    try {
      const res = await apiRequest(`/api/dev/straws/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.success) {
        clearApiCache();
        showNotification('success', `Straw "${id}" deleted successfully from database.`);
        setStrawInputId('');
        fetchStats();
      } else {
        showNotification('error', res.error || 'Failed to delete straw.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error executing straw deletion.');
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Delete Individual Cycle (Batch)
  const handleDeleteBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = batchInputId.trim();
    if (!id) return;

    setActionLoading(true);
    try {
      const res = await apiRequest(`/api/dev/batches/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.success) {
        clearApiCache();
        showNotification('success', `Cycle batch "${id}" deleted successfully from database.`);
        setBatchInputId('');
        fetchStats();
      } else {
        showNotification('error', res.error || 'Failed to delete cycle batch.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error executing cycle deletion.');
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Wipe Photos & Files on Disk
  const executeWipePhotos = async () => {
    setActionLoading(true);
    try {
      const res = await apiRequest('/api/dev/wipe-photos', { method: 'POST' });
      if (res.success) {
        clearApiCache();
        showNotification('success', res.message || 'All uploaded photos and files wiped from disk.');
        fetchStats();
      } else {
        showNotification('error', res.error || 'Failed to wipe photos.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error executing photo wipe.');
    } finally {
      setActionLoading(false);
      setConfirmModal(null);
    }
  };

  // 4. Wipe Clinical Database Data
  const executeWipeDatabase = async () => {
    if (wipeConfirmKey.trim() !== 'WIPE-DEV-DATA') {
      showNotification('error', 'Please type the exact confirmation key "WIPE-DEV-DATA".');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiRequest('/api/dev/wipe-database', {
        method: 'POST',
        body: JSON.stringify({
          confirmKey: 'WIPE-DEV-DATA',
          includePhotos: includePhotosInWipe,
        }),
      });
      if (res.success) {
        clearApiCache();
        showNotification('success', res.message || 'All clinical records wiped from database.');
        setWipeConfirmKey('');
        fetchStats();
      } else {
        showNotification('error', res.error || 'Failed to wipe database.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error executing database wipe.');
    } finally {
      setActionLoading(false);
      setConfirmModal(null);
    }
  };

  // 5. Complete Factory Reset
  const executeFactoryReset = async () => {
    if (factoryConfirmKey.trim() !== 'FACTORY-RESET-DEV') {
      showNotification('error', 'Please type the exact confirmation key "FACTORY-RESET-DEV".');
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiRequest('/api/dev/factory-reset', {
        method: 'POST',
        body: JSON.stringify({
          confirmKey: 'FACTORY-RESET-DEV',
        }),
      });
      if (res.success) {
        clearApiCache();
        showNotification('success', res.message || 'Factory reset completed.');
        setFactoryConfirmKey('');
        fetchStats();
      } else {
        showNotification('error', res.error || 'Failed to execute factory reset.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error executing factory reset.');
    } finally {
      setActionLoading(false);
      setConfirmModal(null);
    }
  };

  // 6. Seed Sample Test Patient
  const handleSeedSamplePatient = async () => {
    setActionLoading(true);
    try {
      const res = await apiRequest('/api/dev/seed-sample-patient', { method: 'POST' });
      if (res.success) {
        clearApiCache();
        showNotification(
          'success',
          `Sample patient "${res.fullName}" (${res.patientId}) created in ${res.location} with 2 cycles & 3 straws!`
        );
        fetchStats();
      } else {
        showNotification('error', res.error || 'Failed to seed sample patient.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error seeding sample patient.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div className="p-4 sm:p-8 max-w-md mx-auto my-12 animate-in fade-in duration-200">
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 bg-amber-100 text-amber-900 border-2 border-amber-300 rounded-3xl mx-auto flex items-center justify-center shadow-sm">
            <Lock className="w-8 h-8 text-amber-700" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-950 border border-amber-300 uppercase mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              <span>Password Required</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Developer Sandbox Gate</h2>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Enter the developer password to unlock database management, wiping options, and deletion tools in this environment.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Developer Password
              </label>
              <div className="relative">
                <input
                  type={showDevPassword ? 'text' : 'password'}
                  placeholder="Enter password..."
                  value={devPasswordInput}
                  onChange={(e) => {
                    setDevPasswordInput(e.target.value);
                    setPasswordError(null);
                  }}
                  autoFocus
                  className="w-full pl-3.5 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowDevPassword(!showDevPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  {showDevPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-rose-600 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!devPasswordInput.trim()}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Unlock Developer Sandbox</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* ========================================================================= */}
      {/* TOP HEADER & STRICT PRODUCTION SAFEGUARD WARNING BANNER */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border-2 border-amber-400/40 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Developer Sandbox</h1>
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase">
                  DEV ONLY
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Database maintenance, targeted entity deletions, disk cleanup, and test data generators.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStats}
              disabled={loadingStats}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingStats ? 'animate-spin' : ''}`} />
              <span>Refresh Stats</span>
            </button>
            <button
              onClick={handleLock}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Lock sandbox with master password"
            >
              <Lock className="w-3.5 h-3.5 text-rose-600" />
              <span>Lock Sandbox</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Feedback Notification */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center gap-3 animate-in fade-in duration-200 shadow-md ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REAL-TIME SYSTEM METRICS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Patients</div>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">
            {loadingStats ? '...' : stats?.counts?.patients ?? 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Cycles</div>
          <div className="text-xl font-extrabold text-indigo-700 mt-1 font-mono">
            {loadingStats ? '...' : stats?.counts?.batches ?? 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Straws</div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
            {loadingStats ? '...' : stats?.counts?.straws ?? 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Embryos</div>
          <div className="text-xl font-extrabold text-teal-700 mt-1 font-mono">
            {loadingStats ? '...' : stats?.counts?.embryos ?? 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Thaws</div>
          <div className="text-xl font-extrabold text-rose-700 mt-1 font-mono">
            {loadingStats ? '...' : stats?.counts?.thawRecords ?? 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Disk Photos</div>
          <div className="text-xl font-extrabold text-purple-700 mt-1 font-mono">
            {loadingStats ? '...' : stats?.uploads?.fileCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {stats?.uploads?.sizeFormatted ?? '0 MB'}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1-CLICK TEST PATIENT GENERATOR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Instant Test Patient Generator</h2>
              <p className="text-xs text-slate-600">
                Instantly populate a realistic sample patient with 1 Embryo Freezing cycle (2 straws) and 1 Egg Freezing cycle (1 straw) into available VisoTubes.
              </p>
            </div>
          </div>
          <button
            onClick={handleSeedSamplePatient}
            disabled={actionLoading}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Generate Sample Patient</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* HIGH-IMPACT WIPE CONTROLS (PHOTOS WIPE & DATABASE WIPE) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wipe Uploaded Photos & Files on Disk */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center">
              <ImageOff className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Wipe Uploaded Photos & Documents</h2>
              <p className="text-xs text-slate-500">
                Permanently deletes all files inside <code>uploads/</code> and clears patient photo URL references.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-800">Current Disk Usage:</div>
            <div className="font-mono text-purple-700 font-bold">
              {stats?.uploads?.fileCount ?? 0} files ({stats?.uploads?.sizeFormatted ?? '0 MB'})
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              Path: {stats?.uploads?.directory ?? './uploads'}
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setConfirmModal({
                title: 'Wipe All Photos & Scanned Documents?',
                description: `This will permanently delete ${stats?.uploads?.fileCount ?? 0} files from disk (${stats?.uploads?.sizeFormatted ?? '0 MB'}) and reset patient photo URLs in the database.`,
                action: executeWipePhotos,
              })
            }
            disabled={actionLoading || (stats?.uploads?.fileCount ?? 0) === 0}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            <ImageOff className="w-4 h-4" />
            <span>Wipe Photos on Disk</span>
          </button>
        </div>

        {/* Wipe Clinical Database (Preserving Tanks & Staff) */}
        <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center">
              <Database className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Wipe All Database Patient Data</h2>
              <p className="text-xs text-slate-500">
                Wipes all Patients, Cycles, Straws, Embryos, Thaws, and OCR records. Preserves Tanks and Staff accounts.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={includePhotosInWipe}
                onChange={(e) => setIncludePhotosInWipe(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
              />
              <span>Also delete photos and scanned files on disk</span>
            </label>

            <div>
              <label className="block text-[11px] font-bold text-rose-800 uppercase mb-1">
                Type <span className="font-mono bg-rose-100 px-1 py-0.5 rounded text-rose-950 font-extrabold">WIPE-DEV-DATA</span> to confirm:
              </label>
              <input
                type="text"
                placeholder="WIPE-DEV-DATA"
                value={wipeConfirmKey}
                onChange={(e) => setWipeConfirmKey(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-rose-50/50 border border-rose-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setConfirmModal({
                  title: 'Wipe All Clinical Data in Database?',
                  description:
                    'This action will permanently delete ALL patient records, cycles, straws, embryos, thaw history, and OCR data from the database. Tank infrastructure and Staff login accounts will remain intact.',
                  action: executeWipeDatabase,
                })
              }
              disabled={actionLoading || wipeConfirmKey.trim() !== 'WIPE-DEV-DATA'}
              className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-30 cursor-pointer flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Wipe Clinical Database</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FACTORY RESET CARD */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600/30 border border-rose-500 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold">Complete System Factory Reset</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Total purge of all clinical records, audit logs, and photos. Automatically re-seeds clean default Tanks (CAN-01 to CAN-14) and Default Admin account.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800 items-end">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-rose-400 uppercase mb-1">
              Type <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-white font-extrabold">FACTORY-RESET-DEV</span> to confirm:
            </label>
            <input
              type="text"
              placeholder="FACTORY-RESET-DEV"
              value={factoryConfirmKey}
              onChange={(e) => setFactoryConfirmKey(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setConfirmModal({
                title: 'Perform Complete Factory Reset?',
                description:
                  'This will perform a total purge of all data and restore the system to factory state. Default admin credentials and empty tank hierarchy will be re-seeded.',
                action: executeFactoryReset,
              })
            }
            disabled={actionLoading || factoryConfirmKey.trim() !== 'FACTORY-RESET-DEV'}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-20 cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Factory Reset</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{confirmModal.title}</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.action}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Execute</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
