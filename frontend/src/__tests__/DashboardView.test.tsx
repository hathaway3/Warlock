import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardView } from '../views/DashboardView';
import { api } from '../api/client';
import type { ServiceData, AppData, HostData } from '../types';

describe('DashboardView Component', () => {
  let queryClient: QueryClient;

  const mockServices: ServiceData[] = [
    {
      guid: 'app-palworld',
      host: '192.168.1.100',
      service: 'palworld-server',
      name: 'Palworld Dedicated Server',
      status: 'running',
      cpu_usage: '12.5%',
      memory_usage: '4.2 GB',
      player_count: 5,
      max_players: 32,
      port: 8211,
      enabled: true,
    },
    {
      guid: 'app-valheim',
      host: '192.168.1.100',
      service: 'valheim-server',
      name: 'Valheim Server',
      status: 'stopped',
      cpu_usage: 0,
      memory_usage: 0,
      player_count: 0,
      max_players: 10,
      port: 2456,
      enabled: false,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  const renderWithClient = (props: { onSelectService?: (g: string, h: string, s: string) => void } = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DashboardView {...props} />
      </QueryClientProvider>
    );
  };

  it('renders services in card view by default and supports clicking to select', async () => {
    vi.spyOn(api, 'getServices').mockResolvedValue(mockServices);
    const onSelectService = vi.fn();

    renderWithClient({ onSelectService });

    expect(await screen.findByText('Palworld Dedicated Server')).toBeDefined();
    expect(screen.getByText('Valheim Server')).toBeDefined();

    // Click on a service card to select it
    const palworldCard = screen.getByText('Palworld Dedicated Server');
    fireEvent.click(palworldCard);

    expect(onSelectService).toHaveBeenCalledWith('app-palworld', '192.168.1.100', 'palworld-server');
  });

  it('toggles between card view and table view', async () => {
    vi.spyOn(api, 'getServices').mockResolvedValue(mockServices);

    renderWithClient();

    expect(await screen.findByText('Palworld Dedicated Server')).toBeDefined();

    // Find the Table View toggle button
    const tableViewBtn = screen.getByRole('button', { name: /Table/i });
    fireEvent.click(tableViewBtn);

    // Verify table elements are present
    expect(await screen.findByRole('table')).toBeDefined();
    expect(screen.getByText('Server Name')).toBeDefined();
    expect(screen.getByText('Port')).toBeDefined();
    expect(screen.getByText('CPU / RAM')).toBeDefined();
    expect(screen.getByText('5 / 32')).toBeDefined();
  });

  it('opens and closes the Install Game modal', async () => {
    vi.spyOn(api, 'getServices').mockResolvedValue(mockServices);
    vi.spyOn(api, 'getApplications').mockResolvedValue([
      { guid: 'app-ark', title: 'ARK: Survival Ascended' } as AppData,
    ]);
    vi.spyOn(api, 'getHosts').mockResolvedValue([
      { id: 1, ip: '192.168.1.100', os: 'Debian 12' } as HostData,
    ]);

    renderWithClient();

    expect(await screen.findByText('Palworld Dedicated Server')).toBeDefined();

    // Click "Install Game" button in header
    const installBtns = screen.getAllByRole('button', { name: /Install Game/i });
    fireEvent.click(installBtns[0]);

    // Modal should now be open
    expect(await screen.findByRole('heading', { name: /Install Game Server/i })).toBeDefined();
    expect(screen.getByText(/Deploy a dedicated game application/i)).toBeDefined();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Install Game Server/i })).toBeNull();
    });
  });

  it('triggers service control action on button click', async () => {
    vi.spyOn(api, 'getServices').mockResolvedValue(mockServices);
    const controlSpy = vi.spyOn(api, 'controlService').mockResolvedValue({ success: true });

    renderWithClient();

    expect(await screen.findByText('Palworld Dedicated Server')).toBeDefined();

    // Click Stop button on the running Palworld service
    const stopBtn = screen.getByRole('button', { name: /^Stop$/i });
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(controlSpy).toHaveBeenCalledWith('app-palworld', '192.168.1.100', 'palworld-server', 'stop', undefined);
    });
  });
});
