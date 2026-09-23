import { describe, it, expect } from 'vitest';
import { parseHash, formatHash } from '../router/hashRouter';

describe('hashRouter utility', () => {
  describe('parseHash', () => {
    it('defaults to dashboard for empty, root, or invalid hashes', () => {
      expect(parseHash('')).toEqual({ tab: 'dashboard' });
      expect(parseHash('#')).toEqual({ tab: 'dashboard' });
      expect(parseHash('#/')).toEqual({ tab: 'dashboard' });
      expect(parseHash('#unknown-path')).toEqual({ tab: 'dashboard' });
    });

    it('parses primary tabs correctly', () => {
      expect(parseHash('#dashboard')).toEqual({ tab: 'dashboard' });
      expect(parseHash('#hosts')).toEqual({ tab: 'hosts' });
      expect(parseHash('#settings')).toEqual({ tab: 'settings' });
    });

    it('parses dashboard install modal state', () => {
      expect(parseHash('#dashboard/install')).toEqual({
        tab: 'dashboard',
        isInstallModalOpen: true,
      });
    });

    it('parses deep link to service details with default overview sub-tab', () => {
      expect(parseHash('#dashboard/service/ark-guid/192.168.1.10/ark_server')).toEqual({
        tab: 'dashboard',
        service: {
          guid: 'ark-guid',
          host: '192.168.1.10',
          service: 'ark_server',
          subTab: 'overview',
        },
      });
    });

    it('parses deep link to specific service sub-tabs', () => {
      const subTabs = ['terminal', 'configs', 'files', 'backups', 'mods', 'settings'] as const;
      for (const subTab of subTabs) {
        expect(parseHash(`#dashboard/service/guid-1/host-1/srv-1/${subTab}`)).toEqual({
          tab: 'dashboard',
          service: {
            guid: 'guid-1',
            host: 'host-1',
            service: 'srv-1',
            subTab,
          },
        });
      }
    });

    it('falls back to overview for invalid service sub-tab', () => {
      expect(parseHash('#dashboard/service/guid-1/host-1/srv-1/nonexistent')).toEqual({
        tab: 'dashboard',
        service: {
          guid: 'guid-1',
          host: 'host-1',
          service: 'srv-1',
          subTab: 'overview',
        },
      });
    });

    it('parses add host modal state', () => {
      expect(parseHash('#hosts/add')).toEqual({
        tab: 'hosts',
        isAddHostModalOpen: true,
      });
    });

    it('parses deep link to host details and sub-tabs', () => {
      expect(parseHash('#hosts/192.168.1.50')).toEqual({
        tab: 'hosts',
        host: {
          host: '192.168.1.50',
          subTab: 'overview',
        },
      });

      expect(parseHash('#hosts/192.168.1.50/firewall')).toEqual({
        tab: 'hosts',
        host: {
          host: '192.168.1.50',
          subTab: 'firewall',
        },
      });

      expect(parseHash('#hosts/192.168.1.50/cron')).toEqual({
        tab: 'hosts',
        host: {
          host: '192.168.1.50',
          subTab: 'cron',
        },
      });

      expect(parseHash('#hosts/192.168.1.50/files')).toEqual({
        tab: 'hosts',
        host: {
          host: '192.168.1.50',
          subTab: 'files',
        },
      });
    });

    it('handles encoded URL characters cleanly', () => {
      const parsed = parseHash('#hosts/10.0.0.1%3A2222');
      expect(parsed).toEqual({
        tab: 'hosts',
        host: {
          host: '10.0.0.1:2222',
          subTab: 'overview',
        },
      });
    });
  });

  describe('formatHash', () => {
    it('formats primary tabs', () => {
      expect(formatHash({ tab: 'dashboard' })).toBe('#dashboard');
      expect(formatHash({ tab: 'hosts' })).toBe('#hosts');
      expect(formatHash({ tab: 'settings' })).toBe('#settings');
    });

    it('formats modal states', () => {
      expect(formatHash({ tab: 'dashboard', isInstallModalOpen: true })).toBe('#dashboard/install');
      expect(formatHash({ tab: 'hosts', isAddHostModalOpen: true })).toBe('#hosts/add');
    });

    it('formats service deep links', () => {
      expect(
        formatHash({
          tab: 'dashboard',
          service: {
            guid: 'ark-1',
            host: '192.168.1.100',
            service: 'ark_srv',
            subTab: 'overview',
          },
        })
      ).toBe('#dashboard/service/ark-1/192.168.1.100/ark_srv');

      expect(
        formatHash({
          tab: 'dashboard',
          service: {
            guid: 'ark-1',
            host: '192.168.1.100',
            service: 'ark_srv',
            subTab: 'terminal',
          },
        })
      ).toBe('#dashboard/service/ark-1/192.168.1.100/ark_srv/terminal');
    });

    it('formats host deep links', () => {
      expect(
        formatHash({
          tab: 'hosts',
          host: {
            host: '192.168.1.200',
            subTab: 'overview',
          },
        })
      ).toBe('#hosts/192.168.1.200');

      expect(
        formatHash({
          tab: 'hosts',
          host: {
            host: '192.168.1.200',
            subTab: 'firewall',
          },
        })
      ).toBe('#hosts/192.168.1.200/firewall');
    });
  });
});
