import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, AlertCircle, MessageSquare, Bell, Settings as SettingsIcon, Shield, History, Cpu, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel, SectionTitle } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Switch } from '../components/ui/Switch';
import { EdgeTTS } from '../utils/edgeTTS';
import { DEFAULT_ENDPOINTS } from '../lib/constants';
import { API_BASE } from '../lib/api';
import { createLogger } from '../utils/logger';

// Sub-panels
import { ChannelsPanel } from '../components/settings/ChannelsPanel';
import { MonitoringPanel } from '../components/settings/MonitoringPanel';

const log = createLogger('SettingsPage');

type TabID = 'general' | 'advanced' | 'channels' | 'monitoring';

const MODEL_OPTIONS = [
    { value: 'deepseek-r1', label: 'DeepSeek R1', desc: 'Free, fast reasoning model', badge: 'Free' },
    { value: 'gpt-4o', label: 'GPT-4o', desc: 'OpenAI flagship model', badge: null },
    { value: 'claude-sonnet', label: 'Claude Sonnet', desc: 'Anthropic reasoning model', badge: null },
    { value: 'ollama', label: 'Local (Ollama)', desc: 'Run AI privately on your machine', badge: 'Private' },
];

export const SettingsPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabID>('general');
    const [settings, setSettings] = useState<Record<string, string>>({
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        DEEPSEEK_API_KEY: '',
        USE_LOCAL_BRAIN: 'false',
        OLLAMA_HOST: DEFAULT_ENDPOINTS.OLLAMA,
        OLLAMA_MODEL: 'llama3',
        DEFAULT_BRAIN_MODEL: 'deepseek-r1',
        BRAIN_TEMPERATURE: '0.7',
        BRAIN_SYSTEM_PROMPT: '',
        TTS_VOICE_URI: '',
        EDGE_TTS_VOICE: 'en-US-AnaNeural',
        CHAT_HISTORY_WINDOW_SIZE: '10',
        CHAT_MAX_TOKENS: '4000',
        CHAT_ENABLE_SUMMARIZATION: 'false'
    });
    const [initialSettings, setInitialSettings] = useState<Record<string, string>>({});
    const [savingSection, setSavingSection] = useState<string | null>(null);
    const [edgeTTSVoices, setEdgeTTSVoices] = useState<string[]>([]);

    useEffect(() => {
        const cuteVoices = EdgeTTS.getCuteVoices();
        setEdgeTTSVoices(cuteVoices);
    }, []);

    useEffect(() => {
        fetch(`${API_BASE}/api/settings`)
            .then(res => res.json())
            .then(data => {
                setSettings(prev => ({ ...prev, ...data }));
                setInitialSettings(data);
            })
            .catch(err => log.error('Failed to fetch settings:', err));
    }, []);

    const isSectionDirty = (keys: string[]) => {
        return keys.some(key => settings[key] !== (initialSettings[key] ?? ''));
    };

    const handleSaveSection = async (sectionId: string, keys: string[]) => {
        setSavingSection(sectionId);
        try {
            const updates = keys.reduce((acc, key) => {
                acc[key] = settings[key];
                return acc;
            }, {} as Record<string, string>);

            const res = await fetch(`${API_BASE}/api/settings/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                log.info(`Settings saved.`);
                setInitialSettings(prev => ({ ...prev, ...updates }));
            } else {
                setSavingSection(`${sectionId}:error`);
                setTimeout(() => setSavingSection(null), 3000);
            }
        } catch (e) {
            setSavingSection(`${sectionId}:error`);
            setTimeout(() => setSavingSection(null), 3000);
        }
        setTimeout(() => setSavingSection(null), 1500);
    };

    const handleTestVoice = async () => {
        const voice = settings.EDGE_TTS_VOICE || 'en-US-AnaNeural';
        try {
            const audioBuffer = await EdgeTTS.synthesize(
                "Voice synchronization successful. This is how I'll sound!",
                { voice, rate: '+10%', pitch: '+5Hz' }
            );
            const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onended = () => URL.revokeObjectURL(audioUrl);
            await audio.play();
        } catch (error) {
            log.error('Failed to test voice:', error);
        }
    };

    const StatusSaveButton = ({ sectionId, keys }: { sectionId: string, keys: string[] }) => {
        const isDirty = isSectionDirty(keys);
        const isSaving = savingSection === sectionId;
        const isError = savingSection === `${sectionId}:error`;

        return (
            <Button
                onClick={() => handleSaveSection(sectionId, keys)}
                disabled={!isDirty || (savingSection !== null && !isError)}
                variant={isError ? 'bevel' : isSaving ? 'bevel' : isDirty ? 'primary' : 'bevel'}
                size="sm"
                className={isError ? '!bg-red-500 !text-white !border-red-500 shadow-none' : isSaving ? '!bg-green-500 !text-white !border-green-500 shadow-none' : ''}
                icon={isError ? <AlertCircle size={12} strokeWidth={3} /> : isSaving ? <CheckCircle size={12} strokeWidth={3} /> : <Save size={12} strokeWidth={2.5} />}
            >
                {isError ? 'Failed' : isSaving ? 'Saved' : isDirty ? 'Save' : 'Saved'}
            </Button>
        );
    };

    const tabs: { id: TabID; label: string; icon: any }[] = [
        { id: 'general', label: 'General', icon: <SettingsIcon size={16} /> },
        { id: 'advanced', label: 'Advanced', icon: <Shield size={16} /> },
        { id: 'channels', label: 'Messaging', icon: <MessageSquare size={16} /> },
        { id: 'monitoring', label: 'Automation', icon: <Bell size={16} /> },
    ];

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-beige custom-scrollbar pb-10">
            <PageHeader
                title="Settings"
                subtitle="Customize your Aibo experience."
            />

            {/* Tab Switcher */}
            <div className="flex gap-2 p-1.5 bg-white/50 border border-black/5 rounded-2xl mb-8 w-fit shadow-sm">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab.id
                            ? 'bg-primary text-white shadow-button scale-105 z-10'
                            : 'text-text-muted hover:bg-white hover:text-primary'
                            }`}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* ─── GENERAL TAB ─── */}
                {activeTab === 'general' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
                        {/* Personality & Voice */}
                        <Panel className="p-6 flex flex-col gap-6 relative bg-white shadow-sm">
                            <SectionTitle
                                title="Personality & Voice"
                                icon="psychology"
                                action={<StatusSaveButton sectionId="personality" keys={['BRAIN_SYSTEM_PROMPT', 'EDGE_TTS_VOICE', 'BRAIN_TEMPERATURE']} />}
                            />

                            <Input
                                multiline
                                label="How should Aibo behave?"
                                description="Give Aibo a personality — friendly, formal, sarcastic, etc."
                                value={settings.BRAIN_SYSTEM_PROMPT}
                                onChange={e => setSettings({ ...settings, BRAIN_SYSTEM_PROMPT: e.target.value })}
                                placeholder="e.g. Be friendly and concise. Use casual language."
                            />

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold uppercase tracking-widest text-text-muted mb-2 block">Voice</label>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 h-10 text-xs font-bold appearance-none outline-none focus:ring-1 focus:ring-primary/20"
                                        value={settings.EDGE_TTS_VOICE}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings({ ...settings, EDGE_TTS_VOICE: e.target.value })}
                                    >
                                        {edgeTTSVoices.map(voice => (
                                            <option key={voice} value={voice}>
                                                {voice.replace('en-', '').replace('Neural', '').replace('-', ' ')}
                                            </option>
                                        ))}
                                    </select>
                                    <Button size="sm" variant="bevel" className="px-4" onClick={handleTestVoice}>Test</Button>
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex justify-between items-baseline">
                                    <h3 className="text-sm font-bold text-text-main tracking-tight">Intelligence Level</h3>
                                    <span className="text-[11px] font-semibold text-primary bg-primary/5 px-2.5 py-1 rounded-lg uppercase tracking-widest border border-primary/10 shadow-sm">
                                        {parseFloat(settings.BRAIN_TEMPERATURE) < 0.5 ? 'Precise' : parseFloat(settings.BRAIN_TEMPERATURE) > 1.2 ? 'Creative' : 'Balanced'}
                                    </span>
                                </div>
                                <div className="px-1">
                                    <input
                                        type="range" min="0" max="2" step="0.1"
                                        className="w-full accent-primary h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        value={settings.BRAIN_TEMPERATURE}
                                        onChange={e => setSettings({ ...settings, BRAIN_TEMPERATURE: e.target.value })}
                                    />
                                    <div className="flex justify-between mt-2 text-[10px] font-bold text-text-muted/30 uppercase tracking-[0.2em]">
                                        <span>Logical</span>
                                        <span>Imaginative</span>
                                    </div>
                                </div>
                            </div>
                        </Panel>

                        {/* Default AI Model */}
                        <Panel className="p-6 flex flex-col gap-6 relative bg-white shadow-sm">
                            <SectionTitle
                                title="Default AI Model"
                                icon="auto_awesome"
                                action={<StatusSaveButton sectionId="model" keys={['DEFAULT_BRAIN_MODEL']} />}
                            />

                            <p className="text-xs text-text-muted leading-relaxed -mt-2">
                                Choose which AI model powers Aibo's brain. DeepSeek is free and works out of the box.
                            </p>

                            <div className="space-y-3">
                                {MODEL_OPTIONS.map(model => (
                                    <button
                                        key={model.value}
                                        onClick={() => setSettings({ ...settings, DEFAULT_BRAIN_MODEL: model.value })}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${settings.DEFAULT_BRAIN_MODEL === model.value
                                            ? 'border-primary bg-primary/5 shadow-sm'
                                            : 'border-transparent bg-gray-50 hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className={`size-3 rounded-full ${settings.DEFAULT_BRAIN_MODEL === model.value ? 'bg-primary' : 'bg-gray-200'}`} />
                                                <span className="text-sm font-bold text-text-main tracking-tight">{model.label}</span>
                                            </div>
                                            {model.badge && (
                                                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg ${model.badge === 'Free' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                                                    {model.badge}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-text-muted ml-6 mt-1">{model.desc}</p>
                                    </button>
                                ))}
                            </div>

                            <p className="text-[10px] text-text-muted/50 font-medium">
                                Some models require API keys — configure them in the <button onClick={() => setActiveTab('advanced')} className="text-primary font-bold hover:underline">Advanced</button> tab.
                            </p>
                        </Panel>
                    </div>
                )}

                {/* ─── ADVANCED TAB ─── */}
                {activeTab === 'advanced' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
                        {/* API Keys */}
                        <Panel className="p-6 lg:col-span-2 relative bg-white shadow-sm">
                            <SectionTitle
                                title="API Keys"
                                icon="key"
                                action={<StatusSaveButton sectionId="keys" keys={['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY']} />}
                            />
                            <p className="text-xs text-text-muted mt-1 mb-4">Only needed if you want to use a specific model. DeepSeek works without a key.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[
                                    { id: 'OPENAI_API_KEY', label: 'OpenAI (GPT-4)', icon: 'auto_awesome' },
                                    { id: 'ANTHROPIC_API_KEY', label: 'Anthropic (Claude)', icon: 'token' },
                                    { id: 'DEEPSEEK_API_KEY', label: 'DeepSeek (Coder)', icon: 'memory' }
                                ].map(key => (
                                    <Input
                                        key={key.id}
                                        label={key.label}
                                        type="password"
                                        value={settings[key.id]}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, [key.id]: e.target.value })}
                                        placeholder="sk-••••••••"
                                    />
                                ))}
                            </div>
                        </Panel>

                        {/* Local AI Processing */}
                        <Panel className="p-6 flex flex-col gap-6 relative bg-white shadow-sm">
                            <SectionTitle
                                title="Local AI Processing"
                                icon="lock"
                                action={<StatusSaveButton sectionId="local" keys={['USE_LOCAL_BRAIN', 'OLLAMA_HOST', 'OLLAMA_MODEL']} />}
                            />

                            <Switch
                                label="Local Processing Mode"
                                description="Run AI queries privately on your machine using Ollama."
                                enabled={settings.USE_LOCAL_BRAIN === 'true'}
                                onChange={(enabled: boolean) => setSettings({ ...settings, USE_LOCAL_BRAIN: enabled ? 'true' : 'false' })}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Ollama Host"
                                    value={settings.OLLAMA_HOST}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, OLLAMA_HOST: e.target.value })}
                                />
                                <Input
                                    label="Model Name"
                                    value={settings.OLLAMA_MODEL}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, OLLAMA_MODEL: e.target.value })}
                                />
                            </div>
                        </Panel>

                        {/* Brain Engine (inlined from AdvancedChatPanel) */}
                        <Panel className="p-6 flex flex-col gap-6 relative bg-white shadow-sm">
                            <SectionTitle
                                title="Brain Engine"
                                icon="memory"
                                action={<StatusSaveButton sectionId="engine" keys={['CHAT_HISTORY_WINDOW_SIZE', 'CHAT_MAX_TOKENS', 'CHAT_ENABLE_SUMMARIZATION']} />}
                            />

                            {/* History Window */}
                            <div className="flex items-start gap-4">
                                <div className="size-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                    <History size={18} />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-text-main mb-0.5">History Window</h4>
                                        <p className="text-[11px] text-text-muted/60 leading-relaxed">Messages included in each query. More = better context.</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range" min="1" max="50" step="1"
                                            className="flex-1 accent-primary h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                                            value={settings.CHAT_HISTORY_WINDOW_SIZE}
                                            onChange={e => setSettings({ ...settings, CHAT_HISTORY_WINDOW_SIZE: e.target.value })}
                                        />
                                        <span className="w-10 text-center text-sm font-mono font-bold text-primary bg-primary/5 py-1 rounded-lg border border-primary/10">
                                            {settings.CHAT_HISTORY_WINDOW_SIZE}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Max Tokens */}
                            <div className="flex items-start gap-4">
                                <div className="size-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                    <Cpu size={18} />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-text-main mb-0.5">Max Context Tokens</h4>
                                        <p className="text-[11px] text-text-muted/60 leading-relaxed">Token limit per request. Older history gets trimmed.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Input
                                            type="number"
                                            value={settings.CHAT_MAX_TOKENS}
                                            onChange={e => setSettings({ ...settings, CHAT_MAX_TOKENS: e.target.value })}
                                            placeholder="4000"
                                        />
                                        <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                                ~{Math.round((parseInt(settings.CHAT_MAX_TOKENS) || 0) * 0.75)} words
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summarization */}
                            <div className="flex items-start gap-4">
                                <div className="size-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                                    <ShieldAlert size={18} />
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className="text-sm font-bold text-text-main">Auto-Summarization</h4>
                                        <Switch
                                            enabled={settings.CHAT_ENABLE_SUMMARIZATION === 'true'}
                                            onChange={val => setSettings({ ...settings, CHAT_ENABLE_SUMMARIZATION: String(val) })}
                                        />
                                    </div>
                                    <p className="text-[11px] text-text-muted/60 leading-relaxed">Compress long conversations automatically to stay within token limits.</p>
                                </div>
                            </div>
                        </Panel>
                    </div>
                )}

                {/* ─── MESSAGING TAB ─── */}
                {activeTab === 'channels' && <ChannelsPanel />}

                {/* ─── AUTOMATION TAB ─── */}
                {activeTab === 'monitoring' && <MonitoringPanel />}
            </div>
        </div>
    );
};
