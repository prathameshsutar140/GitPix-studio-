import React, { useMemo } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import { ContributionCanvas } from '../components/ContributionCanvas';
import { useStudio } from '../context/StudioContext';
import { buildContributionCalendar } from '../utils/calendar';
import { exportCalendarToPng } from '../utils/exportArtwork';

export function SharedPreviewPage() {
  const { sharedPreviewData, loadArtworkIntoEditor, navigate, notify } = useStudio();

  const calendar = useMemo(() => {
    const year = sharedPreviewData?.selectedYear || 2026;
    return buildContributionCalendar(year, undefined, { useDemoFallback: false });
  }, [sharedPreviewData?.selectedYear]);

  if (!sharedPreviewData) {
    return (
      <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111827] border border-slate-800 rounded-xl p-6 text-center space-y-4">
          <h1 className="font-display text-xl font-bold">Shared Artwork Unavailable</h1>
          <p className="text-sm text-slate-400">
            This share link is invalid or could not be decoded.
          </p>
          <button
            onClick={() => navigate('landing')}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold"
          >
            Back to GitPixel Studio
          </button>
        </div>
      </div>
    );
  }

  const handleOpenInEditor = () => {
    const now = new Date().toISOString();
    loadArtworkIntoEditor(
      {
        id: `art_${Date.now()}`,
        title: `${sharedPreviewData.title} (Remix)`,
        selectedYear: sharedPreviewData.selectedYear,
        githubUsername: sharedPreviewData.githubUsername,
        cells: sharedPreviewData.cells,
        presetName: 'Shared Remix',
        notes: '',
        createdAt: now,
        updatedAt: now,
      },
      'editor'
    );
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <button
              onClick={() => navigate('landing')}
              className="text-xs font-medium text-emerald-400 hover:underline mb-1 block"
            >
              GitPixel Studio · Read-Only Share
            </button>
            <h1 className="font-display text-2xl font-bold text-slate-50">
              {sharedPreviewData.title}
            </h1>
            <div className="text-xs font-mono text-slate-400 mt-1">
              @{sharedPreviewData.githubUsername} · {sharedPreviewData.selectedYear} ·{' '}
              {Object.keys(sharedPreviewData.cells).length} pixels
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={async () => {
                await exportCalendarToPng(calendar, sharedPreviewData.cells, {
                  title: sharedPreviewData.title,
                  username: sharedPreviewData.githubUsername,
                  theme: 'github-dark',
                  previewMode: 'artwork',
                  showHeader: true,
                  showLegend: true,
                  showExistingUnderlay: false,
                  scale: 2,
                });
                notify('PNG exported.', 'success');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 hover:border-slate-600 bg-[#111827] text-xs font-medium text-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Export PNG
            </button>
            <button
              onClick={handleOpenInEditor}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              Remix in Editor
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        <div className="bg-[#111827] border border-slate-800 rounded-xl p-6">
          <ContributionCanvas
            calendar={calendar}
            cells={sharedPreviewData.cells}
            previewMode="artwork"
            paletteTheme="github-dark"
            showExistingUnderlay={false}
            readOnly
          />
        </div>
      </div>
    </div>
  );
}
