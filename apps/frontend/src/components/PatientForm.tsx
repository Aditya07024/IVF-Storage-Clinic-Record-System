import React, { useState } from 'react';
import { UserPlus, Save, Search, CheckCircle2, ShieldAlert, Sparkles, Layers, Info } from 'lucide-react';
import { apiRequest } from '../api/client';

interface PatientFormProps {
  onSuccess: (patient: any) => void;
}

export const PatientForm: React.FC<PatientFormProps> = ({ onSuccess }) => {
  const [fullName, setFullName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [deDate, setDeDate] = useState('');
  const [freezingDate, setFreezingDate] = useState('');
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

  // Search Empty Storage Recommendation
  const handleFindStorage = async () => {
    setError(null);
    setSearchingStorage(true);
    try {
      const res = await apiRequest('/api/storage/find-empty', {
        method: 'POST',
        body: JSON.stringify({
          patientId: 'NEW_PATIENT',
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
      const patientRes = await apiRequest('/api/patients', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          partnerName: partnerName || undefined,
          visitDate: visitDate || undefined,
          deDate: deDate || undefined,
          freezingDate: freezingDate || undefined,
          thawDate: thawDate || undefined,
          comments: comments || undefined,
        }),
      });

      const newPatient = patientRes.patient;

      if (assignStorageEnabled && selectedVisoTubeId) {
        await apiRequest('/api/storage/assign', {
          method: 'POST',
          body: JSON.stringify({
            patientId: newPatient.id,
            storageDate,
            embryoCount: Number(embryoCount),
            visoTubeId: selectedVisoTubeId,
            strawColors,
            notes: comments || undefined,
          }),
        });
      }

      onSuccess(newPatient);
    } catch (err: any) {
      setError(err.message || 'Failed to save patient record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-6 mb-8">
        <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-600">
          <UserPlus className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create New Patient Record</h1>
          <p className="text-sm text-slate-500">Register new patient details & allocate physical embryo storage</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Clinical Patient Details */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <span>Patient & Clinical Details</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Freezing Date
              </label>
              <input
                type="date"
                value={freezingDate}
                onChange={(e) => setFreezingDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Thaw Date
              </label>
              <input
                type="date"
                value={thawDate}
                onChange={(e) => setThawDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Doctor / Staff Notes & Comments
            </label>
            <textarea
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Enter multiline doctor notes, embryo grade observations, or medical history..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Section 2: Storage Location Recommendation Tool */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Embryo Physical Storage Allocation</span>
            </h2>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={assignStorageEnabled}
                onChange={(e) => setAssignStorageEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-100 border-slate-300 text-emerald-600 focus:ring-0"
              />
              <span>Allocate Physical Storage Now</span>
            </label>
          </div>

          {assignStorageEnabled && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Storage Date
                  </label>
                  <input
                    type="date"
                    value={storageDate}
                    onChange={(e) => setStorageDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Number of Embryos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={embryoCount}
                    onChange={(e) => setEmbryoCount(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleFindStorage}
                    disabled={searchingStorage}
                    className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2"
                  >
                    {searchingStorage ? (
                      <span className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>Find Available Storage</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Recommendation Results */}
              {recommendation && (
                <div className="p-5 bg-slate-50 rounded-3xl border border-emerald-200 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Recommended Physical Storage Location:</span>
                    </span>
                    <span>
                      Required Straws: <strong className="text-slate-900">{recommendation.requiredStraws}</strong> (Max 2 embryos/straw)
                    </span>
                  </div>

                  {recommendation.primaryRecommendation ? (
                    <div className="p-5 bg-emerald-100/60 border border-emerald-300 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                          Clinic Staff Physical Path Guide
                        </div>
                        <div className="text-xs px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg shadow-sm">
                          Recommended Location
                        </div>
                      </div>

                      {/* Visual Location Breakdown Badges */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-sm">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">1. Can</div>
                          <div className="text-xs font-bold text-slate-900 mt-0.5">
                            {recommendation.primaryRecommendation.breakdown?.can || 'Can 01'}
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-sm">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">2. Canister</div>
                          <div className="text-xs font-bold text-slate-900 mt-0.5">
                            {recommendation.primaryRecommendation.breakdown?.canister || 'Canister 06'}
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-sm">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">3. Level</div>
                          <div className="text-xs font-bold text-emerald-700 mt-0.5">
                            {recommendation.primaryRecommendation.breakdown?.level || 'Level 1 (Bottom)'}
                          </div>
                        </div>

                        <div className="bg-white p-2.5 rounded-xl border border-emerald-300 text-center shadow-sm">
                          <div className="text-[10px] text-emerald-700 font-semibold uppercase">4. Viso Tube</div>
                          <div className="text-xs font-bold text-emerald-800 mt-0.5">
                            {recommendation.primaryRecommendation.breakdown?.tube || 'Viso Tube 08'}
                          </div>
                        </div>
                      </div>

                      {/* Readable summary & system reference code */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs pt-2 border-t border-emerald-200 text-slate-700 gap-1">
                        <div>
                          <span className="text-slate-500 font-medium">Staff Description: </span>
                          <strong className="text-slate-900 font-bold">
                            {recommendation.primaryRecommendation.formattedLocation || recommendation.primaryRecommendation.explanation}
                          </strong>
                        </div>
                        <div className="text-[11px] font-mono text-emerald-800 font-bold">
                          System ID: {recommendation.primaryRecommendation.locationCode}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-800 font-bold">No primary Viso Tube match found. Select an alternative location below.</div>
                  )}

                  {/* Straw Color Chooser */}
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      <span>Physical Straw Color Markers:</span>
                      <span className="text-[10px] text-slate-500 font-normal lowercase">(Color is visual metadata, system ID is unique)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Array.from({ length: recommendation.requiredStraws }).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                          <span className="text-xs text-slate-600 font-semibold">Straw #{idx + 1}:</span>
                          <select
                            value={strawColors[idx] || 'Pink'}
                            onChange={(e) => {
                              const updated = [...strawColors];
                              updated[idx] = e.target.value;
                              setStrawColors(updated);
                            }}
                            className="bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 px-3 py-1.5 focus:outline-none"
                          >
                            <option value="Pink">Pink Straw</option>
                            <option value="Blue">Blue Straw</option>
                            <option value="White">White Straw</option>
                            <option value="Yellow">Yellow Straw</option>
                            <option value="Green">Green Straw</option>
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

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 text-sm flex items-center gap-2 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Patient & Assign Storage</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
