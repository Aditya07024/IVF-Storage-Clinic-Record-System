import React, { useState, useEffect } from 'react';
import { Search, Printer, FileText, ChevronRight, Layers, User, Calendar, ShieldAlert, Phone, AlertTriangle, ArrowUpDown, X, ThermometerSnowflake, CheckCircle2, MoveRight } from 'lucide-react';
import { apiRequest, formatDateDDMMYYYY } from '../api/client';
import { getStrawColorBadgeClass } from './PatientForm';

export const PatientDirectory: React.FC = () => {
  const [queryInput, setQueryInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [freezingDateFilter, setFreezingDateFilter] = useState('');
  const [sortBy, setSortBy] = useState('freezingDate');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [patients, setPatients] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  // Quick Thaw Modal States
  const [quickThawPatient, setQuickThawPatient] = useState<any | null>(null);
  const [selectedStrawIds, setSelectedStrawIds] = useState<string[]>([]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [thawing, setThawing] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, [activeQuery, freezingDateFilter, sortBy, sortOrder, page]);

  const handleExecuteSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    setActiveQuery(queryInput.trim());
  };

  const fetchPatients = async () => {
    setLoading(true);
    setLoadingProgress(15);
    setError(null);

    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 15 + 10);
      });
    }, 120);

    try {
      const res = await apiRequest(
        `/api/patients?q=${encodeURIComponent(activeQuery)}&freezingDate=${encodeURIComponent(freezingDateFilter)}&sortBy=${sortBy}&sortOrder=${sortOrder}&page=${page}&limit=10`
      );
      clearInterval(progressInterval);
      setLoadingProgress(100);

      if (res.success) {
        setPatients(res.patients);
        setTotal(res.total);
      }
    } catch (err: any) {
      clearInterval(progressInterval);
      setError(err.message || 'Failed to fetch patients.');
    } finally {
      setTimeout(() => {
        setLoading(false);
        setLoadingProgress(0);
      }, 180);
    }
  };

  const handleSelectPatient = async (id: string) => {
    setLoadingDetailId(id);
    try {
      const res = await apiRequest(`/api/patients/${id}`);
      if (res.success) {
        setSelectedPatient(res.patient);
      }
    } catch (err: any) {
      alert('Failed to load patient details: ' + err.message);
    } finally {
      setLoadingDetailId(null);
    }
  };

  const openQuickThawModal = async (patientId: string) => {
    try {
      const res = await apiRequest(`/api/patients/${patientId}`);
      if (res.success) {
        setQuickThawPatient(res.patient);
        setSelectedStrawIds([]);
        setDoctorNotes('');
      }
    } catch (err: any) {
      alert('Failed to load patient straws: ' + err.message);
    }
  };

  const toggleStrawSelection = (strawId: string) => {
    if (selectedStrawIds.includes(strawId)) {
      setSelectedStrawIds(selectedStrawIds.filter((id) => id !== strawId));
    } else {
      setSelectedStrawIds([...selectedStrawIds, strawId]);
    }
  };

  const handleExecuteQuickThaw = async () => {
    if (selectedStrawIds.length === 0) {
      alert('Please select at least one straw to thaw/warm.');
      return;
    }

    setThawing(true);
    try {
      const res = await apiRequest('/api/thaw', {
        method: 'POST',
        body: JSON.stringify({
          strawIds: selectedStrawIds,
          doctorNotes: doctorNotes.trim() || undefined,
        }),
      });

      if (res.success) {
        alert(res.message || 'Thaw operation completed and physical capacity liberated!');
        setQuickThawPatient(null);
        setSelectedStrawIds([]);
        setDoctorNotes('');
        fetchPatients();
        if (selectedPatient) handleSelectPatient(selectedPatient.id);
      }
    } catch (err: any) {
      alert('Thaw failed: ' + err.message);
    } finally {
      setThawing(false);
    }
  };

  const handlePrintPdf = (patientId: string) => {
    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '';
    const url = `${apiBase}/api/documents/patient/${patientId}/pdf`;
    window.open(url, '_blank');
  };

  return (
    <div className="p-3 sm:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 bg-slate-50 min-h-screen w-full box-border overflow-x-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Patient Record Directory</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
            Search by <strong className="text-slate-900">Reg No (ID)</strong>, <strong className="text-slate-900">Mobile Phone</strong>, <strong className="text-slate-900">Patient Name</strong>, or <strong className="text-slate-900">Freezing Date</strong>
          </p>
        </div>

        {/* Multi-Field Search Bar with Explicit Search Button */}
        <form onSubmit={handleExecuteSearch} className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm w-full max-w-full overflow-hidden box-border">
          <div className="md:col-span-6 flex items-center gap-2 w-full min-w-0">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExecuteSearch(e)}
                placeholder="Type Reg No, Mobile, Name, or Date..."
                className="w-full max-w-full min-w-0 box-border bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 shrink-0 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="relative flex-1">
              <input
                type="date"
                value={freezingDateFilter}
                onChange={(e) => {
                  setFreezingDateFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {freezingDateFilter && (
              <button
                type="button"
                onClick={() => setFreezingDateFilter('')}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg bg-slate-100 hover:bg-slate-200"
                title="Clear Freezing Date Filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so as 'asc' | 'desc');
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
            >
              <option value="freezingDate-desc">📅 Freezing Date (Newest)</option>
              <option value="freezingDate-asc">📅 Freezing Date (Oldest)</option>
              <option value="createdAt-desc">🕒 Registration Date</option>
            </select>
          </div>
        </form>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Patient Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        {/* Animated Top Progress Bar */}
        {loading && (
          <div className="w-full bg-slate-100 h-1.5 overflow-hidden absolute top-0 inset-x-0 z-20">
            <div
              className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 h-full transition-all duration-200 ease-out shadow-[0_0_10px_rgba(16,185,129,0.8)]"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
        )}

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
                <>
                  {/* Real-time Loader Progress Notice Banner */}
                  <tr>
                    <td colSpan={6} className="bg-emerald-50/70 px-6 py-3 border-b border-emerald-100">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold">
                          <span className="w-3.5 h-3.5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                          <span>Searching patient database records...</span>
                        </div>
                        <span className="font-bold text-emerald-800 bg-emerald-100 px-3 py-0.5 rounded-full border border-emerald-300">
                          {loadingProgress}% Loaded
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* 5 Shimmer Skeleton Rows */}
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <tr key={idx} className="animate-pulse bg-white">
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-200 rounded-md w-24" />
                      </td>
                      <td className="px-6 py-4 space-y-2">
                        <div className="h-4 bg-slate-200 rounded-md w-36" />
                        <div className="h-3 bg-slate-100 rounded-md w-24" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 bg-slate-100 rounded-xl w-32" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-slate-200 rounded-md w-28" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 bg-slate-100 rounded-lg w-28" />
                      </td>
                      <td className="px-6 py-4 flex justify-end gap-2">
                        <div className="h-8 bg-slate-200 rounded-xl w-16" />
                        <div className="h-8 bg-slate-200 rounded-xl w-16" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No matching patient records found. Click "Search" button above.
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  const sameNameCount = patients.filter(item => item.fullName.toLowerCase() === p.fullName.toLowerCase()).length;
                  const isDuplicateName = sameNameCount > 1;

                  const freezingDateObj = p.freezingDate || p.batches?.[0]?.storageDate;
                  const freezingDateStr = formatDateDDMMYYYY(freezingDateObj);
                  const isOpeningDetail = loadingDetailId === p.id;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleSelectPatient(p.id)}
                      className={`hover:bg-emerald-50/40 cursor-pointer transition-colors relative ${
                        isOpeningDetail ? 'bg-emerald-50/80' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-mono font-bold text-emerald-700 flex items-center gap-2">
                        {isOpeningDetail && (
                          <span className="w-3.5 h-3.5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin shrink-0" />
                        )}
                        <span>{p.patientId}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {p.fullName} {p.patientAge ? `(${p.patientAge})` : ''}
                        </div>
                        {p.partnerName && (
                          <div className="text-xs text-slate-500">
                            Partner: {p.partnerName} {p.partnerAge ? `(${p.partnerAge})` : ''}
                          </div>
                        )}
                        {p.doctorName && (
                          <div className="text-xs text-emerald-800 font-bold">
                            Doctor: {p.doctorName}
                          </div>
                        )}
                        {isDuplicateName && (
                          <div className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 mt-1 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            <span>Same Name Account — Check Freezing Date: {freezingDateStr}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded-xl text-xs font-bold font-mono border ${isDuplicateName ? 'bg-amber-100 text-amber-950 border-amber-400' : 'bg-emerald-100 text-emerald-950 border-emerald-300'}`}>
                            Freezing: {freezingDateStr}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold font-mono bg-slate-100 text-slate-800 border border-slate-300">
                            Visit Date: {formatDateDDMMYYYY(p.visitDate || p.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-700 font-mono text-xs font-semibold">
                        {p.phone ? p.phone : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const activeBatches = p.batches?.filter((b: any) =>
                            b.straws?.some((s: any) => s.status === 'OCCUPIED')
                          ).length || 0;

                          if (activeBatches > 0) {
                            return (
                              <span className="px-1 py-1 bg-emerald-100 text-emerald-950 rounded-lg text-xs font-bold font-mono border border-emerald-300">
                                {activeBatches} Active Batch(es)
                              </span>
                            );
                          }
                          return (
                            <span className="px-1 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold font-mono border border-slate-300">
                              0 Active (All Thawed)
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                        {/* Direct 1-Click Thaw Button */}
                        {(() => {
                          const hasActiveStraws = p.batches?.some((b: any) =>
                            b.straws?.some((s: any) => s.status === 'OCCUPIED')
                          );

                          if (hasActiveStraws) {
                            return (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openQuickThawModal(p.id);
                                }}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl border border-rose-200 transition-all inline-flex items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95"
                                title="Execute Thaw for this patient"
                              >
                                <ThermometerSnowflake className="w-3.5 h-3.5 text-rose-600" />
                                <span>Thaw</span>
                              </button>
                            );
                          }

                          return (
                            <button
                              disabled
                              className="p-2 bg-slate-100 text-slate-400 rounded-xl border border-slate-200 cursor-not-allowed inline-flex items-center gap-1.5 text-xs font-bold opacity-60"
                              title="No active straws available for thawing"
                            >
                              <ThermometerSnowflake className="w-3.5 h-3.5 text-slate-400" />
                              <span>All Thawed</span>
                            </button>
                          );
                        })()}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintPdf(p.id);
                          }}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 transition-all inline-flex items-center gap-1.5 text-xs font-bold shadow-xs"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
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

      {/* 1-Click Quick Thaw Modal */}
      {quickThawPatient && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white p-6 rounded-3xl border border-slate-200 shadow-2xl space-y-6 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-700">
                  <ThermometerSnowflake className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Execute Thaw / Warming Operation</h2>
                  <p className="text-xs text-slate-500 font-mono font-bold">
                    Patient: {quickThawPatient.fullName} • Reg No: {quickThawPatient.patientId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickThawPatient(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Straw Selection */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Straw(s) to Thaw & Liberate Physical Capacity:
              </div>

              {quickThawPatient.batches?.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-200 text-center">
                  No active cryo storage batches found for this patient.
                </div>
              ) : (
                quickThawPatient.batches?.map((batch: any) => (
                  <div key={batch.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                      <span className="font-mono font-bold text-emerald-800">Batch Code: {batch.batchId}</span>
                      <span className="text-slate-600 font-mono">Stored: {new Date(batch.storageDate).toISOString().split('T')[0]}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {batch.straws?.map((straw: any) => {
                        const isSelected = selectedStrawIds.includes(straw.id);
                        const isThawed = straw.status === 'THAWED' || straw.status === 'VACANT';

                        return (
                          <div
                            key={straw.id}
                            onClick={() => !isThawed && toggleStrawSelection(straw.id)}
                            className={`p-3 rounded-xl border transition-all ${
                              isThawed
                                ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                                : isSelected
                                ? 'bg-rose-100/90 border-rose-500 ring-2 ring-rose-500/30 cursor-pointer shadow-xs'
                                : 'bg-white border-slate-200 hover:border-rose-300 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="font-mono text-slate-900">{straw.strawId}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] ${isThawed ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                                {straw.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded border text-[10px] ${getStrawColorBadgeClass(straw.color)}`}>
                                Straw Color: {straw.color || 'Pink'}
                              </span>
                              <span className="font-mono font-bold text-slate-800">{straw.embryos?.length || 0} Embryos</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {/* Doctor Remarks / Thaw Notes */}
              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-slate-700">Doctor Thaw Notes / Clinical Remarks</label>
                <textarea
                  rows={2}
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Write clinical notes for this thaw operation..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickThawPatient(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteQuickThaw}
                disabled={selectedStrawIds.length === 0 || thawing}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50 transition-all"
              >
                {thawing ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ThermometerSnowflake className="w-4 h-4" />
                    <span>Thaw {selectedStrawIds.length} Selected Straw(s) & Liberate Capacity</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full border-l border-slate-200 p-6 overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-700">{selectedPatient.patientId}</span>
                <h2 className="text-xl font-bold text-slate-900">{selectedPatient.fullName}</h2>
                <div className="text-xs text-slate-600 font-mono font-bold flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span className="text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    Visit Date: {formatDateDDMMYYYY(selectedPatient.visitDate || selectedPatient.createdAt)}
                  </span>
                  <span>•</span>
                  <span>Freezing Date: {formatDateDDMMYYYY(selectedPatient.freezingDate)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedPatient.batches?.some((b: any) =>
                  b.straws?.some((s: any) => s.status === 'OCCUPIED')
                ) && (
                  <button
                    onClick={() => openQuickThawModal(selectedPatient.id)}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <ThermometerSnowflake className="w-4 h-4" />
                    <span>Thaw Specimen</span>
                  </button>
                )}
                <button
                  onClick={() => handlePrintPdf(selectedPatient.id)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print PDF</span>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Registration No (ID):</span>
                <strong className="text-emerald-800 font-mono text-sm">{selectedPatient.patientId}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Patient Age:</span>
                <strong className="text-slate-900 font-medium">{selectedPatient.patientAge || 'N/A'}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Partner Name & Age:</span>
                <strong className="text-slate-900">{selectedPatient.partnerName || 'N/A'} {selectedPatient.partnerAge ? `(${selectedPatient.partnerAge})` : ''}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Doctor / Physician:</span>
                <strong className="text-slate-900 font-bold">{selectedPatient.doctorName || 'N/A'}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Visit Date:</span>
                <strong className="text-slate-900 font-mono">{formatDateDDMMYYYY(selectedPatient.visitDate)}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Freezing Date:</span>
                <strong className="text-slate-900 font-mono">{formatDateDDMMYYYY(selectedPatient.freezingDate)}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">DE Date (Donor Egg):</span>
                <strong className="text-slate-900 font-mono">{formatDateDDMMYYYY(selectedPatient.deDate)}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Mobile Phone:</span>
                <strong className="text-slate-900 font-mono">{selectedPatient.phone || 'N/A'}</strong>
              </div>
            </div>

            {/* Clinical Comments & Doctor Remarks Card */}
            {selectedPatient.comments && selectedPatient.comments.trim().length > 0 && (
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-1 text-xs">
                <span className="text-amber-950 font-bold uppercase text-[10px] tracking-wider block">
                  Clinical Comments & Doctor Remarks:
                </span>
                <p className="text-slate-800 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {selectedPatient.comments}
                </p>
              </div>
            )}

            {/* Storage Batches Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>Active Cryo Storage Specimen Batches</span>
                </span>
                {(() => {
                  const activeCount = selectedPatient.batches?.filter((b: any) =>
                    b.straws?.some((s: any) => s.status === 'OCCUPIED')
                  ).length || 0;
                  return (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold border ${activeCount > 0 ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                      {activeCount} Active Batch(es)
                    </span>
                  );
                })()}
              </h3>

              {(() => {
                const activeBatches = selectedPatient.batches?.filter((batch: any) =>
                  batch.straws?.some((straw: any) => straw.status === 'OCCUPIED')
                ) || [];

                if (activeBatches.length === 0) {
                  return (
                    <div className="text-xs text-slate-600 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center font-medium">
                      0 Active Specimen Batches in Storage (All specimen have been thawed & withdrawn)
                    </div>
                  );
                }

                return activeBatches.map((batch: any) => {
                  const activeStraws = batch.straws?.filter((s: any) => s.status === 'OCCUPIED') || [];

                  return (
                    <div key={batch.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                        <span className="font-mono font-bold text-emerald-800">Batch Code: {batch.batchId}</span>
                        <span className="text-slate-600 font-medium">
                          Stored on: {formatDateDDMMYYYY(batch.storageDate)}
                        </span>
                      </div>

                      {/* Viso Tube Location Breakdown */}
                      {(() => {
                        const locCode = activeStraws[0]?.visoTube?.locationCode || batch.straws?.[0]?.visoTube?.locationCode || '';
                        const formatted = locCode
                          ? locCode.replace(/^CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)$/i, 'Can $1 • Canister $2 • Level $3 • Viso Tube $5')
                          : 'Not Assigned';
                        return (
                          <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 space-y-0.5 shadow-2xs">
                            <div className="text-[10px] text-slate-500 font-semibold uppercase">Physical Location Guide:</div>
                            <div className="text-slate-900 font-bold">{formatted}</div>
                            <div className="text-[10px] font-mono text-emerald-700 font-bold">
                              System Ref: {locCode || 'Not Assigned'}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Straws List */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-700">Active Straws in this Batch:</div>
                        {activeStraws.map((straw: any) => (
                          <div key={straw.id} className="text-xs bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                            <div className="font-mono font-bold text-slate-800 flex items-center gap-2">
                              <span>Straw ID: {straw.strawId}</span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded border border-slate-200">
                                Color: {straw.color}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-100 text-emerald-900 border-emerald-300">
                              OCCUPIED ({straw.embryos?.length || 0} Embryos)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Thaw / Withdrawal Clinical History Section */}
            {selectedPatient.thawRecords && selectedPatient.thawRecords.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ThermometerSnowflake className="w-4 h-4 text-rose-600" />
                  <span>Thaw & Withdrawal Clinical History ({selectedPatient.thawRecords.length})</span>
                </h3>
                <div className="overflow-x-auto bg-slate-50 rounded-2xl border border-slate-200 p-3">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                        <th className="py-2 px-3">Straw ID</th>
                        <th className="py-2 px-3">Thaw Date & Time</th>
                        <th className="py-2 px-3">Executing Doctor / Staff</th>
                        <th className="py-2 px-3 font-sans">Clinical Doctor Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {selectedPatient.thawRecords.map((t: any) => (
                        <tr key={t.id} className="hover:bg-white">
                          <td className="py-2 px-3 font-bold text-emerald-800">{t.straw?.strawId || t.strawId}</td>
                          <td className="py-2 px-3 text-slate-600">{new Date(t.thawDate).toLocaleString()}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{t.doctorName}</td>
                          <td className="py-2 px-3 font-sans text-slate-700">{t.doctorNotes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Uploaded Documents & OCR Scans History */}
            {selectedPatient.ocrRecords && selectedPatient.ocrRecords.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span>Uploaded Documents & OCR History ({selectedPatient.ocrRecords.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedPatient.ocrRecords.map((ocr: any) => {
                    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '';
                    const imgUrl = `${apiBase}/uploads/${ocr.storageKey}`;
                    return (
                      <div key={ocr.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="truncate max-w-[180px] font-mono text-slate-900">{ocr.originalFilename}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ocr.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                            {ocr.status}
                          </span>
                        </div>
                        {ocr.mimeType?.startsWith('image/') && (
                          <div className="relative rounded-xl overflow-hidden border border-slate-300 max-h-36 bg-slate-900 flex items-center justify-center">
                            <img src={imgUrl} alt={ocr.originalFilename} className="object-contain max-h-36 w-full" />
                          </div>
                        )}
                        {ocr.rawOcrText && (
                          <div className="text-[10px] font-mono bg-white p-2 rounded-lg border border-slate-200 text-slate-700 max-h-20 overflow-y-auto whitespace-pre-wrap">
                            {ocr.rawOcrText}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
