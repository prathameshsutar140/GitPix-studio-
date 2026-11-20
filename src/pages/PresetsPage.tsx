import React, { useState } from 'react';
import { Plus, Trash2, Stamp, Replace } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { IntensityLevel, PixelPreset, PresetPixel } from '../types/studio';
import { PALETTE_THEMES } from '../utils/calendar';

export function PresetsPage() {
  const {
    allPresets,
    applyPresetToCanvas,
    setSelectedPresetForStamp,
    setActiveTool,
    navigate,
    saveCustomPreset,
    deleteCustomPreset,
    settings,
  } = useStudio();

  const [category, setCategory] = useState<'all' | 'symbols' | 'developer' | 'patterns' | 'text' | 'custom'>('all');
  const [creatorOpen, setCreatorOpen] = useState(false);

  // Custom Preset Creator State (11x7 mini grid)
  const [customName, setCustomName] = useState('My Custom Badge');
  const [customIntensity, setCustomIntensity] = useState<Exclude<IntensityLevel, 0>>(3);
  const [customGrid, setCustomGrid] = useState<Record<string, Exclude<IntensityLevel, 0>>>({});

  const theme = PALETTE_THEMES[settings.paletteTheme];

  const filtered = allPresets.filter((p) => (category === 'all' ? true : p.category === category));

  const toggleGridCell = (c: number, r: number) => {
    const key = `${c},${r}`;
    setCustomGrid((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = customIntensity;
      return next;
    });
  };

  const handleSaveCustom = async () => {
    const pixels: PresetPixel[] = [];
    let maxC = 0;
    let maxR = 0;
    for (const [k, lvl] of Object.entries(customGrid)) {
      const [c, r] = k.split(',').map(Number);
      pixels.push({ col: c, row: r, level: lvl });
      maxC = Math.max(maxC, c);
      maxR = Math.max(maxR, r);
    }
    if (pixels.length === 0) return;

    await saveCustomPreset({
      name: customName.trim() || 'Custom Pattern',
      category: 'custom',
      description: 'User-created custom pixel preset',
      width: maxC + 1,
      height: maxR + 1,
      pixels,
    });
    setCustomGrid({});
    setCreatorOpen(false);
  };

  const handleStampOnCanvas = (preset: PixelPreset) => {
    setSelectedPresetForStamp(preset);
    setActiveTool('shape');
    navigate('editor');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-50">Pixel Art Preset Library</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Apply any built-in or custom pixel pattern to your contribution calendar, then edit every cell freely.
          </p>
        </div>

        <button
          onClick={() => setCreatorOpen((o) => !o)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          {creatorOpen ? 'Close Creator' : 'Create Custom Preset'}
        </button>
      </div>

      {/* Custom Preset Creator Panel */}
      {creatorOpen && (
        <div className="bg-[#111827] border border-emerald-500/30 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-100">Custom Preset Creator (13 × 7)</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Paint Level</span>
              {([1, 2, 3, 4] as Exclude<IntensityLevel, 0>[]).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setCustomIntensity(lvl)}
                  className={`w-6 h-6 rounded text-[11px] font-mono font-bold ${
                    customIntensity === lvl ? 'ring-2 ring-white' : ''
                  }`}
                  style={{ backgroundColor: theme.levels[lvl], color: lvl >= 3 ? '#052E16' : '#E2E8F0' }}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-center">
            <div className="overflow-x-auto bg-[#0B0F17] border border-slate-800 rounded-lg p-4 flex justify-center">
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: 'repeat(13, 20px)', gridTemplateRows: 'repeat(7, 20px)' }}
              >
                {Array.from({ length: 7 }).map((_, r) =>
                  Array.from({ length: 13 }).map((__, c) => {
                    const lvl = customGrid[`${c},${r}`] ?? 0;
                    return (
                      <button
                        key={`${c}-${r}`}
                        type="button"
                        onClick={() => toggleGridCell(c, r)}
                        className="w-5 h-5 rounded-[3px] border border-white/5 hover:border-emerald-400 transition-colors"
                        style={{ backgroundColor: theme.levels[lvl] }}
                      />
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs text-slate-400">
                Preset Name
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  maxLength={64}
                  className="mt-1 w-full bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveCustom}
                  disabled={Object.keys(customGrid).length === 0}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold"
                >
                  Save Preset ({Object.keys(customGrid).length} px)
                </button>
                <button
                  onClick={() => setCustomGrid({})}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300"
                >
                  Reset Grid
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-lg w-fit overflow-x-auto max-w-full">
        {(
          [
            { id: 'all', label: 'All Presets' },
            { id: 'symbols', label: 'Symbols' },
            { id: 'developer', label: 'Developer' },
            { id: 'text', label: 'Typography' },
            { id: 'patterns', label: 'Patterns' },
            { id: 'custom', label: 'Custom' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              category === tab.id ? 'bg-slate-800 text-slate-50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Presets Grid */}
      {filtered.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm text-slate-400">No presets in this category yet.</p>
          <button
            onClick={() => setCreatorOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
          >
            Create Custom Preset
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((preset) => {
            const colsToRender = Math.min(preset.width, 32);
            return (
              <div
                key={preset.id}
                className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="h-24 bg-[#0B0F17] border border-slate-800/80 rounded-lg flex items-center justify-center p-3 overflow-hidden mb-4">
                    <div
                      className="grid gap-[2px]"
                      style={{
                        gridTemplateColumns: `repeat(${colsToRender}, 6px)`,
                        gridTemplateRows: `repeat(${preset.height}, 6px)`,
                      }}
                    >
                      {Array.from({ length: preset.height }).map((_, r) =>
                        Array.from({ length: colsToRender }).map((__, c) => {
                          const found = preset.pixels.find((p) => p.col === c && p.row === r);
                          const color = found ? theme.levels[found.level] : theme.levels[0];
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

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{preset.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">{preset.description}</p>
                    </div>
                    {preset.isCustom && (
                      <button
                        onClick={() => deleteCustomPreset(preset.id)}
                        title="Delete custom preset"
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-2">
                    {preset.width}×{preset.height} · {preset.pixels.length} cells · {preset.category}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/70">
                  <button
                    onClick={() => applyPresetToCanvas(preset, 'replace')}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Replace className="w-3.5 h-3.5" />
                    Apply Centered
                  </button>
                  <button
                    onClick={() => handleStampOnCanvas(preset)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-medium transition-colors"
                  >
                    <Stamp className="w-3.5 h-3.5" />
                    Stamp
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
