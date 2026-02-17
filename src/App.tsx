import React, { Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { AssistantPopup } from './components/common/AssistantPopup';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';

// Lazy-loaded pages — only loaded when the route is visited
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ActivityPage = React.lazy(() => import('./pages/ActivityPage').then(m => ({ default: m.ActivityPage })));
const ChatPage = React.lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })));
const WalletPage = React.lazy(() => import('./pages/WalletPage').then(m => ({ default: m.WalletPage })));
const WalletDetailsPage = React.lazy(() => import('./pages/WalletDetailsPage').then(m => ({ default: m.WalletDetailsPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const SkillsPage = React.lazy(() => import('./pages/SkillsPage').then(m => ({ default: m.SkillsPage })));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const HelpPage = React.lazy(() => import('./pages/HelpPage').then(m => ({ default: m.HelpPage })));
const RulesPage = React.lazy(() => import('./pages/RulesPage').then(m => ({ default: m.RulesPage })));

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center bg-beige">
    <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  </div>
);

// Wrapper for the transparent floating assistant window
const AssistantWindow = () => {
  React.useEffect(() => {
    // Aggressively force transparent background for the standalone assistant window
    const elements = [document.documentElement, document.body, document.getElementById('root')];

    elements.forEach(el => {
      if (el) {
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('background-image', 'none', 'important');
      }
    });

    return () => {
      elements.forEach(el => {
        if (el) {
          el.style.removeProperty('background-color');
          el.style.removeProperty('background-image');
        }
      });
    };
  }, []);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      <AssistantPopup />
    </div>
  );
};

// Pause CSS animations when window is hidden to save battery
function useVisibilityClass() {
  React.useEffect(() => {
    const toggle = () => {
      document.documentElement.classList.toggle('hidden-doc', document.hidden);
    };
    document.addEventListener('visibilitychange', toggle);
    return () => document.removeEventListener('visibilitychange', toggle);
  }, []);
}

export default function App() {
  useVisibilityClass();
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <DataProvider>
          <HashRouter>
            <Routes>
              {/* Standalone Assistant Window */}
              <Route path="/assistant" element={<AssistantWindow />} />

              {/* Main Application with Shell Layout */}
              <Route element={<Shell />}>
                <Route path="/" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
                <Route path="/activity" element={<Suspense fallback={<PageLoader />}><ActivityPage /></Suspense>} />
                <Route path="/chat" element={<Suspense fallback={<PageLoader />}><ChatPage /></Suspense>} />
                <Route path="/wallet" element={<Suspense fallback={<PageLoader />}><WalletPage /></Suspense>} />
                <Route path="/wallet/:id" element={<Suspense fallback={<PageLoader />}><WalletDetailsPage /></Suspense>} />
                <Route path="/skills" element={<Suspense fallback={<PageLoader />}><SkillsPage /></Suspense>} />
                <Route path="/rules" element={<Suspense fallback={<PageLoader />}><RulesPage /></Suspense>} />
                <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
                <Route path="/help" element={<Suspense fallback={<PageLoader />}><HelpPage /></Suspense>} />
                <Route path="/onboarding" element={<Suspense fallback={<PageLoader />}><OnboardingPage onComplete={() => window.location.hash = '#/'} /></Suspense>} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </DataProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
