import { useEffect, useRef } from 'react';

interface LandingAgentProps {
    expression?: 'neutral' | 'happy' | 'alert' | 'thinking';
    size?: number;
}

export default function LandingAgent({ expression = 'neutral', size = 80 }: LandingAgentProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Gaze Tracking
    const mousePos = useRef({ x: 0, y: 0 });
    const smoothGaze = useRef(new Float32Array([0, 0]));

    useEffect(() => {
        const handleMouse = (e: MouseEvent) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Aggressive gaze tracking
            const maxGaze = 14;

            if (distance < 1) {
                mousePos.current = { x: 0, y: 0 };
            } else {
                mousePos.current = {
                    x: (dx / distance) * maxGaze,
                    y: (dy / distance) * maxGaze
                };
            }
        };
        window.addEventListener('mousemove', handleMouse);
        return () => window.removeEventListener('mousemove', handleMouse);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = size;
        const height = size * 0.7;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const renderLoop = () => {
            const now = Date.now();
            const width = size;
            const height = size * 0.7;
            const centerX = width / 2;
            const centerY = height / 2;

            // Faster Smoothing (0.2 instead of 0.1)
            smoothGaze.current[0] += (mousePos.current.x - smoothGaze.current[0]) * 0.2;
            smoothGaze.current[1] += (mousePos.current.y - smoothGaze.current[1]) * 0.2;

            ctx.clearRect(0, 0, width, height);

            // Face containment bevel (like the app)
            ctx.fillStyle = '#f1f3f6';
            ctx.beginPath();
            if ((ctx as any).roundRect) (ctx as any).roundRect(4, 4, width - 8, height - 8, 4);
            else ctx.rect(4, 4, width - 8, height - 8);
            ctx.fill();

            ctx.strokeStyle = '#aca899';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Eyes
            ctx.fillStyle = '#2c5bf6';
            ctx.shadowColor = 'rgba(44, 91, 246, 0.4)';
            ctx.shadowBlur = expression === 'alert' ? 10 : 4;

            const eyeW = width * 0.125;
            let eyeH = height * 0.28;
            const gx = smoothGaze.current[0] * (size / 80);
            const gy = smoothGaze.current[1] * (size / 80);

            // Blink Logic
            const blink = (Math.sin(now / 300) > 0.99) ? 0.01 : 1.0;
            eyeH *= blink;

            const drawEye = (isRight: boolean) => {
                const x = centerX + (isRight ? 1 : -1) * (width * 0.175) - (eyeW / 2) + gx;
                const y = centerY - (height * 0.1) - (eyeH / 2) + gy;
                ctx.beginPath();
                if ((ctx as any).roundRect) (ctx as any).roundRect(x, y, eyeW, eyeH, 2);
                else ctx.rect(x, y, eyeW, eyeH);
                ctx.fill();
            };

            drawEye(false);
            drawEye(true);

            // Mouth
            const mouthW = expression === 'happy' ? width * 0.2 : width * 0.125;
            const mx = centerX - (mouthW / 2) + (gx * 0.5);
            const my = centerY + (height * 0.18) + (gy * 0.5);
            ctx.beginPath();
            if ((ctx as any).roundRect) (ctx as any).roundRect(mx, my, mouthW, 3, 1);
            else ctx.rect(mx, my, mouthW, 3);
            ctx.fill();

            animationFrameRef.current = requestAnimationFrame(renderLoop);
        };

        renderLoop();
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [expression]);

    return (
        <div style={{ width: `${size}px`, height: `${size * 0.7}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <canvas ref={canvasRef} style={{ width: `${size}px`, height: `${size * 0.7}px` }} />
        </div>
    );
}
