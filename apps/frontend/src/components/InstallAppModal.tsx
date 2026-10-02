import React, { useEffect, useState } from 'react';
import { X, Smartphone, Monitor, Share, Download, CheckCircle2 } from 'lucide-react';
import brandLogo from '../assets/image.png';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check global window deferred prompt if already captured
    if ((window as any).deferredInstallPrompt) {
      setDeferredPrompt((window as any).deferredInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };

    const handlePwaPromptAvailable = () => {
      if ((window as any).deferredInstallPrompt) {
        setDeferredPrompt((window as any).deferredInstallPrompt);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handlePwaPromptAvailable);

    // Detect Device Type
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setDeviceType('ios');
    } else if (/Android/i.test(ua)) {
      setDeviceType('android');
    } else {
      setDeviceType('desktop');
    }

    // Check if app is running in standalone mode (already installed)
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handlePwaPromptAvailable);
    };
  }, []);

  // When modal opens, auto trigger browser native install popup if available
  useEffect(() => {
    if (isOpen && !installed) {
      const activePrompt = deferredPrompt || (window as any).deferredInstallPrompt;
      if (activePrompt) {
        try {
          activePrompt.prompt();
          activePrompt.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === 'accepted') {
              setInstalled(true);
            }
            setDeferredPrompt(null);
            (window as any).deferredInstallPrompt = null;
          }).catch(() => {});
        } catch (e) {}
      }
    }
  }, [isOpen, installed, deferredPrompt]);

  const handleNativeInstall = async () => {
    const activePrompt = deferredPrompt || (window as any).deferredInstallPrompt;
    if (!activePrompt) return;
    try {
      activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
      }
      setDeferredPrompt(null);
      (window as any).deferredInstallPrompt = null;
    } catch (e) {}
  };

  if (!isOpen) return null;

  const activePrompt = deferredPrompt || (window as any).deferredInstallPrompt;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="p-6 pb-4 flex items-start justify-between gap-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img src={brandLogo} alt="App Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Install IVF Cryo App</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Faster storage access & instant home screen access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {installed ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="font-bold text-emerald-950 text-sm">App Already Installed!</div>
              <p className="text-xs text-emerald-800">
                You are currently using the installed version of SRGH IVF Cryo Bank App.
              </p>
            </div>
          ) : (
            <>
              {/* Apple iOS Instruction Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  deviceType === 'ios'
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/50 shadow-sm'
                    : 'bg-slate-50 border-slate-200 opacity-90'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Share className="w-4 h-4 text-amber-600" />
                    <span>For Apple devices</span>
                  </div>
                  {deviceType === 'ios' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                      YOUR DEVICE
                    </span>
                  )}
                </div>
                <ol className="text-xs text-slate-700 space-y-2 pl-1 leading-relaxed font-medium">
                  <li>
                    1. Tap the Share icon <span className="inline-block px-1.5 py-0.5 bg-slate-200 text-slate-900 rounded font-mono font-bold">⎋</span> (square with upward arrow) at the bottom toolbar.
                  </li>
                  <li>
                    2. Scroll down and select <strong className="text-amber-950 font-bold">Add to Home Screen (+)</strong>.
                  </li>
                  <li>
                    3. Tap <strong className="text-amber-950 font-bold">Add</strong> at top right to place icon on your home screen.
                  </li>
                </ol>
              </div>

              {/* Android Instruction Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  deviceType === 'android'
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/50 shadow-sm'
                    : 'bg-slate-50 border-slate-200 opacity-90'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Smartphone className="w-4 h-4 text-amber-600" />
                    <span>For Android devices</span>
                  </div>
                  {deviceType === 'android' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                      YOUR DEVICE
                    </span>
                  )}
                </div>
                <ol className="text-xs text-slate-700 space-y-2 pl-1 leading-relaxed font-medium">
                  <li>
                    1. Tap the 3-dots menu <strong className="text-slate-900 font-bold">(⋮)</strong> at the top right of browser.
                  </li>
                  <li>
                    2. Select <strong className="text-amber-950 font-bold">Install App</strong> or <strong className="text-amber-950 font-bold">Add to Home Screen</strong>.
                  </li>
                  <li>
                    3. Tap <strong className="text-amber-950 font-bold">Install</strong> to confirm.
                  </li>
                </ol>
              </div>

              {/* Desktop Browser Instruction Card */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  deviceType === 'desktop'
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/50 shadow-sm'
                    : 'bg-slate-50 border-slate-200 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Monitor className="w-4 h-4 text-amber-600" />
                    <span>For Desktop computers</span>
                  </div>
                  {deviceType === 'desktop' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                      YOUR DEVICE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  Look at the right side of your address bar and click the <strong className="text-amber-950 font-bold">Install App (⤓)</strong> icon, or select <strong className="text-amber-950 font-bold">Install IVF Cryo App</strong> from browser menu.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Action Button Section */}
        <div className="p-6 pt-3 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
          {activePrompt && !installed && (
            <button
              onClick={handleNativeInstall}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Install Now</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 text-center cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
