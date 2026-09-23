export type MainTab = 'dashboard' | 'hosts' | 'settings';

export type ServiceSubTab =
  | 'overview'
  | 'terminal'
  | 'configs'
  | 'files'
  | 'backups'
  | 'mods'
  | 'settings';

export type HostSubTab = 'overview' | 'firewall' | 'cron' | 'files';

export interface RouteState {
  tab: MainTab;
  isInstallModalOpen?: boolean;
  isAddHostModalOpen?: boolean;
  service?: {
    guid: string;
    host: string;
    service: string;
    subTab: ServiceSubTab;
  } | null;
  host?: {
    host: string;
    subTab: HostSubTab;
  } | null;
}

const VALID_SERVICE_SUBTABS: readonly ServiceSubTab[] = [
  'overview',
  'terminal',
  'configs',
  'files',
  'backups',
  'mods',
  'settings',
];

const VALID_HOST_SUBTABS: readonly HostSubTab[] = [
  'overview',
  'firewall',
  'cron',
  'files',
];

/**
 * Parses a raw URL hash string (e.g. window.location.hash) into a structured RouteState.
 */
export function parseHash(rawHash: string): RouteState {
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  const clean = hash.replace(/^\/+|\/+$/g, '');

  if (!clean) {
    return { tab: 'dashboard' };
  }

  const parts = clean.split('/').map(decodeURIComponent);
  const root = parts[0];

  if (root === 'hosts') {
    if (parts[1] === 'add') {
      return { tab: 'hosts', isAddHostModalOpen: true };
    }
    if (parts[1]) {
      const subTabCandidate = parts[2] as HostSubTab;
      const subTab = VALID_HOST_SUBTABS.includes(subTabCandidate) ? subTabCandidate : 'overview';
      return {
        tab: 'hosts',
        host: {
          host: parts[1],
          subTab,
        },
      };
    }
    return { tab: 'hosts' };
  }

  if (root === 'settings') {
    return { tab: 'settings' };
  }

  // Dashboard (default)
  if (root === 'dashboard') {
    if (parts[1] === 'install') {
      return { tab: 'dashboard', isInstallModalOpen: true };
    }
    if (parts[1] === 'service' && parts[2] && parts[3] && parts[4]) {
      const subTabCandidate = parts[5] as ServiceSubTab;
      const subTab = VALID_SERVICE_SUBTABS.includes(subTabCandidate) ? subTabCandidate : 'overview';
      return {
        tab: 'dashboard',
        service: {
          guid: parts[2],
          host: parts[3],
          service: parts[4],
          subTab,
        },
      };
    }
    return { tab: 'dashboard' };
  }

  return { tab: 'dashboard' };
}

/**
 * Formats a RouteState into a canonical URL hash string.
 */
export function formatHash(state: RouteState): string {
  if (state.tab === 'hosts') {
    if (state.isAddHostModalOpen) {
      return '#hosts/add';
    }
    if (state.host) {
      const h = encodeURIComponent(state.host.host);
      const sub =
        state.host.subTab && state.host.subTab !== 'overview'
          ? `/${encodeURIComponent(state.host.subTab)}`
          : '';
      return `#hosts/${h}${sub}`;
    }
    return '#hosts';
  }

  if (state.tab === 'settings') {
    return '#settings';
  }

  // Dashboard
  if (state.isInstallModalOpen) {
    return '#dashboard/install';
  }
  if (state.service) {
    const g = encodeURIComponent(state.service.guid);
    const h = encodeURIComponent(state.service.host);
    const s = encodeURIComponent(state.service.service);
    const sub =
      state.service.subTab && state.service.subTab !== 'overview'
        ? `/${encodeURIComponent(state.service.subTab)}`
        : '';
    return `#dashboard/service/${g}/${h}/${s}${sub}`;
  }

  return '#dashboard';
}
