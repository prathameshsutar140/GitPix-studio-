import React from 'react';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StudioProvider, useStudio } from './context/StudioContext';
import { ArtworksPage } from './pages/ArtworksPage';
import { DashboardPage } from './pages/DashboardPage';
import { EditorPage } from './pages/EditorPage';
import { ExportPage } from './pages/ExportPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { PresetsPage } from './pages/PresetsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { PublishProgressPage } from './pages/PublishProgressPage';
import { PublishReviewPage } from './pages/PublishReviewPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { SchedulerPage } from './pages/SchedulerPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharedPreviewPage } from './pages/SharedPreviewPage';

function StudioRouter() {
  const { route } = useStudio();

  if (route === 'landing') {
    return <LandingPage />;
  }

  if (route === 'shared-preview') {
    return <SharedPreviewPage />;
  }

  const renderWorkspacePage = () => {
    switch (route) {
      case 'login':
        return <LoginPage />;
      case 'repositories':
        return <RepositoriesPage />;
      case 'scheduler':
        return <SchedulerPage />;
      case 'dashboard':
        return <DashboardPage />;
      case 'editor':
        return <EditorPage />;
      case 'presets':
        return <PresetsPage />;
      case 'artworks':
        return <ArtworksPage />;
      case 'export':
        return <ExportPage />;
      case 'publish-review':
        return <PublishReviewPage />;
      case 'publish-progress':
        return <PublishProgressPage />;
      case 'settings':
        return <SettingsPage />;
      case 'privacy':
        return <PrivacyPage />;
      default:
        return <DashboardPage />;
    }
  };

  return <AppShell>{renderWorkspacePage()}</AppShell>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <StudioProvider>
        <StudioRouter />
      </StudioProvider>
    </ErrorBoundary>
  );
}
