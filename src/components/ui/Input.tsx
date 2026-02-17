import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
    label?: string;
    description?: string;
    multiline?: boolean;
    icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, description, multiline = false, icon, className = '', ...props }) => {
    const commonStyles = "w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs font-mono panel-inset focus:ring-1 focus:ring-primary/20 outline-none placeholder:text-gray-400";

    return (
        <div className="space-y-1.5 container-input">
            {label && (
                <div className="flex flex-col">
                    <label className="text-sm font-semibold text-text-main mb-1">
                        {label}
                    </label>
                    {description && (
                        <p className="text-xs text-text-muted mb-2">
                            {description}
                        </p>
                    )}
                </div>
            )}

            <div className="relative">
                {icon && icon}
                {multiline ? (
                    <textarea
                        className={`${commonStyles} min-h-[100px] resize-none leading-relaxed ${className}`}
                        {...props as React.TextareaHTMLAttributes<HTMLTextAreaElement>}
                    />
                ) : (
                    <input
                        className={`${commonStyles} ${className}`}
                        {...props as React.InputHTMLAttributes<HTMLInputElement>}
                    />
                )}
            </div>
        </div>
    );
};
