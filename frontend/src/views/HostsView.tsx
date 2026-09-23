import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { HostData } from '../types';
import { Server, Plus, Shield, Activity, RefreshCw } from 'lucide-react';

export const HostsView: React.FC = () => {
  const { data: hosts = [], isLoading } = useQuery<HostData[]>({
    queryKey: ['hosts'],
    queryFn: () => api.getHosts(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/20 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Server className="text-indigo-400" />
            Server Hosts
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Manage SSH-connected physical and cloud servers in your cluster</p>
        </div>

        <button className="min-h-[44px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.3)]">
          <Plus size={16} /> Add Host
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="animate-spin text-indigo-400" size={32} />
          <span>Loading managed hosts...</span>
        </div>
      ) : hosts.length === 0 ? (
        <div className="p-12 bg-[#12141c]/40 border border-dashed border-indigo-900/30 rounded-2xl text-center">
          <Server className="mx-auto text-slate-500 mb-3" size={40} />
          <h3 className="text-lg font-semibold text-slate-200">No Hosts Configured</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
            Click "Add Host" to connect a Linux server via SSH to your fleet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hosts.map((host) => (
            <div
              key={host.id || host.ip}
              className="bg-[#12141c]/90 border border-indigo-900/25 rounded-xl p-5 hover:border-indigo-500/40 transition-all duration-200 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Server size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base font-mono">{host.ip}</h3>
                    <span className="text-xs text-slate-400">{host.os || 'Linux'}</span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-black/30 rounded-lg border border-indigo-950/40 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
                    <Activity size={12} /> Status
                  </span>
                  <div className="font-semibold text-slate-200 mt-0.5">Connected</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase flex items-center gap-1">
                    <Shield size={12} /> Firewall
                  </span>
                  <div className="font-semibold text-emerald-400 mt-0.5">Configured</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
