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
import { DeveloperSupport } from './components/DeveloperSupport';
import { DevSandbox } from './components/DevSandbox';
import { AdminPanel } from './components/AdminPanel';
import { PdfLoadingModal } from './components/PdfLoadingModal';
import { apiRequest, isDevelopmentMode } from './api/client';

export const AppContent: React.FC = () => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isDev = isDevelopmentMode();
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    return (sessionStorage.getItem('activeTab') as NavTab) || 'dashboard';
  });
  const [selectedCanCode, setSelectedCanCode] = useState<string>('CAN-01');
  const [selectedPatientIdForDirectory, setSelectedPatientIdForDirectory] = useState<string | null>(null);
  const [preselectedPatientForAddStraws, setPreselectedPatientForAddStraws] = useState<any | null>(null);
  const [ocrPrefillForAddStraws, setOcrPrefillForAddStraws] = useState<any | null>(null);

  const handleSetActiveTab = (tab: NavTab) => {
    sessionStorage.setItem('activeTab', tab);
    setActiveTab(tab);
  };

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const handleNavigateFromDashboard = (tab: NavTab, canCode?: string) => {
    if (canCode) {
      setSelectedCanCode(canCode);
    }
    handleSetActiveTab(tab);
  };

  const handleNavigateToPatientDirectory = (patientId?: string) => {
    if (patientId) {
      setSelectedPatientIdForDirectory(patientId);
    }
    handleSetActiveTab('patients');
  };

  const handleAddMoreStraws = (patient: any) => {
    setPreselectedPatientForAddStraws(patient);
    setOcrPrefillForAddStraws(null);
    handleSetActiveTab('new-patient');
  };

  const handleNavigateToExistingPatientForm = (patient: any, ocrPrefill?: any) => {
    setPreselectedPatientForAddStraws(patient);
    setOcrPrefillForAddStraws(ocrPrefill || null);
    handleSetActiveTab('new-patient');
  };

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
      localStorage.removeItem('refresh_token');
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
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-emerald-600">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin" />
          <span className="text-sm font-medium">Initializing IVF Clinic System...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginForm
        onLoginSuccess={(u) => {
          setUser(u);
          handleSetActiveTab('dashboard');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto min-h-screen pb-16">
        {activeTab === 'dashboard' && <Dashboard onNavigate={handleNavigateFromDashboard} />}
        {activeTab === 'new-patient' && (
          <PatientForm
            initialPatient={preselectedPatientForAddStraws}
            initialOcrPrefill={ocrPrefillForAddStraws}
            onSuccess={() => {
              setPreselectedPatientForAddStraws(null);
              setOcrPrefillForAddStraws(null);
            }}
          />
        )}
        {activeTab === 'patients' && (
          <PatientDirectory
            initialSelectedPatientId={selectedPatientIdForDirectory}
            onAddMoreStraws={handleAddMoreStraws}
          />
        )}
        {activeTab === 'container-view' && <ContainerView initialCanCode={selectedCanCode} />}
        {activeTab === 'ocr' && (
          <OcrVerification
            onNavigateToPatient={handleNavigateToPatientDirectory}
            onNavigateToExistingPatientForm={handleNavigateToExistingPatientForm}
          />
        )}
        {activeTab === 'thaw' && <ThawWorkflow />}
        {activeTab === 'logs' && <AuditLogs />}
        {activeTab === 'support' && <DeveloperSupport />}
        {activeTab === 'admin' && <AdminPanel />}
        {activeTab === 'dev-tools' && <DevSandbox />}
      </main>

      <PdfLoadingModal />
    </div>
  );
};

import { BackgroundTaskProvider } from './context/BackgroundTaskContext';

export default function App() {
  return (
    <BackgroundTaskProvider>
      <AccessGate>
        <AppContent />
      </AccessGate>
    </BackgroundTaskProvider>
  );
}
