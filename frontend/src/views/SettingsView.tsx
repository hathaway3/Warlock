import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApiToken } from '../types';
import { Key, Plus, Trash2, Copy, Check, ShieldCheck } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const queryClient = useQueryClient();
  const [tokenName, setTokenName] = useState('');
  const [expiresIn, setExpiresIn] = useState('30');
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: tokens = [], isLoading } = useQuery<ApiToken[]>({
    queryKey: ['api_tokens'],
    queryFn: () => api.getTokens(),
  });

  const createTokenMutation = useMutation({
    mutationFn: ({ name, expiresInDays }: { name: string; expiresInDays: number }) =>
      api.createToken(name, expiresInDays),
    onSuccess: (res) => {
      if (res.success && res.data?.token) {
        setNewlyCreatedToken(res.data.token);
        setTokenName('');
        queryClient.invalidateQueries({ queryKey: ['api_tokens'] });
      }
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (id: number) => api.revokeToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api_tokens'] });
    },
  });

  const handleCopy = () => {
    if (newlyCreatedToken) {
      navigator.clipboard.writeText(newlyCreatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-indigo-900/20 pb-5">
        <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Key className="text-indigo-400" />
          Settings & Integrations
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">Manage API access tokens, security credentials, and system options</p>
      </div>

      {/* API Tokens Section (Issue #28) */}
      <div className="bg-[#12141c]/90 border border-indigo-900/30 rounded-xl p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Key size={18} className="text-indigo-400" /> API Authentication Tokens
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            API tokens allow external bots (Discord bots, monitoring scripts, CI/CD) to securely query the Warlock REST API.
          </p>
        </div>

        {newlyCreatedToken && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/50 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <ShieldCheck size={18} /> API Token Created Successfully
            </div>
            <p className="text-xs text-slate-300">
              Please copy this token now. For security reasons, it will not be shown again.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                readOnly
                value={newlyCreatedToken}
                className="flex-1 px-3 py-2 bg-black/50 border border-emerald-500/40 rounded font-mono text-xs text-emerald-300 select-all"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Create Token Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (tokenName.trim()) {
              createTokenMutation.mutate({ name: tokenName.trim(), expiresInDays: Number(expiresIn) });
            }
          }}
          className="flex flex-col sm:flex-row gap-3 items-end p-4 bg-black/20 rounded-lg border border-indigo-950/40"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-400 mb-1">Token Name / Description</label>
            <input
              type="text"
              placeholder="e.g. Discord Bot or Grafana Scraper"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0b0f] border border-indigo-900/30 rounded text-sm text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="w-full sm:w-36">
            <label className="block text-xs font-medium text-slate-400 mb-1">Expiration</label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0b0f] border border-indigo-900/30 rounded text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="7">7 Days</option>
              <option value="30">30 Days</option>
              <option value="90">90 Days</option>
              <option value="365">1 Year</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={createTokenMutation.isPending}
            className="w-full sm:w-auto min-h-[38px] px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Plus size={16} /> Create Token
          </button>
        </form>

        {/* Tokens Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-center text-slate-400 text-sm">Loading tokens...</div>
          ) : tokens.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No API tokens configured yet.</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-indigo-900/30 text-slate-400">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Prefix</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3">Last Used</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-950/40">
                {tokens.map((token) => (
                  <tr key={token.id} className="hover:bg-slate-800/20">
                    <td className="py-3 px-3 font-semibold text-slate-200">{token.name}</td>
                    <td className="py-3 px-3 font-mono text-indigo-400">{token.token_prefix}</td>
                    <td className="py-3 px-3 text-slate-400">{new Date(token.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        title="Revoke Token"
                        onClick={() => revokeTokenMutation.mutate(token.id)}
                        className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
