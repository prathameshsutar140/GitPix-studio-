import React from 'react';
import { Cloud, Github, Palette, Sliders } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { IntensityLevel, PaletteTheme } from '../types/studio';
import { PALETTE_THEMES } from '../utils/calendar';

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    githubUser,
    isDemoMode,
    oauthConfigured,
    redirectUri,
    connectGitHub,
    disconnectGitHub,
    firebaseUser,
    signInCloudSync,
    signOutCloudSync,
    notify,
  } = useStudio();

  const updateCommitMultiplier = (lvl: Exclude<IntensityLevel, 0>, value: number) => {
    const clamped = Math.max(1, Math.min(30, value || 1));
    updateSettings({
      commitsPerLevel: {
        ...settings.commitsPerLevel,
        [lvl]: clamped,
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-50">Studio Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Configure canvas defaults, intensity-to-commit multipliers, color palettes, and connected accounts.
        </p>
      </div>

      {/* Canvas & Calendar Preferences */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2 text-emerald-400">
          <Sliders className="w-4 h-4" />
          <h2 className="text-base font-semibold text-slate-100">Canvas & Commit Multipliers</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="text-xs text-slate-300 block">
            Default Contribution Year
            <select
              value={settings.defaultYear}
              onChange={(e) => {
                updateSettings({ defaultYear: Number(e.target.value) });
                notify('Default year updated.', 'success');
              }}
              className="mt-1.5 w-full bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
            >
              {[2027, 2026, 2025, 2024, 2023, 2022].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showExistingUnderlay}
                onChange={(e) => updateSettings({ showExistingUnderlay: e.target.checked })}
                className="accent-emerald-500"
              />
              Show existing GitHub contribution activity underlay
            </label>
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.gridSnap}
                onChange={(e) => updateSettings({ gridSnap: e.target.checked })}
                className="accent-emerald-500"
              />
              Snap moves and text placements to weekly/daily grid
            </label>
            <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.warnOnOverlap}
                onChange={(e) => updateSettings({ warnOnOverlap: e.target.checked })}
                className="accent-emerald-500"
              />
              Highlight overlapping existing contribution days
            </label>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800">
          <div className="text-xs font-medium text-slate-300 mb-3">
            Planned Commits per Intensity Level (Publishing Workload)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([1, 2, 3, 4] as Exclude<IntensityLevel, 0>[]).map((lvl) => (
              <label
                key={lvl}
                className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3 text-xs text-slate-300 block"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span>Level {lvl}</span>
                  <span
                    className="w-3 h-3 rounded-[2px]"
                    style={{ backgroundColor: PALETTE_THEMES[settings.paletteTheme].levels[lvl] }}
                  />
                </div>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={settings.commitsPerLevel[lvl]}
                  onChange={(e) => updateCommitMultiplier(lvl, Number(e.target.value))}
                  className="w-full bg-[#111827] border border-slate-700 rounded px-2.5 py-1 font-mono tabular-nums text-slate-100"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Palette Theme */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-indigo-400">
          <Palette className="w-4 h-4" />
          <h2 className="text-base font-semibold text-slate-100">Canvas Preview Palette</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {(Object.keys(PALETTE_THEMES) as PaletteTheme[]).map((key) => {
            const p = PALETTE_THEMES[key];
            const active = settings.paletteTheme === key;
            return (
              <button
                key={key}
                onClick={() => updateSettings({ paletteTheme: key })}
                className={`p-3.5 rounded-lg border flex items-center justify-between transition-colors ${
                  active
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100'
                    : 'bg-[#0B0F17] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className="text-sm font-medium">{p.name}</span>
                <div className="flex gap-1">
                  {([0, 1, 2, 3, 4] as IntensityLevel[]).map((l) => (
                    <span
                      key={l}
                      className="w-3.5 h-3.5 rounded-[2px] border border-white/10"
                      style={{ backgroundColor: p.levels[l] }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Connected Accounts */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-100">Connected Accounts & OAuth</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-[#0B0F17] border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Github className="w-4 h-4" />
              GitHub OAuth
            </div>
            <p className="text-slate-400">
              {githubUser && !isDemoMode
                ? `Connected as @${githubUser.login}`
                : isDemoMode
                ? 'Currently using Demo Mode profile.'
                : 'Not connected.'}
            </p>
            <div className="text-[11px] font-mono text-slate-500 truncate">
              Callback: {redirectUri}
            </div>
            {githubUser && !isDemoMode ? (
              <button
                onClick={disconnectGitHub}
                className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Disconnect GitHub
              </button>
            ) : (
              <button
                onClick={() => connectGitHub('read')}
                disabled={!oauthConfigured}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium"
              >
                {oauthConfigured ? 'Connect GitHub' : 'Configure OAuth Env Vars'}
              </button>
            )}
          </div>

          <div className="p-4 rounded-lg bg-[#0B0F17] border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Cloud className="w-4 h-4 text-indigo-400" />
              Cloud Artwork Sync
            </div>
            <p className="text-slate-400">
              {firebaseUser ? `Synced as ${firebaseUser.email || firebaseUser.uid}` : 'Using local & server workspace persistence.'}
            </p>
            {firebaseUser ? (
              <button
                onClick={signOutCloudSync}
                className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Sign Out Cloud Sync
              </button>
            ) : (
              <button
                onClick={signInCloudSync}
                className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                Connect Cloud Sync
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
