import React, { useState, useEffect } from 'react';
import { Search, Printer, FileText, ChevronRight, Layers, User, Calendar, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../api/client';

export const PatientDirectory: React.FC = () => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [query]);

  useEffect(() => {
    fetchPatients();
  }, [debouncedQuery, page]);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/patients?q=${encodeURIComponent(debouncedQuery)}&page=${page}&limit=10`);
      if (res.success) {
        setPatients(res.patients);
        setTotal(res.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch patients.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = async (id: string) => {
    try {
      const res = await apiRequest(`/api/patients/${id}`);
      if (res.success) {
        setSelectedPatient(res.patient);
      }
    } catch (err: any) {
      alert('Failed to load patient details: ' + err.message);
    }
  };

  const handlePrintPdf = (patientId: string) => {
    const url = `/api/documents/patient/${patientId}/pdf`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Record Directory</h1>
          <p className="text-sm text-slate-500">Search indexed clinic patient files & physical storage records</p>
        </div>

        {/* Debounced Search Bar */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Patient ID, Name..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-sm"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Patient Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-800">
            <thead className="bg-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Patient ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Partner Name</th>
                <th className="px-6 py-4">Visit Date</th>
                <th className="px-6 py-4">Batches</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex justify-center items-center gap-2 text-emerald-600 font-semibold">
                      <span className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                      <span>Searching database index...</span>
                    </div>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No matching patient records found.
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => handleSelectPatient(p.id)}
                    className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-emerald-700">{p.patientId}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">{p.fullName}</td>
                    <td className="px-6 py-4 text-slate-600">{p.partnerName || '—'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {p.visitDate ? new Date(p.visitDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                        {p.batches?.length || 0} Storage Batch(es)
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePrintPdf(p.id);
                        }}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 transition-all inline-flex items-center gap-1.5 text-xs font-bold shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Document</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full border-l border-slate-200 p-6 overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-700">{selectedPatient.patientId}</span>
                <h2 className="text-xl font-bold text-slate-900">{selectedPatient.fullName}</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintPdf(selectedPatient.id)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="text-slate-500 hover:text-slate-900 text-sm font-semibold px-3 py-1.5 bg-slate-100 rounded-xl"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Storage Batches Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Active Physical Storage Batches</span>
              </h3>

              {selectedPatient.batches?.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 border border-slate-200">
                  No active storage batches assigned for this patient.
                </div>
              ) : (
                selectedPatient.batches.map((batch: any) => (
                  <div key={batch.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-800">{batch.batchId}</span>
                      <span className="text-xs text-slate-500">Date: {new Date(batch.storageDate).toLocaleDateString()}</span>
                    </div>

                    <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 space-y-0.5 shadow-xs">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Physical Location Guide:</div>
                      <div className="text-slate-900 font-bold">
                        {batch.visoTube?.locationCode
                          ? (batch.visoTube.locationCode.replace(/^CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)$/i, 'Chamber $1 • Canister $2 • Level $3 • Viso Tube $5'))
                          : 'N/A'}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-700 font-bold">
                        System Ref: {batch.visoTube?.locationCode}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="text-[11px] font-bold uppercase text-slate-600">Straws in this Batch:</div>
                      {batch.straws.map((straw: any) => (
                        <div key={straw.id} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs">
                          <span className="font-mono font-bold text-emerald-800">{straw.strawId}</span>
                          <span className="text-slate-700">Color: {straw.color}</span>
                          <span className="text-slate-600">{straw.embryos?.length || 0} Embryos</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${straw.status === 'OCCUPIED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                            {straw.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Notes Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">Doctor / Staff Notes</h3>
              {selectedPatient.notes?.length === 0 ? (
                <div className="text-xs text-slate-500">No additional staff notes recorded.</div>
              ) : (
                selectedPatient.notes.map((n: any) => (
                  <div key={n.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span className="font-bold text-emerald-700">{n.authorName}</span>
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-800">{n.noteText}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
