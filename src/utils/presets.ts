import type {
  ArtworkCells,
  ContributionCalendar,
  GridCoord,
  IntensityLevel,
  PixelPreset,
  PresetPixel,
  ShapeType,
} from '../types/studio';
import { renderTextToPixels } from './pixelFont';

function patternToPixels(
  rows: string[],
  levelMap: Record<string, Exclude<IntensityLevel, 0>> = { '#': 3, '*': 4, '+': 2, '.': 1 }
): { pixels: PresetPixel[]; width: number; height: number } {
  const pixels: PresetPixel[] = [];
  const height = rows.length;
  let width = 0;
  for (let r = 0; r < rows.length; r++) {
    width = Math.max(width, rows[r].length);
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      const lvl = levelMap[ch];
      if (lvl) {
        pixels.push({ col: c, row: r, level: lvl });
      }
    }
  }
  return { pixels, width, height };
}

function buildTextPreset(
  id: string,
  name: string,
  description: string,
  text: string,
  intensity: Exclude<IntensityLevel, 0> = 4
): PixelPreset {
  const rendered = renderTextToPixels(text, {
    size: 'tall',
    spacing: 1,
    intensity,
    alignX: 'custom',
    alignY: 'custom',
    customCol: 0,
    customRow: 0,
  });
  return {
    id,
    name,
    category: 'text',
    description,
    width: rendered.width,
    height: rendered.height,
    pixels: rendered.pixels,
  };
}

function buildSineWavePreset(): PixelPreset {
  const pixels: PresetPixel[] = [];
  for (let col = 0; col < 53; col++) {
    const y = Math.round(3 + 2.6 * Math.sin((col / 52) * Math.PI * 4));
    const level = (((col % 4) + 1) as Exclude<IntensityLevel, 0>);
    pixels.push({ col, row: Math.max(0, Math.min(6, y)), level });
    if (y > 0 && col % 2 === 0) {
      pixels.push({ col, row: y - 1, level: 2 });
    }
  }
  return {
    id: 'preset-wave',
    name: 'Harmonic Wave',
    category: 'patterns',
    description: 'Full-year sinusoidal contribution wave across all 53 weeks.',
    width: 53,
    height: 7,
    pixels,
  };
}

function buildCheckerboardPreset(): PixelPreset {
  const pixels: PresetPixel[] = [];
  for (let col = 0; col < 53; col++) {
    for (let row = 0; row < 7; row++) {
      if ((col + row) % 2 === 0) {
        const level: Exclude<IntensityLevel, 0> = ((col + row) % 4 === 0 ? 4 : 2);
        pixels.push({ col, row, level });
      }
    }
  }
  return {
    id: 'preset-checkerboard',
    name: 'Checkerboard Matrix',
    category: 'patterns',
    description: 'Alternating geometric dual-intensity grid pattern.',
    width: 53,
    height: 7,
    pixels,
  };
}

function buildSpectrumPreset(): PixelPreset {
  const pixels: PresetPixel[] = [];
  for (let col = 0; col < 53; col++) {
    const band = Math.floor((col / 53) * 5);
    const level: Exclude<IntensityLevel, 0> = ([1, 2, 3, 4, 3][band] ?? 3) as Exclude<IntensityLevel, 0>;
    for (let row = 0; row < 7; row++) {
      if ((col + row) % 3 !== 0 || row === 3) {
        pixels.push({ col, row, level });
      }
    }
  }
  return {
    id: 'preset-spectrum',
    name: 'Gradient Spectrum',
    category: 'patterns',
    description: 'Layered intensity gradient sweeping smoothly across the year.',
    width: 53,
    height: 7,
    pixels,
  };
}

