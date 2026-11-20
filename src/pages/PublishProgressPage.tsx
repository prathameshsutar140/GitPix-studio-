import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  OctagonX,
  Play,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { ScheduleStatus } from '../types/studio';

const STATUS_FILTERS: { id: 'all' | ScheduleStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'waiting_for_date', label: 'Waiting for date' },
  { id: 'ready_for_review', label: 'Ready for review' },
  { id: 'publishing', label: 'Publishing' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
];

const STATUS_LABELS: Record<ScheduleStatus, string> = {
  scheduled: 'Scheduled',
  waiting_for_date: 'Waiting for date',
  ready_for_review: 'Ready for review',
  publishing: 'Publishing',
  published: 'Published',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function PublishProgressPage() {
  const {
    activeJob,
    publishingJobs,
    setActiveJobId,
    cancelPublishJob,
    schedules,
    operations,
    loadingSchedules,
    refreshSchedules,
    cancelSchedule,
    publishScheduleNow,
    navigate,
  } = useStudio();

  const [statusFilter, setStatusFilter] = useState<'all' | ScheduleStatus>('all');
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const filteredSchedules = useMemo(() => {
    if (statusFilter === 'all') return schedules;
    return schedules.filter((s) => s.status === statusFilter);
  }, [schedules, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: schedules.length };
    for (const s of schedules) {
      counts[s.status] = (counts[s.status] || 0) + 1;
    }
    return counts;
  }, [schedules]);

  const pct =
    activeJob && activeJob.totalItems > 0
      ? Math.min(100, Math.round((activeJob.completedItems / activeJob.totalItems) * 100))
      : activeJob?.status === 'completed'
      ? 100
      : 0;
  const remainingItems = activeJob ? Math.max(0, activeJob.totalItems - activeJob.completedItems) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-50">Publishing Status Dashboard</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Track scheduled dates, waiting future plans, active publishing runs, confirmed operation counts, and GitHub result links.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => refreshSchedules()}
            disabled={loadingSchedules}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#111827] text-xs font-medium text-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSchedules ? 'animate-spin' : ''}`} />
            Refresh Status
          </button>
          <button
            onClick={() => navigate('scheduler')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#111827] text-xs font-medium text-slate-200"
          >
            <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
            Date Scheduler
          </button>
          <button
            onClick={() => navigate('publish-review')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New Publish Review
          </button>
        </div>
      </div>

      {/* Active Job Panel (when present) */}
      {activeJob && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 text-sm font-semibold">
                {activeJob.status === 'running' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                {activeJob.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {(activeJob.status === 'failed' || activeJob.status === 'cancelled') && (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className="capitalize text-slate-100">
                  Run Status: {activeJob.status} · {activeJob.repositoryName}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                {activeJob.artworkTitle} · {activeJob.isDryRun ? 'Simulated Dry Run' : 'Live GitHub Repository'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeJob.status === 'running' && (
                <button
                  onClick={() => cancelPublishJob(activeJob.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                >
                  <OctagonX className="w-3.5 h-3.5" />
                  Stop / Cancel
                </button>
              )}
              {activeJob.status === 'completed' && activeJob.repoUrl && !activeJob.isDryRun && (
                <a
                  href={activeJob.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                >
                  Open Repository
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <span className="text-lg font-bold font-mono tabular-nums text-emerald-400 ml-2">{pct}%</span>
            </div>
          </div>

          <div className="w-full h-2.5 bg-[#0B0F17] rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 ${
                activeJob.status === 'failed'
                  ? 'bg-rose-500'
                  : activeJob.status === 'cancelled'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="text-xs text-slate-300 font-mono">{activeJob.currentOperation}</div>

          {activeJob.lastError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200">
              {activeJob.lastError}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80">
            <div>
              <div className="text-xs text-slate-400">Eligible Days</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-100">
                {activeJob.totalItems}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Confirmed Days</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-400">
                {activeJob.completedItems}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Remaining Days</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-200">
                {remainingItems}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Commits Confirmed</div>
              <div className="text-lg font-bold font-mono tabular-nums text-indigo-400">
                {activeJob.completedCommits} / {activeJob.totalCommitsPlanned}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled & Per-Date Contribution Operations Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-100">
            Scheduled &amp; Published Contribution Dates
          </h2>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {schedules.length} total · {operations.length} operation logs
          </span>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            const count = statusCounts[f.id] || 0;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#0B0F17] text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {f.label} <span className="font-mono tabular-nums opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {filteredSchedules.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg space-y-2">
            <div>No contribution schedules match the selected status filter.</div>
            <button
              onClick={() => navigate('scheduler')}
              className="text-emerald-400 hover:underline font-medium"
            >
              Open Date Scheduler to configure dates →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 pr-4 font-medium">Planned Date</th>
                  <th className="py-2.5 pr-4 font-medium">Repository</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium">Confirmed / Remaining</th>
                  <th className="py-2.5 pr-4 font-medium">Last Updated</th>
                  <th className="py-2.5 text-right font-medium">Actions &amp; Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredSchedules.map((sched) => {
                  const confirmed = sched.confirmedOperations ?? (sched.status === 'published' ? sched.plannedCommitCount : 0);
                  const remaining =
                    sched.remainingOperations ?? Math.max(0, sched.plannedCommitCount - confirmed);
                  const isFuture = sched.selectedDate > todayISO;
                  const canPublishNow =
                    !isFuture &&
                    (sched.status === 'ready_for_review' ||
                      sched.status === 'scheduled' ||
                      sched.status === 'waiting_for_date' ||
                      sched.status === 'failed');
                  const canCancel = sched.status !== 'published' && sched.status !== 'cancelled';

                  return (
                    <tr key={sched.id} className="hover:bg-slate-800/25">
                      <td className="py-3 pr-4 font-mono tabular-nums text-slate-100 whitespace-nowrap">
                        {sched.selectedDate}
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-300 max-w-[200px] truncate">
                        {sched.repositoryName || sched.repositoryId}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-medium ${
                            sched.status === 'published'
                              ? 'text-emerald-400'
                              : sched.status === 'publishing'
                              ? 'text-indigo-400'
                              : sched.status === 'waiting_for_date' || sched.status === 'scheduled'
                              ? 'text-cyan-300'
                              : sched.status === 'ready_for_review'
                              ? 'text-amber-300'
                              : sched.status === 'failed'
                              ? 'text-rose-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {sched.status === 'waiting_for_date' && <Clock className="w-3.5 h-3.5" />}
                          {sched.status === 'published' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {sched.status === 'publishing' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {sched.status === 'failed' && <AlertCircle className="w-3.5 h-3.5" />}
                          {sched.status === 'cancelled' && <XCircle className="w-3.5 h-3.5" />}
                          {STATUS_LABELS[sched.status]}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono tabular-nums text-slate-200 whitespace-nowrap">
                        <span className="text-emerald-400">{confirmed}</span> / {sched.plannedCommitCount} commits
                        <span className="text-slate-500 ml-2">({remaining} left)</span>
                      </td>
                      <td className="py-3 pr-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                        {new Date(sched.updatedAt).toLocaleString()}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {sched.githubResultUrl && (
                            <a
                              href={sched.githubResultUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-400 hover:underline"
                            >
                              Commit
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          {canPublishNow && (
                            <button
                              onClick={() => publishScheduleNow(sched.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                            >
                              <Play className="w-3 h-3" />
                              Publish Now
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => cancelSchedule(sched.id)}
                              className="px-2 py-1 rounded border border-slate-700 hover:border-rose-500/40 text-slate-300 hover:text-rose-300"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Operation Log & Recent Publishing Runs */}
      {activeJob && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">Active Job Operation Log</h2>
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2 font-mono text-xs">
              {activeJob.logs.map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 ${
                    entry.type === 'error'
                      ? 'text-rose-400'
                      : entry.type === 'warning'
                      ? 'text-amber-300'
                      : entry.type === 'success'
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-500 shrink-0 tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span>{entry.message}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">Recent Publishing Runs</h2>
            {publishingJobs.length === 0 ? (
              <div className="text-xs text-slate-500">No publishing runs recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
                {publishingJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => setActiveJobId(job.id)}
                    className={`w-full py-2.5 px-2 flex items-center justify-between text-left text-xs hover:bg-slate-800/40 rounded transition-colors ${
                      job.id === activeJob.id ? 'text-emerald-400' : 'text-slate-300'
                    }`}
                  >
                    <span className="font-medium truncate">
                      {job.artworkTitle} → <span className="font-mono">{job.repositoryName}</span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-400 shrink-0 ml-4">
                      {job.completedItems}/{job.totalItems} · {job.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
