import React, { useState } from 'react';
import { Check, Cloud, Copy, Github, Info, Lock, Play, Shield } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export function LoginPage() {
  const {
    githubUser,
    isDemoMode,
    oauthConfigured,
    redirectUri,
    connectGitHub,
    disconnectGitHub,
    enterDemoMode,
    firebaseUser,
    signInCloudSync,
    signOutCloudSync,
    navigate,
  } = useStudio();

  const [scopeMode, setScopeMode] = useState<'read' | 'publish'>('read');
  const [copiedUri, setCopiedUri] = useState(false);

  const copyUri = () => {
    navigator.clipboard.writeText(redirectUri || `${window.location.origin}/auth/callback`);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-50">
          Connect GitHub or Launch Demo Mode
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed max-w-2xl">
          Authenticate securely to inspect your real GitHub contribution calendar and optionally publish to a
          dedicated artwork repository — or start designing immediately in Demo Mode.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* GitHub OAuth Card */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Github className="w-5 h-5 text-slate-100" />
              <h2 className="text-base font-semibold text-slate-100">GitHub OAuth Authentication</h2>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {oauthConfigured ? 'OAuth Ready' : 'Demo / Setup Mode'}
            </span>
          </div>

          {githubUser && !isDemoMode ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3.5 rounded-lg bg-[#0B0F17] border border-slate-800">
                <img
                  src={githubUser.avatarUrl}
                  alt={githubUser.login}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-slate-700"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100 truncate">{githubUser.name}</div>
                  <div className="text-xs text-slate-400 font-mono truncate">
                    @{githubUser.login} · Scopes: {githubUser.grantedScopes.join(', ') || 'read:user'}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('repositories')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                >
                  Select Repository →
                </button>
                <button
                  onClick={() => navigate('dashboard')}
                  className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm font-medium transition-colors"
                >
                  Open Dashboard
                </button>
                <button
                  onClick={disconnectGitHub}
                  className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Least-Privilege Scope Selection */}
              <div className="space-y-2.5">
                <label className="text-xs font-medium text-slate-300 block">
                  Select Permission Level (Least-Privilege)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setScopeMode('read')}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      scopeMode === 'read'
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100'
                        : 'bg-[#0B0F17] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-sm font-medium">Read-Only Profile & Calendar (`read:user`)</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Fetch your real contribution graph and design pixel art without write access.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScopeMode('publish')}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      scopeMode === 'publish'
                        ? 'bg-indigo-500/10 border-indigo-500/40 text-slate-100'
                        : 'bg-[#0B0F17] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-sm font-medium">
                      Calendar + Dedicated Repo Publishing (`read:user public_repo`)
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Required only if you want GitPixel Studio to create a dedicated artwork repository and push labeled commits.
                    </div>
                  </button>
                </div>
              </div>

              <button
                onClick={() => connectGitHub(scopeMode)}
                disabled={!oauthConfigured}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  oauthConfigured
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Github className="w-4 h-4" />
                {oauthConfigured ? 'Sign in with GitHub' : 'GitHub OAuth Credentials Required'}
              </button>

              {!oauthConfigured && (
                <div className="p-3.5 rounded-lg bg-[#0B0F17] border border-slate-800 space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                    <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    How to enable live GitHub OAuth
                  </div>
                  <p>
                    Create an OAuth App in GitHub Developer Settings, add <code className="text-slate-200">GITHUB_CLIENT_ID</code> and{' '}
                    <code className="text-slate-200">GITHUB_CLIENT_SECRET</code> to environment secrets, and register this callback URL:
                  </p>
                  <div className="flex items-center gap-2 bg-[#111827] border border-slate-800 rounded px-2.5 py-1.5">
                    <code className="text-[11px] text-emerald-400 truncate flex-1">
                      {redirectUri || `${window.location.origin}/auth/callback`}
                    </code>
                    <button
                      onClick={copyUri}
                      className="text-slate-400 hover:text-slate-100 shrink-0"
                      title="Copy Callback URL"
                    >
                      {copiedUri ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Demo Mode & Cloud Sync Column */}
        <div className="space-y-6">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <Play className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-slate-100">Instant Demo Mode</h2>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Explore every drawing tool, realistic baseline contribution activity, overlap detection, PNG/SVG/JSON
              export, and simulated publishing dry-runs with zero setup.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => enterDemoMode('repositories')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
              >
                Demo: Repositories & Scheduler
              </button>
              <button
                onClick={() => enterDemoMode('editor')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 text-sm font-medium transition-colors"
              >
                Open Editor
              </button>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <Cloud className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-semibold text-slate-100">Cloud Artwork Sync</h2>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {firebaseUser
                ? `Synced to cloud account (${firebaseUser.email || firebaseUser.uid}). Artworks and custom presets persist across devices.`
                : 'Optional: Sign in with Google to sync saved artworks, custom presets, and share links to Firestore cloud storage.'}
            </p>
            {firebaseUser ? (
              <button
                onClick={signOutCloudSync}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors"
              >
                Disconnect Cloud Sync
              </button>
            ) : (
              <button
                onClick={signInCloudSync}
                className="px-4 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] text-xs font-medium text-slate-200 transition-colors"
              >
                Sign in with Google for Cloud Sync
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400 pt-2">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Access tokens remain exclusively in server-side memory and HttpOnly cookies.{' '}
          <button onClick={() => navigate('privacy')} className="text-emerald-400 hover:underline">
            Inspect security model
          </button>
        </span>
      </div>
    </div>
  );
}
