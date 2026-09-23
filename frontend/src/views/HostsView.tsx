import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { HostData } from '../types';
import {
  Server,
  Plus,
  Shield,
  Activity,
  RefreshCw,
  X,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Trash2,
} from 'lucide-react';

export const HostsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupCommand, setSetupCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hostToDelete, setHostToDelete] = useState<string | null>(null);

  const { data: hosts = [], isLoading } = useQuery<HostData[]>({
    queryKey: ['hosts'],
    queryFn: () => api.getHosts(),
  });

  const addHostMutation = useMutation({
    mutationFn: (ip: string) => api.addHost(ip),
    onSuccess: (res) => {
      if (res.success) {
        setIsAddModalOpen(false);
        setIpInput('');
        setErrorMsg(null);
        setSetupCommand(null);
        queryClient.invalidateQueries({ queryKey: ['hosts'] });
      } else {
        setErrorMsg(res.error || 'Failed to add host');
        if (res.setupCommand) {
          setSetupCommand(res.setupCommand);
        }
      }
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'An error occurred while connecting to the host');
    },
  });

  const deleteHostMutation = useMutation({
    mutationFn: (host: string) => api.deleteHost(host),
    onSuccess: () => {
      setHostToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['hosts'] });
    },
  });

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setIpInput('');
    setErrorMsg(null);
    setSetupCommand(null);
    setCopied(false);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
    setIpInput('');
    setErrorMsg(null);
    setSetupCommand(null);
    setCopied(false);
  };

  const handleAddHostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ipInput.trim() && !addHostMutation.isPending) {
      setErrorMsg(null);
      addHostMutation.mutate(ipInput.trim());
    }
  };

  const handleCopySetup = () => {
    if (setupCommand) {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(setupCommand);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/20 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Server className="text-indigo-400" />
            Server Hosts
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Manage SSH-connected physical and cloud servers in your cluster</p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="min-h-[44px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.3)]"
        >
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
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-sm inline-flex items-center gap-2 transition-colors cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.3)]"
          >
            <Plus size={16} /> Add Host
          </button>
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

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                  <button
                    type="button"
                    title={`Delete host ${host.ip}`}
                    onClick={() => setHostToDelete(host.ip)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
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

      {/* Add Host Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-indigo-900/40 bg-[#0e1320] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-900/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Server size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Add Server Host</h3>
                  <p className="text-xs text-slate-400">Connect a new server to your Warlock fleet</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddHostSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Hostname or IP Address
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. 192.168.1.100 or localhost"
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  disabled={addHostMutation.isPending}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-indigo-900/40 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Warlock connects via SSH as root (port 22) using your public key.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  {setupCommand && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-slate-300 text-[11px]">
                        Run the following command on the target host to authorize Warlock's SSH key, then click <strong>Retry Connection</strong>:
                      </p>
                      <div className="space-y-2">
                        <pre className="p-2.5 bg-black/70 border border-indigo-950/60 rounded-lg font-mono text-[11px] text-indigo-300 overflow-x-auto whitespace-pre-wrap break-all max-h-32">
                          {setupCommand}
                        </pre>
                        <button
                          type="button"
                          onClick={handleCopySetup}
                          className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          <span>{copied ? 'Copied to Clipboard' : 'Copy Setup Command'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-indigo-900/20">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  disabled={addHostMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!ipInput.trim() || addHostMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm flex items-center gap-2 disabled:opacity-40 transition-colors cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  {addHostMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Verifying Connection...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>{setupCommand ? 'Retry Connection' : 'Add Host'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Host Confirmation Modal */}
      {hostToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-rose-900/40 bg-[#0e1320] p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Remove Host</span>
            </h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to remove <span className="font-mono font-bold text-white">{hostToDelete}</span> from your fleet?
            </p>
            <div className="flex justify-end gap-2 text-xs pt-2">
              <button
                type="button"
                onClick={() => setHostToDelete(null)}
                disabled={deleteHostMutation.isPending}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteHostMutation.mutate(hostToDelete)}
                disabled={deleteHostMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {deleteHostMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                <span>Remove Host</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
