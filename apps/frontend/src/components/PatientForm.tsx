import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Save, Search, CheckCircle2, ShieldAlert, Sparkles, Layers, Info, UserCheck, AlertTriangle, RefreshCw, Plus, Minus, Flame, Snowflake, X, Calendar, Printer, Mail, Camera, Upload, User, RotateCcw, RotateCw } from 'lucide-react';
import { apiRequest, formatDateDDMMYYYY } from '../api/client';
import { useBackgroundTask } from '../context/BackgroundTaskContext';
import { ReportPrintMailModal } from './ReportPrintMailModal';
import { rotateImageFile } from '../utils/imageUtils';
import { ImageCropRotateModal } from './ImageCropRotateModal';

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

export function getStrawColorBadgeClass(colorName?: string): string {
  const color = (colorName || 'Pink').toLowerCase().trim();
  switch (color) {
    case 'pink':
      return 'bg-pink-100 text-pink-900 border-pink-300 font-bold';
    case 'grey':
    case 'gray':
      return 'bg-slate-200 text-slate-900 border-slate-300 font-bold';
    case 'red':
      return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
    case 'black':
      return 'bg-slate-900 text-white border-slate-700 font-bold';
    case 'green':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
    case 'rust':
      return 'bg-amber-100 text-amber-950 border-amber-400 font-bold';
    case 'blue':
      return 'bg-blue-100 text-blue-900 border-blue-300 font-bold';
    case 'purple':
      return 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-950 border-yellow-400 font-bold';
    case 'orange':
      return 'bg-orange-100 text-orange-950 border-orange-300 font-bold';
    case 'skyblue':
    case 'sky blue':
      return 'bg-sky-100 text-sky-900 border-sky-300 font-bold';
    default:
      return 'bg-pink-100 text-pink-900 border-pink-300 font-bold';
  }
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

export function calculateAgeFromDob(dobString?: string): string {
  if (!dobString) return '';
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? `${age} Yrs` : '';
}

export function formatISOToDDMMYYYY(isoStr?: string | null): string {
  if (!isoStr) return '';
  const clean = isoStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    if (y.length === 4 && m && d) return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return isoStr;
}

export function parseDDMMYYYYToISO(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 8) {
    const d = digits.substring(0, 2);
    const m = digits.substring(2, 4);
    const y = digits.substring(4, 8);
    return `${y}-${m}-${d}`;
  }
  if (input.includes('/') || input.includes('-')) {
    const parts = input.split(/[\/\-]/);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (y.length === 4 && d && m) {
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
  }
  return input;
}

interface DateInputDDMMYYYYProps {
  label: string;
  value: string; // ISO format (YYYY-MM-DD)
  onChange: (isoDate: string) => void;
  required?: boolean;
  extraBadge?: React.ReactNode;
  className?: string;
}

export const DateInputDDMMYYYY: React.FC<DateInputDDMMYYYYProps> = ({
  label,
  value,
  onChange,
  required,
  extraBadge,
  className,
}) => {
  const [displayValue, setDisplayValue] = useState(() => formatISOToDDMMYYYY(value));
  const hiddenDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayValue(formatISOToDDMMYYYY(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);

    const iso = parseDDMMYYYYToISO(raw);
    if (iso && iso.length === 10) {
      const testDate = new Date(iso);
      if (!isNaN(testDate.getTime())) {
        onChange(iso);
      }
    } else if (!raw) {
      onChange('');
    }
  };

  const handleOpenPicker = () => {
    if (hiddenDateRef.current) {
      if (typeof hiddenDateRef.current.showPicker === 'function') {
        hiddenDateRef.current.showPicker();
      } else {
        hiddenDateRef.current.click();
      }
    }
  };

  return (
    <div className="min-w-0 max-w-full">
      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
        <span>{label} {required && <span className="text-rose-600 font-bold">*</span>}</span>
        {extraBadge || (
          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
            DD/MM/YYYY
          </span>
        )}
      </label>
      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          onChange={handleTextChange}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          className={`w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 pr-10 text-sm text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-500 block ${className || ''}`}
        />
        <button
          type="button"
          onClick={handleOpenPicker}
          className="absolute right-2 text-slate-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          title="Pick date from calendar"
        >
          <Calendar className="w-4 h-4" />
        </button>
        <input
          ref={hiddenDateRef}
          type="date"
          value={value || ''}
          onChange={(e) => {
            const iso = e.target.value;
            onChange(iso);
            setDisplayValue(formatISOToDDMMYYYY(iso));
          }}
          className="sr-only pointer-events-none"
        />
      </div>
    </div>
  );
};

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
  const [thawDoctorNotes, setThawDoctorNotes] = useState<string>();
  const [executingThaw, setExecutingThaw] = useState(false);
  const [reloadingPatientDetails, setReloadingPatientDetails] = useState(false);
  const [thawSuccessMsg, setThawSuccessMsg] = useState<string | null>(null);
  const [saveSuccessDetails, setSaveSuccessDetails] = useState<any | null>(null);

  // Form Fields
  const [customPatientId, setCustomPatientId] = useState('');
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
  const [aspirationDate, setAspirationDate] = useState(new Date().toISOString().split('T')[0]);
  const [freezingDate, setFreezingDate] = useState(new Date().toISOString().split('T')[0]);
  const [embryoStage, setEmbryoStage] = useState('Day 5');
  const [thawDate, setThawDate] = useState('');
  const [comments, setComments] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [cropModalFile, setCropModalFile] = useState<File | null>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropModalFile(file);
    }
    e.target.value = '';
  };

  // Storage Allocation State
  const [assignStorageEnabled, setAssignStorageEnabled] = useState(false);
  const [allocationMode, setAllocationMode] = useState<'recommended' | 'manual'>('manual');
  const [strawsCount, setStrawsCount] = useState(1);
  const [strawItems, setStrawItems] = useState<Array<{
    color: string;
    embryoCount: number;
    grade: string;
    comments: string;
    isPgt: boolean;
  }>>([
    { color: 'Pink', embryoCount: 1, grade: '', comments: '', isPgt: false },
  ]);
  const [storageDate, setStorageDate] = useState(new Date().toISOString().split('T')[0]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [selectedVisoTubeId, setSelectedVisoTubeId] = useState<string>('');
  const [selectedLocationCode, setSelectedLocationCode] = useState<string>('');

  // Manual Storage Selection State
  const [hierarchyCans, setHierarchyCans] = useState<any[]>([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(false);
  const [manualCanCode, setManualCanCode] = useState<string>('CAN-01');
  const [manualCanisterNum, setManualCanisterNum] = useState<number>(1);
  const [manualLevelNum, setManualLevelNum] = useState<number>(1);

  const [loading, setLoading] = useState(false);
  const [searchingStorage, setSearchingStorage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportMailPatient, setReportMailPatient] = useState<any | null>(null);

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

    setReloadingPatientDetails(true);
    try {
      const res = await apiRequest(`/api/patients/${p.id}`);
      if (res.success && res.patient) {
        setSelectedExistingPatient(res.patient);
      }
    } catch (err: any) {
      console.error('Failed to load patient detail batches:', err);
    } finally {
      setReloadingPatientDetails(false);
    }
  };

  // Execute Direct Thaw from Patient Form
  const handleExecuteThaw = async () => {
    if (!thawModalStraw || !selectedExistingPatient) return;

    const strawCode = thawModalStraw.strawId;
    const patientName = selectedExistingPatient.fullName;
    const targetStrawId = thawModalStraw.id;
    const targetNotes = thawDoctorNotes;
    const targetPatientId = selectedExistingPatient.id;

    // Immediately close modal & reset fields so user can continue working
    setThawModalStraw(null);
    setThawDoctorNotes('');
    setThawSuccessMsg(`Thaw operation queued in background for Straw ${strawCode} (${patientName})`);

    enqueueTask({
      title: `Thawing Straw ${strawCode}: ${patientName}`,
      description: `Freeing storage slot & logging clinical doctor remarks`,
      action: async () => {
        const res = await apiRequest('/api/thaw', {
          method: 'POST',
          body: JSON.stringify({
            strawIds: [targetStrawId],
            doctorNotes: targetNotes || undefined,
          }),
        });
        return res;
      },
      onSuccess: async () => {
        setReloadingPatientDetails(true);
        try {
          const fullRes = await apiRequest(`/api/patients/${targetPatientId}`);
          if (fullRes.success && fullRes.patient) {
            setSelectedExistingPatient(fullRes.patient);
          }
        } finally {
          setReloadingPatientDetails(false);
        }
      },
      onError: (err) => {
        setError(err.message || 'Failed to thaw straw.');
      },
    });
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
    setLoadingHierarchy(true);
    try {
      const res = await apiRequest('/api/storage/hierarchy');
      if (res.success && res.cans) {
        setHierarchyCans(res.cans);
      }
    } catch (err: any) {
      console.error('Failed to load storage hierarchy:', err);
    } finally {
      setLoadingHierarchy(false);
    }
  };

  // Automatically fetch hierarchy on mount
  useEffect(() => {
    fetchHierarchy();
  }, []);

  // Auto-select first available VisoTube when hierarchy loads or selection changes
  useEffect(() => {
    if (hierarchyCans.length === 0) return;
    const currentCanObj = hierarchyCans.find(c => c.code === manualCanCode);
    const currentCanisterObj = currentCanObj?.canisters?.find((cn: any) => cn.canisterNumber === manualCanisterNum);
    const currentLevelObj = currentCanisterObj?.levels?.find((l: any) => l.levelNumber === manualLevelNum);
    const tubes: any[] = currentLevelObj?.goblets?.[0]?.visoTubes || [];

    const availableTubes = tubes.filter((t: any) => {
      const occupiedCount = t.straws ? t.straws.filter((s: any) => s.status === 'OCCUPIED').length : 0;
      const remaining = 10 - occupiedCount;
      return remaining >= strawsCount;
    });

    if (availableTubes.length > 0) {
      const isStillValid = availableTubes.some((t: any) => t.id === selectedVisoTubeId);
      if (!isStillValid || !selectedVisoTubeId) {
        setSelectedVisoTubeId(availableTubes[0].id);
        setSelectedLocationCode(availableTubes[0].locationCode);
      }
    }
  }, [hierarchyCans, manualCanCode, manualCanisterNum, manualLevelNum, strawsCount]);

  const handleUpdateStrawsCount = (newCount: number) => {
    const validCount = Math.max(1, Math.min(20, newCount));
    setStrawsCount(validCount);
    setStrawItems((prev) => {
      if (prev.length === validCount) return prev;
      const VISO_COLORS = ['Pink', 'Grey', 'Red', 'Black', 'Green', 'Rust', 'Blue', 'Purple', 'Yellow', 'Orange', 'Skyblue'];
      if (prev.length < validCount) {
        const next = [...prev];
        for (let i = prev.length; i < validCount; i++) {
          const colorName = VISO_COLORS[i % VISO_COLORS.length] || 'Pink';
          next.push({ color: colorName, embryoCount: 1, grade: '4AA', comments: '', isPgt: false });
        }
        return next;
      }
      return prev.slice(0, validCount);
    });
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
          storageDate: freezingDate,
          embryoCount: strawsCount * 2,
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

  const fetchRecommendation = handleFindStorage;

  useEffect(() => {
    if (assignStorageEnabled && allocationMode === 'recommended') {
      handleFindStorage();
    }
  }, [assignStorageEnabled, allocationMode, strawsCount, freezingDate, selectedExistingPatient]);

  useEffect(() => {
    if (saveSuccessDetails) {
      const timer = setTimeout(() => {
        setSaveSuccessDetails(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessDetails]);

  const { enqueueTask } = useBackgroundTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formMode === 'new') {
      if (!fullName.trim() || !doctorName.trim()) {
        setError('Patient Full Name and Doctor Name are required.');
        return;
      }
      if (!phone.trim() && !partnerPhone.trim()) {
        setError('Please enter at least 1 Mobile Phone number (Patient or Partner).');
        return;
      }
    }

    const patientName = fullName.trim() || selectedExistingPatient?.fullName || 'Patient Record';

    const totalEmbryosCount = strawItems.reduce((acc, item) => acc + (item.embryoCount || 1), 0);

    // Capture current form inputs before clearing
    const payload = {
      formMode,
      selectedExistingPatient,
      customPatientId: customPatientId.trim(),
      fullName: fullName.trim(),
      partnerName: partnerName.trim(),
      phone: phone.trim(),
      partnerPhone: partnerPhone.trim(),
      email: email.trim(),
      partnerEmail: partnerEmail.trim(),
      dob: dob.trim(),
      partnerDob: partnerDob.trim(),
      patientAge: patientAge.trim() || calculateAgeFromDob(dob),
      partnerAge: partnerAge.trim() || calculateAgeFromDob(partnerDob),
      doctorName: doctorName.trim(),
      aspirationDate,
      freezingDate,
      embryoStage,
      thawDate,
      comments: comments.trim(),
      photoFile,
      assignStorageEnabled,
      selectedVisoTubeId,
      selectedLocationCode,
      storageDate: freezingDate,
      strawsCount,
      strawItems: [...strawItems],
      totalEmbryosCount,
    };

    // Reset photo state
    setPhotoFile(null);
    setPhotoPreviewUrl(null);

    // Show immediate success confirmation & reset form so staff can immediately enter next patient!
    setSaveSuccessDetails({
      patientId: payload.customPatientId || (payload.selectedExistingPatient?.patientId) || 'SAVING IN BACKGROUND...',
      fullName: patientName,
      status: payload.assignStorageEnabled ? 'QUEUED (ALLOCATION & OCCUPIED)' : 'QUEUED (RECORD SAVING)',
      embryoCount: payload.assignStorageEnabled ? payload.totalEmbryosCount : 0,
      strawCount: payload.assignStorageEnabled ? payload.strawItems.length : 0,
      location: payload.assignStorageEnabled ? payload.selectedLocationCode : null,
      timestamp: new Date().toLocaleString(),
    });

    if (formMode === 'new') {
      handleClearSelectedExisting();
    }

    // Queue task in top-left background queue stack
    enqueueTask({
      title: `Saving ${payload.formMode === 'new' ? 'New Patient' : 'Batch'}: ${patientName}`,
      description: payload.assignStorageEnabled
        ? `Allocating ${payload.strawItems.length} Straw(s) (${payload.totalEmbryosCount} Embryo(s))`
        : 'Saving Patient Demographics & Medical History',
      action: async () => {
        let targetPatient = payload.selectedExistingPatient;

        if (!targetPatient) {
          const patientRes = await apiRequest('/api/patients', {
            method: 'POST',
            body: JSON.stringify({
              patientId: payload.customPatientId || undefined,
              fullName: payload.fullName,
              partnerName: payload.partnerName || undefined,
              phone: payload.phone || undefined,
              partnerPhone: payload.partnerPhone || undefined,
              email: payload.email || undefined,
              partnerEmail: payload.partnerEmail || undefined,
              dob: payload.dob || undefined,
              partnerDob: payload.partnerDob || undefined,
              patientAge: payload.patientAge || undefined,
              partnerAge: payload.partnerAge || undefined,
              doctorName: payload.doctorName || undefined,
              aspirationDate: payload.aspirationDate || undefined,
              freezingDate: payload.freezingDate || undefined,
              thawDate: payload.thawDate || undefined,
              comments: payload.comments || undefined,
            }),
          });
          targetPatient = patientRes.patient;
        } else {
          await apiRequest(`/api/patients/${targetPatient.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              fullName: payload.fullName,
              partnerName: payload.partnerName || undefined,
              phone: payload.phone || undefined,
              partnerPhone: payload.partnerPhone || undefined,
              email: payload.email || undefined,
              partnerEmail: payload.partnerEmail || undefined,
              dob: payload.dob || undefined,
              partnerDob: payload.partnerDob || undefined,
              patientAge: payload.patientAge || undefined,
              partnerAge: payload.partnerAge || undefined,
              doctorName: payload.doctorName || undefined,
              aspirationDate: payload.aspirationDate || undefined,
              freezingDate: payload.freezingDate || undefined,
              comments: payload.comments || undefined,
            }),
          });
        }

        if (payload.photoFile && targetPatient) {
          const formData = new FormData();
          formData.append('photo', payload.photoFile);
          await apiRequest(`/api/patients/${targetPatient.id}/photo`, {
            method: 'POST',
            body: formData,
          });
        }

        if (payload.assignStorageEnabled && payload.selectedVisoTubeId) {
          await apiRequest('/api/storage/assign', {
            method: 'POST',
            body: JSON.stringify({
              patientId: targetPatient.id,
              aspirationDate: payload.aspirationDate,
              freezingDate: payload.freezingDate,
              embryoStage: payload.embryoStage,
              visoTubeId: payload.selectedVisoTubeId,
              straws: payload.strawItems,
              notes: payload.comments || undefined,
            }),
          });
        }

        const fullRes = await apiRequest(`/api/patients/${targetPatient.id}`);
        return fullRes.patient || targetPatient;
      },
      onSuccess: (updatedPatient) => {
        onSuccess(updatedPatient);
      },
      onError: (err) => {
        setError(err.message || 'Background save failed.');
      },
    });
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

      {/* Embryo Storage Record Saved Success Modal Popup */}
      {saveSuccessDetails && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-emerald-50 border-2 border-emerald-400 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-slate-900">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
              <div className="flex items-center gap-3 text-emerald-950 font-bold text-base sm:text-lg">
                <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2>Embryo Storage Record Saved & Allocated Successfully!</h2>
                  <p className="text-xs text-emerald-800 font-medium font-sans">
                    Cryo storage slot locked & audit trail recorded.
                  </p>
                </div>
              </div>
              {/* <button
                onClick={() => setSaveSuccessDetails(null)}
                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-200/80 hover:bg-emerald-300 px-3 py-1.5 rounded-full transition-all border border-emerald-300"
              >
                Dismiss
              </button> */}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-4 rounded-2xl border border-emerald-200 font-mono shadow-xs">
              <div>
                <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold tracking-wider">Patient:</span>
                <strong className="text-slate-900 text-sm font-sans">{saveSuccessDetails.fullName}</strong>
                <span className="block text-emerald-700 font-bold text-xs">{saveSuccessDetails.patientId}</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold tracking-wider">Storage Status:</span>
                <strong className="text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300 inline-block font-bold mt-1">
                  {saveSuccessDetails.status}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 font-sans block text-[10px] uppercase font-bold tracking-wider">Straws / Embryos:</span>
                <strong className="text-slate-900 block text-xs mt-1">
                  {saveSuccessDetails.strawCount} Straw(s) • {saveSuccessDetails.embryoCount} Embryos
                </strong>
              </div>
            </div>

            {saveSuccessDetails.location && (
              <div className="text-xs font-mono bg-emerald-950 text-emerald-100 p-4 rounded-2xl border border-emerald-800 space-y-1 shadow-sm">
                <span className="font-sans text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                  Allocated Physical Storage Location:
                </span>
                <span className="font-bold text-sm text-emerald-50 block leading-snug">
                  {parseLocationCode(saveSuccessDetails.location).formatted}
                </span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSaveSuccessDetails(null)}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 text-center"
              >
                Okay, Done
              </button>
            </div>
          </div>
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate">{p.fullName}</span>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-950 rounded border border-emerald-300 shrink-0">
                        Reg No: {p.patientId}
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
                {/* <span>•</span> */}
                {/* <span>Total Batches Recorded: {selectedExistingPatient.batches?.length || 0}</span> */}
                {/* {(() => {
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
                })()} */}
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
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950 text-xs font-bold shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{thawSuccessMsg}</span>
          </div>
          {reloadingPatientDetails && (
            <div className="flex items-center gap-2 text-emerald-900 font-mono text-[11px] bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 animate-pulse shrink-0">
              <span className="w-3.5 h-3.5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin shrink-0" />
              <span>Refreshing Cryo Directory...</span>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE STORED EMBRYOS & DIRECT THAW PANEL FOR EXISTING PATIENT */}
      {selectedExistingPatient && (() => {
        if (reloadingPatientDetails) {
          return (
            <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-sm space-y-3 animate-pulse">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <span className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin shrink-0" />
                  <span>Loading updated physical cryo storage inventory...</span>
                </div>
                <span className="text-[10px] text-emerald-800 font-bold font-mono bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  LOADING DATA
                </span>
              </div>
              <div className="h-20 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-center text-xs text-emerald-800 font-mono font-bold">
                Fetching updated active specimen records...
              </div>
            </div>
          );
        }

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
              {/* <span className="text-[10px] text-rose-800 font-bold font-mono bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                Direct Thaw / Withdrawal Available Here
              </span> */}
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
                      <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-md border ${getStrawColorBadgeClass(straw.color)}`}>
                        {embryoCount} Embryos ({straw.color || 'Pink'} Tag)
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
                        // setThawDoctorNotes();
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
                  setPartnerPhone('+91 98260 12345');
                  setEmail('sunita.verma@example.com');
                  setPartnerEmail('deepak.verma@example.com');
                  setDob('1994-05-15');
                  setPartnerDob('1991-08-20');
                  setPatientAge('32 Yrs');
                  setPartnerAge('35 Yrs');
                  setDoctorName('Dr. Ananya Sharma');
                  const today = new Date().toISOString().split('T')[0];
                  setAspirationDate(today);
                  setFreezingDate(today);
                  setStorageDate(today);
                  setComments('');
                }}
                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-xs rounded-xl border border-amber-300 shadow-2xs transition-all active:scale-95 flex items-center gap-1.5"
                title="Auto-fill sample patient data"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Auto-Fill Demo Data</span>
              </button>

              {selectedExistingPatient && (
                <>
                  <button
                    type="button"
                    onClick={() => setReportMailPatient(selectedExistingPatient)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <Mail className="w-3.5 h-3.5" />
                    <span>Print / Send Email Report</span>
                  </button>
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    EXISTING PATIENT RECORD
                  </span>
                </>
              )}
            </div>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full max-w-full">
            {/* PATIENT PHOTO UPLOADER BOX */}
            {!selectedExistingPatient && (
              <div className="md:col-span-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0">
                  {photoPreviewUrl ? (
                    <img
                      src={photoPreviewUrl}
                      alt="Patient Preview"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-md"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 font-bold text-xs">
                      <Camera className="w-6 h-6 text-slate-400" />
                      <span className="text-[9px] text-slate-500 mt-0.5">No Photo</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1 text-center sm:text-left min-w-0">
                  <div className="font-bold text-slate-800 text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Patient Photo</span>
                  </div>
                  

                  <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
                    <label className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{photoPreviewUrl ? 'Change Photo' : '📷 Click to Add Patient Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>

                    {photoPreviewUrl && (
                      <div className="flex items-center gap-1.5">
                        {photoFile && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const { file: rFile, dataUrl } = await rotateImageFile(photoFile, 90);
                                setPhotoFile(rFile);
                                setPhotoPreviewUrl(dataUrl);
                              } catch (e) {
                                console.error('Failed to rotate photo:', e);
                              }
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1 border border-slate-300 active:scale-95 shadow-2xs cursor-pointer"
                            title="Rotate Right 90°"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-slate-700" />
                            <span>Rotate ↻</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setPhotoFile(null);
                            setPhotoPreviewUrl(null);
                          }}
                          className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="md:col-span-2 min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Registration No (Unique Primary Key) <span className="text-rose-600 font-bold">*</span></span>
              </label>
              <input
                type="text"
                value={customPatientId}
                onChange={(e) => setCustomPatientId(e.target.value)}
                readOnly={!!selectedExistingPatient}
                placeholder="e.g. IVF-2026-000001"
                required
                className={`w-full min-w-0 max-w-full h-11 box-border border rounded-xl px-4 text-sm font-mono font-bold focus:outline-none block ${
                  selectedExistingPatient
                    ? 'bg-slate-100 text-slate-700 border-slate-300 cursor-not-allowed'
                    : 'bg-slate-50 text-slate-900 border-slate-300 focus:border-emerald-500'
                }`}
              />
            </div>

            {/* PATIENT DEMOGRAPHICS */}
            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Patient Full Name <span className="text-rose-600 font-bold">*</span>
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

            <DateInputDDMMYYYY
              label="Patient Date of Birth (DOB)"
              value={dob}
              onChange={(val) => {
                setDob(val);
                setPatientAge(calculateAgeFromDob(val));
              }}
              extraBadge={
                patientAge ? (
                  <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-300">
                    Age: {patientAge}
                  </span>
                ) : undefined
              }
            />

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Patient Mobile Phone <span className="text-rose-600 font-bold">*</span>
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
                Patient Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. patient@example.com"
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500 block"
              />
            </div>

            {/* PARTNER DEMOGRAPHICS */}
            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Partner Name
              </label>
              <input
                type="text"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                placeholder="e.g. Deepak Verma"
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 block font-medium"
              />
            </div>

            <DateInputDDMMYYYY
              label="Partner Date of Birth (DOB)"
              value={partnerDob}
              onChange={(val) => {
                setPartnerDob(val);
                setPartnerAge(calculateAgeFromDob(val));
              }}
              extraBadge={
                partnerAge ? (
                  <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-300">
                    Age: {partnerAge}
                  </span>
                ) : undefined
              }
            />

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Partner Mobile Phone
              </label>
              <input
                type="text"
                value={partnerPhone}
                onChange={(e) => setPartnerPhone(e.target.value)}
                placeholder="e.g. +91 98260 12345"
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500 block"
              />
            </div>

            <div className="min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Partner Email Address
              </label>
              <input
                type="email"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                placeholder="e.g. partner@example.com"
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500 block"
              />
            </div>

            {/* CLINICAL PHYSICIAN */}
            <div className="md:col-span-2 min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Doctor Name / Attending Physician <span className="text-rose-600 font-bold">*</span>
              </label>
              <input
                type="text"
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                placeholder="e.g. Dr. Ananya Sharma"
                required
                className="w-full min-w-0 max-w-full h-11 box-border bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-bold block"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex flex-wrap items-center justify-between gap-1">
                <span>Clinical Comments & Doctor Remarks</span>
                <span className="text-[10px] text-slate-500 font-normal lowercase">(Egg yield, embryo grade quality, special instructions)</span>
              </label>
              <textarea
                rows={4}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Write unlimited clinical comments, doctor instructions, embryo quality remarks, OCR notes, or detailed storage records here..."
                className="w-full max-w-full box-border bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-medium min-h-[120px] resize-y leading-relaxed block"
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

              {/* FREEZING BATCH LEVEL METADATA */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Snowflake className="w-4 h-4 text-emerald-600" />
                  <span>Freezing Batch Details (Asked on Every Freezing)</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <DateInputDDMMYYYY
                    label="Date of ASP (Aspiration)"
                    value={aspirationDate}
                    onChange={(val) => setAspirationDate(val)}
                  />

                  <DateInputDDMMYYYY
                    label="Date of Freezing"
                    required
                    value={freezingDate}
                    onChange={(val) => {
                      setFreezingDate(val);
                      setStorageDate(val);
                    }}
                  />

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Stage of Embryo *
                    </label>
                    <select
                      value={embryoStage}
                      onChange={(e) => setEmbryoStage(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 h-11 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Day 0">Day 0</option>
                      <option value="Day 2">Day 2</option>
                      <option value="Day 3">Day 3</option>
                      <option value="Day 5">Day 5</option>
                      <option value="Day 6">Day 6</option>
                      <option value="Day 5/6">Day 5/6</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Number of Straws *
                    </label>
                    <div className="flex items-center gap-1.5 h-11">
                      <button
                        type="button"
                        onClick={() => handleUpdateStrawsCount(strawsCount - 1)}
                        className="w-9 h-9 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg border border-rose-300 font-bold flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-xs"
                      >
                        <Minus className="w-3.5 h-3.5 text-rose-700 stroke-[2.5]" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={strawsCount}
                        onChange={(e) => handleUpdateStrawsCount(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-center text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateStrawsCount(strawsCount + 1)}
                        className="w-9 h-9 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg border border-emerald-300 font-bold flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-800" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* GRANULAR PER-STRAW ALLOCATION TABLE / CARDS */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span>Straw Configuration & Individual Metadata</span>
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      Total {strawsCount} Straw(s) ({strawItems.reduce((sum, s) => sum + (s.embryoCount || 1), 0)} Embryo(s))
                    </span>
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {strawItems.map((item, idx) => {
                    const badgeClass = getStrawColorBadgeClass(item.color);
                    return (
                      <div key={idx} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-bold text-slate-900">Straw #{idx + 1}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeClass}`}>
                              {item.color} Tag
                            </span>
                          </div>

                          {/* PGT Tested Tick Checkbox */}
                          <label className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            item.isPgt
                              ? 'bg-purple-100 text-purple-950 border-purple-300 shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}>
                            <input
                              type="checkbox"
                              checked={item.isPgt}
                              onChange={(e) => {
                                const next = [...strawItems];
                                next[idx].isPgt = e.target.checked;
                                setStrawItems(next);
                              }}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                            <span>PGT Tested ({item.isPgt ? 'TRUE' : 'FALSE'})</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                              Straw Color Tag *
                            </label>
                            <select
                              value={item.color}
                              onChange={(e) => {
                                const next = [...strawItems];
                                next[idx].color = e.target.value;
                                setStrawItems(next);
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                            >
                              {['Pink', 'Grey', 'Red', 'Black', 'Green', 'Rust', 'Blue', 'Purple', 'Yellow', 'Orange', 'Skyblue'].map((c) => (
                                <option key={c} value={c}>
                                  {c} Straw Color
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                              Embryos in Straw #{idx + 1} *
                            </label>
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...strawItems];
                                  next[idx].embryoCount = 1;
                                  setStrawItems(next);
                                }}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                  item.embryoCount === 1
                                    ? 'bg-emerald-600 text-white shadow-xs font-mono font-bold'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                              >
                                1 Embryo
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...strawItems];
                                  next[idx].embryoCount = 2;
                                  setStrawItems(next);
                                }}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                                  item.embryoCount === 2
                                    ? 'bg-emerald-600 text-white shadow-xs font-mono font-bold'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                }`}
                              >
                                2 Embryos
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                              Embryo Grade
                            </label>
                            <input
                              type="text"
                              value={item.grade}
                              onChange={(e) => {
                                const next = [...strawItems];
                                next[idx].grade = e.target.value;
                                setStrawItems(next);
                              }}
                              placeholder="e.g. 4AA, 4BB, 3AA"
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 uppercase mb-1">
                              Straw Specific Comments
                            </label>
                            <input
                              type="text"
                              value={item.comments}
                              onChange={(e) => {
                                const next = [...strawItems];
                                next[idx].comments = e.target.value;
                                setStrawItems(next);
                              }}
                              placeholder="Remarks for this straw..."
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                          {strawsCount} Straw(s) Required
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
                        {[1, 2, 3, 4, 5, 8, 10, 11, 14].map(cNum => {
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
                      const requiredStrawsNeeded = strawsCount;

                      if (loadingHierarchy) {
                        return (
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-bold flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                            <span>Loading Viso Tubes for {manualCanCode} Canister {manualCanisterNum.toString().padStart(2, '0')} Level {manualLevelNum}...</span>
                          </div>
                        );
                      }

                      if (tubes.length === 0) {
                        return (
                          <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                            <span>No storage tubes found for {manualCanCode}.</span>
                            <button
                              type="button"
                              onClick={() => fetchHierarchy()}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors"
                            >
                              Retry Loading
                            </button>
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

      {/* Print / Send Email Report Modal */}
      <ReportPrintMailModal
        isOpen={!!reportMailPatient}
        onClose={() => setReportMailPatient(null)}
        patient={reportMailPatient}
      />

      {/* Adjust Patient Profile Picture Modal */}
      <ImageCropRotateModal
        isOpen={Boolean(cropModalFile)}
        imageFile={cropModalFile}
        title="Adjust & Rotate Patient Profile Picture"
        onClose={() => setCropModalFile(null)}
        onConfirm={(processedFile, dataUrl) => {
          setPhotoFile(processedFile);
          setPhotoPreviewUrl(dataUrl);
        }}
      />
    </div>
  );
};
