import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';

describe('AppShell Layout Component', () => {
  it('renders navigation tabs and branding', () => {
    render(
      <AppShell currentTab="dashboard" onTabChange={vi.fn()}>
        <div>Dashboard Content</div>
      </AppShell>
    );

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hosts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
    expect(screen.getByText('Dashboard Content')).toBeDefined();
  });

  it('triggers onTabChange when navigating', () => {
    const onTabChange = vi.fn();
    render(
      <AppShell currentTab="dashboard" onTabChange={onTabChange}>
        <div>Content</div>
      </AppShell>
    );

    const hostsBtns = screen.getAllByText('Hosts');
    fireEvent.click(hostsBtns[0]);

    expect(onTabChange).toHaveBeenCalledWith('hosts');
  });

  it('displays user and handles logout', () => {
    const onLogout = vi.fn();
    render(
      <AppShell
        currentTab="dashboard"
        onTabChange={vi.fn()}
        currentUser={{ username: 'commander' }}
        onLogout={onLogout}
      >
        <div>Content</div>
      </AppShell>
    );

    expect(screen.getByText('@commander')).toBeDefined();
    const logoutBtn = screen.getByText('Sign Out');
    fireEvent.click(logoutBtn);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
