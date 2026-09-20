import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, CheckCircle2, AlertCircle, X } from 'lucide-react';

export const PdfLoadingModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('Initializing document engine...');
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: any = null;
    let startTime = 0;
    const TOTAL_DURATION = 10000; // 10 seconds duration as requested

    const handleStart = () => {
      setIsOpen(true);
      setProgress(0);
      setIsReady(false);
      setErrorMessage(null);
      setStageText('Connecting to secure document server...');
      startTime = Date.now();

      intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const currentProgress = Math.min(100, Math.floor((elapsed / TOTAL_DURATION) * 100));
        setProgress(currentProgress);

        if (currentProgress < 25) {
          setStageText('Fetching cryo storage records & patient details...');
        } else if (currentProgress < 50) {
          setStageText('Formatting straw batch numbers & Viso tube colors...');
        } else if (currentProgress < 75) {
          setStageText('Rendering QR barcodes & verification signatures...');
        } else if (currentProgress < 100) {
          setStageText('Finalizing vector PDF document layout...');
        } else {
          setStageText('PDF Ready! Opening report viewer tab...');
          setIsReady(true);
          clearInterval(intervalId);
        }
      }, 50);
    };

    const handleComplete = () => {
      // Force completion to 100%
      setProgress(100);
      setStageText('PDF Ready! Opening report viewer tab...');
      setIsReady(true);
      if (intervalId) clearInterval(intervalId);

      // Auto close modal after brief 500ms delay to show 100% success
      setTimeout(() => {
        setIsOpen(false);
      }, 800);
    };

    const handleError = (e: CustomEvent<{ message: string }>) => {
      if (intervalId) clearInterval(intervalId);
      setErrorMessage(e.detail?.message || 'Failed to generate PDF report.');
    };

    window.addEventListener('pdf-loading-start' as any, handleStart);
    window.addEventListener('pdf-loading-complete' as any, handleComplete);
    window.addEventListener('pdf-loading-error' as any, handleError);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('pdf-loading-start' as any, handleStart);
      window.removeEventListener('pdf-loading-complete' as any, handleComplete);
      window.removeEventListener('pdf-loading-error' as any, handleError);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 relative text-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon & Glow */}
        <div className="relative inline-block mx-auto mt-2">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 animate-pulse">
            <FileText className="w-10 h-10" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white text-slate-900 shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Header */}
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Generating Cryo Specimen PDF
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            10-Second High-Precision Document Renderer
          </p>
        </div>

        {errorMessage ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-bold text-left">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Progress Bar Container */}
            <div className="w-full bg-slate-100 rounded-full h-4 p-0.5 overflow-hidden border border-slate-200 shadow-inner relative">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-full transition-all duration-75 ease-out flex items-center justify-end pr-1 relative overflow-hidden"
                style={{ width: `${progress}%` }}
              >
                {/* Animated shimmer overlay */}
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>

            {/* Percentage & Live Stage Indicator */}
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600 flex items-center gap-1.5 font-mono">
                {isReady ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3 h-3 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin shrink-0" />
                )}
                <span>{stageText}</span>
              </span>
              <span className="text-emerald-700 font-extrabold font-mono text-sm bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                {progress}%
              </span>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 font-medium">
            IVF Clinic Security Protocol &bull; PDF opens automatically in a new tab upon completion.
          </p>
        </div>
      </div>
    </div>
  );
};
