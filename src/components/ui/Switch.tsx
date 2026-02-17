import React from 'react';

interface SwitchProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    label?: string;
    description?: string;
}

export const Switch: React.FC<SwitchProps> = ({ enabled, onChange, label, description }) => {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex-1 pr-4">
                {label && <h3 className="text-sm font-semibold text-text-main">{label}</h3>}
                {description && <p className="text-xs text-text-muted mt-1 leading-relaxed">{description}</p>}
            </div>
            <div
                className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${enabled ? 'bg-primary' : 'bg-gray-300'}`}
                onClick={() => onChange(!enabled)}
            >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${enabled ? 'right-0.5' : 'left-0.5'}`} />
            </div>
        </div>
    );
};