export const BUILT_IN_PRESETS: PixelPreset[] = [
  (() => {
    const { pixels, width, height } = patternToPixels([
      '_##_##_',
      '#######',
      '#######',
      '*#####*',
      '_*****_',
      '__***__',
      '___*___',
    ]);
    return {
      id: 'preset-heart',
      name: 'Pixel Heart',
      category: 'symbols',
      description: 'Classic shaded pixel heart emblem.',
      width,
      height,
      pixels,
    };
  })(),
  (() => {
    const { pixels, width, height } = patternToPixels([
      '_*****_',
      '*_____*',
      '*_+_+_*',
      '*_____*',
      '*+#_#+*',
      '*_###_*',
      '_*****_',
    ]);
    return {
      id: 'preset-smiley',
      name: 'Smiley Face',
      category: 'symbols',
      description: 'Friendly 7x7 smiling face icon.',
      width,
      height,
      pixels,
    };
  })(),
  (() => {
    const { pixels, width, height } = patternToPixels([
      '___*___',
      '___*___',
      '*******',
      '_#####_',
      '__###__',
      '_##_##_',
      '#_____#',
    ]);
    return {
      id: 'preset-star',
      name: 'North Star',
      category: 'symbols',
      description: 'Sharp 7x7 luminous star.',
      width,
      height,
      pixels,
    };
  })(),
  (() => {
    const { pixels, width, height } = patternToPixels([
      '_#_____#_',
      '_##___##_',
      '#########',
      '#**###**#',
      '#########',
      '_#######_',
      '__#_#_#__',
    ]);
    return {
      id: 'preset-octocat',
      name: 'Dev Cat Silhouette',
      category: 'developer',
      description: 'Original pixel cat mascot inspired by open-source culture.',
      width,
      height,
      pixels,
    };
  })(),
  (() => {
    const { pixels, width, height } = patternToPixels([
      '____*____',
      '___***___',
      '__**#**__',
      '__*****__',
      '_#*#*#*#_',
      '*_______*',
      '__+___+__',
    ]);
    return {
      id: 'preset-rocket',
      name: 'Launch Rocket',
      category: 'developer',
      description: 'Ship-ready rocket silhouette with exhaust glow.',
      width,
      height,
      pixels,
    };
  })(),
  (() => {
    const { pixels, width, height } = patternToPixels([
      '__#____*____#__',
      '_#____*______#_',
      '#____*________#',
      '_#___*_______#_',
      '__#_*_______#__',
      '___*___________',
    ]);
    return {
      id: 'preset-code-tags',
      name: 'Code Tags </>',
      category: 'developer',
      description: 'Clean HTML/JSX closing tag developer motif.',
      width,
      height,
      pixels,
    };
  })(),
  (() => {
    const { pixels, width, height } = patternToPixels([
      '_*******_',
      '*#######*',
      '*#++*++#*',
      '*#######*',
      '_*******_',
      '___***___',
      '_#######_',
    ]);
    return {
      id: 'preset-computer',
      name: 'Retro Terminal',
      category: 'developer',
      description: 'Vintage CRT monitor & workstation stand.',
      width,
      height,
      pixels,
    };
  })(),
  buildTextPreset('preset-dev-badge', 'DEV', 'Bold 3-letter DEV pixel banner.', 'DEV', 4),
  buildTextPreset('preset-code-text', 'CODE', 'Clean CODE pixel typography.', 'CODE', 3),
  buildTextPreset('preset-build-text', 'BUILD', 'Crisp BUILD banner ready to center.', 'BUILD', 4),
  buildSineWavePreset(),
  buildCheckerboardPreset(),
  buildSpectrumPreset(),
];

export function generateShapePixels(
  shape: ShapeType,
  intensity: Exclude<IntensityLevel, 0>
): { pixels: PresetPixel[]; width: number; height: number } {
  const map: Record<string, Exclude<IntensityLevel, 0>> = { '#': intensity };
  switch (shape) {
    case 'heart':
      return patternToPixels(
        ['_##_##_', '#######', '#######', '_#####_', '__###__', '___#___'],
        map
      );
    case 'star':
      return patternToPixels(
        ['___#___', '___#___', '#######', '_#####_', '__###__', '_##_##_', '#_____#'],
        map
      );
    case 'circle':
      return patternToPixels(
        ['__###__', '_#####_', '#######', '#######', '#######', '_#####_', '__###__'],
        map
      );
    case 'square':
      return patternToPixels(
        ['#######', '#_____#', '#_____#', '#_____#', '#_____#', '#_____#', '#######'],
        map
      );
    case 'diamond':
      return patternToPixels(
        ['___#___', '__###__', '_#####_', '#######', '_#####_', '__###__', '___#___'],
        map
      );
    case 'arrow':
      return patternToPixels(
        ['____#__', '_____#_', '#######', '_____#_', '____#__'],
        map
      );
  }
}

export function applyPixelsToCells(
  existingCells: ArtworkCells,
  pixels: PresetPixel[],
  calendar: ContributionCalendar,
  offsetCol = 0,
  offsetRow = 0,
  replace = false
): ArtworkCells {
  const next: ArtworkCells = replace ? {} : { ...existingCells };
  for (const p of pixels) {
    const c = p.col + offsetCol;
    const r = p.row + offsetRow;
    if (c < 0 || c >= 53 || r < 0 || r >= 7) continue;
    const day = calendar.weeks[c]?.[r];
    if (day && day.inYear) {
      next[day.date] = p.level;
    }
  }
  return next;
}

