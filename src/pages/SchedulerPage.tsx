import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  GitCommitHorizontal,
  Grid3X3,
  Info,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { ContributionCanvas } from '../components/ContributionCanvas';
import { useStudio } from '../context/StudioContext';
import type { DateSelectionMode, PreviewMode } from '../types/studio';

const SELECTION_MODES: { id: DateSelectionMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'single', label: 'Single Date', icon: Calendar },
  { id: 'multiple', label: 'Multiple Dates', icon: CalendarDays },
  { id: 'range', label: 'Date Range', icon: CalendarRange },
  { id: 'custom', label: 'Custom Calendar', icon: Grid3X3 },
];

function formatHumanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function enumerateDatesInclusive(start: string, end: string): string[] {
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;
  const result: string[] = [];
  const cur = new Date(`${s}T00:00:00Z`);
  const stop = new Date(`${e}T00:00:00Z`);
  let guard = 0;
  while (cur <= stop && guard < 370) {
    result.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  return result;
}

export function SchedulerPage() {
  const {
    calendar,
    selectedYear,
    setSelectedYear,
    cells,
    selectedRepo,
    dateCommits,
    getCommitCountForDate,
    setDateCommitCount,
    setBulkDateCommits,
    removeScheduledDate,
    saveSchedulesToStore,
    settings,
    navigate,
    notify,
  } = useStudio();

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [mode, setMode] = useState<DateSelectionMode>('multiple');
  const [singleDate, setSingleDate] = useState<string>(todayISO);
  const [multiInputDate, setMultiInputDate] = useState<string>(todayISO);
  const [rangeStart, setRangeStart] = useState<string>(todayISO);
  const [rangeEnd, setRangeEnd] = useState<string>(`${selectedYear}-11-27`);
  const [excludedRangeDates, setExcludedRangeDates] = useState<Set<string>>(new Set());
  const [bulkCommitCount, setBulkCommitCount] = useState<number>(3);
  const [graphPreviewMode, setGraphPreviewMode] = useState<PreviewMode>('combined');
  const [savingSchedules, setSavingSchedules] = useState(false);

  // Maintain active scheduled dates derived from cells + dateCommits + explicitly selected dates
  const [selectedDates, setSelectedDates] = useState<string[]>(() => {
    const initial = new Set<string>();
    for (const [d, lvl] of Object.entries(cells)) {
      if (lvl > 0) initial.add(d);
    }
    for (const [d, count] of Object.entries(dateCommits)) {
      if (count > 0) initial.add(d);
    }
    return Array.from(initial).sort();
  });

  const highlightedSet = useMemo(() => new Set(selectedDates), [selectedDates]);

  const rangeAllDates = useMemo(
    () => enumerateDatesInclusive(rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );

  const rangeActiveDates = useMemo(
    () => rangeAllDates.filter((d) => !excludedRangeDates.has(d)),
    [excludedRangeDates, rangeAllDates]
  );

  const toggleDateSelection = (date: string) => {
    setSelectedDates((prev) => {
      if (prev.includes(date)) {
        return prev.filter((d) => d !== date);
      }
      if (getCommitCountForDate(date) === 0) {
        setDateCommitCount(date, bulkCommitCount);
      }
      return [...prev, date].sort();
    });
  };

  const applySingleDate = () => {
    if (!singleDate) return;
    setSelectedDates([singleDate]);
    setDateCommitCount(singleDate, bulkCommitCount);
    notify(`Configured ${formatHumanDate(singleDate)} with ${bulkCommitCount} planned commits.`, 'success');
  };

  const addMultipleDate = () => {
    if (!multiInputDate) return;
    if (!selectedDates.includes(multiInputDate)) {
      setSelectedDates((prev) => [...prev, multiInputDate].sort());
    }
    if (getCommitCountForDate(multiInputDate) === 0) {
      setDateCommitCount(multiInputDate, bulkCommitCount);
    }
  };

  const applyRangeSelection = () => {
    if (rangeActiveDates.length === 0) {
      notify('Include at least one date in the range.', 'error');
      return;
    }
    const merged = Array.from(new Set([...selectedDates, ...rangeActiveDates])).sort();
    setSelectedDates(merged);
    setBulkDateCommits(rangeActiveDates, bulkCommitCount);
    notify(
      `Added ${rangeActiveDates.length} date(s) with ${bulkCommitCount} commit(s) per day.`,
      'success'
    );
  };

  const handleRemoveDate = (date: string) => {
    setSelectedDates((prev) => prev.filter((d) => d !== date));
    removeScheduledDate(date);
  };

  const handleApplyBulkToSelected = () => {
    if (selectedDates.length === 0) return;
    setBulkDateCommits(selectedDates, bulkCommitCount);
    notify(`Updated all ${selectedDates.length} selected date(s) to ${bulkCommitCount} commit(s).`, 'success');
  };

  const syncFromPaintedCanvas = () => {
    const painted = Object.entries(cells)
      .filter(([, lvl]) => lvl > 0)
      .map(([d]) => d)
      .sort();
    setSelectedDates(painted);
    notify(`Loaded ${painted.length} painted artwork dates from Graph Editor.`, 'info');
  };

  const dateBreakdown = useMemo(() => {
    let pastCount = 0;
    let todayCount = 0;
    let futureCount = 0;
    let totalCommits = 0;

    const rows = selectedDates.map((d) => {
      const commits = Math.max(1, getCommitCountForDate(d) || 1);
      totalCommits += commits;
      const timing: 'past' | 'today' | 'future' =
        d < todayISO ? 'past' : d === todayISO ? 'today' : 'future';
      if (timing === 'past') pastCount++;
      else if (timing === 'today') todayCount++;
      else futureCount++;
      return { date: d, commits, timing };
    });

    const estimatedSeconds = Math.ceil(totalCommits * 0.25);
    return { rows, pastCount, todayCount, futureCount, totalCommits, estimatedSeconds };
  }, [getCommitCountForDate, selectedDates, todayISO]);

  const handleSaveSchedules = async () => {
    if (selectedDates.length === 0) {
      notify('Select at least one date first.', 'error');
      return;
    }
    setSavingSchedules(true);
    try {
      await saveSchedulesToStore(selectedDates);
    } finally {
      setSavingSchedules(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-50">
            Contribution Date Scheduler & Commit Planner
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Choose single, multiple, range, or full-year calendar dates, configure commit counts, and preview live graph changes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono text-slate-300">
            Target: <span className="text-emerald-400">{selectedRepo?.fullName || 'No repository selected'}</span>
          </div>
          <button
            onClick={syncFromPaintedCanvas}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#111827] text-xs font-medium text-slate-200 transition-colors"
          >
            Sync From Painted Canvas
          </button>
        </div>
      </div>

      {/* Mode Selector + Timing Rules */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Date Selection Modes */}
        <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-100">1. Date Selection Mode</h2>
            <select
              aria-label="Scheduler calendar year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-[#0B0F17] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
            >
              {[2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SELECTION_MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-[#0B0F17] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mode A: Single Date */}
          {mode === 'single' && (
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 space-y-3">
              <label className="block text-xs text-slate-300">
                Select Specific Date
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="mt-1.5 w-full bg-[#111827] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                />
              </label>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Selected: {formatHumanDate(singleDate)}</span>
                <span className="font-mono text-emerald-400">
                  {singleDate > todayISO ? 'Future (Scheduled)' : singleDate === todayISO ? 'Today' : 'Past Date'}
                </span>
              </div>
              <button
                type="button"
                onClick={applySingleDate}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                Set Single Date ({bulkCommitCount} commits)
              </button>
            </div>
          )}

          {/* Mode B: Multiple Dates */}
          {mode === 'multiple' && (
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 space-y-3">
              <label className="block text-xs text-slate-300">Add Individual Dates</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={multiInputDate}
                  onChange={(e) => setMultiInputDate(e.target.value)}
                  className="flex-1 bg-[#111827] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100"
                />
                <button
                  type="button"
                  onClick={addMultipleDate}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Date
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                You can also click any square directly on the Contribution Calendar preview below to toggle dates.
              </p>
            </div>
          )}

          {/* Mode C: Date Range with Exclusions */}
          {mode === 'range' && (
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-slate-300">
                  Start Date
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="mt-1 w-full bg-[#111827] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                  />
                </label>
                <label className="block text-xs text-slate-300">
                  End Date
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="mt-1 w-full bg-[#111827] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-100"
                  />
                </label>
              </div>

              {rangeAllDates.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Click any date below to exclude or include it</span>
                    <span className="font-mono tabular-nums">
                      {rangeActiveDates.length} / {rangeAllDates.length} included
                    </span>
                  </div>
                  <div className="max-h-32 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 bg-[#111827] border border-slate-800 rounded-lg">
                    {rangeAllDates.slice(0, 90).map((d) => {
                      const excluded = excludedRangeDates.has(d);
                      return (
                        <label
                          key={d}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono cursor-pointer ${
                            excluded ? 'text-slate-500 line-through' : 'text-slate-200 bg-slate-800/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!excluded}
                            onChange={() => {
                              setExcludedRangeDates((prev) => {
                                const next = new Set(prev);
                                if (next.has(d)) next.delete(d);
                                else next.add(d);
                                return next;
                              });
                            }}
                            className="accent-emerald-500"
                          />
                          <span>{d}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={applyRangeSelection}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
              >
                Add {rangeActiveDates.length} Range Date(s) ({bulkCommitCount} commits/day)
              </button>
            </div>
          )}

          {/* Mode D: Custom Calendar */}
          {mode === 'custom' && (
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 space-y-2 text-xs text-slate-300">
              <div className="font-medium text-emerald-400">Custom Full-Year Calendar Mode Active</div>
              <p className="text-slate-400 leading-relaxed">
                Click individual cells directly on the {selectedYear} Contribution Calendar below to select or deselect dates. Highlighted cells show a cyan border.
              </p>
            </div>
          )}

          {/* Past / Future Transparency Notices */}
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/30 text-slate-300 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-indigo-200">Future Dates Are Scheduled, Never Prematurely Published</div>
                <p className="text-slate-400 leading-relaxed">
                  Future dates (&gt; {todayISO}) cannot appear on GitHub&apos;s calendar before those dates occur. They are saved with{' '}
                  <span className="font-mono text-indigo-300">waiting_for_date</span> status until ready.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-950/25 border border-amber-500/30 text-slate-300 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-amber-200">Past Date Attribution Requirements</div>
                <p className="text-slate-400 leading-relaxed">
                  GitHub&apos;s contribution graph requires verified commit emails, default-branch inclusion, and profile settings. Created commits do not guarantee historical calendar updates.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Dedicated Commit Count Configuration Panel */}
        <div className="lg:col-span-6 bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">2. Commit Count Configuration</h2>
            <span className="text-xs font-mono tabular-nums text-emerald-400">
              Total planned artwork commits: {dateBreakdown.totalCommits}
            </span>
          </div>

          {/* Default / Bulk Commit Count */}
          <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <div className="text-slate-200 font-medium">Commits per added/selected date (1–20)</div>
              <div className="text-slate-500">All commits carry transparent [GitPixel Art] labels.</div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={bulkCommitCount}
                onChange={(e) => setBulkCommitCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-16 bg-[#111827] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-100 text-center"
              />
              <button
                type="button"
                onClick={handleApplyBulkToSelected}
                disabled={selectedDates.length === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 disabled:opacity-40 text-xs font-medium text-slate-200"
              >
                Apply to All ({selectedDates.length})
              </button>
            </div>
          </div>

          {/* Per-Date List */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {dateBreakdown.rows.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                No dates selected yet. Add dates on the left or click cells on the calendar grid below.
              </div>
            ) : (
              dateBreakdown.rows.map((row) => (
                <div
                  key={row.date}
                  className="bg-[#0B0F17] border border-slate-800 rounded-lg px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-100">
                      {formatHumanDate(row.date)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {row.date}
                      <span className="mx-1.5">·</span>
                      <span
                        className={
                          row.timing === 'future'
                            ? 'text-indigo-400'
                            : row.timing === 'today'
                            ? 'text-emerald-400'
                            : 'text-amber-300'
                        }
                      >
                        {row.timing === 'future'
                          ? 'Scheduled (future)'
                          : row.timing === 'today'
                          ? 'Ready today'
                          : 'Past date'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Planned commits:</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={row.commits}
                        onChange={(e) => setDateCommitCount(row.date, Number(e.target.value) || 1)}
                        className="w-14 bg-[#111827] border border-slate-700 rounded px-2 py-1 text-xs font-mono tabular-nums text-emerald-400 text-center"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveDate(row.date)}
                      title="Remove date"
                      className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Workload Summary & Safety */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3">
              <div className="text-slate-400">Ready / Past</div>
              <div className="font-mono tabular-nums text-base font-bold text-emerald-400 mt-0.5">
                {dateBreakdown.pastCount + dateBreakdown.todayCount}
              </div>
            </div>
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3">
              <div className="text-slate-400">Future Scheduled</div>
              <div className="font-mono tabular-nums text-base font-bold text-indigo-400 mt-0.5">
                {dateBreakdown.futureCount}
              </div>
            </div>
            <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3">
              <div className="text-slate-400">Est. Workload</div>
              <div className="font-mono tabular-nums text-base font-bold text-slate-100 mt-0.5">
                ~{dateBreakdown.estimatedSeconds}s
              </div>
            </div>
          </div>

          {dateBreakdown.totalCommits > 250 && (
            <div className="p-3 rounded-lg bg-rose-950/35 border border-rose-500/35 text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Immediate batch limit is 250 commits per run to respect GitHub API rate limits. Reduce per-day commit counts or split across schedules.
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleSaveSchedules}
              disabled={savingSchedules || selectedDates.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] disabled:opacity-40 text-xs font-semibold text-slate-100 transition-colors"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              {savingSchedules ? 'Saving...' : 'Save Schedule Plan'}
            </button>
            <button
              type="button"
              onClick={() => navigate('editor')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] text-xs font-medium text-slate-200 transition-colors"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Paint Artwork
            </button>
            <button
              type="button"
              onClick={() => navigate('publish-review')}
              disabled={selectedDates.length === 0}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
            >
              <GitCommitHorizontal className="w-4 h-4" />
              Review & Confirm
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Integrated 3-State Contribution Graph Preview */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Live Contribution Calendar Integration ({selectedYear})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any cell to toggle date selection. Cyan outlines mark currently scheduled dates; existing GitHub contributions stay preserved.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
            {(
              [
                { id: 'original', label: 'Actual GitHub' },
                { id: 'artwork', label: 'Planned Artwork' },
                { id: 'combined', label: 'Combined Preview' },
              ] as { id: PreviewMode; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGraphPreviewMode(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  graphPreviewMode === tab.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <ContributionCanvas
          calendar={calendar}
          cells={cells}
          previewMode={graphPreviewMode}
          paletteTheme={settings.paletteTheme}
          showExistingUnderlay={settings.showExistingUnderlay}
          highlightedDates={highlightedSet}
          onDayClickOverride={toggleDateSelection}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Preview operations format:{' '}
              <code className="text-emerald-400">
                [GitPixel Art] Contribution artwork pixel {selectedDates[0] || todayISO}
              </code>
            </span>
          </div>
          <span className="font-mono tabular-nums">
            {selectedDates.length} date(s) highlighted
          </span>
        </div>
      </div>
    </div>
  );
}
