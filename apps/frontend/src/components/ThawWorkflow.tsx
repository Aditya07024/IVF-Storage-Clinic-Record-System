import React, { useState } from 'react';
import { ThermometerSnowflake, Search, CheckCircle2, ShieldAlert, AlertTriangle, Layers, MoveRight, User, Calendar, Phone } from 'lucide-react';
import { apiRequest } from '../api/client';

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

  const handleSearchPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientIdQuery.trim()) return;

    setLoadingPatient(true);
    setError(null);
    setSuccessMsg(null);
    setPatient(null);
    setSearchResults([]);
    setSelectedStrawIds([]);

    try {
      const searchRes = await apiRequest(`/api/patients?q=${encodeURIComponent(patientIdQuery.trim())}`);
      if (searchRes.success && searchRes.patients.length > 0) {
        if (searchRes.patients.length === 1) {
          // Single match -> load directly
          selectPatientRecord(searchRes.patients[0].id);
        } else {
          // Multiple accounts match -> show selection list with Freezing Dates
          setSearchResults(searchRes.patients);
        }
      } else {
        setError('No patient found matching provided Reg No (ID), Mobile, or Name.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search patients.');
    } finally {
      setLoadingPatient(false);
    }
  };

  const selectPatientRecord = async (id: string) => {
    setLoadingPatient(true);
    setError(null);
    try {
      const detailsRes = await apiRequest(`/api/patients/${id}`);
      if (detailsRes.success) {
        setPatient(detailsRes.patient);
        setSearchResults([]);
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

  const handleExecuteThaw = async () => {
    if (selectedStrawIds.length === 0) {
      setError('Please select at least one straw to thaw/warm.');
      return;
    }

    setThawing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest('/api/thaw', {
        method: 'POST',
        body: JSON.stringify({
          strawIds: selectedStrawIds,
          doctorNotes: doctorNotes.trim() || undefined,
        }),
      });

      if (res.success) {
        setSuccessMsg(res.message);
        setSelectedStrawIds([]);
        setDoctorNotes('');
        if (patient) {
          const detailsRes = await apiRequest(`/api/patients/${patient.id}`);
          if (detailsRes.success) setPatient(detailsRes.patient);
          fetchThawHistory(patient.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Thaw/withdrawal operation failed.');
    } finally {
      setThawing(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <ThermometerSnowflake className="w-7 h-7 text-emerald-600" />
          <span>Doctor Embryo Thaw / Warm / Withdrawal Workflow</span>
        </h1>
        <p className="text-sm text-slate-600 mt-1 font-medium">
          Search by <strong className="text-slate-900">Registration No (ID)</strong>, <strong className="text-slate-900">Mobile Phone</strong>, or <strong className="text-slate-900">Patient Name</strong>
        </p>
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

      {/* Search Patient Box */}
      <form onSubmit={handleSearchPatient} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={patientIdQuery}
            onChange={(e) => setPatientIdQuery(e.target.value)}
            placeholder="Search by Reg No (ID), Mobile Phone, or Patient Name..."
            required
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
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

      {/* Multiple Matching Accounts Choice List */}
      {searchResults.length > 1 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Multiple Accounts Match Query ({searchResults.length} Accounts Found) — Select Intended Account by Freezing Date:</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.map((item) => {
              const freezingDateStr = item.freezingDate || item.batches?.[0]?.storageDate
                ? new Date(item.freezingDate || item.batches[0].storageDate).toISOString().split('T')[0]
                : 'Not Specified';

              return (
                <div
                  key={item.id}
                  onClick={() => selectPatientRecord(item.id)}
                  className="p-5 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all cursor-pointer space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900 text-base">{item.fullName}</div>
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-900 rounded-md border border-emerald-300">
                      Reg No: {item.patientId}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-amber-100 text-amber-950 font-bold font-mono rounded-lg border border-amber-300">
                        Freezing Date: {freezingDateStr}
                      </span>
                    </div>

                    {item.partnerName && (
                      <div className="text-slate-600 font-medium">Partner: {item.partnerName}</div>
                    )}
                    {item.phone && (
                      <div className="text-slate-600 font-mono">Mobile: {item.phone}</div>
                    )}
                  </div>

                  <div className="text-[11px] font-bold text-emerald-700 flex items-center justify-between pt-1">
                    <span>Click to view stored straws</span>
                    <MoveRight className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Patient Straw Selection Screen */}
      {patient && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Active Batches & Straw Selector */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs font-mono font-bold text-emerald-700">{patient.patientId}</span>
                  <h2 className="text-lg font-bold text-slate-900">{patient.fullName}</h2>
                  <div className="text-xs text-amber-900 font-mono font-bold mt-1">
                    Freezing Date: {patient.freezingDate ? new Date(patient.freezingDate).toISOString().split('T')[0] : 'N/A'}
                  </div>
                </div>
                <span className="text-xs text-slate-600 font-semibold">Partner: {patient.partnerName || 'N/A'}</span>
              </div>

              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>Select Straw(s) for Thawing / Warming (No sequential restriction enforced):</span>
                </div>

                {patient.batches?.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-500 border border-slate-200">No active storage batches.</div>
                ) : (
                  patient.batches.map((batch: any) => (
                    <div key={batch.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-emerald-800">Batch: {batch.batchId}</span>
                        <span className="text-slate-600 font-medium">Freezing Date: {new Date(batch.storageDate).toISOString().split('T')[0]}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {batch.straws?.map((straw: any) => {
                          const isSelected = selectedStrawIds.includes(straw.id);
                          const isThawed = straw.status === 'THAWED';

                          return (
                            <div
                              key={straw.id}
                              onClick={() => !isThawed && toggleStrawSelection(straw.id)}
                              className={`p-3.5 rounded-xl border transition-all ${
                                isThawed
                                  ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-emerald-100/90 border-emerald-500 ring-2 ring-emerald-500/30 cursor-pointer shadow-sm'
                                  : 'bg-white border-slate-200 hover:border-emerald-300 cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="font-mono text-slate-900">{straw.strawId}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] ${isThawed ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}`}>
                                  {straw.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                                <span>Color: {straw.color}</span>
                                <span>{straw.embryos?.length || 0} Embryos</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Execution Form */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 self-start">
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
