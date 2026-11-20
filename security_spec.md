# GitPixel Studio Security Specification

## 1. Data Invariants
1. A user profile at `/users/{userId}` can only be read or written by the authenticated user whose `request.auth.uid == userId` (verified email required for writes).
2. Every artwork at `/artworks/{artworkId}` must bind `ownerUid == request.auth.uid`, enforce bounded `cells` map size (`<= 380` days), and prohibit mutating `id`, `ownerUid`, or `createdAt`.
3. Every custom preset at `/customPresets/{presetId}` must bind `ownerUid == request.auth.uid`, validate `pixels` as a non-empty bounded list (`1..400`) of strings, and prohibit cross-user reads/writes.
4. Every publishing job at `/publishingJobs/{jobId}` must reference an existing `/artworks/{artworkId}` owned by `request.auth.uid`, enforce valid status transitions, and lock terminal states (`completed`, `cancelled`, `failed`) against further mutation.
5. Public shared snapshots at `/sharedArtworks/{shareId}` allow exact `get` lookups without `list` enumeration, and only the owner can create or delete their shared snapshot.
6. No GitHub OAuth secrets or plaintext access tokens are ever stored in any Firestore document.
7. Every `/repositoryConnections/{connectionId}` belongs strictly to `ownerUid == request.auth.uid`.
8. Every `/contributionSchedules/{scheduleId}` references an existing `/repositoryConnections/{repositoryId}` owned by `request.auth.uid`, validates `YYYY-MM-DD` date format, bounds `plannedCommitCount` (`1..20`), and locks terminal states (`published`, `cancelled`).
9. Every `/publishingOperations/{operationId}` references an existing `/contributionSchedules/{scheduleId}` owned by `request.auth.uid`.


## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Identity Spoofing on Artwork Create**: `{ id: "art1", ownerUid: "victim_uid", title: "Hack", selectedYear: 2026, cells: {}, ... }` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection on User Create**: `{ uid: "u1", githubUsername: "dev", isAdmin: true, ... }` -> `PERMISSION_DENIED` (`hasOnly` rejects `isAdmin`).
3. **ID Poisoning on Path**: Writing to `/artworks/invalid$id..with..dots` -> `PERMISSION_DENIED` (`isValidId` rejects).
4. **Blanket List Scraping on Users**: `getDocs(collection(db, "users"))` -> `PERMISSION_DENIED` (no `list` allowed on `/users`).
5. **Cross-Tenant List on Artworks**: `getDocs(collection(db, "artworks"))` without `where("ownerUid", "==", uid)` -> `PERMISSION_DENIED`.
6. **Immutable Timestamp Tampering**: Updating artwork with modified `createdAt` or non-server `updatedAt` -> `PERMISSION_DENIED`.
7. **Denial-of-Wallet Oversized Title**: Artwork with 5,000-char `title` -> `PERMISSION_DENIED` (`size() <= 120`).
8. **Denial-of-Wallet Oversized Cells Map**: Artwork with `cells` map having > 380 entries -> `PERMISSION_DENIED`.
9. **Terminal Job State Mutation**: Updating a `publishingJob` whose existing `status == "completed"` back to `"running"` -> `PERMISSION_DENIED`.
10. **Orphaned Publishing Job**: Creating a `publishingJob` referencing a non-existent `artworkId` -> `PERMISSION_DENIED` (`exists()`/`get()` fails).
11. **Array Type Poisoning on CustomPreset**: Creating a `customPreset` with `pixels: [12345]` -> `PERMISSION_DENIED` (`pixels[0] is string` fails).
12. **Public Enumeration on SharedArtworks**: `getDocs(collection(db, "sharedArtworks"))` -> `PERMISSION_DENIED` (`list` is disabled).
