import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Save, Search, CheckCircle2, ShieldAlert, Sparkles, Layers, Info, UserCheck, AlertTriangle, RefreshCw, Plus, Minus, Flame, Snowflake, X, Calendar, Printer, Mail, Camera, Upload, User, RotateCcw, RotateCw, Check, Eye, Dna } from 'lucide-react';
import { apiRequest, formatDateDDMMYYYY, calculateEmbryoStage } from '../api/client';
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

export const CLINIC_STRAW_COLORS = ['Pink', 'Green', 'Blue', 'Yellow', 'White'] as const;

export const CLINIC_DOCTORS = [
  'Dr Abha Majumdar',
  'Dr. Shweta Mittal Gupta',
  'Dr. Neeti Tiwari',
  'Dr. Ruma Satwik',
  'Dr. Sakshi Nayar',
  'Dr. Bhawani Shekhar',
  'Dr. Tejashri Shrotri',
  'GOPD Unit IVA',
  'GOPD Unit IVB',
] as const;

export const FRAGMENTATION_OPTIONS = ['No', '+', '++'] as const;

export function capitalizeWords(str: string): string {
  if (!str) return '';
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

export const DoctorSelect: React.FC<{
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  className?: string;
  label?: string;
}> = ({ value, onChange, required, className, label }) => {
  const isPreset = CLINIC_DOCTORS.includes(value as any);
  const [isCustom, setIsCustom] = useState(!isPreset && Boolean(value));

  useEffect(() => {
    if (!CLINIC_DOCTORS.includes(value as any) && Boolean(value)) {
      setIsCustom(true);
    }
  }, [value]);

  return (
    <div className="space-y-1 w-full">
      {label && (
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
          {label} {required && <span className="text-rose-600 font-bold">*</span>}
        </label>
      )}
      <select
        value={isCustom ? 'Other' : value}
        onChange={(e) => {
          if (e.target.value === 'Other') {
            setIsCustom(true);
            onChange('');
          } else {
            setIsCustom(false);
            onChange(e.target.value);
          }
        }}
        required={required && !value}
        className={className || "w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"}
      >
        <option value="">-- Select Doctor --</option>
        {CLINIC_DOCTORS.map((doc) => (
          <option key={doc} value={doc}>
            {doc}
          </option>
        ))}
        <option value="Other">Other / Custom Doctor Name...</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter Doctor Name"
          required={required}
          className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 mt-1.5"
        />
      )}
    </div>
  );
};

export function getStrawColorBadgeClass(colorName?: string): string {
  const color = (colorName || '').toLowerCase().trim();
  switch (color) {
    case 'pink':
      return 'bg-pink-100 text-pink-900 border-pink-300 font-bold';
    case 'green':
      return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
    case 'blue':
      return 'bg-blue-100 text-blue-900 border-blue-300 font-bold';
    case 'yellow':
      return 'bg-yellow-100 text-yellow-950 border-yellow-400 font-bold';
    case 'white':
      return 'bg-slate-100 text-slate-900 border-slate-300 font-bold';
    default:
      return 'bg-amber-50 text-amber-900 border-amber-300 font-bold';
  }
}

export function getStrawStageSummary(item: any, specimenType?: string): string {
  if (!item) return '';
  const count = item.embryoCount || (item.embryos ? item.embryos.length : 1);
  const isOocyte = specimenType === 'OOCYTE' || item.specimenType === 'OOCYTE';

  if (isOocyte) {
    const stageCounts: Record<string, number> = {};
    for (let i = 0; i < count; i++) {
      const eGradeKey = `grade${i + 1}`;
      let stg = (item[eGradeKey] || (i === 0 ? (item.grade || item.embryoStage || item.stage) : '') || 'MII').toString().trim().toUpperCase();
      if (!['MII', 'MI', 'GV'].includes(stg)) stg = 'MII';
      stageCounts[stg] = (stageCounts[stg] || 0) + 1;
    }
    const parts: string[] = [];
    ['MII', 'MI', 'GV'].forEach((stg) => {
      if (stageCounts[stg]) {
        parts.push(`${stageCounts[stg]} ${stg}`);
      }
    });
    return parts.length > 0 ? parts.join(' + ') : `${count} MII`;
  } else {
    const grades: string[] = [];
    for (let i = 0; i < count; i++) {
      const eGradeKey = `grade${i + 1}`;
      const g = (item[eGradeKey] || (i === 0 ? item.grade : '') || '').toString().trim().toUpperCase();
      if (g) grades.push(g);
    }
    return grades.length > 0 ? grades.join(', ') : (item.grade || 'N/A');
  }
}

export function getBatchSummaryText(strawItems: any[], specimenType?: string): string {
  if (!strawItems || strawItems.length === 0) return '';
  const isOocyte = specimenType === 'OOCYTE';
  const totalCount = strawItems.reduce((sum, s) => sum + (s.embryoCount || (s.embryos ? s.embryos.length : 1)), 0);
  const countsPerStraw = strawItems.map((s) => s.embryoCount || (s.embryos ? s.embryos.length : 1));
  const countsStr = countsPerStraw.join(' + ');
  const unitLabel = isOocyte
    ? totalCount === 1 ? 'oocyte' : 'oocytes'
    : totalCount === 1 ? 'embryo' : 'embryos';

  if (isOocyte) {
    const totalStages: Record<string, number> = {};
    strawItems.forEach((item) => {
      const cnt = item.embryoCount || (item.embryos ? item.embryos.length : 1);
      for (let i = 0; i < cnt; i++) {
        const eGradeKey = `grade${i + 1}`;
        let stg = (item[eGradeKey] || (i === 0 ? (item.grade || item.embryoStage || item.stage) : '') || 'MII').toString().trim().toUpperCase();
        if (!['MII', 'MI', 'GV'].includes(stg)) stg = 'MII';
        totalStages[stg] = (totalStages[stg] || 0) + 1;
      }
    });
    const stageParts: string[] = [];
    ['MII', 'MI', 'GV'].forEach((stg) => {
      if (totalStages[stg]) {
        stageParts.push(`${totalStages[stg]} ${stg}`);
      }
    });
    Object.keys(totalStages).forEach((stg) => {
      if (!['MII', 'MI', 'GV'].includes(stg)) {
        stageParts.push(`${totalStages[stg]} ${stg}`);
      }
    });
    const stageSummary = stageParts.length > 0 ? ` (${stageParts.join(', ')})` : '';
    return `${totalCount} ${unitLabel} frozen in ${strawItems.length} straw${strawItems.length > 1 ? 's' : ''} (${countsStr})${stageSummary}`;
  } else {
    return `${totalCount} ${unitLabel} frozen in ${strawItems.length} straw${strawItems.length > 1 ? 's' : ''} (${countsStr})`;
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
    tube: `Viso Tube - ${colorName}`,
    tubeColor: colorName,
    formatted: `Can ${canNum} • Canister ${canisterNum} • ${levelName} • Viso Tube - ${colorName}`,
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

export function formatRawToDDMMYYYYMask(rawInput: string): string {
  // If user typed slashes or hyphens (e.g. 2/2/23), don't strip slashes during raw typing
  if (rawInput.includes('/') || rawInput.includes('-') || rawInput.includes('.')) {
    return rawInput;
  }
  const digits = rawInput.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export function normalizeFlexibleDateToDDMMYYYY(input: string): { formatted: string; iso: string } {
  if (!input) return { formatted: '', iso: '' };

  const parts = input.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let [dStr, mStr, yStr] = parts.map(p => p.trim());
    if (dStr && mStr && yStr) {
      let day = parseInt(dStr, 10);
      let month = parseInt(mStr, 10);
      let year = parseInt(yStr, 10);

      // Convert 2-digit year to 4-digit year (e.g. 23 -> 2023, 88 -> 1988)
      if (yStr.length === 2) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        const dd = day.toString().padStart(2, '0');
        const mm = month.toString().padStart(2, '0');
        const yyyy = year.toString();
        const formatted = `${dd}/${mm}/${yyyy}`;
        const iso = `${yyyy}-${mm}-${dd}`;
        return { formatted, iso };
      }
    }
  }

  // Also try 8 digits
  const digits = input.replace(/\D/g, '');
  if (digits.length === 8) {
    const day = parseInt(digits.substring(0, 2), 10);
    const month = parseInt(digits.substring(2, 4), 10);
    const year = parseInt(digits.substring(4, 8), 10);

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const dd = day.toString().padStart(2, '0');
      const mm = month.toString().padStart(2, '0');
      const yyyy = year.toString();
      return { formatted: `${dd}/${mm}/${yyyy}`, iso: `${yyyy}-${mm}-${dd}` };
    }
  }

  return { formatted: input, iso: '' };
}

