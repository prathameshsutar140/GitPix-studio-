import React, { useMemo, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BoxSelect,
  CalendarRange,
  Check,
  Copy,
  Download,
  Eraser,
  FlipHorizontal,
  FlipVertical,
  GitCommitHorizontal,
  Heart,
  Move,
  Paintbrush,
  PaintBucket,
  Pencil,
  Redo2,
  RotateCw,
  Save,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import { ContributionCanvas } from '../components/ContributionCanvas';
import { useStudio } from '../context/StudioContext';
import type { IntensityLevel, PreviewMode, ShapeType, TextOverlayLayer, ToolType } from '../types/studio';
import { getArtworkStats, PALETTE_THEMES } from '../utils/calendar';
import { renderTextToPixels } from '../utils/pixelFont';
import {
  alignCells,
  applyPixelsToCells,
  flipCellsHorizontal,
  flipCellsVertical,
  getCellsBounds,
  rotateCells90,
  scaleCells,
  shiftCells,
} from '../utils/presets';

const TOOLS: { id: ToolType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'pencil', label: 'Pencil', icon: Pencil },
  { id: 'brush', label: 'Brush', icon: Paintbrush },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
  { id: 'fill', label: 'Fill', icon: PaintBucket },
  { id: 'range', label: 'Range', icon: CalendarRange },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'shape', label: 'Shape', icon: Shapes },
  { id: 'move', label: 'Move', icon: Move },
  { id: 'select', label: 'Select', icon: BoxSelect },
];

const SHAPES: { id: ShapeType; label: string }[] = [
  { id: 'heart', label: 'Heart' },
  { id: 'star', label: 'Star' },
  { id: 'circle', label: 'Circle' },
  { id: 'square', label: 'Square' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'arrow', label: 'Arrow' },
];

