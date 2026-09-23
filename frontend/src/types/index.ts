export interface AppData {
  title: string;
  guid: string;
  icon: string;
  repo: string;
  installer: string;
  source: string;
  thumbnail: string;
  image?: string;
  header?: string;
  category?: string;
  installs?: AppInstallData[];
}

export interface AppInstallData {
  host: string;
  guid: string;
  path: string;
  options: string[];
  version: number;
}

export interface ServiceData {
  guid: string;
  host: string;
  service: string;
  name: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'unknown';
  cpu_usage?: number | string;
  memory_usage?: number | string;
  player_count?: number;
  max_players?: number;
  port?: number;
  enabled?: boolean;
  game_pid?: number;
  service_pid?: number;
  warlock_options?: string[];
  metrics_timestamp?: number;
}

export interface HostData {
  id: number;
  ip: string;
  os?: string;
  status?: string;
  cpu_load?: number;
  memory_used?: number;
  memory_total?: number;
  disk_used?: number;
  disk_total?: number;
}

export interface ApiToken {
  id: number;
  name: string;
  token_prefix: string;
  createdAt: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface FileItem {
  name: string;
  mimetype: string;
  path: string;
  size: number | null;
  symlink: boolean;
  permissions: string | number | null;
  user: string;
  group: string;
  modified: number | null;
}

export interface ServiceConfigItem {
  option: string;
  value: any;
  default: any;
  type: 'string' | 'int' | 'bool' | 'select' | string;
  help?: string;
  options?: string[];
  group?: string;
}

export interface ServiceModItem {
  id: string;
  provider?: string;
  name?: string;
}

export interface AuthUser {
  id: number;
  username: string;
  secret_2fa?: boolean | string | null;
}

