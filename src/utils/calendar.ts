import type {
  ArtworkCells,
  CalendarDay,
  ContributionCalendar,
  GridCoord,
  IntensityLevel,
  PaletteTheme,
  PreviewMode,
} from '../types/studio';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PALETTE_THEMES: Record<
  PaletteTheme,
  {
    name: string;
    bg: string;
    border: string;
    levels: Record<IntensityLevel, string>;
    overlapRing: string;
  }
> = {
  'github-dark': {
    name: 'GitHub Dark',
    bg: '#0D1117',
    border: '#21262D',
    levels: {
      0: '#161B22',
      1: '#0E4429',
      2: '#006D32',
      3: '#26A641',
      4: '#39D353',
    },
    overlapRing: '#A855F7',
  },
  'github-light': {
    name: 'GitHub Light',
    bg: '#FFFFFF',
    border: '#D0D7DE',
    levels: {
      0: '#EBEDF0',
      1: '#9BE9A8',
      2: '#40C463',
      3: '#30A14E',
      4: '#216E39',
    },
    overlapRing: '#7C3AED',
  },
  'emerald-studio': {
    name: 'Studio Emerald',
    bg: '#0B0F17',
    border: '#1E293B',
    levels: {
      0: '#131A26',
      1: '#064E3B',
      2: '#047857',
      3: '#10B981',
      4: '#34D399',
    },
    overlapRing: '#818CF8',
  },
  'violet-pulse': {
    name: 'Electric Violet',
    bg: '#0B0F17',
    border: '#1E1B4B',
    levels: {
      0: '#15192B',
      1: '#312E81',
      2: '#4F46E5',
      3: '#7C3AED',
      4: '#A855F7',
    },
    overlapRing: '#34D399',
  },
};

export function formatDateISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateISO(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function countToLevel(count: number): IntensityLevel {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

/**
 * Generates deterministic realistic GitHub activity for Demo Mode or fallback preview.
 */
function deterministicDemoActivity(dateStr: string, username: string): number {
  let hash = 2166136261;
  const seed = `${username}:${dateStr}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const n = Math.abs(hash % 100);
  const d = parseDateISO(dateStr);
  const day = d.getUTCDay();
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) {
    if (n < 78) return 0;
    if (n < 92) return 1;
    return 2;
  }
  if (n < 46) return 0;
  if (n < 72) return 1 + (n % 2);
  if (n < 90) return 3 + (n % 3);
  return 6 + (n % 6);
}

/**
 * Builds an exact 53-week x 7-day GitHub-style contribution calendar for a given year.
 * Optionally overlays real fetched GitHub counts (`externalCountsByDate`).
 */
export function buildContributionCalendar(
  year: number,
  externalCountsByDate?: Record<string, number>,
  options?: { useDemoFallback?: boolean; username?: string }
): ContributionCalendar {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const startOffset = jan1.getUTCDay(); // 0=Sunday .. 6=Saturday
  const gridStart = new Date(Date.UTC(year, 0, 1 - startOffset));

  const weeks: CalendarDay[][] = [];
  const coordByDate: Record<string, GridCoord> = {};
  const dateByCoord: Record<string, string> = {};
  const monthLabels: { label: string; col: number }[] = [];

  let totalExisting = 0;
  let lastLabeledMonth = -1;

  for (let col = 0; col < 53; col++) {
    const weekDays: CalendarDay[] = [];
    for (let row = 0; row < 7; row++) {
      const dayDate = new Date(gridStart.getTime() + (col * 7 + row) * 86400000);
      const dateISO = formatDateISO(dayDate);
      const inYear = dayDate.getUTCFullYear() === year;

      let existingCount = 0;
      if (inYear) {
        if (externalCountsByDate) {
          existingCount = externalCountsByDate[dateISO] ?? 0;
        } else if (options?.useDemoFallback) {
          existingCount = deterministicDemoActivity(dateISO, options.username || 'demo-dev');
        }
        totalExisting += existingCount;
      }

      const day: CalendarDay = {
        date: dateISO,
        col,
        row,
        inYear,
        existingCount,
        existingLevel: countToLevel(existingCount),
      };
      weekDays.push(day);
      coordByDate[dateISO] = { col, row };
      dateByCoord[`${col},${row}`] = dateISO;

      if (inYear && row === 0) {
        const month = dayDate.getUTCMonth();
        if (month !== lastLabeledMonth) {
          const prevLabel = monthLabels[monthLabels.length - 1];
          if (!prevLabel || col - prevLabel.col >= 3) {
            monthLabels.push({ label: MONTH_NAMES[month], col });
          }
          lastLabeledMonth = month;
        }
      } else if (inYear && col === 0 && row === startOffset && lastLabeledMonth === -1) {
        monthLabels.push({ label: MONTH_NAMES[0], col: 0 });
        lastLabeledMonth = 0;
      }
    }
    weeks.push(weekDays);
  }

  return {
    year,
    totalExisting,
    weeks,
    coordByDate,
    dateByCoord,
    monthLabels,
  };
}

export interface CellVisualState {
  level: IntensityLevel;
  plannedLevel: IntensityLevel;
  existingLevel: IntensityLevel;
  isOverlap: boolean;
  isDiffAdded: boolean;
  isDiffBoosted: boolean;
}

export function getCellVisualState(
  day: CalendarDay,
  plannedCells: ArtworkCells,
  mode: PreviewMode,
  showExistingUnderlay = true
): CellVisualState {
  const plannedLevel: IntensityLevel = day.inYear ? (plannedCells[day.date] ?? 0) : 0;
  const existingLevel: IntensityLevel = day.inYear ? day.existingLevel : 0;
  const isOverlap = plannedLevel > 0 && existingLevel > 0;
  const isDiffAdded = plannedLevel > 0 && existingLevel === 0;
  const isDiffBoosted = plannedLevel > 0 && existingLevel > 0;

  let level: IntensityLevel = 0;
  if (mode === 'original') {
    level = existingLevel;
  } else if (mode === 'artwork') {
    level = plannedLevel;
  } else if (mode === 'diff') {
    level = plannedLevel > 0 ? plannedLevel : existingLevel > 0 ? 1 : 0;
  } else {
    // combined
    if (plannedLevel > 0) {
      level = showExistingUnderlay
        ? (Math.min(4, Math.max(plannedLevel, existingLevel)) as IntensityLevel)
        : plannedLevel;
    } else {
      level = showExistingUnderlay ? existingLevel : 0;
    }
  }

  return {
    level,
    plannedLevel,
    existingLevel,
    isOverlap,
    isDiffAdded,
    isDiffBoosted,
  };
}

export function getArtworkStats(
  calendar: ContributionCalendar,
  cells: ArtworkCells,
  commitsPerLevel: Record<Exclude<IntensityLevel, 0>, number>
) {
  const distribution: Record<IntensityLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let activeDays = 0;
  let plannedCommits = 0;
  let overlapDays = 0;

  for (const week of calendar.weeks) {
    for (const day of week) {
      if (!day.inYear) continue;
      const lvl = cells[day.date] ?? 0;
      distribution[lvl] += 1;
      if (lvl > 0) {
        activeDays += 1;
        plannedCommits += commitsPerLevel[lvl as Exclude<IntensityLevel, 0>];
        if (day.existingCount > 0) {
          overlapDays += 1;
        }
      }
    }
  }

  return {
    activeDays,
    plannedCommits,
    overlapDays,
    distribution,
    estimatedSeconds: Math.ceil(plannedCommits * 0.25),
  };
}
