import React, { useEffect, useState } from 'react';
import {
  Layers,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileScan,
  Activity,
  ArrowRight,
  UserPlus,
} from 'lucide-react';
import { apiRequest } from '../api/client';

interface DashboardProps {
  onNavigate: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/api/dashboard');
      if (res.success) {
        setData(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <div className="flex flex-col items-center gap-3 text-emerald-600">
          <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading Clinic Storage Dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={fetchDashboard} className="px-4 py-2 bg-rose-100 hover:bg-rose-200 rounded-xl text-xs font-bold text-rose-800">
          Retry
        </button>
      </div>
    );
  }

  const { summary, canStats, recentActivity } = data;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clinic Operational Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time IVF embryo storage utilization & staff operational status</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('new-patient')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>New Patient</span>
          </button>
          <button
            onClick={() => onNavigate('container-view')}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 shadow-sm transition-all"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Container View</span>
          </button>
        </div>
      </div>

      {/* Pending OCR Alert Banner */}
      {summary.pendingOcrCount > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <FileScan className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="font-bold text-sm">Pending OCR Verifications ({summary.pendingOcrCount})</div>
              <div className="text-xs text-amber-800">Scanned patient records require human verification before finalizing medical record.</div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('ocr')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-sm"
          >
            <span>Review OCR</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Storage Cans</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{summary.totalCans} Cans</div>
          <div className="text-xs text-slate-500">{summary.totalVisoTubes} total Viso Tubes</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Occupied Straw Capacity</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-emerald-700 tracking-tight">{summary.occupiedStraws}</div>
          <div className="text-xs text-slate-500">Total occupied straws in storage</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Available Capacity</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-emerald-600 tracking-tight">{summary.availableStraws}</div>
          <div className="text-xs text-slate-500">Straw slots ready for allocation</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Global Utilization</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{summary.globalUtilizationPercentage}</div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
              style={{ width: summary.globalUtilizationPercentage }}
            />
          </div>
        </div>
      </div>

      {/* Storage Utilization per Can Visualization */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Can Storage Overview</h2>
            <p className="text-xs text-slate-500">Live capacity & utilization metrics breakdown per physical Can</p>
          </div>
          <button
            onClick={() => onNavigate('container-view')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>Full Visual Container View</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {canStats.map((can: any) => (
            <div key={can.canId} className="bg-slate-50/60 p-5 rounded-2xl border border-slate-200 space-y-3 hover:border-emerald-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm text-slate-900">{can.canCode}</div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    can.utilizationPercentage > 80
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : can.utilizationPercentage > 50
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {can.utilizationPercentage}% Occupied
                </span>
              </div>

              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    can.utilizationPercentage > 80
                      ? 'bg-rose-500'
                      : can.utilizationPercentage > 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${can.utilizationPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>{can.occupiedStraws} / {can.maxCapacityStraws} straws</span>
                <span className="text-slate-600 font-medium">{can.availableStraws} available</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <span>Recent Staff Operations</span>
          </h2>
          <button
            onClick={() => onNavigate('logs')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
          >
            View Full Audit Logs
          </button>
        </div>

        <div className="space-y-3">
          {recentActivity.map((log: any) => (
            <div key={log.id} className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <div>
                  <span className="font-bold text-slate-900">{log.user?.name || log.userId}</span>
                  <span className="text-emerald-700 font-mono font-bold ml-2">[{log.action}]</span>
                  <div className="text-slate-500 text-[11px] mt-0.5">{log.entityName} ID: {log.entityId || 'N/A'}</div>
                </div>
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                {new Date(log.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
