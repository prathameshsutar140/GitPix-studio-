import React, { useState } from 'react';
import {
  LayoutDashboard,
  Grid3X3,
  Sparkles,
  FolderKanban,
  Download,
  GitCommitHorizontal,
  Activity,
  Settings,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  Github,
  Cloud,
  FolderGit2,
  CalendarDays,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { PageRoute } from '../types/studio';

interface NavItem {
  id: PageRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'repositories', label: 'Repositories', icon: FolderGit2 },
  { id: 'scheduler', label: 'Date Scheduler', icon: CalendarDays },
  { id: 'editor', label: 'Graph Editor', icon: Grid3X3 },
  { id: 'presets', label: 'Preset Library', icon: Sparkles },
  { id: 'artworks', label: 'My Artworks', icon: FolderKanban },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'publish-review', label: 'Publish Review', icon: GitCommitHorizontal },
  { id: 'publish-progress', label: 'Status Dashboard', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    route,
    navigate,
    githubUser,
    isDemoMode,
    firebaseUser,
    signInCloudSync,
    disconnectGitHub,
    enterDemoMode,
    toasts,
    selectedYear,
  } = useStudio();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === route);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-60 xl:w-64 shrink-0 flex-col border-r border-slate-800/80 bg-[#0E131E] no-print">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
          <button
            onClick={() => navigate('landing')}
            className="font-display font-bold text-lg tracking-tight text-slate-50 hover:text-emerald-400 transition-colors whitespace-nowrap"
          >
            GitPixel Studio
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Workspace navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = route === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/25'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Account Summary */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          {firebaseUser ? (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 truncate">
                <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Cloud sync active</span>
              </span>
            </div>
          ) : (
            <button
              onClick={signInCloudSync}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-[#111827] hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors"
            >
              <Cloud className="w-3.5 h-3.5 text-indigo-400" />
              Enable Cloud Sync
            </button>
          )}

          {githubUser ? (
            <div className="flex items-center gap-2.5 pt-1">
              <img
                src={githubUser.avatarUrl}
                alt={githubUser.login}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-200 truncate">@{githubUser.login}</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {isDemoMode ? 'Demo Workspace' : 'GitHub Connected'}
                </div>
              </div>
              <button
                onClick={disconnectGitHub}
                title="Sign out"
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('login')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
            >
              <Github className="w-4 h-4" />
              Connect GitHub
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="h-14 lg:h-16 px-4 lg:px-8 border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-300 hover:bg-slate-800/70 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <button
                onClick={() => navigate('landing')}
                className="lg:hidden font-display font-bold text-slate-100 whitespace-nowrap"
              >
                GitPixel Studio
              </button>
              <span className="hidden lg:inline text-slate-500">Workspace</span>
              <span className="hidden lg:inline text-slate-600">/</span>
              <span className="hidden lg:inline font-medium text-slate-100 truncate">
                {currentNav?.label || 'Studio'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline text-xs font-mono tabular-nums text-slate-400">
              Calendar {selectedYear}
            </span>
            {githubUser ? (
              <button
                onClick={() => navigate('dashboard')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-[#111827] hover:border-slate-700 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
              >
                <img
                  src={githubUser.avatarUrl}
                  alt={githubUser.login}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span>@{githubUser.login}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => enterDemoMode('editor')}
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0"
                >
                  Try Demo
                </button>
                <button
                  onClick={() => navigate('login')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <Github className="w-3.5 h-3.5" />
                  Connect GitHub
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-[#0E131E] border-r border-slate-800 flex flex-col h-full z-10">
            <div className="h-14 px-5 flex items-center justify-between border-b border-slate-800">
              <span className="font-display font-bold text-slate-50">GitPixel Studio</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                        : 'text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg border text-xs font-medium shadow-lg backdrop-blur-md transition-all ${
              t.tone === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
                : t.tone === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
                : 'bg-[#111827]/95 border-slate-700 text-slate-200'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
