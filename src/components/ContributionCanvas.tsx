import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Move, Hand, Paintbrush } from 'lucide-react';
import type {
  ArtworkCells,
  CalendarDay,
  ContributionCalendar,
  GridCoord,
  IntensityLevel,
  PaletteTheme,
  PixelPreset,
  PreviewMode,
  ShapeType,
  ToolType,
} from '../types/studio';
import { getCellVisualState, PALETTE_THEMES } from '../utils/calendar';
import { renderTextToPixels } from '../utils/pixelFont';
import {
  applyPixelsToCells,
  floodFillCells,
  generateShapePixels,
  shiftCells,
} from '../utils/presets';

interface ContributionCanvasProps {
  calendar: ContributionCalendar;
  cells: ArtworkCells;
  previewMode: PreviewMode;
  paletteTheme: PaletteTheme;
  showExistingUnderlay: boolean;
  readOnly?: boolean;
  activeTool?: ToolType;
  activeIntensity?: Exclude<IntensityLevel, 0>;
  brushSize?: 1 | 2 | 3;
  activeShape?: ShapeType;
  selectedPresetForStamp?: PixelPreset | null;
  textConfig?: { text: string; size: 'small' | 'tall'; spacing: number };
  selection?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  onCellsLive?: (next: ArtworkCells) => void;
  onCellsCommit?: (next: ArtworkCells) => void;
  onHistoryCheckpoint?: (snapshotBeforeDrag: ArtworkCells) => void;
  selectedDayDate?: string | null;
  onSelectDay?: (date: string) => void;
  highlightedDates?: Set<string>;
  onDayClickOverride?: (date: string) => void;
}

const WEEKDAY_LABELS = [
  { row: 1, label: 'Mon' },
  { row: 3, label: 'Wed' },
  { row: 5, label: 'Fri' },
];

