# GitPixel Studio

**Turn Your GitHub Contributions Into Pixel Art.**

GitPixel Studio is a full-stack contribution graph pixel-art editor, live calendar visualizer, exporter, and transparent GitHub publishing studio.

---

## Key Features

- **53 × 7 GitHub Contribution Calendar**: Exact UTC Sunday–Saturday week matrix across 2020–2027 with month/weekday labels, hover date & count inspection, and separation between existing activity and planned artwork.
- **Full Pixel Painting Engine**: Pencil, adjustable Brush (`1×1` / `2×2` / `3×3`), Eraser, Flood Fill, Range Painter (drag or date-picker), Text-to-Pixel (`5px` & `7px` bitmap fonts), Shape Stamp (Heart, Star, Circle, Square, Diamond, Arrow), Move, Rectangular Selection, 60-step Undo/Redo (`Ctrl+Z` / `Ctrl+Y`), and Clear Confirmation.
- **Smart Transforms**: Horizontal/Vertical Flip, 90° Rotation, Center Alignment, Widen/Compact Scaling, 1px Nudge, Duplicate, and Overlap Detection.
- **Built-in & Custom Presets**: 13 curated developer & symbol presets plus a Custom Preset Creator (`13 × 7`).
- **Zero-Auth Exports**: High-DPI PNG (`2×` / `3×`), scalable SVG, portable JSON import/export, print stylesheet, and read-only shareable preview links.
- **Optional Disclosed GitHub Publishing**: Dedicated artwork repository selector/creator, automatic transparency `README.md`, `[GitPixel Art]` commit labeling, rate-limit pacing, cancellation, and live progress dashboard (plus Demo Dry-Run Simulation).

---

## Project Structure

```text
├── server.ts                  # Express backend (GitHub OAuth, GraphQL, Git Data API, persistence)
├── firebase-blueprint.json    # Firestore entity & collection schema blueprint
├── firestore.rules            # Hardened Firestore security rules
├── src/
│   ├── App.tsx                # Application router & shell orchestration
│   ├── context/
│   │   └── StudioContext.tsx  # State management, Undo/Redo, OAuth, Firestore & API sync
│   ├── lib/
│   │   ├── firebase.ts        # Firebase SDK & connection check
│   │   └── firestoreService.ts# Firestore CRUD + structured error handling
│   ├── utils/
│   │   ├── calendar.ts        # 53x7 calendar builder, themes & stats
│   │   ├── pixelFont.ts       # Bitmap pixel font engine
│   │   ├── presets.ts         # Preset library, shape stamps & smart transforms
│   │   └── exportArtwork.ts   # PNG, SVG, JSON & share payload utilities
│   ├── components/
│   │   ├── AppShell.tsx       # Responsive sidebar + mobile drawer + header
│   │   ├── ContributionCanvas.tsx # Interactive pointer/touch 53x7 canvas
│   │   └── ErrorBoundary.tsx  # Graceful error recovery
│   └── pages/
│       ├── LandingPage.tsx
│       ├── LoginPage.tsx
│       ├── DashboardPage.tsx
│       ├── EditorPage.tsx
│       ├── PresetsPage.tsx
│       ├── ArtworksPage.tsx
│       ├── ExportPage.tsx
│       ├── PublishReviewPage.tsx
│       ├── PublishProgressPage.tsx
│       ├── SettingsPage.tsx
│       ├── PrivacyPage.tsx
│       └── SharedPreviewPage.tsx
```

---

## Local Development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in your GitHub OAuth credentials (optional — Demo Mode works without credentials):

   ```env
   APP_URL="http://localhost:3000"
   GITHUB_CLIENT_ID="your_github_oauth_client_id"
   GITHUB_CLIENT_SECRET="your_github_oauth_client_secret"
   SESSION_SECRET="long-random-secret"
   ```

   In GitHub Developer Settings (`https://github.com/settings/developers`), set the **Authorization callback URL** to:
   ```
   <APP_URL>/auth/callback
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

   The full-stack Express + Vite server runs on `http://localhost:3000`.

---

## Build & Deployment

```bash
npm run lint
npm run build
npm start
```

Set `APP_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `SESSION_SECRET` in your production host environment variables, and register `<APP_URL>/auth/callback` in your GitHub OAuth App settings.
