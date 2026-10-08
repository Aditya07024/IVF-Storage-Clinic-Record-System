import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { apiRequest, formatDateDDMMYYYY } from '../api/client';
import { DateInputDDMMYYYY } from './PatientForm';

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
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (batch) {
      setAspirationDate(
        batch.aspirationDate
          ? (typeof batch.aspirationDate === 'string' ? batch.aspirationDate.split('T')[0] : '')
          : ''
      );
      setFreezingDate(
        batch.freezingDate || batch.storageDate
          ? (typeof (batch.freezingDate || batch.storageDate) === 'string'
              ? (batch.freezingDate || batch.storageDate).split('T')[0]
              : '')
          : ''
      );
      setEmbryoStage(batch.embryoStage || '');
      setSpecimenType(batch.specimenType || 'EMBRYO');
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
      const res = await apiRequest(`/api/storage/batches/${batch.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          aspirationDate: aspirationDate || null,
          freezingDate: freezingDate || null,
          embryoStage: embryoStage || null,
          specimenType,
          notes: notes || null,
        }),
      });

      if (res.success) {
        setSuccessMsg('Cycle details updated successfully!');
        setTimeout(() => {
          onSuccess(res.batch);
          onClose();
        }, 600);
      } else {
        setError(res.error || 'Failed to update cycle details');
      }
    } catch (err: any) {
      console.error('Error updating cycle details:', err);
      setError(err.message || 'An error occurred while updating cycle details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
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
                Edit Cycle / Specimen Batch Details
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

          {/* Egg Retrieval Date */}
          <div className="space-y-1.5">
            <DateInputDDMMYYYY
              label="Egg Retrieval Date (Aspiration Date)"
              value={aspirationDate}
              onChange={(isoVal) => setAspirationDate(isoVal)}
              placeholder="DD/MM/YYYY"
            />
          </div>

          {/* Freezing Date */}
          <div className="space-y-1.5">
            <DateInputDDMMYYYY
              label="Freezing Date"
              value={freezingDate}
              onChange={(isoVal) => setFreezingDate(isoVal)}
              placeholder="DD/MM/YYYY"
              required
            />
          </div>

          {/* Embryo / Specimen Stage */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Specimen / Embryo Stage
            </label>
            <input
              type="text"
              value={embryoStage}
              onChange={(e) => setEmbryoStage(e.target.value)}
              placeholder="e.g. Day 3, Day 5 Blastocyst, MII Oocyte"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
            />
          </div>

          {/* Specimen Type */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Specimen Type
            </label>
            <select
              value={specimenType}
              onChange={(e) => setSpecimenType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all outline-none cursor-pointer"
            >
              <option value="EMBRYO">Embryo</option>
              <option value="OOCYTE">Oocyte / Egg</option>
            </select>
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
