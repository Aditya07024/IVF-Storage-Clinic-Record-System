import React, { useState, useEffect, useRef } from 'react';
import { FileScan, Upload, CheckCircle2, ShieldAlert, FileText, Check, X, Sparkles, Camera, Crop, Sliders, Trash2, RotateCcw, RotateCw } from 'lucide-react';
import { apiRequest } from '../api/client';
import { DateInputDDMMYYYY } from './PatientForm';
import { rotateImageFile, captureUprightCanvasFromVideo } from '../utils/imageUtils';
import { ImageCropRotateModal } from './ImageCropRotateModal';

export const OcrVerification: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [cropModalFile, setCropModalFile] = useState<File | null>(null);
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [activeRecord, setActiveRecord] = useState<any | null>(null);

  const getVisoColorStyle = (color: string) => {
    const c = color.toLowerCase();
    if (c.includes('pink')) return 'bg-pink-100 border-pink-400 text-pink-900';
    if (c.includes('grey') || c.includes('gray')) return 'bg-slate-200 border-slate-400 text-slate-900';
    if (c.includes('red')) return 'bg-red-100 border-red-500 text-red-900';
    if (c.includes('black')) return 'bg-slate-900 border-slate-950 text-white';
    if (c.includes('green')) return 'bg-emerald-100 border-emerald-500 text-emerald-900';
    if (c.includes('rust')) return 'bg-amber-100 border-amber-700 text-amber-950';
    if (c.includes('blue') && !c.includes('sky')) return 'bg-blue-100 border-blue-500 text-blue-900';
    if (c.includes('purple')) return 'bg-purple-100 border-purple-500 text-purple-900';
    if (c.includes('yellow')) return 'bg-yellow-100 border-yellow-400 text-yellow-950';
    if (c.includes('orange')) return 'bg-orange-100 border-orange-500 text-orange-950';
    if (c.includes('sky')) return 'bg-sky-100 border-sky-400 text-sky-950';
    return 'bg-white border-emerald-300 text-slate-900';
  };

  // Verification Form Fields
  const [patientId, setPatientId] = useState('');
  const [fullName, setFullName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [email, setEmail] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [dob, setDob] = useState('');
  const [partnerDob, setPartnerDob] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [partnerAge, setPartnerAge] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [freezingDate, setFreezingDate] = useState('');
  const [thawDate, setThawDate] = useState('');
  const [embryoCount, setEmbryoCount] = useState('');
  const [tankName, setTankName] = useState('CAN-01');
  const [canisterName, setCanisterName] = useState('');
  const [visoTubeColor, setVisoTubeColor] = useState('');
  const [visoTubeId, setVisoTubeId] = useState('');
  const [level, setLevel] = useState('');
  const [straws, setStraws] = useState<any[]>([]);
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
      const rawCanvas = captureUprightCanvasFromVideo(videoRef.current);

      // If Adobe Cam enabled, auto-detect document edges & crop blank margins
      const finalCanvas = adobeCamEnabled ? autoCropDocumentBorders(rawCanvas) : rawCanvas;

      finalCanvas.toBlob((blob) => {
        if (blob) {
          const photoFile = new File([blob], `adobe-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
          stopLiveCamera();
          setCropModalFile(photoFile);
        }
      }, 'image/jpeg', 0.92);
    }
  };

  const handleRotateImage = async (angle: number) => {
    if (!file) return;
    try {
      const { file: rotatedFile } = await rotateImageFile(file, angle);
      setFile(rotatedFile);
      setSuccessMsg(`Photo rotated ${angle > 0 ? '90° Right ↻' : '90° Left ↺'}!`);
    } catch (err: any) {
      console.error('Image rotation error:', err);
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
    let json: any = {};
    if (record.structuredFields) {
      json = record.structuredFields;
    } else if (typeof record.extractedJson === 'string') {
      try {
        json = JSON.parse(record.extractedJson);
      } catch (e) {
        json = {};
      }
    } else if (typeof record.extractedJson === 'object' && record.extractedJson !== null) {
      json = record.extractedJson;
    }

    setPatientId(json.patientId || record.patientId || '');
    setFullName(json.fullName || '');
    setPartnerName(json.partnerName || '');
    setPhone(json.phone || '');
    setPartnerPhone(json.partnerPhone || '');
    setEmail(json.email || '');
    setPartnerEmail(json.partnerEmail || '');
    setDob(json.dob || '');
    setPartnerDob(json.partnerDob || '');
    setPatientAge(json.patientAge || '');
    setPartnerAge(json.partnerAge || '');
    setDoctorName(json.doctorName || '');
    setVisitDate(json.visitDate || json.aspirationDate || '');
    setFreezingDate(json.freezingDate || '');
    setThawDate(json.thawDate || '');
    setEmbryoCount(json.embryoCount ? String(json.embryoCount) : '');

    // Normalize Canister Name against exact physical clinic inventory
    let can = (json.canisterName || '').trim();
    if (can.match(/8|C08|cayo/i)) can = 'C08';
    else if (can.match(/1|C01/i)) can = 'C01';
    else if (can.match(/2|C02/i)) can = 'C02';
    else if (can.match(/3|C03/i)) can = 'C03';
    else if (can.match(/4|C04/i)) can = 'C04';
    else if (can.match(/5|C05/i)) can = 'C05';
    else if (can.match(/6|C06/i)) can = 'C06';
    else if (can.match(/7|C07/i)) can = 'C07';
    else if (can.match(/9|C09/i)) can = 'C09';
    else if (can.match(/10|C10/i)) can = 'C10';
    setCanisterName(can || 'C08');

    // Normalize Viso Tube Color (11 Physical Colors)
    let col = (json.visoTubeColor || '').trim();
    if (col.match(/pink/i)) col = 'Pink';
    else if (col.match(/grey|gray/i)) col = 'Grey';
    else if (col.match(/red/i)) col = 'Red';
    else if (col.match(/black/i)) col = 'Black';
    else if (col.match(/green/i)) col = 'Green';
    else if (col.match(/rust/i)) col = 'Rust';
    else if (col.match(/blue/i)) col = 'Blue';
    else if (col.match(/purple/i)) col = 'Purple';
    else if (col.match(/yellow/i)) col = 'Yellow';
    else if (col.match(/orange/i)) col = 'Orange';
    else if (col.match(/sky/i)) col = 'Skyblue';
    setVisoTubeColor(col || 'Pink');

    // Normalize Viso Tube ID / Goblet
    let gob = (json.visoTubeId || '').trim();
    if (gob.match(/yellow/i)) gob = 'V09';
    else if (gob.match(/pink/i)) gob = 'V01';
    else if (gob.match(/green/i)) gob = 'V05';
    else if (gob.match(/blue/i)) gob = 'V07';
    else if (gob.match(/red/i)) gob = 'V03';
    else if (gob.match(/grey|gray/i)) gob = 'V02';
    else if (gob.match(/black/i)) gob = 'V04';
    else if (gob.match(/purple/i)) gob = 'V08';
    else if (gob.match(/orange/i)) gob = 'V10';
    else if (gob.match(/sky/i)) gob = 'V11';
    setVisoTubeId(gob || 'V09');

    // Normalize Level / Tier
    let lvl = (json.level || '').trim();
    if (lvl.match(/1|bottom|I/i)) lvl = 'Level 1';
    else if (lvl.match(/2|top|II/i)) lvl = 'Level 2';
    setLevel(lvl || 'Level 1');

    const initialStraws = Array.isArray(json.straws) && json.straws.length > 0
      ? json.straws.map((s: any) => ({ ...s, thawDate: s.thawDate || json.thawDate || '' }))
      : [{ strawId: 'STR-01', colorTag: 'Pink', embryoCount: 1, stage: 'Day 5', grade: '4AA', freezingDate: json.freezingDate || '', thawDate: json.thawDate || '' }];
    setStraws(initialStraws);
    setComments(json.comments || '');
  };

  const addStrawRow = () => {
    setStraws((prev) => [
      ...prev,
      {
        strawId: `STR-0${prev.length + 1}`,
        colorTag: visoTubeColor || 'Pink',
        embryoCount: 1,
        stage: 'Day 5',
        grade: '4AA',
        freezingDate: freezingDate || '',
        thawDate: thawDate || '',
      },
    ]);
  };

  const updateStrawRow = (index: number, field: string, value: any) => {
    setStraws((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const removeStrawRow = (index: number) => {
    setStraws((prev) => prev.filter((_, i) => i !== index));
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

      setSuccessMsg('OCR Scan processed successfully! Please verify patient details on the right.');
      setFile(null);
      await fetchPendingRecords();
      if (data.record) {
        selectRecord(data.record);
      }
    } catch (err: any) {
      setError(err.message || 'Error processing document scan.');
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
          phone: phone.trim() || undefined,
          partnerPhone: partnerPhone.trim() || undefined,
          email: email.trim() || undefined,
          partnerEmail: partnerEmail.trim() || undefined,
          dob: dob || undefined,
          partnerDob: partnerDob || undefined,
          patientAge: patientAge.trim() || undefined,
          partnerAge: partnerAge.trim() || undefined,
          doctorName: doctorName.trim() || undefined,
          visitDate: visitDate || undefined,
          freezingDate: freezingDate || undefined,
          thawDate: thawDate || undefined,
          canisterName: canisterName.trim() || undefined,
          visoTubeColor: visoTubeColor.trim() || undefined,
          visoTubeId: visoTubeId.trim() || undefined,
          level: level.trim() || undefined,
          straws: straws.length > 0 ? straws : undefined,
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
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) {
                  if (selected.type.startsWith('image/')) {
                    setCropModalFile(selected);
                  } else {
                    setFile(selected);
                  }
                }
                e.target.value = '';
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-700 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800"
            />
            {file && (
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Selected Photo: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleRotateImage(-90)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 font-bold text-[11px] rounded-lg border border-slate-300 flex items-center gap-1 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title="Rotate Left 90°"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-700" />
                    <span>Rotate ↺</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotateImage(90)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 font-bold text-[11px] rounded-lg border border-slate-300 flex items-center gap-1 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title="Rotate Right 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-slate-700" />
                    <span>Rotate ↻</span>
                  </button>
                </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
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

                <DateInputDDMMYYYY
                  label="Patient DOB"
                  value={dob}
                  onChange={(val) => setDob(val)}
                  extraBadge={patientAge ? <span className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-300">{patientAge}</span> : undefined}
                />

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Patient Mobile Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="e.g. +91 98260 78901"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Patient Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="patient@example.com"
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

                <DateInputDDMMYYYY
                  label="Partner DOB"
                  value={partnerDob}
                  onChange={(val) => setPartnerDob(val)}
                  extraBadge={partnerAge ? <span className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded text-[10px] font-bold border border-emerald-300">{partnerAge}</span> : undefined}
                />

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Partner Mobile Phone</label>
                  <input
                    type="text"
                    value={partnerPhone}
                    onChange={(e) => setPartnerPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="e.g. +91 98260 12345"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Partner Email Address</label>
                  <input
                    type="email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                    placeholder="partner@example.com"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
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

              <div className="grid grid-cols-3 gap-4">
                <DateInputDDMMYYYY
                  label="Freezing Date"
                  value={freezingDate}
                  onChange={(val) => setFreezingDate(val)}
                />

                <DateInputDDMMYYYY
                  label="Thaw Date"
                  value={thawDate}
                  onChange={(val) => setThawDate(val)}
                />

                <DateInputDDMMYYYY
                  label="Date of ASP"
                  value={visitDate}
                  onChange={(val) => setVisitDate(val)}
                />
              </div>

              {/* AI Extracted Cryo Storage Location (Fully Editable & Compact) */}
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>AI Extracted Cryo Storage Location (Editable)</span>
                  </span>
                  <span className="text-[9px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                    AUTO-ALLOCATES IN CONTAINER VIEW
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {/* Field 1: Cryotank / Can Overview */}
                  <div className="space-y-0.5">
                    <label className="font-bold text-slate-700 text-[9px] uppercase">Tank / Cryotank</label>
                    <select
                      value={tankName}
                      onChange={(e) => setTankName(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 text-slate-900 font-bold text-[11px] focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
                    >
                      <option value="CAN-01">CAN-01 (Tank 1)</option>
                      <option value="CAN-02">CAN-02 (Tank 2)</option>
                      <option value="CAN-03">CAN-03 (Tank 3)</option>
                      <option value="CAN-04">CAN-04 (Tank 4)</option>
                      <option value="CAN-05">CAN-05 (Tank 5)</option>
                      <option value="CAN-08">CAN-08 (Tank 8)</option>
                      <option value="CAN-10">CAN-10 (Tank 10)</option>
                      <option value="CAN-11">CAN-11 (Tank 11)</option>
                      <option value="CAN-14">CAN-14 (Tank 14)</option>
                    </select>
                  </div>

                  {/* Field 2: Canister No */}
                  <div className="space-y-0.5">
                    <label className="font-bold text-slate-700 text-[9px] uppercase">Canister No</label>
                    <select
                      value={canisterName}
                      onChange={(e) => setCanisterName(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 text-slate-900 font-bold text-[11px] focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
                    >
                      <option value="">-- Select Canister --</option>
                      <option value="C08">C08 (Canister 08)</option>
                      <option value="C01">C01 (Canister 01)</option>
                      <option value="C02">C02 (Canister 02)</option>
                      <option value="C03">C03 (Canister 03)</option>
                      <option value="C04">C04 (Canister 04)</option>
                      <option value="C05">C05 (Canister 05)</option>
                      <option value="C06">C06 (Canister 06)</option>
                      <option value="C07">C07 (Canister 07)</option>
                      <option value="C09">C09 (Canister 09)</option>
                      <option value="C10">C10 (Canister 10)</option>
                    </select>
                  </div>

                  {/* Field 3: Level / Tier */}
                  <div className="space-y-0.5">
                    <label className="font-bold text-slate-700 text-[9px] uppercase">Level / Tier</label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 text-slate-900 font-bold text-[11px] focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
                    >
                      <option value="">-- Select Level --</option>
                      <option value="Level 1">Level 1 (Bottom)</option>
                      <option value="Level 2">Level 2 (Top)</option>
                    </select>
                  </div>

                  {/* Field 4: Viso Tube / Goblet Color (11 Physical Colors) */}
                  <div className="space-y-0.5">
                    <label className="font-bold text-slate-700 text-[9px] uppercase">Viso Tube / Goblet Color</label>
                    <select
                      value={visoTubeColor}
                      onChange={(e) => {
                        setVisoTubeColor(e.target.value);
                        setVisoTubeId(e.target.value);
                      }}
                      className={`w-full border rounded-lg p-1.5 font-bold text-[11px] focus:outline-none shadow-2xs cursor-pointer transition-all ${getVisoColorStyle(visoTubeColor)}`}
                    >
                      <option value="" className="bg-white text-slate-900 font-bold">-- Select Color --</option>
                      <option value="Pink" className="bg-pink-100 text-pink-900 font-bold">V01: Pink</option>
                      <option value="Grey" className="bg-slate-200 text-slate-900 font-bold">V02: Grey</option>
                      <option value="Red" className="bg-red-100 text-red-900 font-bold">V03: Red</option>
                      <option value="Black" className="bg-slate-900 text-white font-bold">V04: Black</option>
                      <option value="Green" className="bg-emerald-100 text-emerald-900 font-bold">V05: Green</option>
                      <option value="Rust" className="bg-amber-100 text-amber-950 font-bold">V06: Rust</option>
                      <option value="Blue" className="bg-blue-100 text-blue-900 font-bold">V07: Blue</option>
                      <option value="Purple" className="bg-purple-100 text-purple-900 font-bold">V08: Purple</option>
                      <option value="Yellow" className="bg-yellow-100 text-yellow-950 font-bold">V09: Yellow</option>
                      <option value="Orange" className="bg-orange-100 text-orange-950 font-bold">V10: Orange</option>
                      <option value="Skyblue" className="bg-sky-100 text-sky-950 font-bold">V11: Skyblue</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Extracted Specimen Straws Batch Table (Fully Editable & Compact Text) */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Specimen Straws Batch ({straws.length} Extracted Straws)</span>
                  </span>
                  <button
                    type="button"
                    onClick={addStrawRow}
                    className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                  >
                    <span>+ Add Straw</span>
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <table className="w-full text-left text-[9px]">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-1">Straw ID</th>
                        <th className="p-1">Color Tag</th>
                        <th className="p-1 text-center">Embryos</th>
                        <th className="p-1">Stage</th>
                        <th className="p-1">Grade</th>
                        <th className="p-1">Freezing Date</th>
                        <th className="p-1">Thaw Date</th>
                        <th className="p-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {straws.map((st, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 font-medium text-slate-800">
                          <td className="p-0.5">
                            <input
                              type="text"
                              value={st.strawId || ''}
                              onChange={(e) => updateStrawRow(idx, 'strawId', e.target.value)}
                              placeholder={`Straw #${idx + 1}`}
                              className="w-full bg-slate-50 border border-slate-300 rounded py-0.5 px-1 font-mono font-bold text-[8px]"
                            />
                          </td>
                          <td className="p-0.5">
                            <input
                              type="text"
                              value={st.colorTag || st.colorName || ''}
                              onChange={(e) => updateStrawRow(idx, 'colorTag', e.target.value)}
                              placeholder="Pink"
                              className="w-full bg-slate-50 border border-slate-300 rounded py-0.5 px-1 text-[8px]"
                            />
                          </td>
                          <td className="p-0.5 text-center">
                            <input
                              type="number"
                              min={1}
                              value={st.embryoCount ?? 1}
                              onChange={(e) => updateStrawRow(idx, 'embryoCount', parseInt(e.target.value, 10) || 1)}
                              className="w-8 bg-slate-50 border border-slate-300 rounded py-0.5 text-center font-bold text-emerald-700 text-[8px]"
                            />
                          </td>
                          <td className="p-0.5">
                            <input
                              type="text"
                              value={st.stage || ''}
                              onChange={(e) => updateStrawRow(idx, 'stage', e.target.value)}
                              placeholder="Day 5"
                              className="w-full bg-slate-50 border border-slate-300 rounded py-0.5 px-1 text-[8px]"
                            />
                          </td>
                          <td className="p-0.5">
                            <input
                              type="text"
                              value={st.grade || ''}
                              onChange={(e) => updateStrawRow(idx, 'grade', e.target.value)}
                              placeholder="4AA"
                              className="w-full bg-slate-50 border border-slate-300 rounded py-0.5 px-1 font-bold text-[8px]"
                            />
                          </td>
                          <td className="p-0.5">
                            <input
                              type="text"
                              value={st.freezingDate || freezingDate || ''}
                              onChange={(e) => updateStrawRow(idx, 'freezingDate', e.target.value)}
                              placeholder="YYYY-MM-DD"
                              className="w-full bg-slate-50 border border-slate-300 rounded py-0.5 px-1 font-mono text-[8px]"
                            />
                          </td>
                          <td className="p-0.5">
                            <input
                              type="text"
                              value={st.thawDate || thawDate || ''}
                              onChange={(e) => updateStrawRow(idx, 'thawDate', e.target.value)}
                              placeholder="YYYY-MM-DD"
                              className="w-full bg-slate-50 border border-amber-300 rounded py-0.5 px-1 font-mono text-[8px] text-amber-900 font-bold"
                            />
                          </td>
                          <td className="p-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeStrawRow(idx)}
                              className="p-0.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              title="Delete Straw"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[9px] text-slate-500 font-medium italic pt-0.5 flex items-center gap-1">
                  <span>✨ Edit any detected values above. Clicking Approve will automatically mark containers filled in Full Container View.</span>
                </p>
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

      {/* Crop & Rotate Image Studio Modal */}
      <ImageCropRotateModal
        isOpen={Boolean(cropModalFile)}
        imageFile={cropModalFile}
        title="Adjust & Rotate Document Scan Photo"
        onClose={() => setCropModalFile(null)}
        onConfirm={(processedFile) => {
          setFile(processedFile);
          setSuccessMsg('Photo adjusted & confirmed! Click "Process OCR & AI" to analyze.');
        }}
      />
    </div>
  );
};
