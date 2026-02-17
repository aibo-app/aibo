import React from 'react';

/**
 * App Icon for macOS/Windows
 * Render this at 1024x1024 for macOS, export as PNG
 * For Windows, render at 256x256 and convert to .ico with multiple sizes
 */
export const AppIcon: React.FC<{ size?: number }> = ({ size = 1024 }) => {
    // Icon content area (for macOS: 824x824 on 1024x1024 canvas = 100px padding)
    const padding = size * 0.1; // 10% padding
    const iconSize = size - (padding * 2);

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Black background */}
            <rect
                x={padding}
                y={padding}
                width={iconSize}
                height={iconSize}
                fill="#000000"
            />

            {/* Bevel borders - top and left highlight */}
            <rect
                x={padding}
                y={padding}
                width={iconSize}
                height={iconSize}
                fill="none"
                stroke="#ffffff"
                strokeWidth={size * 0.003}
                opacity={0.3}
            />

            {/* Bevel borders - bottom and right shadow */}
            <line
                x1={padding}
                y1={padding + iconSize}
                x2={padding + iconSize}
                y2={padding + iconSize}
                stroke="#716f64"
                strokeWidth={size * 0.006}
            />
            <line
                x1={padding + iconSize}
                y1={padding}
                x2={padding + iconSize}
                y2={padding + iconSize}
                stroke="#716f64"
                strokeWidth={size * 0.006}
            />

            {/* Robot face (Logo) - scaled and centered */}
            <g transform={`translate(${padding + iconSize * 0.2}, ${padding + iconSize * 0.15}) scale(${iconSize / 128 * 0.6})`}>
                <defs>
                    <mask id="feature-mask-icon">
                        <rect x="0" y="0" width="128" height="128" fill="white" />
                        <rect x="33" y="41" width="18" height="26" rx="4" fill="black" />
                        <rect x="77" y="41" width="18" height="26" rx="4" fill="black" />
                        <rect x="57" y="78" width="14" height="6" rx="2" fill="black" />
                    </mask>
                </defs>
                <g transform="translate(0, 12)">
                    {/* Antenna */}
                    <rect x="62" y="4" width="4" height="25" rx="2" fill="#2c5bf6" />
                    <circle cx="64" cy="4" r="6" fill="#2c5bf6" />

                    {/* Head outline */}
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M28 26C20.268 26 14 32.268 14 40V88C14 95.732 20.268 102 28 102H100C107.732 102 114 95.732 114 88V40C114 32.268 107.732 26 100 26H28ZM28 34C24.6863 34 22 36.6863 22 40V88C22 91.3137 24.6863 94 28 94H100C103.314 94 106 91.3137 106 88V40C106 36.6863 103.314 34 100 34H28Z"
                        fill="#2c5bf6"
                    />

                    {/* Face with eyes and mouth cutouts */}
                    <rect
                        x="24"
                        y="36"
                        width="80"
                        height="56"
                        rx="4"
                        fill="#2c5bf6"
                        mask="url(#feature-mask-icon)"
                    />
                </g>
            </g>
        </svg>
    );
};
