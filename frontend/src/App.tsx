import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './views/DashboardView';
import { HostsView } from './views/HostsView';
import { HostDetailsView } from './views/HostDetailsView';
import { SettingsView } from './views/SettingsView';
import { ServiceDetailsView } from './views/ServiceDetailsView';
import { LoginView } from './views/LoginView';
import { TwoFactorSetupView } from './views/TwoFactorSetupView';
import { api } from './api/client';
import type { AuthUser } from './types';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
});

interface SelectedService {
  guid: string;
  host: string;
  service: string;
}

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [needs2faSetup, setNeeds2faSetup] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'hosts' | 'settings'>('dashboard');
  const [selectedService, setSelectedService] = useState<SelectedService | null>(null);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);

  // Check auth state on boot
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api.getAuthStatus();
        if (res.needsInstall) {
          setNeedsInstall(true);
          setCurrentUser(null);
        } else if (res.success && res.user && res.authenticated) {
          setCurrentUser(res.user);
          setNeedsInstall(false);
        } else {
          setCurrentUser(null);
          setNeedsInstall(false);
        }
      } catch (e) {
        setCurrentUser(null);
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();

    // Handle global 401 events
    const handleUnauthorized = () => {
      setCurrentUser(null);
      setSelectedService(null);
      setSelectedHost(null);
    };

    window.addEventListener('warlock:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('warlock:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setSelectedService(null);
    setSelectedHost(null);
  };

  const handleSelectService = (guid: string, host: string, service: string) => {
    setSelectedService({ guid, host, service });
    setSelectedHost(null);
  };

  const handleSelectHost = (hostIp: string) => {
    setSelectedHost(hostIp);
    setSelectedService(null);
  };

  const handleBackToDashboard = () => {
    setSelectedService(null);
    setCurrentTab('dashboard');
  };

  // If still verifying auth state, show loading spinner
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-slate-400 font-mono text-xs gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        <span>Initializing Warlock session...</span>
      </div>
    );
  }

  // If 2FA setup is required
  if (needs2faSetup) {
    return (
      <TwoFactorSetupView
        onSetupComplete={() => {
          setNeeds2faSetup(false);
          // Re-fetch auth status
          api.getAuthStatus().then((res) => {
            if (res.success && res.user) setCurrentUser(res.user);
          });
        }}
      />
    );
  }

  // If unauthenticated or initial setup required, render LoginView
  if (!currentUser) {
    return (
      <LoginView
        isInitialInstall={needsInstall}
        onLoginSuccess={(user) => {
          setNeedsInstall(false);
          setCurrentUser(user);
        }}
        onRequire2faSetup={() => {
          setNeedsInstall(false);
          setNeeds2faSetup(true);
        }}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setSelectedService(null);
          setSelectedHost(null);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
      >
        {selectedService ? (
          <ServiceDetailsView
            guid={selectedService.guid}
            host={selectedService.host}
            service={selectedService.service}
            onBack={handleBackToDashboard}
          />
        ) : selectedHost && currentTab === 'hosts' ? (
          <HostDetailsView
            host={selectedHost}
            onBack={() => setSelectedHost(null)}
          />
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView onSelectService={handleSelectService} />
            )}
            {currentTab === 'hosts' && <HostsView onSelectHost={handleSelectHost} />}
            {currentTab === 'settings' && <SettingsView />}
          </>
        )}
      </AppShell>
    </QueryClientProvider>
  );
}

export default App;
