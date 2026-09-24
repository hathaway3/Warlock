import React, { useState } from 'react';
import { api } from '../api/client';
import type { AuthUser } from '../types';
import { Shield, KeyRound, User, Lock, AlertCircle, ArrowRight, Loader2, CheckCircle2, Sparkles } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: AuthUser) => void;
  onRequire2faSetup: () => void;
  isInitialInstall?: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginSuccess,
  onRequire2faSetup,
  isInitialInstall = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authcode, setAuthcode] = useState('');
  const [show2faField, setShow2faField] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    if (isInitialInstall) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await api.setupAdmin(username, password);
        if (res.success && res.user) {
          if (res.require2faSetup) {
            onRequire2faSetup();
          } else {
            onLoginSuccess(res.user);
          }
        } else {
          setError(res.error || 'Failed to initialize administrator account');
        }
      } catch (err: any) {
        setError(err.message || 'Setup error. Please check server status.');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.login(username, password, authcode.trim() || undefined);

      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else if (res.require2faSetup) {
        onRequire2faSetup();
      } else if (res.require2fa) {
        setShow2faField(true);
        setError(res.error || 'Please enter the 6-digit 2FA code from your authenticator app');
      } else {
        setError(res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check server connectivity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#07090e] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#07090e] to-black">
      <div className="w-full max-w-md">
        {/* Warlock Header & Shield */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-xl shadow-cyan-500/20 mb-4 p-0.5">
            <div className="w-full h-full bg-[#0d121f] rounded-[14px] flex items-center justify-center">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider uppercase font-mono">
            Warlock
          </h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-mono">
            Dedicated Server Orchestrator
          </p>
        </div>

        {/* Card Form */}
        <div className="rounded-2xl border border-white/10 bg-[#0d121f]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-white">
              {isInitialInstall
                ? 'Fleet Initialization'
                : show2faField
                ? 'Two-Factor Authentication'
                : 'Account Sign In'}
            </h2>
            {isInitialInstall && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> Initial Setup
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-6">
            {isInitialInstall
              ? 'Create your primary administrator account to secure this installation'
              : show2faField
              ? 'Enter the 6-digit verification code from your authenticator device'
              : 'Enter your credentials to access the management interface'}
          </p>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!show2faField ? (
              <>
                {/* Username */}
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                    {isInitialInstall ? 'Admin Username' : 'Username'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      autoFocus
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                    />
                  </div>
                </div>

                {/* Confirm Password (only on initial install) */}
                {isInitialInstall && (
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1.5 uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono transition-colors"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* 2FA Code Input */
              <div>
                <label className="block text-xs font-mono text-cyan-400 mb-1.5 uppercase tracking-wider">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" />
                  <input
                    type="text"
                    autoFocus
                    maxLength={6}
                    required
                    value={authcode}
                    onChange={(e) => setAuthcode(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-black/50 border border-cyan-500/40 text-sm text-cyan-300 text-center tracking-[0.3em] font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShow2faField(false)}
                  className="mt-2 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ← Back to username/password
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isInitialInstall ? 'Creating Account...' : 'Verifying...'}</span>
                </>
              ) : (
                <>
                  <span>
                    {isInitialInstall
                      ? 'Initialize Administrator Account'
                      : show2faField
                      ? 'Authenticate Session'
                      : 'Sign In'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secured with TLS encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
};
