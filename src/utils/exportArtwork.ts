import type {
  ArtworkCells,
  ArtworkProject,
  ContributionCalendar,
  IntensityLevel,
  PaletteTheme,
  PreviewMode,
} from '../types/studio';
import { getCellVisualState, PALETTE_THEMES } from './calendar';

export interface ExportOptions {
  title: string;
  username: string;
  theme: PaletteTheme;
  previewMode: PreviewMode;
  showHeader: boolean;
  showLegend: boolean;
  showExistingUnderlay: boolean;
  scale?: number;
}

export function generateCalendarSvg(
  calendar: ContributionCalendar,
  cells: ArtworkCells,
  options: ExportOptions
): string {
  const palette = PALETTE_THEMES[options.theme];
  const isLight = options.theme === 'github-light';
  const textColor = isLight ? '#57606A' : '#94A3B8';
  const titleColor = isLight ? '#1F2328' : '#F8FAFC';

  const cellSize = 12;
  const gap = 3;
  const step = cellSize + gap;
  const leftPad = 36;
  const topPad = options.showHeader ? 54 : 24;
  const bottomPad = options.showLegend ? 44 : 16;
  const rightPad = 18;

  const gridW = 53 * step - gap;
  const gridH = 7 * step - gap;
  const width = leftPad + gridW + rightPad;
  const height = topPad + gridH + bottomPad;

  const rects: string[] = [];
  for (let col = 0; col < 53; col++) {
    for (let row = 0; row < 7; row++) {
      const day = calendar.weeks[col]?.[row];
      if (!day || !day.inYear) continue;
      const state = getCellVisualState(day, cells, options.previewMode, options.showExistingUnderlay);
      const fill = palette.levels[state.level];
      const x = leftPad + col * step;
      const y = topPad + row * step;
      rects.push(
        `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2.5" fill="${fill}" />`
      );
    }
  }

  const monthTexts = calendar.monthLabels
    .map((m) => {
      const x = leftPad + m.col * step;
      return `<text x="${x}" y="${topPad - 8}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${textColor}">${m.label}</text>`;
    })
    .join('\n  ');

  const weekdayRows = [
    { row: 1, label: 'Mon' },
    { row: 3, label: 'Wed' },
    { row: 5, label: 'Fri' },
  ];
  const weekdayTexts = weekdayRows
    .map((w) => {
      const y = topPad + w.row * step + 10;
      return `<text x="10" y="${y}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${textColor}">${w.label}</text>`;
    })
    .join('\n  ');

  const headerSvg = options.showHeader
    ? `<text x="16" y="24" font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="700" fill="${titleColor}">${escapeXml(
        options.title || 'Contribution Pixel Art'
      )}</text>
       <text x="${width - 16}" y="24" text-anchor="end" font-family="ui-monospace, monospace" font-size="11" fill="${textColor}">@${escapeXml(
        options.username || 'developer'
      )} · ${calendar.year}</text>`
    : '';

  const legendLevels: IntensityLevel[] = [0, 1, 2, 3, 4];
  const legendStartX = width - rightPad - 132;
  const legendY = topPad + gridH + 18;
  const legendSvg = options.showLegend
    ? `<text x="${legendStartX - 34}" y="${legendY + 10}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${textColor}">Less</text>
       ${legendLevels
         .map(
           (lvl, idx) =>
             `<rect x="${legendStartX + idx * 15}" y="${legendY}" width="11" height="11" rx="2" fill="${palette.levels[lvl]}" />`
         )
         .join('')}
       <text x="${legendStartX + 78}" y="${legendY + 10}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${textColor}">More</text>
       <text x="16" y="${legendY + 10}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" fill="${textColor}">Created with GitPixel Studio</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="12" fill="${palette.bg}" stroke="${palette.border}" stroke-width="1" />
  ${headerSvg}
  ${monthTexts}
  ${weekdayTexts}
  ${rects.join('\n  ')}
  ${legendSvg}
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function exportCalendarToPng(
  calendar: ContributionCalendar,
  cells: ArtworkCells,
  options: ExportOptions
): Promise<void> {
  const svgString = generateCalendarSvg(calendar, cells, options);
  const scale = options.scale ?? 2;
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to render SVG to PNG'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    );
    if (!pngBlob) throw new Error('PNG generation failed');

    triggerDownload(pngBlob, `${slugify(options.title)}-${calendar.year}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function exportCalendarToSvg(
  calendar: ContributionCalendar,
  cells: ArtworkCells,
  options: ExportOptions
): void {
  const svg = generateCalendarSvg(calendar, cells, options);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `${slugify(options.title)}-${calendar.year}.svg`);
}

