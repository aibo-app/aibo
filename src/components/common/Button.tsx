import type { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    active?: boolean;
    variant?: 'primary' | 'accent' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
}

export const Button = ({
    children,
    active,
    variant = 'primary',
    size = 'md',
    className = '',
    style,
    ...props
}: ButtonProps) => {
    const variantClass = {
        primary: 'btn-primary',
        accent: 'btn-accent',
        ghost: 'btn-ghost',
        danger: 'btn-primary' // Re-uses primary with red override below
    }[variant];

    const sizeStyles = {
        sm: { padding: '4px var(--space-2)', fontSize: '11px' },
        md: {},
        lg: { padding: 'var(--space-2) var(--space-4)', fontSize: '14px' }
    };

    const dangerStyle = variant === 'danger' ? {
        background: 'linear-gradient(180deg, var(--status-danger) 0%, #b91c1c 100%)',
        color: 'white',
        borderColor: 'rgba(255,255,255,0.2)'
    } : {};

    return (
        <button
            className={`${variantClass} ${active ? 'active' : ''} ${className} items-center justify-center gap-2`}
            style={{
                ...sizeStyles[size],
                ...dangerStyle,
                ...style,
                opacity: props.disabled ? 0.5 : 1,
                cursor: props.disabled ? 'not-allowed' : 'pointer',
            }}
            {...props}
        >
            {children}
        </button>
    );
};
