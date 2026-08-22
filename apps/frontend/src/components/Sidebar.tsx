import React from 'react';
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
} from 'lucide-react';

export type NavTab = 'dashboard' | 'new-patient' | 'patients' | 'container-view' | 'ocr' | 'thaw' | 'logs';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user: any;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, user, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'new-patient', label: 'New Patient', icon: UserPlus },
    { id: 'patients', label: 'Patient Directory', icon: Search },
    { id: 'container-view', label: 'Full Container View', icon: Layers },
    { id: 'ocr', label: 'OCR Verification', icon: FileScan },
    { id: 'thaw', label: 'Thaw / Withdrawal', icon: ThermometerSnowflake },
    { id: 'logs', label: 'Audit Logs', icon: ClipboardList },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-screen sticky top-0 shadow-sm z-20">
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
  );
};