export function EditorPage() {
  const {
    selectedYear,
    setSelectedYear,
    calendar,
    cells,
    setCellsWithHistory,
    setCellsLive,
    commitHistoryCheckpoint,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
    activeTool,
    setActiveTool,
    activeIntensity,
    setActiveIntensity,
    brushSize,
    setBrushSize,
    activeShape,
    setActiveShape,
    selectedPresetForStamp,
    setSelectedPresetForStamp,
    selection,
    setSelection,
    previewMode,
    setPreviewMode,
    selectedDayDate,
    setSelectedDayDate,
    textInput,
    setTextInput,
    textSize,
    setTextSize,
    textSpacing,
    setTextSpacing,
    artworkTitle,
    setArtworkTitle,
    saveCurrentArtwork,
    saveCustomPreset,
    getCommitCountForDate,
    setDateCommitCount,
    dateCommits,
    selectedRepo,
    settings,
    navigate,
    notify,
  } = useStudio();

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [textAlignX, setTextAlignX] = useState<'left' | 'center' | 'right'>('center');
  const [textAlignY, setTextAlignY] = useState<'top' | 'center' | 'bottom'>('center');
  const [textLayers, setTextLayers] = useState<TextOverlayLayer[]>([]);

  const [rangeStart, setRangeStart] = useState(`${selectedYear}-03-01`);
  const [rangeEnd, setRangeEnd] = useState(`${selectedYear}-03-14`);

  const [saving, setSaving] = useState(false);

  const theme = PALETTE_THEMES[settings.paletteTheme];
  const stats = useMemo(() => {
    const base = getArtworkStats(calendar, cells, settings.commitsPerLevel);
    let exactCommits = 0;
    for (const [d, lvl] of Object.entries(cells)) {
      if (lvl > 0) exactCommits += getCommitCountForDate(d);
    }
    return {
      ...base,
      plannedCommits: exactCommits,
      estimatedSeconds: Math.ceil(exactCommits * 0.25),
    };
  }, [calendar, cells, dateCommits, getCommitCountForDate, settings.commitsPerLevel]);

  const textPreview = useMemo(() => {
    if (!textInput.trim()) return null;
    return renderTextToPixels(textInput, {
      size: textSize,
      spacing: textSpacing,
      intensity: activeIntensity,
      alignX: textAlignX,
      alignY: textAlignY,
    });
  }, [activeIntensity, textAlignX, textAlignY, textInput, textSize, textSpacing]);

  const handleApplyText = () => {
    if (!textPreview || textPreview.pixels.length === 0) return;
    const dates: string[] = [];
    const next = { ...cells };
    for (const p of textPreview.pixels) {
      const d = calendar.weeks[p.col]?.[p.row];
      if (d && d.inYear) {
        next[d.date] = p.level;
        dates.push(d.date);
      }
    }
    setCellsWithHistory(next);
    setTextLayers((prev) => [
      {
        id: `txt_${Date.now()}`,
        text: textInput.toUpperCase(),
        size: textSize,
        spacing: textSpacing,
        intensity: activeIntensity,
        startCol: textPreview.startCol,
        startRow: textPreview.startRow,
        dates,
      },
      ...prev.slice(0, 5),
    ]);
    notify(`Applied "${textInput.toUpperCase()}" to canvas.`, 'success');
  };

  const handleRemoveTextLayer = (layer: TextOverlayLayer) => {
    const next = { ...cells };
    for (const d of layer.dates) delete next[d];
    setCellsWithHistory(next);
    setTextLayers((prev) => prev.filter((l) => l.id !== layer.id));
    notify(`Removed text layer "${layer.text}".`, 'info');
  };

  const handleApplyDateRange = () => {
    if (!rangeStart || !rangeEnd) return;
    const s = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    const e = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
    const next = { ...cells };
    let count = 0;
    for (const week of calendar.weeks) {
      for (const day of week) {
        if (day.inYear && day.date >= s && day.date <= e) {
          next[day.date] = activeIntensity;
          count++;
        }
      }
    }
    setCellsWithHistory(next);
    notify(`Painted ${count} days from ${s} to ${e}.`, 'success');
  };

  const handleFillSelection = () => {
    if (selection.size === 0) return;
    const next = { ...cells };
    selection.forEach((d) => {
      next[d] = activeIntensity;
    });
    setCellsWithHistory(next);
  };

  const handleClearSelection = () => {
    if (selection.size === 0) return;
    const next = { ...cells };
    selection.forEach((d) => {
      delete next[d];
    });
    setCellsWithHistory(next);
  };

  const handleDuplicateSelection = () => {
    const target: Record<string, IntensityLevel> = {};
    if (selection.size > 0) {
      selection.forEach((d) => {
        if (cells[d]) target[d] = cells[d];
      });
    } else {
      Object.assign(target, cells);
    }
    const shifted = shiftCells(target, calendar, 2, 0);
    setCellsWithHistory({ ...cells, ...shifted.cells });
    notify('Duplicated artwork shifted +2 weeks.', 'success');
  };

  const handleSaveAsPreset = async () => {
    const subset: Record<string, IntensityLevel> = {};
    if (selection.size > 0) {
      selection.forEach((d) => {
        if (cells[d]) subset[d] = cells[d];
      });
    } else {
      Object.assign(subset, cells);
    }
    const bounds = getCellsBounds(subset, calendar);
    if (bounds.empty) {
      notify('Paint at least one cell before saving a custom preset.', 'error');
      return;
    }
    await saveCustomPreset({
      name: `${artworkTitle.slice(0, 24)} Pattern`,
      category: 'custom',
      description: 'Captured from editor canvas',
      width: bounds.width,
      height: bounds.height,
      pixels: bounds.coords.map((c) => ({
        col: c.col - bounds.minCol,
        row: c.row - bounds.minRow,
        level: c.level,
      })),
    });
  };

  const selectedDayObj = useMemo(() => {
    if (!selectedDayDate) return null;
    const coord = calendar.coordByDate[selectedDayDate];
    if (!coord) return null;
    return calendar.weeks[coord.col]?.[coord.row] || null;
  }, [calendar, selectedDayDate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCurrentArtwork(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-5 pb-20 lg:pb-6">
      {/* Top Action Bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
          <input
            type="text"
            aria-label="Artwork title"
            value={artworkTitle}
            onChange={(e) => setArtworkTitle(e.target.value)}
            maxLength={120}
            className="bg-[#0B0F17] border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-100 min-w-[200px] max-w-xs focus:outline-none"
          />
          <select
            aria-label="Calendar year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[#0B0F17] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {[2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {stats.activeDays} days · {stats.plannedCommits} planned commits
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate('scheduler')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
          >
            <CalendarRange className="w-3.5 h-3.5 text-emerald-400" />
            Date Scheduler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Artwork'}
          </button>
          <button
            onClick={() => navigate('export')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={() => navigate('publish-review')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <GitCommitHorizontal className="w-3.5 h-3.5" />
            Review & Publish
          </button>
        </div>
      </div>

      {/* Main 3-Column Studio Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Drawing Tool Rail (Desktop) */}
        <div className="hidden lg:flex xl:col-span-1 flex-col gap-1.5 bg-[#111827] border border-slate-800 rounded-xl p-2">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => {
                  setActiveTool(tool.id);
                  if (tool.id === 'shape') setSelectedPresetForStamp(null);
                }}
                title={tool.label}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-lg text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate max-w-full">{tool.label}</span>
              </button>
            );
          })}

          <div className="my-1 border-t border-slate-800" />

          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <Undo2 className="w-4 h-4" />
            <span>Undo</span>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] text-slate-400 hover:text-slate-100 disabled:opacity-30"
          >
            <Redo2 className="w-4 h-4" />
            <span>Redo</span>
          </button>
          <button
            onClick={() => setConfirmClearOpen(true)}
            title="Clear Canvas"
            className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear</span>
          </button>
        </div>

        {/* Center Contribution Canvas & Live Preview */}
        <div className="xl:col-span-8 space-y-4 min-w-0">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            {/* View Mode & Intensity Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Before / After / Combined / Diff Comparison */}
              <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg overflow-x-auto">
                {(
                  [
                    { id: 'combined', label: 'Combined' },
                    { id: 'artwork', label: 'Artwork Only' },
                    { id: 'original', label: 'Original Graph' },
                    { id: 'diff', label: 'Diff & Overlap' },
                  ] as { id: PreviewMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPreviewMode(m.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      previewMode === m.id
                        ? 'bg-slate-800 text-slate-50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Quick Intensity Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Intensity</span>
                <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
                  {([1, 2, 3, 4] as Exclude<IntensityLevel, 0>[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setActiveIntensity(lvl);
                        if (activeTool === 'eraser') setActiveTool('pencil');
                      }}
                      title={`Level ${lvl}`}
                      className={`w-7 h-7 rounded flex items-center justify-center text-[11px] font-mono font-bold transition-transform ${
                        activeIntensity === lvl && activeTool !== 'eraser'
                          ? 'ring-2 ring-white scale-105'
                          : 'opacity-80 hover:opacity-100'
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
              </div>
            </div>

            {selectedPresetForStamp && activeTool === 'shape' && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                <span>
                  Stamp active: <strong>{selectedPresetForStamp.name}</strong> — click any grid cell to place.
                </span>
                <button
                  onClick={() => setSelectedPresetForStamp(null)}
                  className="text-emerald-200 underline ml-3"
                >
                  Cancel stamp
                </button>
              </div>
            )}

            {/* 53x7 Interactive Canvas */}
            <ContributionCanvas
              calendar={calendar}
              cells={cells}
              previewMode={previewMode}
              paletteTheme={settings.paletteTheme}
              showExistingUnderlay={settings.showExistingUnderlay}
              activeTool={activeTool}
              activeIntensity={activeIntensity}
              brushSize={brushSize}
              activeShape={activeShape}
              selectedPresetForStamp={selectedPresetForStamp}
              textConfig={{ text: textInput, size: textSize, spacing: textSpacing }}
              selection={selection}
              onSelectionChange={setSelection}
              onCellsLive={setCellsLive}
              onCellsCommit={setCellsWithHistory}
              onHistoryCheckpoint={commitHistoryCheckpoint}
              selectedDayDate={selectedDayDate}
              onSelectDay={setSelectedDayDate}
            />
          </div>

          {/* Live Intensity Distribution & Workload */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-400">Intensity Breakdown</div>
              <div className="mt-2 flex items-center gap-2 font-mono text-xs tabular-nums">
                {([1, 2, 3, 4] as Exclude<IntensityLevel, 0>[]).map((lvl) => (
                  <span key={lvl} className="inline-flex items-center gap-1 text-slate-300">
                    <span
                      className="w-2.5 h-2.5 rounded-[2px] inline-block"
                      style={{ backgroundColor: theme.levels[lvl] }}
                    />
                    {stats.distribution[lvl]}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Estimated Workload</div>
              <div className="text-sm font-semibold font-mono tabular-nums text-slate-100 mt-1">
                {stats.plannedCommits} commits (~{stats.estimatedSeconds}s)
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Overlap Detection</div>
              <div
                className={`text-sm font-semibold font-mono tabular-nums mt-1 ${
                  stats.overlapDays > 0 ? 'text-purple-400' : 'text-emerald-400'
                }`}
              >
                {stats.overlapDays} existing active days
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Selected Day Inspector</div>
              {selectedDayObj ? (
                <div className="mt-1 space-y-1">
                  <div className="text-xs font-mono tabular-nums text-slate-200">
                    {selectedDayObj.date} · {selectedDayObj.existingCount} real / L{cells[selectedDayObj.date] ?? 0} art
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-emerald-400">
                      Planned commits: {getCommitCountForDate(selectedDayObj.date)}
                    </span>
                    <input
                      type="number"
                      aria-label="Planned commits for selected day"
                      min={0}
                      max={20}
                      value={getCommitCountForDate(selectedDayObj.date)}
                      onChange={(e) => setDateCommitCount(selectedDayObj.date, Number(e.target.value) || 0)}
                      className="w-12 bg-[#0B0F17] border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-100 text-center"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs font-mono text-slate-400 mt-1">
                  Click a cell · Repo: {selectedRepo?.name || 'Not selected'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Properties & Smart Painting Inspector */}
        <div className="xl:col-span-3 space-y-4">
          {/* Active Tool Properties */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100 capitalize">{activeTool} Options</h2>
              <button
                onClick={() => navigate('presets')}
                className="text-xs text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Presets
              </button>
            </div>

            {activeTool === 'brush' && (
              <div className="space-y-2">
                <span className="text-xs text-slate-400 block">Brush Diameter</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {([1, 2, 3] as (1 | 2 | 3)[]).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setBrushSize(sz)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                        brushSize === sz
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-[#0B0F17] border-slate-800 text-slate-300'
                      }`}
                    >
                      {sz}×{sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTool === 'shape' && (
              <div className="space-y-2">
                <span className="text-xs text-slate-400 block">Select Shape (hover grid to preview)</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {SHAPES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setActiveShape(s.id);
                        setSelectedPresetForStamp(null);
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors text-left ${
                        activeShape === s.id && !selectedPresetForStamp
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#0B0F17] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTool === 'range' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">
                  Drag a rectangle on the calendar or pick exact dates below:
                </p>
                <div className="space-y-2">
                  <label className="block text-[11px] text-slate-400">
                    Start Date
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="mt-1 w-full bg-[#0B0F17] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
                    />
                  </label>
                  <label className="block text-[11px] text-slate-400">
                    End Date
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="mt-1 w-full bg-[#0B0F17] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
                    />
                  </label>
                  <button
                    onClick={handleApplyDateRange}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    Paint Date Range (L{activeIntensity})
                  </button>
                </div>
              </div>
            )}

            {activeTool === 'text' && (
              <div className="space-y-3">
                <label className="block text-xs text-slate-400">
                  Pixel Text
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="CODE, HELLO, DEV..."
                    maxLength={14}
                    className="mt-1 w-full bg-[#0B0F17] border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs font-mono uppercase text-slate-100 focus:outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Font Height</span>
                    <div className="flex gap-1">
                      {(['small', 'tall'] as const).map((sz) => (
                        <button
                          key={sz}
                          onClick={() => setTextSize(sz)}
                          className={`flex-1 py-1 rounded text-xs font-medium border ${
                            textSize === sz
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-[#0B0F17] border-slate-800 text-slate-300'
                          }`}
                        >
                          {sz === 'small' ? '5px' : '7px'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Spacing</span>
                    <div className="flex gap-1">
                      {[1, 2].map((sp) => (
                        <button
                          key={sp}
                          onClick={() => setTextSpacing(sp)}
                          className={`flex-1 py-1 rounded text-xs font-mono border ${
                            textSpacing === sp
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-[#0B0F17] border-slate-800 text-slate-300'
                          }`}
                        >
                          {sp}px
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Horizontal</span>
                    <div className="flex gap-1">
                      {(['left', 'center', 'right'] as const).map((al) => (
                        <button
                          key={al}
                          onClick={() => setTextAlignX(al)}
                          className={`flex-1 py-1 rounded text-[11px] capitalize border ${
                            textAlignX === al
                              ? 'bg-slate-700 border-slate-600 text-white'
                              : 'bg-[#0B0F17] border-slate-800 text-slate-400'
                          }`}
                        >
                          {al[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1">Vertical</span>
                    <div className="flex gap-1">
                      {(['top', 'center', 'bottom'] as const).map((al) => (
                        <button
                          key={al}
                          onClick={() => setTextAlignY(al)}
                          className={`flex-1 py-1 rounded text-[11px] capitalize border ${
                            textAlignY === al
                              ? 'bg-slate-700 border-slate-600 text-white'
                              : 'bg-[#0B0F17] border-slate-800 text-slate-400'
                          }`}
                        >
                          {al[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {textPreview && (
                  <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-2.5 overflow-x-auto">
                    <div className="text-[11px] text-slate-400 mb-1.5 font-mono">
                      Preview ({textPreview.width}×{textPreview.height}px)
                    </div>
                    <div
                      className="grid gap-[2px]"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(textPreview.width, 40)}, 5px)`,
                        gridTemplateRows: `repeat(${textPreview.height}, 5px)`,
                      }}
                    >
                      {Array.from({ length: textPreview.height }).map((_, r) =>
                        Array.from({ length: Math.min(textPreview.width, 40) }).map((__, c) => {
                          const has = textPreview.pixels.some(
                            (p) => p.col - textPreview.startCol === c && p.row - textPreview.startRow === r
                          );
                          return (
                            <span
                              key={`${c}-${r}`}
                              className="w-[5px] h-[5px] rounded-[1px]"
                              style={{ backgroundColor: has ? theme.levels[activeIntensity] : '#161B22' }}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleApplyText}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                >
                  Apply Aligned Text (or click grid)
                </button>

                {textLayers.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="text-[11px] text-slate-400">Placed Text Layers</div>
                    {textLayers.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between text-xs bg-[#0B0F17] px-2.5 py-1.5 rounded border border-slate-800"
                      >
                        <span className="font-mono text-slate-200">{l.text}</span>
                        <button
                          onClick={() => handleRemoveTextLayer(l)}
                          className="text-rose-400 hover:text-rose-300 text-[11px]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(activeTool === 'pencil' ||
              activeTool === 'eraser' ||
              activeTool === 'fill' ||
              activeTool === 'move' ||
              activeTool === 'select') && (
              <p className="text-xs text-slate-400 leading-relaxed">
                {activeTool === 'pencil' && 'Click or drag across calendar cells to paint single pixels.'}
                {activeTool === 'eraser' &&
                  'Erase planned artwork pixels without altering your real GitHub contributions.'}
                {activeTool === 'fill' && 'Click any empty or painted region to flood-fill connected cells.'}
                {activeTool === 'move' &&
                  'Drag anywhere on the grid to shift your artwork or active selection smoothly.'}
                {activeTool === 'select' &&
                  'Drag a marquee box over cells to transform, duplicate, or fill them together.'}
              </p>
            )}

            {selection.size > 0 && (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-indigo-300 font-medium font-mono">
                    {selection.size} cells selected
                  </span>
                  <button
                    onClick={() => setSelection(new Set())}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    Deselect
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={handleFillSelection}
                    className="py-1.5 px-2 rounded bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
                  >
                    Fill L{activeIntensity}
                  </button>
                  <button
                    onClick={handleClearSelection}
                    className="py-1.5 px-2 rounded bg-[#0B0F17] border border-slate-800 hover:border-rose-500/40 text-xs text-rose-300"
                  >
                    Clear Selected
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Smart Transforms */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">Smart Transforms</h2>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setCellsWithHistory(flipCellsHorizontal(cells, calendar, selection))}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                Flip H
              </button>
              <button
                onClick={() => setCellsWithHistory(flipCellsVertical(cells, calendar, selection))}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
              >
                <FlipVertical className="w-3.5 h-3.5" />
                Flip V
              </button>
              <button
                onClick={() => setCellsWithHistory(rotateCells90(cells, calendar, selection))}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Rotate 90°
              </button>
              <button
                onClick={handleDuplicateSelection}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate
              </button>
              <button
                onClick={() => setCellsWithHistory(alignCells(cells, calendar, 'center', 'keep'))}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
              >
                <AlignCenterHorizontal className="w-3.5 h-3.5" />
                Center X
              </button>
              <button
                onClick={() => setCellsWithHistory(alignCells(cells, calendar, 'center', 'center'))}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
              >
                <AlignCenterVertical className="w-3.5 h-3.5" />
                Center All
              </button>
              <button
                onClick={() => setCellsWithHistory(scaleCells(cells, calendar, 1.25, 1))}
                className="py-1.5 px-2 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
              >
                Widen 1.25×
              </button>
              <button
                onClick={() => setCellsWithHistory(scaleCells(cells, calendar, 0.8, 1))}
                className="py-1.5 px-2 rounded-lg bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-xs text-slate-200"
              >
                Compact 0.8×
              </button>
            </div>

            {/* Nudge Controls */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Nudge 1px</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCellsWithHistory(shiftCells(cells, calendar, -1, 0, selection).cells)}
                  aria-label="Nudge left"
                  className="p-1.5 rounded bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-slate-300"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCellsWithHistory(shiftCells(cells, calendar, 0, -1, selection).cells)}
                  aria-label="Nudge up"
                  className="p-1.5 rounded bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-slate-300"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCellsWithHistory(shiftCells(cells, calendar, 0, 1, selection).cells)}
                  aria-label="Nudge down"
                  className="p-1.5 rounded bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-slate-300"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setCellsWithHistory(shiftCells(cells, calendar, 1, 0, selection).cells)}
                  aria-label="Nudge right"
                  className="p-1.5 rounded bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-slate-300"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveAsPreset}
              className="w-full py-2 rounded-lg border border-slate-800 hover:border-indigo-500/40 bg-[#0B0F17] text-xs font-medium text-indigo-300 transition-colors"
            >
              Save Canvas / Selection as Preset
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-[#0E131E]/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex items-center justify-around gap-1 overflow-x-auto no-print">
        {TOOLS.slice(0, 6).map((tool) => {
          const Icon = tool.icon;
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[10px] shrink-0 ${
                active ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="mt-0.5">{tool.label}</span>
            </button>
          );
        })}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex flex-col items-center px-2 py-1.5 text-[10px] text-slate-400 disabled:opacity-30 shrink-0"
        >
          <Undo2 className="w-4 h-4" />
          <span className="mt-0.5">Undo</span>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="flex flex-col items-center px-2 py-1.5 text-[10px] text-slate-400 disabled:opacity-30 shrink-0"
        >
          <Redo2 className="w-4 h-4" />
          <span className="mt-0.5">Redo</span>
        </button>
      </div>

      {/* Clear Confirmation Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-100">Clear Planned Artwork?</h3>
            <p className="text-sm text-slate-400">
              This removes all painted pixels from the current canvas. Your real GitHub contribution data will not be affected, and you can undo anytime.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearCanvas();
                  setConfirmClearOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
              >
                Clear Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
