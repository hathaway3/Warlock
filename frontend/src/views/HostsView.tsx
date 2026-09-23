import React, { useState, useEffect, useRef } from 'react';
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
  Terminal,
  Cpu,
  ExternalLink,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';

interface HostsViewProps {
  onSelectHost?: (hostIp: string) => void;
  isAddModalOpen?: boolean;
  onOpenAddModal?: () => void;
  onCloseAddModal?: () => void;
}

export const HostsView: React.FC<HostsViewProps> = ({
  onSelectHost,
  isAddModalOpen: controlledAddOpen,
  onOpenAddModal,
  onCloseAddModal,
}) => {
  const queryClient = useQueryClient();
  const [internalAddModalOpen, setInternalAddModalOpen] = useState(false);
  const isAddModalOpen = controlledAddOpen !== undefined ? controlledAddOpen : internalAddModalOpen;
  const [activeAddTab, setActiveAddTab] = useState<'bootstrap' | 'proxmox' | 'manual'>('bootstrap');

  // Manual host state
  const [ipInput, setIpInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupCommand, setSetupCommand] = useState<string | null>(null);
  const [manualCopied, setManualCopied] = useState(false);
  const [hostToDelete, setHostToDelete] = useState<string | null>(null);

  // Bootstrap enrollment state
  const [enrollmentCommand, setEnrollmentCommand] = useState<string | null>(null);
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [bootstrapCopied, setBootstrapCopied] = useState(false);

  // Proxmox state
  const [proxmoxTab, setProxmoxTab] = useState<'community' | 'api'>('community');
  const [proxmoxCores, setProxmoxCores] = useState(2);
  const [proxmoxRam, setProxmoxRam] = useState(2048);
  const [proxmoxDisk, setProxmoxDisk] = useState(20);
  const [proxmoxBridge, setProxmoxBridge] = useState('vmbr0');
  const [proxmoxScriptCopied, setProxmoxScriptCopied] = useState(false);

  // Proxmox direct API state
  const [pveHost, setPveHost] = useState('');
  const [pveUser, setPveUser] = useState('root@pam');
  const [pveTokenId, setPveTokenId] = useState('warlock');
  const [pveSecret, setPveSecret] = useState('');
  const [pveNodes, setPveNodes] = useState<any[]>([]);
  const [pveSelectedNode, setPveSelectedNode] = useState('');
  const [pveSelectedStorage, setPveSelectedStorage] = useState('');
  const [pveCtHostname, setPveCtHostname] = useState('warlock-game-node');
  const [pveTesting, setPveTesting] = useState(false);
  const [pveProvisioning, setPveProvisioning] = useState(false);
  const [pveStatus, setPveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-detection notification
  const [newHostEnrolledNotice, setNewHostEnrolledNotice] = useState<string | null>(null);

  const { data: hosts = [], isLoading } = useQuery<HostData[]>({
    queryKey: ['hosts'],
    queryFn: () => api.getHosts(),
    refetchInterval: isAddModalOpen ? 3000 : false,
  });

  const prevHostCountRef = useRef(hosts.length);
  useEffect(() => {
    if (isAddModalOpen && hosts.length > prevHostCountRef.current) {
      setNewHostEnrolledNotice('A new host was detected and enrolled into your fleet!');
      const timer = setTimeout(() => {
        setNewHostEnrolledNotice(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    prevHostCountRef.current = hosts.length;
  }, [hosts.length, isAddModalOpen]);

  const addHostMutation = useMutation({
    mutationFn: (ip: string) => api.addHost(ip),
    onSuccess: (res) => {
      if (res.success) {
        handleCloseAddModal();
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

  const fetchEnrollmentToken = async () => {
    setEnrollmentLoading(true);
    setEnrollmentError(null);
    try {
      const res = await api.getEnrollmentToken();
      if (res.success && (res.command || (res as any).bootstrapCommand)) {
        setEnrollmentCommand(res.command || (res as any).bootstrapCommand || null);
      } else {
        setEnrollmentError(res.error || 'Failed to generate bootstrap command');
      }
    } catch (err: any) {
      setEnrollmentError(err.message || 'Failed to connect to Warlock API to generate token');
    } finally {
      setEnrollmentLoading(false);
    }
  };

  useEffect(() => {
    if (controlledAddOpen && !enrollmentCommand && !enrollmentLoading) {
      fetchEnrollmentToken();
    }
  }, [controlledAddOpen]);

  const handleOpenAddModal = () => {
    setInternalAddModalOpen(true);
    onOpenAddModal?.();
    setActiveAddTab('bootstrap');
    setIpInput('');
    setErrorMsg(null);
    setSetupCommand(null);
    setManualCopied(false);
    setBootstrapCopied(false);
    setProxmoxScriptCopied(false);
    setPveStatus(null);
    fetchEnrollmentToken();
  };

  const handleCloseAddModal = () => {
    setInternalAddModalOpen(false);
    onCloseAddModal?.();
    setIpInput('');
    setErrorMsg(null);
    setSetupCommand(null);
    setManualCopied(false);
    setNewHostEnrolledNotice(null);
  };

  const handleAddHostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ipInput.trim() && !addHostMutation.isPending) {
      setErrorMsg(null);
      addHostMutation.mutate(ipInput.trim());
    }
  };

  const handleCopy = (text: string, setCopiedFn: (val: boolean) => void) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedFn(true);
    setTimeout(() => setCopiedFn(false), 2000);
  };

  // Test Proxmox connection and fetch nodes
  const handlePveConnect = async () => {
    if (!pveHost.trim() || !pveSecret.trim()) {
      setPveStatus({ type: 'error', message: 'Host URL and API token secret are required.' });
      return;
    }
    setPveTesting(true);
    setPveStatus(null);
    try {
      const res = await api.getProxmoxNodes({
        host: pveHost.trim(),
        tokenUser: pveUser.trim(),
        tokenId: pveTokenId.trim(),
        tokenSecret: pveSecret.trim(),
        rejectUnauthorized: false,
      });

      if (res.success && res.nodes && res.nodes.length > 0) {
        setPveNodes(res.nodes);
        const firstNode = res.nodes[0];
        setPveSelectedNode(firstNode.node);
        const storages = firstNode.storages || [];
        if (storages.length > 0) {
          setPveSelectedStorage(storages[0].storage);
        } else {
          setPveSelectedStorage('local-lvm');
        }
        setPveStatus({ type: 'success', message: `Connected to Proxmox VE! Discovered ${res.nodes.length} node(s).` });
      } else {
        setPveStatus({ type: 'error', message: res.error || 'Connected to Proxmox VE, but no nodes were returned.' });
      }
    } catch (err: any) {
      setPveStatus({ type: 'error', message: err.message || 'Failed to connect to Proxmox VE.' });
    } finally {
      setPveTesting(false);
    }
  };

  // Provision container via Proxmox API
  const handlePveProvision = async () => {
    if (!pveSelectedNode) {
      setPveStatus({ type: 'error', message: 'Please select a target Proxmox node.' });
      return;
    }
    setPveProvisioning(true);
    setPveStatus(null);
    try {
      const res = await api.provisionProxmoxLxc({
        host: pveHost.trim(),
        tokenUser: pveUser.trim(),
        tokenId: pveTokenId.trim(),
        tokenSecret: pveSecret.trim(),
        node: pveSelectedNode,
        hostname: pveCtHostname.trim() || 'warlock-game-node',
        storage: pveSelectedStorage || 'local-lvm',
        cores: proxmoxCores,
        memory: proxmoxRam,
        disk: proxmoxDisk,
        bridge: proxmoxBridge,
        rejectUnauthorized: false,
      });

      if (res.success) {
        setPveStatus({
          type: 'success',
          message: res.message || `Debian container (${res.vmid}) creation started. Warlock SSH keys injected.`,
        });
        queryClient.invalidateQueries({ queryKey: ['hosts'] });
      } else {
        setPveStatus({ type: 'error', message: res.error || 'Failed to provision container on Proxmox VE.' });
      }
    } catch (err: any) {
      setPveStatus({ type: 'error', message: err.message || 'Error during container provisioning.' });
    } finally {
      setPveProvisioning(false);
    }
  };

  const communityScriptCmd = `bash -c "$(wget -qLO - https://github.com/community-scripts/proxbash/raw/main/ct/debian.sh)"`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/20 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Server className="text-indigo-400" />
            Server Hosts
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">Manage SSH-connected physical, cloud, and virtual servers in your cluster</p>
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
            Click "Add Host" to connect a Linux server or deploy a new Debian host on Proxmox VE.
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
                  <div
                    className={onSelectHost ? 'cursor-pointer group' : ''}
                    onClick={() => onSelectHost && onSelectHost(host.ip)}
                  >
                    <h3 className="font-bold text-white text-base font-mono group-hover:text-cyan-400 transition-colors">{host.ip}</h3>
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

              {onSelectHost && (
                <div className="pt-3 mt-3 border-t border-indigo-950/40 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onSelectHost(host.ip)}
                    className="px-3 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Manage Host
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Host Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-indigo-900/40 bg-[#0e1320] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-indigo-900/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Server size={18} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Add Server Host</h3>
                  <p className="text-xs text-slate-400">Enroll or deploy a Linux host into your Warlock fleet</p>
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

            {/* Live Enrollment Notification */}
            {newHostEnrolledNotice && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-xs text-emerald-300 animate-fade-in">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span className="font-medium">{newHostEnrolledNotice}</span>
              </div>
            )}

            {/* Modal Tabs */}
            <div className="flex border-b border-indigo-900/30 gap-2 pb-2">
              <button
                type="button"
                onClick={() => setActiveAddTab('bootstrap')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeAddTab === 'bootstrap'
                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Terminal size={14} />
                <span>One-Line Bootstrap</span>
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold uppercase tracking-wider flex items-center gap-0.5">
                  <Sparkles size={10} /> Fast
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAddTab('proxmox')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeAddTab === 'proxmox'
                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Cpu size={14} />
                <span>Proxmox VE</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveAddTab('manual')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeAddTab === 'manual'
                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Server size={14} />
                <span>Manual IP / SSH</span>
              </button>
            </div>

            {/* Tab 1: One-Line Bootstrap */}
            {activeAddTab === 'bootstrap' && (
              <div className="space-y-4 pt-1">
                <div>
                  <h4 className="text-sm font-semibold text-white">Automated One-Line Enrollment</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Run this command on your remote Linux host (Ubuntu, Debian, CentOS, Arch, etc.) as root or with sudo.
                    It configures SSH authentication and immediately registers the host back with Warlock.
                  </p>
                </div>

                {enrollmentLoading ? (
                  <div className="p-8 bg-black/40 border border-indigo-900/30 rounded-xl text-center space-y-2">
                    <Loader2 size={24} className="animate-spin text-indigo-400 mx-auto" />
                    <p className="text-xs text-slate-400">Generating secure one-time enrollment token...</p>
                  </div>
                ) : enrollmentError ? (
                  <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-rose-400 font-semibold">
                      <AlertTriangle size={15} className="shrink-0" />
                      <span>{enrollmentError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={fetchEnrollmentToken}
                      className="px-3 py-1.5 bg-rose-900/50 hover:bg-rose-900/70 text-rose-200 border border-rose-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw size={13} />
                      <span>Retry Generating Token</span>
                    </button>
                  </div>
                ) : enrollmentCommand ? (
                  <div className="space-y-3">
                    <div className="relative group">
                      <pre className="p-3.5 bg-black/80 border border-indigo-900/50 rounded-xl font-mono text-xs text-indigo-300 overflow-x-auto whitespace-pre-wrap break-all select-all">
                        {enrollmentCommand}
                      </pre>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(enrollmentCommand, setBootstrapCopied)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                      >
                        {bootstrapCopied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                        <span>{bootstrapCopied ? 'Copied to Clipboard!' : 'Copy Bootstrap Command'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={fetchEnrollmentToken}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                        title="Generate a fresh token"
                      >
                        <RefreshCw size={13} />
                        <span>Refresh Token</span>
                      </button>
                    </div>

                    {/* Live Listening Status */}
                    <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-xl flex items-center gap-2.5 text-xs text-slate-300">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                      </span>
                      <span>
                        Waiting for host connection... The host list updates automatically when the script finishes.
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Tab 2: Proxmox VE */}
            {activeAddTab === 'proxmox' && (
              <div className="space-y-4 pt-1">
                <div>
                  <h4 className="text-sm font-semibold text-white">Proxmox VE Provisioning & Integration</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Spin up a clean Debian 12 container on Proxmox VE via Community Scripts or direct Proxmox REST API.
                  </p>
                </div>

                {/* Sub-tab buttons */}
                <div className="flex gap-2 p-1 bg-black/40 rounded-lg border border-indigo-950/60 w-fit">
                  <button
                    type="button"
                    onClick={() => setProxmoxTab('community')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      proxmoxTab === 'community'
                        ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Community Script (LXC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProxmoxTab('api')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      proxmoxTab === 'api'
                        ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Proxmox VE API (Automated)
                  </button>
                </div>

                {/* Community Scripts Helper */}
                {proxmoxTab === 'community' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Proxmox Node Shell Command:</span>
                      <a
                        href="https://community-scripts.org/scripts/debian"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
                      >
                        <span>community-scripts.org/scripts/debian</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>

                    <pre className="p-3 bg-black/80 border border-indigo-900/50 rounded-xl font-mono text-xs text-indigo-300 overflow-x-auto whitespace-pre-wrap break-all select-all">
                      {communityScriptCmd}
                    </pre>

                    <button
                      type="button"
                      onClick={() => handleCopy(communityScriptCmd, setProxmoxScriptCopied)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-[0_0_10px_rgba(99,102,241,0.25)]"
                    >
                      {proxmoxScriptCopied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                      <span>{proxmoxScriptCopied ? 'Copied to Clipboard!' : 'Copy Proxmox Shell Command'}</span>
                    </button>

                    <div className="p-3 bg-indigo-950/20 border border-indigo-900/40 rounded-xl text-xs space-y-1.5 text-slate-300">
                      <p className="font-semibold text-indigo-300">How it works:</p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-400">
                        <li>Open your <strong>Proxmox VE web GUI</strong> and select your node's <strong>Shell</strong>.</li>
                        <li>Paste and run the command above to launch the interactive Debian 12 LXC builder.</li>
                        <li>Once the Debian container boots, open its console and run the <strong>One-Line Bootstrap</strong> command to enroll it.</li>
                      </ol>
                    </div>
                  </div>
                )}

                {/* Direct Proxmox API */}
                {proxmoxTab === 'api' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          Proxmox Host URL
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. https://192.168.1.50:8006"
                          value={pveHost}
                          onChange={(e) => setPveHost(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          API Token User
                        </label>
                        <input
                          type="text"
                          placeholder="root@pam"
                          value={pveUser}
                          onChange={(e) => setPveUser(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          API Token ID
                        </label>
                        <input
                          type="text"
                          placeholder="warlock"
                          value={pveTokenId}
                          onChange={(e) => setPveTokenId(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          API Token Secret
                        </label>
                        <input
                          type="password"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={pveSecret}
                          onChange={(e) => setPveSecret(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePveConnect}
                        disabled={pveTesting || !pveHost.trim() || !pveSecret.trim()}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-colors cursor-pointer"
                      >
                        {pveTesting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        <span>{pveTesting ? 'Connecting...' : 'Connect & Discover Nodes'}</span>
                      </button>
                    </div>

                    {pveStatus && (
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                          pveStatus.type === 'success'
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {pveStatus.type === 'success' ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
                        <span>{pveStatus.message}</span>
                      </div>
                    )}

                    {/* Discovered Cluster Nodes and Provision Form */}
                    {pveNodes.length > 0 && (
                      <div className="p-3.5 bg-black/50 border border-indigo-900/40 rounded-xl space-y-3 pt-3">
                        <div className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                          <Layers size={14} />
                          <span>Container Configuration</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Target Node
                            </label>
                            <select
                              value={pveSelectedNode}
                              onChange={(e) => {
                                setPveSelectedNode(e.target.value);
                                const foundNode = pveNodes.find((n) => n.node === e.target.value);
                                if (foundNode && foundNode.storages?.length > 0) {
                                  setPveSelectedStorage(foundNode.storages[0].storage);
                                }
                              }}
                              className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500"
                            >
                              {pveNodes.map((n) => (
                                <option key={n.node} value={n.node}>
                                  {n.node} ({n.status || 'online'})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Container Hostname
                            </label>
                            <input
                              type="text"
                              value={pveCtHostname}
                              onChange={(e) => setPveCtHostname(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Storage Pool
                            </label>
                            {pveNodes.find((n) => n.node === pveSelectedNode)?.storages?.length ? (
                              <select
                                value={pveSelectedStorage}
                                onChange={(e) => setPveSelectedStorage(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500"
                              >
                                {pveNodes
                                  .find((n) => n.node === pveSelectedNode)
                                  ?.storages.map((s: any) => (
                                    <option key={s.storage} value={s.storage}>
                                      {s.storage} ({s.type})
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={pveSelectedStorage}
                                onChange={(e) => setPveSelectedStorage(e.target.value)}
                                placeholder="local-lvm"
                                className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                              />
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Cores / RAM (MB)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min={1}
                                max={64}
                                value={proxmoxCores}
                                onChange={(e) => setProxmoxCores(Number(e.target.value))}
                                className="w-1/2 px-3 py-1.5 rounded-lg bg-black/60 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                              <input
                                type="number"
                                min={512}
                                step={512}
                                value={proxmoxRam}
                                onChange={(e) => setProxmoxRam(Number(e.target.value))}
                                className="w-1/2 px-3 py-1.5 rounded-lg bg-black/60 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Disk (GB) / Bridge Network
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min={5}
                                max={1000}
                                value={proxmoxDisk}
                                onChange={(e) => setProxmoxDisk(Number(e.target.value))}
                                className="w-1/2 px-3 py-1.5 rounded-lg bg-black/60 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500"
                                placeholder="Disk (GB)"
                              />
                              <input
                                type="text"
                                value={proxmoxBridge}
                                onChange={(e) => setProxmoxBridge(e.target.value)}
                                className="w-1/2 px-3 py-1.5 rounded-lg bg-black/60 border border-indigo-900/40 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                placeholder="vmbr0"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={handlePveProvision}
                            disabled={pveProvisioning}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 disabled:opacity-40 transition-colors cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.3)]"
                          >
                            {pveProvisioning ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            <span>{pveProvisioning ? 'Creating Debian Container...' : 'Provision Debian 12 LXC'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Manual IP */}
            {activeAddTab === 'manual' && (
              <form onSubmit={handleAddHostSubmit} className="space-y-4 pt-1">
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
                            onClick={() => handleCopy(setupCommand, setManualCopied)}
                            className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {manualCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            <span>{manualCopied ? 'Copied to Clipboard' : 'Copy Setup Command'}</span>
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
            )}

            {/* Footer close button for non-manual tabs */}
            {activeAddTab !== 'manual' && (
              <div className="flex items-center justify-end pt-3 border-t border-indigo-900/20">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            )}
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
