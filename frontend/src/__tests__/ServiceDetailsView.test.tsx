import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ServiceDetailsView } from '../views/ServiceDetailsView';
import { api } from '../api/client';
import type { ServiceData, HostData } from '../types';

describe('ServiceDetailsView Component', () => {
  const mockService: ServiceData = {
    guid: 'app-palworld',
    host: '192.168.1.100',
    service: 'palworld-server',
    name: 'Palworld Server',
    status: 'running',
    cpu_usage: '10%',
    memory_usage: '2.5 GB',
    player_count: 3,
    max_players: 32,
    port: 8211,
    enabled: true,
  };

  const mockHost: HostData = {
    id: 1,
    ip: '192.168.1.100',
    os: 'Debian 12',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getServiceDetails').mockResolvedValue({
      success: true,
      service: mockService,
      host: mockHost,
    });
  });

  it('renders service overview with status, ports, and action buttons', async () => {
    const onBack = vi.fn();
    render(
      <ServiceDetailsView
        guid="app-palworld"
        host="192.168.1.100"
        service="palworld-server"
        onBack={onBack}
      />
    );

    expect(await screen.findByText('Palworld Server')).toBeDefined();
    expect(screen.getAllByText('192.168.1.100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('8211').length).toBeGreaterThan(0);

    // Verify back navigation button
    const backBtn = screen.getByTitle('Back to Dashboard');
    fireEvent.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('toggles start on boot via api.controlService', async () => {
    const controlSpy = vi.spyOn(api, 'controlService').mockResolvedValue({ success: true });

    render(
      <ServiceDetailsView
        guid="app-palworld"
        host="192.168.1.100"
        service="palworld-server"
        onBack={vi.fn()}
      />
    );

    expect(await screen.findByText('Palworld Server')).toBeDefined();

    // Find the "Start on Boot" toggle button in the header
    const bootToggleBtn = screen.getByRole('button', { name: /Boot: Auto/i });
    fireEvent.click(bootToggleBtn);

    await waitFor(() => {
      expect(controlSpy).toHaveBeenCalledWith('app-palworld', '192.168.1.100', 'palworld-server', 'disable');
    });
  });

  it('switches to Settings & Lifecycle tab and allows checking for updates', async () => {
    const checkUpdateSpy = vi.spyOn(api, 'checkAppUpdate').mockResolvedValue({
      success: true,
      updates: true,
      message: 'A new version of the game server is available.',
    });

    render(
      <ServiceDetailsView
        guid="app-palworld"
        host="192.168.1.100"
        service="palworld-server"
        onBack={vi.fn()}
      />
    );

    expect(await screen.findByText('Palworld Server')).toBeDefined();

    // Click Settings & Lifecycle tab
    const settingsTabBtn = screen.getByRole('button', { name: /Settings & Lifecycle/i });
    fireEvent.click(settingsTabBtn);

    // Verify Settings view components are visible
    expect(await screen.findByText('Start on Host Reboot')).toBeDefined();
    expect(screen.getByText('Game Updates & Maintenance')).toBeDefined();
    expect(screen.getByText('Danger Zone')).toBeDefined();

    // Click "Check for Updates" button
    const checkBtn = screen.getByRole('button', { name: /Check for Updates/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(checkUpdateSpy).toHaveBeenCalledWith('app-palworld', '192.168.1.100', 'palworld-server');
    });

    // Verify update status alert is shown
    expect(await screen.findByText(/A new version of the game server is available/i)).toBeDefined();
  });
});
