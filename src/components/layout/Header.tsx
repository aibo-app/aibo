import React from 'react';
import { WindowControls, MacWindowControls } from './WindowControls';

interface HeaderProps {
    title: string;
    actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, actions }) => {
    const platform = (window as unknown as { electronAPI?: { platform: string } }).electronAPI?.platform || 'darwin';
    const isMac = platform === 'darwin';

    return (
        <header className="no-drag app-header">

            {/* Title Area */}
            <div className="flex-row items-center h-full gap-3 flex-1">
                {isMac && <MacWindowControls />}

                <span className="text-xs font-semibold text-active h-full flex items-center pt-px">
                    Aibō // {title}
                </span>
            </div>

            {/* Right Actions (if any) */}
            <div className="no-drag h-full flex items-center">
                {actions}
                {!isMac && <WindowControls />}
            </div>
        </header>
    );
};
