import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleAuthProvider, testFirestoreConnection } from '../lib/firebase';
import {
  deleteArtworkFromCloud,
  deleteCustomPresetFromCloud,
  getSharedSnapshotFromCloud,
  listContributionSchedulesFromCloud,
  listCustomPresetsFromCloud,
  recordPublishingJobToCloud,
  saveArtworkToCloud,
  saveContributionScheduleToCloud,
  saveCustomPresetToCloud,
  saveRepositoryConnectionToCloud,
  saveSharedSnapshotToCloud,
  subscribeUserArtworks,
  syncFirebaseUserProfile,
} from '../lib/firestoreService';
import type {
  ArtworkCells,
  ArtworkProject,
  ContributionCalendar,
  ContributionSchedule,
  GitHubRepo,
  GitHubUserProfile,
  IntensityLevel,
  PageRoute,
  PixelPreset,
  PreviewMode,
  PublishingJob,
  PublishingOperation,
  RepositoryConnection,
  RepositoryVerification,
  ShapeType,
  StudioSettings,
  ToolType,
} from '../types/studio';
import { buildContributionCalendar } from '../utils/calendar';
import { decodeSharePayload, encodeSharePayload, parseImportedProjectJson } from '../utils/exportArtwork';
import { applyPixelsToCells, BUILT_IN_PRESETS } from '../utils/presets';

const DEFAULT_SETTINGS: StudioSettings = {
  defaultYear: 2026,
  commitsPerLevel: { 1: 1, 2: 3, 3: 6, 4: 10 },
  gridSnap: true,
  showExistingUnderlay: true,
  warnOnOverlap: true,
  paletteTheme: 'github-dark',
};

const DEMO_USER: GitHubUserProfile = {
  id: 1048576,
  login: 'maya-lin-dev',
  name: 'Maya Lin',
  avatarUrl: '/src/assets/images/avatar_demo_developer_1795177154962.jpg',
  bio: 'Staff Systems & Tooling Engineer · Open-source contributor',
  publicRepos: 28,
  followers: 412,
  htmlUrl: 'https://github.com',
  grantedScopes: ['demo:read', 'demo:dry-run'],
  isDemo: true,
};

const LOCAL_ARTWORKS_KEY = 'gitpixel_local_artworks_v1';
const LOCAL_PRESETS_KEY = 'gitpixel_local_presets_v1';
const LOCAL_SETTINGS_KEY = 'gitpixel_settings_v1';

interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'info' | 'error';
}

interface StudioContextValue {
  route: PageRoute;
  navigate: (route: PageRoute) => void;
  sharedPreviewData: { title: string; selectedYear: number; githubUsername: string; cells: ArtworkCells } | null;

  // Auth & Demo
  githubUser: GitHubUserProfile | null;
  isDemoMode: boolean;
  oauthConfigured: boolean;
  redirectUri: string;
  authLoading: boolean;
  enterDemoMode: (goTo?: PageRoute) => void;
  connectGitHub: (scopeMode?: 'read' | 'publish') => Promise<void>;
  disconnectGitHub: () => Promise<void>;

  // Firebase Cloud Sync
  firebaseUser: User | null;
  signInCloudSync: () => Promise<void>;
  signOutCloudSync: () => Promise<void>;

  // Calendar & Canvas
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  calendar: ContributionCalendar;
  loadingCalendar: boolean;
  refreshContributions: () => Promise<void>;

  // Editor Painting State
  cells: ArtworkCells;
  setCellsWithHistory: (next: ArtworkCells) => void;
  setCellsLive: (next: ArtworkCells) => void;
  commitHistoryCheckpoint: (snapshotBeforeDrag: ArtworkCells) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearCanvas: () => void;

  activeTool: ToolType;
  setActiveTool: (t: ToolType) => void;
  activeIntensity: Exclude<IntensityLevel, 0>;
  setActiveIntensity: (lvl: Exclude<IntensityLevel, 0>) => void;
  brushSize: 1 | 2 | 3;
  setBrushSize: (size: 1 | 2 | 3) => void;
  activeShape: ShapeType;
  setActiveShape: (s: ShapeType) => void;
  selectedPresetForStamp: PixelPreset | null;
  setSelectedPresetForStamp: (p: PixelPreset | null) => void;
  selection: Set<string>;
  setSelection: (s: Set<string>) => void;
  previewMode: PreviewMode;
  setPreviewMode: (m: PreviewMode) => void;
  selectedDayDate: string | null;
  setSelectedDayDate: (d: string | null) => void;

  // Text Tool State
  textInput: string;
  setTextInput: (v: string) => void;
  textSize: 'small' | 'tall';
  setTextSize: (s: 'small' | 'tall') => void;
  textSpacing: number;
  setTextSpacing: (n: number) => void;

  // Active Artwork Metadata
  activeArtworkId: string;
  artworkTitle: string;
  setArtworkTitle: (t: string) => void;
  artworkNotes: string;
  setArtworkNotes: (n: string) => void;
  presetName: string;
  setPresetName: (p: string) => void;

