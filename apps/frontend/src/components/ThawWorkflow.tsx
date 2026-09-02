import React, { useState, useEffect } from 'react';
import { ThermometerSnowflake, Search, CheckCircle2, ShieldAlert, AlertTriangle, Layers, MoveRight, User, Calendar, Phone, RefreshCw, MapPin } from 'lucide-react';
import { apiRequest, formatDateDDMMYYYY } from '../api/client';
import { useBackgroundTask } from '../context/BackgroundTaskContext';
import { getStrawColorBadgeClass } from './PatientForm';

const VISO_TUBE_COLOR_NAMES: Record<number, string> = {
  1: 'Pink', 2: 'Grey', 3: 'Red', 4: 'Black', 5: 'Green',
  6: 'Rust', 7: 'Blue', 8: 'Purple', 9: 'Yellow', 10: 'Orange', 11: 'Skyblue',
};

function parseLocationCode(code: string) {
  if (!code) return { formatted: 'Location Not Specified / Loading' };
  const match = code.match(/CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)/i);
  if (!match) return { formatted: code };
  const canNum = match[1].padStart(2, '0');
  const canisterNum = match[2].padStart(2, '0');
  const levelNum = parseInt(match[3], 10);
  const tubeNumInt = parseInt(match[5], 10);
  const tubeNumPadded = match[5].padStart(2, '0');
  const colorName = VISO_TUBE_COLOR_NAMES[tubeNumInt] || 'Standard';

  return {
    formatted: `Can ${canNum} • Canister ${canisterNum} • Level ${levelNum} • Viso Tube - ${colorName}`,
  };
}

