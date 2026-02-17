import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'bevel' | 'primary' | 'ghost';
    icon?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'bevel',
    icon,
    size = 'md',
    className = '',
    loading = false,
    ...props
}) => {
    const baseStyles = "flex items-center justify-center gap-2 font-bold uppercase tracking-widest transition-all active:scale-95 disabled:scale-100 disabled:opacity-50";

    const sizeStyles = {
        sm: "px-3 py-1.5 text-[10px]",
        md: "px-4 py-2 text-[10px]",
        lg: "px-6 py-3 text-xs"
    };

    const variantStyles = {
        bevel: "btn-bevel text-text-muted hover:text-primary",
        primary: "bg-primary text-white rounded-xl shadow-button hover:brightness-110",
        ghost: "hover:bg-black/5 rounded-lg text-text-muted"
    };

    return (
        <button
            className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
            disabled={loading || props.disabled}
            {...props}
        >
            {loading ? (
                <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : icon}
            {children}
        </button>
    );
};
