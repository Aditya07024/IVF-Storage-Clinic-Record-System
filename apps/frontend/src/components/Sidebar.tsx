import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  UserPlus,
  Search,
  Layers,
  FileScan,
  ThermometerSnowflake,
  ClipboardList,
  LogOut,
  Dna,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'new-patient' | 'patients' | 'container-view' | 'ocr' | 'thaw' | 'logs' | 'admin';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user: any;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, user, onLogout }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-patient', label: 'New Patient', icon: UserPlus },
    { id: 'patients', label: 'Patient Directory', icon: Search },
    { id: 'container-view', label: 'Full Container View', icon: Layers },
    { id: 'ocr', label: 'OCR Verification', icon: FileScan },
    { id: 'thaw', label: 'Thaw', icon: ThermometerSnowflake },
    { id: 'logs', label: 'Audit Logs', icon: ClipboardList },
    ...(user?.role === 'ADMIN' ? [{ id: 'admin', label: 'Admin Credentials', icon: ShieldCheck }] : []),
  ];

  // Open mobile menu & start 5 second auto-dismiss timer
  const openMobileMenu = () => {
    setIsMobileOpen(true);
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    autoCloseTimerRef.current = setTimeout(() => {
      setIsMobileOpen(false);
    }, 5000);
  };

  // Close mobile menu & clear timer
  const closeMobileMenu = () => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    setIsMobileOpen(false);
  };

  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, []);

  const handleTabClick = (tabId: NavTab) => {
    setActiveTab(tabId);
    closeMobileMenu();
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* MOBILE TOP HEADER BAR (Shown on screens < lg) */}
      {/* ========================================================================= */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
            <Dna className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-tight">IVF Storage</h1>
            <p className="text-[10px] text-emerald-700 font-semibold">Clinic System</p>
          </div>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={isMobileOpen ? closeMobileMenu : openMobileMenu}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl border border-slate-300 transition-all"
          aria-label="Toggle Mobile Navigation"
        >
          {isMobileOpen ? <X className="w-6 h-6 text-rose-600" /> : <Menu className="w-6 h-6 text-emerald-700" />}
        </button>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE POPUP MENU DRAWER WITH 5-SECOND AUTO DISMISS TIMER */}
      {/* ========================================================================= */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex flex-col justify-start p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Mobile Popup Header with 5s Auto-Close Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dna className="w-5 h-5 text-emerald-200" />
                <span className="font-bold text-sm">Navigation Menu</span>
              </div>

              <div className="flex items-center gap-2">
                {/* <span className="text-[10px] font-mono bg-emerald-800/80 px-2 py-0.5 rounded text-emerald-100 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-300 animate-spin" />
                  <span>Auto-close in 5s</span>
                </span> */}
                <button
                  onClick={closeMobileMenu}
                  className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mobile Nav Links */}
            <nav className="p-4 space-y-2 overflow-y-auto flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id as NavTab)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-950 border border-emerald-300 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-700' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Mobile User Profile & Logout */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">{user?.name || user?.staffId}</div>
                <div className="text-[10px] text-emerald-700 font-mono font-bold">ID: {user?.staffId}</div>
              </div>
              <button
                onClick={() => {
                  closeMobileMenu();
                  onLogout();
                }}
                className="px-3.5 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl border border-rose-300 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-700" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR (Shown on screens >= lg) */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col justify-between h-screen sticky top-0 shadow-sm z-20 shrink-0">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <Dna className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 tracking-wide text-base leading-tight">IVF Storage</h1>
              <p className="text-[11px] text-emerald-700 font-semibold">Clinic Record System</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as NavTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 border border-emerald-200/80 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Staff Profile & Logout */}
        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-3">
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-900 truncate">{user?.name || user?.staffId}</div>
              <div className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 font-semibold">
                <span>{user?.role || 'STAFF'}</span> • <span>ID: {user?.staffId}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 py-2.5 rounded-xl border border-rose-200 text-xs font-semibold transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
