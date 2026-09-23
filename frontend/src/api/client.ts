import type { ApiResponse, AppData, ServiceData, HostData, ApiToken, FileItem, ServiceConfigItem, AuthUser } from '../types';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('warlock_api_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('warlock_api_token', token);
    } else {
      localStorage.removeItem('warlock_api_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Dispatched for global auth handler / redirect
      window.dispatchEvent(new CustomEvent('warlock:unauthorized'));
    }

    const json = await response.json();
    return json;
  }

  // Applications
  async getApplications(): Promise<AppData[]> {
    const res = await this.request<{ success: boolean; applications: AppData[] }>('/api/applications?all=1');
    return res.applications || [];
  }

  // Services
  async getServices(): Promise<ServiceData[]> {
    const res = await this.request<{ success: boolean; services: any[] }>('/api/services');
    if (!res.success || !res.services) return [];
    
    return res.services.map(s => ({
      guid: s.guid || s.host?.guid,
      host: s.host?.host || s.host,
      service: s.service?.service || s.service,
      name: s.name || s.service?.name || s.service,
      status: s.status || s.service?.status || 'stopped',
      cpu_usage: s.cpu_usage || s.service?.cpu_usage,
      memory_usage: s.memory_usage || s.service?.memory_usage,
      player_count: s.player_count ?? s.service?.player_count ?? 0,
      max_players: s.max_players ?? s.service?.max_players ?? 0,
      port: s.port || s.service?.port,
      enabled: s.enabled ?? s.service?.enabled ?? false,
      warlock_options: s.warlock_options || s.host?.options || [],
    }));
  }

  // Service Details
  async getServiceDetails(guid: string, host: string, service: string): Promise<{ success: boolean; service: ServiceData; host: any }> {
    return this.request<{ success: boolean; service: ServiceData; host: any }>(
      `/api/service/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`
    );
  }

  // Service Control
  async controlService(guid: string, host: string, service: string, action: string, force = false): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/service/control/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`, {
      method: 'POST',
      body: JSON.stringify({ action, force }),
    });
  }

  async createService(guid: string, host: string, service: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/service/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`, {
      method: 'PUT',
    });
  }

  async deleteService(guid: string, host: string, service: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/service/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`, {
      method: 'DELETE',
    });
  }

  // Service Configs
  async getServiceConfigs(guid: string, host: string, service: string): Promise<ServiceConfigItem[]> {
    const res = await this.request<{ success: boolean; configs?: ServiceConfigItem[] }>(
      `/api/service/configs/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`
    );
    return res.configs || [];
  }

  async saveServiceConfigs(guid: string, host: string, service: string, updates: Record<string, any>): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/service/configs/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`,
      {
        method: 'POST',
        body: JSON.stringify(updates),
      }
    );
  }

  // Service Commands
  async getServiceCommands(guid: string, host: string, service: string): Promise<string[]> {
    const res = await this.request<{ success: boolean; commands?: string[] }>(
      `/api/service/cmd/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`
    );
    return res.commands || [];
  }

  async sendServiceCommand(guid: string, host: string, service: string, command: string): Promise<{ success: boolean; output?: string; error?: string }> {
    return this.request<{ success: boolean; output?: string; error?: string }>(
      `/api/service/cmd/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`,
      {
        method: 'POST',
        body: JSON.stringify({ command }),
      }
    );
  }

  // Service Mods
  async getServiceMods(guid: string, host: string, service: string): Promise<{ success: boolean; output?: string; error?: string }> {
    return this.request<{ success: boolean; output?: string; error?: string }>(
      `/api/service/mods/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`
    );
  }

  async installServiceMod(guid: string, host: string, service: string, id: string, provider = 'steam'): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/service/mods/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`,
      {
        method: 'POST',
        body: JSON.stringify({ id, provider }),
      }
    );
  }

  async removeServiceMod(guid: string, host: string, service: string, id: string, provider?: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/service/mods/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ id, provider }),
      }
    );
  }

  // Backups
  async restoreBackup(guid: string, host: string, service: string, filename: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/application/backup/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ filename }),
      }
    );
  }

  // Files
  async getFiles(host: string, dirPath: string): Promise<{ success: boolean; files: FileItem[]; path: string; error?: string }> {
    return this.request<{ success: boolean; files: FileItem[]; path: string; error?: string }>(
      `/api/files/${encodeURIComponent(host)}?path=${encodeURIComponent(dirPath)}`
    );
  }

  async getFile(host: string, filePath: string): Promise<{ success: boolean; content?: string; encoding?: string; mimetype?: string; size?: number; name?: string; error?: string }> {
    return this.request<{ success: boolean; content?: string; encoding?: string; mimetype?: string; size?: number; name?: string; error?: string }>(
      `/api/file/${encodeURIComponent(host)}?path=${encodeURIComponent(filePath)}`
    );
  }

  async saveFile(host: string, filePath: string, content: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/file/${encodeURIComponent(host)}?path=${encodeURIComponent(filePath)}`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    );
  }

  async createDirectory(host: string, parentPath: string, name: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/file/${encodeURIComponent(host)}?path=${encodeURIComponent(parentPath)}&name=${encodeURIComponent(name)}&isdir=1`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
  }

  async createEmptyFile(host: string, parentPath: string, name: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/file/${encodeURIComponent(host)}?path=${encodeURIComponent(parentPath)}&name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        body: JSON.stringify({ content: '' }),
      }
    );
  }

  async renameFile(host: string, oldPath: string, newPath: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/file/${encodeURIComponent(host)}`,
      {
        method: 'MOVE',
        body: JSON.stringify({ oldPath, newPath }),
      }
    );
  }

  async deleteFile(host: string, targetPath: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/file/${encodeURIComponent(host)}?path=${encodeURIComponent(targetPath)}`,
      {
        method: 'DELETE',
      }
    );
  }

  async extractArchive(host: string, archivePath: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(
      `/api/file/extract/${encodeURIComponent(host)}?path=${encodeURIComponent(archivePath)}`,
      {
        method: 'POST',
      }
    );
  }

  async uploadFile(
    host: string,
    targetPath: string,
    file: File,
    onProgress?: (progressPct: number) => void
  ): Promise<ApiResponse> {
    const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB chunks
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE) || 1;

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunkBlob = file.slice(start, end);

      const endpoint = `/api/file/${encodeURIComponent(host)}?path=${encodeURIComponent(targetPath)}&chunk=${chunkIdx}&totalChunks=${totalChunks}&size=${totalSize}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
      };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers,
        body: chunkBlob,
      });

      const resJson = await res.json();
      if (!resJson.success) {
        return resJson;
      }

      if (onProgress) {
        onProgress(Math.round(((chunkIdx + 1) / totalChunks) * 100));
      }
    }

    return { success: true };
  }

  // Hosts
  async getHosts(): Promise<HostData[]> {
    const res = await this.request<{ success: boolean; data: HostData[]; hosts?: HostData[] }>('/api/hosts');
    return res.data || res.hosts || [];
  }

  async getHostSshKey(): Promise<{ success: boolean; sshKey?: string; setupCommand?: string; error?: string }> {
    return this.request<{ success: boolean; sshKey?: string; setupCommand?: string; error?: string }>('/api/hosts/ssh-key');
  }

  async addHost(ip: string): Promise<{ success: boolean; message?: string; host?: any; error?: string; sshKey?: string; setupCommand?: string }> {
    return this.request<{ success: boolean; message?: string; host?: any; error?: string; sshKey?: string; setupCommand?: string }>('/api/hosts', {
      method: 'POST',
      body: JSON.stringify({ ip }),
    });
  }

  async deleteHost(host: string): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/hosts/${encodeURIComponent(host)}`, {
      method: 'DELETE',
    });
  }

  // Tokens (Issue #28)
  async getTokens(): Promise<ApiToken[]> {
    const res = await this.request<{ success: boolean; data: ApiToken[] }>('/api/users/tokens');
    return res.data || [];
  }

  async createToken(name: string, expiresInDays?: number): Promise<ApiResponse<{ token: string; name: string }>> {
    return this.request<ApiResponse<{ token: string; name: string }>>('/api/users/tokens', {
      method: 'POST',
      body: JSON.stringify({ name, expires_in_days: expiresInDays }),
    });
  }

  async revokeToken(id: number): Promise<ApiResponse> {
    return this.request<ApiResponse>(`/api/users/tokens/${id}`, {
      method: 'DELETE',
    });
  }

  // Authentication & 2FA
  async login(username: string, password: string, authcode?: string): Promise<{ success: boolean; user?: AuthUser; token?: string; require2fa?: boolean; require2faSetup?: boolean; error?: string }> {
    const res = await this.request<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, authcode }),
    });
    if (res.success && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async logout(): Promise<ApiResponse> {
    try {
      await this.request<ApiResponse>('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
    return { success: true };
  }

  async getAuthStatus(): Promise<{ success: boolean; user?: AuthUser; authenticated?: boolean; needsInstall?: boolean }> {
    return this.request<{ success: boolean; user?: AuthUser; authenticated?: boolean; needsInstall?: boolean }>('/api/auth/status');
  }

  async setupAdmin(username: string, password: string): Promise<{ success: boolean; user?: AuthUser; require2faSetup?: boolean; error?: string }> {
    return this.request<any>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async setup2fa(): Promise<{ success: boolean; secret?: string; qr?: string; error?: string }> {
    return this.request<{ success: boolean; secret?: string; qr?: string; error?: string }>('/api/auth/2fa/setup');
  }

  async verify2fa(authcode: string): Promise<ApiResponse> {
    return this.request<ApiResponse>('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ authcode }),
    });
  }

  // Application Install / Uninstall / Updates
  async installApplication(guid: string, host: string, options: string[] = []): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return fetch(`/api/application/${encodeURIComponent(guid)}/${encodeURIComponent(host)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ options }),
    });
  }

  async uninstallApplication(guid: string, host: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return fetch(`/api/application/${encodeURIComponent(guid)}/${encodeURIComponent(host)}`, {
      method: 'DELETE',
      headers,
    });
  }

  async checkAppUpdate(guid: string, host: string, service?: string): Promise<{ success: boolean; updates: boolean; message: string }> {
    const endpoint = service
      ? `/api/application/update/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`
      : `/api/application/update/${encodeURIComponent(guid)}/${encodeURIComponent(host)}`;
    return this.request(endpoint);
  }

  async updateApplication(guid: string, host: string, service?: string): Promise<Response> {
    const endpoint = service
      ? `/api/application/update/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`
      : `/api/application/update/${encodeURIComponent(guid)}/${encodeURIComponent(host)}`;
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return fetch(endpoint, {
      method: 'POST',
      headers,
    });
  }

  // Firewall
  async getFirewall(host: string): Promise<{ success: boolean; status: string; rules: any[]; error?: string }> {
    return this.request(`/api/firewall/${encodeURIComponent(host)}`);
  }

  async addFirewallRule(host: string, rule: { to: string; from?: string; proto?: string; action: string; comment?: string }): Promise<ApiResponse> {
    return this.request(`/api/firewall/${encodeURIComponent(host)}`, {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  }

  async deleteFirewallRule(host: string, rule: { to: string; from?: string; proto?: string; action: string; comment?: string }): Promise<ApiResponse> {
    return this.request(`/api/firewall/${encodeURIComponent(host)}`, {
      method: 'DELETE',
      body: JSON.stringify(rule),
    });
  }

  async setFirewallStatus(host: string, action: 'enable' | 'disable'): Promise<ApiResponse> {
    return this.request(`/api/firewall/${encodeURIComponent(host)}`, {
      method: 'PUT',
      body: JSON.stringify({ action }),
    });
  }

  async installFirewall(host: string): Promise<ApiResponse> {
    return this.request(`/api/firewall/install/${encodeURIComponent(host)}`, {
      method: 'POST',
    });
  }

  // Cron
  async getCronJobs(host: string): Promise<{ success: boolean; jobs: any[]; error?: string }> {
    return this.request(`/api/cron/${encodeURIComponent(host)}`);
  }

  async addCronJob(host: string, job: { schedule: string; command: string; identifier?: string }): Promise<ApiResponse> {
    return this.request(`/api/cron/${encodeURIComponent(host)}`, {
      method: 'POST',
      body: JSON.stringify(job),
    });
  }

  async deleteCronJob(host: string, identifier: string): Promise<ApiResponse> {
    return this.request(`/api/cron/${encodeURIComponent(host)}`, {
      method: 'DELETE',
      body: JSON.stringify({ identifier }),
    });
  }

  // Host Metrics
  async getHostMetrics(host: string, timeframe = 'day'): Promise<{ success: boolean; data: any[]; error?: string }> {
    return this.request(`/api/metrics/${encodeURIComponent(host)}?timeframe=${encodeURIComponent(timeframe)}`);
  }
}

export const api = new ApiClient();