export const ThawWorkflow: React.FC = () => {
  const [patientIdQuery, setPatientIdQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [patient, setPatient] = useState<any | null>(null);
  const [selectedStrawIds, setSelectedStrawIds] = useState<string[]>([]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [thawHistory, setThawHistory] = useState<any[]>([]);

  const [loadingPatient, setLoadingPatient] = useState(false);
  const [thawing, setThawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load initial patients on component mount so page is never blank
  useEffect(() => {
    loadPatients('');
  }, []);

  const loadPatients = async (queryStr: string) => {
    setLoadingPatient(true);
    setError(null);
    try {
      const q = queryStr.trim();
      const endpoint = q ? `/api/patients?q=${encodeURIComponent(q)}` : '/api/patients?limit=50';
      const searchRes = await apiRequest(endpoint);

      if (searchRes.success && searchRes.patients) {
        setSearchResults(searchRes.patients);

        if (q) {
          // Reset active patient when user searches so exact search results are shown
          setPatient(null);
          if (searchRes.patients.length === 1) {
            selectPatientRecord(searchRes.patients[0].id);
          } else if (searchRes.patients.length === 0) {
            setError(`No patient found matching search query "${q}".`);
          }
        } else if (searchRes.patients.length > 0 && !patient) {
          // On initial load without query -> load first patient
          selectPatientRecord(searchRes.patients[0].id);
        }
      } else {
        setSearchResults([]);
        setPatient(null);
        setError('No patient found matching search query.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch patients.');
    } finally {
      setLoadingPatient(false);
    }
  };

  const handleSearchPatient = (e: React.FormEvent) => {
    e.preventDefault();
    loadPatients(patientIdQuery);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPatientIdQuery(val);
    if (!val.trim()) {
      loadPatients('');
    } else {
      loadPatients(val);
    }
  };

  const selectPatientRecord = async (id: string) => {
    setLoadingPatient(true);
    setError(null);
    try {
      const detailsRes = await apiRequest(`/api/patients/${id}`);
      if (detailsRes.success) {
        setPatient(detailsRes.patient);
        fetchThawHistory(id);
      }
    } catch (err: any) {
      setError('Failed to load patient profile: ' + err.message);
    } finally {
      setLoadingPatient(false);
    }
  };

  const fetchThawHistory = async (patientId: string) => {
    try {
      const res = await apiRequest(`/api/thaw/history/${patientId}`);
      if (res.success) {
        setThawHistory(res.history);
      }
    } catch (err: any) {
      console.error('Failed to fetch thaw history:', err);
    }
  };

  const toggleStrawSelection = (strawId: string) => {
    if (selectedStrawIds.includes(strawId)) {
      setSelectedStrawIds(selectedStrawIds.filter(id => id !== strawId));
    } else {
      setSelectedStrawIds([...selectedStrawIds, strawId]);
    }
  };

  const { enqueueTask } = useBackgroundTask();

  const handleExecuteThaw = async () => {
    if (selectedStrawIds.length === 0) {
      setError('Please select at least one straw to thaw/warm.');
      return;
    }

    const patientName = patient?.fullName || 'Patient Record';
    const targetStrawIds = [...selectedStrawIds];
    const targetNotes = doctorNotes.trim();
    const targetPatientId = patient?.id;

    // Reset selection state immediately so staff work is never interrupted!
    setSelectedStrawIds([]);
    setDoctorNotes('');
    setError(null);
    setSuccessMsg(`Thaw operation queued for ${targetStrawIds.length} straw(s) (${patientName})`);

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
        if (targetPatientId) {
          selectPatientRecord(targetPatientId);
        }
        loadPatients(patientIdQuery);
      },
      onError: (err) => {
        setError(err.message || 'Thaw/withdrawal operation failed.');
      },
    });
  };

  return (
    <div className="p-3 sm:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-8 bg-slate-50 min-h-screen w-full box-border overflow-x-hidden">
      <div className="border-b border-slate-200 pb-4 sm:pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <ThermometerSnowflake className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
            <span>Doctor Embryo Thaw / Warm / Withdrawal Workflow</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
            Search by <strong className="text-slate-900">Registration ID</strong>, <strong className="text-slate-900">Mobile Phone</strong>, or <strong className="text-slate-900">Patient Name</strong>
          </p>
        </div>

        <button
          onClick={() => loadPatients('')}
          className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 transition-all self-start md:self-auto shadow-xs"
        >
          <RefreshCw className="w-4 h-4 text-emerald-600" />
          <span>Reload All Patients</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Box */}
      <form onSubmit={handleSearchPatient} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full max-w-full overflow-hidden box-border">
        <div className="relative flex-1 w-full min-w-0">
          <input
            type="text"
            value={patientIdQuery}
            onChange={handleInputChange}
            placeholder="Search by Reg ID (e.g. IVF-2026-000001), Mobile Phone, or Patient Name..."
            className="w-full max-w-full min-w-0 box-border bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-medium"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
        </div>

        <button
          type="submit"
          disabled={loadingPatient}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 shrink-0 transition-all disabled:opacity-50"
        >
          {loadingPatient ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span>Search Patient Records</span>
          )}
        </button>
      </form>

      {/* Patient Selection Directory Cards */}
      {searchResults.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              <span>Select Patient Record to Manage Stored Straws ({searchResults.length} Patients Available):</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[360px] overflow-y-auto pr-1">
            {searchResults.map((item) => {
              const isSelected = patient?.id === item.id;
              const freezingDateStr = formatDateDDMMYYYY(item.freezingDate || item.batches?.[0]?.storageDate);

              const activeStrawsCount = item.batches?.reduce((acc: number, b: any) => {
                return acc + (b.straws?.filter((s: any) => s.status === 'OCCUPIED').length || 0);
              }, 0) || 0;

              return (
                <div
                  key={item.id}
                  onClick={() => selectPatientRecord(item.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 shadow-xs ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 hover:bg-emerald-50/40 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-sm truncate">{item.fullName}</div>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded border border-emerald-300">
                      {item.patientId}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-600 font-medium">
                      <span>Partner: {item.partnerName || 'N/A'}</span>
                      <span className="font-mono">{item.phone || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono text-slate-500">Freezing: {freezingDateStr}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-950 font-bold text-[10px] rounded border border-amber-300">
                        {activeStrawsCount} Active Straw(s)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Patient Straw Thaw Workflow */}
      {patient && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Active Batches & Straw Selector */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-700">{patient.patientId}</span>
                  <h2 className="text-lg font-bold text-slate-900">{patient.fullName}</h2>
                  <div className="text-xs text-slate-600 font-medium mt-0.5">
                    Partner: {patient.partnerName || 'N/A'} • Mobile: {patient.phone || 'N/A'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-amber-950 font-mono font-bold px-2.5 py-1 bg-amber-100 rounded-lg border border-amber-300 inline-block">
                    Freezing Date: {formatDateDDMMYYYY(patient.freezingDate)}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>Select Active Straw(s) for Thawing / Warming:</span>
                  </span>
                </div>

                {patient.batches?.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 border border-slate-200">No active storage batches for this patient.</div>
                ) : (
                  patient.batches.map((batch: any) => {
                    const activeStraws = batch.straws?.filter((s: any) => s.status === 'OCCUPIED') || [];
                    const thawedStraws = batch.straws?.filter((s: any) => s.status === 'THAWED' || s.status === 'VACANT') || [];

                    return (
                      <div key={batch.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 shadow-xs">
                        <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                          <span className="font-mono font-bold text-emerald-800">Batch ID: {batch.batchId}</span>
                          <span className="text-slate-600 font-medium">Date: {new Date(batch.storageDate).toISOString().split('T')[0]}</span>
                        </div>

                        {/* Active Selectable Straws */}
                        {activeStraws.length === 0 ? (
                          <div className="p-3 bg-emerald-50 rounded-xl text-xs font-bold text-emerald-900 border border-emerald-200 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>All straws in this batch have already been thawed / withdrawn.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {activeStraws.map((straw: any) => {
                              const isSelected = selectedStrawIds.includes(straw.id);
                              const locCode = straw.visoTube?.locationCode || batch.visoTube?.locationCode || straw.locationCode || '';
                              const parsedLoc = parseLocationCode(locCode);

                              return (
                                <div
                                  key={straw.id}
                                  onClick={() => toggleStrawSelection(straw.id)}
                                  className={`p-3.5 rounded-xl border transition-all space-y-2 cursor-pointer ${
                                    isSelected
                                      ? 'bg-emerald-100/90 border-emerald-500 ring-2 ring-emerald-500/30 shadow-sm'
                                      : 'bg-white border-slate-200 hover:border-emerald-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-xs font-bold">
                                    <span className="font-mono text-slate-900">{straw.strawId}</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold">
                                      AVAILABLE ({straw.status})
                                    </span>
                                  </div>

                                  <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                                    <span className={`px-2 py-0.5 rounded border text-[10px] ${getStrawColorBadgeClass(straw.color)}`}>
                                      Straw Color: {straw.color || 'Pink'}
                                    </span>
                                    <span className="font-bold text-slate-800 font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                      {straw.embryos?.length || 2} Embryos
                                    </span>
                                  </div>

                                  {/* Physical Storage Location Badge */}
                                  <div className="pt-2 border-t border-slate-100 flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div className="w-full">
                                      <span className="text-[10px] text-slate-500 font-semibold uppercase block leading-tight">Physical Storage Location:</span>
                                      {locCode ? (
                                        <span className="font-mono font-bold text-[11px] text-slate-900 leading-snug">{parsedLoc.formatted}</span>
                                      ) : (
                                        <div className="flex items-center gap-1.5 text-amber-800 font-mono text-[11px] font-bold mt-0.5 animate-pulse">
                                          <span className="w-3 h-3 border-2 border-amber-600/40 border-t-amber-600 rounded-full animate-spin shrink-0" />
                                          <span>Resolving Physical Location...</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Thawed / Withdrawn Straws Archive */}
                        {thawedStraws.length > 0 && (
                          <div className="pt-3 border-t border-slate-200 space-y-2">
                            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                              <span>Thawed / Withdrawn Straws Archive ({thawedStraws.length}):</span>
                              <span className="text-[10px] text-slate-500 font-mono font-normal">(Non-Selectable)</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {thawedStraws.map((straw: any) => {
                                const locCode = straw.visoTube?.locationCode || batch.visoTube?.locationCode || straw.locationCode || '';
                                const parsedLoc = parseLocationCode(locCode);
                                return (
                                  <div key={straw.id} className="p-3 bg-slate-100/90 rounded-xl border border-slate-200 opacity-80 space-y-1">
                                    <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-700">
                                      <span>{straw.strawId}</span>
                                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded text-[9px] uppercase font-sans font-bold">
                                        THAWED / WITHDRAWN
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-600 font-mono">
                                      {parsedLoc.formatted}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Thaw History Log Table */}
            {thawHistory.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Previous Thaw History for {patient.fullName}:</span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 px-3">Straw ID</th>
                        <th className="py-2 px-3">Thaw Date</th>
                        <th className="py-2 px-3">Doctor</th>
                        <th className="py-2 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {thawHistory.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{h.straw?.strawId || h.strawId}</td>
                          <td className="py-2 px-3 text-slate-600">{new Date(h.thawDate).toLocaleString()}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{h.doctorName}</td>
                          <td className="py-2 px-3 text-slate-500">{h.doctorNotes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Execution Form */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 self-start">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ThermometerSnowflake className="w-5 h-5 text-emerald-600" />
              <span>Confirm Thaw Operation</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-medium text-slate-700">
                Selected Straws: <strong className="text-emerald-700 font-bold">{selectedStrawIds.length} straw(s)</strong>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Embryologist / Doctor Notes</label>
                <textarea
                  rows={3}
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter clinical notes for thaw procedure..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <button
                type="button"
                onClick={handleExecuteThaw}
                disabled={selectedStrawIds.length === 0 || thawing}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {thawing ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Execute Thaw & Liberate Capacity</span>
                    <MoveRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