  // Collections
  savedArtworks: ArtworkProject[];
  loadingArtworks: boolean;
  customPresets: PixelPreset[];
  allPresets: PixelPreset[];
  saveCurrentArtwork: (asCopy?: boolean) => Promise<ArtworkProject>;
  loadArtworkIntoEditor: (project: ArtworkProject, targetRoute?: PageRoute) => void;
  renameArtwork: (id: string, title: string) => Promise<void>;
  duplicateArtwork: (id: string) => Promise<void>;
  deleteArtwork: (id: string) => Promise<void>;
  importArtworkJson: (raw: string) => Promise<ArtworkProject>;
  applyPresetToCanvas: (preset: PixelPreset, mode?: 'replace' | 'overlay') => void;
  saveCustomPreset: (preset: Omit<PixelPreset, 'id' | 'isCustom' | 'createdAt'>) => Promise<void>;
  deleteCustomPreset: (id: string) => Promise<void>;
  createShareLink: () => Promise<string>;

  // Repository Selection & Verification
  repos: GitHubRepo[];
  loadingRepos: boolean;
  loadRepos: () => Promise<void>;
  createDedicatedRepo: (name: string) => Promise<GitHubRepo>;
  selectedRepo: GitHubRepo | null;
  selectedRepoConnection: RepositoryConnection | null;
  repoVerification: RepositoryVerification | null;
  verifyingRepo: boolean;
  selectRepository: (repo: GitHubRepo) => Promise<RepositoryVerification | null>;

  // Date Scheduler & Commit Configuration
  dateCommits: Record<string, number>;
  getCommitCountForDate: (date: string) => number;
  setDateCommitCount: (date: string, count: number) => void;
  setBulkDateCommits: (dates: string[], count: number) => void;
  removeScheduledDate: (date: string) => void;
  schedules: ContributionSchedule[];
  operations: PublishingOperation[];
  loadingSchedules: boolean;
  refreshSchedules: () => Promise<void>;
  saveSchedulesToStore: (dates?: string[]) => Promise<ContributionSchedule[]>;
  cancelSchedule: (id: string) => Promise<void>;
  publishScheduleNow: (id: string) => Promise<void>;

  // Publishing
  publishingJobs: PublishingJob[];
  activeJob: PublishingJob | null;
  setActiveJobId: (id: string | null) => void;
  startPublishJob: (params: {
    repositoryName: string;
    branch: string;
    confirmedDisclosure: boolean;
    dryRun: boolean;
    scheduleMode?: 'publish_ready_and_schedule_future' | 'schedule_only';
    repositoryId?: string;
  }) => Promise<PublishingJob>;
  cancelPublishJob: (jobId: string) => Promise<void>;

  // Settings & Toast
  settings: StudioSettings;
  updateSettings: (patch: Partial<StudioSettings>) => void;
  toasts: ToastMessage[];
  notify: (text: string, tone?: 'success' | 'info' | 'error') => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const [route, setRoute] = useState<PageRoute>('landing');
  const [sharedPreviewData, setSharedPreviewData] = useState<{
    title: string;
    selectedYear: number;
    githubUsername: string;
    cells: ArtworkCells;
  } | null>(null);

