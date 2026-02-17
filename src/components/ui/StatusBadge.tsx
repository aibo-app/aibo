import React from 'react';

type BadgeStatus = 'ok' | 'failed' | 'pending' | 'inactive';

interface StatusBadgeProps {
    status: BadgeStatus;
    label?: string;
    className?: string;
}

const STATUS_STYLES: Record<BadgeStatus, string> = {
    ok: 'bg-green-50 text-green-700 border-green-100',
    failed: 'bg-red-50 text-red-700 border-red-100',
    pending: 'bg-orange-50 text-orange-700 border-orange-100',
    inactive: 'bg-gray-50 text-gray-500 border-gray-100',
};

const STATUS_LABELS: Record<BadgeStatus, string> = {
    ok: 'Compiled',
    failed: 'Failed',
    pending: 'Compiling',
    inactive: 'Not compiled',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = '' }) => {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${STATUS_STYLES[status]} ${className}`}>
            {status === 'pending' && (
                <div className="size-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {label || STATUS_LABELS[status]}
        </span>
    );
};
