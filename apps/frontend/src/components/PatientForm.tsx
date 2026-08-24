import React, { useState, useEffect } from 'react';
import { UserPlus, Save, Search, CheckCircle2, ShieldAlert, Sparkles, Layers, Info, UserCheck, AlertTriangle, RefreshCw, Plus, Minus, Flame, Snowflake, X } from 'lucide-react';
import { apiRequest, formatDateDDMMYYYY } from '../api/client';

export const VISO_TUBE_COLOR_NAMES: Record<number, string> = {
  1: 'Pink',
  2: 'Grey',
  3: 'Red',
  4: 'Black',
  5: 'Green',
  6: 'Rust',
  7: 'Blue',
  8: 'Purple',
  9: 'Yellow',
  10: 'Orange',
  11: 'Skyblue',
};

export const VISO_TUBE_STYLE_MAP: Record<number, { name: string; bg: string; dotHex: string }> = {
  1: { name: 'Pink', bg: 'bg-pink-100 text-pink-900 border-pink-400 font-bold', dotHex: '#ec4899' },
  2: { name: 'Grey', bg: 'bg-slate-200 text-slate-900 border-slate-400 font-bold', dotHex: '#6b7280' },
  3: { name: 'Red', bg: 'bg-rose-100 text-rose-900 border-rose-400 font-bold', dotHex: '#ef4444' },
  4: { name: 'Black', bg: 'bg-slate-900 text-white border-slate-700 font-bold', dotHex: '#0f172a' },
  5: { name: 'Green', bg: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold', dotHex: '#10b981' },
  6: { name: 'Rust', bg: 'bg-amber-100 text-amber-950 border-amber-500 font-bold', dotHex: '#c2410c' },
  7: { name: 'Blue', bg: 'bg-blue-100 text-blue-900 border-blue-400 font-bold', dotHex: '#3b82f6' },
  8: { name: 'Purple', bg: 'bg-purple-100 text-purple-900 border-purple-400 font-bold', dotHex: '#a855f7' },
  9: { name: 'Yellow', bg: 'bg-yellow-100 text-yellow-950 border-yellow-400 font-bold', dotHex: '#eab308' },
  10: { name: 'Orange', bg: 'bg-orange-100 text-orange-950 border-orange-400 font-bold', dotHex: '#f97316' },
  11: { name: 'Skyblue', bg: 'bg-sky-100 text-sky-900 border-sky-400 font-bold', dotHex: '#0ea5e9' },
};

export function getVisoTubeStyle(tubeStr?: string, locCode?: string) {
  let tubeNum = 1;
  if (locCode) {
    const match = locCode.match(/-V(\d+)$/i);
    if (match) tubeNum = parseInt(match[1], 10);
  } else if (tubeStr) {
    const match = tubeStr.match(/(?:Tube|V|Viso Tube)\s*(\d+)/i);
    if (match) tubeNum = parseInt(match[1], 10);
  }
  return VISO_TUBE_STYLE_MAP[tubeNum] || VISO_TUBE_STYLE_MAP[1];
}

function parseLocationCode(code: string) {
  if (!code) return { raw: '', formatted: '' };
  const match = code.match(/CAN-?(\d+)-CANISTER(\d+)-L(\d+)-G(\d+)-V(\d+)/i);
  if (!match) return { raw: code, formatted: code };
  const canNum = match[1].padStart(2, '0');
  const canisterNum = match[2].padStart(2, '0');
  const levelNum = parseInt(match[3], 10);
  const levelName = levelNum === 1 ? 'Level 1 (Bottom)' : levelNum === 2 ? 'Level 2 (Top)' : `Level ${levelNum}`;
  const tubeNumInt = parseInt(match[5], 10);
  const tubeNumPadded = match[5].padStart(2, '0');
  const colorName = VISO_TUBE_COLOR_NAMES[tubeNumInt] || 'Standard';

  return {
    raw: code,
    can: `Can ${canNum}`,
    canister: `Canister ${canisterNum}`,
    level: levelName,
    tube: `${colorName} Viso Tube (Tube ${tubeNumPadded})`,
    tubeColor: colorName,
    formatted: `Can ${canNum} • Canister ${canisterNum} • ${levelName} • ${colorName} Viso Tube (V${tubeNumPadded})`,
  };
}

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

  // Thaw Modal States
  const [thawModalStraw, setThawModalStraw] = useState<any | null>(null);
  const [thawDoctorNotes, setThawDoctorNotes] = useState<string>('Thaw executed directly from patient form.');
  const [executingThaw, setExecutingThaw] = useState(false);
  const [thawSuccessMsg, setThawSuccessMsg] = useState<string | null>(null);
  const [saveSuccessDetails, setSaveSuccessDetails] = useState<any | null>(null);

  // Form Fields
  const [customPatientId, setCustomPatientId] = useState('');
  const [fullName, setFullName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [partnerAge, setPartnerAge] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [deDate, setDeDate] = useState('');
  const [freezingDate, setFreezingDate] = useState(new Date().toISOString().split('T')[0]);
  const [thawDate, setThawDate] = useState('');
  const [comments, setComments] = useState('');

  // Storage Allocation State
  const [assignStorageEnabled, setAssignStorageEnabled] = useState(false);
  const [allocationMode, setAllocationMode] = useState<'recommended' | 'manual'>('recommended');
  const [embryoCount, setEmbryoCount] = useState(2);
  const [storageDate, setStorageDate] = useState(new Date().toISOString().split('T')[0]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [selectedVisoTubeId, setSelectedVisoTubeId] = useState<string>('');
  const [selectedLocationCode, setSelectedLocationCode] = useState<string>('');
  const [strawColors, setStrawColors] = useState<string[]>(['Pink']);

  // Manual Storage Selection State
  const [hierarchyCans, setHierarchyCans] = useState<any[]>([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [manualCanCode, setManualCanCode] = useState<string>('CAN-01');
  const [manualCanisterNum, setManualCanisterNum] = useState<number>(1);
  const [manualLevelNum, setManualLevelNum] = useState<number>(1);

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
  const handleSelectExistingPatient = async (p: any) => {
    setSelectedExistingPatient(p);
    setCustomPatientId(p.patientId || '');
    setFullName(p.fullName || '');
    setPartnerName(p.partnerName || '');
    setPhone(p.phone || '');
    setPatientAge(p.patientAge || '');
    setPartnerAge(p.partnerAge || '');
    setDoctorName(p.doctorName || '');
    setFreezingDate(new Date().toISOString().split('T')[0]);
    setStorageDate(new Date().toISOString().split('T')[0]);
    setExistingSearchResults([]);
    setThawSuccessMsg(null);

    // Fetch full patient data with batches & straws for Thaw options
    try {
      const res = await apiRequest(`/api/patients/${p.id}`);
      if (res.success && res.patient) {
        setSelectedExistingPatient(res.patient);
      }
    } catch (err: any) {
      console.error('Failed to load patient detail batches:', err);
    }
  };

  // Execute Direct Thaw from Patient Form
  const handleExecuteThaw = async () => {
    if (!thawModalStraw || !selectedExistingPatient) return;
    setExecutingThaw(true);
    setThawSuccessMsg(null);
    try {
      const res = await apiRequest('/api/thaw', {
        method: 'POST',
        body: JSON.stringify({
          strawIds: [thawModalStraw.id],
          doctorNotes: thawDoctorNotes,
        }),
      });

      if (res.success) {
        setThawSuccessMsg(`Embryo Straw ${thawModalStraw.strawId} successfully thawed & physical storage slot freed!`);
        setThawModalStraw(null);

        // Refresh patient details to update active straws list
        const fullRes = await apiRequest(`/api/patients/${selectedExistingPatient.id}`);
        if (fullRes.success && fullRes.patient) {
          setSelectedExistingPatient(fullRes.patient);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to thaw straw.');
    } finally {
      setExecutingThaw(false);
    }
  };

  // Clear Selected Existing Patient
  const handleClearSelectedExisting = () => {
    setSelectedExistingPatient(null);
    setCustomPatientId('');
    setFullName('');
    setPartnerName('');
    setPhone('');
    setPatientAge('');
    setPartnerAge('');
    setDoctorName('');
    setExistingSearchQuery('');
  };

  // Fetch full storage hierarchy for manual selection
  const fetchHierarchy = async () => {
    if (hierarchyCans.length > 0) return;
    setLoadingHierarchy(true);
    try {
      const res = await apiRequest('/api/storage/hierarchy');
      if (res.success && res.cans) {
        setHierarchyCans(res.cans);
        // Default select first available tube
        const firstCan = res.cans[0];
        if (firstCan && firstCan.canisters[0]?.levels[0]?.goblets[0]?.visoTubes[0]) {
          const tube = firstCan.canisters[0].levels[0].goblets[0].visoTubes[0];
          setSelectedVisoTubeId(tube.id);
          setSelectedLocationCode(tube.locationCode);
        }
      }
    } catch (err: any) {
      console.error('Failed to load storage hierarchy:', err);
    } finally {
      setLoadingHierarchy(false);
    }
  };

  useEffect(() => {
    if (allocationMode === 'manual') {
      fetchHierarchy();
    }
  }, [allocationMode]);

  // Keep straw colors array in sync with required straws count
  useEffect(() => {
    const requiredStraws = Math.ceil(embryoCount / 2);
    setStrawColors(prev => {
      if (prev.length === requiredStraws) return prev;
      const next = Array(requiredStraws).fill('Pink');
      for (let i = 0; i < Math.min(prev.length, requiredStraws); i++) {
        next[i] = prev[i];
      }
      return next;
    });
  }, [embryoCount]);

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
            patientAge: patientAge || undefined,
            partnerAge: partnerAge || undefined,
            doctorName: doctorName || undefined,
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
            patientAge: patientAge ? patientAge.trim() : undefined,
            partnerAge: partnerAge ? partnerAge.trim() : undefined,
            doctorName: doctorName ? doctorName.trim() : undefined,
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

      // Re-fetch updated patient details
      const fullRes = await apiRequest(`/api/patients/${targetPatient.id}`);
      const updatedPatient = fullRes.patient || targetPatient;

      setSaveSuccessDetails({
        patientId: updatedPatient.patientId,
        fullName: updatedPatient.fullName,
        status: assignStorageEnabled ? 'ALLOCATED & OCCUPIED' : 'RECORD UPDATED',
        embryoCount: assignStorageEnabled ? Number(embryoCount) : 0,
        strawCount: assignStorageEnabled ? strawColors.length : 0,
        location: assignStorageEnabled ? selectedLocationCode : null,
        timestamp: new Date().toLocaleString(),
      });

      if (formMode === 'existing') {
        setSelectedExistingPatient(updatedPatient);
      }

      onSuccess(updatedPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to save patient record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-8 max-w-4xl mx-auto space-y-6 sm:space-y-8 bg-slate-50 min-h-screen w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-600 shrink-0">
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Embryo Freezing & Storage Allocation</h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Register new patient OR allocate a new embryo freezing batch for an existing patient
            </p>
          </div>
        </div>

        {/* Mode Toggle Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch bg-slate-200 p-1 rounded-2xl border border-slate-300 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setFormMode('new');
              handleClearSelectedExisting();
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-center ${
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
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-center ${
              formMode === 'existing'
                ? 'bg-white text-emerald-950 shadow-sm border border-slate-200'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            🔄 Existing Patient (New Batch)
          </button>
        </div>
      </div>

      {saveSuccessDetails && (
        <div className="p-5 bg-emerald-50 border-2 border-emerald-300 rounded-3xl space-y-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-emerald-950 font-bold text-base">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <span>Embryo Storage Record Saved & Allocated Successfully!</span>
            </div>
            <button
              onClick={() => setSaveSuccessDetails(null)}
              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-200/80 hover:bg-emerald-300/80 px-3 py-1 rounded-full transition-all"
            >
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-2xl border border-emerald-200 font-mono">
            <div>
              <span className="text-slate-500 font-sans block text-[10px] uppercase font-semibold">Patient:</span>
              <strong className="text-slate-900">{saveSuccessDetails.fullName} ({saveSuccessDetails.patientId})</strong>
            </div>
            <div>
              <span className="text-slate-500 font-sans block text-[10px] uppercase font-semibold">Storage Status:</span>
              <strong className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 inline-block font-bold">
                {saveSuccessDetails.status}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 font-sans block text-[10px] uppercase font-semibold">Straws / Embryos:</span>
              <strong className="text-slate-900">{saveSuccessDetails.strawCount} Straw(s) • {saveSuccessDetails.embryoCount} Embryos</strong>
            </div>
          </div>
          {saveSuccessDetails.location && (
            <div className="text-xs font-mono bg-emerald-950 text-emerald-100 p-3 rounded-xl border border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
              <span className="font-sans text-[11px] font-semibold uppercase text-emerald-300">Physical Storage Location:</span>
              <span className="font-bold">{parseLocationCode(saveSuccessDetails.location).formatted}</span>
            </div>
          )}
        </div>
      )}

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
                const freezingDateStr = formatDateDDMMYYYY(p.freezingDate || p.batches?.[0]?.storageDate);

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
              <div className="text-slate-600 font-mono font-bold flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                <span>Reg No: {selectedExistingPatient.patientId}</span>
                <span>•</span>
                <span>Total Batches Recorded: {selectedExistingPatient.batches?.length || 0}</span>
                {(() => {
                  const activeBatches = selectedExistingPatient.batches?.filter((b: any) =>
                    b.straws?.some((s: any) => s.status === 'OCCUPIED')
                  ).length || 0;
                  const activeStraws = selectedExistingPatient.batches?.reduce((acc: number, b: any) => {
                    return acc + (b.straws?.filter((s: any) => s.status === 'OCCUPIED').length || 0);
                  }, 0) || 0;
                  return (
                    <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px] border border-emerald-300 font-bold ml-1">
                      {activeBatches} Active Batch(es) • {activeStraws} Active Straw(s) in Storage
                    </span>
                  );
                })()}
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

      {thawSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-3 text-emerald-950 text-xs font-bold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{thawSuccessMsg}</span>
        </div>
      )}

      {/* ACTIVE STORED EMBRYOS & DIRECT THAW PANEL FOR EXISTING PATIENT */}
      {selectedExistingPatient && (() => {
        const activeStraws: any[] = [];
        if (selectedExistingPatient.batches) {
          selectedExistingPatient.batches.forEach((b: any) => {
            if (b.straws) {
              b.straws.forEach((s: any) => {
                if (s.status === 'OCCUPIED') {
                  activeStraws.push({ ...s, batchCode: b.batchId, storageDate: b.storageDate });
                }
              });
            }
          });
        }

        if (activeStraws.length === 0) {
          return (
            <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-600 font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Snowflake className="w-4 h-4 text-blue-500 shrink-0" />
                <span>No active frozen embryo straws currently in storage for {selectedExistingPatient.fullName}.</span>
              </div>
            </div>
          );
        }

        return (
          <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-2 text-rose-950 font-bold text-sm">
                <Flame className="w-5 h-5 text-rose-600" />
                <span>Active Stored Embryos ({activeStraws.length} Active Straws in Cryo Storage)</span>
              </div>
              <span className="text-[10px] text-rose-800 font-bold font-mono bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                Direct Thaw / Withdrawal Available Here
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeStraws.map((straw: any) => {
                const locCode = straw.visoTube?.locationCode || '';
                const parsedLoc = locCode ? parseLocationCode(locCode).formatted : '';
                const embryoCount = straw.embryos ? straw.embryos.length : 2;

                return (
                  <div key={straw.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-mono font-bold text-xs text-slate-900">{straw.strawId}</span>
                      <span className="text-[10px] font-bold font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded border border-emerald-300">
                        {embryoCount} Embryos ({straw.color} Tag)
                      </span>
                    </div>

                    {locCode ? (
                      <div className="text-xs font-bold text-slate-800 font-mono bg-white p-2.5 rounded-xl border border-slate-200">
                        {parsedLoc}
                      </div>
                    ) : (
                      <div className="text-xs font-mono font-bold text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2 animate-pulse">
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 border-2 border-amber-600/40 border-t-amber-600 rounded-full animate-spin shrink-0" />
                          <span>Resolving physical storage location...</span>
                        </div>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                          LOADING
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setThawModalStraw(straw);
                        setThawDoctorNotes(`Doctor requested direct thaw of straw ${straw.strawId} for ${selectedExistingPatient.fullName}.`);
                      }}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98"
                    >
                      <Flame className="w-4 h-4 text-amber-300" />
                      <span>Thaw / Withdraw This Straw Now</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Clinical Patient Details */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <span>Patient & Clinical Details</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const randomId = `IVF-2026-${Math.floor(100000 + Math.random() * 900000)}`;
                  setCustomPatientId(randomId);
                  setFullName('Sunita Verma');
                  setPartnerName('Deepak Verma');
                  setPhone('+91 98260 78901');
                  setPatientAge('32 Yrs');
                  setPartnerAge('35 Yrs');
                  setDoctorName('Dr. Ananya Sharma');
                  const today = new Date().toISOString().split('T')[0];
                  setVisitDate(today);
                  setFreezingDate(today);
                  setStorageDate(today);
                  setDeDate(today);
                  setComments('Demo patient allocation test. Grade A 5AA blastocysts.');
                }}
                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs rounded-xl border border-amber-300 shadow-2xs transition-all active:scale-95 flex items-center gap-1.5"
                title="Auto-fill sample patient data"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Auto-Fill Demo Data</span>
              </button>

              {selectedExistingPatient && (
                <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  EXISTING PATIENT RECORD
                </span>
              )}
            </div>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full max-w-full">
            <div className="md:col-span-2 min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Registration No / Patient ID
              </label>
              <input
                type="text"
                value={customPatientId}
                onChange={(e) => setCustomPatientId(e.target.value)}
                readOnly={!!selectedExistingPatient}
                placeholder="e.g. IVF-2026-000001"
                className={`w-full min-w-0 max-w-full h-11 box-border border rounded-xl px-4 text-sm font-mono font-bold focus:outline-none block ${
                  selectedExistingPatient
                    ? 'bg-slate-100 text-slate-700 border-slate-300 cursor-not-allowed'
                    : 'bg-slate-50 text-slate-900 border-slate-300 focus:border-emerald-500'
                }`}
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Patient Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sunita Verma"
                required
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-bold block"
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Patient Age
              </label>
              <input
                type="text"
                value={patientAge}
                onChange={(e) => setPatientAge(e.target.value)}
                placeholder="e.g. 32 Yrs"
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-medium block"
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Partner Name
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="e.g. Deepak Verma"
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 block"
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Partner Age
              </label>
              <input
                type="text"
                value={partnerAge}
                onChange={(e) => setPartnerAge(e.target.value)}
                placeholder="e.g. 35 Yrs"
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-medium block"
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Doctor Name / Attending Physician
              </label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. Ananya Sharma"
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-bold block"
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Mobile Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +91 98260 78901"
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500 block"
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Visit Date
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-mono block"
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                New Embryo Freezing Date *
              </label>
              <input
                type="date"
                value={freezingDate}
                onChange={(e) => {
                  setFreezingDate(e.target.value);
                  setStorageDate(e.target.value);
                }}
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-500 block"
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                DE Date (Donor Egg)
              </label>
              <input
                type="date"
                value={deDate}
                onChange={(e) => setDeDate(e.target.value)}
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-mono block"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex flex-wrap items-center justify-between gap-1">
                <span>Clinical Comments & Doctor Remarks</span>
                <span className="text-[10px] text-slate-500 font-normal lowercase">(Egg yield, embryo grade quality, special instructions)</span>
              </label>
              <textarea
                rows={5}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Write unlimited clinical comments, doctor instructions, embryo quality remarks, OCR notes, or detailed storage records here..."
                className="w-full max-w-full box-border bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-medium min-h-[140px] resize-y leading-relaxed block"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Storage Allocation Engine */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600 shrink-0" />
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
            <div className="space-y-4 sm:space-y-6 w-full">
              {/* Storage Method Toggle */}
              <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full">
                <button
                  type="button"
                  onClick={() => setAllocationMode('recommended')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    allocationMode === 'recommended'
                      ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Use Recommended Storage (Auto-Optimal)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAllocationMode('manual')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    allocationMode === 'manual'
                      ? 'bg-white text-emerald-950 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Choose Storage Location Manually</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Embryo Count for New Freezing Batch *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEmbryoCount(Math.max(1, embryoCount - 1))}
                      className="w-11 h-11 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-xl border border-rose-300 font-bold text-lg flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-xs"
                      title="Decrease Embryo Count"
                    >
                      <Minus className="w-4 h-4 text-rose-700 stroke-[2.5]" />
                    </button>

                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={embryoCount}
                      onChange={(e) => setEmbryoCount(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-center text-base font-bold font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                    />

                    <button
                      type="button"
                      onClick={() => setEmbryoCount(embryoCount + 1)}
                      className="w-11 h-11 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl border border-emerald-300 font-bold text-lg flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-xs"
                      title="Increase Embryo Count"
                    >
                      <Plus className="w-4 h-4 text-emerald-800" />
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1.5 block font-medium">
                    Strict Limit: Max 2 embryos per straw. (<strong className="text-emerald-700 font-bold">{Math.ceil(embryoCount / 2)} straw(s)</strong> required)
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

              {/* RECOMMENDED MODE UI */}
              {allocationMode === 'recommended' && (
                <div className="space-y-4">
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
                          <span>Calculate Optimal Storage Location Recommendation</span>
                        </>
                      )}
                    </button>
                  </div>

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

                        {(() => {
                          const tubeStyle = getVisoTubeStyle(
                            recommendation.primaryRecommendation.breakdown?.tube,
                            recommendation.primaryRecommendation.locationCode
                          );
                          return (
                            <div className={`p-2.5 rounded-xl border text-center shadow-xs transition-all ${tubeStyle.bg}`}>
                              <div className="text-[10px] font-bold uppercase opacity-90 flex items-center justify-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: tubeStyle.dotHex }} />
                                <span>4. Viso Tube</span>
                              </div>
                              <div className="text-xs font-black mt-0.5">
                                {recommendation.primaryRecommendation.breakdown?.tube || `Viso Tube ${tubeStyle.name}`}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MANUAL SELECTION MODE UI */}
              {allocationMode === 'manual' && (
                <div className="p-5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-200 pb-3">
                    <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
                      <Layers className="w-5 h-5 text-blue-600" />
                      <span>Manual Cryo Tank Location Selector</span>
                    </div>
                    {loadingHierarchy && (
                      <span className="text-[10px] text-blue-700 font-medium flex items-center gap-1">
                        <span className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-600 rounded-full animate-spin" />
                        Loading storage layout...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Select Can */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        1. Select Can *
                      </label>
                      <select
                        value={manualCanCode}
                        onChange={(e) => {
                          setManualCanCode(e.target.value);
                          const canObj = hierarchyCans.find(c => c.code === e.target.value);
                          if (canObj && canObj.canisters[0]?.levels[0]?.goblets[0]?.visoTubes[0]) {
                            const t = canObj.canisters[0].levels[0].goblets[0].visoTubes[0];
                            setSelectedVisoTubeId(t.id);
                            setSelectedLocationCode(t.locationCode);
                          }
                        }}
                        className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 shadow-xs"
                      >
                        {[1, 2, 3, 4, 5, 8, 10, 14].map(cNum => {
                          const code = `CAN-${cNum.toString().padStart(2, '0')}`;
                          return (
                            <option key={code} value={code}>
                              Can {cNum.toString().padStart(2, '0')}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Select Canister */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        2. Select Canister *
                      </label>
                      <select
                        value={manualCanisterNum}
                        onChange={(e) => setManualCanisterNum(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 shadow-xs"
                      >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(cn => (
                          <option key={cn} value={cn}>
                            Canister {cn.toString().padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Select Level */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        3. Select Level *
                      </label>
                      <select
                        value={manualLevelNum}
                        onChange={(e) => setManualLevelNum(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 shadow-xs"
                      >
                        <option value={1}>Level 1 (Bottom)</option>
                        <option value={2}>Level 2 (Top)</option>
                      </select>
                    </div>
                  </div>

                  {/* Select Viso Tube Dropdown */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      4. Select Specific Viso Tube (Available Space Only) *
                    </label>
                    {(() => {
                      const currentCanObj = hierarchyCans.find(c => c.code === manualCanCode);
                      const currentCanisterObj = currentCanObj?.canisters?.find((cn: any) => cn.canisterNumber === manualCanisterNum);
                      const currentLevelObj = currentCanisterObj?.levels?.find((l: any) => l.levelNumber === manualLevelNum);
                      const tubes: any[] = currentLevelObj?.goblets?.[0]?.visoTubes || [];
                      const requiredStrawsNeeded = Math.ceil(embryoCount / 2);

                      if (tubes.length === 0) {
                        return (
                          <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-500 italic font-medium">
                            Loading Viso Tubes for {manualCanCode} Canister {manualCanisterNum.toString().padStart(2, '0')} Level {manualLevelNum}...
                          </div>
                        );
                      }

                      // STRICT CAPACITY FILTER: Exclude full tubes or tubes with insufficient space
                      const availableTubes = tubes.filter((t: any) => {
                        const occupiedCount = t.straws ? t.straws.filter((s: any) => s.status === 'OCCUPIED').length : 0;
                        const remaining = 10 - occupiedCount;
                        return remaining >= requiredStrawsNeeded;
                      });

                      const fullTubesCount = tubes.length - availableTubes.length;

                      if (availableTubes.length === 0) {
                        return (
                          <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-center gap-2 shadow-xs">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Capacity Full: No Viso Tubes in this Level have {requiredStrawsNeeded} free straw slot(s). Please select another Level, Canister, or Can.</span>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-1.5">
                          <select
                            value={selectedVisoTubeId}
                            onChange={(e) => {
                              setSelectedVisoTubeId(e.target.value);
                              const found = availableTubes.find((t: any) => t.id === e.target.value);
                              if (found) setSelectedLocationCode(found.locationCode);
                            }}
                            className="w-full bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 shadow-xs font-mono"
                          >
                            {availableTubes.map((t: any) => {
                              const occupiedCount = t.straws ? t.straws.filter((s: any) => s.status === 'OCCUPIED').length : 0;
                              const remaining = 10 - occupiedCount;
                              const tubeInt = t.tubeNumber || parseInt(t.locationCode?.match(/-V(\d+)/i)?.[1] || '1', 10);
                              const tNum = tubeInt.toString().padStart(2, '0');
                              const colorName = VISO_TUBE_COLOR_NAMES[tubeInt] || 'Standard';
                              return (
                                <option key={t.id} value={t.id}>
                                  Viso Tube {tNum} ({colorName}) — {remaining} / 10 Straw Slots Free (Available)
                                </option>
                              );
                            })}
                          </select>
                          {fullTubesCount > 0 && (
                            <span className="text-[10px] text-slate-500 font-medium block">
                              🔒 Note: {fullTubesCount} full/insufficient Viso Tube(s) in this level are automatically hidden.
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Active Selected Location Display */}
                  {selectedLocationCode && (() => {
                    const parsedLoc = parseLocationCode(selectedLocationCode);
                    const tubeStyle = getVisoTubeStyle(undefined, selectedLocationCode);
                    return (
                      <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-xs">
                        <div className="text-xs font-bold text-slate-800">
                          Selected Destination Location:
                        </div>
                        <span className={`text-xs font-mono px-3 py-1 rounded-lg border flex items-center gap-1.5 shadow-2xs ${tubeStyle.bg}`}>
                          <span className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: tubeStyle.dotHex }} />
                          <span>{parsedLoc.formatted || selectedLocationCode}</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Straw Color Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>Specify Visual Straw Color Tags:</span>
                  <span className="text-[10px] text-slate-500 font-normal">({Math.ceil(embryoCount / 2)} Straw Tags Needed)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {strawColors.map((color, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-xs font-mono font-bold text-slate-500">Straw #{idx + 1}:</span>
                      <select
                        value={color}
                        onChange={(e) => {
                          const updated = [...strawColors];
                          updated[idx] = e.target.value;
                          setStrawColors(updated);
                        }}
                        className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 flex-1"
                      >
                        {['Pink', 'White', 'Blue', 'Purple', 'Yellow', 'Black'].map((c) => (
                          <option key={c} value={c}>
                            {c} Straw Tag
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

      {/* THAW CONFIRMATION MODAL */}
      {thawModalStraw && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-950 font-bold text-base">
                <Flame className="w-5 h-5 text-rose-600" />
                <span>Confirm Embryo Straw Thaw</span>
              </div>
              <button
                type="button"
                onClick={() => setThawModalStraw(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-xs text-rose-950 font-medium">
              <div>
                <strong className="text-slate-900">Straw ID:</strong>{' '}
                <span className="font-mono font-bold text-rose-900">{thawModalStraw.strawId}</span>
              </div>
              <div>
                <strong className="text-slate-900">Patient:</strong>{' '}
                <span className="font-bold">{selectedExistingPatient?.fullName}</span> ({selectedExistingPatient?.patientId})
              </div>
              <div>
                <strong className="text-slate-900">Location:</strong>{' '}
                {thawModalStraw.visoTube?.locationCode ? (
                  <span className="font-mono font-bold">{parseLocationCode(thawModalStraw.visoTube.locationCode).formatted}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-mono text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 animate-pulse text-[11px] font-bold">
                    <span className="w-3 h-3 border-2 border-amber-600/40 border-t-amber-600 rounded-full animate-spin shrink-0" />
                    <span>Resolving Physical Storage Location...</span>
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Doctor / Embryologist Thaw Remarks *
              </label>
              <textarea
                rows={3}
                value={thawDoctorNotes}
                onChange={(e) => setThawDoctorNotes(e.target.value)}
                placeholder="Enter thaw reason, clinical notes, or doctor instructions..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-xs text-slate-900 font-medium focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setThawModalStraw(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteThaw}
                disabled={executingThaw}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md disabled:opacity-50 transition-all"
              >
                {executingThaw ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Flame className="w-4 h-4 text-amber-300" />
                    <span>Confirm & Complete Thaw Execution</span>
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
