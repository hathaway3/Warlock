import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { FileManager } from '../components/files/FileManager';
import {
  ArrowLeft,
  Server,
  Shield,
  Clock,
  HardDrive,
  Activity,
  Cpu,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Power,
  Key,
} from 'lucide-react';

interface HostDetailsViewProps {
  host: string;
  initialTab?: HostTab;
  onTabChange?: (tab: HostTab) => void;
  onBack: () => void;
}

type HostTab = 'overview' | 'firewall' | 'cron' | 'files';

export const HostDetailsView: React.FC<HostDetailsViewProps> = ({
  host,
  initialTab,
  onTabChange,
  onBack,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<HostTab>(initialTab || 'overview');

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleSwitchTab = (tab: HostTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };
  const [timeframe, setTimeframe] = useState('day');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Firewall form state
  const [showAddRuleModal, setShowAddRuleModal] = useState(false);
  const [ruleTo, setRuleTo] = useState('');
  const [ruleFrom, setRuleFrom] = useState('');
  const [ruleProto, setRuleProto] = useState('tcp');
  const [ruleAction, setRuleAction] = useState('ALLOW');
  const [ruleComment, setRuleComment] = useState('');

  // Cron form state
  const [showAddCronModal, setShowAddCronModal] = useState(false);
  const [cronSchedule, setCronSchedule] = useState('0 4 * * *');
  const [cronCommand, setCronCommand] = useState('');
  const [cronIdentifier, setCronIdentifier] = useState('');

  // SSH key state
  const [showSshKeyModal, setShowSshKeyModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Queries
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ['host_metrics', host, timeframe],
    queryFn: () => api.getHostMetrics(host, timeframe),
    enabled: activeTab === 'overview',
  });

  const { data: firewallData, isLoading: firewallLoading } = useQuery({
    queryKey: ['host_firewall', host],
    queryFn: () => api.getFirewall(host),
    enabled: activeTab === 'firewall',
  });

  const { data: cronData, isLoading: cronLoading } = useQuery({
    queryKey: ['host_cron', host],
    queryFn: () => api.getCronJobs(host),
    enabled: activeTab === 'cron',
  });

  const { data: sshKeyData } = useQuery({
    queryKey: ['host_ssh_key'],
    queryFn: () => api.getHostSshKey(),
    enabled: showSshKeyModal,
  });

  // Mutations
  const toggleFirewallMutation = useMutation({
    mutationFn: (action: 'enable' | 'disable') => api.setFirewallStatus(host, action),
    onSuccess: (res) => {
      if (res.success) {
        showToast('Firewall status updated!');
        queryClient.invalidateQueries({ queryKey: ['host_firewall', host] });
      } else {
        showToast(res.error || 'Failed to update firewall', 'error');
      }
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: (rule: { to: string; from?: string; proto?: string; action: string; comment?: string }) =>
      api.addFirewallRule(host, rule),
    onSuccess: (res) => {
      if (res.success) {
        showToast('Firewall rule added!');
        setShowAddRuleModal(false);
        setRuleTo('');
        setRuleFrom('');
        setRuleComment('');
        queryClient.invalidateQueries({ queryKey: ['host_firewall', host] });
      } else {
        showToast(res.error || 'Failed to add rule', 'error');
      }
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (rule: any) => api.deleteFirewallRule(host, rule),
    onSuccess: (res) => {
      if (res.success) {
        showToast('Rule deleted!');
        queryClient.invalidateQueries({ queryKey: ['host_firewall', host] });
      } else {
        showToast(res.error || 'Failed to delete rule', 'error');
      }
    },
  });

  const addCronMutation = useMutation({
    mutationFn: (job: { schedule: string; command: string; identifier?: string }) =>
      api.addCronJob(host, job),
    onSuccess: (res) => {
      if (res.success) {
        showToast('Cron task created!');
        setShowAddCronModal(false);
        setCronCommand('');
        setCronIdentifier('');
        queryClient.invalidateQueries({ queryKey: ['host_cron', host] });
      } else {
        showToast(res.error || 'Failed to save cron task', 'error');
      }
    },
  });

  const deleteCronMutation = useMutation({
    mutationFn: (identifier: string) => api.deleteCronJob(host, identifier),
    onSuccess: (res) => {
      if (res.success) {
        showToast('Cron task deleted!');
        queryClient.invalidateQueries({ queryKey: ['host_cron', host] });
      } else {
        showToast(res.error || 'Failed to delete cron task', 'error');
      }
    },
  });

  const handleCopySshKey = () => {
    if (sshKeyData?.sshKey) {
      navigator.clipboard.writeText(sshKeyData.sshKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const isFirewallActive = firewallData?.status?.toLowerCase().includes('active') && !firewallData?.status?.toLowerCase().includes('inactive');
  const isFirewallMissing = firewallData?.status === 'NOT INSTALLED';

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          role={toastMessage.type === 'success' ? 'status' : 'alert'}
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

      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-[#0d121f] to-slate-900/90 border border-white/10 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Back to Hosts"
            aria-label="Back to Hosts"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white tracking-tight font-mono">{host}</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Linux Server Cluster Host</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSshKeyModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>SSH Setup Key</span>
          </button>
        </div>
      </div>

      {/* Tabs Header */}
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
          <Activity className="w-4 h-4" />
          <span>Overview & Metrics</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('firewall')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'firewall'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Firewall (UFW)</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('cron')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'cron'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Cron Tasks</span>
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
          <HardDrive className="w-4 h-4" />
          <span>Filesystem</span>
        </button>
      </div>

      {/* Tab Panels */}
      {/* 1. Overview & Metrics */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" /> Host Hardware Performance
            </h3>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              aria-label="Metrics timeframe"
              className="px-3 py-1.5 bg-[#080a10] border border-indigo-900/40 rounded-xl text-xs text-slate-300 focus:outline-none"
            >
              <option value="hour">Past Hour</option>
              <option value="today">Today</option>
              <option value="day">Past 24 Hours</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
            </select>
          </div>

          {metricsLoading ? (
            <div className="p-12 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading host telemetry metrics...</span>
            </div>
          ) : !metricsData?.data || metricsData.data.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/10 text-center text-xs text-slate-500 font-mono">
              No historical hardware telemetry collected for this timeframe yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(() => {
                const latest = metricsData.data[metricsData.data.length - 1];
                return (
                  <>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Average CPU</div>
                        <div className="text-base font-bold font-mono text-white mt-0.5">
                          {latest?.avg_cpu !== undefined ? `${Math.round(Number(latest.avg_cpu))}%` : '--'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Average Memory</div>
                        <div className="text-base font-bold font-mono text-white mt-0.5">
                          {latest?.avg_memory !== undefined ? `${Math.round(Number(latest.avg_memory))}%` : '--'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Disk Utilization</div>
                        <div className="text-base font-bold font-mono text-white mt-0.5">
                          {latest?.avg_disk !== undefined ? `${Math.round(Number(latest.avg_disk))}%` : '--'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Samples Recorded</div>
                        <div className="text-base font-bold font-mono text-white mt-0.5">
                          {metricsData.data.length}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 2. Firewall Tab */}
      {activeTab === 'firewall' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-2xl bg-white/[0.02] border border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Firewall Status</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                    isFirewallActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : isFirewallMissing
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {firewallData?.status || 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Manage incoming network traffic and game port provisioning on this host.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isFirewallMissing ? (
                <button
                  type="button"
                  onClick={() => api.installFirewall(host).then(() => queryClient.invalidateQueries({ queryKey: ['host_firewall', host] }))}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Install UFW
                </button>
              ) : (
                <button
                  type="button"
                  disabled={toggleFirewallMutation.isPending}
                  onClick={() => toggleFirewallMutation.mutate(isFirewallActive ? 'disable' : 'enable')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                    isFirewallActive
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{isFirewallActive ? 'Disable Firewall' : 'Enable Firewall'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAddRuleModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Rule</span>
              </button>
            </div>
          </div>

          {/* Rules Table */}
          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Active Firewall Rules ({firewallData?.rules?.length || 0})
            </h4>

            {firewallLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">Querying firewall rules...</div>
            ) : !firewallData?.rules || firewallData.rules.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">No active rules configured in UFW.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2 px-3">Port / Target</th>
                      <th className="py-2 px-3">Protocol</th>
                      <th className="py-2 px-3">From</th>
                      <th className="py-2 px-3">Action</th>
                      <th className="py-2 px-3">Comment</th>
                      <th className="py-2 px-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {firewallData.rules.map((r, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 text-white font-bold">{r.to || 'Any'}</td>
                        <td className="py-2.5 px-3 uppercase text-cyan-400">{r.proto || 'Any'}</td>
                        <td className="py-2.5 px-3 text-slate-300">{r.from || 'Any'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.action === 'ALLOW' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                            {r.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-sans">{r.comment || '--'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteRuleMutation.mutate(r)}
                            title={`Delete rule for ${r.to || 'this port'}`}
                            aria-label={`Delete rule for ${r.to || 'this port'}`}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Cron Tab */}
      {activeTab === 'cron' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" /> Scheduled Cron Tasks
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Automate server maintenance, game restarts, and periodic backup jobs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddCronModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Cron Job</span>
            </button>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Host Crontab Jobs ({cronData?.jobs?.length || 0})
            </h4>

            {cronLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">Reading crontab...</div>
            ) : !cronData?.jobs || cronData.jobs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">No crontab jobs configured on this host.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2 px-3">Identifier</th>
                      <th className="py-2 px-3">Schedule</th>
                      <th className="py-2 px-3">Command</th>
                      <th className="py-2 px-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cronData.jobs.map((job, idx) => (
                      <tr key={job.identifier || idx} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 text-cyan-300 font-semibold">{job.identifier || 'system'}</td>
                        <td className="py-2.5 px-3 text-emerald-400">{job.schedule || '--'}</td>
                        <td className="py-2.5 px-3 text-slate-300 truncate max-w-xs">{job.command || job.raw}</td>
                        <td className="py-2.5 px-3 text-right">
                          {job.identifier && (
                            <button
                              type="button"
                              onClick={() => deleteCronMutation.mutate(job.identifier)}
                              title={`Delete cron job ${job.identifier}`}
                              aria-label={`Delete cron job ${job.identifier}`}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Filesystem Tab */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          <FileManager host={host} initialPath="/" />
        </div>
      )}

      {/* Add Firewall Rule Modal */}
      {showAddRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="add-rule-modal-title" className="w-full max-w-md rounded-2xl border border-indigo-900/40 bg-[#0e1320] p-6 shadow-2xl space-y-4">
            <h3 id="add-rule-modal-title" className="text-base font-bold text-white">Add Firewall Port Rule</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (ruleTo.trim()) {
                  addRuleMutation.mutate({
                    to: ruleTo.trim(),
                    from: ruleFrom.trim() || undefined,
                    proto: ruleProto,
                    action: ruleAction,
                    comment: ruleComment.trim() || undefined,
                  });
                }
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="rule-port" className="block text-xs font-medium text-slate-300 mb-1">Port / Port Range (e.g. 7777 or 27015:27020)</label>
                <input
                  id="rule-port"
                  type="text"
                  required
                  placeholder="e.g. 7777"
                  value={ruleTo}
                  onChange={(e) => setRuleTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rule-protocol" className="block text-xs font-medium text-slate-300 mb-1">Protocol</label>
                  <select
                    id="rule-protocol"
                    value={ruleProto}
                    onChange={(e) => setRuleProto(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none"
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="rule-action" className="block text-xs font-medium text-slate-300 mb-1">Action</label>
                  <select
                    id="rule-action"
                    value={ruleAction}
                    onChange={(e) => setRuleAction(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none"
                  >
                    <option value="ALLOW">ALLOW</option>
                    <option value="DENY">DENY</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="rule-comment" className="block text-xs font-medium text-slate-300 mb-1">Comment / Description</label>
                <input
                  id="rule-comment"
                  type="text"
                  placeholder="e.g. Palworld Dedicated Server"
                  value={ruleComment}
                  onChange={(e) => setRuleComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddRuleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addRuleMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Cron Modal */}
      {showAddCronModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="add-cron-modal-title" className="w-full max-w-md rounded-2xl border border-indigo-900/40 bg-[#0e1320] p-6 shadow-2xl space-y-4">
            <h3 id="add-cron-modal-title" className="text-base font-bold text-white">Add Scheduled Task</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (cronSchedule.trim() && cronCommand.trim()) {
                  addCronMutation.mutate({
                    schedule: cronSchedule.trim(),
                    command: cronCommand.trim(),
                    identifier: cronIdentifier.trim() || undefined,
                  });
                }
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="cron-schedule" className="block text-xs font-medium text-slate-300 mb-1">Schedule (Cron syntax)</label>
                <input
                  id="cron-schedule"
                  type="text"
                  required
                  placeholder="e.g. 0 4 * * *"
                  value={cronSchedule}
                  onChange={(e) => setCronSchedule(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label htmlFor="cron-command" className="block text-xs font-medium text-slate-300 mb-1">Shell Command</label>
                <input
                  id="cron-command"
                  type="text"
                  required
                  placeholder="e.g. /usr/bin/warlock-backup.sh"
                  value={cronCommand}
                  onChange={(e) => setCronCommand(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label htmlFor="cron-identifier" className="block text-xs font-medium text-slate-300 mb-1">Task Identifier</label>
                <input
                  id="cron-identifier"
                  type="text"
                  placeholder="e.g. daily-reboot"
                  value={cronIdentifier}
                  onChange={(e) => setCronIdentifier(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddCronModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addCronMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-40"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SSH Key Modal */}
      {showSshKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div role="dialog" aria-modal="true" aria-labelledby="ssh-key-modal-title" className="w-full max-w-lg rounded-2xl border border-indigo-900/40 bg-[#0e1320] p-6 shadow-2xl space-y-4">
            <h3 id="ssh-key-modal-title" className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" /> Host SSH Public Key
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ensure this key is installed into <code className="text-cyan-300">~/.ssh/authorized_keys</code> on the target server to maintain automated management access.
            </p>
            <div className="p-3 bg-black/50 border border-white/10 rounded-xl font-mono text-[11px] text-slate-300 break-all select-all">
              {sshKeyData?.sshKey || 'Loading SSH key...'}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSshKeyModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCopySshKey}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
