import React, { useState, useEffect, useRef } from 'react';
import { FileScan, Upload, CheckCircle2, ShieldAlert, FileText, Check, X, Sparkles, Camera, Crop, Sliders, Trash2, RotateCcw, RotateCw, Calendar, Plus, Dna, ShieldCheck, UserCheck, MapPin, Database, Printer, Edit3, Edit, AlertTriangle, Eye, Save, Search } from 'lucide-react';
import { apiRequest, formatDateDDMMYYYY, getApiBaseUrl, getImageUrl } from '../api/client';
import { DateInputDDMMYYYY, DoctorSelect, capitalizeWords, CLINIC_STRAW_COLORS, getStrawColorBadgeClass, formatRawToDDMMYYYYMask, normalizeFlexibleDateToDDMMYYYY, calculateAgeFromDob, calculateDobFromAge, getBatchSummaryText, getStrawStageSummary } from './PatientForm';
import { rotateImageFile, captureUprightCanvasFromVideo } from '../utils/imageUtils';
import { ImageCropRotateModal } from './ImageCropRotateModal';
import { useBackgroundTask } from '../context/BackgroundTaskContext';
import { detectSpecimenAndCycleFromRawText, SpecimenType, CycleClassificationType } from '../utils/ocrClassification';

const VISO_COLOR_TO_TUBE_CODE: Record<string, string> = {
  Pink: 'V01',
  Grey: 'V02',
  Red: 'V03',
  Black: 'V04',
  Green: 'V05',
  Rust: 'V06',
  Blue: 'V07',
  Purple: 'V08',
  Yellow: 'V09',
  Orange: 'V10',
  Skyblue: 'V11',
};

export interface FreezingGroupStraw {
  strawId?: string;
  colorTag: string;
  embryoCount: number;
  stage: string;
  grade: string;
  fragmentation: string;
  embryoGrades?: string[];
  embryoFrags?: string[];
  isThawing?: boolean;
  thawDate?: string;
  isCustomStage?: boolean;
}

export interface FreezingGroup {
  id: string;
  freezingDate: string;
  straws: FreezingGroupStraw[];
}

function calculateStageFromDates(
  retrievalDateStr: string,
  freezingDateStr: string,
  specimenType: SpecimenType = 'EMBRYO'
): string {
  if (specimenType === 'OOCYTE') return 'MII';
  if (specimenType === 'SPERM') return 'N/A';
  if (!retrievalDateStr || !freezingDateStr) return 'Day 5';

  const { iso: rIso } = normalizeFlexibleDateToDDMMYYYY(retrievalDateStr);
  const { iso: fIso } = normalizeFlexibleDateToDDMMYYYY(freezingDateStr);

  if (!rIso || !fIso) return 'Day 5';

  const rDate = new Date(rIso);
  const fDate = new Date(fIso);

  if (isNaN(rDate.getTime()) || isNaN(fDate.getTime())) return 'Day 5';

  const diffMs = fDate.getTime() - rDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 0) {
    return `Day ${diffDays}`;
  }
  return 'Day 5';
}

export interface OcrVerificationProps {
  onNavigateToPatient?: (patientId: string) => void;
  onNavigateToExistingPatientForm?: (patient: any, ocrPrefill?: any) => void;
}

