import React, { useState, useEffect } from 'react';
import { AccessGate } from './components/AccessGate';
import { LoginForm } from './components/LoginForm';
import { Sidebar, NavTab } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { PatientForm } from './components/PatientForm';
import { PatientDirectory } from './components/PatientDirectory';
import { ContainerView } from './components/ContainerView';
import { OcrVerification } from './components/OcrVerification';
import { ThawWorkflow } from './components/ThawWorkflow';
import { AuditLogs } from './components/AuditLogs';
import { apiRequest } from './api/client';

export const AppContent: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await apiRequest('/api/auth/me');
      if (res.success && res.user) {
        setUser(res.user);
      }
    } catch {
      localStorage.removeItem('access_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('access_token');
      setUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-emerald-600">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
          <span className="text-sm font-medium">Initializing IVF Clinic System...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto min-h-screen pb-16">
        {activeTab === 'dashboard' && <Dashboard onNavigate={(t) => setActiveTab(t)} />}
        {activeTab === 'new-patient' && <PatientForm onSuccess={() => setActiveTab('patients')} />}
        {activeTab === 'patients' && <PatientDirectory />}
        {activeTab === 'container-view' && <ContainerView />}
        {activeTab === 'ocr' && <OcrVerification />}
        {activeTab === 'thaw' && <ThawWorkflow />}
        {activeTab === 'logs' && <AuditLogs />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AccessGate>
      <AppContent />
    </AccessGate>
  );
}
