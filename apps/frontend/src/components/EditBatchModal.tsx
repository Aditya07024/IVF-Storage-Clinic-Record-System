import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Loader2, CheckCircle2, AlertCircle, Sparkles, UserCheck } from 'lucide-react';
import { apiRequest, formatDateDDMMYYYY } from '../api/client';
import { DateInputDDMMYYYY, capitalizeWords } from './PatientForm';

export interface EditBatchModalProps {
  isOpen: boolean;
  batch: any | null;
  onClose: () => void;
  onSuccess: (updatedBatch: any) => void;
}

export const EditBatchModal: React.FC<EditBatchModalProps> = ({
  isOpen,
  batch,
  onClose,
  onSuccess,
}) => {
  const [aspirationDate, setAspirationDate] = useState('');
  const [freezingDate, setFreezingDate] = useState('');
  const [embryoStage, setEmbryoStage] = useState('');
  const [specimenType, setSpecimenType] = useState('EMBRYO');
  const [cycleType, setCycleType] = useState('SELF');
  const [donorName, setDonorName] = useState('');
  const [donorRegNo, setDonorRegNo] = useState('');
  const [donorAge, setDonorAge] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [vitrificationIndication, setVitrificationIndication] = useState('Social egg freezing');
  const [oocyteStage, setOocyteStage] = useState('MII');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (batch) {
      const rawAsp = batch.aspirationDate || batch.straws?.[0]?.aspirationDate || '';
      const parsedAsp = rawAsp
        ? (typeof rawAsp === 'string' ? rawAsp.split('T')[0] : (rawAsp instanceof Date ? rawAsp.toISOString().split('T')[0] : ''))
        : '';
      setAspirationDate(parsedAsp);

      const rawFrz = batch.freezingDate || batch.storageDate || batch.straws?.[0]?.freezingDate || batch.straws?.[0]?.storageDate || '';
      const parsedFrz = rawFrz
        ? (typeof rawFrz === 'string' ? rawFrz.split('T')[0] : (rawFrz instanceof Date ? rawFrz.toISOString().split('T')[0] : ''))
        : new Date().toISOString().split('T')[0];
      setFreezingDate(parsedFrz);

      setEmbryoStage(batch.embryoStage || '');
      setSpecimenType(batch.specimenType || 'EMBRYO');
      setCycleType(batch.cycleType || (batch.donorName || batch.donorRegNo ? 'DONOR_RECIPIENT' : 'SELF'));
      setDonorName(batch.donorName || '');
      setDonorRegNo(batch.donorRegNo || '');
      setDonorAge(batch.donorAge || '');
      setDonorPhone(batch.donorPhone || '');
      setVitrificationIndication(batch.vitrificationIndication || 'Social egg freezing');
      setOocyteStage(batch.oocyteStage || 'MII');
      setNotes(batch.notes || batch.comments || '');
      setError(null);
      setSuccessMsg(null);
    }
  }, [batch]);

  if (!isOpen || !batch) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        aspirationDate: aspirationDate || null,
        freezingDate: freezingDate || null,
        embryoStage: embryoStage || null,
        specimenType,
        cycleType,
        donorName: donorName || null,
        donorRegNo: donorRegNo || null,
        donorAge: donorAge || null,
        donorPhone: donorPhone || null,
        vitrificationIndication: specimenType === 'OOCYTE' ? vitrificationIndication : null,
        notes: notes || null,
      };

      let res: any = null;
      try {
        res = await apiRequest(`/api/storage/batches/${batch.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch (err: any) {
        // If /api/storage/batches/:id returns 404, fallback to /api/patients/:id
        const patId = batch.patientId || batch.patient?.id;
        if (err.message?.includes('404') && patId) {
          res = await apiRequest(`/api/patients/${patId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          if (res && res.success) {
            res = { success: true, batch: { ...batch, ...payload } };
          }
        } else {
          throw err;
        }
      }

      if (res && res.success) {
        setSuccessMsg('Cycle details updated successfully!');
        setTimeout(() => {
          onSuccess(res.batch || { ...batch, ...payload });
          onClose();
        }, 600);
      } else {
        setError(res?.error || 'Failed to update cycle details');
      }
    } catch (err: any) {
      console.error('Error updating cycle details:', err);
      setError(err.message || 'An error occurred while updating cycle details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      style={{ zIndex: 9999 }}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 font-bold">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Edit Cycle Entry (Egg Pick Up & Freezing)
              </h3>
              <p className="text-xs text-slate-300 font-mono">
                Batch ID: {batch.batchId || batch.id?.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Primary Defining Date: Egg Pick Up Date */}
          <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-1.5">
            <DateInputDDMMYYYY
              label="Date of Egg Retrieval"
              value={aspirationDate}
              onChange={(isoVal) => setAspirationDate(isoVal)}
              placeholder="DD/MM/YYYY"
            />
            <p className="text-[10.5px] text-amber-900 font-medium">
              Egg Pick Up / Aspiration Date defining this treatment cycle.
            </p>
          </div>

          {/* Freezing Date */}
          <div className="space-y-1.5">
            <DateInputDDMMYYYY
              label="Date of Freezing"
              value={freezingDate}
              onChange={(isoVal) => setFreezingDate(isoVal)}
              placeholder="__/__/____"
              required
            />
          </div>

          {/* Specimen Type & Cycle Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Specimen Type
              </label>
              <select
                value={specimenType}
                onChange={(e) => setSpecimenType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none cursor-pointer"
              >
                <option value="EMBRYO">Embryo Freezing</option>
                <option value="OOCYTE">Egg Freezing (Oocyte)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Cycle Type
              </label>
              <select
                value={cycleType}
                onChange={(e) => setCycleType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none cursor-pointer"
              >
                <option value="SELF">Self Cycle</option>
                <option value="DONOR_RECIPIENT">Donor / Recipient (D-R)</option>
              </select>
            </div>
          </div>

          {/* Egg Freezing Specs */}
          {specimenType === 'OOCYTE' && (
            <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                Egg Freezing Specs
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Vitrification Indication</label>
                  <select
                    value={vitrificationIndication}
                    onChange={(e) => setVitrificationIndication(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl text-xs text-slate-900 font-medium"
                  >
                    <option value="Social egg freezing">Social egg freezing</option>
                    <option value="Emergency egg freezing">Emergency egg freezing</option>
                    <option value="Onco fertility preservation">Onco fertility preservation</option>
                    <option value="Supernumerary donor egg freezing">Supernumerary donor egg freezing</option>
                    <option value="Elective / Other">Elective / Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Donor Profile (For D-R Cycle or Supernumerary Donor Egg Freezing) */}
          {(cycleType === 'DONOR_RECIPIENT' || (specimenType === 'OOCYTE' && vitrificationIndication === 'Supernumerary donor egg freezing')) && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>Donor Information for this Cycle</span>
                </span>
                <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  D-R Cycle
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Donor Reg No. / Code
                  </label>
                  <input
                    type="text"
                    value={donorRegNo}
                    onChange={(e) => setDonorRegNo(e.target.value)}
                    placeholder="e.g. D-9948"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Donor Name
                  </label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={(e) => setDonorName(capitalizeWords(e.target.value))}
                    placeholder="Donor Name"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Donor Age
                  </label>
                  <input
                    type="text"
                    value={donorAge}
                    onChange={(e) => setDonorAge(e.target.value)}
                    placeholder="e.g. 24 Yrs"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Donor Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={donorPhone}
                    onChange={(e) => setDonorPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Embryo / Specimen Stage */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Specimen Stage
            </label>
            <input
              type="text"
              value={embryoStage}
              onChange={(e) => setEmbryoStage(e.target.value)}
              placeholder="e.g. Day 3, Day 5 Blastocyst, MII Oocyte"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
            />
          </div>

          {/* Notes / Clinical Comments */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Cycle Notes & Doctor Remarks
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add cycle-specific clinical remarks or doctor notes..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Cycle...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Cycle Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
