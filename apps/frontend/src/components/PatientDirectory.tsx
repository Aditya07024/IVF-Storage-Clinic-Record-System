import React, { useState, useEffect } from 'react';
import { Search, Printer, FileText, ChevronRight, ChevronLeft, ChevronDown, Layers, User, Calendar, ShieldAlert, Phone, AlertTriangle, ArrowUpDown, X, ThermometerSnowflake, CheckCircle2, MoveRight, Trash2, Edit3, Check } from 'lucide-react';
import { apiRequest, formatDateDDMMYYYY } from '../api/client';
import { useBackgroundTask } from '../context/BackgroundTaskContext';
import { getStrawColorBadgeClass } from './PatientForm';

const VISO_TUBE_COLOR_NAMES: Record<number, string> = {
  1: 'Pink', 2: 'Grey', 3: 'Red', 4: 'Black', 5: 'Green',
  6: 'Rust', 7: 'Blue', 8: 'Purple', 9: 'Yellow', 10: 'Orange', 11: 'Skyblue',
};

function parseVisoTubeLocation(code?: string) {
  if (!code) return 'Location Not Specified';
  const match = code.match(/CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)/i);
  if (!match) return code;
  const canNum = match[1].padStart(2, '0');
  const canisterNum = match[2].padStart(2, '0');
  const levelNum = parseInt(match[3], 10);
  const tubeNumInt = parseInt(match[5], 10);
  const tubeNumPadded = match[5].padStart(2, '0');
  const colorName = VISO_TUBE_COLOR_NAMES[tubeNumInt] || 'Standard';

  return `Can ${canNum} • Canister ${canisterNum} • Level ${levelNum} • ${colorName} Viso Tube (V${tubeNumPadded})`;
}

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
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Quick Thaw Modal States
  const [quickThawPatient, setQuickThawPatient] = useState<any | null>(null);
  const [selectedStrawIds, setSelectedStrawIds] = useState<string[]>([]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [thawing, setThawing] = useState(false);

  // Edit Patient Modal States
  const [editingPatient, setEditingPatient] = useState<any | null>(null);
  const [editPatientId, setEditPatientId] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editPatientAge, setEditPatientAge] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPartnerName, setEditPartnerName] = useState('');
  const [editPartnerDob, setEditPartnerDob] = useState('');
  const [editPartnerAge, setEditPartnerAge] = useState('');
  const [editPartnerPhone, setEditPartnerPhone] = useState('');
  const [editPartnerEmail, setEditPartnerEmail] = useState('');
  const [editDoctorName, setEditDoctorName] = useState('');
  const [editComments, setEditComments] = useState('');
  const [editFreezingDate, setEditFreezingDate] = useState('');
  const [editVisitDate, setEditVisitDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPatient || editingPatient || quickThawPatient) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedPatient, editingPatient, quickThawPatient]);

  const openEditPatientModal = (patient: any) => {
    setEditingPatient(patient);
    setEditPatientId(patient.patientId || '');
    setEditFullName(patient.fullName || '');
    setEditDob(patient.dob || '');
    setEditPatientAge(patient.patientAge || calculateAgeFromDob(patient.dob));
    setEditPhone(patient.phone || '');
    setEditEmail(patient.email || '');
    setEditPartnerName(patient.partnerName || '');
    setEditPartnerDob(patient.partnerDob || '');
    setEditPartnerAge(patient.partnerAge || calculateAgeFromDob(patient.partnerDob));
    setEditPartnerPhone(patient.partnerPhone || '');
    setEditPartnerEmail(patient.partnerEmail || '');
    setEditDoctorName(patient.doctorName || '');
    setEditComments(patient.comments || '');
    setEditFreezingDate(patient.freezingDate ? new Date(patient.freezingDate).toISOString().split('T')[0] : '');
    setEditVisitDate(patient.visitDate ? new Date(patient.visitDate).toISOString().split('T')[0] : '');
    setEditError(null);
    setEditSuccessMsg(null);
  };

  const handleSavePatientEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    setSavingEdit(true);
    setEditError(null);
    setEditSuccessMsg(null);

    try {
      const payload = {
        patientId: editPatientId.trim(),
        fullName: editFullName.trim(),
        dob: editDob.trim(),
        patientAge: editPatientAge.trim() || calculateAgeFromDob(editDob),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        partnerName: editPartnerName.trim(),
        partnerDob: editPartnerDob.trim(),
        partnerAge: editPartnerAge.trim() || calculateAgeFromDob(editPartnerDob),
        partnerPhone: editPartnerPhone.trim(),
        partnerEmail: editPartnerEmail.trim(),
        doctorName: editDoctorName.trim(),
        comments: editComments.trim(),
        freezingDate: editFreezingDate ? editFreezingDate : null,
        visitDate: editVisitDate ? editVisitDate : null,
      };

      const res = await apiRequest(`/api/patients/${editingPatient.id}`, {
        method: 'PUT',
        body: payload,
      });

      if (res.success) {
        setEditSuccessMsg('Patient details updated successfully!');
        await fetchPatients();
        const updatedDetails = await apiRequest(`/api/patients/${editingPatient.id}`);
        if (updatedDetails.success && updatedDetails.patient) {
          setSelectedPatient(updatedDetails.patient);
        }
        setTimeout(() => {
          setEditingPatient(null);
          setEditSuccessMsg(null);
        }, 1200);
      } else {
        setEditError(res.error || 'Failed to update patient record.');
      }
    } catch (err: any) {
      setEditError(err.message || 'An error occurred while saving changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Prevent background page scrolling when ANY modal or detail drawer is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(selectedPatient || quickThawPatient || editingPatient);
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overflow = '';
    };
  }, [selectedPatient, quickThawPatient, editingPatient]);

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
        `/api/patients?q=${encodeURIComponent(activeQuery)}&freezingDate=${encodeURIComponent(freezingDateFilter)}&sortBy=${sortBy}&sortOrder=${sortOrder}&page=${page}&limit=20`
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

  const { enqueueTask } = useBackgroundTask();

  const handleExecuteQuickThaw = async () => {
    if (selectedStrawIds.length === 0) {
      alert('Please select at least one straw to thaw/warm.');
      return;
    }

    const patientName = quickThawPatient?.fullName || selectedPatient?.fullName || 'Patient Record';
    const targetStrawIds = [...selectedStrawIds];
    const targetNotes = doctorNotes.trim();
    const targetPatientId = selectedPatient?.id || quickThawPatient?.id;

    // Instantly close modal & reset selection state so staff work is never interrupted!
    setQuickThawPatient(null);
    setSelectedStrawIds([]);
    setDoctorNotes('');

    enqueueTask({
      title: `Thawing ${targetStrawIds.length} Straw(s): ${patientName}`,
      description: 'Freeing physical storage slot & logging clinical doctor notes',
      action: async () => {
        const res = await apiRequest('/api/thaw', {
          method: 'POST',
          body: JSON.stringify({
            strawIds: targetStrawIds,
            doctorNotes: targetNotes || undefined,
          }),
        });
        return res;
      },
      onSuccess: () => {
        fetchPatients();
        if (targetPatientId) handleSelectPatient(targetPatientId);
      },
    });
  };

  const handlePrintPdf = (patientId: string) => {
    const apiBase = (import.meta as any).env?.VITE_API_BASE_URL || '';
    const accessKey = localStorage.getItem('site_access_key') || 'clinic2026';
    const token = localStorage.getItem('access_token') || '';
    const url = `${apiBase}/api/documents/patient/${patientId}/pdf?key=${encodeURIComponent(accessKey)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
    window.open(url, '_blank');
  };

  const handleDeletePatient = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete patient "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await apiRequest(`/api/patients/${id}`, { method: 'DELETE' });
      if (res.success) {
        fetchPatients();
      } else {
        alert(res.error || 'Failed to delete patient record.');
      }
    } catch (err: any) {
      alert('Error deleting patient record: ' + (err as any).message);
    }
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

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePatient(p.id, p.fullName);
                          }}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 transition-all inline-flex items-center gap-1.5 text-xs font-bold shadow-xs active:scale-95"
                          title="Permanently delete patient record"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Delete</span>
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

      {/* 20 Patients Per Slot Pagination Bar & Load More Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-600 font-medium">
          Showing <span className="font-mono font-bold text-slate-900">{patients.length > 0 ? (page - 1) * 20 + 1 : 0}</span> to{' '}
          <span className="font-mono font-bold text-slate-900">{Math.min(page * 20, total)}</span> of{' '}
          <span className="font-mono font-bold text-emerald-700">{total}</span> Total Patient Records (20 per slot)
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous 20</span>
          </button>

          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            Page {page} of {Math.ceil(total / 20) || 1}
          </span>

          <button
            disabled={page * 20 >= total || loading}
            onClick={() => setPage((p) => p + 1)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 active:scale-95"
          >
            <span>Next 20 Patients</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1-Click Quick Thaw Modal */}
      {quickThawPatient && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="w-full h-full sm:h-auto max-h-[100dvh] sm:max-h-[90vh] max-w-2xl bg-white p-5 sm:p-6 rounded-t-3xl sm:rounded-3xl border-0 sm:border border-slate-200 shadow-2xl space-y-4 sm:space-y-6 text-slate-900 overflow-y-auto flex flex-col justify-between">
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

      {/* Edit Patient Details Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl text-slate-900 flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden min-w-0">
            {/* FIXED HEADER */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 shrink-0">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">Edit Patient Medical Records</h2>
                  <p className="text-xs text-slate-500 font-mono font-bold">
                    Editing Record ID: {editingPatient.patientId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPatient(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SCROLLABLE MIDDLE BODY */}
            <form onSubmit={handleSavePatientEdit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-w-0">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Registration No (Unique Primary Key) <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={editPatientId}
                    onChange={(e) => setEditPatientId(e.target.value)}
                    required
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Patient Full Name <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    required
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Patient DOB</span>
                    {editPatientAge && (
                      <span className="text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-300">
                        {editPatientAge}
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={editDob}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditDob(val);
                      setEditPatientAge(calculateAgeFromDob(val));
                    }}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Patient Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Patient Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Partner Name
                  </label>
                  <input
                    type="text"
                    value={editPartnerName}
                    onChange={(e) => setEditPartnerName(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span>Partner DOB</span>
                    {editPartnerAge && (
                      <span className="text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-300">
                        {editPartnerAge}
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={editPartnerDob}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditPartnerDob(val);
                      setEditPartnerAge(calculateAgeFromDob(val));
                    }}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Partner Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={editPartnerPhone}
                    onChange={(e) => setEditPartnerPhone(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Partner Email Address
                  </label>
                  <input
                    type="email"
                    value={editPartnerEmail}
                    onChange={(e) => setEditPartnerEmail(e.target.value)}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Doctor Name / Attending Physician <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={editDoctorName}
                    onChange={(e) => setEditDoctorName(e.target.value)}
                    required
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Visit Date
                    </label>
                    <input
                      type="date"
                      value={editVisitDate}
                      onChange={(e) => setEditVisitDate(e.target.value)}
                      className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Freezing Date
                    </label>
                    <input
                      type="date"
                      value={editFreezingDate}
                      onChange={(e) => setEditFreezingDate(e.target.value)}
                      className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Clinical Comments & Doctor Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={editComments}
                    onChange={(e) => setEditComments(e.target.value)}
                    placeholder="Enter any additional clinical notes or comments..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>
              </div>

              {/* FIXED FOOTER BUTTONS */}
              <div className="sticky bottom-0 bg-white pt-3 pb-1 border-t border-slate-100 flex items-center justify-between z-10 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                >
                  {savingEdit ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Drawer Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end overflow-y-auto">
          <div className="w-full max-w-2xl bg-white min-h-screen sm:min-h-0 sm:h-full border-l border-slate-200 p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 shadow-2xl pb-16 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
              {/* Left Column: Patient Details & Dates */}
              <div className="flex-1 min-w-0 space-y-1">
                <span className="text-xs font-mono font-bold text-emerald-700 block">{selectedPatient.patientId}</span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">{selectedPatient.fullName}</h2>
                <div className="text-xs text-slate-600 font-mono font-bold flex flex-wrap items-center gap-1.5 sm:gap-x-2.5 mt-1">
                  <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 w-fit">
                    Visit Date: {formatDateDDMMYYYY(selectedPatient.visitDate || selectedPatient.createdAt)}
                  </span>
                  <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit">
                    Freezing Date: {formatDateDDMMYYYY(selectedPatient.freezingDate)}
                  </span>
                </div>
              </div>

              {/* Right Column: Compact 2x2 Quad Grid Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5 shrink-0 w-full sm:w-56 p-1 bg-slate-100/90 rounded-xl border border-slate-200 shadow-2xs">
                {/* Quadrant 1: Thaw Specimen */}
                {selectedPatient.batches?.some((b: any) =>
                  b.straws?.some((s: any) => s.status === 'OCCUPIED')
                ) ? (
                  <button
                    onClick={() => openQuickThawModal(selectedPatient.id)}
                    className="w-full h-8 px-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1 active:scale-95 whitespace-nowrap"
                  >
                    <ThermometerSnowflake className="w-3 h-3" />
                    <span>Thaw</span>
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full h-8 px-2.5 bg-slate-200/80 text-slate-400 font-bold text-[11px] rounded-lg cursor-not-allowed opacity-60 flex items-center justify-center gap-1 whitespace-nowrap border border-slate-300/40"
                  >
                    <ThermometerSnowflake className="w-3 h-3 text-slate-400" />
                    <span>All Thawed</span>
                  </button>
                )}

                {/* Quadrant 2: Edit Details */}
                <button
                  onClick={() => openEditPatientModal(selectedPatient)}
                  className="w-full h-8 px-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Edit</span>
                </button>

                {/* Quadrant 3: Print PDF */}
                <button
                  onClick={() => handlePrintPdf(selectedPatient.id)}
                  className="w-full h-8 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                >
                  <Printer className="w-3 h-3" />
                  <span>Print</span>
                </button>

                {/* Quadrant 4: Close */}
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="w-full h-8 px-2.5 bg-white text-slate-700 hover:bg-slate-200 border border-slate-300 font-bold text-[11px] rounded-lg transition-all whitespace-nowrap text-center active:scale-95"
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
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Patient DOB & Age:</span>
                <strong className="text-slate-900 font-medium">
                  {selectedPatient.dob ? formatDateDDMMYYYY(selectedPatient.dob) : 'N/A'} {selectedPatient.patientAge ? `(${selectedPatient.patientAge})` : ''}
                </strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Patient Mobile & Email:</span>
                <strong className="text-slate-900 font-mono text-[11px] block">{selectedPatient.phone || 'N/A'}</strong>
                <span className="text-slate-500 text-[10px] truncate block">{selectedPatient.email || ''}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Partner Name & Age:</span>
                <strong className="text-slate-900 block">{selectedPatient.partnerName || 'N/A'} {selectedPatient.partnerAge ? `(${selectedPatient.partnerAge})` : ''}</strong>
                {selectedPatient.partnerDob && (
                  <span className="text-slate-500 text-[10px] font-mono block">DOB: {formatDateDDMMYYYY(selectedPatient.partnerDob)}</span>
                )}
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Partner Mobile & Email:</span>
                <strong className="text-slate-900 font-mono text-[11px] block">{selectedPatient.partnerPhone || 'N/A'}</strong>
                <span className="text-slate-500 text-[10px] truncate block">{selectedPatient.partnerEmail || ''}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Doctor / Physician:</span>
                <strong className="text-slate-900 font-bold">{selectedPatient.doctorName || 'N/A'}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Visit Date:</span>
                <strong className="text-emerald-800 font-mono font-bold">{formatDateDDMMYYYY(selectedPatient.visitDate || selectedPatient.createdAt)}</strong>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Freezing Date:</span>
                <strong className="text-slate-900 font-mono">{formatDateDDMMYYYY(selectedPatient.freezingDate)}</strong>
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

            {/* Active Storage Batches Section */}
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
                    <div key={batch.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-300 space-y-3 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between text-xs border-b border-slate-200 pb-2 gap-2">
                        <span className="font-mono font-bold text-emerald-800">Batch Code: {batch.batchId}</span>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-700">
                          {batch.aspirationDate && (
                            <span className="bg-amber-100 text-amber-950 px-2 py-0.5 rounded border border-amber-300 font-bold">
                              ASP: {formatDateDDMMYYYY(batch.aspirationDate)}
                            </span>
                          )}
                          <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300 font-bold">
                            Frozen: {formatDateDDMMYYYY(batch.freezingDate || batch.storageDate)}
                          </span>
                          {batch.embryoStage && (
                            <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-300 font-bold">
                              Stage: {batch.embryoStage}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Physical Location Breakdown */}
                      {(() => {
                        const locCode = activeStraws[0]?.visoTube?.locationCode || batch.straws?.[0]?.visoTube?.locationCode || '';
                        return (
                          <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 space-y-0.5 shadow-2xs">
                            <div className="text-[10px] text-slate-500 font-semibold uppercase">Physical Location Guide:</div>
                            <div className="text-slate-900 font-bold">{parseVisoTubeLocation(locCode)}</div>
                            {batch.notes && (
                              <div className="text-[11px] text-slate-600 italic mt-1 font-mono">
                                Batch Comment: {batch.notes}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Active Straws List */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-700">Active Straws in this Batch ({activeStraws.length}):</div>
                        {activeStraws.map((straw: any) => (
                          <div key={straw.id} className="text-xs bg-white p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                            <div className="font-mono font-bold text-slate-800 flex items-center gap-2">
                              <span>Straw ID: {straw.strawId}</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${getStrawColorBadgeClass(straw.color)}`}>
                                {straw.color || 'Pink'} Tag
                              </span>
                              {straw.isPgt && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-100 text-purple-900 border-purple-300">
                                  PGT TESTED
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                              {straw.grade && (
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                                  Grade: {straw.grade}
                                </span>
                              )}
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-100 text-emerald-900 border-emerald-300">
                                ({straw.embryoCount || straw.embryos?.length || 1} Embryos)
                              </span>
                              {straw.comments && (
                                <span className="text-[11px] text-slate-500 italic">
                                  "{straw.comments}"
                                </span>
                              )}
                            </div>
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
                <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <ThermometerSnowflake className="w-4 h-4 text-rose-600" />
                    <span>Thaw & Withdrawal Clinical History ({selectedPatient.thawRecords.length})</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                    WITHDRAWN RECORDS
                  </span>
                </h3>
                <div className="overflow-x-auto bg-slate-50 rounded-2xl border border-slate-200 p-3">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                        <th className="py-2 px-3">Straw ID & Color</th>
                        <th className="py-2 px-3">Thaw Date & Time</th>
                        <th className="py-2 px-3">Executing Doctor / Staff</th>
                        <th className="py-2 px-3">Freed Storage Location</th>
                        <th className="py-2 px-3 font-sans">Clinical Doctor Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {selectedPatient.thawRecords.map((t: any) => (
                        <tr key={t.id} className="hover:bg-white">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{t.straw?.strawId || t.strawId}</span>
                              {t.straw?.color && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStrawColorBadgeClass(t.straw.color)}`}>
                                  {t.straw.color}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-bold">{new Date(t.thawDate).toLocaleString()}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{t.doctorName}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-700">
                            {parseVisoTubeLocation(t.straw?.visoTube?.locationCode)}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-700">{t.doctorNotes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Patient Operational Audit Logs Section */}
            {selectedPatient.auditLogs && selectedPatient.auditLogs.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div
                  onClick={() => setShowAuditLogs(!showAuditLogs)}
                  className="flex items-center justify-between cursor-pointer group bg-slate-50 hover:bg-slate-100 p-3.5 rounded-2xl border border-slate-200 transition-all select-none shadow-2xs"
                  title="Click to toggle Audit Logs visibility"
                >
                  <span className="flex items-center gap-2 font-bold text-sm text-slate-900 group-hover:text-emerald-700">
                    <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Patient Operational Audit Logs ({selectedPatient.auditLogs.length})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      {showAuditLogs ? 'HIDE LOGS' : 'VIEW LOGS'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform duration-200 ${showAuditLogs ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {showAuditLogs && (
                  <div className="overflow-x-auto bg-slate-50 rounded-2xl border border-slate-200 p-3 animate-in fade-in duration-200">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="py-2 px-3">Date & Time</th>
                          <th className="py-2 px-3">Action Event</th>
                          <th className="py-2 px-3">Staff / Doctor</th>
                          <th className="py-2 px-3 font-sans">Operation Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {selectedPatient.auditLogs.map((log: any) => {
                          let detailsObj: any = null;
                          try {
                            detailsObj = log.newData ? JSON.parse(log.newData) : null;
                          } catch {
                            detailsObj = null;
                          }

                          return (
                            <tr key={log.id} className="hover:bg-white">
                              <td className="py-2.5 px-3 text-slate-600 font-bold whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  log.action === 'EMBRYO_THAWED'
                                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                                    : log.action === 'EMBRYO_STORAGE_ALLOCATED' || log.action === 'STORAGE_ALLOCATED'
                                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                    : log.action === 'OCR_VERIFIED'
                                    ? 'bg-teal-100 text-teal-900 border-teal-300'
                                    : 'bg-slate-200 text-slate-900 border-slate-300'
                                }`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">{log.userName || 'System Staff'}</td>
                              <td className="py-2.5 px-3 font-sans text-slate-700">
                                {detailsObj ? (
                                  <div className="space-y-0.5 text-[11px] font-mono">
                                    {detailsObj.strawId && <div>Straw ID: <strong className="text-emerald-800">{detailsObj.strawId}</strong></div>}
                                    {detailsObj.originalLocation && <div>Location: <strong>{detailsObj.originalLocation}</strong></div>}
                                    {detailsObj.locationCode && <div>Location: <strong>{detailsObj.locationCode}</strong></div>}
                                    {detailsObj.doctorNotes && <div className="text-slate-600 italic">Notes: "{detailsObj.doctorNotes}"</div>}
                                    {!detailsObj.strawId && !detailsObj.locationCode && (
                                      <div className="text-slate-600 truncate max-w-xs">{log.newData}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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
