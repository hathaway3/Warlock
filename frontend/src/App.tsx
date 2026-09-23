import { useState, useEffect, useCallback } from 'react';
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
import {
  parseHash,
  formatHash,
  type RouteState,
  type MainTab,
  type ServiceSubTab,
  type HostSubTab,
} from './router/hashRouter';
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

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [needs2faSetup, setNeeds2faSetup] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [routeState, setRouteState] = useState<RouteState>(() => parseHash(window.location.hash));

  const navigateTo = useCallback((nextRoute: RouteState) => {
    setRouteState(nextRoute);
    const targetHash = formatHash(nextRoute);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, []);

  // Listen to browser forward/back hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseHash(window.location.hash);
      setRouteState(parsed);
    };

    // Initialize canonical hash if empty
    if (!window.location.hash || window.location.hash === '#') {
      window.location.hash = formatHash(routeState);
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();

    // Handle global 401 events
    const handleUnauthorized = () => {
      setCurrentUser(null);
      navigateTo({ tab: 'dashboard' });
    };

    window.addEventListener('warlock:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('warlock:unauthorized', handleUnauthorized);
  }, [navigateTo]);

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    navigateTo({ tab: 'dashboard' });
  };

  const handleTabChange = (tab: MainTab) => {
    navigateTo({ tab });
  };

  const handleSelectService = (guid: string, host: string, service: string) => {
    navigateTo({
      tab: 'dashboard',
      service: { guid, host, service, subTab: 'overview' },
    });
  };

  const handleServiceTabChange = (subTab: ServiceSubTab) => {
    if (!routeState.service) return;
    navigateTo({
      tab: 'dashboard',
      service: { ...routeState.service, subTab },
    });
  };

  const handleBackToDashboard = () => {
    navigateTo({ tab: 'dashboard' });
  };

  const handleSelectHost = (hostIp: string) => {
    navigateTo({
      tab: 'hosts',
      host: { host: hostIp, subTab: 'overview' },
    });
  };

  const handleHostTabChange = (subTab: HostSubTab) => {
    if (!routeState.host) return;
    navigateTo({
      tab: 'hosts',
      host: { ...routeState.host, subTab },
    });
  };

  const handleBackToHosts = () => {
    navigateTo({ tab: 'hosts' });
  };

  const handleOpenInstallModal = () => {
    navigateTo({ tab: 'dashboard', isInstallModalOpen: true });
  };

  const handleCloseInstallModal = () => {
    navigateTo({ tab: 'dashboard' });
  };

  const handleOpenAddHostModal = () => {
    navigateTo({ tab: 'hosts', isAddHostModalOpen: true });
  };

  const handleCloseAddHostModal = () => {
    navigateTo({ tab: 'hosts' });
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
        currentTab={routeState.tab}
        onTabChange={handleTabChange}
        currentUser={currentUser}
        onLogout={handleLogout}
      >
        {routeState.service && routeState.tab === 'dashboard' ? (
          <ServiceDetailsView
            guid={routeState.service.guid}
            host={routeState.service.host}
            service={routeState.service.service}
            initialTab={routeState.service.subTab}
            onTabChange={handleServiceTabChange}
            onBack={handleBackToDashboard}
          />
        ) : routeState.host && routeState.tab === 'hosts' ? (
          <HostDetailsView
            host={routeState.host.host}
            initialTab={routeState.host.subTab}
            onTabChange={handleHostTabChange}
            onBack={handleBackToHosts}
          />
        ) : (
          <>
            {routeState.tab === 'dashboard' && (
              <DashboardView
                onSelectService={handleSelectService}
                isInstallModalOpen={routeState.isInstallModalOpen}
                onOpenInstallModal={handleOpenInstallModal}
                onCloseInstallModal={handleCloseInstallModal}
              />
            )}
            {routeState.tab === 'hosts' && (
              <HostsView
                onSelectHost={handleSelectHost}
                isAddModalOpen={routeState.isAddHostModalOpen}
                onOpenAddModal={handleOpenAddHostModal}
                onCloseAddModal={handleCloseAddHostModal}
              />
            )}
            {routeState.tab === 'settings' && <SettingsView />}
          </>
        )}
      </AppShell>
    </QueryClientProvider>
  );
}

export default App;
