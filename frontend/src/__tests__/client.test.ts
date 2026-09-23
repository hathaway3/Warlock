import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api } from '../api/client';

describe('ApiClient Token & Auth Management', () => {
  beforeEach(() => {
    localStorage.clear();
    api.setToken(null);
  });

  it('stores and retrieves Bearer tokens from localStorage', () => {
    expect(api.getToken()).toBeNull();

    api.setToken('test_token_12345');
    expect(api.getToken()).toBe('test_token_12345');
    expect(localStorage.getItem('warlock_api_token')).toBe('test_token_12345');

    api.setToken(null);
    expect(api.getToken()).toBeNull();
    expect(localStorage.getItem('warlock_api_token')).toBeNull();
  });

  it('dispatches warlock:unauthorized event on 401 responses', async () => {
    const unauthorizedListener = vi.fn();
    window.addEventListener('warlock:unauthorized', unauthorizedListener);

    // Mock fetch returning 401
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 401,
      json: async () => ({ success: false, error: 'Unauthorized' }),
    } as any);

    await api.getApplications().catch(() => {});

    expect(unauthorizedListener).toHaveBeenCalledTimes(1);

    window.removeEventListener('warlock:unauthorized', unauthorizedListener);
  });
});
