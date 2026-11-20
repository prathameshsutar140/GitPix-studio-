import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eraser,
  Github,
  Grid3X3,
  Layers,
  Paintbrush,
  ShieldCheck,
  Terminal,
  Trash2,
  Type,
} from 'lucide-react';
import { ContributionCanvas } from '../components/ContributionCanvas';
import { useStudio } from '../context/StudioContext';
import type { IntensityLevel, PreviewMode } from '../types/studio';
import { PALETTE_THEMES } from '../utils/calendar';
import { exportBashScript } from '../utils/exportArtwork';
import { renderTextToPixels } from '../utils/pixelFont';
import { applyPixelsToCells, BUILT_IN_PRESETS } from '../utils/presets';

export function LandingPage() {
  const {
    navigate,
    enterDemoMode,
    applyPresetToCanvas,
    connectGitHub,
    oauthConfigured,
    githubUser,
    isDemoMode,
    calendar,
    cells,
    dateCommits,
    getCommitCountForDate,
    setCellsLive,
    setCellsWithHistory,
    commitHistoryCheckpoint,
    clearCanvas,
    selectedYear,
    setSelectedYear,
    artworkTitle,
    settings,
    notify,
  } = useStudio();

  const [brushLevel, setBrushLevel] = useState<IntensityLevel>(3);
  const [heroPreviewMode, setHeroPreviewMode] = useState<PreviewMode>('artwork');
  const [quickText, setQuickText] = useState('HELLO');

  const theme = PALETTE_THEMES[settings.paletteTheme];

  const heroStats = useMemo(() => {
    let activeDays = 0;
    let totalCommits = 0;
    for (const [d, lvl] of Object.entries(cells)) {
      if (lvl > 0) {
        activeDays++;
        totalCommits += getCommitCountForDate(d);
      }
    }
    return { activeDays, totalCommits };
  }, [cells, dateCommits, getCommitCountForDate]);

  const handleApplyQuickText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim()) return;
    const rendered = renderTextToPixels(quickText.trim(), {
      size: 'tall',
      spacing: 1,
      intensity: brushLevel === 0 ? 3 : (brushLevel as Exclude<IntensityLevel, 0>),
      alignX: 'center',
      alignY: 'center',
    });
    const next = applyPixelsToCells({}, rendered.pixels, calendar, 0, 0, true);
    setCellsWithHistory(next);
    notify(`Stamped "${quickText.trim().toUpperCase()}" onto the contribution graph.`, 'success');
  };

  const handleLoadQuickTemplate = (presetIndex: number) => {
    const preset = BUILT_IN_PRESETS[presetIndex];
    if (!preset) return;
    const offsetCol = Math.max(0, Math.floor((53 - preset.width) / 2));
    const offsetRow = Math.max(0, Math.floor((7 - preset.height) / 2));
    const next = applyPixelsToCells({}, preset.pixels, calendar, offsetCol, offsetRow, true);
    setCellsWithHistory(next);
  };

  const handleDownloadQuickScript = () => {
    if (heroStats.activeDays === 0) {
      notify('Paint at least one cell on the canvas first.', 'error');
      return;
    }
    exportBashScript(cells, dateCommits, settings.commitsPerLevel, {
      title: artworkTitle,
      repoName: `gitpixel-art-${selectedYear}`,
      branch: 'main',
      gitName: githubUser?.name || '',
      gitEmail: githubUser ? `${githubUser.id}+${githubUser.login}@users.noreply.github.com` : '',
      includeFutureDates: false,
    });
    notify('Downloaded ready-to-run .sh Git commit script.', 'success');
  };

  const showcasePresets = [
    { preset: BUILT_IN_PRESETS[0], caption: 'Shaded Pixel Heart · 35 cells' },
    { preset: BUILT_IN_PRESETS[3], caption: 'Dev Cat Silhouette · 47 cells' },
    { preset: BUILT_IN_PRESETS[8], caption: 'CODE Typography · 62 cells' },
    { preset: BUILT_IN_PRESETS[10], caption: 'Harmonic Wave · 80 cells' },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100">
      {/* Top Bar Contract: 1 row, 3 zones separated by gap-8 */}
      <header className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-8 border-b border-slate-800/70">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            navigate('landing');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0"
        >
          GitPixel Studio
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
          <a href="#canvas-studio" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Canvas
          </a>
          <a href="#how-it-works" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            How It Works
          </a>
          <a href="#examples" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Templates
          </a>
          <a href="#security" className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0">
            Security
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('editor')}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Open Full Studio
          </button>
        </div>
      </header>

      {/* Canvas-First Hero Section (GitPixelPush style: paint immediately right in the hero) */}
      <section id="canvas-studio" className="max-w-7xl mx-auto px-6 pt-12 pb-14 lg:pt-16 lg:pb-18 space-y-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl space-y-4">
            <div className="text-xs font-medium text-emerald-400 tracking-wide">
              Interactive GitHub Contribution Graph Painter · Script &amp; OAuth Publishing
            </div>
            <h1
              className="font-display font-bold tracking-tight text-slate-50 leading-[1.06]"
              style={{ fontSize: 'clamp(2.3rem, 4.1vw, 3.6rem)', textWrap: 'balance' }}
            >
              Paint Pixel Art Onto Your GitHub Contribution Graph.
            </h1>
            <p className="text-base text-slate-400 leading-relaxed max-w-xl">
              Click and drag directly on the 53×7 calendar below, stamp text or templates, then download a local Git push script or publish directly through GitHub OAuth and Date Scheduler.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => {
                if (githubUser && !isDemoMode) {
                  navigate('repositories');
                } else if (oauthConfigured) {
                  connectGitHub('publish');
                } else {
                  navigate('login');
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors whitespace-nowrap"
            >
              <Github className="w-4 h-4" />
              {githubUser && !isDemoMode ? 'Select Repository' : 'Continue with GitHub'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownloadQuickScript}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-700 text-slate-100 text-sm font-medium transition-colors whitespace-nowrap"
            >
              <Terminal className="w-4 h-4 text-emerald-400" />
              Get Push Script (.sh)
            </button>

            <button
              onClick={() => enterDemoMode('repositories')}
              className="inline-flex items-center gap-2 px-3 py-3 text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap"
            >
              Try Demo
            </button>
          </div>
        </div>

        {/* Live Paintable Hero Canvas */}
        <div className="bg-[#111827]/85 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
          {/* Interactive Paint Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            {/* Intensity Swatches + Eraser */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <Paintbrush className="w-3.5 h-3.5 text-emerald-400" />
                Paint Intensity
              </span>
              <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setBrushLevel(0)}
                  title="Eraser"
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    brushLevel === 0 ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eraser className="w-3 h-3" />
                  Erase
                </button>
                {([1, 2, 3, 4] as Exclude<IntensityLevel, 0>[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setBrushLevel(lvl)}
                    title={`Level ${lvl} (${settings.commitsPerLevel[lvl]} commits/day)`}
                    className={`w-7 h-7 rounded flex items-center justify-center text-[11px] font-mono font-bold transition-transform ${
                      brushLevel === lvl ? 'ring-2 ring-white scale-105' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: theme.levels[lvl],
                      color: lvl >= 3 ? '#052E16' : '#E2E8F0',
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <select
                aria-label="Hero calendar year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-[#0B0F17] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
              >
                {[2027, 2026, 2025, 2024, 2023, 2022].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
                {(['artwork', 'combined'] as PreviewMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setHeroPreviewMode(m)}
                    className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
                      heroPreviewMode === m ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Text Stamp + Preset Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <form onSubmit={handleApplyQuickText} className="flex items-center gap-1.5">
                <div className="relative">
                  <Type className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    placeholder="Text..."
                    maxLength={10}
                    className="w-28 bg-[#0B0F17] border border-slate-800 focus:border-emerald-500 rounded-lg pl-8 pr-2 py-1.5 text-xs font-mono uppercase text-slate-100 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-100 transition-colors"
                >
                  Stamp Text
                </button>
              </form>

              <div className="flex items-center gap-1">
                {[
                  { label: 'Heart', idx: 0 },
                  { label: 'CODE', idx: 8 },
                  { label: 'Wave', idx: 10 },
                ].map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => handleLoadQuickTemplate(tpl.idx)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-[#0B0F17] hover:border-emerald-500/50 text-xs text-slate-300 transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearCanvas}
                  title="Clear canvas"
                  className="p-1.5 rounded-lg border border-slate-800 bg-[#0B0F17] hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Paintable 53x7 Contribution Grid */}
          <ContributionCanvas
            calendar={calendar}
            cells={cells}
            previewMode={heroPreviewMode}
            paletteTheme={settings.paletteTheme}
            showExistingUnderlay={settings.showExistingUnderlay}
            activeTool={brushLevel === 0 ? 'eraser' : 'pencil'}
            activeIntensity={brushLevel === 0 ? 1 : (brushLevel as Exclude<IntensityLevel, 0>)}
            onCellsLive={setCellsLive}
            onCellsCommit={setCellsWithHistory}
            onHistoryCheckpoint={commitHistoryCheckpoint}
          />

          {/* Live Canvas Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-slate-400">
              <span className="text-emerald-400 font-semibold">{heroStats.activeDays} painted days</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-200">{heroStats.totalCommits} planned commits</span>
              <span aria-hidden="true">·</span>
              <span>Drag to paint · Right-click to erase</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate('export')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] text-slate-200 font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export PNG / SVG / Script
              </button>
              <button
                onClick={() => navigate('scheduler')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] text-slate-200 font-medium transition-colors"
              >
                Date Scheduler
              </button>
              <button
                onClick={() => navigate('editor')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                Advanced Editor
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Delivery Engine (Local Git Script vs Direct GitHub OAuth + Scheduler) */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-800/70">
        <div className="max-w-2xl mb-10">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight">
            Two clean ways to push your pixel art
          </h2>
          <p className="text-slate-400 text-sm sm:text-base mt-2 leading-relaxed">
            Run a transparent local Git script in your terminal or connect GitHub OAuth to select repositories and schedule dates in the cloud.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <Terminal className="w-5 h-5" />
              <h3 className="text-base font-semibold text-slate-100">Option A: Local Git Push Script (.sh / .ps1)</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              No GitHub write permissions needed. Download an executable Bash or PowerShell script that initializes a dedicated folder, generates labeled <code className="text-slate-200">[GitPixel Art]</code> commits, and lets you inspect every line before running <code className="text-slate-200">git push</code>.
            </p>
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-emerald-300 space-y-1">
              <div>chmod +x artwork-gitpixel.sh &amp;&amp; ./artwork-gitpixel.sh</div>
              <div className="text-slate-500"># Inspect git log before pushing to your dedicated repo</div>
            </div>
            <button
              onClick={() => navigate('export')}
              className="text-xs font-semibold text-emerald-400 hover:underline inline-flex items-center gap-1"
            >
              Open Script &amp; Image Exporter →
            </button>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-indigo-400">
              <Layers className="w-5 h-5" />
              <h3 className="text-base font-semibold text-slate-100">Option B: GitHub OAuth + Date Scheduler</h3>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sign in with least-privilege GitHub OAuth to overlay your real contribution history, verify repository isolation, schedule future dates safely (<code className="text-slate-200">waiting_for_date</code>), and track every commit in the Status Dashboard.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs font-mono text-slate-400">
              <span>1. Continue with GitHub</span>
              <span>·</span>
              <span>2. Verify Repo</span>
              <span>·</span>
              <span>3. Schedule &amp; Publish</span>
            </div>
            <button
              onClick={() => navigate('repositories')}
              className="text-xs font-semibold text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              Open Repository Selector →
            </button>
          </div>
        </div>
      </section>

      {/* Curated Pixel Artworks */}
      <section id="examples" className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-800/70">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight">
              Start from a curated pixel template
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Click any pattern to load it into the full Contribution Graph Editor.
            </p>
          </div>
          <button
            onClick={() => navigate('presets')}
            className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Browse all presets →
          </button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {showcasePresets.map(({ preset, caption }) => (
            <button
              key={preset.id}
              onClick={() => applyPresetToCanvas(preset, 'replace')}
              className="text-left bg-[#111827] border border-slate-800 hover:border-emerald-500/50 rounded-xl p-5 transition-colors group"
            >
              <div className="h-24 flex items-center justify-center bg-[#0B0F17] rounded-lg border border-slate-800/80 mb-4 overflow-hidden px-3">
                <div
                  className="grid gap-[2px]"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(preset.width, 28)}, 6px)`,
                    gridTemplateRows: `repeat(${preset.height}, 6px)`,
                  }}
                >
                  {Array.from({ length: preset.height }).map((_, r) =>
                    Array.from({ length: Math.min(preset.width, 28) }).map((__, c) => {
                      const found = preset.pixels.find((p) => p.col === c && p.row === r);
                      const color = found
                        ? ['#0E4429', '#006D32', '#26A641', '#39D353'][found.level - 1]
                        : '#161B22';
                      return (
                        <span
                          key={`${c}-${r}`}
                          className="w-[6px] h-[6px] rounded-[1px]"
                          style={{ backgroundColor: color }}
                        />
                      );
                    })
                  )}
                </div>
              </div>
              <div className="text-sm font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                {preset.name}
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">{caption}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Privacy & Transparency */}
      <section id="security" className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-800/70">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 sm:p-8 grid lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <ShieldCheck className="w-5 h-5" />
              <span>Privacy &amp; Ethical Publishing Guarantee</span>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-50">
              Zero token leaks. Zero silent commits.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              OAuth tokens stay isolated in server-side memory and HttpOnly cookies — never stored in browser localStorage or cloud databases. Or skip OAuth completely and export local scripts or PNG/SVG graphics.
            </p>
            <button
              onClick={() => navigate('privacy')}
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Read full Privacy &amp; Security architecture →
            </button>
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            {[
              'Interactive front-page canvas requires zero sign-in to draw and export scripts',
              'Dedicated artwork repository isolation — unrelated codebases remain untouched',
              'Every generated commit is explicitly labeled [GitPixel Art]',
              'Future dates remain scheduled without premature commit creation',
            ].map((point) => (
              <div key={point} className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span className="font-display font-semibold text-slate-300">GitPixel Studio</span>
          <span aria-hidden="true">·</span>
          <span>Developer Contribution Pixel Art Studio</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('editor')} className="hover:text-slate-300 transition-colors">
            Editor
          </button>
          <button onClick={() => navigate('export')} className="hover:text-slate-300 transition-colors">
            Script Export
          </button>
          <button onClick={() => navigate('repositories')} className="hover:text-slate-300 transition-colors">
            Repositories
          </button>
          <button onClick={() => navigate('privacy')} className="hover:text-slate-300 transition-colors">
            Privacy &amp; Security
          </button>
        </div>
      </footer>
    </div>
  );
}
