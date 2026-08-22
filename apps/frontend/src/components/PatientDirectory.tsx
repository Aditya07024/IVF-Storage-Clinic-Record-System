import React, { useState, useEffect } from 'react';
import { Search, Printer, FileText, ChevronRight, Layers, User, Calendar, ShieldAlert, Phone, AlertTriangle } from 'lucide-react';
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
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Record Directory</h1>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Search by <strong className="text-slate-900">Registration No (ID)</strong>, <strong className="text-slate-900">Mobile Phone</strong>, or <strong className="text-slate-900">Patient Full Name</strong>
          </p>
        </div>

        {/* Debounced Search Bar */}
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Reg No, Mobile, or Name..."
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
            <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Reg No (ID)</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Freezing / Storage Date</th>
                <th className="px-6 py-4">Mobile Phone</th>
                <th className="px-6 py-4">Storage Batches</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    <div className="flex justify-center items-center gap-2 text-emerald-600 font-semibold">
                      <span className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                      <span>Searching database by Reg No, Mobile, Name...</span>
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
                patients.map((p) => {
                  const sameNameCount = patients.filter(item => item.fullName.toLowerCase() === p.fullName.toLowerCase()).length;
                  const isDuplicateName = sameNameCount > 1;

                  const freezingDateObj = p.freezingDate || p.batches?.[0]?.storageDate;
                  const freezingDateStr = freezingDateObj ? new Date(freezingDateObj).toISOString().split('T')[0] : 'Not Specified';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleSelectPatient(p.id)}
                      className="hover:bg-emerald-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-emerald-700">{p.patientId}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{p.fullName}</div>
                        {p.partnerName && <div className="text-xs text-slate-500">Partner: {p.partnerName}</div>}
                        {isDuplicateName && (
                          <div className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 mt-1 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            <span>Same Name Account — Check Freezing Date: {freezingDateStr}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono border ${isDuplicateName ? 'bg-amber-100 text-amber-950 border-amber-400' : 'bg-emerald-100 text-emerald-950 border-emerald-300'}`}>
                          Freezing Date: {freezingDateStr}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-mono text-xs font-semibold">
                        {p.phone ? p.phone : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-bold border border-slate-200">
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
                  );
                })
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
                <div className="text-xs text-slate-600 font-mono font-bold mt-1">
                  Freezing Date: {selectedPatient.freezingDate ? new Date(selectedPatient.freezingDate).toISOString().split('T')[0] : 'N/A'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePrintPdf(selectedPatient.id)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document PDF</span>
                </button>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Patient Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Registration No (Patient ID):</span>
                <strong className="text-emerald-800 font-mono text-sm">{selectedPatient.patientId}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Freezing / Storage Date:</span>
                <strong className="text-slate-900 font-mono text-sm">
                  {selectedPatient.freezingDate ? new Date(selectedPatient.freezingDate).toISOString().split('T')[0] : 'N/A'}
                </strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Partner Name:</span>
                <strong className="text-slate-900">{selectedPatient.partnerName || 'N/A'}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Mobile Phone:</span>
                <strong className="text-slate-900 font-mono">{selectedPatient.phone || 'N/A'}</strong>
              </div>
            </div>

            {/* Storage Batches Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Cryo Storage Specimen Batches ({selectedPatient.batches?.length || 0})</span>
              </h3>

              {selectedPatient.batches?.length === 0 ? (
                <div className="text-xs text-slate-500 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  No cryo storage batches allocated for this patient yet.
                </div>
              ) : (
                selectedPatient.batches?.map((batch: any) => (
                  <div key={batch.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                      <span className="font-mono font-bold text-emerald-800">Batch Code: {batch.batchId}</span>
                      <span className="text-slate-600 font-medium">
                        Stored on: {new Date(batch.storageDate).toISOString().split('T')[0]}
                      </span>
                    </div>

                    {/* Viso Tube Location Breakdown */}
                    <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 space-y-0.5 shadow-2xs">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Physical Location Guide:</div>
                      <div className="text-slate-900 font-bold">
                        {batch.visoTube?.locationCode
                          ? (batch.visoTube.locationCode.replace(/^CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)$/i, 'Can $1 • Canister $2 • Level $3 • Viso Tube $5'))
                          : 'N/A'}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-700 font-bold">
                        System Ref: {batch.visoTube?.locationCode}
                      </div>
                    </div>

                    {/* Straws List */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-700">Straws in this Batch:</div>
                      {batch.straws?.map((straw: any) => (
                        <div key={straw.id} className="text-xs bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                          <div className="font-mono font-bold text-slate-800 flex items-center gap-2">
                            <span>Straw ID: {straw.strawId}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded border border-slate-200">
                              Color: {straw.color}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${straw.status === 'OCCUPIED' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {straw.status} ({straw.embryos?.length || 0} Embryos)
                          </span>
                        </div>
                      ))}
                    </div>
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
