import React, { useState, useEffect } from 'react';
import { UserPlus, Save, Search, CheckCircle2, ShieldAlert, Sparkles, Layers, Info, UserCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client';

interface PatientFormProps {
  onSuccess: (patient: any) => void;
}

export const PatientForm: React.FC<PatientFormProps> = ({ onSuccess }) => {
  // Mode: 'new' | 'existing'
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');

  // Existing Patient Search States
  const [existingSearchQuery, setExistingSearchQuery] = useState('');
  const [existingSearchResults, setExistingSearchResults] = useState<any[]>([]);
  const [searchingExisting, setSearchingExisting] = useState(false);
  const [selectedExistingPatient, setSelectedExistingPatient] = useState<any | null>(null);

  // Form Fields
  const [customPatientId, setCustomPatientId] = useState('');
  const [fullName, setFullName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [deDate, setDeDate] = useState('');
  const [freezingDate, setFreezingDate] = useState(new Date().toISOString().split('T')[0]);
  const [thawDate, setThawDate] = useState('');
  const [comments, setComments] = useState('');

  // Storage Allocation State
  const [assignStorageEnabled, setAssignStorageEnabled] = useState(true);
  const [embryoCount, setEmbryoCount] = useState(2);
  const [storageDate, setStorageDate] = useState(new Date().toISOString().split('T')[0]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [selectedVisoTubeId, setSelectedVisoTubeId] = useState<string>('');
  const [selectedLocationCode, setSelectedLocationCode] = useState<string>('');
  const [strawColors, setStrawColors] = useState<string[]>(['Pink']);

  const [loading, setLoading] = useState(false);
  const [searchingStorage, setSearchingStorage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Existing Patient Search
  const handleSearchExisting = async (q: string) => {
    setExistingSearchQuery(q);
    if (!q.trim()) {
      setExistingSearchResults([]);
      return;
    }
    setSearchingExisting(true);
    try {
      const res = await apiRequest(`/api/patients?q=${encodeURIComponent(q.trim())}`);
      if (res.success) {
        setExistingSearchResults(res.patients);
      }
    } catch (err: any) {
      console.error('Failed to search existing patients:', err);
    } finally {
      setSearchingExisting(false);
    }
  };

  // Select Existing Patient & Auto-Fill Fields
  const handleSelectExistingPatient = (p: any) => {
    setSelectedExistingPatient(p);
    setCustomPatientId(p.patientId || '');
    setFullName(p.fullName || '');
    setPartnerName(p.partnerName || '');
    setPhone(p.phone || '');
    setFreezingDate(new Date().toISOString().split('T')[0]);
    setStorageDate(new Date().toISOString().split('T')[0]);
    setExistingSearchResults([]);
  };

  // Clear Selected Existing Patient
  const handleClearSelectedExisting = () => {
    setSelectedExistingPatient(null);
    setCustomPatientId('');
    setFullName('');
    setPartnerName('');
    setPhone('');
    setExistingSearchQuery('');
  };

  // Search Empty Storage Recommendation
  const handleFindStorage = async () => {
    setError(null);
    setSearchingStorage(true);
    try {
      const res = await apiRequest('/api/storage/find-empty', {
        method: 'POST',
        body: JSON.stringify({
          patientId: selectedExistingPatient ? selectedExistingPatient.id : 'NEW_PATIENT',
          storageDate,
          embryoCount: Number(embryoCount),
        }),
      });

      if (res.success) {
        setRecommendation(res);
        if (res.primaryRecommendation) {
          setSelectedVisoTubeId(res.primaryRecommendation.visoTubeId);
          setSelectedLocationCode(res.primaryRecommendation.locationCode);
        }
        const requiredStraws = res.requiredStraws || 1;
        const initialColors = Array(requiredStraws).fill('Pink');
        setStrawColors(initialColors);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to calculate storage recommendation.');
    } finally {
      setSearchingStorage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let targetPatient = selectedExistingPatient;

      if (!targetPatient) {
        // Create new patient record
        const patientRes = await apiRequest('/api/patients', {
          method: 'POST',
          body: JSON.stringify({
            patientId: customPatientId.trim() || undefined,
            fullName,
            partnerName: partnerName || undefined,
            phone: phone || undefined,
            visitDate: visitDate || undefined,
            deDate: deDate || undefined,
            freezingDate: freezingDate || undefined,
            thawDate: thawDate || undefined,
            comments: comments || undefined,
          }),
        });
        targetPatient = patientRes.patient;
      } else {
        // Optionally update existing patient fields if modified
        await apiRequest(`/api/patients/${targetPatient.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            fullName: fullName.trim(),
            partnerName: partnerName ? partnerName.trim() : undefined,
            phone: phone ? phone.trim() : undefined,
            freezingDate: freezingDate || undefined,
            comments: comments ? comments.trim() : undefined,
          }),
        });
      }

      if (assignStorageEnabled && selectedVisoTubeId) {
        await apiRequest('/api/storage/assign', {
          method: 'POST',
          body: JSON.stringify({
            patientId: targetPatient.id,
            storageDate,
            embryoCount: Number(embryoCount),
            visoTubeId: selectedVisoTubeId,
            strawColors,
            notes: comments || undefined,
          }),
        });
      }

      // Re-fetch updated patient details to return
      const fullRes = await apiRequest(`/api/patients/${targetPatient.id}`);
      onSuccess(fullRes.patient || targetPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to save patient record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-600">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Embryo Freezing & Storage Allocation</h1>
            <p className="text-sm text-slate-600 font-medium">
              Register new patient OR allocate a new embryo freezing batch for an existing patient
            </p>
          </div>
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex items-center bg-slate-200 p-1 rounded-2xl border border-slate-300">
          <button
            type="button"
            onClick={() => {
              setFormMode('new');
              handleClearSelectedExisting();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              formMode === 'new'
                ? 'bg-white text-emerald-950 shadow-sm border border-slate-200'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            🆕 New Patient
          </button>
          <button
            type="button"
            onClick={() => setFormMode('existing')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              formMode === 'existing'
                ? 'bg-white text-emerald-950 shadow-sm border border-slate-200'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            🔄 Existing Patient (New Batch)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Existing Patient Search Panel */}
      {formMode === 'existing' && !selectedExistingPatient && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600" />
              <span>Search Existing Patient by Reg No (ID), Mobile, or Name:</span>
            </h2>
          </div>

          <div className="relative">
            <input
              type="text"
              value={existingSearchQuery}
              onChange={(e) => handleSearchExisting(e.target.value)}
              placeholder="Type Reg No (e.g. IVF-2026-000001), Mobile, or Patient Name..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>

          {/* Search Results Choice List */}
          {searchingExisting ? (
            <div className="text-xs text-emerald-600 font-semibold text-center py-4">
              Searching existing patient database...
            </div>
          ) : existingSearchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {existingSearchResults.map((p) => {
                const freezingDateStr = p.freezingDate || p.batches?.[0]?.storageDate
                  ? new Date(p.freezingDate || p.batches[0].storageDate).toISOString().split('T')[0]
                  : 'Not Specified';

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectExistingPatient(p)}
                    className="p-4 bg-slate-50 hover:bg-emerald-50/60 rounded-2xl border border-slate-200 hover:border-emerald-400 transition-all cursor-pointer space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{p.fullName}</span>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded border border-emerald-300">
                        {p.patientId}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="text-slate-600">
                        <span className="font-semibold text-slate-800">Freezing Date:</span>{' '}
                        <strong className="text-emerald-950 font-mono">{freezingDateStr}</strong>
                      </div>
                      {p.phone && <div className="text-slate-500 font-mono">Mobile: {p.phone}</div>}
                    </div>

                    <div className="text-[11px] font-bold text-emerald-700 pt-1 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Click to select for new embryo batch</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : existingSearchQuery.trim() ? (
            <div className="text-xs text-slate-500 text-center py-4">
              No matching existing patient records found.
            </div>
          ) : null}
        </div>
      )}

      {/* Selected Existing Patient Highlight Banner */}
      {selectedExistingPatient && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between text-emerald-950 text-xs shadow-sm">
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-sm text-slate-900">
                Existing Patient Selected: {selectedExistingPatient.fullName}
              </div>
              <div className="text-slate-600 font-mono font-bold">
                Reg No: {selectedExistingPatient.patientId} • Previous Batches: {selectedExistingPatient.batches?.length || 0}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearSelectedExisting}
            className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-xl border border-slate-300 shadow-xs"
          >
            Change Patient
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Clinical Patient Details */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
            <span>Patient & Clinical Details</span>
            {selectedExistingPatient && (
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                EXISTING PATIENT RECORD
              </span>
            )}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Registration No / Patient ID</span>
                <span className="text-[10px] text-slate-500 font-normal lowercase">(Provided by Doctor, e.g. IVF-2026-000001)</span>
              </label>
              <input
                type="text"
                value={customPatientId}
                onChange={(e) => setCustomPatientId(e.target.value)}
                readOnly={!!selectedExistingPatient}
                placeholder="e.g. IVF-2026-000001"
                className={`w-full border rounded-xl px-4 py-3 text-sm font-mono font-bold focus:outline-none ${
                  selectedExistingPatient
                    ? 'bg-slate-100 text-slate-700 border-slate-300 cursor-not-allowed'
                    : 'bg-slate-50 text-slate-900 border-slate-300 focus:border-emerald-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Patient Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Eleanor Vance"
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Partner Name
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="e.g. Thomas Vance"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Mobile Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 555 0192"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Visit Date
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                New Embryo Freezing Date *
              </label>
              <input
                type="date"
                value={freezingDate}
                onChange={(e) => {
                  setFreezingDate(e.target.value);
                  setStorageDate(e.target.value);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>DE Date</span>
                <span className="text-[10px] text-slate-500 font-normal lowercase">(Donor Egg / Diagnostic Date)</span>
              </label>
              <input
                type="date"
                value={deDate}
                onChange={(e) => setDeDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Storage Allocation Engine */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Cryo Physical Storage Allocation</span>
            </h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={assignStorageEnabled}
                onChange={(e) => setAssignStorageEnabled(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className="text-xs font-bold text-slate-700">Allocate Storage Slot Now</span>
            </label>
          </div>

          {assignStorageEnabled && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Embryo Count for New Freezing Batch *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={embryoCount}
                    onChange={(e) => setEmbryoCount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Strict Limit: Max 2 embryos per straw. ({Math.ceil(embryoCount / 2)} straw(s) required)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Storage Cycle Date
                  </label>
                  <input
                    type="date"
                    value={storageDate}
                    onChange={(e) => setStorageDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Recommendation Generator Trigger */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleFindStorage}
                  disabled={searchingStorage}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {searchingStorage ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Calculate Optimal Storage Location Recommendation</span>
                    </>
                  )}
                </button>
              </div>

              {/* Recommendation Results Card */}
              {recommendation && recommendation.primaryRecommendation && (
                <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-3">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Recommended Physical Storage Location</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-900 px-2.5 py-1 rounded-full border border-emerald-300">
                      {recommendation.requiredStraws} Straw(s) Required
                    </span>
                  </div>

                  {/* Visual Location Breakdown Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">1. Can</div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {recommendation.primaryRecommendation.breakdown?.can || 'Can 01'}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">2. Canister</div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {recommendation.primaryRecommendation.breakdown?.canister || 'Canister 06'}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">3. Level</div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">
                        {recommendation.primaryRecommendation.breakdown?.level || 'Level 1'}
                      </div>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">4. Viso Tube</div>
                      <div className="text-xs font-bold text-emerald-700 mt-0.5">
                        {recommendation.primaryRecommendation.breakdown?.tube || 'Viso Tube 08'}
                      </div>
                    </div>
                  </div>

                  {/* Straw Color Selection */}
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-slate-800">
                      Specify Visual Straw Identification Tag Color:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {strawColors.map((color, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-xs font-mono font-bold text-slate-500">Straw #{idx + 1}:</span>
                          <select
                            value={color}
                            onChange={(e) => {
                              const updated = [...strawColors];
                              updated[idx] = e.target.value;
                              setStrawColors(updated);
                            }}
                            className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 flex-1"
                          >
                            {['Pink', 'Grey', 'Red', 'Black', 'Green', 'Rust', 'Blue', 'Purple', 'Yellow', 'Orange', 'Skyblue'].map((c) => (
                              <option key={c} value={c}>
                                {c} Tag
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form Submission Controls */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center gap-2 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>
                  {selectedExistingPatient
                    ? `Save New Embryo Batch for ${selectedExistingPatient.fullName}`
                    : 'Save & Allocate Embryo Storage Record'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
