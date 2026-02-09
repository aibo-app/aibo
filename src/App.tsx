import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { DataProvider } from './context/DataContext';

// Layout
import { Shell } from './components/layout/Shell';

// Components
import { AssistantPopup } from './components/common/AssistantPopup';
import { Skeleton } from './components/common/Skeleton';

// Pages
// Pages
import {
  DashboardPage,
  OnboardingPage,
  SettingsPage,
  ChatPage,
  WalletPage
} from './pages';

import { useAgentReactions } from './hooks/useAgentReactions';

function AppContent() {
  useAgentReactions();

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  const [isAssistant, setIsAssistant] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/wallets');
        if (response.ok) {
          const data = await response.json();
          setIsOnboarded(data.length > 0);
        } else {
          setIsOnboarded(false);
        }
      } catch (err) {
        console.error('Failed to fetch wallets:', err);
        setIsOnboarded(false);
      }
    };

    fetchWallets();
  }, []);

  useEffect(() => {
    const checkRoute = () => {
      const isPopup = window.location.hash.includes('assistant');
      setIsAssistant(isPopup);

      if (isPopup) {
        document.body.style.background = 'transparent';
        document.documentElement.style.background = 'transparent';
      } else {
        document.body.style.background = 'var(--bg-base)';
        document.documentElement.style.background = 'var(--bg-base)';
      }
    };

    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);


  if (isAssistant) {
    return (
      <ThemeProvider>
        <DataProvider>
          <AssistantPopup />
        </DataProvider>
      </ThemeProvider>
    );
  }

  if (isOnboarded === null) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', gap: '20px' }}>
        <Skeleton width={120} height={120} borderRadius="16px" />
        <Skeleton width={200} height={20} />
      </div>
    );
  }

  if (!isOnboarded) {
    return <OnboardingPage onComplete={() => setIsOnboarded(true)} />;
  }

  return (
    <ThemeProvider>
      <DataProvider>
        <Router>
          <AppContent />
        </Router>
      </DataProvider>
    </ThemeProvider>
  );
}
