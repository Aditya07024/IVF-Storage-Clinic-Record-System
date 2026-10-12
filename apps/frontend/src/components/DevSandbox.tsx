import React, { useState, useEffect, useMemo } from 'react';
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
  Search,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Box,
  Shield,
  Mail,
  ThermometerSnowflake,
  Users,
  FileCode,
  FileSpreadsheet,
  X,
  ExternalLink,
  Table as TableIcon,
  Activity,
  Cpu,
  Server,
  Zap,
} from 'lucide-react';
import { apiRequest, isDevelopmentMode, clearApiCache } from '../api/client';

interface TableMeta {
  id: string;
  name: string;
  label: string;
  count: number;
  icon?: string;
  description: string;
}

export const DevSandbox: React.FC = () => {
  const isDev = isDevelopmentMode();

  // Active Sandbox Section: 'dbms' (Database Explorer), 'server' (Server & Storage Status), or 'danger' (Wipe & Reset Tools)
  const [activeSandboxTab, setActiveSandboxTab] = useState<'dbms' | 'server' | 'danger'>('dbms');

  // Live Server & Storage Telemetry State
  const [serverStatus, setServerStatus] = useState<any | null>(null);
  const [loadingServerStatus, setLoadingServerStatus] = useState<boolean>(false);

  // Basic System Stats (Counts & Uploads)
  const [stats, setStats] = useState<any | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation Keywords for Danger Zone
  const [wipeConfirmKey, setWipeConfirmKey] = useState('');
  const [includePhotosInWipe, setIncludePhotosInWipe] = useState(true);
  const [factoryConfirmKey, setFactoryConfirmKey] = useState('');

  // Modal State for Danger Zone Actions
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  // Developer Sandbox Master Password Lock State
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem('dev_sandbox_password') === 'sgrmIVFdev';
  });
  const [devPasswordInput, setDevPasswordInput] = useState('');
  const [showDevPassword, setShowDevPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // =========================================================================
  // DATABASE MANAGEMENT SYSTEM (DBMS) EXPLORER STATES
  // =========================================================================
  const [dbOverview, setDbOverview] = useState<{
    totalRecords: number;
    dbEngine: string;
    tables: TableMeta[];
  } | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Selected Table & Data Grid States
  const [selectedTableId, setSelectedTableId] = useState<string>('patient');
  const [tableSearchFilter, setTableSearchFilter] = useState<string>('');
  const [tableSidebarQuery, setTableSidebarQuery] = useState<string>('');
  const [tableRecords, setTableRecords] = useState<any[]>([]);
  const [tableTotal, setTableTotal] = useState<number>(0);
  const [tablePage, setTablePage] = useState<number>(1);
  const [tableLimit, setTableLimit] = useState<number>(25);
  const [tableTotalPages, setTableTotalPages] = useState<number>(1);
  const [loadingTableData, setLoadingTableData] = useState<boolean>(false);

  // Record Inspector Modal State
  const [inspectingRecord, setInspectingRecord] = useState<any | null>(null);
  const [inspectorViewMode, setInspectorViewMode] = useState<'formatted' | 'raw'>('formatted');
  const [copiedInspectorJson, setCopiedInspectorJson] = useState(false);
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);

  // Initial load when unlocked
  useEffect(() => {
    if (isUnlocked) {
      fetchStats();
      fetchDbOverview();
      fetchServerStatus();
    }
  }, [isUnlocked]);

  // Fetch records whenever selected table, page, or limit changes
  useEffect(() => {
    if (isUnlocked && selectedTableId) {
      fetchTableRecords(selectedTableId, tablePage, tableLimit, tableSearchFilter);
    }
  }, [isUnlocked, selectedTableId, tablePage, tableLimit]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (devPasswordInput === 'sgrmIVFdev') {
      sessionStorage.setItem('dev_sandbox_password', 'sgrmIVFdev');
      window.dispatchEvent(new Event('dev-lock-change'));
      setIsUnlocked(true);
      setPasswordError(null);
      setDevPasswordInput('');
    } else {
      setPasswordError('Incorrect developer password. Access denied.');
    }
  };

  const handleLock = () => {
    sessionStorage.removeItem('dev_sandbox_password');
    window.dispatchEvent(new Event('dev-lock-change'));
    setIsUnlocked(false);
    setStats(null);
    setDbOverview(null);
    setTableRecords([]);
    setServerStatus(null);
  };

  const fetchServerStatus = async () => {
    setLoadingServerStatus(true);
    try {
      const res = await apiRequest('/api/dev/server-status');
      if (res.success) {
        setServerStatus(res);
      }
    } catch (err: any) {
      console.warn('[DevSandbox] Error fetching server status:', err.message);
    } finally {
      setLoadingServerStatus(false);
    }
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
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchDbOverview = async () => {
    setLoadingOverview(true);
    try {
      const res = await apiRequest('/api/dev/db/overview');
      if (res.success) {
        setDbOverview({
          totalRecords: res.totalRecords || 0,
          dbEngine: res.dbEngine || 'PostgreSQL',
          tables: res.tables || [],
        });
      }
    } catch (err: any) {
      console.warn('[DevSandbox] Error fetching database overview:', err.message);
    } finally {
      setLoadingOverview(false);
    }
  };

  const fetchTableRecords = async (tableId: string, page = 1, limit = 25, search = '') => {
    setLoadingTableData(true);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search.trim()) query.set('search', search.trim());

      const res = await apiRequest(`/api/dev/db/table/${tableId}?${query.toString()}`);
      if (res.success) {
        setTableRecords(res.records || []);
        setTableTotal(res.total || 0);
        setTablePage(res.page || 1);
        setTableLimit(res.limit || 25);
        setTableTotalPages(res.totalPages || 1);
      } else {
        showNotification('error', res.error || `Failed to fetch records for table ${tableId}`);
      }
    } catch (err: any) {
      showNotification('error', err.message || `Error loading table ${tableId}`);
    } finally {
      setLoadingTableData(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTablePage(1);
    fetchTableRecords(selectedTableId, 1, tableLimit, tableSearchFilter);
  };

  const handleClearSearch = () => {
    setTableSearchFilter('');
    setTablePage(1);
    fetchTableRecords(selectedTableId, 1, tableLimit, '');
  };

  const handleSelectTable = (tableId: string) => {
    if (selectedTableId === tableId) return;
    setSelectedTableId(tableId);
    setTableSearchFilter('');
    setTablePage(1);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 6000);
  };

  // Helper to export current table data as JSON
  const handleExportJson = () => {
    try {
      const jsonStr = JSON.stringify(tableRecords, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTableId}_records_page_${tablePage}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', `Exported ${tableRecords.length} records from "${selectedTableId}" as JSON.`);
    } catch (err: any) {
      showNotification('error', `Failed to export JSON: ${err.message}`);
    }
  };

  // Helper to export current table data as CSV
  const handleExportCsv = () => {
    try {
      if (!tableRecords || tableRecords.length === 0) {
        showNotification('error', 'No records to export.');
        return;
      }
      const columns = Object.keys(tableRecords[0]);
      const csvRows: string[] = [];

      // Header row
      csvRows.push(columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(','));

      // Data rows
      for (const row of tableRecords) {
        const values = columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return '""';
          if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      }

      const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTableId}_records_page_${tablePage}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', `Exported ${tableRecords.length} records from "${selectedTableId}" as CSV.`);
    } catch (err: any) {
      showNotification('error', `Failed to export CSV: ${err.message}`);
    }
  };

  const handleCopyInspectorJson = () => {
    if (!inspectingRecord) return;
    navigator.clipboard.writeText(JSON.stringify(inspectingRecord, null, 2));
    setCopiedInspectorJson(true);
    setTimeout(() => setCopiedInspectorJson(false), 2000);
  };

  const handleCopyCellValue = (key: string, val: any) => {
    const textToCopy = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
    navigator.clipboard.writeText(textToCopy);
    setCopiedCellKey(key);
    setTimeout(() => setCopiedCellKey(null), 1500);
  };

  // Danger Zone Actions
  const executeWipePhotos = async () => {
    setActionLoading(true);
    try {
      const res = await apiRequest('/api/dev/wipe-photos', { method: 'POST' });
      if (res.success) {
        clearApiCache();
        showNotification('success', res.message || 'All uploaded photos and files wiped from disk.');
        fetchStats();
        fetchDbOverview();
        fetchTableRecords(selectedTableId, tablePage, tableLimit);
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
        fetchDbOverview();
        fetchTableRecords(selectedTableId, 1, tableLimit);
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
        fetchDbOverview();
        fetchTableRecords(selectedTableId, 1, tableLimit);
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
        fetchDbOverview();
        fetchTableRecords('patient', 1, tableLimit);
      } else {
        showNotification('error', res.error || 'Failed to seed sample patient.');
      }
    } catch (err: any) {
      showNotification('error', err.message || 'Error seeding sample patient.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered tables for the left sidebar
  const filteredTables = useMemo(() => {
    if (!dbOverview?.tables) return [];
    if (!tableSidebarQuery.trim()) return dbOverview.tables;
    const q = tableSidebarQuery.toLowerCase().trim();
    return dbOverview.tables.filter(
      (t) => t.name.toLowerCase().includes(q) || t.label.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
    );
  }, [dbOverview?.tables, tableSidebarQuery]);

  // Current active table metadata
  const currentTableMeta = useMemo(() => {
    return dbOverview?.tables?.find((t) => t.id === selectedTableId) || {
      id: selectedTableId,
      name: selectedTableId,
      label: selectedTableId,
      count: tableTotal,
      description: 'Database Table',
    };
  }, [dbOverview?.tables, selectedTableId, tableTotal]);

  // Columns for the current table grid
  const currentTableColumns = useMemo(() => {
    if (!tableRecords || tableRecords.length === 0) return [];
    const keys = new Set<string>();
    // Prioritize key columns first: id, identifiers, names, dates, then others
    const priority = ['id', 'patientId', 'strawId', 'batchId', 'code', 'fullName', 'name', 'status', 'createdAt', 'updatedAt'];
    for (const record of tableRecords) {
      Object.keys(record).forEach((k) => keys.add(k));
    }
    const allKeys = Array.from(keys);
    allKeys.sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
    return allKeys;
  }, [tableRecords]);

  // Render cell helper
  const renderCellContent = (key: string, value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-slate-300 italic text-[11px]">null</span>;
    }
    if (typeof value === 'boolean') {
      return (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
            value ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {String(value)}
        </span>
      );
    }
    if (typeof value === 'object') {
      return (
        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono text-[10px] truncate max-w-[140px] inline-block">
          {Array.isArray(value) ? `Array(${value.length})` : 'Object'}
        </span>
      );
    }
    const str = String(value);

    // Format ISO date strings
    if (str.length >= 19 && str.includes('T') && !isNaN(Date.parse(str))) {
      try {
        const d = new Date(str);
        return (
          <span className="font-mono text-[11px] text-slate-700 whitespace-nowrap" title={str}>
            {d.toLocaleDateString('en-GB')} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        );
      } catch {
        // fallback to standard string
      }
    }

    // Status / Enum badges
    if (key.toLowerCase().includes('status') || ['MII', 'MI', 'GV', 'SELF', 'DONOR_RECIPIENT', 'OCCUPIED', 'FREEZED', 'ACTIVE'].includes(str)) {
      const isGreen = ['ACTIVE', 'FREEZED', 'COMPLETED', 'VERIFIED'].includes(str);
      const isAmber = ['PENDING', 'OCCUPIED', 'SELF'].includes(str);
      const isRose = ['THAWED', 'EXPIRED', 'ARCHIVED', 'FAILED'].includes(str);
      const colorClass = isGreen
        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
        : isAmber
        ? 'bg-amber-100 text-amber-900 border-amber-300'
        : isRose
        ? 'bg-rose-100 text-rose-900 border-rose-300'
        : 'bg-slate-100 text-slate-800 border-slate-300';

      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono ${colorClass}`}>
          {str}
        </span>
      );
    }

    // Passwords
    if (key === 'passwordHash') {
      return <span className="font-mono text-slate-400 text-xs tracking-wider">••••••••</span>;
    }

    // IDs and UUIDs
    if (key.toLowerCase().endsWith('id') || key === 'id') {
      return (
        <span className="font-mono text-[11px] text-slate-600 truncate max-w-[150px] inline-block" title={str}>
          {str}
        </span>
      );
    }

    return (
      <span className="text-xs text-slate-800 truncate max-w-[200px] inline-block" title={str}>
        {str}
      </span>
    );
  };

  // Helper icon for tables
  const getTableIcon = (tableName: string) => {
    const key = tableName.toLowerCase();
    if (key.includes('patient') && !key.includes('note')) return <Users className="w-4 h-4 text-emerald-600" />;
    if (key.includes('batch')) return <Layers className="w-4 h-4 text-indigo-600" />;
    if (key.includes('straw')) return <Sparkles className="w-4 h-4 text-purple-600" />;
    if (key.includes('embryo')) return <Sparkles className="w-4 h-4 text-amber-600" />;
    if (key.includes('thaw')) return <ThermometerSnowflake className="w-4 h-4 text-rose-600" />;
    if (key.includes('can') || key.includes('tank')) return <Database className="w-4 h-4 text-cyan-600" />;
    if (key.includes('user')) return <Shield className="w-4 h-4 text-blue-600" />;
    if (key.includes('audit')) return <FileText className="w-4 h-4 text-slate-600" />;
    if (key.includes('ocr')) return <FileSpreadsheet className="w-4 h-4 text-teal-600" />;
    if (key.includes('email')) return <Mail className="w-4 h-4 text-sky-600" />;
    return <TableIcon className="w-4 h-4 text-slate-500" />;
  };

  // =========================================================================
  // MASTER PASSWORD LOCK SCREEN
  // =========================================================================
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
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* ========================================================================= */}
      {/* TOP HEADER & NAVIGATION TABS */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-2 border-slate-700 text-white rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-lg shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Database Management & Dev Sandbox</h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  UNLOCKED
                </span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                  {stats?.environment || 'DEV'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Direct DBMS table explorer, record inspector, search & JSON/CSV exports, plus safety-controlled system resets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
            {/* Tab Switcher Buttons */}
            <div className="flex items-center bg-slate-800/90 p-1 rounded-2xl border border-slate-700 shadow-inner">
              <button
                type="button"
                onClick={() => setActiveSandboxTab('dbms')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSandboxTab === 'dbms'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Database Explorer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSandboxTab('server');
                  fetchServerStatus();
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSandboxTab === 'server'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Server & Storage</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSandboxTab('danger')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeSandboxTab === 'danger'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Danger Zone</span>
              </button>
            </div>

            <button
              onClick={() => {
                fetchStats();
                fetchDbOverview();
                fetchServerStatus();
                fetchTableRecords(selectedTableId, tablePage, tableLimit, tableSearchFilter);
              }}
              disabled={loadingStats || loadingOverview || loadingTableData || loadingServerStatus}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Refresh all table metrics and records"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loadingStats || loadingOverview || loadingTableData || loadingServerStatus ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleLock}
              className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Lock developer sandbox with master password"
            >
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Lock Sandbox</span>
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
            className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: FULL DATABASE MANAGEMENT SYSTEM (DBMS) EXPLORER */}
      {/* ========================================================================= */}
      {activeSandboxTab === 'dbms' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Top DBMS Quick Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Total DB Records</span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                {loadingOverview ? '...' : (dbOverview?.totalRecords ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Patients</span>
              </div>
              <div className="text-xl font-black text-blue-700 mt-1 font-mono">
                {loadingStats ? '...' : (stats?.counts?.patients ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cycles (Batches)</span>
              </div>
              <div className="text-xl font-black text-indigo-700 mt-1 font-mono">
                {loadingStats ? '...' : (stats?.counts?.batches ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Straws Stored</span>
              </div>
              <div className="text-xl font-black text-purple-700 mt-1 font-mono">
                {loadingStats ? '...' : (stats?.counts?.straws ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <ThermometerSnowflake className="w-3.5 h-3.5 text-rose-600" />
                <span>Thaw History</span>
              </div>
              <div className="text-xl font-black text-rose-700 mt-1 font-mono">
                {loadingStats ? '...' : (stats?.counts?.thawRecords ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                <span>Disk Uploads</span>
              </div>
              <div className="text-xl font-black text-amber-700 mt-1 font-mono">
                {loadingStats ? '...' : (stats?.uploads?.fileCount ?? 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {stats?.uploads?.sizeFormatted || '0 MB'}
              </div>
            </div>
          </div>

          {/* Main Workspace: Left Table Navigation + Right Data Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ------------------------------------------------------------- */}
            {/* LEFT COLUMN: TABLES LIST (TABLE SELECTOR) */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-slate-700" />
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      Database Tables ({dbOverview?.tables?.length ?? 16})
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                    PostgreSQL
                  </span>
                </div>

                {/* Filter tables input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter tables..."
                    value={tableSidebarQuery}
                    onChange={(e) => setTableSidebarQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  {tableSidebarQuery && (
                    <button
                      onClick={() => setTableSidebarQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Table List Scrollable Container */}
              <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
                {filteredTables.map((t) => {
                  const isSelected = selectedTableId === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTable(t.id)}
                      className={`w-full text-left p-3 flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50/80 border-l-4 border-amber-500 text-slate-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-amber-100' : 'bg-slate-100'}`}>
                          {getTableIcon(t.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate leading-tight flex items-center gap-1.5">
                            <span>{t.label}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{t.name}</div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full shrink-0 font-bold ${
                          isSelected
                            ? 'bg-amber-200 text-amber-950'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.count.toLocaleString()}
                      </span>
                    </button>
                  );
                })}

                {filteredTables.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No tables match "{tableSidebarQuery}"
                  </div>
                )}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT COLUMN: DATA GRID / RECORDS EXPLORER */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-9 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col space-y-4 p-4 sm:p-5">
              {/* Header Bar for Active Table */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 shrink-0">
                    {getTableIcon(currentTableMeta.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-slate-900">{currentTableMeta.label}</h2>
                      <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                        model {currentTableMeta.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {currentTableMeta.description} • Total Rows: <strong className="font-mono text-slate-900">{tableTotal.toLocaleString()}</strong>
                    </p>
                  </div>
                </div>

                {/* Right Action Buttons: Export JSON, Export CSV, Refresh */}
                <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                  <button
                    onClick={handleExportJson}
                    disabled={tableRecords.length === 0}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
                    title="Export currently loaded table rows as formatted JSON file"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>JSON</span>
                  </button>

                  <button
                    onClick={handleExportCsv}
                    disabled={tableRecords.length === 0}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
                    title="Export currently loaded table rows as CSV spreadsheet"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                    <span>CSV</span>
                  </button>

                  <button
                    onClick={() => fetchTableRecords(selectedTableId, tablePage, tableLimit, tableSearchFilter)}
                    disabled={loadingTableData}
                    className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-40"
                    title="Refresh current table records"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingTableData ? 'animate-spin' : ''}`} />
                    <span>Reload</span>
                  </button>
                </div>
              </div>

              {/* Search & Records per Page Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={`Search in ${currentTableMeta.label}...`}
                    value={tableSearchFilter}
                    onChange={(e) => setTableSearchFilter(e.target.value)}
                    className="w-full pl-8 pr-16 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  {tableSearchFilter && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="absolute right-12 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    Find
                  </button>
                </form>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-[11px] font-medium text-slate-500">Rows per page:</span>
                  <select
                    value={tableLimit}
                    onChange={(e) => {
                      const newLimit = parseInt(e.target.value, 10);
                      setTableLimit(newLimit);
                      setTablePage(1);
                      fetchTableRecords(selectedTableId, 1, newLimit, tableSearchFilter);
                    }}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {/* Data Table Container with Horizontal & Vertical Scrolling */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[500px]">
                  {loadingTableData ? (
                    <div className="p-12 text-center text-slate-400 space-y-3">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                      <div className="text-xs font-bold text-slate-600">Loading {currentTableMeta.label} records...</div>
                    </div>
                  ) : tableRecords.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 space-y-2">
                      <Database className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="text-sm font-bold text-slate-700">No records found</div>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {tableSearchFilter
                          ? `No rows match the search query "${tableSearchFilter}". Try clearing your filter.`
                          : `The "${currentTableMeta.label}" table currently contains 0 records in the database.`}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 text-[10px] uppercase font-bold tracking-wider sticky top-0 z-10 shadow-2xs">
                          <th className="py-2.5 px-3 bg-slate-100 w-12 text-center">#</th>
                          <th className="py-2.5 px-3 bg-slate-100 w-16 text-center">Inspect</th>
                          {currentTableColumns.map((col) => (
                            <th key={col} className="py-2.5 px-3 bg-slate-100 font-mono whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tableRecords.map((row, idx) => {
                          const rowNum = (tablePage - 1) * tableLimit + idx + 1;
                          return (
                            <tr
                              key={row.id || idx}
                              onClick={() => setInspectingRecord(row)}
                              className="hover:bg-amber-50/50 transition-colors cursor-pointer group"
                            >
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 text-center">
                                {rowNum}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectingRecord(row);
                                  }}
                                  className="p-1 bg-white hover:bg-amber-100 text-slate-500 hover:text-amber-800 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs"
                                  title="Inspect full raw database record"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </td>
                              {currentTableColumns.map((col) => (
                                <td key={col} className="py-2.5 px-3 whitespace-nowrap">
                                  {renderCellContent(col, row[col])}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Pagination Controls Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-600">
                <div>
                  Showing{' '}
                  <strong className="text-slate-900 font-mono">
                    {tableRecords.length > 0 ? (tablePage - 1) * tableLimit + 1 : 0}
                  </strong>{' '}
                  to{' '}
                  <strong className="text-slate-900 font-mono">
                    {Math.min(tablePage * tableLimit, tableTotal)}
                  </strong>{' '}
                  of <strong className="text-slate-900 font-mono">{tableTotal.toLocaleString()}</strong> records
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const newPage = Math.max(1, tablePage - 1);
                      setTablePage(newPage);
                      fetchTableRecords(selectedTableId, newPage, tableLimit, tableSearchFilter);
                    }}
                    disabled={tablePage <= 1 || loadingTableData}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>

                  <div className="px-3 py-1 font-mono font-bold text-xs bg-slate-100 rounded-xl text-slate-800">
                    Page {tablePage} of {tableTotalPages || 1}
                  </div>

                  <button
                    onClick={() => {
                      const newPage = Math.min(tableTotalPages, tablePage + 1);
                      setTablePage(newPage);
                      fetchTableRecords(selectedTableId, newPage, tableLimit, tableSearchFilter);
                    }}
                    disabled={tablePage >= tableTotalPages || loadingTableData}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SERVER HEALTH, STORAGE USAGE & POSTGRESQL METRICS */}
      {/* ========================================================================= */}
      {activeSandboxTab === 'server' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Quick Status Header */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900">Live Server Telemetry & Storage</h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Host: <strong className="text-slate-800 font-mono">{serverStatus?.host?.hostname || 'localhost'}</strong> ({serverStatus?.host?.platform} / {serverStatus?.host?.arch}) • Node.js <strong className="font-mono">{serverStatus?.process?.nodeVersion || 'v20'}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-[11px] font-mono text-slate-400">
                {serverStatus?.timestamp ? new Date(serverStatus.timestamp).toLocaleTimeString() : 'Ready'}
              </span>
              <button
                type="button"
                onClick={fetchServerStatus}
                disabled={loadingServerStatus}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingServerStatus ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>

          {/* 4 Hero Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Disk Storage Usage */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-amber-600" />
                  <span>Host Disk Storage</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {serverStatus?.storage?.disk?.diskPercentUsed ?? 0}%
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {serverStatus?.storage?.disk?.usedDiskFormatted || '0 GB'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    / {serverStatus?.storage?.disk?.totalDiskFormatted || '0 GB'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (serverStatus?.storage?.disk?.diskPercentUsed || 0) > 90
                        ? 'bg-rose-500'
                        : (serverStatus?.storage?.disk?.diskPercentUsed || 0) > 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, serverStatus?.storage?.disk?.diskPercentUsed || 0)}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between font-mono">
                <span>Free Available:</span>
                <strong className="text-emerald-700 font-bold">{serverStatus?.storage?.disk?.freeDiskFormatted || '0 GB'}</strong>
              </div>
            </div>

            {/* Card 2: System Memory (RAM) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span>System Memory (RAM)</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {serverStatus?.memory?.systemMemUsagePercent ?? 0}%
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {serverStatus?.memory?.systemUsedMemFormatted || '0 GB'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    / {serverStatus?.memory?.systemTotalMemFormatted || '0 GB'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (serverStatus?.memory?.systemMemUsagePercent || 0) > 90
                        ? 'bg-rose-500'
                        : (serverStatus?.memory?.systemMemUsagePercent || 0) > 75
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, serverStatus?.memory?.systemMemUsagePercent || 0)}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between font-mono">
                <span>Process Heap (V8):</span>
                <strong className="text-blue-700 font-bold">{serverStatus?.memory?.processHeapUsedFormatted || '0 MB'}</strong>
              </div>
            </div>

            {/* Card 3: PostgreSQL Database Storage */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>PostgreSQL Storage</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {serverStatus?.database?.latencyMs ?? 0}ms
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {serverStatus?.database?.dbSizeFormatted || '0 MB'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    PostgreSQL
                  </span>
                </div>

                <div className="text-xs text-slate-500">
                  Active Connections: <strong className="font-mono text-slate-800">{serverStatus?.database?.activeConnections || 1}</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between font-mono">
                <span>Connection Status:</span>
                <strong className="text-emerald-700 font-bold">{serverStatus?.database?.status || 'CONNECTED'}</strong>
              </div>
            </div>

            {/* Card 4: CPU & System Uptime */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-purple-600" />
                  <span>Host & Uptime</span>
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  {serverStatus?.host?.cpuCores || 1} Cores
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs text-slate-500">System Uptime</div>
                <div className="text-xl font-black text-slate-900 font-mono truncate">
                  {serverStatus?.host?.systemUptimeFormatted || '0s'}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between font-mono">
                <span>Process Uptime:</span>
                <strong className="text-purple-700 font-bold">{serverStatus?.process?.processUptimeFormatted || '0s'}</strong>
              </div>
            </div>
          </div>

          {/* Deep Breakdown Grids: Storage & Memory details on Left, Postgres & Host on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT COLUMN: DISK & MEMORY BREAKDOWN */}
            <div className="space-y-6">
              {/* Uploads Directory Storage */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Uploads & Document Storage</h3>
                      <p className="text-xs text-slate-500">Local physical directory for photos, scans, and attachments</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900">
                    {serverStatus?.storage?.uploads?.totalSizeFormatted || '0 MB'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Stored Files</span>
                    <span className="text-base font-black text-slate-900 font-mono mt-0.5 block">
                      {serverStatus?.storage?.uploads?.fileCount || 0} files
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Directory Size</span>
                    <span className="text-base font-black text-amber-700 font-mono mt-0.5 block">
                      {serverStatus?.storage?.uploads?.totalSizeFormatted || '0 MB'}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 break-all">
                  <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Filesystem Path:</span>
                  {serverStatus?.storage?.uploads?.directory || './uploads'}
                </div>
              </div>

              {/* Node.js Process V8 Memory Detailed Breakdown */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Node.js Process Memory (V8 Engine)</h3>
                      <p className="text-xs text-slate-500">Live RAM allocated to the backend application runtime</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-blue-100 text-blue-900">
                    PID {serverStatus?.process?.pid || 0}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block font-sans">Heap Used</span>
                    <span className="text-sm font-black text-blue-700 mt-0.5 block">
                      {serverStatus?.memory?.processHeapUsedFormatted || '0 MB'}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                      {serverStatus?.memory?.processHeapPercent || 0}% of allocated
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block font-sans">Heap Total</span>
                    <span className="text-sm font-black text-slate-800 mt-0.5 block">
                      {serverStatus?.memory?.processHeapTotalFormatted || '0 MB'}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-sans mt-0.5">V8 Pool Size</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block font-sans">RSS (Physical)</span>
                    <span className="text-sm font-black text-indigo-700 mt-0.5 block">
                      {serverStatus?.memory?.processRssFormatted || '0 MB'}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-sans mt-0.5">Resident Set</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: POSTGRESQL TABLES BREAKDOWN & HOST DETAILS */}
            <div className="space-y-6">
              {/* Largest PostgreSQL Tables by Storage Size */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">PostgreSQL Table Storage Breakdown</h3>
                      <p className="text-xs text-slate-500">Largest tables by physical disk allocation in PostgreSQL</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900">
                    Total: {serverStatus?.database?.dbSizeFormatted || '0 MB'}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {(serverStatus?.database?.largestTables || []).map((t: any, idx: number) => (
                    <div key={t.tableName || idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 font-mono text-[11px] text-slate-400 text-center">{idx + 1}</span>
                        <span className="font-mono font-bold text-slate-800">{t.tableName}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px]">
                        {t.totalSize}
                      </span>
                    </div>
                  ))}

                  {(!serverStatus?.database?.largestTables || serverStatus.database.largestTables.length === 0) && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No table size statistics available.
                    </div>
                  )}
                </div>
              </div>

              {/* Host Machine & Runtime Environment Details */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-200">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Host Environment & Platform Specs</h3>
                      <p className="text-xs text-slate-500">Hardware processor, kernel, and timezone details</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-purple-100 text-purple-900 uppercase">
                    {serverStatus?.process?.environment || 'DEV'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">CPU Architecture</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block truncate">
                      {serverStatus?.host?.cpuModel || 'CPU'} ({serverStatus?.host?.arch})
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">OS Platform</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block truncate">
                      {serverStatus?.host?.type} ({serverStatus?.host?.release})
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Server Port</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                      :{serverStatus?.process?.port || 4000}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Server Timezone</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block truncate">
                      {serverStatus?.process?.timeZone || 'UTC'}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono flex justify-between items-center">
                  <span>Server Local Timestamp:</span>
                  <strong className="text-slate-800">{serverStatus?.process?.serverTime ? new Date(serverStatus.process.serverTime).toLocaleString() : 'N/A'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DANGER ZONE & SYSTEM RESET TOOLS */}
      {/* ========================================================================= */}
      {activeSandboxTab === 'danger' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-900 text-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>
              <strong>Warning:</strong> Destructive operations below permanently wipe database records, uploaded photos, or restore factory configurations. These actions cannot be undone.
            </span>
          </div>

          {/* Quick 1-Click Verification Test Generator */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Seed Sample Test Patient</h2>
                <p className="text-xs text-slate-500">
                  Instantly creates a fully populated test patient with 2 cycles, 3 straws, and embryo grades for rapid UI verification.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSeedSamplePatient}
              disabled={actionLoading}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Generate Sample Patient</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wipe Uploaded Photos & Files on Disk */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center">
                  <ImageOff className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Wipe Uploaded Photos & Files</h2>
                  <p className="text-xs text-slate-500">
                    Purges disk storage directory (<code className="text-purple-700 font-mono">./uploads</code>) and resets all patient image references.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-2xl border border-purple-200 text-xs text-purple-950 font-mono">
                Current files on disk: <strong>{stats?.uploads?.fileCount ?? 0}</strong> ({stats?.uploads?.sizeFormatted ?? '0 MB'})
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfirmModal({
                    title: 'Wipe All Photos & Uploaded Files?',
                    description:
                      'This will permanently delete all image files and PDFs stored on the server disk, and clear photo URLs on all patient records in the database.',
                    action: executeWipePhotos,
                  })
                }
                disabled={actionLoading}
                className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Wipe Photos from Disk</span>
              </button>
            </div>

            {/* Wipe Patient & Clinical Data from Database */}
            <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-900 flex items-center justify-center">
                  <Database className="w-5 h-5 text-rose-700" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Wipe All Database Patient Data</h2>
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

          {/* Complete Factory Reset Card */}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD DETAIL INSPECTOR MODAL (FLYOUT DIALOG) */}
      {/* ========================================================================= */}
      {inspectingRecord && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          style={{ zIndex: 10000 }}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/30 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">Record Inspector</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                      {currentTableMeta.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-md">
                    ID: {inspectingRecord.id || inspectingRecord.patientId || inspectingRecord.code || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle: Formatted vs Raw JSON */}
                <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs">
                  <button
                    onClick={() => setInspectorViewMode('formatted')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      inspectorViewMode === 'formatted'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Table
                  </button>
                  <button
                    onClick={() => setInspectorViewMode('raw')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      inspectorViewMode === 'raw'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    JSON
                  </button>
                </div>

                <button
                  onClick={handleCopyInspectorJson}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Copy complete record JSON to clipboard"
                >
                  {copiedInspectorJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedInspectorJson ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => setInspectingRecord(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
              {inspectorViewMode === 'formatted' ? (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {Object.entries(inspectingRecord).map(([key, val]) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 hover:bg-slate-50 transition-colors">
                      <div className="font-mono text-xs font-bold text-slate-700 sm:w-1/3 truncate" title={key}>
                        {key}
                      </div>
                      <div className="sm:w-2/3 flex items-center justify-between gap-3">
                        <div className="font-mono text-xs text-slate-900 break-all select-all">
                          {typeof val === 'object' && val !== null ? (
                            <pre className="bg-slate-100 p-2 rounded-xl text-[11px] overflow-x-auto max-h-40 font-mono">
                              {JSON.stringify(val, null, 2)}
                            </pre>
                          ) : val === null ? (
                            <span className="text-slate-400 italic">null</span>
                          ) : (
                            String(val)
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyCellValue(key, val)}
                          className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-all cursor-pointer shrink-0"
                          title="Copy field value"
                        >
                          {copiedCellKey === key ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative">
                  <pre className="bg-slate-950 text-emerald-400 p-4 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                    {JSON.stringify(inspectingRecord, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setInspectingRecord(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONFIRMATION MODAL FOR DANGER ACTIONS */}
      {/* ========================================================================= */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 10000 }}
        >
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