  const [githubUser, setGithubUser] = useState<GitHubUserProfile | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [oauthConfigured, setOauthConfigured] = useState<boolean>(false);
  const [redirectUri, setRedirectUri] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const [settings, setSettings] = useState<StudioSettings>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const [selectedYear, setSelectedYear] = useState<number>(settings.defaultYear || 2026);
  const [externalCounts, setExternalCounts] = useState<Record<string, number> | undefined>(undefined);
  const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);

  const [cells, setCells] = useState<ArtworkCells>({});
  const [past, setPast] = useState<ArtworkCells[]>([]);
  const [future, setFuture] = useState<ArtworkCells[]>([]);

  const [activeTool, setActiveTool] = useState<ToolType>('pencil');
  const [activeIntensity, setActiveIntensity] = useState<Exclude<IntensityLevel, 0>>(3);
  const [brushSize, setBrushSize] = useState<1 | 2 | 3>(2);
  const [activeShape, setActiveShape] = useState<ShapeType>('heart');
  const [selectedPresetForStamp, setSelectedPresetForStamp] = useState<PixelPreset | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [previewMode, setPreviewMode] = useState<PreviewMode>('combined');
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  const [textInput, setTextInput] = useState<string>('CODE');
  const [textSize, setTextSize] = useState<'small' | 'tall'>('tall');
  const [textSpacing, setTextSpacing] = useState<number>(1);

  const [activeArtworkId, setActiveArtworkId] = useState<string>(() => `art_${Date.now()}`);
  const [artworkTitle, setArtworkTitle] = useState<string>('Untitled Contribution Art');
  const [artworkNotes, setArtworkNotes] = useState<string>('');
  const [presetName, setPresetName] = useState<string>('Custom');

  const [savedArtworks, setSavedArtworks] = useState<ArtworkProject[]>([]);
  const [loadingArtworks, setLoadingArtworks] = useState<boolean>(false);
  const [customPresets, setCustomPresets] = useState<PixelPreset[]>([]);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedRepoConnection, setSelectedRepoConnection] = useState<RepositoryConnection | null>(null);
  const [repoVerification, setRepoVerification] = useState<RepositoryVerification | null>(null);
  const [verifyingRepo, setVerifyingRepo] = useState<boolean>(false);
  const [dateCommits, setDateCommits] = useState<Record<string, number>>({});
  const [schedules, setSchedules] = useState<ContributionSchedule[]>([]);
  const [operations, setOperations] = useState<PublishingOperation[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState<boolean>(false);
  const [publishingJobs, setPublishingJobs] = useState<PublishingJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: 'success' | 'info' | 'error' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const navigate = useCallback((nextRoute: PageRoute) => {
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const calendar = useMemo(() => {
    return buildContributionCalendar(selectedYear, externalCounts, {
      useDemoFallback: !externalCounts,
      username: githubUser?.login || 'maya-lin-dev',
    });
  }, [selectedYear, externalCounts, githubUser?.login]);

  // Seed initial artwork on first boot so Editor is immediately vivid if user jumps straight in
  const seededInitialRef = useRef(false);
  useEffect(() => {
    if (!seededInitialRef.current && Object.keys(cells).length === 0) {
      seededInitialRef.current = true;
      const heart = BUILT_IN_PRESETS[0];
      const centered = applyPixelsToCells({}, heart.pixels, calendar, 23, 0, true);
      setCells(centered);
      setArtworkTitle('Hello GitPixel');
      setPresetName(heart.name);
    }
  }, [calendar, cells]);

  // Handle share link on startup (?share=cloud:<id> or ?share=<base64>)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareParam = params.get('share');
    if (!shareParam) return;

    (async () => {
      if (shareParam.startsWith('cloud:')) {
        const id = shareParam.slice(6);
        try {
          const cloudData = await getSharedSnapshotFromCloud(id);
          if (cloudData) {
            setSharedPreviewData(cloudData);
            setRoute('shared-preview');
            return;
          }
        } catch {
          notify('Shared cloud artwork could not be loaded.', 'error');
        }
      } else {
        const decoded = decodeSharePayload(shareParam);
        if (decoded) {
          setSharedPreviewData(decoded);
          setRoute('shared-preview');
        }
      }
    })();
  }, [notify]);

  // Startup Firebase connection check + Auth listener
  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await syncFirebaseUserProfile(
            user.uid,
            githubUser?.login || '',
            githubUser?.avatarUrl || user.photoURL || '',
            githubUser?.name || user.displayName || 'Developer'
          );
          const presets = await listCustomPresetsFromCloud(user.uid);
          if (presets.length > 0) setCustomPresets(presets);
        } catch (err) {
          console.error('Firebase profile sync failed:', err);
        }
      }
    });
    return () => unsub();
  }, [githubUser?.avatarUrl, githubUser?.login, githubUser?.name]);

  // Fetch GitHub OAuth session on mount
  const fetchAuthMe = useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      setOauthConfigured(Boolean(data.oauthConfigured));
      setRedirectUri(data.redirectUri || `${window.location.origin}/auth/callback`);
      if (data.authenticated && data.user) {
        setGithubUser(data.user);
        setIsDemoMode(false);
      } else {
        setGithubUser(null);
      }
    } catch {
      setOauthConfigured(false);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthMe();
  }, [fetchAuthMe]);

  // Listen for OAuth popup postMessage
  useEffect(() => {
    const onMsg = (event: MessageEvent) => {
      if (
        !event.origin.endsWith('.run.app') &&
        !event.origin.includes('localhost') &&
        event.origin !== window.location.origin
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchAuthMe().then(() => {
          notify('GitHub account connected securely. Select a repository to continue.', 'success');
          setRoute('repositories');
        });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [fetchAuthMe, notify]);

  const enterDemoMode = useCallback(
    (goTo: PageRoute = 'editor') => {
      setIsDemoMode(true);
      setGithubUser(DEMO_USER);
      setExternalCounts(undefined);
      notify('Demo Mode active — full painting, export, and dry-run features unlocked.', 'info');
      setRoute(goTo);
    },
    [notify]
  );

  const connectGitHub = useCallback(
    async (scopeMode: 'read' | 'publish' = 'read') => {
      try {
        const res = await fetch(`/api/auth/github/url?scope=${scopeMode}`, { credentials: 'include' });
        const data = await res.json();
        if (!data.configured || !data.url) {
          notify('GitHub OAuth credentials are not configured yet. Opening setup details.', 'info');
          setRoute('login');
          return;
        }
        const popup = window.open(data.url, 'github_oauth_popup', 'width=620,height=740');
        if (!popup) {
          notify('Popup was blocked. Allow popups for this preview to sign in with GitHub.', 'error');
        }
      } catch {
        notify('Unable to initiate GitHub OAuth flow.', 'error');
      }
    },
    [notify]
  );

  const disconnectGitHub = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setGithubUser(null);
    setIsDemoMode(false);
    setExternalCounts(undefined);
    setRepos([]);
    setSelectedRepo(null);
    setSelectedRepoConnection(null);
    setRepoVerification(null);
    notify('Signed out of GitHub session.', 'info');
    setRoute('landing');
  }, [notify]);

  const signInCloudSync = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      notify('Cloud persistence connected via Firebase.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Cloud sign-in cancelled.', 'error');
    }
  }, [notify]);

  const signOutCloudSync = useCallback(async () => {
    await signOut(auth);
    notify('Signed out of cloud persistence.', 'info');
  }, [notify]);

  // Fetch GitHub contributions when authenticated & year changes
  const refreshContributions = useCallback(async () => {
    if (!githubUser || githubUser.isDemo) {
      setExternalCounts(undefined);
      return;
    }
    setLoadingCalendar(true);
    try {
      const res = await fetch(
        `/api/github/contributions?username=${encodeURIComponent(githubUser.login)}&year=${selectedYear}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (data.source === 'github' && data.countsByDate) {
        setExternalCounts(data.countsByDate);
      } else {
        setExternalCounts(undefined);
      }
    } catch {
      setExternalCounts(undefined);
    } finally {
      setLoadingCalendar(false);
    }
  }, [githubUser, selectedYear]);

  useEffect(() => {
    refreshContributions();
  }, [refreshContributions]);

  // Load saved artworks from Firestore (when signed in) + Express server + localStorage fallback
  useEffect(() => {
    let unsubFirestore: (() => void) | undefined;
    const ownerKey = githubUser && !githubUser.isDemo ? `gh_${githubUser.login}` : 'demo';

    const loadLocalAndServer = async () => {
      setLoadingArtworks(true);
      let serverList: ArtworkProject[] = [];
      try {
        const res = await fetch(`/api/artworks?owner=${encodeURIComponent(ownerKey)}`);
        const data = await res.json();
        if (Array.isArray(data.artworks)) {
          serverList = data.artworks.map((a: any) => ({ ...a, source: 'server' }));
        }
      } catch {}

      let localList: ArtworkProject[] = [];
      try {
        const raw = localStorage.getItem(LOCAL_ARTWORKS_KEY);
        if (raw) localList = JSON.parse(raw);
      } catch {}

      const merged = new Map<string, ArtworkProject>();
      for (const item of [...localList, ...serverList]) {
        merged.set(item.id, item);
      }
      setSavedArtworks(
        Array.from(merged.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      );
      setLoadingArtworks(false);
    };

    if (firebaseUser) {
      setLoadingArtworks(true);
      unsubFirestore = subscribeUserArtworks(
        firebaseUser.uid,
        (cloudItems) => {
          setSavedArtworks(cloudItems);
          setLoadingArtworks(false);
        },
        () => {
          loadLocalAndServer();
        }
      );
    } else {
      loadLocalAndServer();
    }

    // Load local custom presets if not signed into Firebase
    if (!firebaseUser) {
      try {
        const raw = localStorage.getItem(LOCAL_PRESETS_KEY);
        if (raw) setCustomPresets(JSON.parse(raw));
      } catch {}
    }

    return () => {
      if (unsubFirestore) unsubFirestore();
    };
  }, [firebaseUser, githubUser]);

  // Load publishing jobs from server
  useEffect(() => {
    fetch('/api/github/publish')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.jobs)) setPublishingJobs(d.jobs);
      })
      .catch(() => {});
  }, []);

  // Poll active running job
  const activeJob = useMemo(
    () => publishingJobs.find((j) => j.id === activeJobId) || publishingJobs[0] || null,
    [publishingJobs, activeJobId]
  );

  useEffect(() => {
    if (!activeJob || activeJob.status !== 'running') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/github/publish/${activeJob.id}`);
        if (!res.ok) return;
        const { job } = await res.json();
        setPublishingJobs((prev) => {
          const idx = prev.findIndex((x) => x.id === job.id);
          if (idx === -1) return [job, ...prev];
          const copy = [...prev];
          copy[idx] = job;
          return copy;
        });
        if (firebaseUser && job.status !== 'running') {
          recordPublishingJobToCloud(firebaseUser.uid, job).catch(() => {});
        }
        if (job.status !== 'running') {
          const ownerKey = githubUser && !githubUser.isDemo ? `gh_${githubUser.login}` : 'demo';
          fetch(`/api/schedules?owner=${encodeURIComponent(ownerKey)}`)
            .then((r) => r.json())
            .then((d) => {
              if (Array.isArray(d.schedules)) setSchedules(d.schedules);
              if (Array.isArray(d.operations)) setOperations(d.operations);
            })
            .catch(() => {});
        }
      } catch {}
    }, 600);
    return () => clearInterval(timer);
  }, [activeJob, firebaseUser, githubUser]);

  // Undo / Redo painting helpers
  const setCellsWithHistory = useCallback(
    (next: ArtworkCells) => {
      setPast((prev) => [...prev.slice(-59), cells]);
      setFuture([]);
      setCells(next);
    },
    [cells]
  );

  const setCellsLive = useCallback((next: ArtworkCells) => {
    setCells(next);
  }, []);

  const commitHistoryCheckpoint = useCallback((snapshotBeforeDrag: ArtworkCells) => {
    setPast((prev) => [...prev.slice(-59), snapshotBeforeDrag]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setFuture((f) => [cells, ...f.slice(0, 59)]);
      setCells(previous);
      return prev.slice(0, -1);
    });
  }, [cells]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setPast((p) => [...p.slice(-59), cells]);
      setCells(next);
      return prev.slice(1);
    });
  }, [cells]);

  const clearCanvas = useCallback(() => {
    setCellsWithHistory({});
    setSelection(new Set());
    notify('Canvas artwork cleared.', 'info');
  }, [notify, setCellsWithHistory]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (route !== 'editor') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, route, undo]);

  const saveCurrentArtwork = useCallback(
    async (asCopy = false): Promise<ArtworkProject> => {
      const id = asCopy ? `art_${Date.now()}` : activeArtworkId;
      const title = asCopy ? `${artworkTitle} (Copy)` : artworkTitle.trim() || 'Untitled Artwork';
      const now = new Date().toISOString();
      const project: ArtworkProject = {
        id,
        title,
        selectedYear,
        githubUsername: githubUser?.login || 'maya-lin-dev',
        cells,
        presetName,
        notes: artworkNotes,
        createdAt: now,
        updatedAt: now,
      };

      if (asCopy) {
        setActiveArtworkId(id);
        setArtworkTitle(title);
      }

      // Persist to Firebase Cloud if signed in
      if (firebaseUser) {
        const cloudSaved = await saveArtworkToCloud(firebaseUser.uid, project);
        notify(`Saved "${title}" to cloud storage.`, 'success');
        return cloudSaved;
      }

      // Persist to Express server & localStorage
      const ownerKey = githubUser && !githubUser.isDemo ? `gh_${githubUser.login}` : 'demo';
      try {
        await fetch('/api/artworks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...project, ownerKey }),
        });
      } catch {}

      setSavedArtworks((prev) => {
        const filtered = prev.filter((a) => a.id !== project.id);
        const next = [project, ...filtered];
        try {
          localStorage.setItem(LOCAL_ARTWORKS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });

      notify(`Saved "${title}".`, 'success');
      return project;
    },
    [activeArtworkId, artworkNotes, artworkTitle, cells, firebaseUser, githubUser, notify, presetName, selectedYear]
  );

  const loadArtworkIntoEditor = useCallback(
    (project: ArtworkProject, targetRoute: PageRoute = 'editor') => {
      setActiveArtworkId(project.id);
      setArtworkTitle(project.title);
      setArtworkNotes(project.notes || '');
      setPresetName(project.presetName || 'Custom');
      setSelectedYear(project.selectedYear);
      setPast([]);
      setFuture([]);
      setCells(project.cells || {});
      setSelection(new Set());
      setRoute(targetRoute);
      notify(`Loaded "${project.title}".`, 'info');
    },
    [notify]
  );

  const renameArtwork = useCallback(
    async (id: string, title: string) => {
      const target = savedArtworks.find((a) => a.id === id);
      if (!target) return;
      const updated = { ...target, title: title.trim() || target.title, updatedAt: new Date().toISOString() };
      if (firebaseUser) {
        await saveArtworkToCloud(firebaseUser.uid, updated);
      } else {
        const ownerKey = githubUser && !githubUser.isDemo ? `gh_${githubUser.login}` : 'demo';
        await fetch('/api/artworks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...updated, ownerKey }),
        }).catch(() => {});
        setSavedArtworks((prev) => {
          const next = prev.map((a) => (a.id === id ? updated : a));
          localStorage.setItem(LOCAL_ARTWORKS_KEY, JSON.stringify(next));
          return next;
        });
      }
      if (id === activeArtworkId) setArtworkTitle(updated.title);
      notify(`Renamed artwork to "${updated.title}".`, 'success');
    },
    [activeArtworkId, firebaseUser, githubUser, notify, savedArtworks]
  );

  const duplicateArtwork = useCallback(
    async (id: string) => {
      const target = savedArtworks.find((a) => a.id === id);
      if (!target) return;
      const now = new Date().toISOString();
      const copy: ArtworkProject = {
        ...target,
        id: `art_${Date.now()}`,
        title: `${target.title} (Copy)`,
        createdAt: now,
        updatedAt: now,
      };
      if (firebaseUser) {
        await saveArtworkToCloud(firebaseUser.uid, copy);
      } else {
        const ownerKey = githubUser && !githubUser.isDemo ? `gh_${githubUser.login}` : 'demo';
        await fetch('/api/artworks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...copy, ownerKey }),
        }).catch(() => {});
        setSavedArtworks((prev) => {
          const next = [copy, ...prev];
          localStorage.setItem(LOCAL_ARTWORKS_KEY, JSON.stringify(next));
          return next;
        });
      }
      notify(`Duplicated "${target.title}".`, 'success');
    },
    [firebaseUser, githubUser, notify, savedArtworks]
  );

  const deleteArtwork = useCallback(
    async (id: string) => {
      if (firebaseUser) {
        await deleteArtworkFromCloud(id);
      } else {
        await fetch(`/api/artworks/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
        setSavedArtworks((prev) => {
          const next = prev.filter((a) => a.id !== id);
          localStorage.setItem(LOCAL_ARTWORKS_KEY, JSON.stringify(next));
          return next;
        });
      }
      notify('Artwork deleted.', 'info');
    },
    [firebaseUser, notify]
  );

  const importArtworkJson = useCallback(
    async (raw: string): Promise<ArtworkProject> => {
      const parsed = parseImportedProjectJson(raw);
      const now = new Date().toISOString();
      const project: ArtworkProject = {
        id: `art_${Date.now()}`,
        title: parsed.title || 'Imported Artwork',
        selectedYear: parsed.selectedYear || selectedYear,
        githubUsername: parsed.githubUsername || githubUser?.login || 'developer',
        cells: parsed.cells || {},
        presetName: parsed.presetName || 'Imported',
        notes: parsed.notes || '',
        createdAt: now,
        updatedAt: now,
      };
      loadArtworkIntoEditor(project, 'editor');
      return project;
    },
    [githubUser?.login, loadArtworkIntoEditor, selectedYear]
  );

  const applyPresetToCanvas = useCallback(
    (preset: PixelPreset, mode: 'replace' | 'overlay' = 'replace') => {
      const offsetCol = Math.max(0, Math.floor((53 - preset.width) / 2));
      const offsetRow = Math.max(0, Math.floor((7 - preset.height) / 2));
      const next = applyPixelsToCells(cells, preset.pixels, calendar, offsetCol, offsetRow, mode === 'replace');
      setCellsWithHistory(next);
      setPresetName(preset.name);
      setArtworkTitle(preset.name);
      notify(`Applied "${preset.name}" to canvas.`, 'success');
      setRoute('editor');
    },
    [calendar, cells, notify, setCellsWithHistory]
  );

  const saveCustomPreset = useCallback(
    async (preset: Omit<PixelPreset, 'id' | 'isCustom' | 'createdAt'>) => {
      const full: PixelPreset = {
        ...preset,
        id: `cpreset_${Date.now()}`,
        category: 'custom',
        isCustom: true,
        createdAt: new Date().toISOString(),
      };
      if (firebaseUser) {
        await saveCustomPresetToCloud(firebaseUser.uid, full);
      }
      setCustomPresets((prev) => {
        const next = [full, ...prev];
        try {
          localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      notify(`Saved custom preset "${full.name}".`, 'success');
    },
    [firebaseUser, notify]
  );

  const deleteCustomPreset = useCallback(
    async (id: string) => {
      if (firebaseUser) {
        await deleteCustomPresetFromCloud(id);
      }
      setCustomPresets((prev) => {
        const next = prev.filter((p) => p.id !== id);
        try {
          localStorage.setItem(LOCAL_PRESETS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      notify('Custom preset deleted.', 'info');
    },
    [firebaseUser, notify]
  );

  const createShareLink = useCallback(async (): Promise<string> => {
    const base = window.location.origin;
    if (firebaseUser) {
      const shareId = `share_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      await saveSharedSnapshotToCloud(firebaseUser.uid, shareId, {
        title: artworkTitle,
        selectedYear,
        githubUsername: githubUser?.login || 'developer',
        cells,
      });
      return `${base}/?share=cloud:${shareId}`;
    }
    const token = encodeSharePayload({
      title: artworkTitle,
      selectedYear,
      githubUsername: githubUser?.login || 'developer',
      cells,
    });
    return `${base}/?share=${token}`;
  }, [artworkTitle, cells, firebaseUser, githubUser?.login, selectedYear]);

  const loadRepos = useCallback(async () => {
    if (!githubUser || githubUser.isDemo) {
      const demoOwner = githubUser?.login || 'maya-lin-dev';
      setRepos([
        {
          id: 901,
          name: 'gitpixel-art-2026',
          owner: demoOwner,
          fullName: `${demoOwner}/gitpixel-art-2026`,
          private: false,
          htmlUrl: 'https://github.com',
          defaultBranch: 'main',
          description: 'Dedicated contribution pixel art repository (Demo)',
          updatedAt: new Date().toISOString(),
          isDedicatedArtRepo: true,
          permissions: { push: true, admin: true, pull: true },
        },
        {
          id: 902,
          name: 'portfolio-site',
          owner: demoOwner,
          fullName: `${demoOwner}/portfolio-site`,
          private: false,
          htmlUrl: 'https://github.com',
          defaultBranch: 'main',
          description: 'Personal engineering portfolio & blog (contains source files)',
          updatedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
          isDedicatedArtRepo: false,
          permissions: { push: true, admin: true, pull: true },
        },
      ]);
      return;
    }
    setLoadingRepos(true);
    try {
      const res = await fetch('/api/github/repos', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.repos)) {
        setRepos(data.repos);
      }
    } catch {
      notify('Failed to fetch GitHub repositories.', 'error');
    } finally {
      setLoadingRepos(false);
    }
  }, [githubUser, notify]);

  const selectRepository = useCallback(
    async (repo: GitHubRepo): Promise<RepositoryVerification | null> => {
      setSelectedRepo(repo);
      setVerifyingRepo(true);
      let verification: RepositoryVerification;

      try {
        if (!githubUser || githubUser.isDemo) {
          const isArt = Boolean(repo.isDedicatedArtRepo);
          verification = {
            verified: true,
            hasPushAccess: true,
            hasUnrelatedFiles: !isArt,
            sampleEntries: isArt ? ['README.md', 'artworks'] : ['package.json', 'src', 'README.md'],
            defaultBranch: repo.defaultBranch || 'main',
            isDedicatedArtRepo: isArt,
            message: isArt
              ? 'Demo repository verified and isolated for contribution artwork.'
              : 'Warning: Repository contains existing project files (package.json, src). Creating a dedicated artwork repo is recommended.',
          };
        } else {
          const res = await fetch(
            `/api/github/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/verify`,
            { credentials: 'include' }
          );
          verification = await res.json();
        }
        setRepoVerification(verification);

        const ownerKey = githubUser && !githubUser.isDemo ? `gh_${githubUser.login}` : 'demo';
        const conn: RepositoryConnection = {
          id: `conn_${repo.id}`,
          ownerUid: firebaseUser?.uid,
          githubRepositoryId: repo.id,
          repositoryName: repo.fullName,
          owner: repo.owner,
          defaultBranch: verification.defaultBranch || repo.defaultBranch || 'main',
          isPrivate: repo.private,
          htmlUrl: repo.htmlUrl,
          createdAt: new Date().toISOString(),
        };
        setSelectedRepoConnection(conn);
        fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerKey, connection: conn }),
        }).catch(() => {});

        if (firebaseUser) {
          saveRepositoryConnectionToCloud(firebaseUser.uid, conn).catch(() => {});
        }
        return verification;
      } catch {
        notify('Could not verify repository permissions.', 'error');
        return null;
      } finally {
        setVerifyingRepo(false);
      }
    },
    [firebaseUser, githubUser, notify]
  );

  const createDedicatedRepo = useCallback(
    async (name: string): Promise<GitHubRepo> => {
      if (!githubUser || githubUser.isDemo) {
        const owner = githubUser?.login || 'maya-lin-dev';
        const mockRepo: GitHubRepo = {
          id: Date.now(),
          name,
          owner,
          fullName: `${owner}/${name}`,
          private: false,
          htmlUrl: 'https://github.com',
          defaultBranch: 'main',
          description: 'Dedicated GitHub contribution graph pixel artwork repository.',
          updatedAt: new Date().toISOString(),
          isDedicatedArtRepo: true,
          permissions: { push: true, admin: true, pull: true },
        };
        setRepos((prev) => [mockRepo, ...prev]);
        notify(`Created demo artwork repo "${name}".`, 'success');
        await selectRepository(mockRepo);
        return mockRepo;
      }
      const res = await fetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create repository');
      setRepos((prev) => [data.repo, ...prev]);
      notify(`Created dedicated repository "${data.repo.fullName}" with disclosure README.`, 'success');
      await selectRepository(data.repo);
      return data.repo;
    },
    [githubUser, notify, selectRepository]
  );

  const countToIntensity = (count: number): Exclude<IntensityLevel, 0> => {
    if (count >= 8) return 4;
    if (count >= 5) return 3;
    if (count >= 2) return 2;
    return 1;
  };

  const getCommitCountForDate = useCallback(
    (date: string): number => {
      if (typeof dateCommits[date] === 'number' && dateCommits[date] > 0) {
        return dateCommits[date];
      }
      const lvl = cells[date];
      if (lvl && lvl > 0) {
        return settings.commitsPerLevel[lvl as Exclude<IntensityLevel, 0>] || 1;
      }
      return 0;
    },
    [cells, dateCommits, settings.commitsPerLevel]
  );

  const setDateCommitCount = useCallback(
    (date: string, count: number) => {
      const clamped = Math.max(0, Math.min(20, Math.round(count)));
      if (clamped === 0) {
        setDateCommits((prev) => {
          const next = { ...prev };
          delete next[date];
          return next;
        });
        const nextCells = { ...cells };
        delete nextCells[date];
        setCellsWithHistory(nextCells);
      } else {
        setDateCommits((prev) => ({ ...prev, [date]: clamped }));
        setCellsWithHistory({ ...cells, [date]: countToIntensity(clamped) });
      }
    },
    [cells, setCellsWithHistory]
  );

  const setBulkDateCommits = useCallback(
    (dates: string[], count: number) => {
      const clamped = Math.max(0, Math.min(20, Math.round(count)));
      const nextDateCommits = { ...dateCommits };
      const nextCells = { ...cells };
      for (const d of dates) {
        if (clamped === 0) {
          delete nextDateCommits[d];
          delete nextCells[d];
        } else {
          nextDateCommits[d] = clamped;
          nextCells[d] = countToIntensity(clamped);
        }
      }
      setDateCommits(nextDateCommits);
      setCellsWithHistory(nextCells);
    },
    [cells, dateCommits, setCellsWithHistory]
  );

  const removeScheduledDate = useCallback(
    (date: string) => {
      setDateCommits((prev) => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
      const nextCells = { ...cells };
      delete nextCells[date];
      setCellsWithHistory(nextCells);
    },
    [cells, setCellsWithHistory]
  );

  const refreshSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    const ownerKey = githubUser && !githubUser.isDemo ? `gh_${githubUser.login}` : 'demo';
    try {
      const res = await fetch(`/api/schedules?owner=${encodeURIComponent(ownerKey)}`);
      const data = await res.json();
      let merged: ContributionSchedule[] = Array.isArray(data.schedules) ? data.schedules : [];
      if (Array.isArray(data.operations)) setOperations(data.operations);

      if (firebaseUser) {
        try {
          const cloudSchedules = await listContributionSchedulesFromCloud(firebaseUser.uid);
          const map = new Map<string, ContributionSchedule>();
          for (const cs of cloudSchedules) map.set(cs.id, cs);
          for (const ss of merged) map.set(ss.id, ss);
          merged = Array.from(map.values()).sort((a, b) => a.selectedDate.localeCompare(b.selectedDate));
        } catch {}
      }
      setSchedules(merged);
    } catch {
    } finally {
      setLoadingSchedules(false);
    }
  }, [firebaseUser, githubUser]);

  useEffect(() => {
    refreshSchedules();
  }, [refreshSchedules]);

  const saveSchedulesToStore = useCallback(
    async (dates?: string[]): Promise<ContributionSchedule[]> => {
      const ownerKey = githubUser && !githubUser.isDemo ? `gh_${githubUser.login}` : 'demo';
      const todayISO = new Date().toISOString().slice(0, 10);
      const targetDates =
        dates && dates.length > 0
          ? dates
          : Object.keys(cells)
              .filter((d) => (cells[d] ?? 0) > 0)
              .sort();

      if (targetDates.length === 0) {
        notify('Select at least one date or paint cells before saving a schedule.', 'error');
        return [];
      }

      const repoName = selectedRepo?.fullName || `${githubUser?.login || 'maya-lin-dev'}/gitpixel-art-${selectedYear}`;
      const repoId = selectedRepoConnection?.id || (selectedRepo ? `conn_${selectedRepo.id}` : 'repo_default');
      const now = new Date().toISOString();

      const items: ContributionSchedule[] = targetDates.map((d) => {
        const count = Math.max(1, Math.min(20, getCommitCountForDate(d) || 1));
        const isFuture = d > todayISO;
        return {
          id: `sched_${d.replace(/-/g, '')}_${Math.random().toString(36).slice(2, 6)}`,
          ownerUid: firebaseUser?.uid,
          repositoryId: repoId,
          repositoryName: repoName,
          artworkId: activeArtworkId,
          selectedDate: d,
          plannedCommitCount: count,
          status: isFuture ? 'waiting_for_date' : 'ready_for_review',
          confirmedOperations: 0,
          remainingOperations: count,
          isDryRun: !githubUser || Boolean(githubUser.isDemo),
          createdAt: now,
          updatedAt: now,
        };
      });

      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerKey, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save schedules');

      if (firebaseUser && selectedRepoConnection) {
        for (const s of items) {
          saveContributionScheduleToCloud(firebaseUser.uid, s).catch(() => {});
        }
      }

      await refreshSchedules();
      notify(`Saved ${items.length} contribution schedule(s).`, 'success');
      return data.schedules || items;
    },
    [
      activeArtworkId,
      cells,
      firebaseUser,
      getCommitCountForDate,
      githubUser,
      notify,
      refreshSchedules,
      selectedRepo,
      selectedRepoConnection,
      selectedYear,
    ]
  );

  const cancelSchedule = useCallback(
    async (id: string) => {
      await fetch(`/api/schedules/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
      await refreshSchedules();
      notify('Schedule cancelled.', 'info');
    },
    [notify, refreshSchedules]
  );

  const publishScheduleNow = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/schedules/${encodeURIComponent(id)}/publish-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ branch: selectedRepo?.defaultBranch || 'main' }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Unable to publish schedule.', 'error');
        return;
      }
      if (data.job) {
        setPublishingJobs((prev) => [data.job, ...prev]);
        setActiveJobId(data.job.id);
      }
      await refreshSchedules();
      notify('Started publication for arrived schedule.', 'success');
    },
    [notify, refreshSchedules, selectedRepo?.defaultBranch]
  );

  const startPublishJob = useCallback(
    async ({
      repositoryName,
      branch,
      confirmedDisclosure,
      dryRun,
      scheduleMode = 'publish_ready_and_schedule_future',
      repositoryId,
    }: {
      repositoryName: string;
      branch: string;
      confirmedDisclosure: boolean;
      dryRun: boolean;
      scheduleMode?: 'publish_ready_and_schedule_future' | 'schedule_only';
      repositoryId?: string;
    }): Promise<PublishingJob> => {
      const resolvedDateCommits: Record<string, number> = {};
      for (const [d, lvl] of Object.entries(cells)) {
        if (lvl > 0) {
          resolvedDateCommits[d] = getCommitCountForDate(d);
        }
      }
      for (const [d, c] of Object.entries(dateCommits)) {
        if (c > 0) resolvedDateCommits[d] = c;
      }

      const res = await fetch('/api/github/publish/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          artworkId: activeArtworkId,
          artworkTitle,
          repositoryId: repositoryId || selectedRepoConnection?.id || 'repo_default',
          repositoryName,
          branch,
          cells,
          dateCommits: resolvedDateCommits,
          commitsPerLevel: settings.commitsPerLevel,
          confirmedDisclosure,
          dryRun,
          scheduleMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start publishing job');

      const job: PublishingJob = data.job;
      setPublishingJobs((prev) => [job, ...prev]);
      setActiveJobId(job.id);
      if (firebaseUser) {
        recordPublishingJobToCloud(firebaseUser.uid, job).catch(() => {});
      }
      await refreshSchedules();
      setRoute('publish-progress');
      return job;
    },
    [
      activeArtworkId,
      artworkTitle,
      cells,
      dateCommits,
      firebaseUser,
      getCommitCountForDate,
      refreshSchedules,
      selectedRepoConnection?.id,
      settings.commitsPerLevel,
    ]
  );

  const cancelPublishJob = useCallback(
    async (jobId: string) => {
      await fetch(`/api/github/publish/${encodeURIComponent(jobId)}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      notify('Cancellation requested — stopping safely.', 'info');
    },
    [notify]
  );

  const updateSettings = useCallback((patch: Partial<StudioSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const allPresets = useMemo(() => [...customPresets, ...BUILT_IN_PRESETS], [customPresets]);

  const value: StudioContextValue = {
    route,
    navigate,
    sharedPreviewData,
    githubUser,
    isDemoMode,
    oauthConfigured,
    redirectUri,
    authLoading,
    enterDemoMode,
    connectGitHub,
    disconnectGitHub,
    firebaseUser,
    signInCloudSync,
    signOutCloudSync,
    selectedYear,
    setSelectedYear,
    calendar,
    loadingCalendar,
    refreshContributions,
    cells,
    setCellsWithHistory,
    setCellsLive,
    commitHistoryCheckpoint,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
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
    activeArtworkId,
    artworkTitle,
    setArtworkTitle,
    artworkNotes,
    setArtworkNotes,
    presetName,
    setPresetName,
    savedArtworks,
    loadingArtworks,
    customPresets,
    allPresets,
    saveCurrentArtwork,
    loadArtworkIntoEditor,
    renameArtwork,
    duplicateArtwork,
    deleteArtwork,
    importArtworkJson,
    applyPresetToCanvas,
    saveCustomPreset,
    deleteCustomPreset,
    createShareLink,
    repos,
    loadingRepos,
    loadRepos,
    createDedicatedRepo,
    selectedRepo,
    selectedRepoConnection,
    repoVerification,
    verifyingRepo,
    selectRepository,
    dateCommits,
    getCommitCountForDate,
    setDateCommitCount,
    setBulkDateCommits,
    removeScheduledDate,
    schedules,
    operations,
    loadingSchedules,
    refreshSchedules,
    saveSchedulesToStore,
    cancelSchedule,
    publishScheduleNow,
    publishingJobs,
    activeJob,
    setActiveJobId,
    startPublishJob,
    cancelPublishJob,
    settings,
    updateSettings,
    toasts,
    notify,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used inside StudioProvider');
  return ctx;
}
