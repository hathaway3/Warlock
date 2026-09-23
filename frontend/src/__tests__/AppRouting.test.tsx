import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from '../App';
import { api } from '../api/client';

vi.mock('../components/terminal/XtermTerminal', () => ({
  XtermTerminal: () => <div data-testid="xterm-mock">Console Stream</div>,
}));

describe('App Hash Routing & Deep Linking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.location.hash = '';

    vi.spyOn(api, 'getAuthStatus').mockResolvedValue({
      success: true,
      authenticated: true,
      user: { id: 1, username: 'admin', has_2fa: true },
    });

    vi.spyOn(api, 'getServices').mockResolvedValue([]);
    vi.spyOn(api, 'getTokens').mockResolvedValue([]);
    vi.spyOn(api, 'getHosts').mockResolvedValue([
      { id: 1, ip: '192.168.1.100', os: 'Debian 12' },
    ]);
    vi.spyOn(api, 'getApplications').mockResolvedValue([
      { guid: 'app-palworld', title: 'Palworld' } as any,
    ]);
    vi.spyOn(api, 'getHostSshKey').mockResolvedValue({
      success: true,
      sshKey: 'ssh-ed25519 AAAAC3...',
    });
    vi.spyOn(api, 'getEnrollmentToken').mockResolvedValue({
      success: true,
      token: 'test-token',
      command: 'curl -sSL ... | sudo bash',
      expiresIn: 1800,
    });
    vi.spyOn(api, 'getFirewall').mockResolvedValue({
      success: true,
      status: 'active',
      rules: [],
    });
    vi.spyOn(api, 'getCronJobs').mockResolvedValue({
      success: true,
      jobs: [],
    });
    vi.spyOn(api, 'getHostMetrics').mockResolvedValue({
      cpu: 10,
      memory: 20,
    } as any);
  });

  it('defaults to dashboard and sets canonical hash #dashboard', async () => {
    render(<App />);

    expect(await screen.findByText('Total Services')).toBeDefined();
    expect(window.location.hash).toBe('#dashboard');
  });

  it('renders HostsView directly when initial hash is #hosts', async () => {
    window.location.hash = '#hosts';
    render(<App />);

    expect(await screen.findByText('Server Hosts')).toBeDefined();
    expect(await screen.findByText('192.168.1.100')).toBeDefined();
  });

  it('renders SettingsView when initial hash is #settings', async () => {
    window.location.hash = '#settings';
    render(<App />);

    expect(await screen.findByText(/Settings & Integrations/i)).toBeDefined();
    expect(await screen.findByText(/API Authentication Tokens/i)).toBeDefined();
  });

  it('opens game install modal when hash is #dashboard/install', async () => {
    window.location.hash = '#dashboard/install';
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Install Game Server/i })).toBeDefined();
    expect(screen.getByText(/Deploy a dedicated game application/i)).toBeDefined();
  });

  it('opens Add Host modal when hash is #hosts/add', async () => {
    window.location.hash = '#hosts/add';
    render(<App />);

    expect(await screen.findByRole('heading', { name: /Add Server Host/i })).toBeDefined();
    expect(await screen.findByText(/Automated One-Line Enrollment/i)).toBeDefined();
  });

  it('deep links into ServiceDetailsView on specified subTab', async () => {
    vi.spyOn(api, 'getServiceDetails').mockResolvedValue({
      success: true,
      service: {
        guid: 'g1',
        host: 'h1',
        service: 's1',
        name: 'My Palworld Server',
        status: 'running',
        os: 'linux',
      } as any,
      host: {},
    });

    window.location.hash = '#dashboard/service/g1/h1/s1/terminal';
    render(<App />);

    expect(await screen.findByText(/My Palworld Server/i)).toBeDefined();
    expect(screen.getByText('Console & Logs')).toBeDefined();
    expect(screen.getByTestId('xterm-mock')).toBeDefined();
  });

  it('deep links into HostDetailsView on firewall subTab', async () => {
    window.location.hash = '#hosts/192.168.1.100/firewall';
    render(<App />);

    expect(await screen.findByText('192.168.1.100')).toBeDefined();
    expect(await screen.findByText('Firewall (UFW)')).toBeDefined();
    expect(await screen.findByText(/Add Rule/i)).toBeDefined();
  });

  it('updates route and view when browser hashchange event fires', async () => {
    render(<App />);

    // Initially dashboard
    expect(await screen.findByText('Total Services')).toBeDefined();

    // Simulate browser Back/Forward or user changing hash
    act(() => {
      window.location.hash = '#hosts';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(await screen.findByText('Server Hosts')).toBeDefined();
    expect(await screen.findByText('192.168.1.100')).toBeDefined();
  });
});
