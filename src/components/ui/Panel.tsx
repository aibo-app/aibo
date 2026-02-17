import React from 'react';

interface PanelProps {
    children: React.ReactNode;
    className?: string;
    variant?: 'bevel' | 'inset';
}

export const Panel: React.FC<PanelProps> = ({ children, className = '', variant = 'bevel' }) => {
    const variantClass = variant === 'bevel' ? 'panel-bevel' : 'panel-inset';
    return (
        <div className={`${variantClass} bg-white rounded-2xl overflow-hidden ${className}`}>
            {children}
        </div>
    );
};

export const SectionTitle: React.FC<{ title: string; subtitle?: string; icon?: string; action?: React.ReactNode }> = ({ title, subtitle, icon, action }) => {
    return (
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-2">
                {icon && (
                    <span className="material-symbols-outlined text-primary text-base">{icon}</span>
                )}
                <div>
                    <h2 className="text-xs uppercase font-semibold tracking-[0.2em] text-text-main leading-none">{title}</h2>
                    {subtitle && <p className="text-[10px] text-text-muted mt-1 font-medium italic opacity-60">{subtitle}</p>}
                </div>
            </div>
            {action && <div>{action}</div>}
        </div>
    );
};
