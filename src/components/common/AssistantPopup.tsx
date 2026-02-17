import { useCallback, useEffect, useRef, useState } from 'react';
import { createLogger } from '../../utils/logger';
import { EdgeTTS } from '../../utils/edgeTTS';
import { API_BASE, WS_BASE } from '../../lib/api';

const log = createLogger('AssistantPopup');

export const AssistantPopup = () => {
    const [agentAction, setAgentAction] = useState<{ action: string; data: Record<string, unknown> } | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const antennaTipRef = useRef<HTMLDivElement>(null);
    const antennaContainerRef = useRef<HTMLDivElement>(null);
    const botContainerRef = useRef<HTMLDivElement>(null);
    const hoverFrameRef = useRef(0);

    // Face State Refs
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    const [isVisible, setIsVisible] = useState(true);

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const recordingStartTimeRef = useRef<number>(0);

    // Active audio ref for interrupting speech
    const activeAudioRef = useRef<HTMLAudioElement | null>(null);
    // Generation counter to prevent overlapping speech
    const speakGenRef = useRef(0);
    // Audio queue for streaming sentence-by-sentence playback
    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlayingQueueRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const playNextChunkRef = useRef<() => void>(() => {});

    // Hybrid Interaction State
    const [showInput, setShowInput] = useState(false);
    const [textInput, setTextInput] = useState('');

    // Agent Action State
    const [actionColor, setActionColor] = useState<string | null>(null);
    const [isShaking, setIsShaking] = useState(false);

    // WebSocket for Agent Actions
    useEffect(() => {
        let socket: WebSocket | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout>;

        const connect = () => {
            log.debug('Connecting to Agent Action WebSocket...');
            socket = new WebSocket(`${WS_BASE}/ws/voice`);

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'agent_action') {
                        log.debug('Received Agent Action:', data);
                        setAgentAction(data);
                    }
                } catch (e) {
                    log.error('Failed to parse socket message', e);
                }
            };

            socket.onclose = () => {
                log.debug('Agent Action WebSocket closed. Reconnecting...');
                reconnectTimer = setTimeout(connect, 3000);
            };

            socket.onerror = (err) => {
                log.error('Agent Action WebSocket error', err);
                socket?.close();
            };
        };

        connect();

        return () => {
            if (socket) socket.close();
            clearTimeout(reconnectTimer);
        };
    }, []);

    useEffect(() => {
        if (!agentAction) return;

        if (agentAction.action === 'set_status_color') {
            const { color, duration = 5000 } = agentAction.data as { color: string; duration?: number };
            setActionColor(color);
            const timer = setTimeout(() => {
                setActionColor(null);
                setAgentAction(null);
            }, duration);
            return () => clearTimeout(timer);
        }

        if (agentAction.action === 'vibrate_mascot') {
            const { intensity = 'medium' } = agentAction.data as { intensity?: 'low' | 'medium' | 'high' };
            setIsShaking(true);
            const duration = intensity === 'high' ? 1500 : 800;
            const timer = setTimeout(() => {
                setIsShaking(false);
                setAgentAction(null);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [agentAction]);

    // Behavior Logic
    const nextBehaviorRef = useRef<number>(0);
    useEffect(() => {
        nextBehaviorRef.current = Date.now() + 1000;
    }, []);
    const isBlinkingRef = useRef(false);
    const blinkTypeRef = useRef<'both' | 'left' | 'right'>('both');
    const blinkDurationRef = useRef<number>(0);
    const targetGazeRef = useRef({ x: 0, y: 0 });
    const antennaTiltRef = useRef(0);
    const antennaFrameRef = useRef(0);

    // Dynamic scaling based on window height
    const [dynamicScale, setDynamicScale] = useState(2.0);
    const preferredVoiceURIRef = useRef<string | null>(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/settings`)
            .then(res => res.json())
            .then(data => {
                // Use Edge TTS voice from settings
                if (data.EDGE_TTS_VOICE) {
                    preferredVoiceURIRef.current = data.EDGE_TTS_VOICE;
                }
            })
            .catch(() => { });
    }, []);

    const stopSpeaking = useCallback(() => {
        speakGenRef.current++;
        if (activeAudioRef.current) {
            activeAudioRef.current.pause();
            activeAudioRef.current.src = '';
            activeAudioRef.current = null;
        }
        audioQueueRef.current = [];
        isPlayingQueueRef.current = false;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsSpeaking(false);
    }, []);

    const speak = useCallback(async (text: string) => {
        // Interrupt any ongoing speech
        stopSpeaking();
        // Bump generation so any in-flight synthesis from a previous call is discarded
        const gen = ++speakGenRef.current;
        setIsSpeaking(true);
        try {
            const voice = preferredVoiceURIRef.current || 'en-US-AnaNeural';
            log.debug(`Speaking with Edge TTS: "${text.substring(0, 50)}..." (voice: ${voice})`);

            const audioBuffer = await EdgeTTS.synthesize(text, { voice });

            // If a newer speak() was called while we were synthesizing, discard this one
            if (gen !== speakGenRef.current) {
                setIsSpeaking(false);
                return;
            }

            const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);

            const audio = new Audio(audioUrl);
            activeAudioRef.current = audio;
            audio.onended = () => {
                if (activeAudioRef.current === audio) {
                    activeAudioRef.current = null;
                    setIsSpeaking(false);
                }
                URL.revokeObjectURL(audioUrl);
            };
            audio.onerror = (err) => {
                log.error('Audio playback error', err);
                if (activeAudioRef.current === audio) {
                    activeAudioRef.current = null;
                    setIsSpeaking(false);
                }
                URL.revokeObjectURL(audioUrl);
            };

            await audio.play();
        } catch (error) {
            log.error('TTS Error', error);
            if (gen === speakGenRef.current) setIsSpeaking(false);
        }
    }, [stopSpeaking]);

    // Play queued audio chunks sequentially (sentence-by-sentence streaming)
    const playNextChunk = useCallback(() => {
        if (audioQueueRef.current.length === 0) {
            isPlayingQueueRef.current = false;
            setIsSpeaking(false);
            return;
        }
        isPlayingQueueRef.current = true;
        const audioData = audioQueueRef.current.shift()!;
        const blob = new Blob([audioData], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        activeAudioRef.current = audio;
        setIsSpeaking(true);

        const onFinish = () => {
            URL.revokeObjectURL(url);
            if (activeAudioRef.current === audio) activeAudioRef.current = null;
            playNextChunkRef.current();
        };
        audio.onended = onFinish;
        audio.onerror = onFinish;
        audio.play().catch(onFinish);
    }, []);
    playNextChunkRef.current = playNextChunk;

    // Stream AI response: brain text → sentence chunks → TTS audio played incrementally
    const streamAiQuery = useCallback(async (transcript: string) => {
        stopSpeaking();
        const gen = ++speakGenRef.current;
        setIsThinking(true);
        audioQueueRef.current = [];
        isPlayingQueueRef.current = false;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const voice = preferredVoiceURIRef.current || 'en-US-AnaNeural';
            const response = await fetch(`${API_BASE}/api/ai/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript, voice }),
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                throw new Error('Stream request failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                if (gen !== speakGenRef.current) break;
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                while (buffer.includes('\n\n')) {
                    const idx = buffer.indexOf('\n\n');
                    const eventStr = buffer.substring(0, idx);
                    buffer = buffer.substring(idx + 2);

                    for (const line of eventStr.split('\n')) {
                        if (!line.startsWith('data: ')) continue;
                        try {
                            const event = JSON.parse(line.substring(6));

                            if (event.type === 'thinking') {
                                setIsThinking(true);
                            } else if (event.type === 'audio' && gen === speakGenRef.current) {
                                setIsThinking(false);
                                // Decode base64 to ArrayBuffer
                                const binary = atob(event.audio);
                                const bytes = new Uint8Array(binary.length);
                                for (let i = 0; i < binary.length; i++) {
                                    bytes[i] = binary.charCodeAt(i);
                                }
                                audioQueueRef.current.push(bytes.buffer);
                                if (!isPlayingQueueRef.current) {
                                    playNextChunk();
                                }
                            } else if (event.type === 'done') {
                                setIsThinking(false);
                                if (!isPlayingQueueRef.current && audioQueueRef.current.length === 0) {
                                    setIsSpeaking(false);
                                }
                            } else if (event.type === 'error') {
                                setIsThinking(false);
                                speak("I lost connection to my logic core.");
                            }
                        } catch { /* ignore malformed events */ }
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') return;
            log.error('AI Stream failed', err);
            if (gen === speakGenRef.current) {
                setIsThinking(false);
                speak("I lost connection to my logic core.");
            }
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        }
    }, [stopSpeaking, playNextChunk, speak]);

    const handleAiQuery = useCallback(async (transcript: string) => {
        log.debug('Sending to AI Brain', transcript);
        streamAiQuery(transcript);
    }, [streamAiQuery]);

    // --- Voice Recording ---
    const startRecording = useCallback(async () => {
        if (mediaRecorderRef.current || isRecording) return;
        // Interrupt any ongoing speech so the mic doesn't pick it up
        stopSpeaking();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            streamRef.current = stream;
            audioChunksRef.current = [];

            const recorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus' : 'audio/webm'
            });

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const duration = (Date.now() - recordingStartTimeRef.current) / 1000;

                streamRef.current?.getTracks().forEach(t => t.stop());
                streamRef.current = null;
                mediaRecorderRef.current = null;

                if (duration < 0.8) {
                    log.debug(`Recording too short (${duration.toFixed(1)}s), skipping`);
                    return;
                }

                log.debug(`Processing ${duration.toFixed(1)}s of audio (${blob.size} bytes)...`);
                setIsProcessing(true);
                setIsThinking(true);
                try {
                    // Step 1: Transcribe (fast — Deepgram ~1-2s)
                    const formData = new FormData();
                    formData.append('audio', blob, 'recording.webm');
                    const transcribeRes = await fetch(`${API_BASE}/api/voice/transcribe`, {
                        method: 'POST',
                        body: formData,
                    });
                    const { transcript, confidence } = await transcribeRes.json();
                    log.debug(`Transcribed: "${transcript}" (confidence: ${confidence})`);

                    if (!transcript || !transcript.trim()) {
                        setIsThinking(false);
                        setIsProcessing(false);
                        return;
                    }

                    // Step 2: Stream AI response + TTS (brain thinks → sentences → audio chunks)
                    await streamAiQuery(transcript);
                } catch (err) {
                    log.error('Voice pipeline failed', err);
                    setIsThinking(false);
                    speak("My ears aren't working right now.");
                } finally {
                    setIsProcessing(false);
                }
            };

            recorder.start(); // single chunk on stop = always valid WebM container
            mediaRecorderRef.current = recorder;
            recordingStartTimeRef.current = Date.now();
            setIsRecording(true);
            log.debug('Recording started');
        } catch (err) {
            log.error('Mic access failed', err);
        }
    }, [isRecording, streamAiQuery, speak, stopSpeaking]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            // requestData() flushes any buffered audio before stop() finalizes the WebM container
            mediaRecorderRef.current.requestData();
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            window.electronAPI?.globalRecordingStopped();
            log.debug('Recording stopped');
        }
    }, []);

    // Cleanup mic on unmount
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // Global push-to-talk: triggered by system-wide Cmd+Shift+Space via Electron IPC
    // Toggle mode: first press starts recording, second press stops it
    useEffect(() => {
        const api = window.electronAPI;
        if (!api?.onGlobalPushToTalk) return;
        api.onGlobalPushToTalk((action) => {
            if (action === 'start') {
                startRecording();
            } else {
                stopRecording();
            }
        });
    }, [startRecording, stopRecording]);

    // Keyboard Listener for 'F' to toggle input + Space push-to-talk
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'f' && document.activeElement?.tagName !== 'INPUT') {
                setShowInput(prev => !prev);
            }
            if (e.key === 'Escape') {
                setShowInput(false);
            }
            // Space = push-to-talk (hold)
            if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
                e.preventDefault();
                startRecording();
            }
        };

        const handleGlobalKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT') {
                e.preventDefault();
                stopRecording();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('keyup', handleGlobalKeyUp);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('keyup', handleGlobalKeyUp);
        };
    }, [startRecording, stopRecording]);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (showInput && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [showInput]);

    const handleTextInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && textInput.trim()) {
            handleAiQuery(textInput);
            setTextInput('');
            setShowInput(false);
        }
    };

    // Scale to fill window on mount
    useEffect(() => {
        const h = window.innerHeight;
        setDynamicScale((h * 0.85) / 150);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const zoom = 1.2;
        const superSample = 1.0;

        const rect = canvas.getBoundingClientRect();
        const baseW = canvas.offsetWidth || rect.width;
        const baseH = canvas.offsetHeight || rect.height;

        canvas.width = baseW * dpr * zoom * superSample;
        canvas.height = baseH * dpr * zoom * superSample;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr * zoom * superSample, dpr * zoom * superSample);
            ctx.imageSmoothingEnabled = false;
        }

        const renderLoop = () => {
            if (!canvas || !ctx) return;
            // Skip rendering when window is hidden to save CPU
            if (document.hidden) return;

            const width = baseW;
            const height = baseH;
            const centerX = width / 2;
            const centerY = height / 2;
            const now = Date.now();

            // --- 1. VOLUME INPUT ---
            let rawVolume = 0;
            const isTalking = isSpeaking;

            if (isSpeaking) {
                const syllables = Math.abs(Math.sin(now / 80));
                rawVolume = (0.3 + (syllables * 0.5));
            }

            // --- 2. LATCH LOGIC ---
            const VOICE_THRESHOLD = 0.02;
            const HOLD_TIME_MS = 600;

            if (rawVolume > VOICE_THRESHOLD) {
                lastVoiceTimeRef.current = now;
            }

            const timeSinceVoice = now - lastVoiceTimeRef.current;
            const isLatchedOn = timeSinceVoice < HOLD_TIME_MS || isSpeaking;

            const visualVol = Math.min(rawVolume * 5.0, 1.0);

            // --- 3. THINKING DYNAMICS ---
            if (isThinking) {
                const thinkPeriod = now / 400;
                targetGazeRef.current = {
                    x: Math.cos(thinkPeriod) * 8,
                    y: Math.sin(thinkPeriod) * 3
                };
            }

            // --- PIXELATED DYNAMICS (snap, no interpolation) ---
            if (!smoothBrightnessRef.current) smoothBrightnessRef.current = new Float32Array(1);
            if (!smoothEyeBaseRef.current) smoothEyeBaseRef.current = new Float32Array([1.0]);
            if (!smoothGazeRef.current) smoothGazeRef.current = new Float32Array([0, 0]);
            if (!smoothHueRef.current) smoothHueRef.current = new Float32Array([0]);
            if (!smoothMouthRef.current) smoothMouthRef.current = new Float32Array([12, 4, 2]);

            const activeBrightness = isLatchedOn ? Math.max(0.6, visualVol) : 0.0;
            smoothBrightnessRef.current[0] = activeBrightness;

            const activeEyeBase = isLatchedOn ? 1.0 + (activeBrightness * 0.25) : 1.0;
            smoothEyeBaseRef.current[0] = activeEyeBase;

            const activeGazeX = Math.round(targetGazeRef.current.x);
            const activeGazeY = Math.round(targetGazeRef.current.y);
            smoothGazeRef.current[0] = activeGazeX;
            smoothGazeRef.current[1] = activeGazeY;

            // --- REACTIVE ANTENNA GLOW ---
            if (antennaTipRef.current) {
                const isSilentListening = isRecording;
                const isThinkingPulse = isThinking || isProcessing;
                const pulse = isSilentListening ? (Math.sin(now / 200) * 0.2 + 0.8) :
                    isThinkingPulse ? (Math.sin(now / 80) * 0.4 + 0.6) : 1.0;

                let hue;
                if (isRecording) {
                    hue = 0; // Red when recording
                } else if (actionColor) {
                    hue = actionColor.includes('ff4d4d') ? 0 : 120;
                } else {
                    hue = Math.round(activeBrightness * 35 + ((isThinking || isProcessing) ? 200 : 0));
                    smoothHueRef.current![0] = hue;
                }

                const lightness = 50 * pulse;
                const saturation = 100;
                const unifiedColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

                antennaTipRef.current.style.background = unifiedColor;
                antennaTipRef.current.style.boxShadow = isSilentListening ? `0 0 10px ${unifiedColor}` : 'none';
                antennaTipRef.current.style.filter = 'none';
                antennaTipRef.current.style.transform = 'translateX(-50%)';
                antennaTipRef.current.style.opacity = '1';
                antennaTipRef.current.style.border = 'none';
            }

            // --- HOVER BOB & SHAKE ---
            const HOVER_FRAMES = [0, 0, -1, -1, -2, -2, -1, -1, 0, 0, 1, 1, 2, 2, 1, 1];
            hoverFrameRef.current = (hoverFrameRef.current + 1) % HOVER_FRAMES.length;
            const hoverY = HOVER_FRAMES[hoverFrameRef.current];
            if (botContainerRef.current) {
                const shakeX = isShaking ? Math.round((Math.random() - 0.5) * 6) : 0;
                botContainerRef.current.style.transform = `translateY(${hoverY}px) scale(${dynamicScale}) translateX(${shakeX}px)`;
            }

            // --- ANTENNA SWAY ---
            if (antennaContainerRef.current) {
                const IDLE_SWAY = [-2, -3, -2, -1, 0, 1, 2, 3, 4, 3, 2, 1, 0, -1, -3, -4, -3, -1, 0, 2, 3, 2, 0, -1];
                const THINK_SWAY = [-4, -1, 3, 0, -3, 2, 4, -2, 1, -4, 3, -1];
                const SPEAK_SWAY = [-3, 3, -4, 4, -2, 3, -3, 2, -4, 4, -2, 2];

                const pattern = isSpeaking ? SPEAK_SWAY : isThinking ? THINK_SWAY : IDLE_SWAY;
                antennaFrameRef.current = (antennaFrameRef.current + 1) % pattern.length;
                const sway = pattern[antennaFrameRef.current];

                const gazeDir = targetGazeRef.current.x;
                let gazeBias = 0;
                if (gazeDir < -3) gazeBias = -3;
                else if (gazeDir < -1) gazeBias = -1;
                else if (gazeDir > 3) gazeBias = 3;
                else if (gazeDir > 1) gazeBias = 1;

                antennaTiltRef.current = Math.max(-10, Math.min(10, sway + gazeBias));
                antennaContainerRef.current.style.transform = `rotate(${antennaTiltRef.current}deg)`;
                antennaContainerRef.current.style.transformOrigin = 'bottom center';
            }

            // --- 4. BEHAVIOR LOGIC ---
            let leftBlinkMul = 1.0;
            let rightBlinkMul = 1.0;

            if (!isBlinkingRef.current && now > nextBehaviorRef.current) {
                const roll = Math.random();
                const isListening = isLatchedOn;
                if (roll < (isListening ? 0.2 : 0.4)) {
                    isBlinkingRef.current = true;
                    blinkTypeRef.current = 'both';
                    blinkDurationRef.current = now;
                    nextBehaviorRef.current = now + 4000 + Math.random() * 5000;
                } else if (roll < (isListening ? 0.5 : 0.65)) {
                    targetGazeRef.current = { x: Math.round((Math.random() - 0.5) * 12), y: Math.round((Math.random() - 0.5) * 4) };
                    nextBehaviorRef.current = now + 3000 + Math.random() * 3000;
                } else {
                    targetGazeRef.current = { x: 0, y: 0 };
                    nextBehaviorRef.current = now + 3000 + Math.random() * 4000;
                }
            }
            if (isBlinkingRef.current) {
                const elapsed = now - blinkDurationRef.current;
                let mul = 1.0;
                if (elapsed >= 500) {
                    isBlinkingRef.current = false;
                } else {
                    const progress = elapsed / 500;
                    if (progress < 0.25) mul = 0.5;
                    else if (progress < 0.5) mul = 0.05;
                    else if (progress < 0.75) mul = 0.5;
                    else mul = 1.0;
                }
                if (blinkTypeRef.current === 'both') { leftBlinkMul = mul; rightBlinkMul = mul; }
                else if (blinkTypeRef.current === 'left') { leftBlinkMul = mul; }
                else if (blinkTypeRef.current === 'right') { rightBlinkMul = mul; }
            }

            // --- 5. MOUTH PHONEME LOGIC ---
            if (isTalking && now > nextPhonemeTimeRef.current) {
                const phonemes = [
                    { w: 14, h: 8, r: 4 },
                    { w: 16, h: 4, r: 2 },
                    { w: 10, h: 6, r: 3 },
                    { w: 8, h: 8, r: 4 },
                    { w: 6, h: 5, r: 3 },
                ];
                const p = phonemes[Math.floor(Math.random() * phonemes.length)];
                targetMouthRef.current = p;
                nextPhonemeTimeRef.current = now + 120 + Math.random() * 120;
            } else if (!isTalking) {
                targetMouthRef.current = { w: 12, h: 4, r: 2 };
            }

            const cMouth = smoothMouthRef.current!;
            cMouth[0] = targetMouthRef.current.w;
            cMouth[1] = targetMouthRef.current.h;
            cMouth[2] = targetMouthRef.current.r;

            // --- 6. RENDER FACE ---
            ctx.clearRect(0, 0, width, height);

            const shakeX = isShaking ? Math.round((Math.random() - 0.5) * 4) : 0;
            const shakeY = isShaking ? Math.round((Math.random() - 0.5) * 4) : 0;
            const finalCenterX = Math.round(centerX) + shakeX;
            const finalCenterY = Math.round(centerY) + shakeY;

            const eyeColor = actionColor || '#3b82f6';
            ctx.fillStyle = eyeColor;

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            const eyeWidth = 18;
            const maxEyeHeight = 26;
            const eyeSpacing = 44;
            const gazeX = activeGazeX;
            const gazeY = activeGazeY;

            const drawEye = (isRight: boolean) => {
                const openness = isRight ? activeEyeBase * rightBlinkMul : activeEyeBase * leftBlinkMul;
                const h = Math.round(maxEyeHeight * Math.max(0.01, openness));
                const baseX = Math.round(finalCenterX + (isRight ? 1 : -1) * (eyeSpacing / 2) - (eyeWidth / 2));
                const x = baseX + gazeX;
                const y = Math.round(finalCenterY - 10 - (h / 2) + gazeY);
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, eyeWidth, h, 6);
                else ctx.rect(x, y, eyeWidth, h);
                ctx.fill();
            };
            drawEye(false); drawEye(true);

            // --- RENDER MOUTH ---
            ctx.fillStyle = actionColor || '#3b82f6';

            const mouthW = Math.round(cMouth[0]);
            const mouthH = Math.round(Math.min(cMouth[1], 8));

            const mouthX = Math.round(finalCenterX - (mouthW / 2) + (gazeX * 0.3));
            const mouthY = Math.round(finalCenterY + 14 + (gazeY * 0.3) - (mouthH / 4));

            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(mouthX, mouthY, mouthW, mouthH, Math.round(cMouth[2]));
            } else {
                ctx.rect(mouthX, mouthY, mouthW, mouthH);
            }
            ctx.fill();

        };

        renderLoop();
        intervalRef.current = setInterval(renderLoop, 125);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isSpeaking, isThinking, isRecording, isProcessing, actionColor, isShaking]);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            window.close();
        }, 350);
    };

    // Manual drag — transparent macOS windows don't support -webkit-app-region: drag
    const isDraggingRef = useRef(false);

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        // Don't drag from input or close button
        if ((e.target as HTMLElement).closest('.no-drag-zone')) return;
        isDraggingRef.current = true;
        (window as any).electronAPI?.startDrag(e.screenX, e.screenY);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            (window as any).electronAPI?.dragMove(e.screenX, e.screenY);
        };
        const handleMouseUp = () => {
            isDraggingRef.current = false;
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    return (
        <div
            className="assistant-popup"
            data-route="assistant"
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'visible',
            }}
        >
            <div
                className={isVisible ? 'assistant-animate-in' : 'assistant-animate-out'}
                style={{
                    transformOrigin: 'bottom center',
                    overflow: 'visible',
                    opacity: isVisible ? undefined : 0,
                    transform: isVisible ? undefined : 'scale(0.8) translateY(20px)'
                }}
            >
                <div
                    ref={botContainerRef}
                    className={`bot-container ${isThinking ? 'bot-thinking-glow' : ''}`}
                    onMouseDown={handleDragStart}
                    style={{
                        transform: `translateY(0px) scale(${dynamicScale})`,
                        pointerEvents: 'auto',
                        cursor: 'grab',
                        filter: 'none',
                        animation: 'none',
                        overflow: 'visible',
                        position: 'relative'
                    } as React.CSSProperties}
                >
                    {/* Press F to Type Input Box */}
                    <div className="no-drag-zone" style={{
                        position: 'absolute',
                        bottom: '15px',
                        left: '50%',
                        transform: `translateX(-50%) translateY(${showInput ? '0' : '6px'})`,
                        width: '110px',
                        opacity: showInput ? 1 : 0,
                        pointerEvents: showInput ? 'auto' : 'none',
                        transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
                        zIndex: 1000,
                    }}>
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
                                background: 'rgba(0,0,0,0.85)',
                                border: '1px solid rgba(59, 130, 246, 0.4)',
                                borderRadius: '12px',
                                padding: '4px 8px',
                                color: '#fff',
                                fontSize: '11px',
                                outline: 'none',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                                backdropFilter: 'blur(4px)',
                                textAlign: 'center'
                            }}
                        />
                    </div>

                    <div ref={antennaContainerRef} className="bot-antenna-container" style={{
                        overflow: 'visible',
                    }}>
                        <div className="bot-antenna-rod" />
                        <div ref={antennaTipRef} className="bot-antenna-tip" style={{
                            backfaceVisibility: 'hidden',
                            transform: 'translateZ(0)',
                        }} />
                        {/* Close button */}
                        <div
                            className="no-drag-zone"
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

                    <div className="bot-head">
                        <div className="bot-face">
                            <canvas ref={canvasRef} className="bot-canvas" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