export function getCellsBounds(cells: ArtworkCells, calendar: ContributionCalendar) {
  let minCol = 53;
  let maxCol = -1;
  let minRow = 7;
  let maxRow = -1;
  const coords: { col: number; row: number; level: Exclude<IntensityLevel, 0>; date: string }[] = [];

  for (const [date, lvl] of Object.entries(cells)) {
    if (!lvl) continue;
    const coord = calendar.coordByDate[date];
    if (!coord) continue;
    minCol = Math.min(minCol, coord.col);
    maxCol = Math.max(maxCol, coord.col);
    minRow = Math.min(minRow, coord.row);
    maxRow = Math.max(maxRow, coord.row);
    coords.push({ col: coord.col, row: coord.row, level: lvl as Exclude<IntensityLevel, 0>, date });
  }

  return {
    empty: coords.length === 0,
    minCol,
    maxCol,
    minRow,
    maxRow,
    width: coords.length ? maxCol - minCol + 1 : 0,
    height: coords.length ? maxRow - minRow + 1 : 0,
    coords,
  };
}

export function flipCellsHorizontal(
  cells: ArtworkCells,
  calendar: ContributionCalendar,
  selection?: Set<string>
): ArtworkCells {
  const targetCells: ArtworkCells = {};
  const preserved: ArtworkCells = {};
  for (const [date, lvl] of Object.entries(cells)) {
    if (!selection || selection.size === 0 || selection.has(date)) {
      targetCells[date] = lvl;
    } else {
      preserved[date] = lvl;
    }
  }
  const bounds = getCellsBounds(targetCells, calendar);
  if (bounds.empty) return cells;

  const next: ArtworkCells = { ...preserved };
  for (const item of bounds.coords) {
    const newCol = bounds.minCol + (bounds.maxCol - item.col);
    const day = calendar.weeks[newCol]?.[item.row];
    if (day && day.inYear) {
      next[day.date] = item.level;
    }
  }
  return next;
}

export function flipCellsVertical(
  cells: ArtworkCells,
  calendar: ContributionCalendar,
  selection?: Set<string>
): ArtworkCells {
  const targetCells: ArtworkCells = {};
  const preserved: ArtworkCells = {};
  for (const [date, lvl] of Object.entries(cells)) {
    if (!selection || selection.size === 0 || selection.has(date)) {
      targetCells[date] = lvl;
    } else {
      preserved[date] = lvl;
    }
  }
  const bounds = getCellsBounds(targetCells, calendar);
  if (bounds.empty) return cells;

  const next: ArtworkCells = { ...preserved };
  for (const item of bounds.coords) {
    const newRow = bounds.minRow + (bounds.maxRow - item.row);
    const day = calendar.weeks[item.col]?.[newRow];
    if (day && day.inYear) {
      next[day.date] = item.level;
    }
  }
  return next;
}

export function rotateCells90(
  cells: ArtworkCells,
  calendar: ContributionCalendar,
  selection?: Set<string>
): ArtworkCells {
  const targetCells: ArtworkCells = {};
  const preserved: ArtworkCells = {};
  for (const [date, lvl] of Object.entries(cells)) {
    if (!selection || selection.size === 0 || selection.has(date)) {
      targetCells[date] = lvl;
    } else {
      preserved[date] = lvl;
    }
  }
  const bounds = getCellsBounds(targetCells, calendar);
  if (bounds.empty) return cells;

  const cx = (bounds.minCol + bounds.maxCol) / 2;
  const cy = (bounds.minRow + bounds.maxRow) / 2;
  const next: ArtworkCells = { ...preserved };
  for (const item of bounds.coords) {
    const relX = item.col - cx;
    const relY = item.row - cy;
    const newCol = Math.round(cx - relY);
    const newRow = Math.round(cy + relX);
    if (newCol >= 0 && newCol < 53 && newRow >= 0 && newRow < 7) {
      const day = calendar.weeks[newCol]?.[newRow];
      if (day && day.inYear) {
        next[day.date] = item.level;
      }
    }
  }
  return next;
}

