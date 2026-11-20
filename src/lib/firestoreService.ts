import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type {
  ArtworkCells,
  ArtworkProject,
  ContributionSchedule,
  IntensityLevel,
  PixelPreset,
  PresetPixel,
  PublishingJob,
  PublishingOperation,
  RepositoryConnection,
  ScheduleStatus,
} from '../types/studio';
import { auth, db } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeId(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  return clean || `id_${Date.now()}`;
}

function sanitizeCells(cells: ArtworkCells): Record<string, number> {
  const out: Record<string, number> = {};
  let count = 0;
  for (const [date, lvl] of Object.entries(cells)) {
    if (count >= 380) break;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && [1, 2, 3, 4].includes(Number(lvl))) {
      out[date] = Number(lvl);
      count++;
    }
  }
  return out;
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function syncFirebaseUserProfile(
  uid: string,
  githubUsername: string,
  avatarUrl: string,
  displayName: string
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  const ref = doc(db, 'users', safeUid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: safeUid,
        githubUsername: (githubUsername || '').slice(0, 64),
        avatarUrl: (avatarUrl || '').slice(0, 512),
        displayName: (displayName || 'Developer').slice(0, 100),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        githubUsername: (githubUsername || '').slice(0, 64),
        avatarUrl: (avatarUrl || '').slice(0, 512),
        displayName: (displayName || 'Developer').slice(0, 100),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveArtworkToCloud(uid: string, project: ArtworkProject): Promise<ArtworkProject> {
  const safeId = sanitizeId(project.id);
  const path = `artworks/${safeId}`;
  const ref = doc(db, 'artworks', safeId);
  const cleanCells = sanitizeCells(project.cells);

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        id: safeId,
        ownerUid: uid,
        githubUsername: (project.githubUsername || 'demo-dev').slice(0, 64),
        title: (project.title || 'Untitled Artwork').slice(0, 120),
        selectedYear: Number(project.selectedYear),
        cells: cleanCells,
        presetName: (project.presetName || 'Custom').slice(0, 80),
        notes: (project.notes || '').slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        title: (project.title || 'Untitled Artwork').slice(0, 120),
        selectedYear: Number(project.selectedYear),
        githubUsername: (project.githubUsername || 'demo-dev').slice(0, 64),
        cells: cleanCells,
        presetName: (project.presetName || 'Custom').slice(0, 80),
        notes: (project.notes || '').slice(0, 500),
        updatedAt: serverTimestamp(),
      });
    }
    return {
      ...project,
      id: safeId,
      ownerUid: uid,
      source: 'cloud',
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserArtworks(
  uid: string,
  onData: (artworks: ArtworkProject[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, 'artworks'), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ArtworkProject[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id),
          ownerUid: String(data.ownerUid),
          githubUsername: String(data.githubUsername || 'developer'),
          title: String(data.title || 'Untitled'),
          selectedYear: Number(data.selectedYear || new Date().getFullYear()),
          cells: (data.cells || {}) as ArtworkCells,
          presetName: String(data.presetName || 'Custom'),
          notes: String(data.notes || ''),
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
          source: 'cloud',
        };
      });
      items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'artworks');
      } catch (e) {
        if (onError && e instanceof Error) onError(e);
      }
    }
  );
}

