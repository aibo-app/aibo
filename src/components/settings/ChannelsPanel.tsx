import React, { useState, useEffect } from 'react';
import { Panel, SectionTitle } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { API_BASE } from '../../lib/api';
import { createLogger } from '../../utils/logger';
import { Save, Trash2, PlusCircle, MessageCircle, Send } from 'lucide-react';

const log = createLogger('ChannelsPanel');

interface ChannelAccountConfig {
    enabled: boolean;
    token: string;
    dmPolicy?: 'pairing' | 'allowlist' | 'open' | 'disabled';
}

interface ChannelsConfig {
    telegram?: Record<string, ChannelAccountConfig>;
    discord?: Record<string, ChannelAccountConfig>;
    whatsapp?: Record<string, ChannelAccountConfig>;
}

export const ChannelsPanel: React.FC = () => {
    const [config, setConfig] = useState<ChannelsConfig>({});
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    useEffect(() => {
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/channels`);
            const data = await res.json();
            setConfig(data.channels || {});
            setEnabled(data.enabled);
        } catch (error) {
            log.error('Failed to fetch channels:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleGlobal = async (val: boolean) => {
        setEnabled(val);
        try {
            await fetch(`${API_BASE}/api/channels/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: val })
            });
        } catch (error) {
            log.error('Failed to toggle settings:', error);
        }
    };

    const handleSaveAccount = async (channel: string, accountName: string, acctConfig: ChannelAccountConfig) => {
        setSaving(`${channel}:${accountName}`);
        try {
            const res = await fetch(`${API_BASE}/api/channels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel, accountName, config: acctConfig })
            });
            if (res.ok) {
                log.info(`Account ${accountName} saved.`);
            } else {
                const err = await res.json();
                alert(err.error || 'Save failed');
            }
        } catch (error) {
            log.error('Failed to save account:', error);
        } finally {
            setSaving(null);
            fetchChannels(); // Refresh to get masked token
        }
    };

    const handleDeleteAccount = async (channel: string, accountName: string) => {
        if (!confirm(`Delete ${channel} account "${accountName}"?`)) return;
        try {
            await fetch(`${API_BASE}/api/channels/${channel}/${accountName}`, {
                method: 'DELETE'
            });
            fetchChannels();
        } catch (error) {
            log.error('Failed to delete account:', error);
        }
    };

    const handleAddAccount = (channel: 'telegram' | 'discord' | 'whatsapp') => {
        const name = prompt(`Enter a name for this ${channel} account (e.g. "MainBot"):`);
        if (!name) return;

        setConfig(prev => ({
            ...prev,
            [channel]: {
                ...(prev[channel] || {}),
                [name]: { enabled: true, token: '', dmPolicy: 'pairing' }
            }
        }));
    };

    const renderChannelSection = (channel: 'telegram' | 'discord' | 'whatsapp', icon: any, label: string, placeholder: string) => {
        const accounts = config[channel] || {};
        const accountEntries = Object.entries(accounts);

        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl border border-black/5">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-white border border-black/5 flex items-center justify-center text-primary">
                            {icon}
                        </div>
                        <h4 className="text-sm font-bold text-text-main uppercase tracking-widest">{label}</h4>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleAddAccount(channel)} className="h-8 gap-1.5">
                        <PlusCircle size={14} />
                        <span>Add</span>
                    </Button>
                </div>

                {accountEntries.map(([name, acct]) => (
                    <div key={name} className="p-4 rounded-xl bg-white border border-black/5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-text-muted/40 uppercase tracking-widest">Account:</span>
                                <span className="text-xs font-bold text-text-main">{name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    enabled={acct.enabled}
                                    onChange={val => {
                                        const newConfig = { ...acct, enabled: val };
                                        handleSaveAccount(channel, name, newConfig);
                                    }}
                                />
                                <button
                                    onClick={() => handleDeleteAccount(channel, name)}
                                    className="p-1.5 text-text-muted/40 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Input
                                label="Bot Token"
                                type="password"
                                placeholder={placeholder}
                                value={acct.token}
                                onChange={e => {
                                    setConfig(prev => ({
                                        ...prev,
                                        [channel]: {
                                            ...prev[channel],
                                            [name]: { ...acct, token: e.target.value }
                                        }
                                    }));
                                }}
                            />

                            <div className="flex justify-between items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted block mb-1.5 ml-1">DM Policy</label>
                                    <select
                                        className="w-full h-10 bg-gray-50 border border-gray-100 rounded-xl px-4 text-xs font-bold focus:ring-1 focus:ring-primary/20 outline-none appearance-none"
                                        value={acct.dmPolicy || 'pairing'}
                                        onChange={e => {
                                            const newConfig = { ...acct, dmPolicy: e.target.value as any };
                                            handleSaveAccount(channel, name, newConfig);
                                        }}
                                    >
                                        <option value="pairing">Secure Pairing (Ref Codes)</option>
                                        <option value="allowlist">Allowlist Only</option>
                                        <option value="open">Open (Anyone can DM)</option>
                                        <option value="disabled">Disabled</option>
                                    </select>
                                </div>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    className="h-10 px-6 mt-5 shadow-button"
                                    onClick={() => handleSaveAccount(channel, name, acct)}
                                    loading={saving === `${channel}:${name}`}
                                >
                                    <Save size={14} />
                                    <span>Sync</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {accountEntries.length === 0 && (
                    <div className="text-center p-6 border-2 border-dashed border-gray-100 rounded-2xl">
                        <p className="text-[10px] font-bold text-text-muted/30 uppercase tracking-[0.2em]">No {channel} bots configured</p>
                    </div>
                )}
            </div>
        );
    };

    if (loading) return (
        <Panel className="p-8 flex items-center justify-center min-h-[400px]">
            <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </Panel>
    );

    return (
        <Panel className="p-6 flex flex-col gap-8 relative bg-white shadow-sm overflow-hidden">
            <SectionTitle
                title="Messaging Gateway"
                icon="account_tree"
                action={
                    <div className="flex gap-4 items-center">
                        <div className="flex gap-2 items-center px-3 py-1 bg-primary/5 rounded-lg border border-primary/10">
                            <span className="text-[9px] font-bold text-primary uppercase tracking-widest">{enabled ? 'Online' : 'Offline'}</span>
                            <Switch enabled={enabled} onChange={handleToggleGlobal} />
                        </div>
                    </div>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {renderChannelSection('telegram', <Send size={18} />, 'Telegram', '123456789:ABCDefGhI...')}
                {renderChannelSection('discord', <MessageCircle size={18} />, 'Discord', 'MTAxMjM0N...”')}
                {renderChannelSection('whatsapp', <div className="font-bold text-xs">WA</div>, 'WhatsApp', 'Business Token...')}
            </div>

            {!enabled && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px] z-10 flex items-center justify-center p-6">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl border border-black/5 text-center max-w-[280px] w-full animate-in fade-in zoom-in-95 duration-300">
                        <div className="size-12 rounded-xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-primary text-2xl">cloud_off</span>
                        </div>
                        <h4 className="text-sm font-bold text-text-main mb-2">Gateway Offline</h4>
                        <p className="text-[11px] text-text-muted leading-relaxed mb-6 px-2">Enable the Messaging Gateway to connect Aibō to your chat apps.</p>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleToggleGlobal(true)}
                            className="w-full shadow-button h-9 text-[11px] font-bold"
                        >
                            Enable Gateway
                        </Button>
                    </div>
                </div>
            )}
        </Panel>
    );
};
