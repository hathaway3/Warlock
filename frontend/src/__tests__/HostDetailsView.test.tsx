import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HostDetailsView } from '../views/HostDetailsView';
import { api } from '../api/client';
import type { HostData } from '../types';

describe('HostDetailsView Component', () => {
  let queryClient: QueryClient;

  const mockHost: HostData = {
    id: 1,
    ip: '192.168.1.100',
    os: 'Debian 12 Bookworm',
    status: 'online',
    cpu_load: 15,
    memory_used: 4 * 1024 * 1024 * 1024,
    memory_total: 16 * 1024 * 1024 * 1024,
    disk_used: 50 * 1024 * 1024 * 1024,
    disk_total: 200 * 1024 * 1024 * 1024,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();

    // Default mock responses
    vi.spyOn(api, 'getHosts').mockResolvedValue([mockHost]);
    vi.spyOn(api, 'getHostMetrics').mockResolvedValue({
      success: true,
      data: [{ timestamp: Date.now(), avg_cpu: 15, avg_memory: 25, avg_disk: 40 }],
    });
    vi.spyOn(api, 'getFirewall').mockResolvedValue({
      success: true,
      status: 'active',
      rules: [
        { id: 1, to: '8211', action: 'ALLOW', from: 'Anywhere', comment: 'Palworld port' },
      ],
    });
    vi.spyOn(api, 'getCronJobs').mockResolvedValue({
      success: true,
      jobs: [
        { identifier: 'backup-task', schedule: '0 4 * * *', command: '/usr/local/bin/backup.sh' },
      ],
    });
  });

  const renderWithClient = (onBack = vi.fn()) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <HostDetailsView host="192.168.1.100" onBack={onBack} />
      </QueryClientProvider>
    );
  };

  it('renders host overview with hardware metrics and allows going back', async () => {
    const onBack = vi.fn();
    renderWithClient(onBack);

    expect(await screen.findByText('192.168.1.100')).toBeDefined();
    expect(screen.getByText('Linux Server Cluster Host')).toBeDefined();

    // Click back button
    const backBtn = screen.getByTitle('Back to Hosts');
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('switches to Firewall tab and displays active rules', async () => {
    renderWithClient();

    expect(await screen.findByText('192.168.1.100')).toBeDefined();

    // Click Firewall tab
    const firewallTabBtn = screen.getByRole('button', { name: /Firewall \(UFW\)/i });
    fireEvent.click(firewallTabBtn);

    // Verify firewall status and rules
    expect(await screen.findByText('8211')).toBeDefined();
    expect(screen.getByText('Palworld port')).toBeDefined();
  });

  it('switches to Cron tab and displays scheduled jobs', async () => {
    renderWithClient();

    expect(await screen.findByText('192.168.1.100')).toBeDefined();

    // Click Cron tab
    const cronTabBtn = screen.getByRole('button', { name: /Cron Tasks/i });
    fireEvent.click(cronTabBtn);

    // Verify scheduled task is displayed
    expect(await screen.findByText('0 4 * * *')).toBeDefined();
    expect(screen.getByText('/usr/local/bin/backup.sh')).toBeDefined();
    expect(screen.getByText('backup-task')).toBeDefined();
  });

  it('switches to Files tab and embeds filesystem manager', async () => {
    vi.spyOn(api, 'getFiles').mockResolvedValue({ success: true, files: [], path: '/' });

    renderWithClient();

    expect(await screen.findByText('192.168.1.100')).toBeDefined();

    // Click Files tab
    const filesTabBtn = screen.getByRole('button', { name: /Filesystem/i });
    fireEvent.click(filesTabBtn);

    // Verify file manager is mounted for host
    expect(await screen.findByTitle('Go up one folder')).toBeDefined();
  });
});
