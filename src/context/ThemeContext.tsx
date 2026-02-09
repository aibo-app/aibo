import React, { useEffect, useState } from 'react';
import type { Theme } from '../hooks/useTheme';
import { ThemeContext } from '../hooks/useTheme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Default to light as per user request, or check localStorage
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('app-theme');
        return (saved as Theme) || 'light';
    });

    const [accentOverride, setAccentOverride] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('app-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, accentOverride, setAccentOverride }}>
            <div style={accentOverride ? { '--accent': accentOverride } as React.CSSProperties : {}}>
                {children}
            </div>
        </ThemeContext.Provider>
    );
};

