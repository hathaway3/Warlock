import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';

function Bomb(): never {
  throw new Error('Simulated render crash');
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('All good')).toBeDefined();
  });

  it('renders a fallback UI instead of a blank screen when a child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText('Simulated render crash')).toBeDefined();
    expect(screen.getByRole('button', { name: /Reload/i })).toBeDefined();

    consoleSpy.mockRestore();
  });
});
