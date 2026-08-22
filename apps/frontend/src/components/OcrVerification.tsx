import React, { useState, useEffect } from 'react';
import { FileScan, Upload, CheckCircle2, ShieldAlert, FileText, Check, X, Sparkles } from 'lucide-react';
import { apiRequest } from '../api/client';

export const OcrVerification: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [activeRecord, setActiveRecord] = useState<any | null>(null);

  // Verification Form Fields
  const [fullName, setFullName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [deDate, setDeDate] = useState('');
  const [freezingDate, setFreezingDate] = useState('');
  const [thawDate, setThawDate] = useState('');
  const [comments, setComments] = useState('');

  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingRecords();
  }, []);

  const fetchPendingRecords = async () => {
    try {
      const res = await apiRequest('/api/ocr/pending');
      if (res.success) {
        setPendingRecords(res.records);
        if (res.records.length > 0 && !activeRecord) {
          selectRecord(res.records[0]);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch pending OCR records:', err);
    }
  };

  const selectRecord = (record: any) => {
    setActiveRecord(record);
    const json = record.extractedJson || {};
    setFullName(json.fullName || '');
    setPartnerName(json.partnerName || '');
    setVisitDate(json.visitDate || '');
    setDeDate(json.deDate || '');
    setFreezingDate(json.freezingDate || '');
    setThawDate(json.thawDate || '');
    setComments(json.comments || record.rawOcrText || '');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('image', file);

    const accessKey = localStorage.getItem('app_access_key') || '';
    const token = localStorage.getItem('access_token') || '';

    try {
      const res = await fetch('/api/ocr/upload', {
        method: 'POST',
        headers: {
          'x-access-key': accessKey,
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload and process OCR image.');
      }

      setSuccessMsg('Image compressed, OCR processed, and structured by Gemini AI successfully.');
      setFile(null);
      await fetchPendingRecords();
    } catch (err: any) {
      setError(err.message || 'OCR upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord) return;

    setVerifying(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest('/api/ocr/verify', {
        method: 'POST',
        body: JSON.stringify({
          ocrRecordId: activeRecord.id,
          fullName: fullName.trim(),
          partnerName: partnerName.trim() || undefined,
          visitDate: visitDate || undefined,
          deDate: deDate || undefined,
          freezingDate: freezingDate || undefined,
          thawDate: thawDate || undefined,
          comments: comments.trim() || undefined,
        }),
      });

      if (res.success) {
        setSuccessMsg(`Patient record verified & saved to database (Patient ID: ${res.patient.patientId}).`);
        setActiveRecord(null);
        await fetchPendingRecords();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OCR record.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <FileScan className="w-7 h-7 text-emerald-600" />
          <span>OCR Scanned Records & Human Verification</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Google Vision OCR + Gemini AI structured extraction. Human staff verification is required before database insertion.
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

      {/* Upload Box */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Upload className="w-5 h-5 text-emerald-600" />
          <span>Upload Handwritten / Printed Patient Record Image</span>
        </h2>

        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-4">
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-700 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800"
          />

          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 transition-all"
          >
            {uploading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Process OCR & AI</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Side-by-Side Human Verification Screen */}
      {activeRecord ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Original Scanned Image & Raw Text */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Scanned Document Image</span>
              </h2>
              <span className="text-xs font-mono text-slate-500">{activeRecord.originalFilename}</span>
            </div>

            {/* Document Preview */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 min-h-[300px] flex items-center justify-center overflow-hidden">
              <img
                src={`/uploads/${activeRecord.storageKey}`}
                alt="Scanned Record"
                className="max-h-[400px] w-auto object-contain rounded-xl border border-slate-200"
                onError={(e) => {
                  (e.target as any).style.display = 'none';
                }}
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Google Vision OCR Raw Output:</div>
              <pre className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[11px] font-mono text-slate-800 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {activeRecord.rawOcrText}
              </pre>
            </div>
          </div>

          {/* Right: Human Verification & Editing Form */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                <span>Gemini AI Structured Data Verification Form</span>
              </h2>
              <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-300">
                Staff Verification Required
              </span>
            </div>

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Partner Name
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Visit Date
                  </label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    DE Date
                  </label>
                  <input
                    type="date"
                    value={deDate}
                    onChange={(e) => setDeDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Freezing Date
                  </label>
                  <input
                    type="date"
                    value={freezingDate}
                    onChange={(e) => setFreezingDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Thaw Date
                  </label>
                  <input
                    type="date"
                    value={thawDate}
                    onChange={(e) => setThawDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Verified Doctor / Staff Comments
                </label>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
                >
                  {verifying ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Approve & Save Verified Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-500 shadow-sm">
          No pending OCR records selected for verification. Upload a record above or select one from queue.
        </div>
      )}
    </div>
  );
};
