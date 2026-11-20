import React from 'react';
import { Database, Eye, GitBranch, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

export function PrivacyPage() {
  const { disconnectGitHub, signOutCloudSync, notify } = useStudio();

  const handlePurgeLocalData = () => {
    localStorage.removeItem('gitpixel_local_artworks_v1');
    localStorage.removeItem('gitpixel_local_presets_v1');
    localStorage.removeItem('gitpixel_settings_v1');
    notify('Cleared local browser studio cache.', 'info');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-50">Privacy, Security & Transparency</h1>
        <p className="text-sm text-slate-400 mt-1">
          How GitPixel Studio protects your GitHub credentials, isolates artwork commits, and handles your project data.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-400">
            <KeyRound className="w-4 h-4" />
            <h2 className="text-sm font-semibold text-slate-100">Server-Side Token Isolation</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            GitHub OAuth client secrets and access tokens never touch browser <code className="text-slate-200">localStorage</code>,
            URL parameters, or artwork databases. Sessions use random server-side keys stored in <code className="text-slate-200">HttpOnly; Secure; SameSite=None</code> cookies with CSRF state verification.
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-400">
            <ShieldCheck className="w-4 h-4" />
            <h2 className="text-sm font-semibold text-slate-100">Least-Privilege OAuth Scopes</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Viewing your contribution graph only requests <code className="text-slate-200">read:user</code>. Write access
            (<code className="text-slate-200">public_repo</code>) is explained beforehand and only requested when you opt into publishing artwork.
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-400">
            <GitBranch className="w-4 h-4" />
            <h2 className="text-sm font-semibold text-slate-100">Dedicated Repository Policy</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Publishing targets only a dedicated repository that you explicitly select or create. Unrelated code repositories are never touched, and historical activity is never modified.
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-2.5">
          <div className="flex items-center gap-2 text-purple-400">
            <Eye className="w-4 h-4" />
            <h2 className="text-sm font-semibold text-slate-100">Explicit Artwork Disclosure</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every generated commit carries the <code className="text-slate-200">[GitPixel Art]</code> prefix, and every dedicated repository receives a disclosure README explaining that timestamps represent visual pixel art rather than software work.
          </p>
        </div>
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-200">
          <Database className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-semibold">Data Controls</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Artwork records store only your project title, selected year, pixel date-intensity coordinates, and non-sensitive profile display metadata. You can disconnect sessions or wipe local browser state below at any time.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={disconnectGitHub}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200"
          >
            Revoke GitHub Session
          </button>
          <button
            onClick={signOutCloudSync}
            className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium text-slate-200"
          >
            Disconnect Cloud Sync
          </button>
          <button
            onClick={handlePurgeLocalData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Local Browser Cache
          </button>
        </div>
      </div>
    </div>
  );
}