export function ContributionCanvas({
  calendar,
  cells,
  previewMode,
  paletteTheme,
  showExistingUnderlay,
  readOnly = false,
  activeTool = 'pencil',
  activeIntensity = 3,
  brushSize = 2,
  activeShape = 'heart',
  selectedPresetForStamp = null,
  textConfig,
  selection,
  onSelectionChange,
  onCellsLive,
  onCellsCommit,
  onHistoryCheckpoint,
  selectedDayDate,
  onSelectDay,
  highlightedDates,
  onDayClickOverride,
}: ContributionCanvasProps) {
  const theme = PALETTE_THEMES[paletteTheme];
  const [hoverDay, setHoverDay] = useState<CalendarDay | null>(null);
  const [touchMode, setTouchMode] = useState<'paint' | 'scroll'>('paint');

  const isDraggingRef = useRef(false);
  const dragStartCoordRef = useRef<GridCoord | null>(null);
  const snapshotBeforeDragRef = useRef<ArtworkCells | null>(null);
  const lastMoveDeltaRef = useRef<{ dCol: number; dRow: number }>({ dCol: 0, dRow: 0 });
  const eraseModeRef = useRef(false);

  const [dragBox, setDragBox] = useState<{ start: GridCoord; end: GridCoord } | null>(null);

  // Ghost preview coords for Text / Shape tools
  const ghostMap = useMemo(() => {
    const map = new Map<string, Exclude<IntensityLevel, 0>>();
    if (readOnly || !hoverDay) return map;

    if (activeTool === 'text' && textConfig?.text.trim()) {
      const rendered = renderTextToPixels(textConfig.text, {
        size: textConfig.size,
        spacing: textConfig.spacing,
        intensity: activeIntensity,
        alignX: 'custom',
        alignY: 'custom',
        customCol: hoverDay.col,
        customRow: hoverDay.row,
      });
      for (const p of rendered.pixels) {
        map.set(`${p.col},${p.row}`, p.level);
      }
    } else if (activeTool === 'shape') {
      const pixels = selectedPresetForStamp
        ? selectedPresetForStamp.pixels
        : generateShapePixels(activeShape, activeIntensity).pixels;
      for (const p of pixels) {
        const c = p.col + hoverDay.col;
        const r = p.row + hoverDay.row;
        if (c >= 0 && c < 53 && r >= 0 && r < 7) {
          map.set(`${c},${r}`, selectedPresetForStamp ? p.level : activeIntensity);
        }
      }
    } else if (activeTool === 'brush') {
      const radius = brushSize === 1 ? 0 : 1;
      for (let dc = 0; dc < (brushSize === 3 ? 3 : brushSize === 2 ? 2 : 1); dc++) {
        for (let dr = 0; dr < (brushSize === 3 ? 3 : brushSize === 2 ? 2 : 1); dr++) {
          const c = hoverDay.col + dc - (brushSize === 3 ? radius : 0);
          const r = hoverDay.row + dr - (brushSize === 3 ? radius : 0);
          if (c >= 0 && c < 53 && r >= 0 && r < 7) {
            map.set(`${c},${r}`, activeIntensity);
          }
        }
      }
    }
    return map;
  }, [activeIntensity, activeShape, activeTool, brushSize, hoverDay, readOnly, selectedPresetForStamp, textConfig]);

  const paintBrushAt = useCallback(
    (baseCells: ArtworkCells, col: number, row: number, level: IntensityLevel): ArtworkCells => {
      const next = { ...baseCells };
      const span = activeTool === 'brush' ? brushSize : 1;
      const offset = span === 3 ? -1 : 0;

      for (let dc = 0; dc < span; dc++) {
        for (let dr = 0; dr < span; dr++) {
          const c = col + dc + offset;
          const r = row + dr + offset;
          if (c < 0 || c >= 53 || r < 0 || r >= 7) continue;
          const d = calendar.weeks[c]?.[r];
          if (!d || !d.inYear) continue;
          if (level === 0) delete next[d.date];
          else next[d.date] = level;
        }
      }
      return next;
    },
    [activeTool, brushSize, calendar.weeks]
  );

  const handlePointerDown = (day: CalendarDay, e: React.PointerEvent) => {
    onSelectDay?.(day.date);
    if (onDayClickOverride && day.inYear) {
      e.preventDefault();
      onDayClickOverride(day.date);
      return;
    }
    if (readOnly || !day.inYear) return;
    if (e.pointerType === 'touch' && touchMode === 'scroll') return;
    e.preventDefault();

    const isRightClick = e.button === 2;
    isDraggingRef.current = true;
    dragStartCoordRef.current = { col: day.col, row: day.row };
    snapshotBeforeDragRef.current = { ...cells };
    lastMoveDeltaRef.current = { dCol: 0, dRow: 0 };

    if (activeTool === 'fill') {
      const fillLvl: IntensityLevel = isRightClick ? 0 : activeIntensity;
      const next = floodFillCells(cells, calendar, { col: day.col, row: day.row }, fillLvl);
      onCellsCommit?.(next);
      isDraggingRef.current = false;
      return;
    }

    if (activeTool === 'text') {
      if (!textConfig?.text.trim()) return;
      const rendered = renderTextToPixels(textConfig.text, {
        size: textConfig.size,
        spacing: textConfig.spacing,
        intensity: activeIntensity,
        alignX: 'custom',
        alignY: 'custom',
        customCol: day.col,
        customRow: day.row,
      });
      const next = applyPixelsToCells(cells, rendered.pixels, calendar, 0, 0, false);
      onCellsCommit?.(next);
      isDraggingRef.current = false;
      return;
    }

    if (activeTool === 'shape') {
      const pixels = selectedPresetForStamp
        ? selectedPresetForStamp.pixels
        : generateShapePixels(activeShape, activeIntensity).pixels;
      const next = applyPixelsToCells(cells, pixels, calendar, day.col, day.row, false);
      onCellsCommit?.(next);
      isDraggingRef.current = false;
      return;
    }

    if (activeTool === 'range' || activeTool === 'select') {
      setDragBox({ start: { col: day.col, row: day.row }, end: { col: day.col, row: day.row } });
      return;
    }

    if (activeTool === 'move') {
      return;
    }

    // Pencil, Brush, Eraser
    const shouldErase = isRightClick || activeTool === 'eraser';
    eraseModeRef.current = shouldErase;
    const targetLevel: IntensityLevel = shouldErase ? 0 : activeIntensity;
    const next = paintBrushAt(cells, day.col, day.row, targetLevel);
    onCellsLive?.(next);
  };

  const handlePointerEnter = (day: CalendarDay) => {
    setHoverDay(day);
    if (!isDraggingRef.current || readOnly || !day.inYear) return;

    if (activeTool === 'range' || activeTool === 'select') {
      if (dragStartCoordRef.current) {
        setDragBox({ start: dragStartCoordRef.current, end: { col: day.col, row: day.row } });
      }
      return;
    }

    if (activeTool === 'move' && dragStartCoordRef.current && snapshotBeforeDragRef.current) {
      const dCol = day.col - dragStartCoordRef.current.col;
      const dRow = day.row - dragStartCoordRef.current.row;
      if (dCol !== lastMoveDeltaRef.current.dCol || dRow !== lastMoveDeltaRef.current.dRow) {
        lastMoveDeltaRef.current = { dCol, dRow };
        const moved = shiftCells(snapshotBeforeDragRef.current, calendar, dCol, dRow, selection);
        onCellsLive?.(moved.cells);
      }
      return;
    }

    if (activeTool === 'pencil' || activeTool === 'brush' || activeTool === 'eraser') {
      const targetLevel: IntensityLevel = eraseModeRef.current ? 0 : activeIntensity;
      const next = paintBrushAt(cells, day.col, day.row, targetLevel);
      onCellsLive?.(next);
    }
  };

  const finalizeDrag = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if ((activeTool === 'range' || activeTool === 'select') && dragBox) {
      const minC = Math.min(dragBox.start.col, dragBox.end.col);
      const maxC = Math.max(dragBox.start.col, dragBox.end.col);
      const minR = Math.min(dragBox.start.row, dragBox.end.row);
      const maxR = Math.max(dragBox.start.row, dragBox.end.row);

      if (activeTool === 'select') {
        const nextSel = new Set<string>();
        for (let c = minC; c <= maxC; c++) {
          for (let r = minR; r <= maxR; r++) {
            const d = calendar.weeks[c]?.[r];
            if (d && d.inYear) nextSel.add(d.date);
          }
        }
        onSelectionChange?.(nextSel);
      } else if (activeTool === 'range') {
        const next = { ...cells };
        for (let c = minC; c <= maxC; c++) {
          for (let r = minR; r <= maxR; r++) {
            const d = calendar.weeks[c]?.[r];
            if (d && d.inYear) {
              next[d.date] = activeIntensity;
            }
          }
        }
        onCellsCommit?.(next);
      }
      setDragBox(null);
      dragStartCoordRef.current = null;
      return;
    }

    if (activeTool === 'move' && snapshotBeforeDragRef.current) {
      const { dCol, dRow } = lastMoveDeltaRef.current;
      if (dCol !== 0 || dRow !== 0) {
        const moved = shiftCells(snapshotBeforeDragRef.current, calendar, dCol, dRow, selection);
        onHistoryCheckpoint?.(snapshotBeforeDragRef.current);
        onCellsLive?.(moved.cells);
        if (moved.nextSelection) onSelectionChange?.(moved.nextSelection);
      }
      snapshotBeforeDragRef.current = null;
      return;
    }

    if (snapshotBeforeDragRef.current) {
      onHistoryCheckpoint?.(snapshotBeforeDragRef.current);
      snapshotBeforeDragRef.current = null;
    }
  }, [
    activeIntensity,
    activeTool,
    calendar,
    cells,
    dragBox,
    onCellsCommit,
    onCellsLive,
    onHistoryCheckpoint,
    onSelectionChange,
    selection,
  ]);

  const hoverState = hoverDay
    ? getCellVisualState(hoverDay, cells, previewMode, showExistingUnderlay)
    : null;

  return (
    <div
      className="select-none"
      onPointerUp={finalizeDrag}
      onPointerLeave={() => {
        setHoverDay(null);
        finalizeDrag();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Mobile Touch Interaction Mode Switch */}
      {!readOnly && (
        <div className="flex sm:hidden items-center justify-between gap-2 mb-3 px-1">
          <span className="text-xs text-slate-400">Touch gesture mode</span>
          <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setTouchMode('paint')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                touchMode === 'paint' ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              Paint
            </button>
            <button
              type="button"
              onClick={() => setTouchMode('scroll')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                touchMode === 'scroll' ? 'bg-indigo-600 text-white' : 'text-slate-400'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              Scroll
            </button>
          </div>
        </div>
      )}

      {/* Horizontally scrollable 53x7 grid container */}
      <div
        className={`overflow-x-auto pb-2 ${
          !readOnly && touchMode === 'paint' ? 'touch-pan-y sm:touch-auto' : ''
        }`}
      >
        <div
          className="inline-block rounded-xl p-4 border transition-colors"
          style={{ backgroundColor: theme.bg, borderColor: theme.border }}
        >
          {/* Month Headers */}
          <div className="flex items-center mb-1.5 pl-9 relative h-4 min-w-[742px]">
            {calendar.monthLabels.map((m) => (
              <span
                key={`${m.label}-${m.col}`}
                className="text-[11px] font-medium text-slate-400 absolute"
                style={{ left: `${36 + m.col * 14}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-2">
            {/* Weekday Labels */}
            <div className="flex flex-col gap-[3px] w-7 shrink-0 pt-[1px]">
              {[0, 1, 2, 3, 4, 5, 6].map((row) => {
                const found = WEEKDAY_LABELS.find((w) => w.row === row);
                return (
                  <div
                    key={row}
                    className="h-[11px] text-[10px] leading-[11px] text-slate-400 text-right pr-1"
                  >
                    {found ? found.label : ''}
                  </div>
                );
              })}
            </div>

            {/* 53 Weeks x 7 Days Matrix */}
            <div
              className={`grid grid-flow-col gap-[3px] ${
                readOnly
                  ? 'cursor-default'
                  : activeTool === 'move'
                  ? 'cursor-grab active:cursor-grabbing'
                  : 'cursor-crosshair'
              }`}
              style={{ gridTemplateRows: 'repeat(7, 11px)' }}
            >
              {calendar.weeks.map((week) =>
                week.map((day) => {
                  if (!day.inYear) {
                    return <div key={day.date} className="w-[11px] h-[11px]" />;
                  }

                  const state = getCellVisualState(day, cells, previewMode, showExistingUnderlay);
                  const ghostLvl = ghostMap.get(`${day.col},${day.row}`);
                  const displayLevel = ghostLvl ?? state.level;
                  const fillColor = theme.levels[displayLevel];

                  const isSelected = selection?.has(day.date);
                  const isHighlighted = highlightedDates?.has(day.date);
                  const isFocusedDay = selectedDayDate === day.date;
                  const inDragBox =
                    dragBox &&
                    day.col >= Math.min(dragBox.start.col, dragBox.end.col) &&
                    day.col <= Math.max(dragBox.start.col, dragBox.end.col) &&
                    day.row >= Math.min(dragBox.start.row, dragBox.end.row) &&
                    day.row <= Math.max(dragBox.start.row, dragBox.end.row);

                  return (
                    <div
                      key={day.date}
                      role="gridcell"
                      aria-label={`${day.date}: ${day.existingCount} existing, level ${state.plannedLevel} planned`}
                      onPointerDown={(e) => handlePointerDown(day, e)}
                      onPointerEnter={() => handlePointerEnter(day)}
                      className={`w-[11px] h-[11px] rounded-[2px] transition-transform duration-75 relative ${
                        onDayClickOverride ? 'cursor-pointer' : ''
                      } ${ghostLvl ? 'opacity-80 scale-105 ring-1 ring-emerald-300/70' : ''} ${
                        isSelected || inDragBox ? 'ring-1 ring-indigo-400' : ''
                      } ${isHighlighted ? 'ring-2 ring-cyan-400 z-10' : ''} ${
                        isFocusedDay ? 'ring-1 ring-white' : ''
                      } ${
                        previewMode === 'diff' && state.isOverlap
                          ? 'ring-1 ring-purple-400'
                          : ''
                      } hover:scale-125 hover:z-10`}
                      style={{ backgroundColor: fillColor }}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Hover Readout + Legend */}
          <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="min-h-[18px] flex items-center gap-2 font-mono tabular-nums">
              {hoverDay && hoverState ? (
                <>
                  <span className="text-slate-200 font-medium">{hoverDay.date}</span>
                  <span aria-hidden="true">·</span>
                  <span>{hoverDay.existingCount} existing</span>
                  <span aria-hidden="true">·</span>
                  <span className={hoverState.plannedLevel > 0 ? 'text-emerald-400' : 'text-slate-500'}>
                    Planned L{hoverState.plannedLevel}
                  </span>
                  {hoverState.isOverlap && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-purple-400">Overlaps activity</span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-slate-500 flex items-center gap-1.5">
                  {activeTool === 'move' && <Move className="w-3.5 h-3.5" />}
                  {readOnly
                    ? 'Hover any day to inspect contribution data'
                    : 'Click or drag cells to paint · Right-click to erase'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Less</span>
              {([0, 1, 2, 3, 4] as IntensityLevel[]).map((lvl) => (
                <span
                  key={lvl}
                  className="w-[10px] h-[10px] rounded-[2px] inline-block border border-white/5"
                  style={{ backgroundColor: theme.levels[lvl] }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
