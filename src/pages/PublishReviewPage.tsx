import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FolderGit2,
  GitCommitHorizontal,
  Github,
  Info,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import { ContributionCanvas } from '../components/ContributionCanvas';
import { useStudio } from '../context/StudioContext';

export function PublishReviewPage() {
  const {
    githubUser,
    isDemoMode,
    connectGitHub,
    calendar,
    cells,
    dateCommits,
    getCommitCountForDate,
    artworkTitle,
    settings,
    repos,
    loadingRepos,
    loadRepos,
    selectedRepo,
    selectedRepoConnection,
    repoVerification,
    selectRepository,
    createDedicatedRepo,
    startPublishJob,
    navigate,
    notify,
  } = useStudio();

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [selectedRepoName, setSelectedRepoName] = useState<string>(selectedRepo?.fullName || '');
  const [newRepoName, setNewRepoName] = useState<string>(`gitpixel-art-${calendar.year}`);
  const [creatingRepo, setCreatingRepo] = useState<boolean>(false);
  const [confirmedDisclosure, setConfirmedDisclosure] = useState<boolean>(false);
  const [publishMode, setPublishMode] = useState<'publish_ready_and_schedule_future' | 'schedule_only'>(
    'publish_ready_and_schedule_future'
  );
  const [starting, setStarting] = useState<boolean>(false);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  useEffect(() => {
    if (selectedRepo) {
      setSelectedRepoName(selectedRepo.fullName);
    } else if (!selectedRepoName && repos.length > 0) {
      const dedicated = repos.find((r) => r.isDedicatedArtRepo) || repos[0];
      setSelectedRepoName(dedicated.fullName);
      selectRepository(dedicated);
    }
  }, [repos, selectedRepo, selectedRepoName, selectRepository]);

  const plannedDates = useMemo(() => {
    const map = new Map<string, number>();
    for (const [d, lvl] of Object.entries(cells)) {
      if (lvl > 0) map.set(d, getCommitCountForDate(d));
    }
    for (const [d, c] of Object.entries(dateCommits)) {
      if (c > 0) map.set(d, c);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, commits]) => ({
        date,
        commits,
        isFuture: date > todayISO,
      }));
  }, [cells, dateCommits, getCommitCountForDate, todayISO]);

  const readyDates = useMemo(() => plannedDates.filter((d) => !d.isFuture), [plannedDates]);
  const futureDates = useMemo(() => plannedDates.filter((d) => d.isFuture), [plannedDates]);
  const totalCommits = useMemo(
    () => plannedDates.reduce((acc, d) => acc + d.commits, 0),
    [plannedDates]
  );
  const readyCommits = useMemo(
    () => readyDates.reduce((acc, d) => acc + d.commits, 0),
    [readyDates]
  );

  const selectedRepoObj = repos.find((r) => r.fullName === selectedRepoName) || selectedRepo;
  const hasPublishScope = Boolean(
    githubUser && !isDemoMode && githubUser.grantedScopes.includes('public_repo')
  );
  const isDryRunMode = !githubUser || isDemoMode || !hasPublishScope;

  const handleSelectChange = async (fullName: string) => {
    setSelectedRepoName(fullName);
    const found = repos.find((r) => r.fullName === fullName);
    if (found) {
      await selectRepository(found);
    }
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    setCreatingRepo(true);
    try {
      const repo = await createDedicatedRepo(newRepoName.trim());
      setSelectedRepoName(repo.fullName);
    } catch (err: any) {
      notify(err?.message || 'Failed to create dedicated repository.', 'error');
    } finally {
      setCreatingRepo(false);
    }
  };

  const handleStartPublish = async () => {
    if (!confirmedDisclosure) {
      notify('Please confirm the contribution artwork disclosure before proceeding.', 'error');
      return;
    }
    if (!selectedRepoName) {
      notify('Select or create a dedicated artwork repository first.', 'error');
      return;
    }
    if (plannedDates.length === 0) {
      notify('Select dates or paint pixels before publishing.', 'error');
      return;
    }

    setStarting(true);
    try {
      await startPublishJob({
        repositoryId: selectedRepoConnection?.id,
        repositoryName: selectedRepoName,
        branch: selectedRepoObj?.defaultBranch || 'main',
        confirmedDisclosure: true,
        dryRun: isDryRunMode,
        scheduleMode: publishMode,
      });
    } catch (err: any) {
      notify(err?.message || 'Unable to start publishing workflow.', 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-50">Publishing Plan & Review</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Verify target account, repository, branch, ready vs. future scheduled dates, and exact commit operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('scheduler')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#111827] text-xs font-medium text-slate-200"
          >
            <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
            Edit Dates & Commits
          </button>
          <button
            onClick={() => navigate('export')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#111827] text-xs font-medium text-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            Export Image
          </button>
        </div>
      </div>

      {/* Mode Banner */}
      {isDryRunMode && (
        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-indigo-200">
                {!githubUser || isDemoMode
                  ? 'Demo Dry-Run Simulation Active'
                  : 'Read-Only GitHub Session (public_repo scope not yet authorized)'}
              </div>
              <p className="text-slate-400">
                {!githubUser || isDemoMode
                  ? 'You can test the full publishing review, scheduling, and status dashboard as a dry-run simulation without modifying GitHub.'
                  : 'Your GitHub session currently has read:user scope. Authorize public_repo to write commits to your dedicated artwork repository.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => connectGitHub('publish')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0"
          >
            <Github className="w-3.5 h-3.5" />
            Authorize Publishing Scope
          </button>
        </div>
      )}

      {/* Plan Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">GitHub Account</div>
          <div className="text-sm font-mono font-semibold text-slate-100 mt-1 truncate">
            @{githubUser?.login || 'maya-lin-dev'}
          </div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Artwork & Branch</div>
          <div className="text-sm font-semibold text-slate-100 mt-1 truncate">
            {artworkTitle} · <span className="font-mono text-emerald-400">{selectedRepoObj?.defaultBranch || 'main'}</span>
          </div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Ready / Past Dates</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {readyDates.length}
          </div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Future Scheduled</div>
          <div className="text-xl font-bold font-mono tabular-nums text-indigo-400 mt-1">
            {futureDates.length}
          </div>
        </div>
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Total Planned Operations</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-1">
            {totalCommits}
          </div>
        </div>
      </div>

      {/* Final Graph Preview */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Combined Contribution Plan ({calendar.year})</h2>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {plannedDates.length} dates · {totalCommits} total commits
          </span>
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

      {/* Repository Selection + Date Breakdown + Explicit Confirmation */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Target Repo & Selected Date Commit Breakdown */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-100">1. Target Repository & Branch</h2>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-300 block">Selected Repository</label>
            <select
              value={selectedRepoName}
              onChange={(e) => handleSelectChange(e.target.value)}
              disabled={loadingRepos}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100"
            >
              {repos.length === 0 && <option value="">No repositories loaded</option>}
              {repos.map((r) => (
                <option key={r.id} value={r.fullName}>
                  {r.fullName} ({r.defaultBranch}) {r.isDedicatedArtRepo ? '· Dedicated Artwork Repo' : ''}
                </option>
              ))}
            </select>
          </div>

          {((selectedRepoObj && !selectedRepoObj.isDedicatedArtRepo) || repoVerification?.hasUnrelatedFiles) && (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                {repoVerification?.message ||
                  'This repository does not appear to be isolated for artwork. Creating a dedicated repository below is strongly recommended.'}
              </span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <label className="text-xs text-slate-300 block">Or Create Dedicated Artwork Repository</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder={`gitpixel-art-${calendar.year}`}
                className="flex-1 bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
              />
              <button
                onClick={handleCreateRepo}
                disabled={creatingRepo || (!isDryRunMode && !hasPublishScope)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                {creatingRepo ? 'Creating...' : 'Create Repo'}
              </button>
            </div>
          </div>

          {/* Per-Date Operations Breakdown */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Selected Dates & Commit Counts</span>
              <span className="font-mono text-slate-400">{plannedDates.length} dates</span>
            </div>
            <div className="max-h-44 overflow-y-auto bg-[#0B0F17] border border-slate-800 rounded-lg divide-y divide-slate-800/70 text-xs font-mono">
              {plannedDates.length === 0 ? (
                <div className="p-4 text-slate-500 text-center">No dates selected yet.</div>
              ) : (
                plannedDates.map((item) => (
                  <div key={item.date} className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-200">{item.date}</span>
                    <span className="text-slate-400">
                      {item.isFuture ? (
                        <span className="text-indigo-400">Future · Waiting for date</span>
                      ) : (
                        <span className="text-emerald-400">Ready</span>
                      )}
                      <span className="mx-2">·</span>
                      <span className="text-slate-100 font-semibold">{item.commits} commits</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Publishing Mode, Disclaimers & Confirmation */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-100">2. Publishing Mode & Transparency Confirmation</h2>
          </div>

          {/* Publishing Mode Options */}
          <div className="space-y-2">
            <label className="text-xs text-slate-300 block">Choose Action</label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setPublishMode('publish_ready_and_schedule_future')}
                className={`w-full text-left p-3 rounded-lg border text-xs transition-colors ${
                  publishMode === 'publish_ready_and_schedule_future'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-slate-100'
                    : 'bg-[#0B0F17] border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-semibold">
                  Publish Ready Dates Now ({readyCommits} commits) &amp; Schedule Future Dates ({futureDates.length})
                </div>
                <div className="text-slate-400 mt-0.5">
                  Immediately commits eligible dates (&le; {todayISO}) and saves future dates with waiting status.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPublishMode('schedule_only')}
                className={`w-full text-left p-3 rounded-lg border text-xs transition-colors ${
                  publishMode === 'schedule_only'
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-slate-100'
                    : 'bg-[#0B0F17] border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Save &amp; Schedule All Dates Without Immediate Commits
                </div>
                <div className="text-slate-400 mt-0.5">
                  Records all {plannedDates.length} dates in the Status Dashboard so you can trigger ready dates individually later.
                </div>
              </button>
            </div>
          </div>

          {/* Sample Commit Label */}
          <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs font-mono">
            <div className="text-slate-400">Sample generated commit label:</div>
            <div className="text-emerald-400 truncate">
              [GitPixel Art] Contribution artwork pixel {plannedDates[0]?.date || todayISO} (1/
              {plannedDates[0]?.commits || 1})
            </div>
          </div>

          {/* Required Disclaimers */}
          <div className="text-xs text-slate-400 space-y-2 leading-relaxed">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Future dates are never claimed as published before they occur; they remain scheduled until arrival.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Important:</strong> GitHub API commit creation does not guarantee that commits will appear on your GitHub contribution graph (GitHub requires matching verified email, default branch, and repository visibility settings).
              </span>
            </div>
          </div>

          <label className="flex items-start gap-3 p-3.5 rounded-lg bg-[#0B0F17] border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedDisclosure}
              onChange={(e) => setConfirmedDisclosure(e.target.checked)}
              className="mt-0.5 accent-emerald-500"
            />
            <span className="text-xs text-slate-200 leading-relaxed">
              I confirm that all commits for{' '}
              <strong className="font-mono text-emerald-400">{selectedRepoName || 'selected repository'}</strong>{' '}
              are explicitly labeled <code className="text-slate-100">[GitPixel Art]</code>, represent visual artwork rather than genuine development work, and respect rate limits.
            </span>
          </label>

          <button
            onClick={handleStartPublish}
            disabled={!confirmedDisclosure || !selectedRepoName || plannedDates.length === 0 || starting}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            <GitCommitHorizontal className="w-4 h-4" />
            {starting
              ? 'Processing...'
              : publishMode === 'schedule_only'
              ? `Save & Schedule ${plannedDates.length} Date(s)`
              : isDryRunMode
              ? `Run Dry-Run (${readyCommits} ready · ${futureDates.length} scheduled)`
              : `Confirm & Publish ${readyCommits} Commits (${futureDates.length} future scheduled)`}
          </button>
        </div>
      </div>
    </div>
  );
}
