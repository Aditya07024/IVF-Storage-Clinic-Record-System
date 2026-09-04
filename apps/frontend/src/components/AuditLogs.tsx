import React, { useState, useEffect } from 'react';
import { ClipboardList, Search, Filter, ShieldAlert, Code } from 'lucide-react';
import { apiRequest, formatTimestampDDMMYYYY } from '../api/client';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = `/api/audit/logs?page=${page}&limit=15&action=${encodeURIComponent(actionFilter)}`;
      const res = await apiRequest(query);
      if (res.success) {
        setLogs(res.logs);
        setTotal(res.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-emerald-600" />
            <span>Immutable System Audit Logs</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete append-only audit trail of staff actions, storage assignments, OCR approvals & logins
          </p>
        </div>

        {/* Filter Input */}
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Filter by Action Code..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
            />
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3" />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Staff User</th>
                <th className="px-6 py-4">Action Code</th>
                <th className="px-6 py-4">Entity</th>
                <th className="px-6 py-4">Entity ID</th>
                <th className="px-6 py-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-emerald-600 font-semibold">
                    Loading append-only log sequence...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No matching audit records.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-500">{formatTimestampDDMMYYYY(log.createdAt)}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{log.userName || log.user?.name || log.userId}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded font-mono font-bold border border-emerald-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{log.entityName}</td>
                    <td className="px-6 py-4 font-mono text-slate-500 truncate max-w-[120px]">{log.entityId || 'N/A'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-emerald-800 rounded-lg border border-slate-200 transition-all font-mono font-bold"
                      >
                        Inspect Payload
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-700">Action: {selectedLog.action}</span>
                <h3 className="text-base font-bold text-slate-900">Audit Trail Event Inspector</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-xs text-slate-500 hover:text-slate-900 px-3 py-1.5 bg-slate-100 rounded-xl"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-600">
                Logged By: <strong className="text-slate-900 font-bold">{selectedLog.userName}</strong> • Date: <strong className="text-slate-900 font-bold">{formatTimestampDDMMYYYY(selectedLog.createdAt)}</strong>
              </div>

              {selectedLog.oldData && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Previous Data Payload:</div>
                  <pre className="bg-rose-50 p-3 rounded-2xl border border-rose-200 text-[11px] font-mono text-rose-900 overflow-x-auto">
                    {selectedLog.oldData}
                  </pre>
                </div>
              )}

              {selectedLog.newData && (
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">New Data Payload:</div>
                  <pre className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-[11px] font-mono text-emerald-900 overflow-x-auto">
                    {selectedLog.newData}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
