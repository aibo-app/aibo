import React from 'react';

interface VoiceVisualizerProps {
    isListening: boolean;
    volume: number; // 0 to 1
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ isListening, volume }) => {
    if (!isListening) return null;

    // Scale volume for visual effect
    const scale = 1 + volume * 2;
    const opacity = 0.3 + volume * 0.7;

    return (
        <div className="flex items-center justify-center space-x-1 h-8 px-4">
            <div
                className="w-1.5 bg-blue-500 rounded-full transition-all duration-75"
                style={{ height: `${20 * scale}%`, opacity }}
            />
            <div
                className="w-1.5 bg-purple-500 rounded-full transition-all duration-75 delay-75"
                style={{ height: `${40 * scale}%`, opacity }}
            />
            <div
                className="w-1.5 bg-blue-400 rounded-full transition-all duration-75 delay-150"
                style={{ height: `${60 * scale}%`, opacity }}
            />
            <div
                className="w-1.5 bg-purple-400 rounded-full transition-all duration-75 delay-75"
                style={{ height: `${40 * scale}%`, opacity }}
            />
            <div
                className="w-1.5 bg-blue-500 rounded-full transition-all duration-75"
                style={{ height: `${20 * scale}%`, opacity }}
            />
        </div>
    );
};
