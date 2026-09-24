import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ShieldCheck, Copy, Check, KeyRound, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

interface TwoFactorSetupViewProps {
  onSetupComplete: () => void;
}

export const TwoFactorSetupView: React.FC<TwoFactorSetupViewProps> = ({ onSetupComplete }) => {
  const [secret, setSecret] = useState<string>('');
  const [qr, setQr] = useState<string>('');
  const [authcode, setAuthcode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSetupData = async () => {
      setLoading(true);
      try {
        const res = await api.setup2fa();
        if (res.success && res.secret) {
          setSecret(res.secret);
          setQr(res.qr || '');
        } else {
          setError(res.error || 'Failed to generate 2FA credentials');
        }
      } catch (err: any) {
        setError(err.message || 'Error initializing 2FA setup');
      } finally {
        setLoading(false);
      }
    };

    fetchSetupData();
  }, []);

  const handleCopySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authcode.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await api.verify2fa(authcode.trim());
      if (res.success) {
        onSetupComplete();
      } else {
        setError(res.error || 'Invalid 2FA verification code');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#07090e] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#07090e] to-black">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-3 shadow-lg shadow-cyan-500/10">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Two-Factor Authentication Setup
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Enhance the security of your Warlock instance by pairing an authenticator app.
          </p>
        </div>

        {/* Setup Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0d121f]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 font-mono flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Generating secure TOTP secret...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Scan QR */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center justify-center border border-cyan-500/30">
                    1
                  </span>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Scan with Authenticator
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mb-4 pl-7">
                  Scan this QR code using Google Authenticator, 1Password, Bitwarden, or Authy.
                </p>

                <div className="flex justify-center p-4 bg-white rounded-2xl max-w-[220px] mx-auto shadow-inner">
                  {qr ? (
                    <img src={qr} alt="2FA QR Code" className="w-44 h-44 object-contain" />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-black text-xs font-mono text-center">
                      QR Generated
                    </div>
                  )}
                </div>

                {/* Secret Key Text */}
                <div className="mt-4 p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 text-xs font-mono">
                  <div className="truncate">
                    <span className="text-slate-500 mr-2 text-[10px] uppercase">Secret:</span>
                    <span className="text-cyan-300 select-all">{secret}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Copy Secret"
                    aria-label="Copy Secret"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Step 2: Verification Code */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-bold flex items-center justify-center border border-cyan-500/30">
                    2
                  </span>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Verify Setup Code
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mb-4 pl-7">
                  Enter the 6-digit code currently generated by your app.
                </p>

                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label="6-digit verification code"
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
                    type="submit"
                    disabled={submitting || authcode.trim().length !== 6}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 active:scale-[0.98]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying & Enabling...</span>
                      </>
                    ) : (
                      <>
                        <span>Activate Two-Factor Authentication</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
