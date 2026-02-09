import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { AssistantPopup } from './components/common/AssistantPopup';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { ChatPage } from './pages/ChatPage';
import { WalletPage } from './pages/WalletPage';
import { SettingsPage } from './pages/SettingsPage';
import { OnboardingPage } from './pages/OnboardingPage';

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

export default function App() {
  return (
    <ThemeProvider>
      <DataProvider>
        <HashRouter>
          <Routes>
            {/* Standalone Assistant Window */}
            <Route path="/assistant" element={<AssistantWindow />} />

            {/* Main Application with Shell Layout */}
            <Route path="/" element={<Shell><DashboardPage /></Shell>} />
            <Route path="/chat" element={<Shell><ChatPage /></Shell>} />
            <Route path="/wallet" element={<Shell><WalletPage /></Shell>} />
            <Route path="/settings" element={<Shell><SettingsPage /></Shell>} />
            <Route path="/onboarding" element={<Shell><OnboardingPage onComplete={() => window.location.hash = '#/'} /></Shell>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </DataProvider>
    </ThemeProvider>
  );
}
