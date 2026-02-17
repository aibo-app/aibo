import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ToastProps {
    id: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
    onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type = 'info', duration = 3000, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Fade in
        requestAnimationFrame(() => setIsVisible(true));

        // Auto-close
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onClose(id), 300); // Wait for fade out
        }, duration);

        return () => clearTimeout(timer);
    }, [id, duration, onClose]);

    const icons = {
        info: 'info',
        success: 'check_circle',
        warning: 'warning',
        error: 'error'
    };

    const colors = {
        info: 'bg-blue-500',
        success: 'bg-green-500',
        warning: 'bg-orange-500',
        error: 'bg-red-500'
    };

    return createPortal(
        <div
            className={`fixed bottom-6 right-6 z-[9999] transition-all duration-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
        >
            <div className="bg-white rounded-lg border border-black/5 shadow-lg px-3 py-2 flex items-center gap-2 max-w-xs">
                <div className={`size-6 rounded-full ${colors[type]} flex items-center justify-center shrink-0`}>
                    <span className="material-symbols-outlined text-white text-[14px]">{icons[type]}</span>
                </div>
                <p className="text-xs font-medium text-text-main flex-1">{message}</p>
                <button
                    onClick={() => {
                        setIsVisible(false);
                        setTimeout(() => onClose(id), 300);
                    }}
                    className="size-5 rounded hover:bg-gray-100 flex items-center justify-center shrink-0 transition-colors"
                >
                    <span className="material-symbols-outlined text-text-muted text-[14px]">close</span>
                </button>
            </div>
        </div>,
        document.body
    );
};

interface ToastContainerProps {
    toasts: ToastProps[];
    onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
    return (
        <>
            {toasts.map((toast, index) => (
                <div
                    key={toast.id}
                    style={{
                        transform: `translateY(-${index * 50}px)`
                    }}
                >
                    <Toast {...toast} onClose={onClose} />
                </div>
            ))}
        </>
    );
};

// Toast Hook
export const useToast = () => {
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    const showToast = (message: string, type: ToastProps['type'] = 'info', duration = 3000) => {
        const id = Math.random().toString(36).substring(7);
        setToasts(prev => [...prev, { id, message, type, duration, onClose: removeToast }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return { toasts, showToast, removeToast };
};
