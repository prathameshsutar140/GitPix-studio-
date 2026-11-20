import React from 'react';
import {
  ArrowRight,
  Download,
  FolderKanban,
  GitCommitHorizontal,
  Grid3X3,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { ContributionCanvas } from '../components/ContributionCanvas';
import { getArtworkStats } from '../utils/calendar';
import { BUILT_IN_PRESETS } from '../utils/presets';

export function DashboardPage() {
  const {
    githubUser,
    isDemoMode,
    selectedYear,
    setSelectedYear,
    calendar,
    loadingCalendar,
    refreshContributions,
    cells,
    artworkTitle,
    savedArtworks,
    publishingJobs,
    settings,
    navigate,
    loadArtworkIntoEditor,
    applyPresetToCanvas,
  } = useStudio();

  const stats = getArtworkStats(calendar, cells, settings.commitsPerLevel);
  const years = [2027, 2026, 2025, 2024, 2023, 2022];

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {githubUser ? (
            <img
              src={githubUser.avatarUrl}
              alt={githubUser.login}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover border border-slate-700"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-semibold">
              GP
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-50">
              {githubUser ? githubUser.name : 'Studio Workspace'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="font-mono">@{githubUser?.login || 'maya-lin-dev'}</span>
              <span aria-hidden="true">·</span>
              <span>{isDemoMode || !githubUser ? 'Demo Mode' : 'GitHub Connected'}</span>
              {githubUser && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{githubUser.publicRepos} public repos</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            aria-label="Select contribution year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-sm font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            onClick={() => navigate('editor')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
          >
            <Grid3X3 className="w-4 h-4" />
            Open Canvas Editor
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400">Existing Contributions ({selectedYear})</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-50 mt-1">
            {loadingCalendar ? '...' : calendar.totalExisting.toLocaleString()}
          </div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400">Active Artwork Days</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {stats.activeDays}
          </div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400">Planned Artwork Commits</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-indigo-400 mt-1">
            {stats.plannedCommits}
          </div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400">Saved Artworks</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-50 mt-1">
            {savedArtworks.length}
          </div>
        </div>
      </div>

      {/* Active Canvas Snapshot */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Active Project: {artworkTitle}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
              Combined Preview · {stats.overlapDays} overlap days detected
            </p>
          </div>
          <div className="flex items-center gap-2">
            {githubUser && !githubUser.isDemo && (
              <button
                onClick={refreshContributions}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCalendar ? 'animate-spin' : ''}`} />
                Sync GitHub
              </button>
            )}
            <button
              onClick={() => navigate('export')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={() => navigate('publish-review')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors"
            >
              <GitCommitHorizontal className="w-3.5 h-3.5" />
              Review Publish
            </button>
          </div>
        </div>

        <ContributionCanvas
          calendar={calendar}
          cells={cells}
          previewMode="combined"
          paletteTheme={settings.paletteTheme}
          showExistingUnderlay={settings.showExistingUnderlay}
          readOnly
        />
      </div>

      {/* Recent Artworks & Quick Presets */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-emerald-400" />
              Recent Artworks
            </h2>
            <button
              onClick={() => navigate('artworks')}
              className="text-xs text-emerald-400 hover:underline"
            >
              View all →
            </button>
          </div>

          {savedArtworks.length === 0 ? (
            <div className="py-8 text-center space-y-3 border border-dashed border-slate-800 rounded-lg">
              <p className="text-sm text-slate-400">No saved artworks yet.</p>
              <button
                onClick={() => navigate('editor')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                Save Your First Canvas
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {savedArtworks.slice(0, 4).map((art) => (
                <div key={art.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">{art.title}</div>
                    <div className="text-xs text-slate-400 font-mono tabular-nums">
                      {art.selectedYear} · {Object.keys(art.cells || {}).length} pixels · {art.presetName}
                    </div>
                  </div>
                  <button
                    onClick={() => loadArtworkIntoEditor(art, 'editor')}
                    className="px-3 py-1.5 rounded-lg border border-slate-800 hover:border-emerald-500/50 text-xs font-medium text-slate-200 transition-colors shrink-0"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Quick-Start Presets & Jobs
            </h2>
            <button
              onClick={() => navigate('presets')}
              className="text-xs text-indigo-400 hover:underline"
            >
              Full library →
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {BUILT_IN_PRESETS.slice(0, 4).map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPresetToCanvas(preset, 'replace')}
                className="flex items-center justify-between p-3 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-emerald-500/50 text-left transition-colors"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-100">{preset.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">{preset.pixels.length} px</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            ))}
          </div>

          {publishingJobs.length > 0 && (
            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs font-medium text-slate-400 mb-2">Latest Publishing Run</div>
              <div className="flex items-center justify-between text-xs bg-[#0B0F17] border border-slate-800 rounded-lg p-3">
                <div className="min-w-0">
                  <div className="font-medium text-slate-200 truncate">
                    {publishingJobs[0].repositoryName}
                  </div>
                  <div className="text-slate-400 font-mono tabular-nums">
                    {publishingJobs[0].completedItems}/{publishingJobs[0].totalItems} days · {publishingJobs[0].status}
                  </div>
                </div>
                <button
                  onClick={() => navigate('publish-progress')}
                  className="text-emerald-400 hover:underline shrink-0 ml-2"
                >
                  Inspect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
