import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ServiceData, AppData, HostData } from '../types';
import {
  Server,
  Play,
  Square,
  RefreshCw,
  Users,
  Cpu,
  HardDrive,
  LayoutGrid,
  ListFilter,
  AlertTriangle,
  ShieldCheck,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';

interface DashboardViewProps {
  onSelectService?: (guid: string, host: string, service: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectService }) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [selectedAppGuid, setSelectedAppGuid] = useState('');
  const [selectedHostIp, setSelectedHostIp] = useState('');
  const [installOptions, setInstallOptions] = useState('');
  const [installLogs, setInstallLogs] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installFinished, setInstallFinished] = useState(false);

  const { data: services = [], isLoading, isError } = useQuery<ServiceData[]>({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    refetchInterval: 5000,
  });

  const { data: applications = [] } = useQuery<AppData[]>({
    queryKey: ['all_applications'],
    queryFn: () => api.getApplications(),
    enabled: isInstallModalOpen,
  });

  const { data: hosts = [] } = useQuery<HostData[]>({
    queryKey: ['hosts'],
    queryFn: () => api.getHosts(),
    enabled: isInstallModalOpen,
  });

  const handleStartInstall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppGuid || !selectedHostIp) return;

    setIsInstalling(true);
    setInstallFinished(false);
    setInstallLogs(`Starting installation of application on host ${selectedHostIp}...\n`);

    try {
      const opts = installOptions
        .split(' ')
        .map((s) => s.trim())
        .filter(Boolean);

      const response = await api.installApplication(selectedAppGuid, selectedHostIp, opts);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setInstallLogs((prev) => prev + chunk);
        }
      }
      setInstallLogs((prev) => prev + '\n✓ Installation completed!\n');
      setInstallFinished(true);
      queryClient.invalidateQueries({ queryKey: ['services'] });
    } catch (err: any) {
      setInstallLogs((prev) => prev + `\n✖ Error during installation: ${err.message || String(err)}\n`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleCloseInstallModal = () => {
    if (isInstalling) return;
    setIsInstallModalOpen(false);
    setSelectedAppGuid('');
    setSelectedHostIp('');
    setInstallOptions('');
    setInstallLogs('');
    setInstallFinished(false);
  };

  const controlMutation = useMutation({
    mutationFn: ({ guid, host, service, action, force }: { guid: string; host: string; service: string; action: string; force?: boolean }) =>
      api.controlService(guid, host, service, action, force),
    onMutate: async ({ host, service, action }) => {
      // Optimistic UI update
      await queryClient.cancelQueries({ queryKey: ['services'] });
      const prevServices = queryClient.getQueryData<ServiceData[]>(['services']) || [];
      queryClient.setQueryData<ServiceData[]>(['services'], (old = []) =>
        old.map((s) => {
          if (s.host === host && s.service === service) {
            let nextStatus: ServiceData['status'] = s.status;
            if (action === 'start') nextStatus = 'starting';
            if (action === 'stop' || action === 'force-stop') nextStatus = 'stopping';
            return { ...s, status: nextStatus };
          }
          return s;
        })
      );
      return { prevServices };
    },
    onError: (err, _vars, context) => {
      if (context?.prevServices) {
        queryClient.setQueryData(['services'], context.prevServices);
      }
      setActionError(String(err));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const totalPlayers = services.reduce((acc, s) => acc + (s.player_count || 0), 0);
  const runningCount = services.filter((s) => s.status === 'running').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/20 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Server className="text-indigo-400" />
            Fleet Services
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Manage and monitor all game servers across your infrastructure</p>
        </div>

        {/* View Switcher Toolbar & Install CTA */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="hidden sm:flex bg-[#12141c] border border-indigo-900/30 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'cards' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid size={14} />
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListFilter size={14} />
              Table
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsInstallModalOpen(true)}
            className="min-h-[38px] px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
          >
            <Plus size={15} />
            <span>Install Game</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#12141c]/80 border border-indigo-900/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Services</span>
            <div className="text-2xl font-bold text-white mt-1">{services.length}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Server size={20} />
          </div>
        </div>

        <div className="bg-[#12141c]/80 border border-indigo-900/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Online</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{runningCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck size={20} />
          </div>
        </div>

        <div className="bg-[#12141c]/80 border border-indigo-900/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Players</span>
            <div className="text-2xl font-bold text-sky-400 mt-1">{totalPlayers}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-[#12141c]/80 border border-indigo-900/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Stopped</span>
            <div className="text-2xl font-bold text-slate-400 mt-1">{services.length - runningCount}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-center justify-center text-slate-400">
            <Square size={20} />
          </div>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-950/40 border border-red-800/50 rounded-lg text-sm text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-xs text-red-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Services List / Grid / Table */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="animate-spin text-indigo-400" size={32} />
          <span>Loading fleet services...</span>
        </div>
      ) : isError || services.length === 0 ? (
        <div className="p-12 bg-[#12141c]/40 border border-dashed border-indigo-900/30 rounded-2xl text-center">
          <Server className="mx-auto text-slate-500 mb-3" size={40} />
          <h3 className="text-lg font-semibold text-slate-200">No Services Found</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Install game server applications on your managed hosts to manage them from this dashboard.
          </p>
          <button
            type="button"
            onClick={() => setIsInstallModalOpen(true)}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-medium rounded-lg text-xs inline-flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
          >
            <Plus size={15} />
            <span>Install Game Application</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-[#12141c]/90 border border-indigo-900/30 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-indigo-900/30 text-slate-400 bg-black/30">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Server Name</th>
                  <th className="py-3 px-4">Host</th>
                  <th className="py-3 px-4">Port</th>
                  <th className="py-3 px-4">Players</th>
                  <th className="py-3 px-4">CPU / RAM</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-950/40">
                {services.map((svc) => {
                  const isRunning = svc.status === 'running';
                  const isStarting = svc.status === 'starting';
                  const isStopping = svc.status === 'stopping';

                  return (
                    <tr key={`${svc.host}-${svc.service}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                            isRunning
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isStarting
                              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 animate-pulse'
                              : isStopping
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isRunning ? 'bg-emerald-400' : isStarting ? 'bg-sky-400' : isStopping ? 'bg-amber-400' : 'bg-slate-500'
                            }`}
                          />
                          {svc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        <button
                          type="button"
                          onClick={() => onSelectService && onSelectService(svc.guid, svc.host, svc.service)}
                          className="hover:text-cyan-400 transition-colors text-left cursor-pointer"
                        >
                          {svc.name}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{svc.host}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{svc.port || 'Default'}</td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="flex items-center gap-1">
                          <Users size={12} className="text-slate-400" />
                          {svc.player_count ?? 0} / {svc.max_players || '∞'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {svc.cpu_usage ? `${svc.cpu_usage}%` : '--'} / {svc.memory_usage ? `${svc.memory_usage}MB` : '--'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isRunning ? (
                            <button
                              disabled={isStarting}
                              onClick={() => controlMutation.mutate({ guid: svc.guid, host: svc.host, service: svc.service, action: 'start' })}
                              title="Start Server"
                              className="p-1.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Play size={14} />
                            </button>
                          ) : (
                            <>
                              <button
                                disabled={isStopping}
                                onClick={() => controlMutation.mutate({ guid: svc.guid, host: svc.host, service: svc.service, action: 'stop' })}
                                title="Stop Server"
                                className="p-1.5 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Square size={14} />
                              </button>
                              <button
                                onClick={() => controlMutation.mutate({ guid: svc.guid, host: svc.host, service: svc.service, action: 'force-stop', force: true })}
                                title="Force Stop Immediately"
                                className="px-1.5 py-0.5 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-[10px] font-mono transition-colors cursor-pointer"
                              >
                                Force
                              </button>
                              <button
                                onClick={() => controlMutation.mutate({ guid: svc.guid, host: svc.host, service: svc.service, action: 'restart' })}
                                title="Restart Server"
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                              >
                                <RefreshCw size={14} />
                              </button>
                            </>
                          )}
                          {onSelectService && (
                            <button
                              onClick={() => onSelectService(svc.guid, svc.host, svc.service)}
                              className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors cursor-pointer"
                            >
                              Manage
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => {
            const isRunning = svc.status === 'running';
            const isStarting = svc.status === 'starting';
            const isStopping = svc.status === 'stopping';

            return (
              <div
                key={`${svc.host}-${svc.service}`}
                className="bg-[#12141c]/90 border border-indigo-900/25 rounded-xl p-5 hover:border-indigo-500/40 transition-all duration-200 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Name + Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className={onSelectService ? 'cursor-pointer group/title' : ''}
                      onClick={() => onSelectService && onSelectService(svc.guid, svc.host, svc.service)}
                    >
                      <h3 className="font-bold text-white text-base tracking-wide group-hover/title:text-cyan-400 transition-colors">
                        {svc.name}
                      </h3>
                      <span className="text-xs text-slate-400 font-mono">{svc.host}</span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                        isRunning
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : isStarting
                          ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 animate-pulse'
                          : isStopping
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isRunning ? 'bg-emerald-400' : isStarting ? 'bg-sky-400' : isStopping ? 'bg-amber-400' : 'bg-slate-500'
                        }`}
                      />
                      {svc.status}
                    </span>
                  </div>

                  {/* Resource Chips */}
                  <div className="grid grid-cols-3 gap-2 my-4 p-2.5 bg-black/30 rounded-lg border border-indigo-950/40 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
                        <Users size={12} /> Players
                      </span>
                      <div className="font-semibold text-slate-200 mt-0.5">
                        {svc.player_count ?? 0} / {svc.max_players || '∞'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
                        <Cpu size={12} /> CPU
                      </span>
                      <div className="font-semibold text-slate-200 mt-0.5">{svc.cpu_usage ? `${svc.cpu_usage}%` : 'N/A'}</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
                        <HardDrive size={12} /> RAM
                      </span>
                      <div className="font-semibold text-slate-200 mt-0.5">{svc.memory_usage ? `${svc.memory_usage} MB` : 'N/A'}</div>
                    </div>
                  </div>
                </div>

                {/* Action Toolbar (Minimum 48px touch targets on mobile) */}
                <div className="flex items-center gap-2 pt-3 border-t border-indigo-950/40">
                  {!isRunning ? (
                    <button
                      disabled={isStarting}
                      onClick={() => controlMutation.mutate({ guid: svc.guid, host: svc.host, service: svc.service, action: 'start' })}
                      className="flex-1 min-h-[44px] bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Play size={14} /> Start
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={isStopping}
                        onClick={() => controlMutation.mutate({ guid: svc.guid, host: svc.host, service: svc.service, action: 'stop' })}
                        className="flex-1 min-h-[44px] bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Square size={14} /> Stop
                      </button>
                      <button
                        title="Force Halt Service Immediately (Issue #31)"
                        onClick={() => controlMutation.mutate({ guid: svc.guid, host: svc.host, service: svc.service, action: 'force-stop', force: true })}
                        className="min-h-[44px] px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 font-medium rounded-lg text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        Force
                      </button>
                      <button
                        onClick={() => controlMutation.mutate({ guid: svc.guid, host: svc.host, service: svc.service, action: 'restart' })}
                        className="min-h-[44px] px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </>
                  )}
                  {onSelectService && (
                    <button
                      onClick={() => onSelectService(svc.guid, svc.host, svc.service)}
                      title="Open Service Controls & Details"
                      className="min-h-[44px] px-3 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-medium rounded-lg text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Install Game Application Modal */}
      {isInstallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-indigo-900/40 bg-[#0e1320] p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-indigo-900/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Server size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Install Game Server</h3>
                  <p className="text-xs text-slate-400">Deploy a dedicated game application onto a cluster host</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isInstalling}
                onClick={handleCloseInstallModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            {!isInstalling && !installFinished ? (
              <form onSubmit={handleStartInstall} className="space-y-4 overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Select Game Application</label>
                  <select
                    value={selectedAppGuid}
                    onChange={(e) => setSelectedAppGuid(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#080a10] border border-indigo-900/40 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="" disabled>-- Select a game application --</option>
                    {applications.map((app) => (
                      <option key={app.guid} value={app.guid}>
                        {app.title} {app.category ? `(${app.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Select Target Host</label>
                  <select
                    value={selectedHostIp}
                    onChange={(e) => setSelectedHostIp(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#080a10] border border-indigo-900/40 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value="" disabled>-- Select target server host --</option>
                    {hosts.map((h) => (
                      <option key={h.id || h.ip} value={h.ip}>
                        {h.ip} ({h.os || 'Linux'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Installation Flags & Options <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. --branch=main or custom flags"
                    value={installOptions}
                    onChange={(e) => setInstallOptions(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#080a10] border border-indigo-900/40 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="pt-3 border-t border-indigo-900/30 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseInstallModal}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedAppGuid || !selectedHostIp}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-40"
                  >
                    Begin Installation
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-cyan-300 font-medium">
                    {isInstalling ? (
                      <>
                        <RefreshCw size={14} className="animate-spin text-cyan-400" />
                        <span>Running remote installer...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} className="text-emerald-400" />
                        <span className="text-emerald-300">Installation finished!</span>
                      </>
                    )}
                  </span>
                </div>

                <pre className="flex-1 p-4 rounded-xl bg-black border border-indigo-950 font-mono text-xs text-slate-300 whitespace-pre-wrap overflow-y-auto max-h-[50vh]">
                  {installLogs}
                </pre>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={isInstalling}
                    onClick={handleCloseInstallModal}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {installFinished ? 'Done' : 'Close'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