export async function deleteArtworkFromCloud(artworkId: string): Promise<void> {
  const safeId = sanitizeId(artworkId);
  const path = `artworks/${safeId}`;
  try {
    await deleteDoc(doc(db, 'artworks', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCustomPresetToCloud(uid: string, preset: PixelPreset): Promise<void> {
  const safeId = sanitizeId(preset.id);
  const path = `customPresets/${safeId}`;
  const encodedPixels = preset.pixels
    .slice(0, 400)
    .map((p) => `${p.col},${p.row},${p.level}`);
  if (encodedPixels.length === 0) return;
  try {
    await setDoc(doc(db, 'customPresets', safeId), {
      id: safeId,
      ownerUid: uid,
      name: preset.name.slice(0, 64),
      category: 'custom',
      width: Math.max(1, Math.min(53, preset.width)),
      height: Math.max(1, Math.min(7, preset.height)),
      pixels: encodedPixels,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function listCustomPresetsFromCloud(uid: string): Promise<PixelPreset[]> {
  try {
    const q = query(collection(db, 'customPresets'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const rawPixels = Array.isArray(data.pixels) ? data.pixels : [];
      const pixels: PresetPixel[] = rawPixels
        .map((s: unknown) => {
          if (typeof s !== 'string') return null;
          const [c, r, l] = s.split(',').map(Number);
          if ([1, 2, 3, 4].includes(l)) {
            return { col: c, row: r, level: l as Exclude<IntensityLevel, 0> };
          }
          return null;
        })
        .filter((x): x is PresetPixel => x !== null);
      return {
        id: String(data.id),
        name: String(data.name),
        category: 'custom',
        description: 'Custom user pixel pattern',
        width: Number(data.width || 7),
        height: Number(data.height || 7),
        pixels,
        isCustom: true,
        createdAt: toIsoString(data.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'customPresets');
  }
}

export async function deleteCustomPresetFromCloud(presetId: string): Promise<void> {
  const safeId = sanitizeId(presetId);
  const path = `customPresets/${safeId}`;
  try {
    await deleteDoc(doc(db, 'customPresets', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSharedSnapshotToCloud(
  uid: string,
  shareId: string,
  project: { title: string; selectedYear: number; githubUsername: string; cells: ArtworkCells }
): Promise<string> {
  const safeId = sanitizeId(shareId);
  const path = `sharedArtworks/${safeId}`;
  try {
    await setDoc(doc(db, 'sharedArtworks', safeId), {
      id: safeId,
      ownerUid: uid,
      githubUsername: (project.githubUsername || 'developer').slice(0, 64),
      title: (project.title || 'Shared Artwork').slice(0, 120),
      selectedYear: Number(project.selectedYear),
      cells: sanitizeCells(project.cells),
      createdAt: serverTimestamp(),
    });
    return safeId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getSharedSnapshotFromCloud(shareId: string): Promise<{
  title: string;
  selectedYear: number;
  githubUsername: string;
  cells: ArtworkCells;
} | null> {
  const safeId = sanitizeId(shareId);
  const path = `sharedArtworks/${safeId}`;
  try {
    const snap = await getDoc(doc(db, 'sharedArtworks', safeId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      title: String(data.title || 'Shared Artwork'),
      selectedYear: Number(data.selectedYear || new Date().getFullYear()),
      githubUsername: String(data.githubUsername || 'developer'),
      cells: (data.cells || {}) as ArtworkCells,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function recordPublishingJobToCloud(uid: string, job: PublishingJob): Promise<void> {
  const safeJobId = sanitizeId(job.id);
  const safeArtworkId = sanitizeId(job.artworkId);
  const path = `publishingJobs/${safeJobId}`;
  try {
    const artRef = doc(db, 'artworks', safeArtworkId);
    const artSnap = await getDoc(artRef);
    if (!artSnap.exists()) return; // Requires existing cloud artwork per security invariant

    const jobRef = doc(db, 'publishingJobs', safeJobId);
    const existingJob = await getDoc(jobRef);
    if (!existingJob.exists()) {
      await setDoc(jobRef, {
        id: safeJobId,
        ownerUid: uid,
        artworkId: safeArtworkId,
        repositoryName: job.repositoryName.slice(0, 140),
        totalItems: job.totalItems,
        completedItems: job.completedItems,
        status: job.status,
        lastError: (job.lastError || '').slice(0, 400),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(jobRef, {
        completedItems: Math.min(job.completedItems, job.totalItems),
        status: job.status,
        lastError: (job.lastError || '').slice(0, 400),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveRepositoryConnectionToCloud(
  uid: string,
  conn: RepositoryConnection
): Promise<void> {
  const safeId = sanitizeId(conn.id);
  const path = `repositoryConnections/${safeId}`;
  try {
    await setDoc(doc(db, 'repositoryConnections', safeId), {
      id: safeId,
      ownerUid: uid,
      githubRepositoryId: Number(conn.githubRepositoryId),
      repositoryName: conn.repositoryName.slice(0, 120),
      owner: conn.owner.slice(0, 64),
      defaultBranch: conn.defaultBranch.slice(0, 80),
      isPrivate: Boolean(conn.isPrivate),
      htmlUrl: conn.htmlUrl.slice(0, 256),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveContributionScheduleToCloud(
  uid: string,
  schedule: ContributionSchedule
): Promise<void> {
  const safeId = sanitizeId(schedule.id);
  const safeRepoId = sanitizeId(schedule.repositoryId);
  const path = `contributionSchedules/${safeId}`;
  try {
    const repoSnap = await getDoc(doc(db, 'repositoryConnections', safeRepoId));
    if (!repoSnap.exists()) return;

    const ref = doc(db, 'contributionSchedules', safeId);
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        id: safeId,
        ownerUid: uid,
        repositoryId: safeRepoId,
        artworkId: sanitizeId(schedule.artworkId),
        selectedDate: schedule.selectedDate,
        plannedCommitCount: Math.max(1, Math.min(20, Number(schedule.plannedCommitCount))),
        status: schedule.status,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        plannedCommitCount: Math.max(1, Math.min(20, Number(schedule.plannedCommitCount))),
        status: schedule.status,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function listContributionSchedulesFromCloud(
  uid: string
): Promise<ContributionSchedule[]> {
  try {
    const q = query(collection(db, 'contributionSchedules'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id),
        ownerUid: String(data.ownerUid),
        repositoryId: String(data.repositoryId),
        repositoryName: '',
        artworkId: String(data.artworkId),
        selectedDate: String(data.selectedDate),
        plannedCommitCount: Number(data.plannedCommitCount || 1),
        status: data.status as ScheduleStatus,
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'contributionSchedules');
  }
}

export async function recordPublishingOperationToCloud(
  uid: string,
  op: PublishingOperation
): Promise<void> {
  const safeId = sanitizeId(op.id);
  const safeScheduleId = sanitizeId(op.scheduleId);
  const path = `publishingOperations/${safeId}`;
  try {
    const schedSnap = await getDoc(doc(db, 'contributionSchedules', safeScheduleId));
    if (!schedSnap.exists()) return;
    await setDoc(doc(db, 'publishingOperations', safeId), {
      id: safeId,
      ownerUid: uid,
      scheduleId: safeScheduleId,
      operationType: op.operationType.slice(0, 64),
      status: op.status,
      githubResultUrl: (op.githubResultUrl || '').slice(0, 300),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

