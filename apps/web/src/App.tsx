import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { IntentCapturePage } from './pages/IntentCapturePage.js';
import { ConnectorsPage } from './pages/ConnectorsPage.js';
import { DiscoveryPage } from './pages/DiscoveryPage.js';
import { ReviewPage } from './pages/ReviewPage.js';
import { ExportPage } from './pages/ExportPage.js';
import { ProjectSummaryPage } from './pages/ProjectSummaryPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { GalleryPage } from './pages/GalleryPage.js';
import { ReuseCataloguePage } from './pages/ReuseCataloguePage.js';
import { useAppStore } from './store/app-store.js';

function isAuthenticated(): boolean {
  const token = localStorage.getItem('connexy_token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] || token));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('connexy_token');
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function App() {
  const currentPage = useAppStore((s) => s.currentPage);
  const activeNav = useAppStore((s) => s.activeNav);
  const navigate = useAppStore((s) => s.navigate);

  if (!isAuthenticated()) {
    return <AuthPage />;
  }

  const renderPage = () => {
    switch (currentPage.name) {
      case 'projects':
        return <ProjectsPage />;
      case 'project-new':
        return <IntentCapturePage />;
      case 'project':
        return <ProjectSummaryPage projectId={currentPage.projectId} />;
      case 'connectors':
        return <ConnectorsPage projectId={currentPage.projectId} />;
      case 'discovery':
        return <DiscoveryPage projectId={currentPage.projectId} />;
      case 'review':
        return <ReviewPage projectId={currentPage.projectId} />;
      case 'export':
        return <ExportPage projectId={currentPage.projectId} />;
      case 'admin':
        return <AdminPage />;
      case 'catalogue':
        return <ReuseCataloguePage />;
      case 'lineage':
        return <GalleryPage />;
      default:
        return <ProjectsPage />;
    }
  };

  return (
    <AppShell activeNav={activeNav} onNavigate={(nav) => {
      if (nav === 'projects') navigate({ name: 'projects' });
      else if (nav === 'admin') navigate({ name: 'admin' });
      else if (nav === 'catalogue') navigate({ name: 'catalogue' });
      else if (nav === 'lineage') navigate({ name: 'lineage' });
      else if (nav === 'connectors') navigate({ name: 'projects' });
    }}>
      {renderPage()}
    </AppShell>
  );
}