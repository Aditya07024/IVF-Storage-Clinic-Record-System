import React, { useState, useEffect } from 'react';
import { Printer, Mail, Send, X, CheckCircle2, AlertCircle, RefreshCw, FileText, Sparkles, ShieldCheck, History } from 'lucide-react';
import { apiRequest } from '../api/client';

interface ReportPrintMailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: {
    id: string;
    patientId: string;
    fullName: string;
    email?: string;
    partnerEmail?: string;
  } | null;
  onSuccess?: (msg: string) => void;
}

export const ReportPrintMailModal: React.FC<ReportPrintMailModalProps> = ({
  isOpen,
  onClose,
  patient,
  onSuccess,
}) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [reportType, setReportType] = useState<'AUTO' | 'OOCYTE' | 'DAY3' | 'DAY5' | 'GENERAL' | 'THAW'>('OOCYTE');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);

  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      apiRequest('/api/auth/me')
        .then((res) => {
          if (res.success && res.user) setCurrentUser(res.user);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const canPrintMail = !currentUser || currentUser.role === 'ADMIN' || currentUser.canPrintMail !== false;

  const fetchEmailLogs = async (patientId: string) => {
    setLoadingLogs(true);
    try {
      const res = await apiRequest(`/api/documents/email-logs/${patientId}`, { skipCache: true });
      if (res.success && res.logs) {
        setEmailLogs(res.logs);
      }
    } catch (err: any) {
      console.error('Failed to fetch email logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const getReportTypeName = (typeOrSubject: string) => {
    if (!typeOrSubject) return 'Day Report';
    const str = typeOrSubject.toUpperCase();
    if (str.includes('DAY 5') || str.includes('DAY 6') || str.includes('DAY5') || str.includes('DAY6') || str.includes('BLASTOCYST') || str.includes('DAY 5/6')) {
      return 'Day 5/6 Report';
    }
    if (str.includes('DAY 3') || str.includes('DAY3') || str.includes('CLEAVAGE')) {
      return 'Day 3 Report';
    }
    if (str.includes('OOCYTE') || str.includes('DAY 0') || str.includes('DAY0') || str.includes('EGG') || str.includes('MII')) {
      return 'Day 0 Report';
    }
    if (str.includes('THAW')) {
      return 'Thaw Report';
    }
    return 'Day Report';
  };

  useEffect(() => {
    if (patient) {
      setRecipientEmail(patient.email || patient.partnerEmail || '');
      setCustomMessage('');
      setEmailStatusMsg(null);
      setEmailErrorMsg(null);

      // Auto-detect report type according to embryo stage
      let autoType: 'OOCYTE' | 'DAY3' | 'DAY5' | 'GENERAL' = 'OOCYTE';
      if ((patient as any).batches && Array.isArray((patient as any).batches)) {
        for (const b of (patient as any).batches) {
          const stage = (b.embryoStage || '').toUpperCase();
          if (stage.includes('DAY 5') || stage.includes('DAY 6') || stage.includes('DAY5') || stage.includes('DAY6') || stage.includes('BLAST')) {
            autoType = 'DAY5';
            break;
          } else if (stage.includes('DAY 3') || stage.includes('DAY3') || stage.includes('DAY 2') || stage.includes('DAY2') || stage.includes('CLEAVAGE')) {
            autoType = 'DAY3';
            break;
          } else if (stage.includes('DAY 0') || stage.includes('DAY0') || stage.includes('OOCYTE') || stage.includes('EGG') || stage.includes('MII')) {
            autoType = 'OOCYTE';
          }
        }
      }
      setReportType(autoType);
      const initialReportName = getReportTypeName(autoType);
      setCustomSubject(`[${initialReportName}] Official IVF Specimen Storage Report - ${patient.fullName} (${patient.patientId})`);
      fetchEmailLogs(patient.id);
    }
  }, [patient]);

  if (!isOpen || !patient) return null;

  const handlePrintPdf = () => {
    const accessKey = localStorage.getItem('app_access_key') || 'clinic2026';
    const token = localStorage.getItem('accessToken') || '';
    const pdfUrl = `/api/documents/patient/${patient.id}/pdf?reportType=${reportType}&key=${encodeURIComponent(accessKey)}&token=${encodeURIComponent(token)}`;
    window.open(pdfUrl, '_blank');
  };

  const handleSendEmail = async () => {
    if (!recipientEmail || !recipientEmail.trim()) {
      setEmailErrorMsg('Please enter a recipient email address.');
      return;
    }

    setSendingEmail(true);
    setEmailStatusMsg(null);
    setEmailErrorMsg(null);

    try {
      const res = await apiRequest('/api/documents/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          recipientEmail: recipientEmail.trim(),
          reportType: reportType,
          customSubject: customSubject.trim() || undefined,
          customMessage: customMessage.trim() || undefined,
        }),
      });

      if (res.success) {
        const msg = res.message || `Report email sent to ${recipientEmail} from srghivfcryo@gmail.com!`;
        setEmailStatusMsg(msg);
        fetchEmailLogs(patient.id);
        if (onSuccess) onSuccess(msg);
      } else {
        setEmailErrorMsg(res.error || 'Failed to send email.');
        fetchEmailLogs(patient.id);
      }
    } catch (err: any) {
      setEmailErrorMsg(err.message || 'Error occurred while sending email.');
      fetchEmailLogs(patient.id);
    } finally {
      setSendingEmail(false);
    }
  };

  const handlePrintAndEmail = async () => {
    handlePrintPdf();
    await handleSendEmail();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs border border-emerald-200">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              Deliver Patient Cryo Report
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {patient.fullName} <span className="font-mono font-bold text-emerald-700">({patient.patientId})</span>
            </p>
          </div>
        </div>

        {/* Sender Info Badge */}
        <div className="flex items-center justify-between p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 font-bold">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Sender Gmail:</span>
          </div>
          <span className="font-mono bg-white px-2.5 py-0.5 rounded-lg border border-emerald-300 text-emerald-900 shadow-2xs">
            srghivfcryo@gmail.com
          </span>
        </div>

        {/* Status Messages */}
        {emailStatusMsg && (
          <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{emailStatusMsg}</span>
          </div>
        )}

        {emailErrorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-300 text-rose-950 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{emailErrorMsg}</span>
          </div>
        )}

        {/* Report Type Selector */}
        <div>
          <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between text-xs">
            <span>Select Report Format / Stage *</span>
            <span className="text-[10px] text-emerald-800 font-mono font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
              Sir Ganga Ram Hospital Format
            </span>
          </label>

          {(() => {
            const hasThawedEmbryos = Boolean(
              (patient as any)?.thawRecords?.length > 0 ||
              (patient as any)?.thawedCount > 0 ||
              (patient as any)?.batches?.some((b: any) =>
                b.straws?.some((s: any) => s.status === 'THAWED')
              )
            );

            return (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'OOCYTE', title: '🥚 Day 0 Report', desc: 'Egg / Oocyte Freezing Report' },
                  { id: 'DAY3', title: '🔬 Day 3 Report', desc: 'Cleavage Stage Freezing Report' },
                  { id: 'DAY5', title: '🧫 Day 5/6 Report', desc: 'Blastocyst Freezing Report' },
                  { id: 'THAW', title: '🧪 Thaw Report', desc: 'Thawing & Recovery Report' },
                ].map((item) => {
                  const isThawItem = item.id === 'THAW';
                  const isDisabled = isThawItem && !hasThawedEmbryos;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        const newType = item.id as any;
                        setReportType(newType);
                        const typeLabel = getReportTypeName(newType);
                        if (patient) {
                          setCustomSubject(`[${typeLabel}] Official IVF Specimen Storage Report - ${patient.fullName} (${patient.patientId})`);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isDisabled
                          ? 'bg-slate-100/90 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                          : reportType === item.id
                          ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs font-bold'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                      title={isDisabled ? 'No embryos have been thawed for this patient yet' : ''}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span className={isDisabled ? 'text-slate-400' : 'text-slate-900'}>{item.title}</span>
                        {isDisabled && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                            Disabled
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {isDisabled ? 'No embryos thawed yet' : item.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Form Controls for Email */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Recipient Email Address *
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="e.g. patient@example.com"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-mono font-bold focus:outline-none focus:border-emerald-500"
            />
            {patient.email || patient.partnerEmail ? (
              <div className="flex gap-2 mt-1.5">
                {patient.email && (
                  <button
                    type="button"
                    onClick={() => setRecipientEmail(patient.email!)}
                    className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 font-bold"
                  >
                    Patient: {patient.email}
                  </button>
                )}
                {patient.partnerEmail && (
                  <button
                    type="button"
                    onClick={() => setRecipientEmail(patient.partnerEmail!)}
                    className="text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 font-bold"
                  >
                    Partner: {patient.partnerEmail}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Email Subject
            </label>
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
              Optional Note / Message to Patient
            </label>
            <textarea
              rows={2}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="e.g. Attached is your official vitrification & storage summary report."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Restricted Access Warning Banner */}
        {!canPrintMail && (
          <div className="p-3 bg-rose-50 border border-rose-300 text-rose-950 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Access Restricted: Printing & Emailing reports requires permission from an Administrator.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-1 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handlePrintPdf}
            disabled={!canPrintMail}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs border border-slate-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            <span>Print PDF</span>
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            disabled={sendingEmail || !canPrintMail}
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:cursor-not-allowed"
          >
            {sendingEmail ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Email</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrintAndEmail}
            disabled={sendingEmail || !canPrintMail}
            className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            <span>Print & Email</span>
          </button>
        </div>

        {/* Email Delivery Audit History Log */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-emerald-700" />
              <span>Email Delivery Audit Log History ({emailLogs.length})</span>
            </h4>
            {loadingLogs && <span className="w-3 h-3 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />}
          </div>

          {emailLogs.length === 0 ? (
            <div className="text-[11px] text-slate-400 font-medium italic p-2 bg-slate-50 rounded-xl border border-slate-200">
              No email delivery attempts logged for this patient yet.
            </div>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
              {emailLogs.map((log) => {
                const reportName = getReportTypeName(log.subject);
                return (
                  <div key={log.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          log.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {log.status === 'DELIVERED' ? '✓ SENT & DELIVERED' : '✕ FAILED'}
                        </span>
                        <span className="font-mono text-slate-800 font-bold">{log.recipientEmail}</span>
                        <span className="text-[10px] font-bold font-mono text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 shadow-2xs">
                          📄 {reportName}
                        </span>
                      </div>
                      {log.errorMessage && (
                        <div className="text-[10px] text-rose-600 font-medium">{log.errorMessage}</div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {new Date(log.sentAt).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
