import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HostsView } from '../views/HostsView';
import { api } from '../api/client';

describe('HostsView Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  const renderWithClient = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <HostsView />
      </QueryClientProvider>
    );
  };

  it('renders hosts list and clicking Add Host button opens the modal', async () => {
    vi.spyOn(api, 'getHosts').mockResolvedValue([
      { id: 1, ip: '192.168.1.100', os: 'Debian 12' },
    ]);

    renderWithClient();

    // Verify host is rendered
    expect(await screen.findByText('192.168.1.100')).toBeDefined();
    expect(screen.getByText('Debian 12')).toBeDefined();

    // Find and click the Add Host header button
    const addHostBtns = screen.getAllByRole('button', { name: /Add Host/i });
    expect(addHostBtns.length).toBeGreaterThan(0);
    fireEvent.click(addHostBtns[0]);

    // Modal should now be open
    expect(await screen.findByRole('heading', { name: /Add Server Host/i })).toBeDefined();
    expect(screen.getByPlaceholderText(/192.168.1.100 or localhost/i)).toBeDefined();
  });

  it('submits new host via api.addHost and closes modal on success', async () => {
    vi.spyOn(api, 'getHosts').mockResolvedValue([]);
    const addHostSpy = vi.spyOn(api, 'addHost').mockResolvedValue({
      success: true,
      message: 'Host added successfully',
      host: { ip: '10.0.0.5' },
    });

    const { container } = renderWithClient();

    // Wait for empty state to render
    expect(await screen.findByText('No Hosts Configured')).toBeDefined();

    // Click Add Host button
    const addHostBtns = screen.getAllByRole('button', { name: /Add Host/i });
    fireEvent.click(addHostBtns[0]);

    expect(await screen.findByRole('heading', { name: /Add Server Host/i })).toBeDefined();

    const input = screen.getByPlaceholderText(/192.168.1.100 or localhost/i);
    fireEvent.change(input, { target: { value: '10.0.0.5' } });

    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(addHostSpy).toHaveBeenCalledWith('10.0.0.5');
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Add Server Host/i })).toBeNull();
    });
  });

  it('displays SSH setup command and retry button when SSH connection fails', async () => {
    vi.spyOn(api, 'getHosts').mockResolvedValue([]);
    vi.spyOn(api, 'addHost').mockResolvedValue({
      success: false,
      error: 'Failed to connect via SSH. Please ensure the host is reachable and the SSH key is authorized.',
      setupCommand: 'echo "ssh-key" >> ~/.ssh/authorized_keys',
    });

    const { container } = renderWithClient();

    // Wait for empty state to render
    expect(await screen.findByText('No Hosts Configured')).toBeDefined();

    const addHostBtns = screen.getAllByRole('button', { name: /Add Host/i });
    fireEvent.click(addHostBtns[0]);

    expect(await screen.findByRole('heading', { name: /Add Server Host/i })).toBeDefined();

    const input = screen.getByPlaceholderText(/192.168.1.100 or localhost/i);
    fireEvent.change(input, { target: { value: '192.168.1.200' } });

    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    // Verify error and setup command are displayed
    expect(await screen.findByText(/Failed to connect via SSH/i)).toBeDefined();
    expect(container.querySelector('pre')?.textContent).toContain('echo "ssh-key" >> ~/.ssh/authorized_keys');
    expect(screen.getByRole('button', { name: /Retry Connection/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Copy Setup Command/i })).toBeDefined();
  });

  it('handles host deletion with confirmation modal', async () => {
    vi.spyOn(api, 'getHosts').mockResolvedValue([
      { id: 1, ip: '192.168.1.50', os: 'Ubuntu 24.04' },
    ]);
    const deleteHostSpy = vi.spyOn(api, 'deleteHost').mockResolvedValue({ success: true });

    renderWithClient();

    expect(await screen.findByText('192.168.1.50')).toBeDefined();

    // Click trash button on card
    const deleteBtn = screen.getByTitle(/Delete host 192.168.1.50/i);
    fireEvent.click(deleteBtn);

    // Confirmation modal should show
    expect(await screen.findByRole('heading', { name: /Remove Host/i })).toBeDefined();
    expect(screen.getByText(/Are you sure you want to remove/i)).toBeDefined();

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /^Remove Host$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteHostSpy).toHaveBeenCalledWith('192.168.1.50');
    });
  });

  it('triggers onSelectHost when clicking Manage Host button', async () => {
    vi.spyOn(api, 'getHosts').mockResolvedValue([
      { id: 1, ip: '10.10.10.10', os: 'Ubuntu 24.04' },
    ]);
    const onSelectHost = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <HostsView onSelectHost={onSelectHost} />
      </QueryClientProvider>
    );

    expect(await screen.findByText('10.10.10.10')).toBeDefined();

    const manageBtn = screen.getByRole('button', { name: /Manage Host/i });
    fireEvent.click(manageBtn);

    expect(onSelectHost).toHaveBeenCalledWith('10.10.10.10');
  });
});
