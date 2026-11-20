import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2, FileJson, Image, Link2, Printer, Terminal } from 'lucide-react';
import { ContributionCanvas } from '../components/ContributionCanvas';
import { useStudio } from '../context/StudioContext';
import type { PaletteTheme, PreviewMode } from '../types/studio';
import { PALETTE_THEMES } from '../utils/calendar';
import {
  buildProjectJson,
  exportBashScript,
  exportCalendarToPng,
  exportCalendarToSvg,
  exportPowerShellScript,
  exportProjectJson,
  generateGitBashScript,
  generatePowerShellScript,
} from '../utils/exportArtwork';

export function ExportPage() {
  const {
    activeArtworkId,
    artworkTitle,
    artworkNotes,
    presetName,
    selectedYear,
    githubUser,
    calendar,
    cells,
    dateCommits,
    selectedRepo,
    settings,
    createShareLink,
    notify,
  } = useStudio();

  const [exportTheme, setExportTheme] = useState<PaletteTheme>(settings.paletteTheme);
  const [exportMode, setExportMode] = useState<PreviewMode>('combined');
  const [showHeader, setShowHeader] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [pngScale, setPngScale] = useState<2 | 3>(2);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [scriptShell, setScriptShell] = useState<'bash' | 'powershell'>('bash');
  const [scriptRepoName, setScriptRepoName] = useState(selectedRepo?.name || `gitpixel-art-${selectedYear}`);
  const [scriptBranch, setScriptBranch] = useState(selectedRepo?.defaultBranch || 'main');
  const [scriptGitName, setScriptGitName] = useState(githubUser?.name || '');
  const [scriptGitEmail, setScriptGitEmail] = useState(
    githubUser ? `${githubUser.id}+${githubUser.login}@users.noreply.github.com` : ''
  );
  const [includeFutureInScript, setIncludeFutureInScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const username = githubUser?.login || 'maya-lin-dev';

  const generatedScript = useMemo(() => {
    const opts = {
      title: artworkTitle,
      repoName: scriptRepoName,
      branch: scriptBranch,
      gitName: scriptGitName,
      gitEmail: scriptGitEmail,
      includeFutureDates: includeFutureInScript,
    };
    return scriptShell === 'bash'
      ? generateGitBashScript(cells, dateCommits, settings.commitsPerLevel, opts)
      : generatePowerShellScript(cells, dateCommits, settings.commitsPerLevel, opts);
  }, [
    artworkTitle,
    cells,
    dateCommits,
    includeFutureInScript,
    scriptBranch,
    scriptGitEmail,
    scriptGitName,
    scriptRepoName,
    scriptShell,
    settings.commitsPerLevel,
  ]);

  const currentProject = {
    id: activeArtworkId,
    title: artworkTitle,
    selectedYear,
    githubUsername: username,
    cells,
    presetName,
    notes: artworkNotes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const handleDownloadPng = async () => {
    try {
      await exportCalendarToPng(calendar, cells, {
        title: artworkTitle,
        username,
        theme: exportTheme,
        previewMode: exportMode,
        showHeader,
        showLegend,
        showExistingUnderlay: settings.showExistingUnderlay,
        scale: pngScale,
      });
      notify('PNG exported.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Failed to generate PNG.', 'error');
    }
  };

  const handleDownloadSvg = () => {
    exportCalendarToSvg(calendar, cells, {
      title: artworkTitle,
      username,
      theme: exportTheme,
      previewMode: exportMode,
      showHeader,
      showLegend,
      showExistingUnderlay: settings.showExistingUnderlay,
    });
    notify('SVG exported.', 'success');
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(buildProjectJson(currentProject));
    setCopiedJson(true);
    notify('Artwork JSON copied to clipboard.', 'success');
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleGenerateShareLink = async () => {
    const link = await createShareLink();
    setShareUrl(link);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    notify('Shareable read-only link copied.', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="no-print">
        <h1 className="font-display text-2xl font-bold text-slate-50">Export & Share Artwork</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Export crisp PNGs, scalable SVGs, JSON project files, print-ready sheets, or read-only preview links — no GitHub sign-in required.
        </p>
      </div>

      {/* Live Preview Sheet (also used for Print) */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        {showHeader && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/70">
            <div>
              <h2 className="text-base font-semibold text-slate-100">{artworkTitle}</h2>
              <div className="text-xs text-slate-400 font-mono">
                @{username} · {selectedYear} · {Object.keys(cells).length} planned pixels
              </div>
            </div>
            <span className="text-xs text-slate-500">GitPixel Studio Export Preview</span>
          </div>
        )}

        <ContributionCanvas
          calendar={calendar}
          cells={cells}
          previewMode={exportMode}
          paletteTheme={exportTheme}
          showExistingUnderlay={settings.showExistingUnderlay}
          readOnly
        />
      </div>

      {/* Controls & Download Actions */}
      <div className="grid lg:grid-cols-12 gap-6 no-print">
        {/* Render Configuration */}
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-100">Render Settings</h2>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Color Palette</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PALETTE_THEMES) as PaletteTheme[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setExportTheme(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-colors ${
                    exportTheme === key
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#0B0F17] border-slate-800 text-slate-300'
                  }`}
                >
                  {PALETTE_THEMES[key].name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Layer Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'combined', label: 'Combined Graph' },
                  { id: 'artwork', label: 'Artwork Only' },
                ] as { id: PreviewMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setExportMode(m.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    exportMode === m.id
                      ? 'bg-slate-800 border-slate-600 text-white'
                      : 'bg-[#0B0F17] border-slate-800 text-slate-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-300">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeader}
                onChange={(e) => setShowHeader(e.target.checked)}
                className="accent-emerald-500"
              />
              Include title header
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="accent-emerald-500"
              />
              Include intensity legend
            </label>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1.5">PNG Resolution</span>
            <div className="flex gap-2">
              {([2, 3] as (2 | 3)[]).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setPngScale(sc)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${
                    pngScale === sc
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-[#0B0F17] border-slate-800 text-slate-300'
                  }`}
                >
                  {sc}× Retina
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Download & Share Options */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-100">Download & Share</h2>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={handleDownloadPng}
              className="flex items-center gap-3 p-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-left transition-colors"
            >
              <Image className="w-5 h-5 shrink-0" />
              <div>
                <div className="text-sm font-semibold">Download PNG ({pngScale}×)</div>
                <div className="text-xs text-emerald-100/80">Crisp raster image for social & docs</div>
              </div>
            </button>

            <button
              onClick={handleDownloadSvg}
              className="flex items-center gap-3 p-4 rounded-xl bg-[#0B0F17] border border-slate-700 hover:border-emerald-500/50 text-left transition-colors"
            >
              <FileCode2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-slate-100">Download SVG</div>
                <div className="text-xs text-slate-400">Infinite resolution vector graphic</div>
              </div>
            </button>

            <button
              onClick={() => exportProjectJson(currentProject)}
              className="flex items-center gap-3 p-4 rounded-xl bg-[#0B0F17] border border-slate-700 hover:border-indigo-500/50 text-left transition-colors"
            >
              <FileJson className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-slate-100">Download JSON Project</div>
                <div className="text-xs text-slate-400">Portable artwork & date mapping</div>
              </div>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-3 p-4 rounded-xl bg-[#0B0F17] border border-slate-700 hover:border-slate-500 text-left transition-colors"
            >
              <Printer className="w-5 h-5 text-slate-300 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-slate-100">Print-Friendly Calendar</div>
                <div className="text-xs text-slate-400">Clean white-paper print stylesheet</div>
              </div>
            </button>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCopyJson}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] text-xs font-medium text-slate-200"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Artwork Configuration
              </button>

              <button
                onClick={handleGenerateShareLink}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                Generate Read-Only Share Link
              </button>
            </div>

            {shareUrl && (
              <div className="flex items-center gap-2 bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400">
                <span className="truncate flex-1">{shareUrl}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    notify('Link copied.', 'info');
                  }}
                  className="text-slate-300 hover:text-white shrink-0"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Local Git Push Script Generator (GitPixelPush Workflow) */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5 no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-slate-100">
                Local Git Commit Script Generator (.sh / .ps1)
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Prefer pushing locally without granting OAuth repo write permissions? Generate a self-contained Bash or PowerShell script for a dedicated repository.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setScriptShell('bash')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                scriptShell === 'bash' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bash (.sh)
            </button>
            <button
              type="button"
              onClick={() => setScriptShell('powershell')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                scriptShell === 'powershell' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PowerShell (.ps1)
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <label className="block text-slate-400">
            Target Folder / Repo Name
            <input
              type="text"
              value={scriptRepoName}
              onChange={(e) => setScriptRepoName(e.target.value)}
              className="mt-1 w-full bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
            />
          </label>
          <label className="block text-slate-400">
            Branch
            <input
              type="text"
              value={scriptBranch}
              onChange={(e) => setScriptBranch(e.target.value)}
              className="mt-1 w-full bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
            />
          </label>
          <label className="block text-slate-400">
            Git Author Name (optional)
            <input
              type="text"
              value={scriptGitName}
              onChange={(e) => setScriptGitName(e.target.value)}
              placeholder="Your Name"
              className="mt-1 w-full bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
            />
          </label>
          <label className="block text-slate-400">
            GitHub Verified Email (optional)
            <input
              type="text"
              value={scriptGitEmail}
              onChange={(e) => setScriptGitEmail(e.target.value)}
              placeholder="you@users.noreply.github.com"
              className="mt-1 w-full bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeFutureInScript}
              onChange={(e) => setIncludeFutureInScript(e.target.checked)}
              className="accent-emerald-500"
            />
            Include future dates (&gt; today) in script (skipped by default)
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generatedScript);
                setCopiedScript(true);
                notify('Commit script copied to clipboard.', 'success');
                setTimeout(() => setCopiedScript(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] text-xs font-medium text-slate-200"
            >
              {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copy Script
            </button>
            <button
              type="button"
              onClick={() => {
                const opts = {
                  title: artworkTitle,
                  repoName: scriptRepoName,
                  branch: scriptBranch,
                  gitName: scriptGitName,
                  gitEmail: scriptGitEmail,
                  includeFutureDates: includeFutureInScript,
                };
                if (scriptShell === 'bash') exportBashScript(cells, dateCommits, settings.commitsPerLevel, opts);
                else exportPowerShellScript(cells, dateCommits, settings.commitsPerLevel, opts);
                notify(`Downloaded ${scriptShell === 'bash' ? '.sh' : '.ps1'} commit script.`, 'success');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Download {scriptShell === 'bash' ? '.sh' : '.ps1'}
            </button>
          </div>
        </div>

        <pre className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 max-h-64 overflow-auto text-[11px] font-mono text-emerald-300 leading-relaxed">
          {generatedScript}
        </pre>
      </div>
    </div>
  );
}