export function buildProjectJson(project: ArtworkProject): string {
  return JSON.stringify(
    {
      format: 'gitpixel-studio-v1',
      title: project.title,
      selectedYear: project.selectedYear,
      githubUsername: project.githubUsername,
      presetName: project.presetName,
      notes: project.notes,
      cells: project.cells,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

export function exportProjectJson(project: ArtworkProject): void {
  const json = buildProjectJson(project);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  triggerDownload(blob, `${slugify(project.title)}-${project.selectedYear}.gitpixel.json`);
}

export function parseImportedProjectJson(raw: string): Partial<ArtworkProject> {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.cells !== 'object') {
    throw new Error('Invalid GitPixel JSON file: missing cells map.');
  }
  const sanitizedCells: ArtworkCells = {};
  for (const [date, lvl] of Object.entries(parsed.cells)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && [1, 2, 3, 4].includes(Number(lvl))) {
      sanitizedCells[date] = Number(lvl) as IntensityLevel;
    }
  }
  return {
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.slice(0, 120) : 'Imported Artwork',
    selectedYear: typeof parsed.selectedYear === 'number' ? parsed.selectedYear : new Date().getFullYear(),
    githubUsername: typeof parsed.githubUsername === 'string' ? parsed.githubUsername.slice(0, 64) : 'demo-dev',
    presetName: typeof parsed.presetName === 'string' ? parsed.presetName.slice(0, 80) : 'Imported',
    notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 500) : '',
    cells: sanitizedCells,
  };
}

export function encodeSharePayload(payload: {
  title: string;
  selectedYear: number;
  githubUsername: string;
  cells: ArtworkCells;
}): string {
  const compact = {
    t: payload.title.slice(0, 80),
    y: payload.selectedYear,
    u: payload.githubUsername.slice(0, 40),
    c: payload.cells,
  };
  const json = JSON.stringify(compact);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeSharePayload(token: string): {
  title: string;
  selectedYear: number;
  githubUsername: string;
  cells: ArtworkCells;
} | null {
  try {
    const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed.y !== 'number' || typeof parsed.c !== 'object') return null;
    const sanitizedCells: ArtworkCells = {};
    for (const [date, lvl] of Object.entries(parsed.c)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && [1, 2, 3, 4].includes(Number(lvl))) {
        sanitizedCells[date] = Number(lvl) as IntensityLevel;
      }
    }
    return {
      title: typeof parsed.t === 'string' ? parsed.t : 'Shared Pixel Art',
      selectedYear: parsed.y,
      githubUsername: typeof parsed.u === 'string' ? parsed.u : 'developer',
      cells: sanitizedCells,
    };
  } catch {
    return null;
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(str: string): string {
  return (str || 'gitpixel-artwork')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'gitpixel-artwork';
}

export interface ScriptExportOptions {
  title: string;
  repoName: string;
  branch: string;
  gitName: string;
  gitEmail: string;
  includeFutureDates: boolean;
}

function resolveScriptDates(
  cells: ArtworkCells,
  dateCommits: Record<string, number>,
  commitsPerLevel: Record<Exclude<IntensityLevel, 0>, number>,
  includeFutureDates: boolean
): { entries: { date: string; commits: number; isFuture: boolean }[]; skippedFutureCount: number } {
  const todayISO = new Date().toISOString().slice(0, 10);
  const map = new Map<string, number>();

  for (const [date, lvl] of Object.entries(cells)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && [1, 2, 3, 4].includes(Number(lvl))) {
      map.set(date, commitsPerLevel[lvl as Exclude<IntensityLevel, 0>] || 1);
    }
  }
  for (const [date, count] of Object.entries(dateCommits)) {
    const c = Math.max(0, Math.min(20, Number(count) || 0));
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && c > 0) {
      map.set(date, c);
    }
  }

  let skippedFutureCount = 0;
  const entries: { date: string; commits: number; isFuture: boolean }[] = [];
  for (const [date, commits] of Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const isFuture = date > todayISO;
    if (isFuture && !includeFutureDates) {
      skippedFutureCount++;
      continue;
    }
    entries.push({ date, commits, isFuture });
  }
  return { entries, skippedFutureCount };
}

