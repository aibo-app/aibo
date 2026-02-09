import React from 'react';
import { AssistantPopup } from './components/common/AssistantPopup';

export default function App() {
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
}
