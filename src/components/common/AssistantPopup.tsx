import { useCallback, useEffect, useRef, useState } from 'react';
import { useData } from '../../hooks/useData';

// --- CONFIG ---
const IS_DEMO_MODE = false;
const FORCE_FULL_SCREEN = true;
const DEMO_SCALE = 1.2;

export const AssistantPopup = () => {
    const { agentAction } = useData();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const antennaTipRef = useRef<HTMLDivElement>(null);

    // Face State Refs
    const animationFrameRef = useRef<number | null>(null);
    const smoothBrightnessRef = useRef<Float32Array | null>(null);
    const smoothEyeBaseRef = useRef<Float32Array | null>(null);
    const smoothGazeRef = useRef<Float32Array | null>(null);
    const smoothHueRef = useRef<Float32Array | null>(null);

    // MOUTH STATE (Phonemes)
    const smoothMouthRef = useRef<Float32Array | null>(null); // [w, h, r]
    const targetMouthRef = useRef({ w: 12, h: 4, r: 2 });
    const nextPhonemeTimeRef = useRef<number>(0);

    // Voice Latch Logic
    const lastVoiceTimeRef = useRef<number>(0);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    // Hybrid Interaction State
    const [showInput, setShowInput] = useState(false);
    const [textInput, setTextInput] = useState('');

    // Agent Action State
    const [actionColor, setActionColor] = useState<string | null>(null);
    const [isShaking, setIsShaking] = useState(false);

    useEffect(() => {
        if (!agentAction) return;

        if (agentAction.action === 'set_status_color') {
            const { color, duration = 5000 } = agentAction.data;
            setTimeout(() => setActionColor(color), 0);
            const timer = setTimeout(() => setActionColor(null), duration);
            return () => clearTimeout(timer);
        }

        if (agentAction.action === 'vibrate_mascot') {
            setTimeout(() => setIsShaking(true), 0);
            const timer = setTimeout(() => setIsShaking(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [agentAction]);


    useEffect(() => {
        // Trigger pop-in animation after mount
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Behavior Logic
    const nextBehaviorRef = useRef<number>(0);
    useEffect(() => {
        nextBehaviorRef.current = Date.now() + 1000;
    }, []);
    const isBlinkingRef = useRef(false);
    const blinkTypeRef = useRef<'both' | 'left' | 'right'>('both');
    const blinkDurationRef = useRef<number>(0);
    const targetGazeRef = useRef({ x: 0, y: 0 });

    // --- DYNAMIC SCALING ---
    const [dynamicScale, setDynamicScale] = useState((IS_DEMO_MODE || FORCE_FULL_SCREEN) ? 3.5 : 1);
    const preferredVoiceURIRef = useRef<string | null>(null);

    useEffect(() => {
        fetch('http://localhost:3001/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.TTS_VOICE_URI) {
                    preferredVoiceURIRef.current = data.TTS_VOICE_URI;
                }
            })
            .catch(() => { }); // silent fail
    }, []);


    const speak = useCallback(async (text: string) => {
        if (!window.speechSynthesis) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (event) => {
            console.error('[TTS] Error:', event);
            setIsSpeaking(false);
        };

        const voices = window.speechSynthesis.getVoices();
        const selectVoice = () => {
            const currentVoices = window.speechSynthesis.getVoices();
            console.log(`[TTS] Available voices: ${currentVoices.length}`);
            console.log(`[TTS] Available voices: ${currentVoices.length}`);

            let preferredVoice = currentVoices.find(v => v.voiceURI === preferredVoiceURIRef.current);

            if (!preferredVoice) {
                preferredVoice = currentVoices.find(v =>
                    v.name.includes('Samantha') ||
                    v.name.includes('Google US English') ||
                    v.name.includes('Daniel')
                ) || currentVoices[0];
            }

            if (preferredVoice) {
                console.log(`[TTS] Selected voice: ${preferredVoice.name}`);
                utterance.voice = preferredVoice;
            }
        };

        if (voices.length === 0) {
            window.speechSynthesis.onvoiceschanged = () => {
                selectVoice();
                window.speechSynthesis.speak(utterance);
                window.speechSynthesis.onvoiceschanged = null;
            };
        } else {
            selectVoice();
            window.speechSynthesis.speak(utterance);
        }
    }, []);


    const handleAiQuery = useCallback(async (transcript: string) => {
        console.log('Sending to AI Brain:', transcript);
        setIsThinking(true);
        try {
            const response = await fetch('http://localhost:3001/api/ai/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript })
            });
            const data = await response.json();
            console.log('AI Response:', data.response);
            setIsThinking(false);
            if (data.response && data.response.trim() !== "") {
                speak(data.response);
            }
        } catch (error) {
            console.error('AI Query failed:', error);
            setIsThinking(false);
            speak("I lost connection to my logic core.");
        }
    }, [speak]);

    // Keyboard Listener for 'F' to toggle input
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Toggle input on 'F' key if we're not already typing in it
            if (e.key.toLowerCase() === 'f' && document.activeElement?.tagName !== 'INPUT') {
                setShowInput(prev => !prev);
            }
            // Close input on Escape
            if (e.key === 'Escape') {
                setShowInput(false);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input when shown
    useEffect(() => {
        if (showInput && inputRef.current) {
            // Small timeout ensuring CSS transition / visibility
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [showInput]);

    const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && textInput.trim()) {
            handleAiQuery(textInput);
            setTextInput('');
            setShowInput(false); // Hide after sending
        }
    };











    useEffect(() => {
        if (!IS_DEMO_MODE && !FORCE_FULL_SCREEN) return;

        const updateScale = () => {
            const h = window.innerHeight;
            // Base height = 110 (head) + 28 (antenna) + bulb (6) + sway margin.
            // Using 180 divisor to be extremely safe against clipping.
            const newScale = (h * 0.85) / 180;
            setDynamicScale(newScale);
        };

        window.addEventListener('resize', updateScale);
        updateScale();

        return () => window.removeEventListener('resize', updateScale);
    }, []);


    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const zoom = DEMO_SCALE; // Re-enable zoom for visibility in the popup window
        const superSample = 2.0; // Re-enable supersampling

        const rect = canvas.getBoundingClientRect();
        const baseW = canvas.offsetWidth || rect.width;
        const baseH = canvas.offsetHeight || rect.height;

        canvas.width = baseW * dpr * zoom * superSample;
        canvas.height = baseH * dpr * zoom * superSample;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr * zoom * superSample, dpr * zoom * superSample);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        }

        const renderLoop = () => {
            if (!canvas || !ctx) return;

            const width = baseW;
            const height = baseH;
            const centerX = width / 2;
            const centerY = height / 2;
            const now = Date.now();

            // --- 1. VOLUME INPUT ---
            let rawVolume = 0;
            const isTalking = isSpeaking; // Link to TTS state

            if (IS_DEMO_MODE) {
                // ... (existing demo logic removed or kept for reference)
            } else {
                if (isSpeaking) {
                    // Visual feedback for TTS speaking
                    const syllables = Math.abs(Math.sin(now / 80));
                    rawVolume = (0.3 + (syllables * 0.5));
                }
            }


            // --- 2. LATCH LOGIC ---
            const VOICE_THRESHOLD = 0.02;
            const HOLD_TIME_MS = 600;

            if (rawVolume > VOICE_THRESHOLD) {
                lastVoiceTimeRef.current = now;
            }

            const timeSinceVoice = now - lastVoiceTimeRef.current;
            const isLatchedOn = timeSinceVoice < HOLD_TIME_MS || isSpeaking;

            // Visual Volume
            const visualVol = Math.min(rawVolume * 5.0, 1.0);

            // --- 3. THINKING DYNAMICS ---
            if (isThinking) {
                // Circular gaze oscillation when thinking
                const thinkPeriod = now / 400;
                targetGazeRef.current = {
                    x: Math.cos(thinkPeriod) * 8,
                    y: Math.sin(thinkPeriod) * 3
                };
            }

            // --- 3. SMOOTHING DYNAMICS ---
            if (!smoothBrightnessRef.current) smoothBrightnessRef.current = new Float32Array(1);
            if (!smoothEyeBaseRef.current) smoothEyeBaseRef.current = new Float32Array([1.0]);
            if (!smoothGazeRef.current) smoothGazeRef.current = new Float32Array([0, 0]);
            if (!smoothHueRef.current) smoothHueRef.current = new Float32Array([0]);
            if (!smoothMouthRef.current) smoothMouthRef.current = new Float32Array([12, 4, 2]); // [w, h, r]

            // A. BRIGHTNESS LERP
            let targetBrightness = 0.0;
            if (isLatchedOn) {
                targetBrightness = Math.max(0.6, visualVol);
            }
            const currentBrightness = smoothBrightnessRef.current[0];
            const brightnessLerp = 0.3; // SMOOTHER + FAST (from 0.25)
            const activeBrightness = currentBrightness + (targetBrightness - currentBrightness) * brightnessLerp;
            smoothBrightnessRef.current[0] = activeBrightness;

            // B. EYE BASE LERP
            let targetEyeBase = 1.0;
            if (isLatchedOn) {
                const expansionFactor = 0.25;
                targetEyeBase = 1.0 + (activeBrightness * expansionFactor);
            }
            const currentEyeBase = smoothEyeBaseRef.current[0];
            const eyeLerp = 0.3; // SMOOTHER + FAST (from 0.2)
            const activeEyeBase = currentEyeBase + (targetEyeBase - currentEyeBase) * eyeLerp;
            smoothEyeBaseRef.current[0] = activeEyeBase;

            // C. GAZE LERP
            const currentGazeX = smoothGazeRef.current[0];
            const currentGazeY = smoothGazeRef.current[1];
            const targetGazeX = targetGazeRef.current.x;
            const targetGazeY = targetGazeRef.current.y;

            const gazeLerp = 0.05;
            const activeGazeX = currentGazeX + (targetGazeX - currentGazeX) * gazeLerp;
            const activeGazeY = currentGazeY + (targetGazeY - currentGazeY) * gazeLerp;
            smoothGazeRef.current[0] = activeGazeX;
            smoothGazeRef.current[1] = activeGazeY;


            // --- REACTIVE ANTENNA GLOW ---
            if (antennaTipRef.current) {
                // Pulse effect when listening but no voice detected yet
                // Pulse effect when listening but no voice detected yet
                const isSilentListening = false;
                const isThinkingPulse = isThinking;
                const pulse = isSilentListening ? (Math.sin(now / 200) * 0.2 + 0.8) :
                    isThinkingPulse ? (Math.sin(now / 80) * 0.4 + 0.6) : 1.0;

                // --- HUE CALCULATION ---
                let hue;
                if (actionColor) {
                    // Extract hue from hex if possible, or just use a fixed hue for red/green
                    hue = actionColor.includes('ff4d4d') ? 0 : 120; // Red vs Green
                } else {
                    const targetHue = activeBrightness * 35 + (isThinking ? 200 : 0);
                    const currentHue = smoothHueRef.current![0];
                    hue = currentHue + (targetHue - currentHue) * 0.08;
                    smoothHueRef.current![0] = hue;
                }

                const lightness = 50 * pulse;
                const saturation = 100;
                const unifiedColor = `hsl(${hue}, ${saturation} %, ${lightness} %)`;

                antennaTipRef.current.style.background = unifiedColor;
                antennaTipRef.current.style.boxShadow = isSilentListening ? `0 0 10px ${unifiedColor} ` : 'none';
                antennaTipRef.current.style.filter = 'none';
                antennaTipRef.current.style.transform = 'translateX(-50%)';
                antennaTipRef.current.style.opacity = '1';
                antennaTipRef.current.style.border = 'none';
            }

            // --- 4. BEHAVIOR LOGIC ---
            let leftBlinkMul = 1.0;
            let rightBlinkMul = 1.0;

            if (!isBlinkingRef.current && now > nextBehaviorRef.current) {
                const roll = Math.random();
                const isListening = isLatchedOn;
                if (roll < (isListening ? 0.3 : 0.6)) {
                    isBlinkingRef.current = true; blinkTypeRef.current = 'both'; blinkDurationRef.current = now; nextBehaviorRef.current = now + 2000 + Math.random() * 3000;
                } else if (roll < (isListening ? 0.7 : 0.8)) {
                    targetGazeRef.current = { x: (Math.random() - 0.5) * 12, y: (Math.random() - 0.5) * 4 }; nextBehaviorRef.current = now + 1000 + Math.random() * 1000;
                } else {
                    targetGazeRef.current = { x: 0, y: 0 }; nextBehaviorRef.current = now + 1000 + Math.random() * 2000;
                }
            }
            if (isBlinkingRef.current) {
                const blinkProgress = (now - blinkDurationRef.current) / 150;
                let mul = 1.0;
                if (blinkProgress >= 1) { isBlinkingRef.current = false; mul = 1.0; }
                else { mul = blinkProgress < 0.5 ? 1 - (blinkProgress * 2) : (blinkProgress - 0.5) * 2; }
                if (blinkTypeRef.current === 'both') { leftBlinkMul = mul; rightBlinkMul = mul; }
                else if (blinkTypeRef.current === 'left') { leftBlinkMul = mul; }
                else if (blinkTypeRef.current === 'right') { rightBlinkMul = mul; }
            }

            // --- 5. MOUTH PHONEME LOGIC ---
            if (isTalking && now > nextPhonemeTimeRef.current) {
                const phonemes = [
                    { w: 14, h: 8, r: 4 }, // A
                    { w: 16, h: 4, r: 2 }, // E
                    { w: 10, h: 6, r: 3 }, // I
                    { w: 8, h: 8, r: 4 }, // O
                    { w: 6, h: 5, r: 3 }, // U
                ];
                const p = phonemes[Math.floor(Math.random() * phonemes.length)];
                targetMouthRef.current = p;
                nextPhonemeTimeRef.current = now + 120 + Math.random() * 120;
            } else if (!isTalking) {
                targetMouthRef.current = { w: 12, h: 4, r: 2 };
            }

            // Smooth Mouth Lerp
            const mouthLerp = 0.2;
            const cMouth = smoothMouthRef.current!;
            cMouth[0] += (targetMouthRef.current.w - cMouth[0]) * mouthLerp; // W
            cMouth[1] += (targetMouthRef.current.h - cMouth[1]) * mouthLerp; // H
            cMouth[2] += (targetMouthRef.current.r - cMouth[2]) * mouthLerp; // R


            // --- 6. RENDER FACE ---
            ctx.clearRect(0, 0, width, height);

            // SHAKE EFFECT
            const shakeX = isShaking ? (Math.random() - 0.5) * 4 : 0;
            const shakeY = isShaking ? (Math.random() - 0.5) * 4 : 0;
            const finalCenterX = centerX + shakeX;
            const finalCenterY = centerY + shakeY;

            const eyeColor = actionColor || '#2c5bf6'; // Matches Landing Page Accent
            ctx.fillStyle = eyeColor;

            ctx.shadowColor = 'rgba(44, 91, 246, 0.4)'; // Match Landing Page Shadow
            ctx.shadowBlur = isLatchedOn ? 20 : 8; // Tighter shadow for physical look
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            const eyeWidth = 18;
            const maxEyeHeight = 26;
            const eyeSpacing = 44;
            const gazeX = activeGazeX;
            const gazeY = activeGazeY;

            const drawEye = (isRight: boolean) => {
                const openness = isRight ? activeEyeBase * rightBlinkMul : activeEyeBase * leftBlinkMul;
                const h = maxEyeHeight * Math.max(0.01, openness);
                const baseX = finalCenterX + (isRight ? 1 : -1) * (eyeSpacing / 2) - (eyeWidth / 2);
                const x = baseX + gazeX;
                const y = finalCenterY - 10 - (h / 2) + gazeY;
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, eyeWidth, h, 6);
                else ctx.rect(x, y, eyeWidth, h);
                ctx.fill();
            }
            drawEye(false); drawEye(true);

            // --- RENDER MOUTH ---
            ctx.fillStyle = actionColor || '#3b82f6';

            const mouthW = !isTalking ? cMouth[0] + Math.sin(now / 400) * 1.5 : cMouth[0];
            const mouthH = Math.min(cMouth[1], 8);
            const mouthR = cMouth[2];

            const idleMouthX = finalCenterX - (mouthW / 2) + (gazeX * 0.3);
            const idleMouthY = finalCenterY + 14 + (gazeY * 0.3) - (mouthH / 4);

            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(idleMouthX, idleMouthY, mouthW, mouthH, mouthR);
            } else {
                ctx.rect(idleMouthX, idleMouthY, mouthW, mouthH);
            }
            ctx.fill();

            animationFrameRef.current = requestAnimationFrame(renderLoop);
        };

        const cleanupAudio = () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
        renderLoop();
        return () => cleanupAudio();
    }, [isSpeaking, isThinking, actionColor, isShaking]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            window.close();
        }, 350);
    };

    return (
        <div
            className="assistant-popup"
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
            }}
        >
            <div className={isVisible ? 'assistant-animate-in' : 'assistant-animate-out'} style={{ transformOrigin: 'bottom center', overflow: 'visible' }}>
                <div
                    className="bot-container"
                    style={{
                        transform: (IS_DEMO_MODE || FORCE_FULL_SCREEN) ? `scale(${dynamicScale})` : 'none',
                        pointerEvents: 'auto',
                        WebkitAppRegion: (IS_DEMO_MODE || FORCE_FULL_SCREEN) ? 'drag' : undefined,
                        cursor: (IS_DEMO_MODE || FORCE_FULL_SCREEN) ? 'grab' : undefined,
                        filter: (IS_DEMO_MODE || FORCE_FULL_SCREEN) ? 'none' : undefined,
                        animation: (IS_DEMO_MODE || FORCE_FULL_SCREEN) ? 'none' : undefined,
                        overflow: 'visible',
                        position: 'relative'
                    } as React.CSSProperties}
                >
                    {/* Press F to Type Input Box */}
                    <div style={{
                        position: 'absolute',
                        bottom: '15px', // Fixed small offset
                        left: '50%',
                        transform: `translateX(-50%) translateY(${showInput ? '0' : '6px'})`,
                        width: '110px',
                        opacity: showInput ? 1 : 0,
                        pointerEvents: showInput ? 'auto' : 'none',
                        transition: 'opacity 0.15s ease-out, transform 0.15s ease-out', // Faster, specific props
                        zIndex: 1000,
                        WebkitAppRegion: 'no-drag'
                    } as React.CSSProperties}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyDown={handleTextInputKeyDown}
                            placeholder="Cmd..."
                            autoFocus={showInput}
                            style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.85)', // Slightly darker for contrast w/o heavy blur
                                border: '1px solid rgba(59, 130, 246, 0.4)',
                                borderRadius: '12px',
                                padding: '4px 8px',
                                color: '#fff',
                                fontSize: '11px',
                                outline: 'none',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                                backdropFilter: 'blur(4px)', // Reduced blur cost
                                textAlign: 'center'
                            }}
                        />
                    </div>

                    <div className="bot-antenna-container" style={{
                        overflow: 'visible',
                    }}>
                        <div className="bot-antenna-rod" />
                        <div ref={antennaTipRef} className="bot-antenna-tip" style={{
                            backfaceVisibility: 'hidden',
                            transform: 'translateZ(0)',
                        }} />
                        {/* Semi-hidden close button */}
                        <div
                            onClick={(e) => { e.stopPropagation(); handleClose(); }}
                            style={{
                                position: 'absolute',
                                right: -10,
                                top: 20,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.05)',
                                color: 'rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '12px',
                                zIndex: 100
                            }}
                        >
                            ×
                        </div>
                    </div>

                    <div className="bot-head" style={{
                        boxShadow: IS_DEMO_MODE ? 'none' : undefined,
                    }}>
                        <div className="bot-face">
                            <canvas ref={canvasRef} className="bot-canvas" />
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
};