export function generateGitBashScript(
  cells: ArtworkCells,
  dateCommits: Record<string, number>,
  commitsPerLevel: Record<Exclude<IntensityLevel, 0>, number>,
  options: ScriptExportOptions
): string {
  const { entries, skippedFutureCount } = resolveScriptDates(
    cells,
    dateCommits,
    commitsPerLevel,
    options.includeFutureDates
  );
  const safeRepo = slugify(options.repoName || 'gitpixel-art');
  const safeTitle = (options.title || 'Contribution Pixel Art').replace(/["`$\\]/g, '');
  const safeBranch = (options.branch || 'main').replace(/[^a-zA-Z0-9._\-/]/g, '') || 'main';
  const totalCommits = entries.reduce((s, e) => s + e.commits, 0);

  const lines: string[] = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    `# GitPixel Studio — Local Git Contribution Art Script`,
    `# Artwork: ${safeTitle}`,
    `# Target Repository: ${safeRepo} (${safeBranch})`,
    `# Planned Dates: ${entries.length} | Total Commits: ${totalCommits}`,
    skippedFutureCount > 0
      ? `# Note: Skipped ${skippedFutureCount} future date(s) > today. Schedule them once their date arrives.`
      : `# All included dates are ready.`,
    '',
    `REPO_DIR="${safeRepo}"`,
    `mkdir -p "$REPO_DIR/artworks"`,
    `cd "$REPO_DIR"`,
    '',
    `if [ ! -d ".git" ]; then`,
    `  git init -b ${safeBranch}`,
    `fi`,
    '',
    ...(options.gitName.trim() ? [`git config user.name "${options.gitName.replace(/"/g, '')}"`] : []),
    ...(options.gitEmail.trim() ? [`git config user.email "${options.gitEmail.replace(/"/g, '')}"`] : []),
    '',
    `cat << 'EOF' > README.md`,
    `# ${safeRepo} — Contribution Graph Pixel Art`,
    ``,
    `> **Transparency Notice:** Generated with GitPixel Studio. All commits are explicitly labeled \`[GitPixel Art]\` and represent visual calendar art rather than engineering activity.`,
    `EOF`,
    `git add README.md`,
    `git commit -m "[GitPixel Art] Add disclosure README" || true`,
    '',
    `create_art_commit() {`,
    `  local d="$1"`,
    `  local idx="$2"`,
    `  local total="$3"`,
    `  local ts="\${d}T12:00:$(printf '%02d' $((idx % 60)))Z"`,
    `  echo "GitPixel Art | Artwork: ${safeTitle} | Date: \${d} | Commit \${idx}/\${total}" > "artworks/\${d}.txt"`,
    `  git add "artworks/\${d}.txt"`,
    `  GIT_AUTHOR_DATE="$ts" GIT_COMMITTER_DATE="$ts" git commit -q -m "[GitPixel Art] Pixel \${d} (\${idx}/\${total})"`,
    `}`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('echo "No eligible dates to commit. Paint cells or enable future dates first."');
  } else {
    for (const item of entries) {
      lines.push(`for i in $(seq 1 ${item.commits}); do create_art_commit "${item.date}" "$i" "${item.commits}"; done`);
    }
    lines.push('');
    lines.push(`echo "Done: created ${totalCommits} labeled artwork commits in $(pwd)."`);
    lines.push(`echo "Next step: git remote add origin https://github.com/YOUR_USERNAME/${safeRepo}.git && git push -u origin ${safeBranch}"`);
  }

  return lines.join('\n');
}

export function generatePowerShellScript(
  cells: ArtworkCells,
  dateCommits: Record<string, number>,
  commitsPerLevel: Record<Exclude<IntensityLevel, 0>, number>,
  options: ScriptExportOptions
): string {
  const { entries, skippedFutureCount } = resolveScriptDates(
    cells,
    dateCommits,
    commitsPerLevel,
    options.includeFutureDates
  );
  const safeRepo = slugify(options.repoName || 'gitpixel-art');
  const safeTitle = (options.title || 'Contribution Pixel Art').replace(/["`$]/g, '');
  const safeBranch = (options.branch || 'main').replace(/[^a-zA-Z0-9._\-/]/g, '') || 'main';
  const totalCommits = entries.reduce((s, e) => s + e.commits, 0);

  const lines: string[] = [
    '$ErrorActionPreference = "Stop"',
    `# GitPixel Studio — PowerShell Contribution Art Script`,
    `# Artwork: ${safeTitle} | Dates: ${entries.length} | Commits: ${totalCommits}`,
    skippedFutureCount > 0 ? `# Skipped ${skippedFutureCount} future date(s) > today.` : `# All included dates are ready.`,
    '',
    `$RepoDir = "${safeRepo}"`,
    `New-Item -ItemType Directory -Force -Path "$RepoDir/artworks" | Out-Null`,
    `Set-Location $RepoDir`,
    `if (-not (Test-Path ".git")) { git init -b ${safeBranch} }`,
    ...(options.gitName.trim() ? [`git config user.name "${options.gitName.replace(/"/g, '')}"`] : []),
    ...(options.gitEmail.trim() ? [`git config user.email "${options.gitEmail.replace(/"/g, '')}"`] : []),
    '',
    `@"`,
    `# ${safeRepo} — Contribution Graph Pixel Art`,
    `Generated with GitPixel Studio. Commits are labeled [GitPixel Art].`,
    `"@ | Set-Content -Path "README.md" -Encoding UTF8`,
    `git add README.md`,
    `git commit -m "[GitPixel Art] Add disclosure README" 2>$null`,
    '',
    `function New-ArtCommit($DateStr, $Idx, $Total) {`,
    `  $Ts = "$DateStr" + "T12:00:" + ($Idx % 60).ToString("00") + "Z"`,
    `  "GitPixel Art | $DateStr | $Idx/$Total" | Set-Content -Path "artworks/$DateStr.txt" -Encoding UTF8`,
    `  git add "artworks/$DateStr.txt"`,
    `  $env:GIT_AUTHOR_DATE = $Ts`,
    `  $env:GIT_COMMITTER_DATE = $Ts`,
    `  git commit -q -m "[GitPixel Art] Pixel $DateStr ($Idx/$Total)"`,
    `}`,
    '',
  ];

  if (entries.length === 0) {
    lines.push('Write-Host "No eligible dates to commit."');
  } else {
    for (const item of entries) {
      lines.push(`1..${item.commits} | ForEach-Object { New-ArtCommit "${item.date}" $_ ${item.commits} }`);
    }
    lines.push('');
    lines.push(`Remove-Item Env:GIT_AUTHOR_DATE -ErrorAction SilentlyContinue`);
    lines.push(`Remove-Item Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue`);
    lines.push(`Write-Host "Created ${totalCommits} labeled commits. Push with: git remote add origin <URL>; git push -u origin ${safeBranch}"`);
  }

  return lines.join('\n');
}

export function exportBashScript(
  cells: ArtworkCells,
  dateCommits: Record<string, number>,
  commitsPerLevel: Record<Exclude<IntensityLevel, 0>, number>,
  options: ScriptExportOptions
): void {
  const script = generateGitBashScript(cells, dateCommits, commitsPerLevel, options);
  const blob = new Blob([script], { type: 'text/x-shellscript;charset=utf-8' });
  triggerDownload(blob, `${slugify(options.title)}-gitpixel.sh`);
}

export function exportPowerShellScript(
  cells: ArtworkCells,
  dateCommits: Record<string, number>,
  commitsPerLevel: Record<Exclude<IntensityLevel, 0>, number>,
  options: ScriptExportOptions
): void {
  const script = generatePowerShellScript(cells, dateCommits, commitsPerLevel, options);
  const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${slugify(options.title)}-gitpixel.ps1`);
}

