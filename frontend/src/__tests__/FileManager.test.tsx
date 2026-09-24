import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileManager } from '../components/files/FileManager';
import { api } from '../api/client';
import type { FileItem } from '../types';

const mockDir: FileItem = {
  name: 'saves',
  mimetype: 'directory',
  path: '/root/saves',
  size: null,
  symlink: false,
  permissions: 'drwxr-xr-x',
  user: 'root',
  group: 'root',
  modified: 1700000000,
};

describe('FileManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders each file/folder row as a real, keyboard-focusable button (not a bare div with onClick)', async () => {
    vi.spyOn(api, 'getFiles').mockImplementation(async (_host, path) => ({
      success: true,
      files: path === '/root' ? [mockDir] : [],
      path,
    }));

    render(<FileManager host="10.0.0.1" initialPath="/root" />);

    // getByRole('button') only matches real <button> elements (or explicit role="button") —
    // this fails if the row regresses back to a plain <div onClick> with no accessible role.
    const row = await screen.findByRole('button', { name: /^saves/i });
    row.focus();
    expect(document.activeElement).toBe(row);

    fireEvent.click(row);

    await waitFor(() => {
      expect(api.getFiles).toHaveBeenCalledWith('10.0.0.1', '/root/saves');
    });
  });
});
