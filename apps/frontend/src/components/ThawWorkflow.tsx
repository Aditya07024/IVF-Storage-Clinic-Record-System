import React, { useState } from 'react';
import { ThermometerSnowflake, Search, CheckCircle2, ShieldAlert, AlertTriangle, Layers, MoveRight } from 'lucide-react';
import { apiRequest } from '../api/client';

export const ThawWorkflow: React.FC = () => {
  const [patientIdQuery, setPatientIdQuery] = useState('');
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
    setSelectedStrawIds([]);

    try {
      const searchRes = await apiRequest(`/api/patients?q=${encodeURIComponent(patientIdQuery.trim())}`);
      if (searchRes.success && searchRes.patients.length > 0) {
        const foundId = searchRes.patients[0].id;
        const detailsRes = await apiRequest(`/api/patients/${foundId}`);
        if (detailsRes.success) {
          setPatient(detailsRes.patient);
          fetchThawHistory(foundId);
        }
      } else {
        setError('No patient found with provided ID or name.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to find patient.');
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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <ThermometerSnowflake className="w-7 h-7 text-emerald-600" />
          <span>Doctor Embryo Thaw / Warm / Withdrawal Workflow</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Doctor-directed straw selection with non-sequential thaw freedom, physical capacity liberation, and 100% audit retention.
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
      <form onSubmit={handleSearchPatient} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={patientIdQuery}
            onChange={(e) => setPatientIdQuery(e.target.value)}
            placeholder="Enter Patient ID (e.g. IVF-2026-000001) or Full Name..."
            required
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        <button
          type="submit"
          disabled={loadingPatient}
          className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 shrink-0 transition-all disabled:opacity-50"
        >
          {loadingPatient ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span>Search Patient Records</span>
          )}
        </button>
      </form>

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
                </div>
                <span className="text-xs text-slate-500 font-semibold">Partner: {patient.partnerName || 'N/A'}</span>
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
                        <span className="text-slate-500 font-medium">Storage Date: {new Date(batch.storageDate).toLocaleDateString()}</span>
                        <span className="font-mono font-bold text-slate-900">Location: {batch.visoTube?.locationCode}</span>
                      </div>

                      <div className="space-y-2">
                        {batch.straws.map((straw: any) => {
                          const isSelected = selectedStrawIds.includes(straw.id);
                          const isVacant = straw.status === 'VACANT' || straw.status === 'THAWED';

                          return (
                            <div
                              key={straw.id}
                              onClick={() => !isVacant && toggleStrawSelection(straw.id)}
                              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between text-xs cursor-pointer ${
                                isVacant
                                  ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30'
                                  : 'bg-white border-slate-200 hover:border-emerald-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  disabled={isVacant}
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="w-4 h-4 rounded bg-white border-slate-300 text-emerald-600"
                                />
                                <div>
                                  <div className="font-mono font-bold text-emerald-900">Straw ID: {straw.strawId}</div>
                                  <div className="text-slate-500 text-[11px]">Color: {straw.color} • {straw.embryos?.length || 0} Embryo(s)</div>
                                </div>
                              </div>

                              <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${isVacant ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                                {straw.status}
                              </span>
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

          {/* Right Column: Execution Box & Audit History */}
          <div className="space-y-6">
            {/* Execute Thaw Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-emerald-800">
                Confirm Doctor Thaw Action
              </h3>

              <div className="text-xs text-slate-700 font-semibold">
                Selected Straws: <strong className="text-emerald-700 font-mono font-bold">{selectedStrawIds.length} straw(s)</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Doctor Notes / Procedure Observations
                </label>
                <textarea
                  rows={3}
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter doctor notes for this thaw event..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={handleExecuteThaw}
                disabled={selectedStrawIds.length === 0 || thawing}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {thawing ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ThermometerSnowflake className="w-4 h-4" />
                    <span>Execute Thaw & Free Capacity</span>
                  </>
                )}
              </button>
            </div>

            {/* Historical Thaw Audit Log for Patient */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Immutable Thaw History for {patient.fullName}
              </h3>

              {thawHistory.length === 0 ? (
                <div className="text-xs text-slate-500 py-2">No prior thaw records for this patient.</div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {thawHistory.map((h) => (
                    <div key={h.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-mono font-bold text-emerald-800">Straw: {h.straw?.strawId || 'N/A'}</span>
                        <span>{new Date(h.thawDate).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-800 font-medium text-[11px]">Original Location: {h.originalLocationCode}</div>
                      <div className="text-slate-500 text-[10px]">Doctor: {h.doctorName}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