export function parseDDMMYYYYToISO(input: string): string {
  const { iso } = normalizeFlexibleDateToDDMMYYYY(input);
  return iso;
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
    const formatted = formatRawToDDMMYYYYMask(raw);
    setDisplayValue(formatted);

    const { iso } = normalizeFlexibleDateToDDMMYYYY(formatted);
    if (iso && iso.length === 10) {
      onChange(iso);
    } else if (!formatted) {
      onChange('');
    }
  };

  const handleBlur = () => {
    if (!displayValue) return;
    const { formatted, iso } = normalizeFlexibleDateToDDMMYYYY(displayValue);
    if (iso) {
      setDisplayValue(formatted);
      onChange(iso);
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
          onBlur={handleBlur}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          required={required}
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
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [viewDetailStraw, setViewDetailStraw] = useState<any | null>(null);

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
  const [embryoStage, setEmbryoStage] = useState('Day 0 / Oocyte Freezing');

  // Specimen & Cycle Classification States
  const [specimenType, setSpecimenType] = useState<'EMBRYO' | 'OOCYTE' | 'SPERM'>('EMBRYO');
  const [cycleType, setCycleType] = useState<'SELF' | 'DONOR_RECIPIENT'>('SELF');
  const [donorName, setDonorName] = useState('');
  const [donorAge, setDonorAge] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [vitrificationIndication, setVitrificationIndication] = useState('Social egg freezing');
  const [oocyteStage, setOocyteStage] = useState('MII');

  useEffect(() => {
    if (aspirationDate && freezingDate) {
      const stage = calculateEmbryoStage(aspirationDate, freezingDate);
      setEmbryoStage(stage);
    }
  }, [aspirationDate, freezingDate]);

  // Email OTP Verification States
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [showEmailOtpInput, setShowEmailOtpInput] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState<string | null>(null);

  const handleSendEmailOtp = async () => {
    if (!email || !email.includes('@')) {
      setOtpError('Please enter a valid email address first.');
      return;
    }
    setSendingOtp(true);
    setOtpError(null);
    setOtpSuccessMsg(null);
    try {
      const res = await apiRequest('/api/auth/send-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email, patientName: fullName || 'Patient' }),
      });
      if (res.success) {
        setShowEmailOtpInput(true);
        setOtpSuccessMsg(res.message || 'OTP verification code sent to email!');
      } else {
        setOtpError(res.error || 'Failed to send OTP.');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Failed to send OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtpCode || emailOtpCode.trim().length !== 6) {
      setOtpError('Please enter the 6-digit OTP code.');
      return;
    }
    setVerifyingOtp(true);
    setOtpError(null);
    setOtpSuccessMsg(null);
    try {
      const res = await apiRequest('/api/auth/verify-email-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code: emailOtpCode.trim() }),
      });
      if (res.success && res.verified) {
        setIsEmailVerified(true);
        setShowEmailOtpInput(false);
        setOtpSuccessMsg('✓ Email verified successfully!');
      } else {
        setOtpError(res.error || 'Invalid OTP code.');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed.');
    } finally {
      setVerifyingOtp(false);
    }
  };
  const [thawDate, setThawDate] = useState('');
  const [comments, setComments] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [partnerPhotoFile, setPartnerPhotoFile] = useState<File | null>(null);
  const [partnerPhotoPreviewUrl, setPartnerPhotoPreviewUrl] = useState<string | null>(null);
  const [cropModalFile, setCropModalFile] = useState<File | null>(null);
  const [croppingTarget, setCroppingTarget] = useState<'patient' | 'partner'>('patient');

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
    { color: '', embryoCount: 1, grade: '', comments: '', isPgt: false },
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

  const populatePatientFields = (pt: any) => {
    if (!pt) return;
    setCustomPatientId(pt.patientId || '');
    setFullName(capitalizeWords(pt.fullName || ''));
    setPartnerName(capitalizeWords(pt.partnerName || ''));
    setPhone(pt.phone || '');
    setPartnerPhone(pt.partnerPhone || '');
    setEmail(pt.email || '');
    setPartnerEmail(pt.partnerEmail || '');
    setDob(pt.dob || '');
    setPartnerDob(pt.partnerDob || '');
    setPatientAge(pt.patientAge || calculateAgeFromDob(pt.dob));
    setPartnerAge(pt.partnerAge || calculateAgeFromDob(pt.partnerDob));
    setDoctorName(pt.doctorName || '');
    if (pt.comments) setComments(pt.comments);
    if (pt.aspirationDate) setAspirationDate(typeof pt.aspirationDate === 'string' ? pt.aspirationDate.split('T')[0] : '');
    setIsEmailVerified(Boolean(pt.isEmailVerified));
    setSpecimenType(pt.specimenType || 'EMBRYO');
    setCycleType(pt.cycleType || 'SELF');
    setDonorName(pt.donorName || '');
    setDonorAge(pt.donorAge || '');
    setDonorPhone(pt.donorPhone || '');
    setVitrificationIndication(pt.vitrificationIndication || 'Social egg freezing');
    setOocyteStage(pt.oocyteStage || 'MII');
    if (pt.photoUrl) setPhotoPreviewUrl(pt.photoUrl);
    if (pt.partnerPhotoUrl) setPartnerPhotoPreviewUrl(pt.partnerPhotoUrl);
  };

  // Select Existing Patient & Auto-Fill Fields
  const handleSelectExistingPatient = async (p: any) => {
    setSelectedExistingPatient(p);
    populatePatientFields(p);
    setFreezingDate(new Date().toISOString().split('T')[0]);
    setStorageDate(new Date().toISOString().split('T')[0]);
    setExistingSearchResults([]);
    setThawSuccessMsg(null);

    setReloadingPatientDetails(true);
    try {
      const res = await apiRequest(`/api/patients/${p.id}`);
      if (res.success && res.patient) {
        setSelectedExistingPatient(res.patient);
        populatePatientFields(res.patient);
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
    setThawSuccessMsg(null);

    enqueueTask({
      title: `Thawing Straw ${strawCode}: ${patientName}`,
      description: `Thawing specimen for ${patientName}`,
      action: async () => {
        const res = await apiRequest('/api/thaw', {
          method: 'POST',
          body: JSON.stringify({
            strawIds: [targetStrawId],
            doctorNotes: targetNotes || 'Thawed directly from Patient Record Form',
          }),
        });
        return res;
      },
      onSuccess: async () => {
        setThawSuccessMsg(`Successfully thawed straw ${strawCode} for ${patientName}`);
        setReloadingPatientDetails(true);
        try {
          const res = await apiRequest(`/api/patients/${targetPatientId}`);
          if (res.success && res.patient) {
            setSelectedExistingPatient(res.patient);
            populatePatientFields(res.patient);
          }
        } catch (err: any) {
          console.error('Failed to refresh patient detail after thaw:', err);
        } finally {
          setReloadingPatientDetails(false);
        }
      },
    });
  };

  // Clear Selected Existing Patient & Reset ALL Form Fields Completely
  const handleClearSelectedExisting = () => {
    setSelectedExistingPatient(null);
    setCustomPatientId('');
    setFullName('');
    setPartnerName('');
    setPhone('');
    setPartnerPhone('');
    setEmail('');
    setPartnerEmail('');
    setDob('');
    setPartnerDob('');
    setPatientAge('');
    setPartnerAge('');
    setDoctorName('');
    setAspirationDate(new Date().toISOString().split('T')[0]);
    setFreezingDate(new Date().toISOString().split('T')[0]);
    setEmbryoStage('Day 5');
    setThawDate('');
    setComments('');
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setCropModalFile(null);
    setAssignStorageEnabled(false);
    setStrawsCount(1);
    setStrawItems([{ color: '', embryoCount: 1, grade: '', comments: '', isPgt: false }]);
    setExistingSearchQuery('');
    setExistingSearchResults([]);
    setSpecimenType('EMBRYO');
    setCycleType('SELF');
    setDonorName('');
    setDonorAge('');
    setDonorPhone('');
    setVitrificationIndication('Social egg freezing');
    setOocyteStage('MII');
    setError(null);
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
      const remaining = 14 - occupiedCount;
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
      if (prev.length < validCount) {
        const next = [...prev];
        const primaryColor = prev[0]?.color || '';
        const defaultGrade = specimenType === 'OOCYTE' ? 'MII' : '';
        for (let i = prev.length; i < validCount; i++) {
          next.push({ color: primaryColor, embryoCount: 1, grade: defaultGrade, comments: '', isPgt: false });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formMode === 'new') {
      if (!fullName.trim() || !doctorName.trim()) {
        setError('Patient Full Name and Doctor Name are required.');
        return;
      }
      if (!dob.trim()) {
        setError('Patient Date of Birth (DOB) is required.');
        return;
      }
      if (!email.trim()) {
        setError('Patient Email Address is required.');
        return;
      }
      if (!phone.trim() && !partnerPhone.trim()) {
        setError('Please enter at least 1 Mobile Phone number (Patient or Partner).');
        return;
      }
    } else {
      if (!selectedExistingPatient) {
        setError('Please search and select an existing patient first.');
        return;
      }
      if (!doctorName.trim()) {
        setError('Doctor Name is required.');
        return;
      }
    }

    if (assignStorageEnabled && strawItems.some((s) => !s.color)) {
      setError('Please select a straw color for all straws before saving.');
      return;
    }

    // Open Pre-Save Confirmation & Overview Modal
    setShowConfirmationModal(true);
  };

  const executeFormSubmit = async () => {
    setShowConfirmationModal(false);
    setError(null);

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
      partnerPhotoFile,
      assignStorageEnabled,
      selectedVisoTubeId,
      selectedLocationCode,
      storageDate: freezingDate,
      strawsCount,
      strawItems: [...strawItems],
      totalEmbryosCount,
      isEmailVerified,
      specimenType,
      cycleType,
      donorName: donorName.trim(),
      donorAge: donorAge.trim(),
      donorPhone: donorPhone.trim(),
      vitrificationIndication: vitrificationIndication.trim(),
      oocyteStage: oocyteStage.trim(),
    };

    // Reset photo state
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPartnerPhotoFile(null);
    setPartnerPhotoPreviewUrl(null);

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
              isEmailVerified: payload.isEmailVerified,
              specimenType: payload.specimenType,
              cycleType: payload.cycleType,
              donorName: payload.donorName || undefined,
              donorAge: payload.donorAge || undefined,
              donorPhone: payload.donorPhone || undefined,
              vitrificationIndication: payload.vitrificationIndication || undefined,
              oocyteStage: payload.oocyteStage || undefined,
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
              isEmailVerified: payload.isEmailVerified,
              specimenType: payload.specimenType,
              cycleType: payload.cycleType,
              donorName: payload.donorName || undefined,
              donorAge: payload.donorAge || undefined,
              donorPhone: payload.donorPhone || undefined,
              vitrificationIndication: payload.vitrificationIndication || undefined,
              oocyteStage: payload.oocyteStage || undefined,
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

        if (payload.partnerPhotoFile && targetPatient) {
          const formData = new FormData();
          formData.append('photo', payload.partnerPhotoFile);
          formData.append('type', 'partner');
          await apiRequest(`/api/patients/${targetPatient.id}/partner-photo`, {
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
              specimenType: payload.specimenType,
              cycleType: payload.cycleType,
              donorName: payload.donorName || undefined,
              donorAge: payload.donorAge || undefined,
              donorPhone: payload.donorPhone || undefined,
              vitrificationIndication: payload.vitrificationIndication || undefined,
              oocyteStage: payload.oocyteStage || undefined,
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
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Embryo/Oocyte/Sperm Freezing & Storage Allocation</h1>
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
              <span>Search Existing Patient by Reg ID, Mobile, or Name:</span>
            </h2>
          </div>

          <div className="relative">
            <input
              type="text"
              value={existingSearchQuery}
              onChange={(e) => handleSearchExisting(e.target.value)}
              placeholder="Type Reg ID (e.g. IVF-2026-000001), Mobile, or Patient Name..."
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
                        Reg ID: {p.patientId}
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
                <span>Reg ID: {selectedExistingPatient.patientId}</span>
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
                  activeStraws.push({
                    ...s,
                    batchCode: b.batchId,
                    freezingDate: b.freezingDate || b.storageDate,
                    aspirationDate: b.aspirationDate,
                    doctorName: b.doctorName || selectedExistingPatient.doctorName,
                    embryoStage: b.embryoStage,
                    batchComments: b.comments || b.notes,
                  });
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
              <span className="text-[10px] text-emerald-800 font-bold font-mono bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Click any straw to view full specimen details
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeStraws.map((straw: any) => {
                const locCode = straw.visoTube?.locationCode || '';
                const parsedLoc = locCode ? parseLocationCode(locCode).formatted : '';
                const embryoCount = straw.embryos ? straw.embryos.length : (straw.embryoCount || 1);

                return (
                  <div
                    key={straw.id}
                    onClick={() => setViewDetailStraw(straw)}
                    className="p-4 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-400 rounded-2xl space-y-3 shadow-xs cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded-lg">{straw.strawId}</span>
                        <span className="text-[10px] text-emerald-700 font-bold group-hover:underline flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-emerald-600" />
                          <span>View All Details</span>
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-md border ${getStrawColorBadgeClass(straw.color)}`}>
                        {embryoCount} Embryo{embryoCount > 1 ? 's' : ''} ({straw.color || 'Pink'})
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setThawModalStraw(straw);
                      }}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
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

      <form onSubmit={handleSubmit} className="space-y-8" autoComplete="off">
        {/* Section 1: Clinical Patient Details */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-2">
            <span>Patient & Clinical Details</span>
            <div className="flex items-center gap-2">
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

          {/* Cycle Type & Specimen Type Selector */}
          <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/90 to-blue-50/90 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 space-y-4 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Specimen Type Selection */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Dna className="w-4 h-4 text-emerald-600" />
                  <span>Specimen Type Frozen</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'EMBRYO', label: 'Embryo'},
                    { id: 'OOCYTE', label: 'Egg (Oocyte)' },
                    { id: 'SPERM', label: 'Sperm' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSpecimenType(item.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        specimenType === item.id
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs scale-102 font-extrabold'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                      }`}
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cycle Classification (Self vs Donor-Recipient) */}
              <div>
                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Cycle Classification</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'SELF', label: 'Self Cycle (Autologous)', desc: 'Own eggs/specimens used' },
                    { id: 'DONOR_RECIPIENT', label: 'D-R Cycle (Donor Eggs)', desc: 'Donor eggs/specimens used' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCycleType(item.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex flex-col items-start justify-center gap-0.5 text-left cursor-pointer ${
                        cycleType === item.id
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs scale-102'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                      }`}
                    >
                      <span className="font-extrabold">{item.label}</span>
                      <span className={`text-[9.5px] font-normal ${cycleType === item.id ? 'text-blue-100' : 'text-slate-500'}`}>
                        {item.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Donor Information Card (Shown if D-R Cycle) */}
            {cycleType === 'DONOR_RECIPIENT' && (
              <div className="p-3.5 bg-amber-50/90 rounded-xl border border-amber-300/80 space-y-3 mt-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                  <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5 uppercase tracking-wider">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    <span>Egg / Oocyte Donor Profile (D-R Cycle)</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full border border-amber-400/60">
                    Donor Details
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Donor Name *
                    </label>
                    <input
                      type="text"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      placeholder="e.g. Anjali Sharma"
                      className="w-full h-10 bg-white border border-amber-300 rounded-lg px-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Donor Age
                    </label>
                    <input
                      type="text"
                      value={donorAge}
                      onChange={(e) => setDonorAge(e.target.value)}
                      placeholder="e.g. 24 Yrs"
                      className="w-full h-10 bg-white border border-amber-300 rounded-lg px-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Donor Phone Number
                    </label>
                    <input
                      type="text"
                      value={donorPhone}
                      onChange={(e) => setDonorPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full h-10 bg-white border border-amber-300 rounded-lg px-3 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Oocyte Vitrification Fields (Shown if Oocyte or Egg vitrification) */}
            {specimenType === 'OOCYTE' && (
              <div className="p-3.5 bg-emerald-50/90 rounded-xl border border-emerald-300/80 space-y-3 mt-3 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                  <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Indication for Oocyte Vitrification</span>
                  </span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
                    Indication for Oocyte Vitrification
                  </label>
                  <select
                    value={vitrificationIndication}
                    onChange={(e) => setVitrificationIndication(e.target.value)}
                    className="w-full h-10 bg-white border border-emerald-300 rounded-lg px-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Social egg freezing">1. Social egg freezing</option>
                    <option value="Onco fertility preservation">2. Onco fertility preservation</option>
                    <option value="Emergency egg freezing">3. Emergency egg freezing</option>
                    {cycleType === 'DONOR_RECIPIENT' && (
                      <option value="Supernumerary donor egg freezing">4. Supernumerary donor egg freezing</option>
                    )}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full max-w-full">
            {/* REGISTRATION ID (UNIQUE KEY) */}
            <div className="md:col-span-2 min-w-0 max-w-full">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Registration ID (Unique Key) <span className="text-rose-600 font-bold">*</span></span>
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

            {/* DUAL PATIENT & PARTNER PHOTO UPLOADER BOXES */}
            {!selectedExistingPatient && (
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                {/* WIFE / FEMALE PATIENT PHOTO */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-2xs">
                  <div
                    className="relative group shrink-0 cursor-pointer"
                    onClick={() => {
                      setCroppingTarget('patient');
                      if (photoFile) {
                        setCropModalFile(photoFile);
                      } else if (photoPreviewUrl) {
                        fetch(photoPreviewUrl)
                          .then((res) => res.blob())
                          .then((blob) => {
                            const file = new File([blob], 'patient-photo.jpg', { type: 'image/jpeg' });
                            setCropModalFile(file);
                          })
                          .catch((err) => console.error('Error fetching photo for crop:', err));
                      } else {
                        document.getElementById('patient-form-photo-input')?.click();
                      }
                    }}
                    title="Click/Tap photo to Crop, Rotate, or Change Wife Photo"
                  >
                    {photoPreviewUrl ? (
                      <div className="relative">
                        <img
                          src={photoPreviewUrl}
                          alt="Wife / Patient Preview"
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-emerald-500 shadow-md transition-transform active:scale-95"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-50 border-2 border-dashed border-emerald-300 flex flex-col items-center justify-center text-center p-1 text-slate-400 font-bold text-xs hover:border-emerald-500 hover:text-emerald-600 transition-all active:scale-95 shadow-2xs">
                        <Camera className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-[9px] text-emerald-800 font-bold text-center leading-tight mt-0.5 w-full block truncate">Wife Photo</span>
                      </div>
                    )}

                    <input
                      id="patient-form-photo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        setCroppingTarget('patient');
                        handlePhotoSelect(e);
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Wife / Patient Photo</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {photoPreviewUrl ? 'Tap to edit/rotate photo' : 'Select or capture Wife photo'}
                    </p>
                  </div>
                </div>

                {/* HUSBAND / MALE PARTNER PHOTO */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-2xs">
                  <div
                    className="relative group shrink-0 cursor-pointer"
                    onClick={() => {
                      setCroppingTarget('partner');
                      if (partnerPhotoFile) {
                        setCropModalFile(partnerPhotoFile);
                      } else if (partnerPhotoPreviewUrl) {
                        fetch(partnerPhotoPreviewUrl)
                          .then((res) => res.blob())
                          .then((blob) => {
                            const file = new File([blob], 'partner-photo.jpg', { type: 'image/jpeg' });
                            setCropModalFile(file);
                          })
                          .catch((err) => console.error('Error fetching partner photo for crop:', err));
                      } else {
                        document.getElementById('patient-form-partner-photo-input')?.click();
                      }
                    }}
                    title="Click/Tap photo to Crop, Rotate, or Change Husband Photo"
                  >
                    {partnerPhotoPreviewUrl ? (
                      <div className="relative">
                        <img
                          src={partnerPhotoPreviewUrl}
                          alt="Husband / Partner Preview"
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-blue-500 shadow-md transition-transform active:scale-95"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-50 border-2 border-dashed border-blue-300 flex flex-col items-center justify-center text-center p-1 text-slate-400 font-bold text-xs hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95 shadow-2xs">
                        <Camera className="w-5 h-5 text-blue-600 shrink-0" />
                        <span className="text-[9px] text-blue-800 font-bold text-center leading-tight mt-0.5 w-full block truncate">Husband Photo</span>
                      </div>
                    )}

                    <input
                      id="patient-form-partner-photo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        setCroppingTarget('partner');
                        handlePhotoSelect(e);
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-blue-950 text-xs flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Husband / Partner Photo</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {partnerPhotoPreviewUrl ? 'Tap to edit/rotate photo' : 'Select or capture Husband photo'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PATIENT DEMOGRAPHICS CONTAINER */}
            <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl space-y-4 min-w-0 max-w-full">
              <div className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider border-b border-emerald-200/80 pb-2 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Patient Demographics (Wife / Female Patient)</span>
              </div>

              {/* Patient Name */}
              <div className="min-w-0 max-w-full">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Patient Full Name <span className="text-rose-600 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(capitalizeWords(e.target.value))}
                  placeholder="e.g. Sunita Verma"
                  required
                  className="w-full min-w-0 max-w-full h-11 box-border bg-white border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-bold block"
                />
              </div>

              {/* Patient DOB */}
              <div className="min-w-0 max-w-full">
                <DateInputDDMMYYYY
                  label="Patient Date of Birth (DOB)"
                  value={dob}
                  required
                  onChange={(val) => {
                    setDob(val);
                    if (val) {
                      setPatientAge(calculateAgeFromDob(val));
                    }
                  }}
                />
              </div>

              {/* Patient Age */}
              <div className="min-w-0 max-w-full">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Patient Age
                </label>
                <input
                  type="text"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  placeholder="e.g. 36 Yrs"
                  className="w-full min-w-0 max-w-full h-11 box-border bg-white border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-500 block"
                />
              </div>

              {/* Patient Phone */}
              <div className="min-w-0 max-w-full">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Patient Mobile Phone <span className="text-rose-600 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98260 78901"
                  className="w-full min-w-0 max-w-full h-11 box-border bg-white border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500 block"
                />
              </div>

              {/* Patient Email */}
              <div className="min-w-0 max-w-full">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Patient Email Address <span className="text-rose-600 font-bold">*</span>
                  </label>
                  {isEmailVerified ? (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Verified Email
                    </span>
                  ) : email ? (
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={sendingOtp}
                      className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-full transition-all active:scale-95 cursor-pointer"
                    >
                      {sendingOtp ? 'Sending OTP...' : 'Verify Email OTP'}
                    </button>
                  ) : null}
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setIsEmailVerified(false);
                  }}
                  placeholder="e.g. patient@example.com"
                  required
                  className="w-full min-w-0 max-w-full h-11 box-border bg-white border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500 block"
                />

                {/* OTP Code Entry Drawer */}
                {showEmailOtpInput && !isEmailVerified && (
                  <div className="mt-2.5 p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                    <div className="text-xs font-bold text-blue-900">Enter 6-Digit Email OTP Code</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={emailOtpCode}
                        onChange={(e) => setEmailOtpCode(e.target.value)}
                        placeholder="e.g. 123456"
                        className="w-32 h-9 bg-white border border-blue-300 rounded-lg px-3 text-xs font-mono font-bold text-slate-900 text-center tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyEmailOtp}
                        disabled={verifyingOtp}
                        className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        {verifyingOtp ? 'Verifying...' : 'Submit OTP'}
                      </button>
                    </div>
                    {otpError && <div className="text-[11px] font-bold text-rose-600">{otpError}</div>}
                    {otpSuccessMsg && <div className="text-[11px] font-bold text-emerald-700">{otpSuccessMsg}</div>}
                  </div>
                )}
              </div>
            </div>

            {/* PARTNER DEMOGRAPHICS CONTAINER */}
            <div className="p-4 bg-blue-50/40 border border-blue-200/80 rounded-2xl space-y-4 min-w-0 max-w-full">
              <div className="text-xs font-extrabold text-blue-950 uppercase tracking-wider border-b border-blue-200/80 pb-2 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Partner Demographics (Husband / Male Partner)</span>
              </div>

              {/* Partner Name */}
              <div className="min-w-0 max-w-full">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Partner Name
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(capitalizeWords(e.target.value))}
                  placeholder="e.g. Deepak Verma"
                  className="w-full min-w-0 max-w-full h-11 box-border bg-white border border-slate-300 rounded-xl px-4 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 block font-medium"
                />
              </div>

              {/* Partner DOB */}
              <div className="min-w-0 max-w-full">
                <DateInputDDMMYYYY
                  label="Partner Date of Birth (DOB)"
                  value={partnerDob}
                  onChange={(val) => {
                    setPartnerDob(val);
                    if (val) {
                      setPartnerAge(calculateAgeFromDob(val));
                    }
                  }}
                />
              </div>

              {/* Partner Age */}
              <div className="min-w-0 max-w-full">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Partner Age
                </label>
                <input
                  type="text"
                  value={partnerAge}
                  onChange={(e) => setPartnerAge(e.target.value)}
                  placeholder="e.g. 36 Yrs"
                  className="w-full min-w-0 max-w-full h-11 box-border bg-white border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-bold focus:outline-none focus:border-emerald-500 block"
                />
              </div>

              {/* Partner Phone */}
              <div className="min-w-0 max-w-full">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Partner Mobile Phone
                </label>
                <input
                  type="text"
                  value={partnerPhone}
                  onChange={(e) => setPartnerPhone(e.target.value)}
                  placeholder="e.g. +91 98260 12345"
                  className="w-full min-w-0 max-w-full h-11 box-border bg-white border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500 block"
                />
              </div>

              {/* Partner Email */}
              <div className="min-w-0 max-w-full">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Partner Email Address
                </label>
                <input
                  type="email"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  placeholder="e.g. partner@example.com"
                  className="w-full min-w-0 max-w-full h-11 box-border bg-white border border-slate-300 rounded-xl px-4 text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500 block"
                />
              </div>
            </div>

            {/* CLINICAL PHYSICIAN */}
            <div className="md:col-span-2 min-w-0 max-w-full">
              <DoctorSelect
                label="Doctor Name / Attending Physician"
                value={doctorName}
                onChange={(val) => setDoctorName(val)}
                required
              />
            </div>

            {/* <div className="md:col-span-2">
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
            </div> */}
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
                    label="Date of Egg Retrieval"
                    value={aspirationDate}
                    onChange={(val) => {
                      setAspirationDate(val);
                      if (val && freezingDate) {
                        setEmbryoStage(calculateEmbryoStage(val, freezingDate));
                      }
                    }}
                  />

                  <DateInputDDMMYYYY
                    label="Date of Freezing"
                    required
                    value={freezingDate}
                    onChange={(val) => {
                      setFreezingDate(val);
                      setStorageDate(val);
                      if (aspirationDate && val) {
                        setEmbryoStage(calculateEmbryoStage(aspirationDate, val));
                      }
                    }}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Stage of Ooctye
                      </label>
                      
                    </div>
                    <div className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 h-11 flex items-center text-xs font-bold text-emerald-950 font-mono shadow-2xs">
                      {embryoStage}
                    </div>
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    <span className="uppercase tracking-wider">Straw Configuration</span>
                    {specimenType === 'OOCYTE' ? (
                      <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 font-bold normal-case shadow-2xs">
                        TOTAL: {getBatchSummaryText(strawItems, specimenType)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 font-bold normal-case">
                        TOTAL {strawsCount} STRAWS - {strawItems.reduce((sum, s) => sum + (s.embryoCount || 1), 0)} EMBRYO(s)
                      </span>
                    )}
                  </h4>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {strawItems.map((item, idx) => {
                    const existingOffset = selectedExistingPatient?.batches?.reduce(
                      (acc: number, b: any) => acc + (b.straws ? b.straws.filter((s: any) => s.status === 'OCCUPIED').length : 0),
                      0
                    ) || 0;
                    const strawDisplayNum = existingOffset + idx + 1;
                    const badgeClass = getStrawColorBadgeClass(item.color);
                    return (
                      <div key={idx} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs">
                              #{strawDisplayNum}
                            </span>
                            {item.color ? (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeClass}`}>
                                {item.color}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-900 font-bold">
                                Color Unselected
                              </span>
                            )}
                            {specimenType === 'OOCYTE' && (
                              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 font-mono">
                                {item.embryoCount || 1} {(item.embryoCount || 1) === 1 ? 'oocyte' : 'oocytes'} ({getStrawStageSummary(item, specimenType)})
                              </span>
                            )}
                          </div>

                          {/* PGT Tested Tick Checkbox (Only for Embryo, hidden for Egg/Oocyte) */}
                          {specimenType !== 'OOCYTE' && (
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
                              <span>PGT Tested</span>
                            </label>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Straw Color *
                            </label>
                            <select
                              value={item.color}
                              onChange={(e) => {
                                const newColor = e.target.value;
                                const next = [...strawItems];
                                next[idx].color = newColor;
                                // Only pre-select remaining straws if user explicitly selects a color for Straw 1 (idx === 0)
                                if (idx === 0 && newColor) {
                                  for (let k = 1; k < next.length; k++) {
                                    next[k].color = newColor;
                                  }
                                }
                                setStrawItems(next);
                              }}
                              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                            >
                              <option value="">-- Select Straw Color --</option>
                              {['Pink', 'Green', 'Blue', 'Yellow', 'White'].map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              {strawDisplayNum} {specimenType === 'OOCYTE' ? 'No. of Oocyte(s)' : 'No of Embryo(s)'}
                            </label>
                            {specimenType === 'OOCYTE' ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Per-straw dropdown */}
                                <select
                                  value={item.embryoCount || 1}
                                  onChange={(e) => {
                                    const count = parseInt(e.target.value, 10) || 1;
                                    const next = [...strawItems];
                                    next[idx].embryoCount = count;
                                    setStrawItems(next);
                                  }}
                                  className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs"
                                >
                                  {[1, 2, 3, 4, 5, 6].map((num) => (
                                    <option key={num} value={num}>
                                      {num} {num === 1 ? 'oocyte' : 'oocytes'} / straw
                                    </option>
                                  ))}
                                </select>

                                {/* Quick selector buttons */}
                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 flex-1 min-w-[200px]">
                                  {[1, 2, 3, 4].map((count) => {
                                    const labelText = `${count} ${count === 1 ? 'oocyte' : 'oocytes'}`;
                                    return (
                                      <button
                                        key={count}
                                        type="button"
                                        onClick={() => {
                                          const next = [...strawItems];
                                          next[idx].embryoCount = count;
                                          setStrawItems(next);
                                        }}
                                        className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-bold transition-all ${
                                          item.embryoCount === count
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
                            ) : (
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
                            )}
                          </div>
                        </div>

                        {/* Granular Per-Embryo/Oocyte Breakdown (1, 2, 3, or 4 Items) */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                          <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                            <span>{specimenType === 'OOCYTE' ? 'Oocyte Stage & Details for Freezing' : 'Embryo Details'}</span>
                          </div>

                          {Array.from({ length: item.embryoCount || 1 }).map((_, eIdx) => {
                            const eGradeKey = `grade${eIdx + 1}`;
                            const eFragKey = `frag${eIdx + 1}`;
                            const eCommentKey = `comment${eIdx + 1}`;
                            const rawGradeVal = ((item as any)[eGradeKey] || (eIdx === 0 ? item.grade : '') || '').toString().trim().toUpperCase();
                            const currentGradeVal = specimenType === 'OOCYTE'
                              ? (['MII', 'MI', 'GV'].includes(rawGradeVal) ? rawGradeVal : 'MII')
                              : rawGradeVal;

                            return (
                              <div key={eIdx} className={`bg-white p-2.5 rounded-lg border border-slate-200 grid grid-cols-1 ${specimenType === 'OOCYTE' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-2.5 items-center`}>
                                <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    {(() => {
                                      const prevCount = strawItems.slice(0, idx).reduce((sum, s) => sum + (s.embryoCount || 1), 0);
                                      const globalIdx = prevCount + eIdx + 1;
                                      const totalCount = strawItems.reduce((sum, s) => sum + (s.embryoCount || 1), 0);
                                      if (specimenType === 'OOCYTE') {
                                        return totalCount > 1 ? `Oocyte #${globalIdx} Stage` : 'Oocyte Stage';
                                      } else {
                                        return totalCount > 1 ? `Embryo #${globalIdx} Grade` : 'Grade';
                                      }
                                    })()}
                                  </label>
                                  {specimenType === 'OOCYTE' ? (
                                    <div className="grid grid-cols-3 gap-1 h-9">
                                      {['MII', 'MI', 'GV'].map((stg) => (
                                        <button
                                          key={stg}
                                          type="button"
                                          onClick={() => {
                                            const next = [...strawItems];
                                            (next[idx] as any)[eGradeKey] = stg;
                                            if (eIdx === 0) next[idx].grade = stg;
                                            setStrawItems(next);
                                          }}
                                          className={`h-full rounded-md text-xs font-extrabold transition-all border flex items-center justify-center cursor-pointer ${
                                            currentGradeVal === stg
                                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
                                          }`}
                                        >
                                          {stg}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      value={currentGradeVal}
                                      onChange={(e) => {
                                        const upperGrade = e.target.value.toUpperCase();
                                        const next = [...strawItems];
                                        (next[idx] as any)[eGradeKey] = upperGrade;
                                        if (eIdx === 0) next[idx].grade = upperGrade;
                                        setStrawItems(next);
                                      }}
                                      placeholder="e.g. 5AA, 4BB"
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-500 uppercase"
                                    />
                                  )}
                                </div>

                                <div>
                                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    {specimenType === 'OOCYTE' ? 'Oocyte Remarks' : 'Fragmentation'}
                                  </label>
                                  {specimenType === 'OOCYTE' ? (
                                    <input
                                      type="text"
                                      value={(item as any)[eCommentKey] || (eIdx === 0 ? item.comments : '')}
                                      onChange={(e) => {
                                        const next = [...strawItems];
                                        (next[idx] as any)[eCommentKey] = e.target.value;
                                        if (eIdx === 0) next[idx].comments = e.target.value;
                                        setStrawItems(next);
                                      }}
                                      placeholder="e.g. Normal morphology"
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                  ) : (
                                    <select
                                      value={(item as any)[eFragKey] || 'No'}
                                      onChange={(e) => {
                                        const next = [...strawItems];
                                        (next[idx] as any)[eFragKey] = e.target.value;
                                        setStrawItems(next);
                                      }}
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                                    >
                                      <option value="No">No</option>
                                      <option value="+">+</option>
                                      <option value="++">++</option>
                                    </select>
                                  )}
                                </div>

                                {specimenType !== 'OOCYTE' && (
                                  <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                      Comment
                                    </label>
                                    <input
                                      type="text"
                                      value={(item as any)[eCommentKey] || (eIdx === 0 ? item.comments : '')}
                                      onChange={(e) => {
                                        const next = [...strawItems];
                                        (next[idx] as any)[eCommentKey] = e.target.value;
                                        if (eIdx === 0) next[idx].comments = e.target.value;
                                        setStrawItems(next);
                                      }}
                                      placeholder="Specific remarks..."
                                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
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
                        const remaining = 14 - occupiedCount;
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
                              const remaining = 14 - occupiedCount;
                              const tubeInt = t.tubeNumber || parseInt(t.locationCode?.match(/-V(\d+)/i)?.[1] || '1', 10);
                              const tNum = tubeInt.toString().padStart(2, '0');
                              const colorName = VISO_TUBE_COLOR_NAMES[tubeInt] || 'Standard';
                              return (
                                <option key={t.id} value={t.id}>
                                  Viso Tube - {colorName} — {remaining} / 14 Straw Slots Free (Available)
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
                    : 'Save & Allocate Embryo/Egg Storage Record'}
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

      {/* FULL STRAW SPECIMEN & CLINICAL DETAILS OVERVIEW MODAL */}
      {viewDetailStraw && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 bg-slate-900 text-white rounded-xl font-mono font-bold text-sm">
                  {viewDetailStraw.strawId}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStrawColorBadgeClass(viewDetailStraw.color)}`}>
                  {viewDetailStraw.color || 'Pink'}
                </span>
                {viewDetailStraw.isPgt && specimenType !== 'OOCYTE' && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs bg-purple-100 text-purple-900 border border-purple-300 font-bold">
                    PGT TESTED
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewDetailStraw(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Storage Location Card */}
            <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 space-y-1 text-xs">
              <div className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">
                Cryo Storage Physical Destination
              </div>
              <div className="font-mono font-bold text-emerald-950 bg-white p-2.5 rounded-xl border border-emerald-300">
                {viewDetailStraw.visoTube?.locationCode
                  ? parseLocationCode(viewDetailStraw.visoTube.locationCode).formatted
                  : 'Location Recorded'}
              </div>
            </div>

            {/* Embryo Breakdown List */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between border-b border-slate-200 pb-2">
                <span>Stored Embryos Breakdown ({viewDetailStraw.embryos?.length || viewDetailStraw.embryoCount || 1} Embryos)</span>
                <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded border border-blue-300 text-[10px] font-bold">
                  Stage: {viewDetailStraw.embryoStage || 'Day 5'}
                </span>
              </div>

              <div className="space-y-2">
                {viewDetailStraw.embryos && viewDetailStraw.embryos.length > 0 ? (
                  viewDetailStraw.embryos.map((emb: any, eIdx: number) => (
                    <div key={eIdx} className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1 shadow-2xs">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-900">Embryo #{emb.embryoNumber || eIdx + 1}</span>
                        <span className="font-mono text-emerald-800 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Grade: {emb.grade || 'N/A'}
                        </span>
                      </div>
                      {emb.notes && (
                        <div className="text-slate-600 text-[11px] italic">
                          "{emb.notes}"
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                    Grade: {viewDetailStraw.grade || '4AA'}
                  </div>
                )}
              </div>
            </div>

            {/* Clinical Metadata */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                Clinical Details & Physician Remarks
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Attending Doctor:</span>
                  <strong className="text-emerald-900 font-bold">{viewDetailStraw.doctorName || selectedExistingPatient?.doctorName || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Date of Egg Retrieval:</span>
                  <strong className="text-slate-900 font-bold">{formatDateDDMMYYYY(viewDetailStraw.aspirationDate || selectedExistingPatient?.aspirationDate)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Freezing Date:</span>
                  <strong className="text-slate-900 font-bold">{formatDateDDMMYYYY(viewDetailStraw.freezingDate || viewDetailStraw.storageDate)}</strong>
                </div>
              </div>

              {(viewDetailStraw.comments || viewDetailStraw.batchComments) && (
                <div className="pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Remarks & Notes:</span>
                  <p className="text-slate-700 italic font-medium">"{viewDetailStraw.comments || viewDetailStraw.batchComments}"</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewDetailStraw(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close Overview
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = viewDetailStraw;
                  setViewDetailStraw(null);
                  setThawModalStraw(target);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Flame className="w-4 h-4 text-amber-300" />
                <span>Thaw / Withdraw This Straw Now</span>
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
        title={croppingTarget === 'partner' ? "Adjust & Rotate Husband Profile Picture" : "Adjust & Rotate Wife Profile Picture"}
        onClose={() => setCropModalFile(null)}
        onConfirm={(processedFile, dataUrl) => {
          if (croppingTarget === 'partner') {
            setPartnerPhotoFile(processedFile);
            setPartnerPhotoPreviewUrl(dataUrl);
          } else {
            setPhotoFile(processedFile);
            setPhotoPreviewUrl(dataUrl);
          }
          setCropModalFile(null);
        }}
      />

      {/* PRE-SAVE CONFIRMATION & OVERVIEW MODAL */}
      {showConfirmationModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3 text-slate-900 font-bold text-base">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Confirm Full Overview Before Saving
                  </h3>
                  <p className="text-xs text-slate-500 font-normal">
                    {selectedExistingPatient
                      ? `Adding new freezing batch to existing patient record`
                      : `Registering new patient & allocating cryo storage slot`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmationModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Patient & Partner Complete Demographics */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between border-b border-slate-200 pb-2">
                <span>1. Patient & Partner Profile Summary</span>
                <span className="bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border border-emerald-300">
                  Reg ID: {customPatientId || selectedExistingPatient?.patientId || 'Auto-Generated'}
                </span>
              </div>

              <div className="flex items-start gap-4">
                {/* Photo Thumbnails */}
                <div className="shrink-0 flex items-center gap-2">
                  {/* Wife Photo */}
                  {photoPreviewUrl || selectedExistingPatient?.photoUrl ? (
                    <div className="text-center">
                      <img
                        src={photoPreviewUrl || getImageUrl(selectedExistingPatient?.photoUrl)}
                        alt="Wife Profile"
                        className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500 shadow-2xs"
                      />
                      <span className="text-[9px] font-bold text-emerald-800 uppercase block mt-0.5">Wife</span>
                    </div>
                  ) : null}

                  {/* Husband Photo */}
                  {partnerPhotoPreviewUrl || selectedExistingPatient?.partnerPhotoUrl ? (
                    <div className="text-center">
                      <img
                        src={partnerPhotoPreviewUrl || getImageUrl(selectedExistingPatient?.partnerPhotoUrl)}
                        alt="Husband Profile"
                        className="w-14 h-14 rounded-xl object-cover border-2 border-blue-500 shadow-2xs"
                      />
                      <span className="text-[9px] font-bold text-blue-800 uppercase block mt-0.5">Husband</span>
                    </div>
                  ) : null}

                  {!photoPreviewUrl && !selectedExistingPatient?.photoUrl && !partnerPhotoPreviewUrl && !selectedExistingPatient?.partnerPhotoUrl && (
                    <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-400">
                      <User className="w-7 h-7 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Demographics Grid */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">Patient Name:</span>
                    <strong className="text-slate-900 font-bold text-sm block">{fullName || selectedExistingPatient?.fullName}</strong>
                    {/* <div className="text-slate-600 space-y-0.5 text-[11px]">
                      <div><span className="font-semibold text-slate-700">DOB:</span> {formatDateDDMMYYYY(dob || selectedExistingPatient?.dob)} {patientAge || selectedExistingPatient?.patientAge ? `(Age: ${patientAge || selectedExistingPatient?.patientAge})` : ''}</div>
                      <div><span className="font-semibold text-slate-700">Phone:</span> {phone || selectedExistingPatient?.phone || 'N/A'}</div>
                      {(email || selectedExistingPatient?.email) && <div><span className="font-semibold text-slate-700">Email:</span> {email || selectedExistingPatient?.email}</div>}
                    </div> */}
                  </div>

                  {/* <div className="space-y-1">
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">Partner Demographics:</span>
                    <strong className="text-slate-900 font-bold text-sm block">{partnerName || selectedExistingPatient?.partnerName || 'N/A'}</strong>
                    <div className="text-slate-600 space-y-0.5 text-[11px]">
                      <div><span className="font-semibold text-slate-700">DOB:</span> {formatDateDDMMYYYY(partnerDob || selectedExistingPatient?.partnerDob)} {partnerAge || selectedExistingPatient?.partnerAge ? `(Age: ${partnerAge || selectedExistingPatient?.partnerAge})` : ''}</div>
                      <div><span className="font-semibold text-slate-700">Phone:</span> {partnerPhone || selectedExistingPatient?.partnerPhone || 'N/A'}</div>
                      {(partnerEmail || selectedExistingPatient?.partnerEmail) && <div><span className="font-semibold text-slate-700">Email:</span> {partnerEmail || selectedExistingPatient?.partnerEmail}</div>}
                    </div>
                  </div> */}
                </div>
              </div>
            </div>

            {/* Clinical & Physician Information */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                <span>2. Clinical & Physician Information</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Attending Physician:</span>
                  <strong className="text-emerald-900 font-bold text-sm">{doctorName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Date of Egg Retrieval:</span>
                  <strong className="text-slate-900 font-bold">{formatDateDDMMYYYY(aspirationDate)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-semibold block">Embryo Stage:</span>
                  <strong className="text-blue-900 font-bold bg-blue-100 px-2 py-0.5 rounded border border-blue-300 text-[11px]">{embryoStage || 'Day 5'}</strong>
                </div>
              </div>

              {comments && (
                <div className="pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Doctor Remarks & Instructions:</span>
                  <p className="text-slate-700 italic font-medium">"{comments}"</p>
                </div>
              )}
            </div>

            {/* Cryo Storage Destination */}
            {assignStorageEnabled && (
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
                <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider flex items-center justify-between">
                  <span>3. Cryo Storage Physical Destination</span>
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                    Freezing Date: {formatDateDDMMYYYY(freezingDate)}
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-emerald-950 bg-white p-3 rounded-xl border border-emerald-300 flex items-center justify-between">
                  <span>{selectedLocationCode ? parseLocationCode(selectedLocationCode).formatted : 'Auto-Allocating Best Storage Slot'}</span>
                </div>
              </div>
            )}

            {/* Granular Specimen Details Table */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between flex-wrap gap-2">
                <span>4. {specimenType === 'OOCYTE' ? 'Oocyte' : 'Embryo'} Details</span>
                <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 font-bold">
                  {getBatchSummaryText(strawItems, specimenType)}
                </span>
              </div>

              <div className="space-y-2.5">
                {strawItems.map((item, sIdx) => {
                  const existingOffset = selectedExistingPatient?.batches?.reduce(
                    (acc: number, b: any) => acc + (b.straws ? b.straws.filter((s: any) => s.status === 'OCCUPIED').length : 0),
                    0
                  ) || 0;
                  const strawDisplayNum = existingOffset + sIdx + 1;
                  const badgeClass = getStrawColorBadgeClass(item.color);
                  const count = item.embryoCount || 1;
                  const stageSummary = getStrawStageSummary(item, specimenType);

                  return (
                    <div key={sIdx} className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between font-bold flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-lg font-mono font-bold text-xs">
                            Straw #{strawDisplayNum}
                          </span>
                          <span className="text-slate-800 font-bold text-xs font-mono bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {count} {specimenType === 'OOCYTE' ? (count === 1 ? 'Oocyte' : 'Oocytes') : (count === 1 ? 'Embryo' : 'Embryos')} ({stageSummary})
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] border ${badgeClass}`}>{item.color}</span>
                        </div>
                        {item.isPgt && specimenType !== 'OOCYTE' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-900 border border-purple-300 font-bold">
                            PGT TESTED
                          </span>
                        )}
                      </div>

                      {/* Per-Item Details */}
                      <div className="space-y-1 text-xs font-medium">
                        {Array.from({ length: count }).map((_, eIdx) => {
                          const eGradeKey = `grade${eIdx + 1}`;
                          const eFragKey = `frag${eIdx + 1}`;
                          const eCommentKey = `comment${eIdx + 1}`;
                          const eGrade = ((item as any)[eGradeKey] || (eIdx === 0 ? item.grade : '') || (specimenType === 'OOCYTE' ? 'MII' : '')).trim().toUpperCase();
                          const eFrag = ((item as any)[eFragKey] || '').trim();
                          const eComment = ((item as any)[eCommentKey] || (eIdx === 0 ? item.comments : '') || '').trim();

                          const gradeStr = eGrade ? eGrade : 'N/A';
                          const fragStr = (eFrag === '+' || eFrag === '++') ? ` (Fragmentation: ${eFrag})` : '';
                          const commentStr = eComment ? ` - (${eComment})` : '';
                          const itemTypeLabel = specimenType === 'OOCYTE' ? 'Oocyte' : 'Embryo';
                          const stageTypeLabel = specimenType === 'OOCYTE' ? 'Stage' : 'Grade';

                          return (
                            <div key={eIdx} className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-900">
                                {(() => {
                                  const prevCount = strawItems.slice(0, sIdx).reduce((sum, s) => sum + (s.embryoCount || 1), 0);
                                  const globalIdx = prevCount + eIdx + 1;
                                  const totalCount = strawItems.reduce((sum, s) => sum + (s.embryoCount || 1), 0);
                                  return totalCount > 1 ? `${itemTypeLabel} #${globalIdx} ${stageTypeLabel}: ` : `${itemTypeLabel} ${stageTypeLabel}: `;
                                })()}{gradeStr}{fragStr}{commentStr}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmationModal(false)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer"
              >
                Go Back & Edit
              </button>
              <button
                type="button"
                onClick={executeFormSubmit}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                <Check className="w-4 h-4 text-white" />
                <span>Confirm & Save Patient Record</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
