import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ServiceData } from '../types';
import { Server, Play, Square, RefreshCw, Users, Cpu, HardDrive, LayoutGrid, ListFilter, AlertTriangle, ShieldCheck } from 'lucide-react';

interface DashboardViewProps {
  onSelectService?: (guid: string, host: string, service: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSelectService }) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: services = [], isLoading, isError } = useQuery<ServiceData[]>({
    queryKey: ['services'],
    queryFn: () => api.getServices(),
    refetchInterval: 5000,
  });

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

        {/* View Switcher Toolbar */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
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

      {/* Services List / Grid */}
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
    </div>
  );
};