export function shiftCells(
  cells: ArtworkCells,
  calendar: ContributionCalendar,
  dCol: number,
  dRow: number,
  selection?: Set<string>
): { cells: ArtworkCells; nextSelection?: Set<string> } {
  const next: ArtworkCells = {};
  const nextSelection = new Set<string>();
  const hasSelection = Boolean(selection && selection.size > 0);

  for (const [date, lvl] of Object.entries(cells)) {
    if (hasSelection && !selection!.has(date)) {
      next[date] = lvl;
    }
  }

  for (const [date, lvl] of Object.entries(cells)) {
    if (hasSelection && !selection!.has(date)) continue;
    const coord = calendar.coordByDate[date];
    if (!coord) continue;
    const nc = coord.col + dCol;
    const nr = coord.row + dRow;
    if (nc >= 0 && nc < 53 && nr >= 0 && nr < 7) {
      const targetDay = calendar.weeks[nc]?.[nr];
      if (targetDay && targetDay.inYear) {
        next[targetDay.date] = lvl;
        if (hasSelection) nextSelection.add(targetDay.date);
      }
    }
  }

  return { cells: next, nextSelection: hasSelection ? nextSelection : undefined };
}

export function alignCells(
  cells: ArtworkCells,
  calendar: ContributionCalendar,
  alignX: 'left' | 'center' | 'right',
  alignY: 'top' | 'center' | 'bottom' | 'keep'
): ArtworkCells {
  const bounds = getCellsBounds(cells, calendar);
  if (bounds.empty) return cells;

  let targetMinCol = bounds.minCol;
  if (alignX === 'left') targetMinCol = 1;
  else if (alignX === 'center') targetMinCol = Math.floor((53 - bounds.width) / 2);
  else if (alignX === 'right') targetMinCol = 52 - bounds.width;

  let targetMinRow = bounds.minRow;
  if (alignY === 'top') targetMinRow = 0;
  else if (alignY === 'center') targetMinRow = Math.floor((7 - bounds.height) / 2);
  else if (alignY === 'bottom') targetMinRow = 7 - bounds.height;

  return shiftCells(cells, calendar, targetMinCol - bounds.minCol, targetMinRow - bounds.minRow).cells;
}

export function scaleCells(
  cells: ArtworkCells,
  calendar: ContributionCalendar,
  scaleX: number,
  scaleY: number
): ArtworkCells {
  const bounds = getCellsBounds(cells, calendar);
  if (bounds.empty) return cells;

  const newW = Math.max(1, Math.min(53, Math.round(bounds.width * scaleX)));
  const newH = Math.max(1, Math.min(7, Math.round(bounds.height * scaleY)));
  const sourceGrid = new Map<string, Exclude<IntensityLevel, 0>>();
  for (const item of bounds.coords) {
    sourceGrid.set(`${item.col - bounds.minCol},${item.row - bounds.minRow}`, item.level);
  }

  const next: ArtworkCells = {};
  for (let nc = 0; nc < newW; nc++) {
    for (let nr = 0; nr < newH; nr++) {
      const sc = Math.min(bounds.width - 1, Math.floor((nc / newW) * bounds.width));
      const sr = Math.min(bounds.height - 1, Math.floor((nr / newH) * bounds.height));
      const lvl = sourceGrid.get(`${sc},${sr}`);
      if (lvl) {
        const destCol = bounds.minCol + nc;
        const destRow = bounds.minRow + nr;
        const day = calendar.weeks[destCol]?.[destRow];
        if (day && day.inYear) {
          next[day.date] = lvl;
        }
      }
    }
  }
  return next;
}

export function floodFillCells(
  cells: ArtworkCells,
  calendar: ContributionCalendar,
  startCoord: GridCoord,
  fillLevel: IntensityLevel
): ArtworkCells {
  const startDay = calendar.weeks[startCoord.col]?.[startCoord.row];
  if (!startDay || !startDay.inYear) return cells;
  const targetLevel: IntensityLevel = cells[startDay.date] ?? 0;
  if (targetLevel === fillLevel) return cells;

  const next: ArtworkCells = { ...cells };
  const queue: GridCoord[] = [startCoord];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const key = `${cur.col},${cur.row}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const day = calendar.weeks[cur.col]?.[cur.row];
    if (!day || !day.inYear) continue;
    const curLevel: IntensityLevel = next[day.date] ?? 0;
    if (curLevel !== targetLevel) continue;

    if (fillLevel === 0) {
      delete next[day.date];
    } else {
      next[day.date] = fillLevel;
    }

    const neighbors = [
      { col: cur.col + 1, row: cur.row },
      { col: cur.col - 1, row: cur.row },
      { col: cur.col, row: cur.row + 1 },
      { col: cur.col, row: cur.row - 1 },
    ];
    for (const n of neighbors) {
      if (n.col >= 0 && n.col < 53 && n.row >= 0 && n.row < 7) {
        queue.push(n);
      }
    }
  }

  return next;
}
