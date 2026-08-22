import React, { useState, useEffect, useRef } from 'react';
import { FileScan, Upload, CheckCircle2, ShieldAlert, FileText, Check, X, Sparkles, Camera } from 'lucide-react';
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

  // Live Camera Capture States
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    fetchPendingRecords();
  }, []);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraOpen, cameraStream]);

  const startLiveCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      // Fallback: Trigger native mobile camera file input if getUserMedia blocked
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else {
        setError('Unable to open live camera. Please grant camera permissions or select a photo from your gallery.');
      }
    }
  };

  const stopLiveCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const photoFile = new File([blob], `camera-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setFile(photoFile);
          stopLiveCamera();
          setSuccessMsg('Photo captured from camera successfully! Click "Process OCR & AI" to analyze.');
        }
      }, 'image/jpeg', 0.92);
    }
  };

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
      {/* Hidden Native Mobile Camera Input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
            setSuccessMsg('Photo captured from mobile camera! Click "Process OCR & AI" to analyze.');
          }
        }}
        className="hidden"
      />

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

      {/* Upload Box with Camera Capture */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            <span>Upload or Snap Patient Record Photo</span>
          </h2>

          <div className="flex items-center gap-2">
            {/* Live Web Camera Button */}
            <button
              type="button"
              onClick={startLiveCamera}
              className="px-4 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs rounded-xl border border-emerald-300 flex items-center gap-2 transition-all shadow-xs"
            >
              <Camera className="w-4 h-4 text-emerald-700" />
              <span>Take Photo (Camera)</span>
            </button>

            {/* Direct Mobile Camera App Trigger */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center gap-2 transition-all shadow-xs"
            >
              <Camera className="w-4 h-4 text-slate-700" />
              <span>Mobile Camera App</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full flex-1">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-700 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800"
            />
            {file && (
              <div className="text-[11px] font-bold text-emerald-700 mt-1.5 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Selected Photo/File: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
              </div>
            )}
          </div>

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

      {/* Live Camera Viewfinder Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Camera className="w-5 h-5 text-emerald-400" />
                <span>Live Camera Viewfinder</span>
              </div>
              <button
                onClick={stopLiveCamera}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-4 border-2 border-emerald-400/40 border-dashed rounded-xl pointer-events-none flex items-center justify-center">
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400/70 bg-slate-950/60 px-3 py-1 rounded-full">
                  Position Patient Document Inside Frame
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={stopLiveCamera}
                className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={captureCameraPhoto}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Human Staff Verification & Verification</span>
              </h2>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                PENDING VERIFICATION
              </span>
            </div>

            <form onSubmit={handleVerify} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Patient Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                  placeholder="Full Name"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Partner Name</label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                  placeholder="Partner Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Visit Date</label>
                  <input
                    type="date"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">DE Date</label>
                  <input
                    type="date"
                    value={deDate}
                    onChange={(e) => setDeDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Freezing Date</label>
                  <input
                    type="date"
                    value={freezingDate}
                    onChange={(e) => setFreezingDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Thaw Date</label>
                  <input
                    type="date"
                    value={thawDate}
                    onChange={(e) => setThawDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Staff Verification Notes / Raw Text</label>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {verifying ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Insert Verified Record into Database</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Pending Records Queue List */
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileScan className="w-4 h-4 text-emerald-600" />
              <span>Pending OCR Records Queue ({pendingRecords.length})</span>
            </h2>
          </div>

          {pendingRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs font-medium">
              No pending OCR records awaiting verification. Upload a record above to begin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingRecords.map((record) => (
                <div
                  key={record.id}
                  onClick={() => selectRecord(record)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    activeRecord?.id === record.id
                      ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-md'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 truncate max-w-[180px]">{record.originalFilename}</span>
                    <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-300">
                      PENDING
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono truncate">
                    Extracted Name: {record.extractedJson?.fullName || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
