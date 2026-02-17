import { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';


export const MacWindowControls = () => {
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(true);

    useEffect(() => {
        const onFocus = () => setIsFocused(true);
        const onBlur = () => setIsFocused(false);
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
        };
    }, []);

    const handleMinimize = () => window.electronAPI?.minimize();
    const handleMaximize = () => window.electronAPI?.maximize();
    const handleClose = () => window.electronAPI?.close();

    // Custom "Visible Gray" for inactive state
    // Using a solid gray that stands out against dark/light headers
    const grayStyle = {
        background: '#505050', // Visible medium gray
        border: '1px solid #3a3a3a'
    };

    const redStyle = { background: '#ff5f57', border: '1px solid #e0443e' };
    const yellowStyle = { background: '#febc2e', border: '1px solid #d89e24' };
    const greenStyle = { background: '#28c840', border: '1px solid #1aab29' };

    // Show color if window is focused OR if user is hovering over the controls
    const showColor = isFocused || isHovered;

    return (
        <div
            className="no-drag"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                paddingLeft: '0px',
                height: '100%'
            }}
        >
            {/* Close (Red) */}
            <div onClick={handleClose} style={{
                width: '13px', height: '13px', borderRadius: '50%',
                ...(showColor ? redStyle : grayStyle),
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transition: 'background 0.2s, border 0.2s'
            }}>
                {isHovered && <X size={8} color="#4c0002" strokeWidth={3} />}
            </div>

            {/* Minimize (Yellow) */}
            <div onClick={handleMinimize} style={{
                width: '13px', height: '13px', borderRadius: '50%',
                ...(showColor ? yellowStyle : grayStyle),
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transition: 'background 0.2s, border 0.2s'
            }}>
                {isHovered && <Minus size={8} color="#5c3c00" strokeWidth={3} />}
            </div>

            {/* Maximize (Green) */}
            <div onClick={handleMaximize} style={{
                width: '13px', height: '13px', borderRadius: '50%',
                ...(showColor ? greenStyle : grayStyle),
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transition: 'background 0.2s, border 0.2s'
            }}>
                {isHovered && <div style={{ width: '6px', height: '6px', background: '#006500', borderRadius: '50%' }} />}
            </div>
        </div>
    );
};

export const WindowControls = () => {
    const handleMinimize = () => {
        window.electronAPI?.minimize();
    };

    const handleMaximize = () => {
        window.electronAPI?.maximize();
    };

    const handleClose = () => {
        window.electronAPI?.close();
    };

    return (
        <div className="no-drag" style={{ display: 'flex', height: '100%' }}>
            <button
                onClick={handleMinimize}
                className="window-control hover-bg"
                style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#6b7280',
                    width: '46px',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                    outline: 'none'
                }}
            >
                <Minus size={10} strokeWidth={1} />
            </button>
            <button
                onClick={handleMaximize}
                className="window-control hover-bg"
                style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#6b7280',
                    width: '46px',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                    outline: 'none'
                }}
            >
                <Square size={10} strokeWidth={1} />
            </button>
            <button
                onClick={handleClose}
                className="window-control-close"
                style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#6b7280',
                    width: '46px',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                    outline: 'none'
                }}
            >
                <X size={10} strokeWidth={1.5} />
            </button>
            <style>{`
                .hover-bg:hover { background: rgba(0, 0, 0, 0.05) !important; color: #1a1c23 !important; }
                .window-control-close:hover { background: #e81123 !important; color: white !important; }
            `}</style>
        </div>
    );
};
