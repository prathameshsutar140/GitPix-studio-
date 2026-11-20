import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const SESSION_COOKIE = 'gp_session';
const STATE_COOKIE = 'gp_oauth_state';
const STORE_DIR = path.join(__dirname, '.data');
const STORE_FILE = path.join(STORE_DIR, 'studio-store.json');

interface ServerSession {
  id: string;
  accessToken: string;
  scopes: string[];
  user: {
    id: number;
    login: string;
    name: string;
    avatarUrl: string;
    bio: string;
    publicRepos: number;
    followers: number;
    htmlUrl: string;
  };
  createdAt: number;
}

interface StoredData {
  artworks: Record<string, any>;
  customPresets: Record<string, any>;
  jobs: Record<string, any>;
  connections: Record<string, any>;
  schedules: Record<string, any>;
  operations: Record<string, any>;
}

const sessions = new Map<string, ServerSession>();
const activePublishControllers = new Map<string, { cancelled: boolean }>();

function ensureStore(): StoredData {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      const initial: StoredData = {
        artworks: {},
        customPresets: {},
        jobs: {},
        connections: {},
        schedules: {},
        operations: {},
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return {
      artworks: parsed.artworks || {},
      customPresets: parsed.customPresets || {},
      jobs: parsed.jobs || {},
      connections: parsed.connections || {},
      schedules: parsed.schedules || {},
      operations: parsed.operations || {},
    };
  } catch {
    return { artworks: {}, customPresets: {}, jobs: {}, connections: {}, schedules: {}, operations: {} };
  }
}

