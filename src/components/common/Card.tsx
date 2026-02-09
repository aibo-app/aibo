import type { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    style?: React.CSSProperties;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
    variant?: 'panel' | 'inset' | 'outline' | 'transparent';
    onClick?: (e: React.MouseEvent) => void;
}

export const Card = ({
    children,
    style = {},
    padding = 'md',
    className = '',
    variant = 'panel',
    onClick
}: CardProps) => {
    const paddingMap = {
        none: '0',
        sm: 'var(--space-2)',
        md: 'var(--space-3)',
        lg: 'var(--space-5)'
    };

    const variantClass = {
        panel: 'panel',
        inset: 'panel-inset',
        outline: 'panel-outline',
        transparent: ''
    }[variant];

    return (
        <div
            className={`${variantClass} ${className} flex-col`}
            onClick={onClick}
            style={{
                padding: paddingMap[padding],
                ...style
            }}
        >
            {children}
        </div>
    );
};
