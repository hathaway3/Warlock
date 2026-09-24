import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginView } from '../views/LoginView';
import { api } from '../api/client';

describe('LoginView Component', () => {
  it('renders login form with username and password fields', () => {
    render(<LoginView onLoginSuccess={vi.fn()} onRequire2faSetup={vi.fn()} />);

    expect(screen.getByText(/Account Sign In/i)).toBeDefined();
    expect(screen.getByPlaceholderText('admin')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeDefined();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeDefined();
  });

  it('validates required fields before calling login API', () => {
    const loginSpy = vi.spyOn(api, 'login');
    render(<LoginView onLoginSuccess={vi.fn()} onRequire2faSetup={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /Sign In/i });
    fireEvent.click(submitBtn);

    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('calls onLoginSuccess when credentials are valid', async () => {
    const onLoginSuccess = vi.fn();
    vi.spyOn(api, 'login').mockResolvedValue({
      success: true,
      user: { id: 1, username: 'admin' },
    });

    render(<LoginView onLoginSuccess={onLoginSuccess} onRequire2faSetup={vi.fn()} />);

    const userInput = screen.getByPlaceholderText('admin');
    const passInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /Sign In/i });

    fireEvent.change(userInput, { target: { value: 'admin' } });
    fireEvent.change(passInput, { target: { value: 'password123' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledWith({ id: 1, username: 'admin' });
    });
  });

  it('shows a TLS-accurate footer instead of an end-to-end encryption claim', () => {
    render(<LoginView onLoginSuccess={vi.fn()} onRequire2faSetup={vi.fn()} />);

    expect(screen.getByText(/Secured with TLS encryption/i)).toBeDefined();
    expect(screen.queryByText(/End-to-end encrypted/i)).toBeNull();
  });

  it('switches to 2FA code view if require2fa is returned', async () => {
    vi.spyOn(api, 'login').mockResolvedValue({
      success: false,
      require2fa: true,
      error: '2FA authentication code required',
    });

    render(<LoginView onLoginSuccess={vi.fn()} onRequire2faSetup={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('admin'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••••••'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText(/Two-Factor Authentication/i)).toBeDefined();
      expect(screen.getByPlaceholderText('123456')).toBeDefined();
    });
  });
});
