import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import {
    Save
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export const SettingsPage: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const [settings, setSettings] = useState<Record<string, string>>({
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        DEEPSEEK_API_KEY: ''
    });
    const [saving, setSaving] = useState(false);
    const [diagnostics, setDiagnostics] = useState<any>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const loadVoices = () => {
            const available = window.speechSynthesis.getVoices();
            setVoices(available);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, []);

    const handleTestVoice = () => {
        const uri = settings.TTS_VOICE_URI;
        const voice = voices.find(v => v.voiceURI === uri) || voices[0];
        if (voice) {
            const ut = new SpeechSynthesisUtterance("Hello, I am your Aibo Assistant.");
            ut.voice = voice;
            window.speechSynthesis.speak(ut);
        }
    };

    useEffect(() => {
        const fetchSettings = () => {
            fetch('/api/settings')
                .then(res => res.json())
                .then(data => setSettings(data))
                .catch(err => console.error('Failed to fetch settings:', err));
        };

        const fetchDiagnostics = () => {
            fetch('/api/health/diagnostics')
                .then(res => res.json())
                .then(data => setDiagnostics(data))
                .catch(err => console.error('Failed to fetch diagnostics:', err));
        };

        fetchSettings();
        fetchDiagnostics();
        const interval = setInterval(fetchDiagnostics, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                const fresh = await fetch('/api/settings').then(r => r.json());
                setSettings(fresh);
                alert('System preferences updated.');
            }
        } catch (e) {
            console.error('Failed to save settings:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page-container" style={{ gap: '16px' }}>

            {/* NEW CLEAN HEADER */}
            <div className="flex-row items-center justify-between mb-6 px-1">
                <div className="flex-row items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-active">Settings</h1>
                </div>
                <Button
                    className="h-8 px-4 flex-row items-center gap-2 font-bold bg-accent text-white hover:opacity-90"
                    onClick={handleSave}
                    disabled={saving}
                >
                    <Save size={14} />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </Button>
            </div>

            {/* 2-COLUMN SIDEBAR LAYOUT */}
            <div className="flex-row gap-6 flex-1 min-h-0">

                {/* SIDEBAR: Appearance & Status */}
                <div className="w-72 flex-col gap-4">

                    {/* Theme Toggle */}
                    <Card className="p-4" padding="md">
                        <div className="label-sm mb-3 uppercase opacity-60 px-1">Visual Theme</div>
                        <div className="flex-col gap-3">
                            <div className="panel-inset p-3 flex-row items-center justify-between">
                                <span className="text-sm font-bold text-active">Active Mode</span>
                                <span className="text-[10px] text-muted font-bold uppercase tracking-wider">{theme}</span>
                            </div>
                            <Button
                                variant="ghost"
                                className="w-full h-10 text-xs font-bold border border-bevel-light hover:bg-inset shadow-sm"
                                onClick={toggleTheme}
                            >
                                Switch to {theme === 'dark' ? 'Silver' : 'Titanium'}
                            </Button>
                        </div>
                    </Card>

                    {/* Status Overview */}
                    <Card className="p-4 flex-col gap-3" padding="md">
                        <div className="label-sm uppercase opacity-60 px-1">System Status</div>
                        <div className="panel-inset p-3 flex-col gap-2">
                            <div className="flex-row items-center justify-between">
                                <span className="text-xs font-medium text-secondary">Voice Engine</span>
                                <span className={`text-[10px] font-bold ${diagnostics?.services?.voiceBridge?.status?.includes('🟢') ? 'text-success' : 'text-danger'}`}>
                                    {diagnostics?.services?.voiceBridge?.status?.includes('🟢') ? 'Active' : 'Offline'}
                                </span>
                            </div>
                            <div className="flex-row items-center justify-between">
                                <span className="text-xs font-medium text-secondary">Data Link</span>
                                <span className={`text-[10px] font-bold ${diagnostics?.services?.rpc?.solana?.includes('🟢') ? 'text-success' : 'text-danger'}`}>
                                    {diagnostics?.services?.rpc?.solana?.includes('🟢') ? 'Stable' : 'Unstable'}
                                </span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* MAIN CONTENT: Config Panels */}
                <div className="flex-1 overflow-auto pr-2 flex-col gap-4">

                    {/* AI Configuration */}
                    <Card padding="md" className="flex-col">
                        <div className="label-sm mb-3 uppercase opacity-60 px-1">AI Configuration</div>
                        <div className="flex-col gap-4">
                            <div className="panel-inset p-4 flex-row items-center justify-between">
                                <div className="flex-col">
                                    <span className="text-sm font-bold text-active">Local Intelligence</span>
                                    <span className="text-xs text-muted">Use Ollama for local processing</span>
                                </div>
                                <div
                                    className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${settings.USE_LOCAL_BRAIN === 'true' ? 'bg-accent' : 'bg-muted/20'}`}
                                    onClick={() => setSettings({ ...settings, USE_LOCAL_BRAIN: settings.USE_LOCAL_BRAIN === 'true' ? 'false' : 'true' })}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-all ${settings.USE_LOCAL_BRAIN === 'true' ? 'right-1' : 'left-1'}`} />
                                </div>
                            </div>

                            <div className="flex-col gap-3">
                                {[
                                    { id: 'OPENAI_API_KEY', label: 'OpenAI API Key' },
                                    { id: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key' },
                                    { id: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key' },
                                ].map(key => (
                                    <div key={key.id} className="flex-col gap-1.5">
                                        <label className="text-[10px] font-bold text-muted uppercase px-1 tracking-wider">{key.label}</label>
                                        <input
                                            type="password"
                                            className="w-full h-10 px-3 rounded-xl text-xs text-active panel-inset focus:border-accent transition-colors"
                                            value={settings[key.id] || ''}
                                            onChange={(e) => setSettings({ ...settings, [key.id]: e.target.value })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* Personality & Voice */}
                    <Card padding="md" className="flex-col">
                        <div className="label-sm mb-3 uppercase opacity-60 px-1">Personality Tuning</div>
                        <div className="flex-col gap-4">
                            <div className="flex-col gap-2">
                                <label className="text-[10px] font-bold text-muted uppercase px-1 tracking-wider">System Prompt</label>
                                <textarea
                                    className="w-full bg-base text-xs text-active font-mono p-3 rounded-xl outline-none panel-inset resize-none leading-relaxed"
                                    style={{ height: '100px' }}
                                    value={settings.BRAIN_SYSTEM_PROMPT || ''}
                                    onChange={(e) => setSettings({ ...settings, BRAIN_SYSTEM_PROMPT: e.target.value })}
                                />
                            </div>

                            <div className="flex-col gap-2">
                                <label className="text-[10px] font-bold text-muted uppercase px-1 tracking-wider">Voice Character</label>
                                <div className="flex-row gap-2">
                                    <select
                                        className="flex-1 bg-base text-xs text-active font-medium outline-none panel-inset rounded-xl h-10 px-3"
                                        value={settings.TTS_VOICE_URI || ''}
                                        onChange={(e) => setSettings({ ...settings, TTS_VOICE_URI: e.target.value })}
                                    >
                                        <option value="">Default OS Voice</option>
                                        {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                                    </select>
                                    <Button variant="ghost" className="h-10 px-4 text-xs font-bold border border-bevel-light shadow-sm" onClick={handleTestVoice}>Test</Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
