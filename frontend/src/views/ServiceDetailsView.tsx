import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import type { ServiceData, ServiceConfigItem, FileItem } from '../types';
import { XtermTerminal } from '../components/terminal/XtermTerminal';
import { CodeMirrorEditor } from '../components/editor/CodeMirrorEditor';
import { FileManager } from '../components/files/FileManager';
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Zap,
  Cpu,
  Activity,
  Users,
  Radio,
  Sliders,
  FolderTree,
  Archive,
  Layers,
  Terminal as TerminalIcon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Power,
} from 'lucide-react';

interface ServiceDetailsViewProps {
  guid: string;
  host: string;
  service: string;
  initialTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  onBack: () => void;
}

type TabType = 'overview' | 'terminal' | 'configs' | 'files' | 'backups' | 'mods' | 'settings';

export const ServiceDetailsView: React.FC<ServiceDetailsViewProps> = ({
  guid,
  host,
  service,
  initialTab,
  onTabChange,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'overview');

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleSwitchTab = (tab: TabType) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };
  const [serviceData, setServiceData] = useState<ServiceData | null>(null);
  const [hostData, setHostData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Settings & Lifecycle state
  const [removeModId, setRemoveModId] = useState('');
  const [updateStatus, setUpdateStatus] = useState<{ checked: boolean; updates?: boolean; message?: string } | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateStreaming, setUpdateStreaming] = useState(false);
  const [updateLogs, setUpdateLogs] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUninstallModal, setShowUninstallModal] = useState(false);
  const [uninstallStreaming, setUninstallStreaming] = useState(false);
  const [uninstallLogs, setUninstallLogs] = useState('');

  // Configs tab state
  const [configs, setConfigs] = useState<ServiceConfigItem[]>([]);
  const [configForm, setConfigForm] = useState<Record<string, any>>({});
  const [configsLoading, setConfigsLoading] = useState(false);
  const [isRawConfig, setIsRawConfig] = useState(false);

  // Backups tab state
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupStreaming, setBackupStreaming] = useState(false);
  const [backupOutput, setBackupOutput] = useState('');

  // Mods tab state
  const [modsOutput, setModsOutput] = useState('');
  const [newModId, setNewModId] = useState('');
  const [modsLoading, setModsLoading] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchServiceDetails = async () => {
    try {
      const res = await api.getServiceDetails(guid, host, service);
      if (res.success && res.service) {
        setServiceData(res.service);
        setHostData(res.host);
      } else {
        showToast('Failed to load service details', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading service', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceDetails();
    const interval = setInterval(fetchServiceDetails, 6000);
    return () => clearInterval(interval);
  }, [guid, host, service]);

  // Load configs
  const loadConfigs = async () => {
    setConfigsLoading(true);
    try {
      const data = await api.getServiceConfigs(guid, host, service);
      setConfigs(data);
      const initialForm: Record<string, any> = {};
      data.forEach((c: ServiceConfigItem) => {
        initialForm[c.option] = c.value ?? c.default ?? '';
      });
      setConfigForm(initialForm);
    } catch (err: any) {
      showToast(err.message || 'Error loading configs', 'error');
    } finally {
      setConfigsLoading(false);
    }
  };

  // Load backups
  const loadBackups = async () => {
    if (!hostData?.path) return;
    setBackupsLoading(true);
    try {
      const backupDir = `${hostData.path}/backups`;
      const res = await api.getFiles(host, backupDir);
      if (res.success && res.files) {
        setBackups(res.files.filter((f: FileItem) => !f.mimetype.includes('directory')));
      } else {
        setBackups([]);
      }
    } catch (err: any) {
      setBackups([]);
    } finally {
      setBackupsLoading(false);
    }
  };

  // Load mods
  const loadMods = async () => {
    setModsLoading(true);
    try {
      const res = await api.getServiceMods(guid, host, service);
      if (res.success) {
        setModsOutput(res.output || 'No active mods configured.');
      } else {
        setModsOutput(res.error || 'Mods command not supported for this game.');
      }
    } catch (err: any) {
      setModsOutput('Mods not supported or error fetching mods.');
    } finally {
      setModsLoading(false);
    }
  };

  // Handle Tab Change
  useEffect(() => {
    if (activeTab === 'configs') {
      loadConfigs();
    } else if (activeTab === 'backups') {
      loadBackups();
    } else if (activeTab === 'mods') {
      loadMods();
    }
  }, [activeTab]);

  // Service power controls
  const handleControl = async (action: 'start' | 'stop' | 'restart' | 'force-stop', force = false) => {
    setActionLoading(true);
    try {
      const res = await api.controlService(guid, host, service, action, force || action === 'force-stop');
      if (res.success) {
        showToast(`Action "${action}" sent successfully!`);
        fetchServiceDetails();
      } else {
        showToast(res.error || `Failed to perform action: ${action}`, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Control error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Save configs
  const handleSaveConfigs = async (updates: Record<string, any>) => {
    setActionLoading(true);
    try {
      const res = await api.saveServiceConfigs(guid, host, service, updates);
      if (res.success) {
        showToast('Configurations saved successfully!');
        loadConfigs();
      } else {
        showToast(res.error || 'Error saving configs', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving configs', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger backup
  const handleTriggerBackup = async () => {
    setBackupStreaming(true);
    setBackupOutput('Initiating remote backup...\n');
    try {
      const res = await fetch(`/api/application/backup/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}`, {
        method: 'POST',
        headers: api.getToken() ? { Authorization: `Bearer ${api.getToken()}` } : {},
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setBackupOutput((prev) => prev + chunk);
        }
      }
      showToast('Backup completed!');
      loadBackups();
    } catch (err: any) {
      showToast(err.message || 'Backup failed', 'error');
    } finally {
      setBackupStreaming(false);
    }
  };

  // Restore backup
  const handleRestoreBackup = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to restore backup "${filename}"? This will overwrite existing game state.`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.restoreBackup(guid, host, service, filename);
      if (res.success) {
        showToast(`Backup "${filename}" restored successfully!`);
      } else {
        showToast(res.error || 'Restore failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Restore error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Install Mod
  const handleInstallMod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModId.trim()) return;
    setActionLoading(true);
    try {
      const res = await api.installServiceMod(guid, host, service, newModId.trim(), 'steam');
      if (res.success) {
        showToast(`Mod ${newModId.trim()} installed!`);
        setNewModId('');
        loadMods();
      } else {
        showToast(res.error || 'Failed to install mod', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error installing mod', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Remove Mod
  const handleRemoveMod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!removeModId.trim()) return;
    setActionLoading(true);
    try {
      const res = await api.removeServiceMod(guid, host, service, removeModId.trim());
      if (res.success) {
        showToast(`Mod ${removeModId.trim()} removed!`);
        setRemoveModId('');
        loadMods();
      } else {
        showToast(res.error || 'Failed to remove mod', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error removing mod', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle start on boot
  const handleToggleBoot = async () => {
    if (!serviceData) return;
    const action = serviceData.enabled ? 'disable' : 'enable';
    setActionLoading(true);
    try {
      const res = await api.controlService(guid, host, service, action);
      if (res.success) {
        setServiceData({ ...serviceData, enabled: !serviceData.enabled });
        showToast(`Start on boot ${!serviceData.enabled ? 'enabled' : 'disabled'}!`);
      } else {
        showToast(res.error || 'Failed to update boot setting', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error updating boot setting', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Check for updates
  const handleCheckUpdate = async () => {
    setUpdateLoading(true);
    try {
      const res = await api.checkAppUpdate(guid, host, service);
      setUpdateStatus({ checked: true, updates: res.updates, message: res.message });
      showToast(res.updates ? 'Updates are available!' : 'Game is up to date.');
    } catch (e: any) {
      showToast(e.message || 'Error checking for updates', 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  // Run update
  const handleRunUpdate = async () => {
    setUpdateStreaming(true);
    setUpdateLogs(`Initiating game update on ${host}...\n`);
    try {
      const response = await api.updateApplication(guid, host, service);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setUpdateLogs((prev) => prev + chunk);
        }
      }
      setUpdateLogs((prev) => prev + '\n✓ Update complete!\n');
      showToast('Game updated successfully!');
      fetchServiceDetails();
    } catch (e: any) {
      setUpdateLogs((prev) => prev + `\n✖ Error during update: ${e.message || String(e)}\n`);
      showToast('Update failed', 'error');
    } finally {
      setUpdateStreaming(false);
    }
  };

  // Delete instance
  const handleDeleteInstance = async () => {
    setActionLoading(true);
    try {
      const res = await api.deleteService(guid, host, service);
      if (res.success) {
        showToast(`Service instance ${service} removed!`);
        setShowDeleteModal(false);
        onBack();
      } else {
        showToast(res.error || 'Failed to remove instance', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error removing instance', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Uninstall application
  const handleUninstallApp = async () => {
    setUninstallStreaming(true);
    setUninstallLogs(`Uninstalling game application from host ${host}...\n`);
    try {
      const response = await api.uninstallApplication(guid, host);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setUninstallLogs((prev) => prev + chunk);
        }
      }
      setUninstallLogs((prev) => prev + '\n✓ Uninstallation complete!\n');
      showToast('Application uninstalled!');
      setTimeout(() => {
        setShowUninstallModal(false);
        onBack();
      }, 1500);
    } catch (e: any) {
      setUninstallLogs((prev) => prev + `\n✖ Error during uninstall: ${e.message || String(e)}\n`);
      showToast('Uninstall failed', 'error');
    } finally {
      setUninstallStreaming(false);
    }
  };

  const isRunning = serviceData?.status === 'running';

  if (loading && !serviceData) {
    return (
      <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="text-sm font-mono">Loading service telemetry and configuration...</span>
      </div>
    );
  }

  if (!loading && !serviceData) {
    return (
      <div className="p-12 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-4 max-w-lg mx-auto mt-12">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">Service Not Found or Unreachable</h3>
        <p className="text-xs text-slate-400">
          Unable to retrieve details for service <code className="text-cyan-400">{service}</code> on host <code className="text-cyan-400">{host}</code>. The host may be offline or the service may have been uninstalled.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Bar with Navigation & Power Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-[#0d121f] to-slate-900/90 border border-white/10 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {serviceData?.name || service}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  isRunning
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                {serviceData?.status || 'Unknown'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
              <span className="flex items-center gap-1">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                {host}
              </span>
              <span>•</span>
              <span>Service ID: {service}</span>
              {serviceData?.port && (
                <>
                  <span>•</span>
                  <span>Port: {serviceData.port}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Power Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isRunning ? (
            <>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleControl('restart')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleControl('stop')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
              >
                <Square className="w-3.5 h-3.5 fill-rose-300" />
                <span>Stop</span>
              </button>

              {/* Force-Stop (Issue #31 Fix) */}
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleControl('force-stop', true)}
                title="Force stop immediately (Issue #31)"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-800 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-3.5 h-3.5 text-rose-400" />
                <span>Force Stop</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleControl('start')}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Service</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleBoot}
            disabled={actionLoading}
            title={serviceData?.enabled ? "Disable automatic start on boot" : "Enable automatic start on boot"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              serviceData?.enabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{serviceData?.enabled ? 'Boot: Auto' : 'Boot: Manual'}</span>
          </button>

          <button
            type="button"
            onClick={fetchServiceDetails}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">CPU Usage</div>
            <div className="text-base font-bold font-mono text-white mt-0.5">
              {serviceData?.cpu_usage !== undefined ? `${serviceData.cpu_usage}%` : '--'}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Memory</div>
            <div className="text-base font-bold font-mono text-white mt-0.5">
              {serviceData?.memory_usage !== undefined ? `${serviceData.memory_usage} MB` : '--'}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Players</div>
            <div className="text-base font-bold font-mono text-white mt-0.5">
              {serviceData?.player_count ?? 0}
              {serviceData?.max_players ? ` / ${serviceData.max_players}` : ''}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Port</div>
            <div className="text-base font-bold font-mono text-white mt-0.5">
              {serviceData?.port || 'Default'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => handleSwitchTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('terminal')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'terminal'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <TerminalIcon className="w-4 h-4" />
          <span>Console & Logs</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('configs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'configs'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Configuration</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('files')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'files'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Files</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('backups')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'backups'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span>Backups</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('mods')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'mods'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Mods</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          <span>Settings & Lifecycle</span>
        </button>
      </div>

      {/* Tab Panels */}
      {/* 1. Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
            <h3 className="text-sm font-semibold text-white">System Information</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Host IP</span>
                <span className="text-white">{host}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Application GUID</span>
                <span className="text-cyan-400">{guid}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Install Path</span>
                <span className="text-white truncate max-w-[240px]">{hostData?.path || '--'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Game Process PID</span>
                <span className="text-white">{serviceData?.game_pid || '--'}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Service Status</span>
                <span className="text-emerald-400 font-bold">{serviceData?.status || 'Unknown'}</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
            <h3 className="text-sm font-semibold text-white">Supported Capabilities</h3>
            <div className="flex flex-wrap gap-2">
              {hostData?.options && hostData.options.length > 0 ? (
                hostData.options.map((opt: string) => (
                  <span
                    key={opt}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-xs font-mono"
                  >
                    {opt}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 font-mono">Default server capabilities</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Terminal & Logs */}
      {activeTab === 'terminal' && (
        <div className="space-y-4">
          <XtermTerminal
            streamUrl={`/api/service/logs/${encodeURIComponent(guid)}/${encodeURIComponent(host)}/${encodeURIComponent(service)}?mode=live`}
            title={`${serviceData?.name || service} - Live Stream & Console`}
            enableInput={true}
            onSendCommand={async (cmd) => {
              return api.sendServiceCommand(guid, host, service, cmd);
            }}
          />
        </div>
      )}

      {/* 3. Configurations */}
      {activeTab === 'configs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Service Settings</h3>
            <button
              type="button"
              onClick={() => setIsRawConfig(!isRawConfig)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-colors"
            >
              {isRawConfig ? 'Form View' : 'Raw JSON View'}
            </button>
          </div>

          {configsLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading configurations...</span>
            </div>
          ) : isRawConfig ? (
            <CodeMirrorEditor
              value={JSON.stringify(configForm, null, 2)}
              language="json"
              height="500px"
              onSave={async (content) => {
                try {
                  const parsed = JSON.parse(content);
                  await handleSaveConfigs(parsed);
                } catch (e: any) {
                  showToast('Invalid JSON format', 'error');
                }
              }}
            />
          ) : configs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 font-mono bg-white/[0.02] border border-white/10 rounded-2xl">
              No configurable options found for this game service.
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {configs.map((cfg) => {
                  const val = configForm[cfg.option];
                  const isBool = cfg.type === 'bool' || typeof val === 'boolean';

                  return (
                    <div key={cfg.option} className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
                      <label className="text-xs font-mono font-medium text-cyan-400 block truncate">
                        {cfg.option}
                      </label>
                      {cfg.help && (
                        <p className="text-[11px] text-slate-500 leading-tight line-clamp-2">
                          {cfg.help}
                        </p>
                      )}

                      {isBool ? (
                        <button
                          type="button"
                          onClick={() => {
                            setConfigForm({ ...configForm, [cfg.option]: !val });
                          }}
                          className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            val
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-white/10'
                          }`}
                        >
                          {val ? 'Enabled (True)' : 'Disabled (False)'}
                        </button>
                      ) : (
                        <input
                          type={cfg.type === 'int' ? 'number' : 'text'}
                          value={val ?? ''}
                          onChange={(e) => {
                            setConfigForm({ ...configForm, [cfg.option]: e.target.value });
                          }}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4 border-t border-white/10">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleSaveConfigs(configForm)}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-40"
                >
                  Save & Apply Settings
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Files */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          <FileManager
            host={host}
            initialPath={hostData?.path || '/root'}
          />
        </div>
      )}

      {/* 5. Backups */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-white">Application Backups</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Snapshot and restore your complete server world and configuration data.
              </p>
            </div>
            <button
              type="button"
              disabled={backupStreaming}
              onClick={handleTriggerBackup}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer disabled:opacity-40"
            >
              <Archive className="w-4 h-4" />
              <span>Create Backup Now</span>
            </button>
          </div>

          {backupStreaming && (
            <div className="p-4 rounded-xl bg-black border border-cyan-500/30 font-mono text-xs text-cyan-300 whitespace-pre-wrap max-h-48 overflow-auto">
              {backupOutput}
            </div>
          )}

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Available Backups ({backups.length})
            </h4>

            {backupsLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                Scanning backups...
              </div>
            ) : backups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                No backup archives found in backups directory.
              </div>
            ) : (
              <div className="space-y-2">
                {backups.map((b) => (
                  <div
                    key={b.path}
                    className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5 text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <Archive className="w-4 h-4 text-purple-400" />
                      <span className="text-slate-200">{b.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleRestoreBackup(b.name)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-sans font-medium transition-colors cursor-pointer"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Mods */}
      {activeTab === 'mods' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-2">Install New Mod</h3>
              <form onSubmit={handleInstallMod} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Steam Workshop ID (e.g. 123456789)"
                  value={newModId}
                  onChange={(e) => setNewModId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={!newModId.trim() || actionLoading}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Install
                </button>
              </form>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
              <h3 className="text-sm font-semibold text-white mb-2">Uninstall / Remove Mod</h3>
              <form onSubmit={handleRemoveMod} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Mod Identifier to remove"
                  value={removeModId}
                  onChange={(e) => setRemoveModId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
                />
                <button
                  type="submit"
                  disabled={!removeModId.trim() || actionLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Remove
                </button>
              </form>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Installed Mods & Output
            </h4>
            {modsLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                Querying mod status...
              </div>
            ) : (
              <pre className="p-4 rounded-xl bg-black border border-white/5 font-mono text-xs text-slate-300 whitespace-pre-wrap">
                {modsOutput}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* 7. Settings & Lifecycle */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Automated Boot Configuration */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Power className="w-4 h-4 text-emerald-400" /> Start on Host Reboot
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure whether this game service automatically starts when the host server reboots.
                </p>
              </div>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleToggleBoot}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 ${
                  serviceData?.enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{serviceData?.enabled ? 'Auto-Start: Enabled' : 'Auto-Start: Disabled'}</span>
              </button>
            </div>
          </div>

          {/* Application Updates */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-cyan-400" /> Game Updates & Maintenance
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Check if newer builds or updates are available from the game maintainer and stream the remote update.
              </p>
            </div>

            {updateStatus && (
              <div className={`p-3 rounded-xl text-xs font-mono border ${updateStatus.updates ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' : 'bg-black/30 border-white/10 text-slate-300'}`}>
                <span>{updateStatus.message}</span>
              </div>
            )}

            {updateStreaming && (
              <div className="p-4 rounded-xl bg-black border border-cyan-500/30 font-mono text-xs text-cyan-300 whitespace-pre-wrap max-h-56 overflow-auto">
                {updateLogs}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={updateLoading || updateStreaming}
                onClick={handleCheckUpdate}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
              >
                {updateLoading ? 'Checking...' : 'Check for Updates'}
              </button>
              <button
                type="button"
                disabled={updateStreaming}
                onClick={handleRunUpdate}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer disabled:opacity-40"
              >
                Update Game Now
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="p-5 rounded-2xl bg-rose-950/10 border border-rose-500/20 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Danger Zone
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Irreversible actions for this service instance and game installation.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-black/40 border border-rose-500/20">
              <div>
                <div className="text-xs font-semibold text-white">Remove Instance</div>
                <div className="text-[11px] text-slate-400">
                  Delete this specific instance "{service}". Other server instances on this host will remain intact.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Remove Instance
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-black/40 border border-rose-500/20">
              <div>
                <div className="text-xs font-semibold text-white">Uninstall Game Application</div>
                <div className="text-[11px] text-slate-400">
                  Completely uninstall the game server application from host {host}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUninstallModal(true)}
                className="px-4 py-2 rounded-xl bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Uninstall Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Instance Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-[#0e1320] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Confirm Removal</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove instance <strong className="font-mono text-white">{service}</strong>? This will delete the service instance definition while keeping other instances intact.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteInstance}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uninstall Application Modal */}
      {showUninstallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#0e1320] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Uninstall Application</h3>
            </div>

            {!uninstallStreaming ? (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This will completely uninstall the game application from host <strong className="font-mono text-white">{host}</strong>. All associated services and game server files will be purged.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowUninstallModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleUninstallApp}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Proceed with Uninstall
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-rose-300 font-medium">
                  <RefreshCw size={14} className="animate-spin text-rose-400" />
                  <span>Uninstalling application...</span>
                </div>
                <pre className="p-3.5 rounded-xl bg-black border border-rose-950 font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-56 overflow-auto">
                  {uninstallLogs}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