function saveStore(data: StoredData): void {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

function getAppBaseUrl(req: Request): string {
  if (process.env.APP_URL && !process.env.APP_URL.includes('MY_APP_URL')) {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function getSessionFromReq(req: Request): ServerSession | null {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid || typeof sid !== 'string') return null;
  return sessions.get(sid) || null;
}

async function githubFetch(url: string, token: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'GitPixel-Studio',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
  return res;
}

function getCookieOptions(req: Request) {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (process.env.APP_URL || '').startsWith('https://');
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}

async function createServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // --- Health ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'GitPixel Studio' });
  });

  // --- GitHub OAuth URL ---
  app.get('/api/auth/github/url', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const baseUrl = getAppBaseUrl(req);
    const redirectUri = `${baseUrl}/auth/callback`;

    const requestedMode = req.query.scope === 'publish' ? 'publish' : 'read';
    const scope = requestedMode === 'publish' ? 'read:user public_repo' : 'read:user';

    if (!clientId || !clientSecret) {
      return res.json({
        configured: false,
        redirectUri,
        requestedScope: scope,
      });
    }

    const state = crypto.randomBytes(24).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      ...getCookieOptions(req),
      maxAge: 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
    });

    res.json({
      configured: true,
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
      redirectUri,
      requestedScope: scope,
    });
  });

  // --- GitHub OAuth Callback (handle with and without trailing slash) ---
  const handleOAuthCallback = async (req: Request, res: Response) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const savedState = req.cookies?.[STATE_COOKIE];

    if (!code || !state || !savedState || state !== savedState) {
      return res.status(400).send(`
        <html>
          <body style="font-family:sans-serif;background:#0B0F17;color:#F8FAFC;padding:24px;">
            <h3>Authentication State Verification Failed</h3>
            <p>Please close this window and try connecting your GitHub account again.</p>
          </body>
        </html>
      `);
    }

    res.clearCookie(STATE_COOKIE, getCookieOptions(req));

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).send('GitHub OAuth is not configured on this server.');
    }

    try {
      const baseUrl = getAppBaseUrl(req);
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${baseUrl}/auth/callback`,
        }),
      });

      const tokenJson: any = await tokenRes.json();
      if (!tokenJson.access_token) {
        throw new Error(tokenJson.error_description || 'Token exchange failed');
      }

      const accessToken = String(tokenJson.access_token);
      const scopes = String(tokenJson.scope || '')
        .split(/[,\s]+/)
        .filter(Boolean);

      const userRes = await githubFetch('https://api.github.com/user', accessToken);
      if (!userRes.ok) {
        throw new Error('Failed to fetch GitHub user profile');
      }
      const ghUser: any = await userRes.json();

      const sessionId = crypto.randomBytes(32).toString('hex');
      sessions.set(sessionId, {
        id: sessionId,
        accessToken,
        scopes,
        user: {
          id: ghUser.id,
          login: ghUser.login,
          name: ghUser.name || ghUser.login,
          avatarUrl: ghUser.avatar_url,
          bio: ghUser.bio || '',
          publicRepos: ghUser.public_repos ?? 0,
          followers: ghUser.followers ?? 0,
          htmlUrl: ghUser.html_url,
        },
        createdAt: Date.now(),
      });

      res.cookie(SESSION_COOKIE, sessionId, {
        ...getCookieOptions(req),
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.send(`
        <html>
          <body style="font-family:system-ui,sans-serif;background:#0B0F17;color:#E2E8F0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>GitHub connected. Closing window...</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      res.status(500).send(`
        <html>
          <body style="font-family:sans-serif;background:#0B0F17;color:#FCA5A5;padding:24px;">
            <h3>GitHub OAuth Error</h3>
            <p>${String(err?.message || 'Unknown error')}</p>
          </body>
        </html>
      `);
    }
  };

  app.get(['/auth/callback', '/auth/callback/'], handleOAuthCallback);

  // --- Current GitHub Auth Session (Never exposes token) ---
  app.get('/api/auth/me', (req, res) => {
    const session = getSessionFromReq(req);
    const oauthConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    const baseUrl = getAppBaseUrl(req);
    if (!session) {
      return res.json({
        authenticated: false,
        oauthConfigured,
        redirectUri: `${baseUrl}/auth/callback`,
      });
    }
    res.json({
      authenticated: true,
      oauthConfigured,
      redirectUri: `${baseUrl}/auth/callback`,
      user: {
        ...session.user,
        grantedScopes: session.scopes,
        isDemo: false,
      },
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const sid = req.cookies?.[SESSION_COOKIE];
    if (sid) sessions.delete(sid);
    res.clearCookie(SESSION_COOKIE, getCookieOptions(req));
    res.json({ ok: true });
  });

  // --- Fetch Real GitHub Contributions via GraphQL (when authenticated) ---
  app.get('/api/github/contributions', async (req, res) => {
    const session = getSessionFromReq(req);
    const year = Math.max(2008, Math.min(2035, Number(req.query.year) || new Date().getFullYear()));
    const targetUser =
      typeof req.query.username === 'string' && req.query.username.trim()
        ? req.query.username.trim()
        : session?.user.login;

    if (!session || !targetUser) {
      return res.json({
        source: 'demo',
        year,
        countsByDate: null,
        totalContributions: 0,
      });
    }

    try {
      const from = `${year}-01-01T00:00:00Z`;
      const to = `${year}-12-31T23:59:59Z`;
      const query = `
        query($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) {
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    date
                    contributionCount
                  }
                }
              }
            }
          }
        }
      `;
      const gqlRes = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          'User-Agent': 'GitPixel-Studio',
        },
        body: JSON.stringify({ query, variables: { login: targetUser, from, to } }),
      });

      if (!gqlRes.ok) {
        throw new Error(`GitHub GraphQL error (${gqlRes.status})`);
      }

      const json: any = await gqlRes.json();
      const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
      if (!cal) {
        return res.json({ source: 'demo', year, countsByDate: null, totalContributions: 0 });
      }

      const countsByDate: Record<string, number> = {};
      for (const week of cal.weeks || []) {
        for (const day of week.contributionDays || []) {
          countsByDate[day.date] = day.contributionCount;
        }
      }

      res.json({
        source: 'github',
        year,
        countsByDate,
        totalContributions: cal.totalContributions ?? 0,
      });
    } catch (err: any) {
      console.error('Contributions fetch error:', err?.message);
      res.status(502).json({
        source: 'demo',
        year,
        countsByDate: null,
        error: err?.message || 'Unable to fetch GitHub contributions',
      });
    }
  });

  // --- List User Repositories ---
  app.get('/api/github/repos', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'GitHub sign-in required' });
    }
    try {
      const ghRes = await githubFetch(
        'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner',
        session.accessToken
      );
      if (!ghRes.ok) {
        throw new Error(`GitHub API returned ${ghRes.status}`);
      }
      const repos: any[] = await ghRes.json();
      const mapped = repos.map((r) => {
        const desc = String(r.description || '').toLowerCase();
        const name = String(r.name || '').toLowerCase();
        const isDedicatedArtRepo =
          name.includes('gitpixel') ||
          name.includes('pixel-art') ||
          name.includes('contribution-art') ||
          desc.includes('gitpixel') ||
          desc.includes('contribution art');
        return {
          id: r.id,
          name: r.name,
          owner: r.owner?.login || session.user.login,
          fullName: r.full_name,
          private: Boolean(r.private),
          htmlUrl: r.html_url,
          defaultBranch: r.default_branch || 'main',
          description: r.description || '',
          updatedAt: r.updated_at,
          isDedicatedArtRepo,
          permissions: r.permissions || { push: true },
        };
      });
      res.json({ repos: mapped });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Failed to load repositories' });
    }
  });

  // --- Verify Repository Access & Detect Unrelated Projects ---
  app.get('/api/github/repos/:owner/:repo/verify', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'GitHub sign-in required' });
    }
    const { owner, repo } = req.params;
    try {
      const repoRes = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`, session.accessToken);
      if (!repoRes.ok) {
        return res.status(repoRes.status).json({
          verified: false,
          hasPushAccess: false,
          hasUnrelatedFiles: false,
          sampleEntries: [],
          defaultBranch: 'main',
          isDedicatedArtRepo: false,
          message: `GitHub returned HTTP ${repoRes.status} for ${owner}/${repo}.`,
        });
      }
      const repoJson: any = await repoRes.json();
      const hasPushAccess = Boolean(repoJson.permissions?.push ?? repoJson.permissions?.admin);

      const contentsRes = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents`,
        session.accessToken
      );
      let entries: string[] = [];
      if (contentsRes.ok) {
        const list: any[] = await contentsRes.json();
        if (Array.isArray(list)) {
          entries = list.map((item) => String(item.name));
        }
      }

      const allowedArtEntries = new Set(['readme.md', 'artworks', '.gitattributes', '.gitignore', 'license']);
      const unrelated = entries.filter((e) => !allowedArtEntries.has(e.toLowerCase()));
      const desc = String(repoJson.description || '').toLowerCase();
      const nameLower = String(repoJson.name || '').toLowerCase();
      const isDedicatedArtRepo =
        unrelated.length === 0 ||
        nameLower.includes('gitpixel') ||
        nameLower.includes('pixel-art') ||
        desc.includes('gitpixel');

      res.json({
        verified: true,
        hasPushAccess,
        hasUnrelatedFiles: unrelated.length > 0,
        sampleEntries: entries.slice(0, 8),
        defaultBranch: repoJson.default_branch || 'main',
        isDedicatedArtRepo,
        message: !hasPushAccess
          ? 'Authenticated user lacks write/push permissions on this repository.'
          : unrelated.length > 0
          ? `Detected ${unrelated.length} existing non-artwork file(s)/folder(s) (${unrelated.slice(0, 3).join(', ')}). A dedicated repository is recommended.`
          : 'Verified write access. Repository is clean and isolated for contribution artwork.',
      });
    } catch (err: any) {
      res.status(502).json({
        verified: false,
        hasPushAccess: false,
        hasUnrelatedFiles: false,
        sampleEntries: [],
        defaultBranch: 'main',
        isDedicatedArtRepo: false,
        message: err?.message || 'Failed to verify repository access.',
      });
    }
  });

  // --- Create Dedicated Artwork Repository with Transparency README ---
  app.post('/api/github/repos', async (req, res) => {
    const session = getSessionFromReq(req);
    if (!session) {
      return res.status(401).json({ error: 'GitHub sign-in required' });
    }
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const repoName = rawName.replace(/[^a-zA-Z0-9._\-]/g, '-').slice(0, 80);
    if (!repoName) {
      return res.status(400).json({ error: 'Valid repository name is required.' });
    }

    try {
      const createRes = await githubFetch('https://api.github.com/user/repos', session.accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repoName,
          description: 'Dedicated GitHub contribution graph pixel artwork repository created with GitPixel Studio.',
          private: false,
          auto_init: true,
        }),
      });
      const created: any = await createRes.json();
      if (!createRes.ok) {
        return res.status(createRes.status).json({
          error: created?.message || 'Failed to create repository. Ensure public_repo scope is authorized.',
        });
      }

      // Update README.md with explicit disclosure
      const readmeContent = Buffer.from(
        `# ${repoName} — Contribution Graph Pixel Art\n\n` +
          `> **Transparency Notice:** This dedicated repository contains generated contribution graph pixel artwork created with **GitPixel Studio**.\n\n` +
          `- All commits in this repository represent visual contribution calendar artwork.\n` +
          `- Historical commit timestamps are artificially dated to map pixels onto specific calendar coordinates.\n` +
          `- These commits are explicitly labeled \`[GitPixel Art]\` and do **not** represent real software engineering activity.\n`
      ).toString('base64');

      // Wait briefly for auto_init main branch
      await new Promise((r) => setTimeout(r, 1200));
      const branch = created.default_branch || 'main';
      const existingReadmeRes = await githubFetch(
        `https://api.github.com/repos/${created.full_name}/contents/README.md`,
        session.accessToken
      );
      let sha: string | undefined;
      if (existingReadmeRes.ok) {
        const existingJson: any = await existingReadmeRes.json();
        sha = existingJson.sha;
      }

      await githubFetch(
        `https://api.github.com/repos/${created.full_name}/contents/README.md`,
        session.accessToken,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: '[GitPixel Art] Add artwork disclosure README',
            content: readmeContent,
            branch,
            ...(sha ? { sha } : {}),
          }),
        }
      );

      res.json({
        repo: {
          id: created.id,
          name: created.name,
          owner: created.owner?.login || session.user.login,
          fullName: created.full_name,
          private: Boolean(created.private),
          htmlUrl: created.html_url,
          defaultBranch: branch,
          description: created.description || '',
          updatedAt: created.updated_at,
          isDedicatedArtRepo: true,
          permissions: { push: true, admin: true, pull: true },
        },
      });
    } catch (err: any) {
      res.status(502).json({ error: err?.message || 'Repository creation failed' });
    }
  });

  // --- Server-backed Artworks & Custom Presets Persistence (for Demo + GitHub sessions) ---
  app.get('/api/artworks', (req, res) => {
    const ownerKey = String(req.query.owner || 'demo');
    const store = ensureStore();
    const list = Object.values(store.artworks)
      .filter((a: any) => a.ownerKey === ownerKey)
      .sort((a: any, b: any) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    res.json({ artworks: list });
  });

  app.post('/api/artworks', (req, res) => {
    const artwork = req.body;
    if (!artwork || !artwork.id || !artwork.title) {
      return res.status(400).json({ error: 'Invalid artwork payload' });
    }
    const store = ensureStore();
    const now = new Date().toISOString();
    const saved = {
      ...artwork,
      ownerKey: String(artwork.ownerKey || 'demo'),
      updatedAt: now,
      createdAt: artwork.createdAt || now,
    };
    store.artworks[saved.id] = saved;
    saveStore(store);
    res.json({ artwork: saved });
  });

  app.delete('/api/artworks/:id', (req, res) => {
    const store = ensureStore();
    delete store.artworks[req.params.id];
    saveStore(store);
    res.json({ ok: true });
  });

  // --- Repository Connections Persistence ---
  app.get('/api/connections', (req, res) => {
    const ownerKey = String(req.query.owner || 'demo');
    const store = ensureStore();
    const connections = Object.values(store.connections)
      .filter((c: any) => c.ownerKey === ownerKey)
      .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ connections });
  });

  app.post('/api/connections', (req, res) => {
    const { ownerKey = 'demo', connection } = req.body || {};
    if (!connection || !connection.id || !connection.repositoryName) {
      return res.status(400).json({ error: 'Valid repository connection payload is required.' });
    }
    const store = ensureStore();
    const record = {
      ...connection,
      ownerKey: String(ownerKey),
      createdAt: connection.createdAt || new Date().toISOString(),
    };
    store.connections[record.id] = record;
    saveStore(store);
    res.json({ connection: record });
  });

  // --- Contribution Schedules & Publishing Operations Persistence ---
  app.get('/api/schedules', (req, res) => {
    const ownerKey = String(req.query.owner || 'demo');
    const store = ensureStore();
    const todayISO = new Date().toISOString().slice(0, 10);
    let mutated = false;
    for (const s of Object.values(store.schedules) as any[]) {
      if (
        (s.status === 'waiting_for_date' || s.status === 'scheduled') &&
        typeof s.selectedDate === 'string' &&
        s.selectedDate <= todayISO
      ) {
        s.status = 'ready_for_review';
        s.updatedAt = new Date().toISOString();
        mutated = true;
      }
    }
    if (mutated) saveStore(store);

    const schedules = Object.values(store.schedules)
      .filter((s: any) => s.ownerKey === ownerKey)
      .sort((a: any, b: any) => String(a.selectedDate).localeCompare(String(b.selectedDate)));
    const operations = Object.values(store.operations)
      .filter((o: any) => o.ownerKey === ownerKey)
      .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ schedules, operations });
  });

  app.post('/api/schedules', (req, res) => {
    const { ownerKey = 'demo', items } = req.body || {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }
    const store = ensureStore();
    const now = new Date().toISOString();
    const todayISO = now.slice(0, 10);
    const savedItems: any[] = [];
    for (const item of items) {
      if (!item?.id || !/^\d{4}-\d{2}-\d{2}$/.test(String(item.selectedDate))) continue;
      const count = Math.max(1, Math.min(20, Number(item.plannedCommitCount) || 1));
      const isFuture = String(item.selectedDate) > todayISO;
      const safeStatus = isFuture
        ? item.status === 'scheduled' || item.status === 'waiting_for_date'
          ? item.status
          : 'waiting_for_date'
        : item.status || 'ready_for_review';
      const record = {
        ...item,
        ownerKey: String(ownerKey),
        plannedCommitCount: count,
        confirmedOperations: item.confirmedOperations ?? 0,
        remainingOperations: item.remainingOperations ?? count,
        status: safeStatus,
        updatedAt: now,
        createdAt: item.createdAt || now,
      };
      store.schedules[record.id] = record;
      savedItems.push(record);
    }
    saveStore(store);
    res.json({ schedules: savedItems });
  });

  app.post('/api/schedules/:id/cancel', (req, res) => {
    const store = ensureStore();
    const sched = store.schedules[req.params.id];
    if (!sched) return res.status(404).json({ error: 'Schedule not found' });
    sched.status = 'cancelled';
    sched.updatedAt = new Date().toISOString();
    saveStore(store);
    res.json({ schedule: sched });
  });

  app.post('/api/schedules/:id/publish-now', async (req, res) => {
    const store = ensureStore();
    const sched = store.schedules[req.params.id];
    if (!sched) return res.status(404).json({ error: 'Schedule not found' });
    const todayISO = new Date().toISOString().slice(0, 10);
    if (String(sched.selectedDate) > todayISO) {
      return res.status(400).json({
        error: `Date ${sched.selectedDate} is in the future. Future dates cannot be published before they arrive.`,
      });
    }
    if (sched.status === 'published' || sched.status === 'publishing') {
      return res.status(400).json({ error: `Schedule is already ${sched.status}.` });
    }

    const session = getSessionFromReq(req);
    const isDryRun = Boolean(req.body?.dryRun || !session || sched.isDryRun);
    const commitCount = Math.max(1, Math.min(20, Number(sched.plannedCommitCount) || 1));
    const now = new Date().toISOString();

    sched.status = 'publishing';
    sched.updatedAt = now;
    saveStore(store);

    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const job = {
      id: jobId,
      artworkId: sched.artworkId || 'scheduled',
      artworkTitle: `Scheduled Pixel (${sched.selectedDate})`,
      repositoryName: sched.repositoryName,
      branch: String(req.body?.branch || 'main'),
      totalItems: 1,
      completedItems: 0,
      totalCommitsPlanned: commitCount,
      completedCommits: 0,
      currentOperation: isDryRun
        ? `Simulating scheduled date ${sched.selectedDate}...`
        : `Publishing ${commitCount} commit(s) for ${sched.selectedDate}...`,
      status: 'running',
      logs: [
        {
          timestamp: now,
          message: `Triggered scheduled artwork publication for ${sched.selectedDate} (${commitCount} commits) on ${sched.repositoryName}.`,
          type: 'info',
        },
      ],
      repoUrl: (session ? `https://github.com/${sched.repositoryName}` : undefined) as string | undefined,
      lastError: undefined as string | undefined,
      isDryRun,
      createdAt: now,
      updatedAt: now,
    };

    store.jobs[jobId] = job;
    saveStore(store);

    (async () => {
      try {
        let resultUrl = '';
        if (isDryRun) {
          await new Promise((r) => setTimeout(r, 150));
        } else {
          const token = session!.accessToken;
          const repoFull = sched.repositoryName;
          const repoMetaRes = await githubFetch(`https://api.github.com/repos/${repoFull}`, token);
          if (!repoMetaRes.ok) throw new Error(`Repository "${repoFull}" inaccessible.`);
          const repoMeta: any = await repoMetaRes.json();
          const targetBranch = repoMeta.default_branch || 'main';
          const refRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/ref/heads/${targetBranch}`, token);
          if (!refRes.ok) throw new Error(`Branch "${targetBranch}" not found.`);
          const refData: any = await refRes.json();
          let currentCommitSha = refData.object.sha;
          const baseCommitRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/commits/${currentCommitSha}`, token);
          if (!baseCommitRes.ok) throw new Error('Failed to fetch base commit.');
          const baseCommitJson: any = await baseCommitRes.json();
          let currentTreeSha = baseCommitJson.tree.sha;

          for (let c = 1; c <= commitCount; c++) {
            const timestamp = `${sched.selectedDate}T12:${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}Z`;
            const blobRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/blobs`, token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `GitPixel Studio Scheduled Artwork\nDate: ${sched.selectedDate}\nCommit: ${c}/${commitCount}\n`,
                encoding: 'utf-8',
              }),
            });
            if (!blobRes.ok) throw new Error(`Blob failed (${blobRes.status})`);
            const blobJson: any = await blobRes.json();
            const treeRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/trees`, token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                base_tree: currentTreeSha,
                tree: [{ path: `artworks/${sched.selectedDate}.txt`, mode: '100644', type: 'blob', sha: blobJson.sha }],
              }),
            });
            if (!treeRes.ok) throw new Error(`Tree failed (${treeRes.status})`);
            const treeJson: any = await treeRes.json();
            currentTreeSha = treeJson.sha;

            const commitRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/commits`, token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `[GitPixel Art] Scheduled artwork pixel ${sched.selectedDate} (${c}/${commitCount})`,
                tree: currentTreeSha,
                parents: [currentCommitSha],
                author: {
                  name: session!.user.name || session!.user.login,
                  email: `${session!.user.id}+${session!.user.login}@users.noreply.github.com`,
                  date: timestamp,
                },
                committer: {
                  name: session!.user.name || session!.user.login,
                  email: `${session!.user.id}+${session!.user.login}@users.noreply.github.com`,
                  date: timestamp,
                },
              }),
            });
            if (!commitRes.ok) throw new Error(`Commit failed (${commitRes.status})`);
            const commitJson: any = await commitRes.json();
            currentCommitSha = commitJson.sha;
            resultUrl = `https://github.com/${repoFull}/commit/${currentCommitSha}`;
            await new Promise((r) => setTimeout(r, 120));
          }

          const patchRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/refs/heads/${targetBranch}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sha: currentCommitSha, force: false }),
          });
          if (!patchRes.ok) throw new Error('Failed to update branch ref');
        }

        const s = ensureStore();
        const doneAt = new Date().toISOString();
        if (s.schedules[sched.id]) {
          s.schedules[sched.id] = {
            ...s.schedules[sched.id],
            status: 'published',
            confirmedOperations: commitCount,
            remainingOperations: 0,
            githubResultUrl: resultUrl,
            updatedAt: doneAt,
          };
        }
        const oid = `op_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        s.operations[oid] = {
          id: oid,
          ownerKey: sched.ownerKey,
          scheduleId: sched.id,
          operationType: isDryRun ? `dry_run_commit_batch (${commitCount})` : `git_commit_batch (${commitCount})`,
          status: 'confirmed',
          githubResultUrl: resultUrl,
          createdAt: doneAt,
        };
        if (s.jobs[jobId]) {
          s.jobs[jobId] = {
            ...s.jobs[jobId],
            completedItems: 1,
            completedCommits: commitCount,
            status: 'completed',
            currentOperation: isDryRun ? 'Dry-run schedule complete' : 'Published scheduled date on GitHub',
            updatedAt: doneAt,
          };
        }
        saveStore(s);
      } catch (err: any) {
        const s = ensureStore();
        const failAt = new Date().toISOString();
        if (s.schedules[sched.id]) {
          s.schedules[sched.id] = {
            ...s.schedules[sched.id],
            status: 'failed',
            lastError: err?.message || 'Publish failed',
            updatedAt: failAt,
          };
        }
        if (s.jobs[jobId]) {
          s.jobs[jobId] = {
            ...s.jobs[jobId],
            status: 'failed',
            lastError: err?.message || 'Publish failed',
            updatedAt: failAt,
          };
        }
        saveStore(s);
      }
    })();

    res.json({ job, schedule: sched });
  });

  app.delete('/api/schedules/:id', (req, res) => {
    const store = ensureStore();
    delete store.schedules[req.params.id];
    saveStore(store);
    res.json({ ok: true });
  });

  // --- GitHub Publishing Engine ---
  app.post('/api/github/publish/start', async (req, res) => {
    const {
      artworkId,
      artworkTitle,
      repositoryId = 'repo_default',
      repositoryName,
      branch = 'main',
      cells,
      dateCommits,
      commitsPerLevel,
      confirmedDisclosure,
      dryRun = false,
      scheduleMode = 'publish_ready_and_schedule_future',
    } = req.body || {};

    if (!confirmedDisclosure) {
      return res.status(400).json({ error: 'Explicit disclosure confirmation is required before publishing.' });
    }
    if (!repositoryName || (!cells && !dateCommits)) {
      return res.status(400).json({ error: 'Repository name and artwork dates/cells are required.' });
    }

    const session = getSessionFromReq(req);
    const ownerKey = session ? `gh_${session.user.login}` : 'demo';
    const isDryRun = Boolean(dryRun || !session);
    const todayISO = new Date().toISOString().slice(0, 10);
    const commitsMap = commitsPerLevel || { 1: 1, 2: 3, 3: 6, 4: 10 };

    // Build unified date -> commitCount map (explicit dateCommits overrides level mapping)
    const dateCountMap = new Map<string, { count: number; level: number }>();
    if (cells && typeof cells === 'object') {
      for (const [date, lvl] of Object.entries(cells)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && [1, 2, 3, 4].includes(Number(lvl))) {
          const count = Math.max(1, Math.min(20, Number(commitsMap[Number(lvl)]) || 1));
          dateCountMap.set(date, { count, level: Number(lvl) });
        }
      }
    }
    if (dateCommits && typeof dateCommits === 'object') {
      for (const [date, rawCount] of Object.entries(dateCommits)) {
        const count = Math.max(0, Math.min(20, Number(rawCount) || 0));
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && count > 0) {
          const level = count >= 8 ? 4 : count >= 5 ? 3 : count >= 2 ? 2 : 1;
          dateCountMap.set(date, { count, level });
        }
      }
    }

    const allEntries = Array.from(dateCountMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (allEntries.length === 0) {
      return res.status(400).json({ error: 'No painted pixels or scheduled dates to process.' });
    }

    // Separate future dates from immediate eligible dates (<= todayISO)
    const immediateEntries =
      scheduleMode === 'schedule_only'
        ? []
        : allEntries.filter(([date]) => date <= todayISO);
    const futureEntries =
      scheduleMode === 'schedule_only'
        ? allEntries
        : allEntries.filter(([date]) => date > todayISO);

    const immediateCommitsTotal = immediateEntries.reduce((s, [, v]) => s + v.count, 0);
    if (immediateCommitsTotal > 250) {
      return res.status(400).json({
        error: `Batch limit exceeded (${immediateCommitsTotal} commits). Limit immediate publishing runs to 250 commits to respect GitHub API rate limits.`,
      });
    }

    const store = ensureStore();
    const now = new Date().toISOString();
    const scheduleIdsByDate = new Map<string, string>();

    // Record ContributionSchedules for future dates (waiting_for_date) and immediate dates (publishing / ready_for_review)
    for (const [date, meta] of futureEntries) {
      const sid = `sched_${date.replace(/-/g, '')}_${crypto.randomBytes(3).toString('hex')}`;
      store.schedules[sid] = {
        id: sid,
        ownerKey,
        repositoryId: String(repositoryId),
        repositoryName: String(repositoryName),
        artworkId: String(artworkId || 'unsaved'),
        selectedDate: date,
        plannedCommitCount: meta.count,
        status: date > todayISO ? 'waiting_for_date' : 'ready_for_review',
        confirmedOperations: 0,
        remainingOperations: meta.count,
        isDryRun,
        createdAt: now,
        updatedAt: now,
      };
      scheduleIdsByDate.set(date, sid);
    }

    for (const [date, meta] of immediateEntries) {
      const sid = `sched_${date.replace(/-/g, '')}_${crypto.randomBytes(3).toString('hex')}`;
      store.schedules[sid] = {
        id: sid,
        ownerKey,
        repositoryId: String(repositoryId),
        repositoryName: String(repositoryName),
        artworkId: String(artworkId || 'unsaved'),
        selectedDate: date,
        plannedCommitCount: meta.count,
        status: 'publishing',
        confirmedOperations: 0,
        remainingOperations: meta.count,
        isDryRun,
        createdAt: now,
        updatedAt: now,
      };
      scheduleIdsByDate.set(date, sid);
    }

    const totalCommitsPlanned = immediateCommitsTotal;
    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const job = {
      id: jobId,
      artworkId: artworkId || 'unsaved',
      artworkTitle: String(artworkTitle || 'Contribution Artwork').slice(0, 120),
      repositoryName: String(repositoryName),
      branch: String(branch),
      totalItems: immediateEntries.length,
      completedItems: 0,
      totalCommitsPlanned,
      completedCommits: 0,
      currentOperation:
        immediateEntries.length === 0
          ? `Saved ${futureEntries.length} future date schedule(s) waiting for arrival date`
          : isDryRun
          ? 'Initializing dry-run simulation...'
          : 'Verifying target repository...',
      status: immediateEntries.length === 0 ? 'completed' : 'running',
      logs: [
        {
          timestamp: now,
          message:
            immediateEntries.length === 0
              ? `Scheduled ${futureEntries.length} future date(s) for ${repositoryName}. Future commits will remain waiting until each date arrives.`
              : isDryRun
              ? `Started Demo Dry-Run for "${artworkTitle}" (${immediateEntries.length} eligible days, ${futureEntries.length} future scheduled).`
              : `Started publishing "${artworkTitle}" to ${repositoryName} (${immediateEntries.length} eligible days, ${totalCommitsPlanned} commits; ${futureEntries.length} future dates scheduled).`,
          type: 'info',
        },
      ],
      repoUrl: (session ? `https://github.com/${repositoryName}` : undefined) as string | undefined,
      lastError: undefined as string | undefined,
      isDryRun,
      createdAt: now,
      updatedAt: now,
    };

    store.jobs[jobId] = job;
    saveStore(store);

    if (immediateEntries.length === 0) {
      return res.json({ job });
    }

    const controller = { cancelled: false };
    activePublishControllers.set(jobId, controller);

    // Run async background publishing loop for immediate eligible entries only
    const plannedEntries = immediateEntries;
    (async () => {
      const updateJob = (patch: Partial<typeof job>, log?: { message: string; type: 'info' | 'success' | 'warning' | 'error' }) => {
        const s = ensureStore();
        const cur = s.jobs[jobId];
        if (!cur) return;
        const nextLogs = log ? [...cur.logs.slice(-49), { timestamp: new Date().toISOString(), ...log }] : cur.logs;
        s.jobs[jobId] = { ...cur, ...patch, logs: nextLogs, updatedAt: new Date().toISOString() };
        saveStore(s);
      };

      const recordScheduleProgress = (
        date: string,
        patch: { status?: string; confirmedOperations?: number; remainingOperations?: number; githubResultUrl?: string; lastError?: string },
        op?: { operationType: string; status: string; githubResultUrl: string }
      ) => {
        const sid = scheduleIdsByDate.get(date);
        if (!sid) return;
        const s = ensureStore();
        if (s.schedules[sid]) {
          s.schedules[sid] = { ...s.schedules[sid], ...patch, updatedAt: new Date().toISOString() };
        }
        if (op) {
          const oid = `op_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
          s.operations[oid] = {
            id: oid,
            ownerKey,
            scheduleId: sid,
            operationType: op.operationType,
            status: op.status,
            githubResultUrl: op.githubResultUrl,
            createdAt: new Date().toISOString(),
          };
        }
        saveStore(s);
      };

      try {
        if (isDryRun) {
          for (let i = 0; i < plannedEntries.length; i++) {
            const [date, meta] = plannedEntries[i];
            if (controller.cancelled) {
              recordScheduleProgress(date, { status: 'cancelled' });
              updateJob(
                { status: 'cancelled', currentOperation: 'Cancelled by user' },
                { message: 'Dry-run cancelled by user.', type: 'warning' }
              );
              return;
            }
            const commitCount = meta.count;
            updateJob({
              currentOperation: `Simulating ${date} (Level ${meta.level} · ${commitCount} commits)`,
            });
            await new Promise((r) => setTimeout(r, 85));
            const prevJob = ensureStore().jobs[jobId];
            recordScheduleProgress(
              date,
              {
                status: 'published',
                confirmedOperations: commitCount,
                remainingOperations: 0,
              },
              {
                operationType: `dry_run_commit_batch (${commitCount})`,
                status: 'confirmed',
                githubResultUrl: '',
              }
            );
            updateJob(
              {
                completedItems: i + 1,
                completedCommits: (prevJob?.completedCommits || 0) + commitCount,
              },
              i % 5 === 0 || i === plannedEntries.length - 1
                ? {
                    message: `[Dry Run] Planned ${commitCount} labeled commit(s) for ${date} (Level ${meta.level}).`,
                    type: 'success',
                  }
                : undefined
            );
          }
          updateJob(
            { status: 'completed', currentOperation: 'Dry-run simulation complete' },
            { message: 'Simulation completed. No real GitHub commits were created.', type: 'success' }
          );
          return;
        }

        // --- Real GitHub Git Data API Publishing ---
        const token = session!.accessToken;
        const repoFull = repositoryName;

        let targetBranch = branch;
        let refRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/ref/heads/${targetBranch}`, token);
        if (!refRes.ok) {
          const repoMetaRes = await githubFetch(`https://api.github.com/repos/${repoFull}`, token);
          if (!repoMetaRes.ok) {
            throw new Error(`Repository "${repoFull}" not found or inaccessible.`);
          }
          const repoMeta: any = await repoMetaRes.json();
          targetBranch = repoMeta.default_branch || 'main';
          refRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/ref/heads/${targetBranch}`, token);
          if (!refRes.ok) {
            throw new Error(`Could not resolve branch "${targetBranch}". Initialize repository with a README first.`);
          }
        }

        const refData: any = await refRes.json();
        let currentCommitSha = refData.object.sha;

        const baseCommitRes = await githubFetch(
          `https://api.github.com/repos/${repoFull}/git/commits/${currentCommitSha}`,
          token
        );
        if (!baseCommitRes.ok) throw new Error('Failed to fetch base commit');
        const baseCommitJson: any = await baseCommitRes.json();
        let currentTreeSha = baseCommitJson.tree.sha;

        updateJob(
          { currentOperation: 'Updating artwork disclosure manifest...' },
          { message: `Connected to ${repoFull} (${targetBranch}). Preparing labeled commits.`, type: 'info' }
        );

        let commitsDone = 0;
        for (let i = 0; i < plannedEntries.length; i++) {
          const [date, meta] = plannedEntries[i];
          if (controller.cancelled) {
            await githubFetch(`https://api.github.com/repos/${repoFull}/git/refs/heads/${targetBranch}`, token, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sha: currentCommitSha, force: false }),
            });
            recordScheduleProgress(date, { status: 'cancelled' });
            updateJob(
              { status: 'cancelled', currentOperation: 'Publishing cancelled by user' },
              { message: `Stopped safely after ${i} days (${commitsDone} commits).`, type: 'warning' }
            );
            return;
          }

          const commitCount = meta.count;
          updateJob({ currentOperation: `Creating commits for ${date} (Level ${meta.level})...` });
          let lastDateCommitUrl = '';

          for (let c = 1; c <= commitCount; c++) {
            if (controller.cancelled) break;

            const timestamp = `${date}T12:${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}Z`;
            const blobRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/blobs`, token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content: `GitPixel Studio Contribution Artwork\nArtwork: ${artworkTitle}\nDate: ${date}\nIntensity Level: ${meta.level}\nCommit: ${c}/${commitCount}\nNote: Artificially dated visual artwork commit.\n`,
                encoding: 'utf-8',
              }),
            });

            if (blobRes.status === 403 || blobRes.status === 429) {
              const retryAfter = Number(blobRes.headers.get('retry-after') || '5');
              updateJob({}, { message: `Rate limit reached; pausing ${retryAfter}s...`, type: 'warning' });
              await new Promise((r) => setTimeout(r, retryAfter * 1000));
              c--;
              continue;
            }
            if (!blobRes.ok) {
              const errJson: any = await blobRes.json().catch(() => ({}));
              throw new Error(errJson.message || `Blob creation failed (${blobRes.status})`);
            }
            const blobJson: any = await blobRes.json();

            const treeRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/trees`, token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                base_tree: currentTreeSha,
                tree: [
                  {
                    path: `artworks/${date}.txt`,
                    mode: '100644',
                    type: 'blob',
                    sha: blobJson.sha,
                  },
                ],
              }),
            });
            if (!treeRes.ok) throw new Error(`Tree creation failed (${treeRes.status})`);
            const treeJson: any = await treeRes.json();
            currentTreeSha = treeJson.sha;

            const commitRes = await githubFetch(`https://api.github.com/repos/${repoFull}/git/commits`, token, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `[GitPixel Art] Contribution artwork pixel ${date} (Level ${meta.level}, ${c}/${commitCount})`,
                tree: currentTreeSha,
                parents: [currentCommitSha],
                author: {
                  name: session!.user.name || session!.user.login,
                  email: `${session!.user.id}+${session!.user.login}@users.noreply.github.com`,
                  date: timestamp,
                },
                committer: {
                  name: session!.user.name || session!.user.login,
                  email: `${session!.user.id}+${session!.user.login}@users.noreply.github.com`,
                  date: timestamp,
                },
              }),
            });
            if (!commitRes.ok) {
              const errJson: any = await commitRes.json().catch(() => ({}));
              throw new Error(errJson.message || `Commit creation failed (${commitRes.status})`);
            }
            const commitJson: any = await commitRes.json();
            currentCommitSha = commitJson.sha;
            lastDateCommitUrl = `https://github.com/${repoFull}/commit/${currentCommitSha}`;
            commitsDone++;

            await new Promise((r) => setTimeout(r, 120));
          }

          recordScheduleProgress(
            date,
            {
              status: 'published',
              confirmedOperations: commitCount,
              remainingOperations: 0,
              githubResultUrl: lastDateCommitUrl,
            },
            {
              operationType: `git_commit_batch (${commitCount})`,
              status: 'confirmed',
              githubResultUrl: lastDateCommitUrl,
            }
          );

          updateJob(
            { completedItems: i + 1, completedCommits: commitsDone },
            i % 4 === 0 || i === plannedEntries.length - 1
              ? { message: `Committed ${date} (${commitCount} commits, Level ${meta.level}).`, type: 'success' }
              : undefined
          );
        }

        updateJob({ currentOperation: `Updating branch ${targetBranch} reference...` });
        const patchRes = await githubFetch(
          `https://api.github.com/repos/${repoFull}/git/refs/heads/${targetBranch}`,
          token,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sha: currentCommitSha, force: false }),
          }
        );
        if (!patchRes.ok) {
          const errJson: any = await patchRes.json().catch(() => ({}));
          throw new Error(errJson.message || `Failed to update branch ref (${patchRes.status})`);
        }

        updateJob(
          {
            status: 'completed',
            currentOperation: 'Published and verified on GitHub',
            repoUrl: `https://github.com/${repoFull}`,
          },
          {
            message: `Successfully published ${commitsDone} labeled commits across ${plannedEntries.length} dates to ${repoFull}.`,
            type: 'success',
          }
        );
      } catch (err: any) {
        updateJob(
          {
            status: 'failed',
            currentOperation: 'Publishing halted due to error',
            lastError: err?.message || 'Unknown GitHub API error',
          },
          { message: `Error: ${err?.message || 'Publishing failed'}`, type: 'error' }
        );
      } finally {
        activePublishControllers.delete(jobId);
      }
    })();

    res.json({ job });
  });

  app.get('/api/github/publish/:jobId', (req, res) => {
    const store = ensureStore();
    const job = store.jobs[req.params.jobId];
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job });
  });

  app.get('/api/github/publish', (_req, res) => {
    const store = ensureStore();
    const jobs = Object.values(store.jobs).sort((a: any, b: any) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );
    res.json({ jobs: jobs.slice(0, 20) });
  });

  app.post('/api/github/publish/:jobId/cancel', (req, res) => {
    const ctrl = activePublishControllers.get(req.params.jobId);
    if (ctrl) {
      ctrl.cancelled = true;
    }
    const store = ensureStore();
    const job = store.jobs[req.params.jobId];
    if (job && job.status === 'running') {
      job.currentOperation = 'Stopping safely...';
      saveStore(store);
    }
    res.json({ ok: true });
  });

  // --- Vite / Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GitPixel Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
