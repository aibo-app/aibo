import React, { useState, useEffect } from 'react';
import { Panel, SectionTitle } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { API_BASE } from '../../lib/api';
import { createLogger } from '../../utils/logger';
import { History, MessageSquare, ShieldAlert, Cpu, Save, CheckCircle } from 'lucide-react';

const log = createLogger('AdvancedChatPanel');

export const AdvancedChatPanel: React.FC = () => {
    const [settings, setSettings] = useState({
        CHAT_HISTORY_WINDOW_SIZE: '10',
        CHAT_MAX_TOKENS: '4000',
        CHAT_ENABLE_SUMMARIZATION: 'false'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/settings`);
            const data = await res.json();
            setSettings(prev => ({
                ...prev,
                CHAT_HISTORY_WINDOW_SIZE: data.CHAT_HISTORY_WINDOW_SIZE || '10',
                CHAT_MAX_TOKENS: data.CHAT_MAX_TOKENS || '4000',
                CHAT_ENABLE_SUMMARIZATION: data.CHAT_ENABLE_SUMMARIZATION || 'false'
            }));
        } catch (error) {
            log.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/settings/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                log.info('Chat settings saved.');
            }
        } catch (error) {
            log.error('Failed to save chat settings:', error);
        } finally {
            setTimeout(() => setSaving(false), 1000);
        }
    };

    if (loading) return (
        <Panel className="p-8 flex items-center justify-center min-h-[300px]">
            <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </Panel>
    );

    return (
        <Panel className="p-6 bg-white shadow-sm border-black/5 overflow-hidden relative">
            <SectionTitle
                title="Cognitive Buffer"
                icon="memory"
                action={
                    <Button
                        variant={saving ? 'bevel' : 'primary'}
                        size="sm"
                        className={`h-8 gap-1.5 transition-all ${saving ? '!bg-green-500 !text-white' : ''}`}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? <CheckCircle size={14} /> : <Save size={14} />}
                        <span>{saving ? 'Applied' : 'Save'}</span>
                    </Button>
                }
            />

            <div className="mt-8 space-y-8 max-w-2xl">
                {/* Window Size */}
                <div className="flex items-start gap-6">
                    <div className="size-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <History size={20} />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div>
                            <h4 className="text-sm font-bold text-text-main mb-1">History Window Size</h4>
                            <p className="text-xs text-text-muted/60 leading-relaxed">Number of past messages included in new queries. Larger window provides more context but uses more tokens.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="range" min="1" max="50" step="1"
                                className="flex-1 accent-primary h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                                value={settings.CHAT_HISTORY_WINDOW_SIZE}
                                onChange={e => setSettings({ ...settings, CHAT_HISTORY_WINDOW_SIZE: e.target.value })}
                            />
                            <span className="w-12 text-center text-sm font-mono font-bold text-primary bg-primary/5 py-1 rounded-lg border border-primary/10">
                                {settings.CHAT_HISTORY_WINDOW_SIZE}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Token Limit */}
                <div className="flex items-start gap-6">
                    <div className="size-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <Cpu size={20} />
                    </div>
                    <div className="flex-1 space-y-4">
                        <div>
                            <h4 className="text-sm font-bold text-text-main mb-1">Max Context Tokens</h4>
                            <p className="text-xs text-text-muted/60 leading-relaxed">Safety cap for total token usage per request. Aibō will trim older history if this limit is reached.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                type="number"
                                value={settings.CHAT_MAX_TOKENS}
                                onChange={e => setSettings({ ...settings, CHAT_MAX_TOKENS: e.target.value })}
                                placeholder="4000"
                            />
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">
                                    ~{Math.round((parseInt(settings.CHAT_MAX_TOKENS) || 0) * 0.75)} Words
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summarization */}
                <div className="flex items-start gap-6">
                    <div className="size-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                        <ShieldAlert size={20} />
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-sm font-bold text-text-main">Auto-Trimming & Summarization</h4>
                            <Switch
                                enabled={settings.CHAT_ENABLE_SUMMARIZATION === 'true'}
                                onChange={val => setSettings({ ...settings, CHAT_ENABLE_SUMMARIZATION: String(val) })}
                            />
                        </div>
                        <p className="text-xs text-text-muted/60 leading-relaxed">Automatically truncate or compress long conversation history when approaching the token limit to avoid API errors.</p>
                    </div>
                </div>
            </div>

            {/* Visual Decorative Element */}
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none select-none">
                <MessageSquare size={200} />
            </div>
        </Panel>
    );
};