export const OcrVerification: React.FC<OcrVerificationProps> = ({ onNavigateToPatient, onNavigateToExistingPatientForm }) => {
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
  const [specimenType, setSpecimenType] = useState<SpecimenType>('EMBRYO');
  const [cycleType, setCycleType] = useState<CycleClassificationType>('SELF');
  const [donorName, setDonorName] = useState('');
  const [donorRegNo, setDonorRegNo] = useState('');
  const [donorAge, setDonorAge] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [vitrificationIndication, setVitrificationIndication] = useState('Social egg freezing');
  const [oocyteStage, setOocyteStage] = useState('MII');
  const [visitDate, setVisitDate] = useState('');
  const [thawDate, setThawDate] = useState('');
  const [embryoCount, setEmbryoCount] = useState('');
  const [tankName, setTankName] = useState('CAN-01');
  const [canisterName, setCanisterName] = useState('');
  const [visoTubeColor, setVisoTubeColor] = useState('');
  const [visoTubeId, setVisoTubeId] = useState('');
  const [level, setLevel] = useState('');
  const [freezingGroups, setFreezingGroups] = useState<FreezingGroup[]>([
    {
      id: 'fg-1',
      freezingDate: '',
      straws: [
        { strawId: 'STR-01', colorTag: 'Pink', embryoCount: 1, stage: 'Day 5', grade: '4AA', fragmentation: 'No' },
      ],
    },
  ]);
  const [comments, setComments] = useState('');
  const [existingIdMatch, setExistingIdMatch] = useState<any | null>(null);
  const [isIdVerifiedUnique, setIsIdVerifiedUnique] = useState(false);
  const [idChecking, setIdChecking] = useState(false);
  const [isIdSavedEffect, setIsIdSavedEffect] = useState(false);

  const checkRegistrationIdInstant = async (idToTest?: string) => {
    const val = (idToTest !== undefined ? idToTest : patientId).trim();
    if (!val || val.length < 2) {
      setExistingIdMatch(null);
      setIsIdVerifiedUnique(false);
      return;
    }
    setIdChecking(true);
    try {
      const res = await apiRequest(`/api/patients?q=${encodeURIComponent(val)}&limit=50`);
      if (res.success && res.patients && res.patients.length > 0) {
        const exactMatch = res.patients.find(
          (p: any) => p.patientId && p.patientId.trim().toLowerCase() === val.toLowerCase()
        );
        if (exactMatch) {
          setExistingIdMatch(exactMatch);
          setIsIdVerifiedUnique(false);
        } else {
          setExistingIdMatch(null);
          setIsIdVerifiedUnique(true);
        }
      } else {
        setExistingIdMatch(null);
        setIsIdVerifiedUnique(true);
      }
    } catch {
      setExistingIdMatch(null);
      setIsIdVerifiedUnique(false);
    } finally {
      setIdChecking(false);
    }
  };

  const handleSaveRegistrationId = async () => {
    await checkRegistrationIdInstant(patientId);
    setIsIdSavedEffect(true);
    setTimeout(() => {
      setIsIdSavedEffect(false);
    }, 2500);
  };

  useEffect(() => {
    if (!patientId || patientId.trim().length < 2) {
      setExistingIdMatch(null);
      setIsIdVerifiedUnique(false);
      return;
    }
    const timer = setTimeout(() => {
      checkRegistrationIdInstant(patientId);
    }, 50);
    return () => clearTimeout(timer);
  }, [patientId]);

  const [savingToExisting, setSavingToExisting] = useState(false);

  const handleSavePictureAndFillExisting = async () => {
    if (!existingIdMatch || !activeRecord) return;
    setSavingToExisting(true);

    // Detect Specimen Type Frozen & Cycle Classification according to raw text & structured fields
    let extractedFieldsObj: any = {};
    if (activeRecord.structuredFields) {
      extractedFieldsObj = activeRecord.structuredFields;
    } else if (typeof activeRecord.extractedJson === 'string') {
      try {
        extractedFieldsObj = JSON.parse(activeRecord.extractedJson);
      } catch {
        extractedFieldsObj = {};
      }
    } else if (typeof activeRecord.extractedJson === 'object' && activeRecord.extractedJson !== null) {
      extractedFieldsObj = activeRecord.extractedJson;
    }

    const detected = detectSpecimenAndCycleFromRawText(
      activeRecord.rawOcrText,
      extractedFieldsObj
    );
    const resolvedSpecimen = specimenType || detected.specimenType;
    const resolvedCycle = cycleType || detected.cycleType;

    const ocrPrefill = {
      specimenType: resolvedSpecimen,
      cycleType: resolvedCycle,
      rawOcrText: activeRecord.rawOcrText || '',
      structuredFields: extractedFieldsObj,
    };

    try {
      // 1. Attach picture/OCR record to existing patient
      try {
        await apiRequest('/api/ocr/attach-existing', {
          method: 'POST',
          body: JSON.stringify({
            ocrRecordId: activeRecord.id,
            patientId: existingIdMatch.id,
          }),
        });
      } catch (attachErr) {
        console.warn('Could not attach via /api/ocr/attach-existing, attempting document fallback:', attachErr);
        if (activeRecord.storageKey && activeRecord.storageKey.startsWith('data:')) {
          try {
            const formData = new FormData();
            const res = await fetch(activeRecord.storageKey);
            const blob = await res.blob();
            formData.append('document', blob, activeRecord.originalFilename || `scan_${Date.now()}.jpg`);
            await apiRequest(`/api/patients/${existingIdMatch.id}/documents`, {
              method: 'POST',
              body: formData,
            });
          } catch (docErr) {
            console.error('Fallback document upload failed:', docErr);
          }
        }
      }

      // 2. Remove activeRecord from pending list locally
      setPendingRecords((prev) => prev.filter((r) => r.id !== activeRecord.id));
      setActiveRecord(null);

      // 3. Redirect to existing patient form with only registration number & existing patient loaded plus detected specimen & cycle selection (no cryo data)
      if (onNavigateToExistingPatientForm) {
        onNavigateToExistingPatientForm(existingIdMatch, ocrPrefill);
      } else if (onNavigateToPatient) {
        onNavigateToPatient(existingIdMatch.id);
      }
    } catch (err: any) {
      console.error('Error saving picture to existing patient:', err);
      if (onNavigateToExistingPatientForm) {
        onNavigateToExistingPatientForm(existingIdMatch, ocrPrefill);
      }
    } finally {
      setSavingToExisting(false);
    }
  };

  const handleSelectExistingPatient = (existing: any) => {
    if (!existing) return;
    if (onNavigateToPatient) {
      onNavigateToPatient(existing.id);
    }
  };

  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [savedSummaryModalData, setSavedSummaryModalData] = useState<any | null>(null);

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
          setFile(photoFile);
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
    const initialDob = json.dob || '';
    const initialPartnerDob = json.partnerDob || '';
    setDob(initialDob);
    setPartnerDob(initialPartnerDob);
    setPatientAge(json.patientAge || (initialDob ? calculateAgeFromDob(initialDob) : ''));
    setPartnerAge(json.partnerAge || (initialPartnerDob ? calculateAgeFromDob(initialPartnerDob) : ''));
    setDoctorName(json.doctorName || '');
    const detected = detectSpecimenAndCycleFromRawText(record.rawOcrText, json);
    setSpecimenType(detected.specimenType);
    setCycleType(detected.cycleType);
    setDonorName(json.donorName || '');
    setDonorRegNo(json.donorRegNo || '');
    setDonorAge(json.donorAge || '');
    setDonorPhone(json.donorPhone || '');
    setVitrificationIndication(json.vitrificationIndication || 'Social egg freezing');
    setOocyteStage(json.oocyteStage || 'MII');
    setVisitDate(json.visitDate || json.aspirationDate || '');
    setThawDate(json.thawDate || '');
    setEmbryoCount(json.embryoCount ? String(json.embryoCount) : '');

    // Parse Can No / Cryotank (tankName / canNo) strictly from JSON and raw text (NOT canister!)
    let parsedTank = (json.tankName || json.canNo || json.canNumber || json.tank || '').trim();
    if (parsedTank) {
      const match = parsedTank.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 30) {
          parsedTank = `CAN-${num.toString().padStart(2, '0')}`;
        }
      }
    } else if (record.rawOcrText) {
      const raw = record.rawOcrText;
      const comboMatch = raw.match(/(?:Can|Tank)\s*\/\s*Canister[\s#.:-]*(\d{1,2})/i);
      const canisterComboMatch = raw.match(/Canister\s*\/\s*(?:Can|Tank)[\s#.:-]*\d+[\s\/-]+(\d{1,2})/i);
      const canNoMatch = raw.match(/\b(?:Cryo\s*(?:Tank|Can)|Cryotank|Cryocan|LN2\s*Tank|\bTank|\bCan(?!\s*ist))\b(?:\s*(?:Number|Num\.?|No\.?|#))?[\s#.:=-]*(\d{1,2})\b/i);
      const explicitCodeMatch = raw.match(/\b(?:CAN|TANK)-?(\d{1,2})\b/i);
      const simpleCanMatch = raw.match(/\b(?:Cryo\s*(?:Tank|Can)|Cryotank|Cryocan|LN2\s*Tank|\bTank|\bCan(?!\s*ist))\b[\s#.:=-]+(\d{1,2})\b/i);
      const numMatch = comboMatch || canisterComboMatch || canNoMatch || explicitCodeMatch || simpleCanMatch;
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num >= 1 && num <= 30) {
          parsedTank = `CAN-${num.toString().padStart(2, '0')}`;
        }
      }
    }
    setTankName(parsedTank || 'CAN-01');

    // Parse Canister Name (strictly canister, NOT Can No!)
    let parsedCanister = (json.canisterName || json.canister || '').trim();
    if (parsedCanister) {
      const match = parsedCanister.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 30) {
          parsedCanister = `C${num.toString().padStart(2, '0')}`;
        }
      }
    } else if (record.rawOcrText) {
      const raw = record.rawOcrText;
      const comboCanister = raw.match(/(?:Can|Tank)\s*\/\s*Canister[\s#.:-]*\d+[\s\/-]+(\d{1,2})/i);
      const canisterCombo = raw.match(/Canister\s*\/\s*(?:Can|Tank)[\s#.:-]*(\d{1,2})/i);
      const canisterMatch = raw.match(/(?:Canister|cryo\s*canister)(?:\s*(?:Number|Num\.?|No\.?|#))?[\s#.:=-]*([A-Za-z0-9]+)/i);
      const cCodeMatch = raw.match(/\bC(0[1-9]|1[0-9]|20)\b/i);
      if (comboCanister) {
        const num = parseInt(comboCanister[1], 10);
        if (num >= 1 && num <= 30) parsedCanister = `C${num.toString().padStart(2, '0')}`;
      } else if (canisterCombo) {
        const num = parseInt(canisterCombo[1], 10);
        if (num >= 1 && num <= 30) parsedCanister = `C${num.toString().padStart(2, '0')}`;
      } else if (canisterMatch) {
        const digits = canisterMatch[1].replace(/\D/g, '');
        if (digits) {
          const num = parseInt(digits, 10);
          if (num >= 1 && num <= 30) parsedCanister = `C${num.toString().padStart(2, '0')}`;
        }
      } else if (cCodeMatch) {
        parsedCanister = cCodeMatch[0].toUpperCase();
      }
    }
    setCanisterName(parsedCanister);

    // Parse Viso Tube / Straw Color (11 Colors)
    let col = (json.visoTubeColor || '').trim();
    if (col.match(/pink/i)) col = 'Pink';
    else if (col.match(/grey|gray/i)) col = 'Grey';
    else if (col.match(/red/i)) col = 'Red';
    else if (col.match(/black/i)) col = 'Black';
    else if (col.match(/green/i)) col = 'Green';
    else if (col.match(/rust/i)) col = 'Rust';
    else if (col.match(/blue/i) && !col.match(/sky/i)) col = 'Blue';
    else if (col.match(/purple/i)) col = 'Purple';
    else if (col.match(/yellow/i)) col = 'Yellow';
    else if (col.match(/orange/i)) col = 'Orange';
    else if (col.match(/sky/i)) col = 'Skyblue';
    else col = '';
    setVisoTubeColor(col);

    // Parse Viso Tube ID / Goblet directly from raw text (V01 to V11)
    let gob = (json.visoTubeId || json.goblet || json.tubeNumber || '').trim();
    if (gob) {
      const gMatch = gob.match(/(\d+)/);
      if (gMatch) {
        const gNum = parseInt(gMatch[1], 10);
        if (gNum >= 1 && gNum <= 11) {
          gob = `V${gNum.toString().padStart(2, '0')}`;
        }
      } else if (gob.match(/yellow/i)) gob = 'V09';
      else if (gob.match(/pink/i)) gob = 'V01';
      else if (gob.match(/green/i)) gob = 'V05';
      else if (gob.match(/blue/i)) gob = 'V07';
      else if (gob.match(/red/i)) gob = 'V03';
      else if (gob.match(/grey|gray/i)) gob = 'V02';
      else if (gob.match(/black/i)) gob = 'V04';
      else if (gob.match(/purple/i)) gob = 'V08';
      else if (gob.match(/orange/i)) gob = 'V10';
      else if (gob.match(/sky/i)) gob = 'V11';
    } else if (col && VISO_COLOR_TO_TUBE_CODE[col]) {
      gob = VISO_COLOR_TO_TUBE_CODE[col];
    }
    setVisoTubeId(gob);

    // Parse Level / Tier directly from raw text
    let lvl = (json.level || '').trim();
    if (lvl) {
      if (lvl.match(/2|top|II$/i)) lvl = 'Level 2';
      else if (lvl.match(/1|bottom|I$/i)) lvl = 'Level 1';
      else lvl = '';
    }
    setLevel(lvl);

    const defaultStrawColor = CLINIC_STRAW_COLORS.includes(col as any) ? col : 'Pink';
    const mainFreezingDate = json.freezingDate ? (json.freezingDate.includes('/') ? json.freezingDate : formatDateDDMMYYYY(json.freezingDate)) : '';
    const currentSpecimenType = (json.specimenType || (json.vitrificationIndication || json.donorName || json.oocyteStage ? 'OOCYTE' : 'EMBRYO')).toUpperCase() as any;
    const defaultGrade = currentSpecimenType === 'OOCYTE' ? (json.oocyteStage || 'MII') : '4AA';
    const defaultStage = currentSpecimenType === 'OOCYTE' ? (json.oocyteStage || 'MII') : 'Day 5';

    const rawStraws = Array.isArray(json.straws) && json.straws.length > 0
      ? json.straws
      : [{ strawId: 'STR-01', colorTag: defaultStrawColor, embryoCount: 1, stage: defaultStage, grade: defaultGrade, fragmentation: 'No', freezingDate: mainFreezingDate }];

    // Group straws by freezingDate
    const groupedMap = new Map<string, any[]>();
    rawStraws.forEach((s: any) => {
      let sCol = (s.colorTag || s.colorName || '').trim();
      if (sCol.match(/pink/i)) sCol = 'Pink';
      else if (sCol.match(/green/i)) sCol = 'Green';
      else if (sCol.match(/blue/i) && !sCol.match(/sky/i)) sCol = 'Blue';
      else if (sCol.match(/yellow/i)) sCol = 'Yellow';
      else if (sCol.match(/white/i)) sCol = 'White';
      else if (CLINIC_STRAW_COLORS.includes(col as any)) sCol = col;
      else sCol = 'Pink';

      const sDateRaw = s.freezingDate || mainFreezingDate;
      const sDate = sDateRaw ? (sDateRaw.includes('/') ? sDateRaw : formatDateDDMMYYYY(sDateRaw)) : '';
      const groupKey = sDate || '__default__';

      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, []);
      }

      const autoStage = calculateStageFromDates(json.visitDate || json.aspirationDate || '', sDate, currentSpecimenType) || defaultStage;
      const count = Math.max(1, s.embryoCount ?? 1);
      let initGrades: string[] = [];
      let initGradeStr = (s.grade || defaultGrade).toString().trim();

      if (currentSpecimenType === 'OOCYTE') {
        const defaultOocyteStg = ['MII', 'MI', 'GV'].includes(initGradeStr) ? initGradeStr : 'MII';
        if (Array.isArray(s.embryoGrades) && s.embryoGrades.length > 0) {
          initGrades = Array.from({ length: count }, (_, i) => {
            const g = (s.embryoGrades[i] || defaultOocyteStg).trim();
            return ['MII', 'MI', 'GV'].includes(g) ? g : defaultOocyteStg;
          });
        } else if (initGradeStr.includes(',')) {
          const split = initGradeStr.split(',').map((g: string) => g.trim());
          initGrades = Array.from({ length: count }, (_, i) => {
            const g = split[i] || defaultOocyteStg;
            return ['MII', 'MI', 'GV'].includes(g) ? g : defaultOocyteStg;
          });
        } else {
          initGrades = Array.from({ length: count }, () => defaultOocyteStg);
        }
        initGradeStr = initGrades.join(', ');
      } else {
        // EMBRYO
        if (Array.isArray(s.embryoGrades) && s.embryoGrades.length > 0) {
          initGrades = Array.from({ length: count }, (_, i) => s.embryoGrades[i] || initGradeStr || '4AA');
        } else if (initGradeStr.includes(',')) {
          const split = initGradeStr.split(',').map((g: string) => g.trim());
          initGrades = Array.from({ length: count }, (_, i) => split[i] || '4AA');
        } else {
          initGrades = Array.from({ length: count }, () => initGradeStr || '4AA');
        }
        initGradeStr = initGrades.join(', ');
      }

      const initFrags = Array.from({ length: count }, (_, i) => (s.embryoFrags?.[i] ?? (i === 0 ? (s.fragmentation || 'No') : 'No')));

      groupedMap.get(groupKey)!.push({
        strawId: s.strawId || `STR-0${groupedMap.get(groupKey)!.length + 1}`,
        colorTag: sCol,
        embryoCount: count,
        stage: autoStage,
        grade: initGradeStr,
        fragmentation: s.fragmentation || 'No',
        embryoGrades: initGrades,
        embryoFrags: initFrags,
        isThawing: s.isThawing,
        thawDate: s.thawDate || json.thawDate || '',
      });
    });

    const parsedGroups: FreezingGroup[] = [];
    let gCounter = 1;
    groupedMap.forEach((strawList, key) => {
      const gDate = key === '__default__' ? mainFreezingDate : key;
      parsedGroups.push({
        id: `fg-${gCounter++}`,
        freezingDate: gDate,
        straws: strawList,
      });
    });

    if (parsedGroups.length === 0) {
      parsedGroups.push({
        id: 'fg-1',
        freezingDate: mainFreezingDate,
        straws: [{ strawId: 'STR-01', colorTag: defaultStrawColor, embryoCount: 1, stage: defaultStage, grade: defaultGrade, embryoGrades: [defaultGrade], fragmentation: 'No' }],
      });
    }

    setFreezingGroups(parsedGroups);
    setComments(json.comments || '');
  };

  const handleVisitDateChange = (val: string) => {
    setVisitDate(val);
    const { formatted } = normalizeFlexibleDateToDDMMYYYY(val);
    const dateToUse = formatted || val;

    setFreezingGroups((prevGroups) =>
      prevGroups.map((group) => {
        const computedStage = calculateStageFromDates(dateToUse, group.freezingDate, specimenType);
        return {
          ...group,
          straws: group.straws.map((st) => ({
            ...st,
            stage: computedStage,
          })),
        };
      })
    );
  };

  const updateGroupFreezingDate = (groupIdx: number, newDate: string) => {
    setFreezingGroups((prevGroups) => {
      const next = [...prevGroups];
      const targetGroup = { ...next[groupIdx] };
      targetGroup.freezingDate = newDate;

      const { formatted } = normalizeFlexibleDateToDDMMYYYY(newDate);
      const dateToUse = formatted || newDate;
      const computedStage = calculateStageFromDates(visitDate, dateToUse, specimenType);

      targetGroup.straws = targetGroup.straws.map((st) => ({
        ...st,
        stage: computedStage,
      }));
      next[groupIdx] = targetGroup;
      return next;
    });
  };

  const addStrawToGroup = (groupIdx: number) => {
    setFreezingGroups((prevGroups) => {
      const next = [...prevGroups];
      const targetGroup = { ...next[groupIdx] };
      const defaultColor = CLINIC_STRAW_COLORS.includes(visoTubeColor as any) ? visoTubeColor : 'Pink';
      const autoStage = calculateStageFromDates(visitDate, targetGroup.freezingDate, specimenType);
      const totalStraws = prevGroups.reduce((acc, g) => acc + g.straws.length, 0);
      const defaultGrade = specimenType === 'OOCYTE' ? (oocyteStage || 'MII') : '4AA';

      const newStraw: FreezingGroupStraw = {
        strawId: `STR-0${totalStraws + 1}`,
        colorTag: targetGroup.straws[0]?.colorTag || defaultColor,
        embryoCount: 1,
        stage: autoStage,
        grade: defaultGrade,
        embryoGrades: [defaultGrade],
        embryoFrags: ['No'],
        fragmentation: 'No',
        thawDate: '',
      };

      targetGroup.straws = [...targetGroup.straws, newStraw];
      next[groupIdx] = targetGroup;
      return next;
    });
  };

  const handleSpecimenTypeChange = (type: SpecimenType) => {
    setSpecimenType(type);
    const defaultGrade = type === 'OOCYTE' ? (oocyteStage || 'MII') : type === 'SPERM' ? 'N/A' : '4AA';
    const defaultStage = type === 'OOCYTE' ? (oocyteStage || 'MII') : type === 'SPERM' ? 'N/A' : 'Day 5';

    setFreezingGroups((prevGroups) =>
      prevGroups.map((group) => {
        const computedStage = calculateStageFromDates(visitDate, group.freezingDate, type) || defaultStage;
        return {
          ...group,
          straws: group.straws.map((st) => {
            const count = st.embryoCount || 1;
            if (type === 'OOCYTE') {
              const defaultOocyteStg = ['MII', 'MI', 'GV'].includes(st.grade || '') ? (st.grade || 'MII') : (oocyteStage || 'MII');
              const newGrades = Array.from({ length: count }, (_, i) => (st.embryoGrades?.[i] && ['MII', 'MI', 'GV'].includes(st.embryoGrades[i]) ? st.embryoGrades[i] : defaultOocyteStg));
              return {
                ...st,
                stage: computedStage,
                grade: newGrades.join(', '),
                embryoGrades: newGrades,
              };
            } else if (type === 'SPERM') {
              return {
                ...st,
                stage: 'N/A',
                grade: 'N/A',
                embryoGrades: Array.from({ length: count }, () => 'N/A'),
              };
            } else {
              const newGrades = Array.from({ length: count }, (_, i) => (st.embryoGrades?.[i] && !['MII', 'MI', 'GV'].includes(st.embryoGrades[i]) ? st.embryoGrades[i] : '4AA'));
              return {
                ...st,
                stage: computedStage,
                grade: newGrades.join(', '),
                embryoGrades: newGrades,
              };
            }
          }),
        };
      })
    );
  };

  const addNewFreezingDateGroup = () => {
    setFreezingGroups((prevGroups) => {
      const defaultColor = CLINIC_STRAW_COLORS.includes(visoTubeColor as any) ? visoTubeColor : 'Pink';
      const totalStraws = prevGroups.reduce((acc, g) => acc + g.straws.length, 0);
      const defaultGrade = specimenType === 'OOCYTE' ? (oocyteStage || 'MII') : '4AA';
      const defaultStage = specimenType === 'OOCYTE' ? (oocyteStage || 'MII') : 'Day 5';

      const newGroup: FreezingGroup = {
        id: `fg-${Date.now()}`,
        freezingDate: '',
        straws: [
          {
            strawId: `STR-0${totalStraws + 1}`,
            colorTag: defaultColor,
            embryoCount: 1,
            stage: defaultStage,
            grade: defaultGrade,
            embryoGrades: [defaultGrade],
            embryoFrags: ['No'],
            fragmentation: 'No',
            thawDate: '',
          },
        ],
      };
      return [...prevGroups, newGroup];
    });
  };

  const removeGroup = (groupIdx: number) => {
    setFreezingGroups((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== groupIdx) : prev));
  };

  const updateStrawInGroup = (groupIdx: number, strawIdx: number, field: string, val: any) => {
    setFreezingGroups((prevGroups) => {
      const next = [...prevGroups];
      const targetGroup = { ...next[groupIdx] };
      const targetStraws = [...targetGroup.straws];
      targetStraws[strawIdx] = {
        ...targetStraws[strawIdx],
        [field]: val,
      };
      targetGroup.straws = targetStraws;
      next[groupIdx] = targetGroup;
      return next;
    });
  };

  const removeStrawFromGroup = (groupIdx: number, strawIdx: number) => {
    setFreezingGroups((prevGroups) => {
      const next = [...prevGroups];
      const targetGroup = { ...next[groupIdx] };
      if (targetGroup.straws.length > 1) {
        targetGroup.straws = targetGroup.straws.filter((_, i) => i !== strawIdx);
        next[groupIdx] = targetGroup;
      } else if (next.length > 1) {
        return prevGroups.filter((_, i) => i !== groupIdx);
      }
      return next;
    });
  };

  const updateStrawRow = (index: number, field: string, value: any) => {
    setStraws((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      // Only pre-select remaining straws if user explicitly selects a color for Straw 1 (index === 0)
      if (index === 0 && field === 'colorTag' && value) {
        for (let k = 1; k < copy.length; k++) {
          copy[k] = { ...copy[k], colorTag: value };
        }
      }
      return copy;
    });
  };

  const removeStrawRow = (index: number) => {
    setStraws((prev) => prev.filter((_, i) => i !== index));
  };

  const compressImageForFastUpload = async (inputFile: File): Promise<File> => {
    if (!inputFile.type.startsWith('image/') && !inputFile.name.match(/\.(heic|heif|png|jpe?g|webp)$/i)) {
      return inputFile;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(inputFile);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDimension = 1800; // 1800px ensures ultra-sharp OCR text reading while shrinking 15MB file to ~300KB
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File(
                  [blob],
                  inputFile.name.replace(/\.[^/.]+$/, '') + '.jpg',
                  { type: 'image/jpeg' }
                );
                resolve(compressedFile);
              } else {
                resolve(inputFile);
              }
            },
            'image/jpeg',
            0.88
          );
        } else {
          resolve(inputFile);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(inputFile);
      };
      img.src = url;
    });
  };

  const processFileForOcr = async (targetFile: File) => {
    if (!targetFile) return;

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const optimizedFile = await compressImageForFastUpload(targetFile);
      setFile(optimizedFile);

      const token = localStorage.getItem('access_token');
      const accessKey = localStorage.getItem('app_access_key') || 'clinic2026';

      const formData = new FormData();
      formData.append('image', optimizedFile);

      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/ocr/upload`, {
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

      setSuccessMsg('OCR Scan processed successfully! Patient & specimen details auto-filled on the right.');
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (file) {
      processFileForOcr(file);
    }
  };

  // Step 1: Open Summary Review Popup Modal INSTANTLY (Zero API / network calls made here!)
  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRecord) return;
    if (!fullName || !fullName.trim()) {
      setError('Patient Full Name is required before reviewing summary.');
      return;
    }

    setError(null);
    setSuccessMsg(null);

    const summaryObj = {
      patientId: patientId.trim() || 'AUTO-ASSIGN (Generated on Save)',
      fullName: fullName.trim(),
      partnerName: partnerName.trim() || undefined,
      phone: phone.trim() || undefined,
      partnerPhone: partnerPhone.trim() || undefined,
      email: email.trim() || undefined,
      partnerEmail: partnerEmail.trim() || undefined,
      patientAge: patientAge.trim() || undefined,
      partnerAge: partnerAge.trim() || undefined,
      doctorName: doctorName.trim() || undefined,
      specimenType,
      cycleType,
      donorName: donorName.trim() || undefined,
      donorRegNo: donorRegNo.trim() || undefined,
      donorAge: donorAge.trim() || undefined,
      donorPhone: donorPhone.trim() || undefined,
      vitrificationIndication: vitrificationIndication.trim() || undefined,
      oocyteStage: oocyteStage.trim() || undefined,
      visitDate,
      thawDate: thawDate || undefined,
      comments: comments.trim() || undefined,
      storageLocation: {
        tankName,
        canisterName,
        level,
        visoTubeId,
        visoTubeColor,
      },
      freezingGroups: freezingGroups.map((group) => ({
        ...group,
        straws: group.straws.map((st) => {
          const eCount = st.embryoCount || 1;
          let finalGrades = st.embryoGrades;
          if (!finalGrades || finalGrades.length < eCount) {
            if (specimenType === 'OOCYTE') {
              const defaultStg = ['MII', 'MI', 'GV'].includes(st.grade || '') ? st.grade : (oocyteStage || 'MII');
              finalGrades = Array.from({ length: eCount }, (_, i) => st.embryoGrades?.[i] || defaultStg);
            } else {
              const defaultStg = st.grade || '4AA';
              finalGrades = Array.from({ length: eCount }, (_, i) => st.embryoGrades?.[i] || defaultStg);
            }
          }
          return {
            ...st,
            embryoGrades: finalGrades,
            grade: finalGrades.join(', '),
            calculatedStage: calculateStageFromDates(visitDate, group.freezingDate, specimenType),
          };
        }),
      })),
      totalStraws: freezingGroups.reduce((acc, g) => acc + g.straws.length, 0),
      totalEmbryos: freezingGroups.reduce((acc, g) => acc + g.straws.reduce((sAcc, st) => sAcc + (st.embryoCount || 1), 0), 0),
    };

    setSavedSummaryModalData(summaryObj);
  };

  const { enqueueTask } = useBackgroundTask();

  // Step 2: Final Database Commit queued in background popup when clicking "Done & Finish"
  const executeFinalSaveToDatabase = async () => {
    if (!activeRecord) return;

    const currentRecordId = activeRecord.id;
    const currentFullName = fullName.trim() || 'Patient Record';
    const currentPatientId = patientId.trim() || 'AUTO';

    const flattenedStraws = freezingGroups.flatMap((group) =>
      group.straws.map((st) => {
        const eCount = st.embryoCount || 1;
        let finalGrades = st.embryoGrades;
        if (!finalGrades || finalGrades.length < eCount) {
          if (specimenType === 'OOCYTE') {
            const defaultStg = ['MII', 'MI', 'GV'].includes(st.grade || '') ? st.grade : (oocyteStage || 'MII');
            finalGrades = Array.from({ length: eCount }, (_, i) => st.embryoGrades?.[i] || defaultStg);
          } else {
            const defaultStg = st.grade || '4AA';
            finalGrades = Array.from({ length: eCount }, (_, i) => st.embryoGrades?.[i] || defaultStg);
          }
        }
        return {
          ...st,
          embryoGrades: finalGrades,
          grade: finalGrades.join(', '),
          stage: st.stage || calculateStageFromDates(visitDate, group.freezingDate, specimenType),
          freezingDate: group.freezingDate || undefined,
        };
      })
    );
    const primaryFreezingDate = freezingGroups.find((g) => g.freezingDate)?.freezingDate || undefined;

    const verifyPayload = {
      ocrRecordId: currentRecordId,
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
      specimenType,
      cycleType,
      donorName: donorName.trim() || undefined,
      donorRegNo: donorRegNo.trim() || undefined,
      donorAge: donorAge.trim() || undefined,
      donorPhone: donorPhone.trim() || undefined,
      vitrificationIndication: vitrificationIndication.trim() || undefined,
      oocyteStage: oocyteStage.trim() || undefined,
      aspirationDate: visitDate || undefined,
      visitDate: visitDate || undefined,
      freezingDate: primaryFreezingDate,
      thawDate: thawDate || undefined,
      tankName: tankName.trim() || undefined,
      canNo: tankName.trim() || undefined,
      canisterName: canisterName.trim() || undefined,
      visoTubeColor: visoTubeColor.trim() || undefined,
      visoTubeId: visoTubeId.trim() || undefined,
      level: level.trim() || undefined,
      straws: flattenedStraws.length > 0 ? flattenedStraws : undefined,
      comments: comments.trim() || undefined,
    };

    // INSTANTLY close modal & clear active record so staff can scan/edit next patient without waiting!
    setSavedSummaryModalData(null);
    setActiveRecord(null);
    setSuccessMsg(`🚀 Patient record for "${currentFullName}" queued for background database save. You can scan more patients now!`);

    enqueueTask({
      title: `Saving Patient Record: ${currentFullName}`,
      description: `Allocating Viso Tube & saving patient cryogenic straws`,
      action: async () => {
        const res = await apiRequest('/api/ocr/verify', {
          method: 'POST',
          body: JSON.stringify(verifyPayload),
        });
        if (!res.success) {
          throw new Error(res.error || 'Failed to save patient record to database.');
        }
        return res;
      },
      onSuccess: () => {
        fetchPendingRecords();
        try {
          clearApiCache();
          window.dispatchEvent(new CustomEvent('storage-updated'));
        } catch (e) { }
      },
    });
  };

  const handleEditDetailsFromSummary = (section?: string) => {
    setSavedSummaryModalData(null);
    setSuccessMsg('✏️ Edit Mode Active: You can modify any fields below and click "Save & Verify Record" to update.');
    setTimeout(() => {
      let targetId = 'ocr-verification-form';
      if (section === 'patient') targetId = 'ocr-patient-profile-section';
      else if (section === 'storage') targetId = 'ocr-storage-location-section';
      else if (section === 'straws') targetId = 'ocr-straw-allocation-section';

      const el = document.getElementById(targetId) || document.getElementById('ocr-verification-form');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
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
            processFileForOcr(e.target.files[0]);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <FileScan className="w-7 h-7 text-emerald-600" />
            <span>Scan Past Patient and add their data in the platform</span>
          </h1>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Upload scanned document or photo for automated structured patient & specimen extraction.
          </p>
        </div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            <span>Upload Document Scan or Take Photo</span>
          </h2>

          <div className="flex items-center gap-2">
            {/* Direct Mobile Camera App Trigger */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-white" />
              <span>Camera Photo</span>
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
                  processFileForOcr(selected);
                }
                e.target.value = '';
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-700 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800"
            />
            {uploading && (
              <div className="flex items-center gap-2 mt-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-xs font-bold text-emerald-800">
                <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Processing Document Scan with Gemini AI Vision... Please wait</span>
              </div>
            )}
          </div>
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
        <div>
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
                src={getImageUrl(activeRecord.storageKey)}
                alt="Scanned Record"
                className="max-h-[700px] w-auto object-contain rounded-xl border border-slate-200 shadow-sm"
                onError={(e) => {
                  (e.target as any).style.display = 'none';
                }}
              />
            </div>

            {/* <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Google Lens Raw Output:</div>
              <pre className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[11px] font-mono text-slate-800 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {activeRecord.rawOcrText}
              </pre>
            </div> */}
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
              {/* Specimen & Cycle Type Selection (Embryo vs Egg / Self vs Donor) */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Specimen Type Selector */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Specimen Type *
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-white border border-slate-300 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleSpecimenTypeChange('EMBRYO')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${specimenType === 'EMBRYO'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Embryo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpecimenTypeChange('OOCYTE')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${specimenType === 'OOCYTE'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Egg (Oocyte)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSpecimenTypeChange('SPERM')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${specimenType === 'SPERM'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Sperm
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Cycle / Donor Type *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-white border border-slate-300 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setCycleType('SELF')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${cycleType === 'SELF'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Self Cycle
                      </button>
                      <button
                        type="button"
                        onClick={() => setCycleType('DONOR_RECIPIENT')}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${cycleType === 'DONOR_RECIPIENT'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        Donor / Recipient
                      </button>
                    </div>
                  </div>
                </div>

                {/* Egg Freezing Clinical Details (Rendered if Egg/Oocyte specimen) */}
                {specimenType === 'OOCYTE' && (
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2.5">
                    <div className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center justify-between">
                      <span>Egg Freezing Details</span>
                      <span className="bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded text-[9px] font-bold">OOCYTE SPECS</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 text-[10px]">Vitrification Indication</label>
                        <select
                          value={vitrificationIndication}
                          onChange={(e) => setVitrificationIndication(e.target.value)}
                          className="w-full bg-white border border-indigo-300 rounded-lg p-2 text-slate-900 font-medium text-xs focus:outline-none focus:border-indigo-500"
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

                {/* Donor Details Card (Rendered if Donor Cycle is active or Supernumerary Donor Egg Freezing) */}
                {(cycleType === 'DONOR_RECIPIENT' || (specimenType === 'OOCYTE' && vitrificationIndication === 'Supernumerary donor egg freezing') || donorName || donorRegNo) && (
                  <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5">
                    <div className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center justify-between">
                      <span>Donor Profile Information (D-R Cycle)</span>
                      <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded text-[9px] font-bold">DONOR RECORD</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 text-[10px]">Donor Reg No. / Code</label>
                        <input
                          type="text"
                          value={donorRegNo}
                          onChange={(e) => setDonorRegNo(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg p-2 text-slate-900 font-mono font-bold text-xs"
                          placeholder="e.g. D-9948"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 text-[10px]">Donor Name</label>
                        <input
                          type="text"
                          value={donorName}
                          onChange={(e) => setDonorName(capitalizeWords(e.target.value))}
                          className="w-full bg-white border border-amber-300 rounded-lg p-2 text-slate-900 font-bold text-xs"
                          placeholder="Donor Name"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 text-[10px]">Donor Age</label>
                        <input
                          type="text"
                          value={donorAge}
                          onChange={(e) => setDonorAge(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg p-2 text-slate-900 font-medium text-xs"
                          placeholder="e.g. 24 Yrs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 text-[10px]">Donor Mobile Phone</label>
                        <input
                          type="text"
                          value={donorPhone}
                          onChange={(e) => setDonorPhone(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-lg p-2 text-slate-900 font-mono text-xs"
                          placeholder="e.g. +91 98765 43210"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700">Registration ID</label>
                    {idChecking && (
                      <span className="text-xs text-slate-500 font-normal animate-pulse flex items-center gap-1">
                        <Search className="w-3 h-3 text-slate-400" /> Checking availability...
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      checkRegistrationIdInstant(pasted);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-mono font-bold"
                    placeholder="e.g. IVF-2026-000007"
                  />

                  {existingIdMatch && (
                    <div className="mt-2.5 p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-900 font-medium animate-in fade-in shadow-2xs flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Patient with Registration ID <strong>{existingIdMatch.patientId}</strong> already exists: <strong>{existingIdMatch.fullName}</strong>.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={savingToExisting}
                          onClick={handleSavePictureAndFillExisting}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 active:scale-95"
                          title="Save this scanned picture to patient documents and fill form manually"
                        >
                          {savingToExisting ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          <span>Save Picture & Add Data Manually</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectExistingPatient(existingIdMatch)}
                          className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Patient</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!existingIdMatch && isIdVerifiedUnique && patientId.trim().length >= 2 && (
                    <div className="mt-2.5 p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-medium animate-in fade-in shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Registration ID <strong>{patientId.trim()}</strong> is saved & unique! You can continue.
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(capitalizeWords(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                    placeholder="Full Name"
                  />
                </div>

                <DateInputDDMMYYYY
                  label="Patient DOB"
                  value={dob}
                  onChange={(val) => {
                    setDob(val);
                    const computedAge = calculateAgeFromDob(val);
                    if (computedAge) {
                      setPatientAge(computedAge);
                    }
                  }}
                />

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Patient Age</label>
                  <input
                    type="text"
                    value={patientAge}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPatientAge(val);
                      const estimatedDob = calculateDobFromAge(val, dob);
                      if (estimatedDob) setDob(estimatedDob);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                    placeholder="e.g. 36 Yrs"
                  />
                </div>

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
                    onChange={(e) => setPartnerName(capitalizeWords(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-medium"
                    placeholder="Partner Name"
                  />
                </div>

                <DateInputDDMMYYYY
                  label="Partner DOB"
                  value={partnerDob}
                  onChange={(val) => {
                    setPartnerDob(val);
                    const computedAge = calculateAgeFromDob(val);
                    if (computedAge) {
                      setPartnerAge(computedAge);
                    }
                  }}
                />

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Partner Age</label>
                  <input
                    type="text"
                    value={partnerAge}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPartnerAge(val);
                      const estimatedDob = calculateDobFromAge(val, partnerDob);
                      if (estimatedDob) setPartnerDob(estimatedDob);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-emerald-500 font-bold"
                    placeholder="e.g. 36 Yrs"
                  />
                </div>

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
                  <DoctorSelect
                    label="Doctor Name"
                    value={doctorName}
                    onChange={(val) => setDoctorName(val)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DateInputDDMMYYYY
                  label="Date of Egg Retrieval"
                  value={visitDate}
                  onChange={(val) => handleVisitDateChange(val)}
                />
              </div>

              {/* AI Extracted Cryo Storage Location (Fully Editable & Compact) */}
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Extracted Document Storage Location (Editable)</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {/* Field 1: Can No / Tank Overview */}
                  <div className="space-y-0.5">
                    <label className="font-bold text-slate-700 text-[9px] uppercase">Can No / Tank</label>
                    <select
                      value={tankName}
                      onChange={(e) => setTankName(e.target.value)}
                      className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 text-slate-900 font-bold text-[11px] focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
                    >
                      <option value="CAN-01">CAN-01 (Can 1 / Tank 1)</option>
                      <option value="CAN-02">CAN-02 (Can 2 / Tank 2)</option>
                      <option value="CAN-03">CAN-03 (Can 3 / Tank 3)</option>
                      <option value="CAN-04">CAN-04 (Can 4 / Tank 4)</option>
                      <option value="CAN-05">CAN-05 (Can 5 / Tank 5)</option>
                      <option value="CAN-08">CAN-08 (Can 8 / Tank 8)</option>
                      <option value="CAN-10">CAN-10 (Can 10 / Tank 10)</option>
                      <option value="CAN-11">CAN-11 (Can 11 / Tank 11)</option>
                      <option value="CAN-14">CAN-14 (Can 14 / Tank 14)</option>
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

                      <option value="C01">C01 (Canister 01)</option>
                      <option value="C02">C02 (Canister 02)</option>
                      <option value="C03">C03 (Canister 03)</option>
                      <option value="C04">C04 (Canister 04)</option>
                      <option value="C05">C05 (Canister 05)</option>
                      <option value="C06">C06 (Canister 06)</option>
                      <option value="C07">C07 (Canister 07)</option>
                      <option value="C08">C08 (Canister 08)</option>
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
                    <label className="font-bold text-slate-700 text-[9px] uppercase">Viso Tube Color</label>
                    <select
                      value={visoTubeColor}
                      onChange={(e) => {
                        const selectedColor = e.target.value;
                        setVisoTubeColor(selectedColor);
                        setVisoTubeId(VISO_COLOR_TO_TUBE_CODE[selectedColor] || selectedColor);
                      }}
                      className={`w-full border rounded-lg p-1.5 font-bold text-[11px] focus:outline-none shadow-2xs cursor-pointer transition-all ${getVisoColorStyle(visoTubeColor)}`}
                    >
                      <option value="" className="bg-white text-slate-900 font-bold">-- Select Color --</option>
                      <option value="Pink" className="bg-pink-100 text-pink-900 font-bold">Pink</option>
                      <option value="Grey" className="bg-slate-200 text-slate-900 font-bold">Grey</option>
                      <option value="Red" className="bg-red-100 text-red-900 font-bold">Red</option>
                      <option value="Black" className="bg-slate-900 text-white font-bold">Black</option>
                      <option value="Green" className="bg-emerald-100 text-emerald-900 font-bold">Green</option>
                      <option value="Rust" className="bg-amber-100 text-amber-950 font-bold">Rust</option>
                      <option value="Blue" className="bg-blue-100 text-blue-900 font-bold">Blue</option>
                      <option value="Purple" className="bg-purple-100 text-purple-900 font-bold">Purple</option>
                      <option value="Yellow" className="bg-yellow-100 text-yellow-950 font-bold">Yellow</option>
                      <option value="Orange" className="bg-orange-100 text-orange-950 font-bold">Orange</option>
                      <option value="Skyblue" className="bg-sky-100 text-sky-950 font-bold">Skyblue</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Freezing Date Batches & Specimen Straws Section */}
              <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                        Specimen Straws by Freezing Date ({freezingGroups.reduce((acc, g) => acc + g.straws.length, 0)} Straws in {freezingGroups.length} Batch{freezingGroups.length > 1 ? 'es' : ''})
                      </h3>
                      {/* <p className="text-[10px] text-slate-500 font-medium">
                        Set the Freezing Date for each batch. Embryo stage is auto-calculated based on Date of Egg Retrieval.
                      </p> */}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addNewFreezingDateGroup}
                    className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all flex items-center shadow-2xs active:scale-95 cursor-pointer self-start sm:self-auto"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Add Another Freezing Date</span>
                  </button>
                </div>

                {/* Loop over Freezing Date Batches */}
                <div className="space-y-4">
                  {freezingGroups.map((group, gIdx) => (
                    <div key={group.id || gIdx} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                      {/* Batch Header */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                        {/* Top Line: Batch Title on Left, Add Straw (+ Delete) on Right */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            <span>Freezing Date Batch #{gIdx + 1}:</span>
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => addStrawToGroup(gIdx)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Straw</span>
                            </button>

                            {freezingGroups.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeGroup(gIdx)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Delete Freezing Date Batch"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Next Line: Date Input and Stage Badge */}
                        <div className="flex items-center gap-2.5 flex-wrap pt-1 border-t border-slate-200/60">
                          <div className="w-48 sm:w-52">
                            <DateInputDDMMYYYY
                              value={group.freezingDate || ''}
                              onChange={(isoDate) => updateGroupFreezingDate(gIdx, isoDate)}
                              compact
                              hideBadge
                              placeholder="DD/MM/YYYY"
                              inputClassName="w-full bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-amber-950 focus:outline-none focus:border-amber-600 shadow-2xs"
                            />
                          </div>
                        </div>
                      </div>

                      {specimenType === 'OOCYTE' ? (
                        /* Granular Per-Straw Oocyte Allocation Cards */
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                              <span className="uppercase tracking-wider">Straw Configuration</span>
                              <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 font-bold normal-case shadow-2xs">
                                TOTAL: {group.straws.reduce((sum, s) => sum + (s.embryoCount || 1), 0)} {group.straws.reduce((sum, s) => sum + (s.embryoCount || 1), 0) === 1 ? 'oocyte' : 'oocytes'} frozen in {group.straws.length} {group.straws.length === 1 ? 'straw' : 'straws'} ({getBatchSummaryText(group.straws, specimenType)})
                              </span>
                            </h4>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            {group.straws.map((st, sIdx) => {
                              const badgeClass = getStrawColorBadgeClass(st.colorTag);
                              return (
                                <div key={sIdx} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs">
                                        #{gIdx + 1}.{sIdx + 1}
                                      </span>
                                      {st.colorTag ? (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeClass}`}>
                                          {st.colorTag}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 font-bold">
                                          Color Unselected
                                        </span>
                                      )}
                                      <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 font-mono">
                                        {st.embryoCount || 1} {(st.embryoCount || 1) === 1 ? 'oocyte' : 'oocytes'} ({getStrawStageSummary(st, specimenType)})
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <label className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(st.isThawing || st.thawDate)}
                                          onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            updateStrawInGroup(gIdx, sIdx, 'isThawing', isChecked);
                                            if (isChecked) {
                                              updateStrawInGroup(gIdx, sIdx, 'thawDate', st.thawDate || formatDateDDMMYYYY(new Date()));
                                            } else {
                                              updateStrawInGroup(gIdx, sIdx, 'thawDate', '');
                                            }
                                          }}
                                          className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                                        />
                                        <span>Thaw</span>
                                      </label>
                                      {group.straws.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removeStrawFromGroup(gIdx, sIdx)}
                                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                          title="Delete Straw"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        Straw Color *
                                      </label>
                                      <select
                                        value={st.colorTag || ''}
                                        onChange={(e) => {
                                          const newColor = e.target.value;
                                          updateStrawInGroup(gIdx, sIdx, 'colorTag', newColor);
                                          if (sIdx === 0 && newColor) {
                                            for (let k = 1; k < group.straws.length; k++) {
                                              updateStrawInGroup(gIdx, k, 'colorTag', newColor);
                                            }
                                          }
                                        }}
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-900 focus:outline-none focus:border-emerald-500 text-xs cursor-pointer"
                                      >
                                        <option value="">-- Select Straw Color --</option>
                                        {CLINIC_STRAW_COLORS.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="sm:col-span-3">
                                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                                        No. of Oocyte(s)
                                      </label>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 flex-1 min-w-[200px]">
                                          {[1, 2, 3, 4, 5, 6].map((count) => {
                                            const labelText = `${count} ${count === 1 ? 'oocyte' : 'oocytes'}`;
                                            return (
                                              <button
                                                key={count}
                                                type="button"
                                                onClick={() => {
                                                  setFreezingGroups((prevGroups) => {
                                                    const next = [...prevGroups];
                                                    const targetGroup = { ...next[gIdx] };
                                                    const targetStraws = [...targetGroup.straws];
                                                    const currSt = targetStraws[sIdx];
                                                    const prevGrades = currSt.embryoGrades && currSt.embryoGrades.length > 0
                                                      ? currSt.embryoGrades
                                                      : (currSt.grade && currSt.grade.includes(',') ? currSt.grade.split(',').map((g: string) => g.trim()) : [currSt.grade || 'MII']);
                                                    const newGrades = Array.from({ length: count }, (_, i) => {
                                                      const g = prevGrades[i] || prevGrades[0] || 'MII';
                                                      return ['MII', 'MI', 'GV'].includes(g) ? g : 'MII';
                                                    });
                                                    const prevFrags = currSt.embryoFrags && currSt.embryoFrags.length > 0 ? currSt.embryoFrags : [currSt.fragmentation || ''];
                                                    const newFrags = Array.from({ length: count }, (_, i) => prevFrags[i] || '');
                                                    targetStraws[sIdx] = {
                                                      ...currSt,
                                                      embryoCount: count,
                                                      embryoGrades: newGrades,
                                                      embryoFrags: newFrags,
                                                      grade: newGrades.join(', '),
                                                    };
                                                    targetGroup.straws = targetStraws;
                                                    next[gIdx] = targetGroup;
                                                    return next;
                                                  });
                                                }}
                                                className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${st.embryoCount === count
                                                    ? 'bg-emerald-600 text-white shadow-xs font-mono font-bold'
                                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                                  }`}
                                              >
                                                {labelText}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Oocyte Stage & Details Sub-Card */}
                                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                                    <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                      <span>Oocyte Stage & Details for Freezing</span>
                                    </div>

                                    {Array.from({ length: st.embryoCount || 1 }).map((_, eIdx) => {
                                      const eCount = st.embryoCount || 1;
                                      const currentGrades = Array.from({ length: eCount }, (_, i) => {
                                        if (st.embryoGrades && st.embryoGrades[i] && ['MII', 'MI', 'GV'].includes(st.embryoGrades[i])) {
                                          return st.embryoGrades[i];
                                        }
                                        const fallback = st.grade && st.grade.includes(',') ? st.grade.split(',')[i]?.trim() : st.grade;
                                        return ['MII', 'MI', 'GV'].includes(fallback || '') ? fallback : 'MII';
                                      });
                                      const currentGradeVal = currentGrades[eIdx];

                                      return (
                                        <div key={eIdx} className="bg-white p-2.5 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                                          <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                              {eCount > 1 ? `Oocyte #${eIdx + 1} Stage` : 'Oocyte Stage'}
                                            </label>
                                            <div className="grid grid-cols-3 gap-1 h-9">
                                              {['MII', 'MI', 'GV'].map((stg) => (
                                                <button
                                                  key={stg}
                                                  type="button"
                                                  onClick={() => {
                                                    setFreezingGroups((prevGroups) => {
                                                      const next = [...prevGroups];
                                                      const targetGroup = { ...next[gIdx] };
                                                      const targetStraws = [...targetGroup.straws];
                                                      const currSt = targetStraws[sIdx];
                                                      const currCount = currSt.embryoCount || 1;
                                                      const baseGrades = Array.from({ length: currCount }, (_, i) => {
                                                        if (currSt.embryoGrades && currSt.embryoGrades[i] && ['MII', 'MI', 'GV'].includes(currSt.embryoGrades[i])) {
                                                          return currSt.embryoGrades[i];
                                                        }
                                                        const fallback = currSt.grade && currSt.grade.includes(',') ? currSt.grade.split(',')[i]?.trim() : currSt.grade;
                                                        return ['MII', 'MI', 'GV'].includes(fallback || '') ? fallback : 'MII';
                                                      });
                                                      baseGrades[eIdx] = stg;
                                                      targetStraws[sIdx] = {
                                                        ...currSt,
                                                        embryoGrades: baseGrades,
                                                        grade: baseGrades.join(', '),
                                                      };
                                                      targetGroup.straws = targetStraws;
                                                      next[gIdx] = targetGroup;
                                                      return next;
                                                    });
                                                  }}
                                                  className={`h-full rounded-md text-xs font-extrabold transition-all border flex items-center justify-center cursor-pointer ${currentGradeVal === stg
                                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
                                                    }`}
                                                >
                                                  {stg}
                                                </button>
                                              ))}
                                            </div>
                                          </div>

                                          <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                              Oocyte Remarks
                                            </label>
                                            <input
                                              type="text"
                                              value={st.embryoFrags?.[eIdx] ?? ''}
                                              onChange={(e) => {
                                                const eCountLocal = st.embryoCount || 1;
                                                const baseFrags = Array.from({ length: eCountLocal }, (_, i) => st.embryoFrags?.[i] ?? '');
                                                baseFrags[eIdx] = e.target.value;
                                                updateStrawInGroup(gIdx, sIdx, 'embryoFrags', baseFrags);
                                                if (eIdx === 0) updateStrawInGroup(gIdx, sIdx, 'fragmentation', e.target.value);
                                              }}
                                              placeholder="e.g. Normal morphology"
                                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs focus:outline-none focus:border-emerald-500 font-medium"
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Straws Table for Embryo Batch */
                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                          <table className="w-full text-left border-collapse text-[9px]">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold border-b border-slate-200">
                                <th className="p-1.5 w-10 text-center shrink-0">#</th>
                                <th className="p-1.5 w-32 shrink-0">Color Tag</th>
                                <th className="p-1.5 w-16 text-center shrink-0">Embryos</th>
                                <th className="p-1.5 w-28 shrink-0">Grade</th>
                                <th className="p-1.5 w-24 shrink-0">Fragmentation</th>
                                <th className="p-1.5 min-w-[210px] text-center">Thaw</th>
                                <th className="p-1.5 w-12 text-center shrink-0">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {group.straws.map((st, sIdx) => (
                                <tr key={sIdx} className="hover:bg-slate-50/80 font-medium text-slate-800">
                                  <td className="p-1.5 font-mono font-bold text-slate-900 text-[10px] whitespace-nowrap bg-slate-50/80 text-center w-10">
                                    #{gIdx + 1}.{sIdx + 1}
                                  </td>
                                  <td className="p-1 w-32">
                                    <select
                                      value={st.colorTag || ''}
                                      onChange={(e) => updateStrawInGroup(gIdx, sIdx, 'colorTag', e.target.value)}
                                      className={`w-full border rounded py-0.5 px-1 font-bold text-[8px] focus:outline-none transition-all ${st.colorTag ? getStrawColorBadgeClass(st.colorTag) : 'bg-slate-50 border-slate-300 text-slate-900'
                                        }`}
                                    >
                                      <option value="" className="bg-white text-slate-900 font-normal">-- Select Color --</option>
                                      {CLINIC_STRAW_COLORS.map((c) => (
                                        <option key={c} value={c} className="bg-white text-slate-900 font-medium">
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-1 text-center w-16">
                                    <select
                                      value={st.embryoCount ?? 1}
                                      onChange={(e) => {
                                        const cnt = parseInt(e.target.value, 10) || 1;
                                        updateStrawInGroup(gIdx, sIdx, 'embryoCount', cnt);

                                        const prevGrades = st.embryoGrades && st.embryoGrades.length > 0 ? st.embryoGrades : [st.grade || '4AA'];
                                        const prevFrags = st.embryoFrags && st.embryoFrags.length > 0 ? st.embryoFrags : [st.fragmentation || 'No'];

                                        const newGrades = Array.from({ length: cnt }, (_, i) => prevGrades[i] || prevGrades[0] || '4AA');
                                        const newFrags = Array.from({ length: cnt }, (_, i) => prevFrags[i] || prevFrags[0] || 'No');

                                        updateStrawInGroup(gIdx, sIdx, 'embryoGrades', newGrades);
                                        updateStrawInGroup(gIdx, sIdx, 'embryoFrags', newFrags);
                                        updateStrawInGroup(gIdx, sIdx, 'grade', newGrades.join(', '));
                                      }}
                                      className="w-12 bg-slate-50 border border-slate-300 rounded py-0.5 px-0.5 text-center font-bold text-emerald-700 text-[9px] focus:outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                      <option value={1}>1</option>
                                      <option value={2}>2</option>
                                    </select>
                                  </td>
                                  <td className="p-1 w-28">
                                    {(st.embryoCount || 1) > 1 ? (
                                      <div className="flex flex-col gap-1 w-full min-w-[70px]">
                                        {Array.from({ length: st.embryoCount }).map((_, eIdx) => {
                                          const eGradeList = st.embryoGrades || Array.from({ length: st.embryoCount }, (_, i) => i === 0 ? (st.grade || '4AA') : (st.grade || '4AA'));
                                          const val = eGradeList[eIdx] || '';
                                          return (
                                            <div key={eIdx} className="flex items-center gap-0.5">
                                              <span className="text-[7px] text-slate-500 font-bold shrink-0 font-mono">#{eIdx + 1}:</span>
                                              <input
                                                type="text"
                                                value={val}
                                                onChange={(e) => {
                                                  const newGrades = [...(st.embryoGrades || Array.from({ length: st.embryoCount }, (_, i) => i === 0 ? (st.grade || '4AA') : (st.grade || '4AA')))];
                                                  newGrades[eIdx] = e.target.value.toUpperCase();
                                                  updateStrawInGroup(gIdx, sIdx, 'embryoGrades', newGrades);
                                                  updateStrawInGroup(gIdx, sIdx, 'grade', newGrades.join(', '));
                                                }}
                                                placeholder="4AA"
                                                className="w-full bg-white border border-slate-300 rounded py-0.5 px-1 font-bold font-mono text-[8px] text-slate-900 focus:outline-none focus:border-emerald-600 uppercase"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <input
                                        type="text"
                                        value={st.grade || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          updateStrawInGroup(gIdx, sIdx, 'grade', val);
                                          updateStrawInGroup(gIdx, sIdx, 'embryoGrades', [val]);
                                        }}
                                        placeholder="4AA"
                                        className="w-full bg-slate-50 border border-slate-300 rounded py-0.5 px-1 font-bold text-[8px]"
                                      />
                                    )}
                                  </td>
                                  <td className="p-1 w-24">
                                    {(st.embryoCount || 1) > 1 ? (
                                      <div className="flex flex-col gap-1 w-full min-w-[65px]">
                                        {Array.from({ length: st.embryoCount }).map((_, eIdx) => {
                                          const eFragList = st.embryoFrags || Array.from({ length: st.embryoCount }, (_, i) => i === 0 ? (st.fragmentation || 'No') : (st.fragmentation || 'No'));
                                          const val = eFragList[eIdx] || 'No';
                                          return (
                                            <div key={eIdx} className="flex items-center gap-0.5">
                                              <span className="text-[7px] text-slate-500 font-bold shrink-0 font-mono">#{eIdx + 1}:</span>
                                              <select
                                                value={val}
                                                onChange={(e) => {
                                                  const newFrags = [...(st.embryoFrags || Array.from({ length: st.embryoCount }, (_, i) => i === 0 ? (st.fragmentation || 'No') : (st.fragmentation || 'No')))];
                                                  newFrags[eIdx] = e.target.value;
                                                  updateStrawInGroup(gIdx, sIdx, 'embryoFrags', newFrags);
                                                  if (eIdx === 0) updateStrawInGroup(gIdx, sIdx, 'fragmentation', e.target.value);
                                                }}
                                                className="w-full bg-white border border-slate-300 rounded py-0.5 px-0.5 font-bold text-[8px] text-slate-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                                              >
                                                <option value="No">No</option>
                                                <option value="+">+</option>
                                                <option value="++">++</option>
                                              </select>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <select
                                        value={st.fragmentation || 'No'}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          updateStrawInGroup(gIdx, sIdx, 'fragmentation', val);
                                          updateStrawInGroup(gIdx, sIdx, 'embryoFrags', [val]);
                                        }}
                                        className="w-full bg-slate-50 border border-slate-300 rounded py-0.5 px-1 font-bold text-[8px]"
                                      >
                                        <option value="No">No</option>
                                        <option value="+">+</option>
                                        <option value="++">++</option>
                                      </select>
                                    )}
                                  </td>
                                  <td className="p-1 text-center min-w-[210px]">
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap sm:flex-nowrap">
                                      <label className="flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-1 rounded cursor-pointer shrink-0 transition-colors">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(st.isThawing || st.thawDate)}
                                          onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            updateStrawInGroup(gIdx, sIdx, 'isThawing', isChecked);
                                            if (isChecked) {
                                              updateStrawInGroup(gIdx, sIdx, 'thawDate', st.thawDate || formatDateDDMMYYYY(new Date()));
                                            } else {
                                              updateStrawInGroup(gIdx, sIdx, 'thawDate', '');
                                            }
                                          }}
                                          className="w-3.5 h-3.5 accent-amber-600 rounded cursor-pointer"
                                          title="Tick box to thaw this specific straw"
                                        />
                                      </label>
                                      {(st.isThawing || st.thawDate) && (
                                        <div className="w-44 sm:w-48 shrink-0">
                                          <DateInputDDMMYYYY
                                            value={st.thawDate || ''}
                                            onChange={(isoDate) => updateStrawInGroup(gIdx, sIdx, 'thawDate', isoDate)}
                                            compact
                                            hideBadge
                                            placeholder="DD/MM/YYYY"
                                            inputClassName="w-full bg-amber-50/80 border border-amber-300 rounded-lg text-amber-950 font-bold focus:outline-none focus:border-amber-600 shadow-2xs"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-1 text-center w-12">
                                    <button
                                      type="button"
                                      onClick={() => removeStrawFromGroup(gIdx, sIdx)}
                                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Delete Straw"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
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

                {existingIdMatch ? (
                  <button
                    type="button"
                    disabled={savingToExisting}
                    onClick={handleSavePictureAndFillExisting}
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                  >
                    {savingToExisting ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Picture & Add Data Manually to Existing Patient</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={verifying}
                    className="flex-1 py-3.5 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  >
                    {verifying ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Review & Confirm Record Summary</span>
                      </>
                    )}
                  </button>
                )}
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
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative group ${activeRecord?.id === record.id
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

      {/* Saved Summary Modal Popup */}
      {savedSummaryModalData && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-5 my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">

            {/* Top Banner Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 sm:p-5 rounded-2xl text-white flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                    <span>Review Patient Summary & Confirm</span>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </h2>
                  <p className="text-xs text-emerald-100 font-medium">
                    Review details below. Data will be saved to database only after you click 'Done & Finish'.
                  </p>
                </div>
              </div>
            </div>

            {/* Grid: Patient & Demographics + Container Allocation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">

              {/* Patient Info Card */}
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <span className="font-extrabold text-emerald-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Patient Profile</span>
                  </span>
                  <div className="flex items-center gap-2">

                    <span className="font-mono font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 text-[10px]">
                      ID: {savedSummaryModalData.patientId || 'SAVED'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-slate-800 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Patient Name:</span>
                    <span className="font-bold text-slate-900">{savedSummaryModalData.fullName}</span>
                  </div>
                  {savedSummaryModalData.partnerName && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Partner Name:</span>
                      <span className="font-semibold text-slate-800">{savedSummaryModalData.partnerName}</span>
                    </div>
                  )}
                  {savedSummaryModalData.phone && (
                    <div className="flex justify-between font-mono">
                      <span className="text-slate-500 font-bold">Mobile Phone:</span>
                      <span className="font-bold text-slate-900">{savedSummaryModalData.phone}</span>
                    </div>
                  )}
                  {savedSummaryModalData.doctorName && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">Doctor Name:</span>
                      <span className="font-bold text-slate-900">{savedSummaryModalData.doctorName}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60">
                    <span className="text-slate-500 font-bold">Classification:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-300">
                        {savedSummaryModalData.specimenType === 'OOCYTE' ? '🥚 OOCYTE' : '🧬 EMBRYO'}
                      </span>
                      <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-300">
                        {savedSummaryModalData.cycleType}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates & Cryo Storage Location Card */}
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <span className="font-extrabold text-amber-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span>Storage Allocation & Dates</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[10px] border border-amber-300">
                      {savedSummaryModalData.totalStraws} Straw{savedSummaryModalData.totalStraws > 1 ? 's' : ''} ({savedSummaryModalData.totalEmbryos} {savedSummaryModalData.specimenType === 'OOCYTE' ? 'Oocytes' : 'Embryos'})
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-slate-800 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Egg Pick Up Date:</span>
                    <span className="font-mono font-extrabold text-amber-950">
                      {savedSummaryModalData.visitDate ? formatDateDDMMYYYY(savedSummaryModalData.visitDate) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Freezing Date(s):</span>
                    <span className="font-mono font-extrabold text-blue-950">
                      {savedSummaryModalData.freezingGroups
                        ?.map((g: any) => g.freezingDate ? formatDateDDMMYYYY(g.freezingDate) : null)
                        .filter(Boolean)
                        .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
                        .join(', ') || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-amber-200/60">
                    <span className="text-slate-500 font-bold">Viso Tube Location:</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-300 text-[10px]">
                      {savedSummaryModalData.storageLocation?.tankName || savedSummaryModalData.storageLocation?.canNo || 'CAN-01'} &gt; {savedSummaryModalData.storageLocation?.canisterName || 'C01'} &gt; {savedSummaryModalData.storageLocation?.level || 'Level 1'} &gt; Viso Tube {VISO_COLOR_TO_TUBE_CODE[savedSummaryModalData.storageLocation?.visoTubeColor] || 'V01'} ({savedSummaryModalData.storageLocation?.visoTubeColor || 'Pink'})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Straw Details Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Saved Specimen Straws Breakdown</span>
                </h4>
                <button
                  type="button"
                  onClick={() => handleEditDetailsFromSummary('straws')}
                  className="text-[10px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded border border-amber-300 transition cursor-pointer flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3 text-amber-600" />
                  <span>Edit Straws</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider font-extrabold border-b border-slate-200">
                      <th className="p-2 text-center w-8">#</th>
                      <th className="p-2 w-28">Color Tag</th>
                      <th className="p-2 text-center">{savedSummaryModalData.specimenType === 'OOCYTE' ? 'Oocytes' : 'Embryos'}</th>
                      <th className="p-2">Batch Freezing Date</th>
                      <th className="p-2">Grade(s) & Fragmentation</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {savedSummaryModalData.freezingGroups?.flatMap((group: any, gIdx: number) =>
                      group.straws.map((st: any, sIdx: number) => (
                        <tr key={`${gIdx}-${sIdx}`} className="hover:bg-slate-50 font-medium text-slate-800">
                          <td className="p-2 font-mono font-bold text-slate-900 text-center bg-slate-50/80">
                            #{gIdx + 1}.{sIdx + 1}
                          </td>
                          <td className="p-2">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] border inline-block ${getStrawColorBadgeClass(st.colorTag || 'Pink')}`}>
                              {st.colorTag || 'Pink'}
                            </span>
                          </td>
                          <td className="p-2 text-center font-bold text-emerald-700">
                            {st.embryoCount || 1}
                          </td>
                          <td className="p-2 font-mono font-bold text-slate-900">
                            {group.freezingDate ? formatDateDDMMYYYY(group.freezingDate) : 'N/A'}
                          </td>
                          {/* <td className="p-2 font-bold text-blue-900">
                            <span className="bg-blue-50 text-blue-900 px-2 py-0.5 rounded border border-blue-200">
                              {calculateStageFromDates(savedSummaryModalData.visitDate, group.freezingDate, savedSummaryModalData.specimenType)}
                            </span>
                          </td> */}
                          <td className="p-2 font-mono font-semibold text-slate-900">
                            {Array.isArray(st.embryoGrades) && st.embryoGrades.length > 0
                              ? st.embryoGrades.map((g: string, idx: number) => {
                                const f = st.embryoFrags?.[idx] || 'No';
                                return `${g}${f !== 'No' ? ` (${f})` : ''}`;
                              }).join(', ')
                              : `${st.grade || '4AA'}${st.fragmentation && st.fragmentation !== 'No' ? ` (${st.fragmentation})` : ''}`}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] border ${st.isThawing || st.thawDate ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300'}`}>
                              {st.isThawing || st.thawDate ? 'THAWED' : 'OCCUPIED'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleEditDetailsFromSummary()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit / Correct Details</span>
              </button>

              <button
                type="button"
                onClick={executeFinalSaveToDatabase}
                disabled={verifying}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Done & Finish (Save to Database)</span>
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
