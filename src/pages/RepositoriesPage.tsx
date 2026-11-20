import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FolderGit2,
  GitBranch,
  Github,
  Grid3X3,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { GitHubRepo } from '../types/studio';

type VisibilityFilter = 'all' | 'public' | 'private' | 'dedicated';
type SortField = 'updated' | 'name';

export function RepositoriesPage() {
  const {
    githubUser,
    isDemoMode,
    connectGitHub,
    repos,
    loadingRepos,
    loadRepos,
    createDedicatedRepo,
    selectedRepo,
    repoVerification,
    verifyingRepo,
    selectRepository,
    selectedYear,
    navigate,
    notify,
  } = useStudio();

  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('updated');
  const [newRepoName, setNewRepoName] = useState(`gitpixel-art-${selectedYear}`);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  useEffect(() => {
    if (!selectedRepo && repos.length > 0) {
      const preferred = repos.find((r) => r.isDedicatedArtRepo) || repos[0];
      selectRepository(preferred);
    }
  }, [repos, selectedRepo, selectRepository]);

  const filteredRepos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return repos
      .filter((r) => {
        if (visibilityFilter === 'public' && r.private) return false;
        if (visibilityFilter === 'private' && !r.private) return false;
        if (visibilityFilter === 'dedicated' && !r.isDedicatedArtRepo) return false;
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.owner.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        return String(b.updatedAt).localeCompare(String(a.updatedAt));
      });
  }, [repos, searchQuery, sortBy, visibilityFilter]);

  const handleSelectRepo = async (repo: GitHubRepo) => {
    await selectRepository(repo);
  };

  const handleCreateDedicated = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim()) return;
    setCreating(true);
    try {
      await createDedicatedRepo(newRepoName.trim());
    } catch (err: any) {
      notify(err?.message || 'Unable to create dedicated artwork repository.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const hasPublishScope = Boolean(
    githubUser && !isDemoMode && githubUser.grantedScopes.includes('public_repo')
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Authenticated Profile Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-50">
            Repository Selection
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Verify write access and isolate contribution artwork to a dedicated repository before scheduling dates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {githubUser ? (
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-800 text-xs">
              <img
                src={githubUser.avatarUrl}
                alt={githubUser.login}
                referrerPolicy="no-referrer"
                className="w-6 h-6 rounded-full object-cover border border-slate-700"
              />
              <span className="font-mono text-slate-200">@{githubUser.login}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-400">
                {isDemoMode ? 'Demo Workspace' : 'Authenticated'}
              </span>
            </div>
          ) : (
            <button
              onClick={() => connectGitHub('publish')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              <Github className="w-4 h-4" />
              Continue with GitHub
            </button>
          )}

          <button
            onClick={() => loadRepos()}
            disabled={loadingRepos}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-800 hover:border-slate-700 bg-[#111827] text-xs font-medium text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRepos ? 'animate-spin' : ''}`} />
            Refresh List
          </button>
        </div>
      </div>

      {/* Scope Advisory for Read-only GitHub OAuth Users */}
      {githubUser && !isDemoMode && !hasPublishScope && (
        <div className="bg-indigo-950/35 border border-indigo-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-indigo-200">
              Read-only GitHub scope active (`read:user`)
            </div>
            <p className="text-slate-400">
              You can inspect repositories now. Authorize `public_repo` when ready to create or push to a dedicated artwork repository.
            </p>
          </div>
          <button
            onClick={() => connectGitHub('publish')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0"
          >
            <Github className="w-3.5 h-3.5" />
            Authorize Repository Access
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Search, Filter, Sort & Repository List */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls Bar */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repositories by name, owner, or description..."
                  className="w-full bg-[#0B0F17] border border-slate-800 focus:border-emerald-500 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none"
                />
              </div>

              <select
                aria-label="Sort repositories"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="bg-[#0B0F17] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="updated">Sort: Recently Updated</option>
                <option value="name">Sort: Name (A–Z)</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {(
                [
                  { id: 'all', label: 'All Repositories' },
                  { id: 'public', label: 'Public' },
                  { id: 'private', label: 'Private' },
                  { id: 'dedicated', label: 'Dedicated Artwork' },
                ] as { id: VisibilityFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setVisibilityFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    visibilityFilter === tab.id
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <span className="ml-auto text-xs font-mono tabular-nums text-slate-500">
                {filteredRepos.length} shown
              </span>
            </div>
          </div>

          {/* Repository Cards List */}
          <div className="space-y-3">
            {loadingRepos ? (
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-10 flex items-center justify-center gap-2.5 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                Loading accessible GitHub repositories...
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-8 text-center space-y-2">
                <div className="text-sm font-medium text-slate-200">No matching repositories</div>
                <p className="text-xs text-slate-400">
                  Adjust your filter or create a new dedicated artwork repository on the right.
                </p>
              </div>
            ) : (
              filteredRepos.map((repo) => {
                const isSelected = selectedRepo?.fullName === repo.fullName;
                return (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => handleSelectRepo(repo)}
                    className={`w-full text-left rounded-xl p-4 border transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/8 border-emerald-500/50'
                        : 'bg-[#111827] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderGit2
                          className={`w-4 h-4 shrink-0 ${
                            repo.isDedicatedArtRepo ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        />
                        <span className="font-mono text-sm font-semibold text-slate-100 truncate">
                          {repo.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400 shrink-0">
                        {repo.private ? (
                          <span className="inline-flex items-center gap-1 text-amber-300">
                            <Lock className="w-3 h-3" />
                            Private
                          </span>
                        ) : (
                          <span className="text-slate-300">Public</span>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {repo.defaultBranch}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 text-xs text-slate-400 line-clamp-2">
                      {repo.description || 'No description provided.'}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500">
                      <span>
                        Owner: <span className="text-slate-300">@{repo.owner}</span>
                        {repo.isDedicatedArtRepo && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span className="text-emerald-400">Dedicated Artwork Repo</span>
                          </>
                        )}
                      </span>
                      <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Repository Verification & Create Dedicated Repo */}
        <div className="lg:col-span-5 space-y-5">
          {/* Verification & Selected Repo Details */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-100">Selected Repository Details</h2>
              {verifyingRepo && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
            </div>

            {selectedRepo ? (
              <div className="space-y-4">
                <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Repository</span>
                    <span className="font-mono font-semibold text-slate-100 truncate">
                      {selectedRepo.fullName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Owner</span>
                    <span className="font-mono text-slate-200">@{selectedRepo.owner}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Visibility</span>
                    <span className="font-mono text-slate-200">
                      {selectedRepo.private ? 'Private' : 'Public'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Default Branch</span>
                    <span className="font-mono text-emerald-400">
                      {repoVerification?.defaultBranch || selectedRepo.defaultBranch}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Last Updated</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      {new Date(selectedRepo.updatedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Permission & Safety Verification */}
                {repoVerification && (
                  <div className="space-y-3">
                    <div
                      className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                        !repoVerification.hasPushAccess
                          ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                          : repoVerification.hasUnrelatedFiles
                          ? 'bg-amber-950/35 border-amber-500/35 text-amber-200'
                          : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                      }`}
                    >
                      {repoVerification.hasUnrelatedFiles || !repoVerification.hasPushAccess ? (
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1.5">
                        <div className="font-semibold">
                          {!repoVerification.hasPushAccess
                            ? 'Write Access Not Verified'
                            : repoVerification.hasUnrelatedFiles
                            ? 'Existing Project Files Detected'
                            : 'Isolated Artwork Repository Verified'}
                        </div>
                        <p className="opacity-90 leading-relaxed">{repoVerification.message}</p>
                        {repoVerification.sampleEntries.length > 0 && (
                          <div className="font-mono text-[11px] opacity-80 pt-0.5">
                            Root entries: {repoVerification.sampleEntries.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <button
                    onClick={() => navigate('scheduler')}
                    disabled={verifyingRepo || (repoVerification ? !repoVerification.hasPushAccess : false)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                  >
                    <CalendarDays className="w-4 h-4" />
                    Continue to Date Scheduler
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => navigate('editor')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#0B0F17] text-slate-200 text-xs font-medium transition-colors"
                  >
                    <Grid3X3 className="w-4 h-4" />
                    Graph Editor
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Select a repository from the list to inspect permissions and branch details.
              </p>
            )}
          </div>

          {/* Create Dedicated Artwork Repo */}
          <form
            onSubmit={handleCreateDedicated}
            className="bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-slate-100">
                Create Dedicated Artwork Repository
              </h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recommended: keep contribution graph art isolated in its own repository with an explicit transparency README and{' '}
              <code className="text-slate-200">artworks/</code> commit directory.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder={`gitpixel-art-${selectedYear}`}
                className="flex-1 bg-[#0B0F17] border border-slate-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none"
              />
              <button
                type="submit"
                disabled={creating || !newRepoName.trim() || (Boolean(githubUser) && !isDemoMode && !hasPublishScope)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {creating ? 'Creating...' : 'Create & Select'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
