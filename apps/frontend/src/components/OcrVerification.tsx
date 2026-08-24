import React, { useState, useEffect, useRef } from 'react';
import { FileScan, Upload, CheckCircle2, ShieldAlert, FileText, Check, X, Sparkles, Camera, Crop, Sliders, Trash2 } from 'lucide-react';
import { apiRequest } from '../api/client';

export const OcrVerification: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [activeRecord, setActiveRecord] = useState<any | null>(null);

  // Verification Form Fields
  const [patientId, setPatientId] = useState('');
  const [fullName, setFullName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [partnerAge, setPartnerAge] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [deDate, setDeDate] = useState('');
  const [freezingDate, setFreezingDate] = useState('');
  const [thawDate, setThawDate] = useState('');
  const [embryoCount, setEmbryoCount] = useState('');
  const [comments, setComments] = useState('');

  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Adobe Cam Edge Detection & Viewfinder States
  const [adobeCamEnabled, setAdobeCamEnabled] = useState(true);
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
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
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

  // Adobe Scan Edge Detection & Auto-Crop Algorithm
  const autoCropDocumentBorders = (sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d');
    if (!ctx) return sourceCanvas;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let foundTextOrEdge = false;

    // Scan pixels for contrast & luminance (paper document vs desk background border)
    for (let y = 0; y < height; y += 6) {
      for (let x = 0; x < width; x += 6) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        // Paper document thresholding
        if (luminance > 50 && luminance < 245) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          foundTextOrEdge = true;
        }
      }
    }

    if (!foundTextOrEdge || maxX <= minX || maxY <= minY) {
      return sourceCanvas;
    }

    // Add 15px margin to avoid cropping real text
    const padding = 15;
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropW = Math.min(width - cropX, (maxX - minX) + padding * 2);
    const cropH = Math.min(height - cropY, (maxY - minY) + padding * 2);

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropW;
    croppedCanvas.height = cropH;
    const croppedCtx = croppedCanvas.getContext('2d');
    if (croppedCtx) {
      croppedCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      return croppedCanvas;
    }

    return sourceCanvas;
  };

  const captureCameraPhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      }

      // If Adobe Cam enabled, auto-detect document edges & crop blank margins
      const finalCanvas = adobeCamEnabled ? autoCropDocumentBorders(canvas) : canvas;

      finalCanvas.toBlob((blob) => {
        if (blob) {
          const photoFile = new File([blob], `adobe-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setFile(photoFile);
          stopLiveCamera();
          setSuccessMsg(
            adobeCamEnabled
              ? '✨ Document paper edges detected & blank background cropped automatically (Adobe Cam Mode)! Click "Process OCR & AI".'
              : 'Photo captured successfully! Click "Process OCR & AI".'
          );
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
    setPatientId(json.patientId || record.patientId || '');
    setFullName(json.fullName || '');
    setPartnerName(json.partnerName || '');
    setPatientAge(json.patientAge || '');
    setPartnerAge(json.partnerAge || '');
    setDoctorName(json.doctorName || '');
    setVisitDate(json.visitDate || '');
    setDeDate(json.deDate || '');
    setFreezingDate(json.freezingDate || '');
    setThawDate(json.thawDate || '');
    setEmbryoCount(json.embryoCount ? String(json.embryoCount) : '');
    setComments(json.comments || '');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('access_token');
      const accessKey = localStorage.getItem('app_access_key') || 'clinic2026';

      const formData = new FormData();
      formData.append('image', file);

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

      setSuccessMsg('Image edges trimmed, OCR processed, and structured by Gemini AI successfully.');
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
          patientId: patientId.trim() || undefined,
          fullName: fullName.trim(),
          partnerName: partnerName.trim() || undefined,
          patientAge: patientAge.trim() || undefined,
          partnerAge: partnerAge.trim() || undefined,
          doctorName: doctorName.trim() || undefined,
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

  const handleDiscard = async (recordIdToDiscard?: string) => {
    const targetId = recordIdToDiscard || activeRecord?.id;
    if (!targetId) return;

    if (!window.confirm('Are you sure you want to discard and delete this scanned OCR record?')) {
      return;
    }

    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest('/api/ocr/discard', {
        method: 'POST',
        body: JSON.stringify({ ocrRecordId: targetId }),
      });

      if (res.success) {
        setSuccessMsg('Scanned OCR record discarded and removed from queue.');
        if (activeRecord?.id === targetId) {
          setActiveRecord(null);
        }
        await fetchPendingRecords();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to discard OCR record.');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
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

      <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <FileScan className="w-7 h-7 text-emerald-600" />
            <span>Adobe Scan OCR & Auto Edge-Detection Studio</span>
          </h1>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Automatic document edge detection, blank background cropping, and Gemini AI structured extraction.
          </p>
        </div>

        {/* Adobe Cam Mode Toggle */}
        <label className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-300 shadow-xs cursor-pointer">
          <input
            type="checkbox"
            checked={adobeCamEnabled}
            onChange={(e) => setAdobeCamEnabled(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
          />
          <span className="text-xs font-bold text-slate-800">✨ Adobe Cam Mode</span>
        </label>
      </div>

      {/* Feature in Development Mode Notice Banner */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-amber-950 font-bold text-xs shadow-xs animate-in fade-in">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-200/80 rounded-xl flex items-center justify-center shrink-0 text-amber-900 border border-amber-300">
            <Sparkles className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-950">Feature in Development Mode</div>
            <div className="text-[11px] text-amber-800 font-medium">
              This feature is in development mode (AI Vision OCR Document Scan & Record Auto-Fill is under active preview & refinement).
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-200/80 px-2.5 py-1 rounded-full border border-amber-400 shrink-0">
          DEV PREVIEW MODE
        </span>
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

      {/* Upload Box with Adobe Cam Studio */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            <span>Snap Document with Adobe Cam or Upload Image</span>
          </h2>

          <div className="flex items-center gap-2">
            {/* Live Web Camera Button */}
            <button
              type="button"
              onClick={startLiveCamera}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Adobe Scanner Cam</span>
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
                <span>Selected Photo: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
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

      {/* Adobe Scan Live Viewfinder Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-2xl text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Crop className="w-5 h-5 text-emerald-400" />
                <span>Adobe Scanner Document Edge Detector</span>
              </div>
              <button
                onClick={stopLiveCamera}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewfinder with Adobe Edge Framing & Laser Beam */}
            <div className="relative bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-slate-800 shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Adobe Scanner Framing Box & Corner Handles */}
              <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-xl pointer-events-none transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                {/* Top-Left Corner */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                {/* Top-Right Corner */}
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                {/* Bottom-Left Corner */}
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                {/* Bottom-Right Corner */}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* Laser Scanning Beam */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              </div>

              <div className="absolute bottom-4 inset-x-0 flex justify-center">
                <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-300 bg-slate-950/80 px-4 py-1.5 rounded-full border border-emerald-500/40 backdrop-blur-xs">
                  {adobeCamEnabled ? '✨ Adobe Auto Edge Detection & Border Crop Active' : 'Position Document Inside Frame'}
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
                className="px-7 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Snap & Auto-Crop Document</span>
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
                <span>Scanned Document Page</span>
              </h2>
              <span className="text-xs font-mono text-slate-500">{activeRecord.originalFilename}</span>
            </div>

            {/* Document Preview */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 min-h-[300px] flex items-center justify-center overflow-hidden">
              <img
                src={`/uploads/${activeRecord.storageKey}`}
                alt="Scanned Record"
                className="max-h-[400px] w-auto object-contain rounded-xl border border-slate-200 shadow-sm"
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
                <span>Human Staff Verification</span>
              </h2>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                PENDING VERIFICATION
              </span>
            </div>

            <form onSubmit={handleVerify} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Registration No (Patient ID)</label>
                  <input
                    type="text"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    placeholder="e.g. IVF-2026-000007"
                  />
                </div>

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
                  <label className="font-semibold text-slate-700">Patient Age</label>
                  <input
                    type="text"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                    placeholder="e.g. 32 Yrs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Partner Age</label>
                  <input
                    type="text"
                    value={partnerAge}
                    onChange={(e) => setPartnerAge(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                    placeholder="e.g. 35 Yrs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Doctor Name</label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                    placeholder="e.g. Dr. Ananya Sharma"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Frozen Embryos Count</label>
                <input
                  type="number"
                  min="0"
                  value={embryoCount}
                  onChange={(e) => setEmbryoCount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                  placeholder="e.g. 4"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Freezing / Storage Date</label>
                  <input
                    type="date"
                    value={freezingDate}
                    onChange={(e) => setFreezingDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Thaw / Withdrawal Date</label>
                  <input
                    type="date"
                    value={thawDate}
                    onChange={(e) => setThawDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
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
                  <label className="font-semibold text-slate-700">DE Date (Donor Egg)</label>
                  <input
                    type="date"
                    value={deDate}
                    onChange={(e) => setDeDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Clinical Comments / Verification Notes</label>
                <textarea
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Enter staff clinical comments or verification notes..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleDiscard(activeRecord.id)}
                  className="px-4 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-2 transition-all shadow-xs shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Discard Scan</span>
                </button>

                <button
                  type="submit"
                  disabled={verifying}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                >
                  {verifying ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Save Verified Record</span>
                    </>
                  )}
                </button>
              </div>
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
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative group ${
                    activeRecord?.id === record.id
                      ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-md'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 truncate max-w-[160px]">{record.originalFilename}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold border border-amber-300">
                        PENDING
                      </span>
                      <button
                        type="button"
                        title="Discard this scan"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDiscard(record.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
