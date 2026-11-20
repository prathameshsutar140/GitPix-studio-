import React, { useRef, useState } from 'react';
import { Copy, Download, Edit3, FolderPlus, Search, Trash2, Upload } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type { ArtworkProject } from '../types/studio';
import { exportProjectJson } from '../utils/exportArtwork';

export function ArtworksPage() {
  const {
    savedArtworks,
    loadingArtworks,
    loadArtworkIntoEditor,
    renameArtwork,
    duplicateArtwork,
    deleteArtwork,
    importArtworkJson,
    saveCurrentArtwork,
    navigate,
    notify,
  } = useStudio();

  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ArtworkProject | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = savedArtworks.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.presetName.toLowerCase().includes(search.toLowerCase());
    const matchesYear = yearFilter === 'all' || String(a.selectedYear) === yearFilter;
    return matchesSearch && matchesYear;
  });

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importArtworkJson(text);
    } catch (err: any) {
      notify(err?.message || 'Could not parse imported artwork JSON.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-50">My Artworks</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Save, rename, duplicate, export, and import contribution pixel-art projects.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#111827] text-slate-200 text-xs font-medium transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import JSON
          </button>
          <button
            onClick={() => saveCurrentArtwork(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Save Current Canvas
          </button>
        </div>
      </div>

      {/* Search & Year Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search saved artworks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          aria-label="Filter by year"
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[#111827] border border-slate-800 text-sm font-mono text-slate-200"
        >
          <option value="all">All Years</option>
          {[2027, 2026, 2025, 2024, 2023, 2022].map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Artworks List / Grid */}
      {loadingArtworks ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-[#111827] border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-12 text-center space-y-4">
          <h2 className="text-base font-semibold text-slate-200">No artworks found</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Save your current contribution canvas or import an existing `.gitpixel.json` project file.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('editor')}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              Open Editor
            </button>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((art) => {
            const pixelCount = Object.keys(art.cells || {}).length;
            const isRenaming = renamingId === art.id;
            return (
              <div
                key={art.id}
                className="bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  {isRenaming ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="flex-1 bg-[#0B0F17] border border-emerald-500 rounded px-2.5 py-1 text-sm text-slate-100"
                        autoFocus
                      />
                      <button
                        onClick={async () => {
                          await renameArtwork(art.id, renameValue);
                          setRenamingId(null);
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-medium"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-slate-100 truncate">{art.title}</h3>
                      <button
                        onClick={() => {
                          setRenamingId(art.id);
                          setRenameValue(art.title);
                        }}
                        title="Rename artwork"
                        className="p-1 text-slate-400 hover:text-slate-100 shrink-0"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                    <span>{art.selectedYear}</span>
                    <span aria-hidden="true">·</span>
                    <span>{pixelCount} pixels</span>
                    <span aria-hidden="true">·</span>
                    <span>@{art.githubUsername}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Updated {new Date(art.updatedAt).toLocaleDateString()} · {art.presetName}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => loadArtworkIntoEditor(art, 'editor')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    Load in Editor
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => duplicateArtwork(art.id)}
                      title="Duplicate artwork"
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => exportProjectJson(art)}
                      title="Export JSON"
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(art)}
                      title="Delete artwork"
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-100">Delete Artwork?</h3>
            <p className="text-sm text-slate-400">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteArtwork(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
