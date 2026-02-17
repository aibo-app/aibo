import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, children }) => {
    return (
        <header className="flex justify-between items-center mb-6 shrink-0">
            <div>
                <h1 className="text-2xl font-bold text-text-main tracking-tight font-display">{title}</h1>
                {subtitle && (
                    <p className="text-sm text-text-muted mt-1 font-medium">{subtitle}</p>
                )}
            </div>
            {children && (
                <div className="flex gap-4 items-center">
                    {children}
                </div>
            )}
        </header>
    );
};
