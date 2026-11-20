export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

export type ToolType =
  | 'pencil'
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'range'
  | 'text'
  | 'shape'
  | 'move'
  | 'select';

export type ShapeType = 'heart' | 'star' | 'circle' | 'square' | 'diamond' | 'arrow';

export type PreviewMode = 'combined' | 'artwork' | 'original' | 'diff';

export type PaletteTheme = 'github-dark' | 'github-light' | 'emerald-studio' | 'violet-pulse';

export type DateSelectionMode = 'single' | 'multiple' | 'range' | 'custom';

export type ScheduleStatus =
  | 'scheduled'
  | 'waiting_for_date'
  | 'ready_for_review'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export type PageRoute =
  | 'landing'
  | 'login'
  | 'repositories'
  | 'scheduler'
  | 'dashboard'
  | 'editor'
  | 'presets'
  | 'artworks'
  | 'export'
  | 'publish-review'
  | 'publish-progress'
  | 'settings'
  | 'privacy'
  | 'shared-preview';

export interface GridCoord {
  col: number; // 0..52
  row: number; // 0..6 (0=Sun, 6=Sat)
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  col: number;
  row: number;
  inYear: boolean;
  existingCount: number;
  existingLevel: IntensityLevel;
}

export interface MonthLabel {
  label: string;
  col: number;
}

export interface ContributionCalendar {
  year: number;
  totalExisting: number;
  weeks: CalendarDay[][]; // [53][7]
  coordByDate: Record<string, GridCoord>;
  dateByCoord: Record<string, string>; // "col,row" -> YYYY-MM-DD
  monthLabels: MonthLabel[];
}

export type ArtworkCells = Record<string, IntensityLevel>; // YYYY-MM-DD -> 1..4

export interface TextOverlayLayer {
  id: string;
  text: string;
  size: 'small' | 'tall';
  spacing: number;
  intensity: Exclude<IntensityLevel, 0>;
  startCol: number;
  startRow: number;
  dates: string[];
}

export interface ArtworkProject {
  id: string;
  title: string;
  selectedYear: number;
  githubUsername: string;
  cells: ArtworkCells;
  presetName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  ownerUid?: string;
  source?: 'cloud' | 'server' | 'local';
}

export interface PresetPixel {
  col: number;
  row: number;
  level: Exclude<IntensityLevel, 0>;
}

export interface PixelPreset {
  id: string;
  name: string;
  category: 'symbols' | 'developer' | 'patterns' | 'text' | 'custom';
  description: string;
  width: number;
  height: number;
  pixels: PresetPixel[];
  isCustom?: boolean;
  createdAt?: string;
}

export interface GitHubUserProfile {
  id: number;
  login: string;
  name: string;
  avatarUrl: string;
  bio: string;
  publicRepos: number;
  followers: number;
  htmlUrl: string;
  grantedScopes: string[];
  isDemo?: boolean;
}

export interface GitHubRepo {
  id: number;
  name: string;
  owner: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  description: string;
  updatedAt: string;
  isDedicatedArtRepo?: boolean;
  permissions?: {
    push?: boolean;
    admin?: boolean;
    pull?: boolean;
  };
}

export interface RepositoryVerification {
  verified: boolean;
  hasPushAccess: boolean;
  hasUnrelatedFiles: boolean;
  sampleEntries: string[];
  defaultBranch: string;
  isDedicatedArtRepo: boolean;
  message: string;
}

export interface RepositoryConnection {
  id: string;
  ownerUid?: string;
  githubRepositoryId: number;
  repositoryName: string;
  owner: string;
  defaultBranch: string;
  isPrivate: boolean;
  htmlUrl: string;
  createdAt: string;
}

export interface ContributionSchedule {
  id: string;
  ownerUid?: string;
  repositoryId: string;
  repositoryName: string;
  artworkId: string;
  selectedDate: string; // YYYY-MM-DD
  plannedCommitCount: number;
  status: ScheduleStatus;
  confirmedOperations?: number;
  remainingOperations?: number;
  githubResultUrl?: string;
  lastError?: string;
  isDryRun?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublishingOperation {
  id: string;
  ownerUid?: string;
  scheduleId: string;
  operationType: string;
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled';
  githubResultUrl: string;
  createdAt: string;
}

export interface PublishingLogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface PublishingJob {
  id: string;
  artworkId: string;
  artworkTitle: string;
  repositoryName: string;
  branch: string;
  totalItems: number;
  completedItems: number;
  totalCommitsPlanned: number;
  completedCommits: number;
  currentOperation: string;
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  logs: PublishingLogEntry[];
  repoUrl?: string;
  lastError?: string;
  isDryRun: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudioSettings {
  defaultYear: number;
  commitsPerLevel: Record<Exclude<IntensityLevel, 0>, number>;
  gridSnap: boolean;
  showExistingUnderlay: boolean;
  warnOnOverlap: boolean;
  paletteTheme: PaletteTheme;
}
