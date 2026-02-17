import React, { useState, useEffect } from 'react';
import { Panel, SectionTitle } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { API_BASE } from '../lib/api';
import { createLogger } from '../utils/logger';
import { SkillMarkdown } from '../components/ui/SkillMarkdown';

const log = createLogger('SkillsPage');

interface Skill {
    id: string;
    name: string;
    description: string;
    emoji?: string;
    category?: string;
    commands: string[];
    icon?: string;
    path: string;
    content?: string;
    status: 'loaded' | 'error';
    error?: string;
    source: 'workspace' | 'bundled';
    enabled?: boolean;
    requiredEnv?: string[];
}

interface EnvVarState {
    values: Record<string, string>;
    visibility: Record<string, boolean>;
    isSet: Record<string, boolean>;
    saving: boolean;
    dirty: boolean;
}

type FilterMode = 'all' | 'workspace' | 'bundled' | 'enabled';

export const SkillsPage: React.FC = () => {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
    const [commandsSkill, setCommandsSkill] = useState<Skill | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterMode>('all');
    const [toggling, setToggling] = useState<string | null>(null);
    const [envState, setEnvState] = useState<EnvVarState>({
        values: {}, visibility: {}, isSet: {}, saving: false, dirty: false,
    });

    useEffect(() => {
        loadSkills();
    }, []);

    const loadSkills = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/skills`);
            const data = await response.json();
            const filteredSkills = data.skills.filter((s: Skill) => !s.id.startsWith('_'));
            setSkills(filteredSkills);

            // Auto-select first skill and load its detail
            if (filteredSkills.length > 0 && !selectedSkill) {
                loadSkillDetail(filteredSkills[0]);
            }
        } catch (error) {
            log.error('Failed to load skills:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSkillDetail = async (skill: Skill) => {
        setSelectedSkill(skill);
        setEnvState({ values: {}, visibility: {}, isSet: {}, saving: false, dirty: false });
        try {
            const response = await fetch(`${API_BASE}/api/skills/${skill.id}`);
            const detail = await response.json();
            const fullSkill = { ...skill, ...detail };
            setSelectedSkill(fullSkill);
            // Load env vars if skill requires them
            if (fullSkill.requiredEnv && fullSkill.requiredEnv.length > 0) {
                loadSkillEnv(fullSkill.id);
            }
        } catch (error) {
            log.error('Failed to load skill detail:', error);
        }
    };

    const handleToggleSkill = async (skill: Skill, e: React.MouseEvent) => {
        e.stopPropagation();
        setToggling(skill.id);
        try {
            await fetch(`${API_BASE}/api/skills/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skillName: skill.id, enabled: !skill.enabled }),
            });
            setSkills(prev => prev.map(s =>
                s.id === skill.id ? { ...s, enabled: !s.enabled } : s
            ));
            if (selectedSkill?.id === skill.id) {
                setSelectedSkill(prev => prev ? { ...prev, enabled: !prev.enabled } : prev);
            }
        } catch (error) {
            log.error('Failed to toggle skill:', error);
        } finally {
            setToggling(null);
        }
    };

    const loadSkillEnv = async (skillId: string) => {
        try {
            const response = await fetch(`${API_BASE}/api/skills/${skillId}/env`);
            const data = await response.json();
            const values: Record<string, string> = {};
            const isSet: Record<string, boolean> = {};
            for (const key of (data.requiredEnv || [])) {
                values[key] = '';
                isSet[key] = data.vars?.[key]?.isSet || false;
            }
            setEnvState({ values, visibility: {}, isSet, saving: false, dirty: false });
        } catch (error) {
            log.error('Failed to load skill env:', error);
        }
    };

    const handleEnvChange = (key: string, value: string) => {
        setEnvState(prev => ({
            ...prev,
            values: { ...prev.values, [key]: value },
            dirty: true,
        }));
    };

    const toggleEnvVisibility = (key: string) => {
        setEnvState(prev => ({
            ...prev,
            visibility: { ...prev.visibility, [key]: !prev.visibility[key] },
        }));
    };

    const saveSkillEnv = async () => {
        if (!selectedSkill) return;
        setEnvState(prev => ({ ...prev, saving: true }));
        try {
            // Only send keys that have actual values typed in
            const env: Record<string, string> = {};
            for (const [key, value] of Object.entries(envState.values)) {
                if (value) env[key] = value;
            }
            await fetch(`${API_BASE}/api/skills/${selectedSkill.id}/env`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ env }),
            });
            // Reload to get updated isSet state
            await loadSkillEnv(selectedSkill.id);
        } catch (error) {
            log.error('Failed to save skill env:', error);
        } finally {
            setEnvState(prev => ({ ...prev, saving: false }));
        }
    };

    const filteredSkills = skills.filter(s => {
        if (filter === 'workspace') return s.source === 'workspace';
        if (filter === 'bundled') return s.source === 'bundled';
        if (filter === 'enabled') return s.enabled;
        return true;
    });

    const getCategoryColor = (category?: string) => {
        const colors: Record<string, string> = {
            finance: 'bg-green-500',
            social: 'bg-blue-500',
            productivity: 'bg-purple-500',
            data: 'bg-orange-500',
            entertainment: 'bg-pink-500'
        };
        return colors[category || ''] || 'bg-gray-500';
    };

    const SkillIcon = ({ skill, size = 'sm' }: { skill: Skill; size?: 'sm' | 'lg' | 'xl' }) => {
        const sizeClasses = size === 'xl' ? 'size-24 rounded-2xl text-5xl shadow-lg' : size === 'lg' ? 'size-20 rounded-2xl text-4xl shadow-lg' : 'size-8 rounded-lg text-base';
        const iconUrl = skill.icon ? `${API_BASE}${skill.icon}` : null;

        if (iconUrl) {
            return (
                <div className={`${sizeClasses} shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center`}>
                    <img
                        src={iconUrl}
                        alt={skill.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            target.parentElement!.classList.add(getCategoryColor(skill.category), 'text-white');
                            target.parentElement!.textContent = skill.emoji || '\u{1F527}';
                        }}
                    />
                </div>
            );
        }

        return (
            <div className={`${sizeClasses} ${getCategoryColor(skill.category)} flex items-center justify-center shrink-0 text-white`}>
                {skill.emoji || '\u{1F527}'}
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col p-8 overflow-hidden bg-beige custom-scrollbar pb-10">
            <PageHeader
                title="Skills"
                subtitle="Manage and explore available OpenClaw skills"
            >
                <Button variant="primary" size="sm" className="gap-2 opacity-50 cursor-not-allowed" disabled>
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Install Skill</span>
                </Button>
            </PageHeader>

            <div className="flex-1 flex gap-6 overflow-hidden mt-2">
                {/* Skills List Sidebar */}
                <section className="w-80 flex flex-col shrink-0 h-full">
                    <Panel className="p-6 flex flex-col gap-4 flex-1 bg-white">
                        <SectionTitle title="Installed Skills" icon="extension" />

                        <div className="grid grid-cols-4 gap-1 p-1 bg-gray-50 rounded-xl mb-2">
                            {(['all', 'workspace', 'bundled', 'enabled'] as FilterMode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setFilter(m)}
                                    className={`py-1.5 px-1 rounded-lg text-[9px] font-bold uppercase tracking-wide transition-all text-center truncate ${filter === m
                                        ? 'bg-white text-primary shadow-sm border border-black/5'
                                        : 'text-text-muted/60 hover:text-text-muted hover:bg-black/5'
                                        }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="text-text-muted/40 text-sm font-semibold">Loading skills...</div>
                            </div>
                        ) : filteredSkills.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl text-text-muted/40">extension</span>
                                </div>
                                <p className="text-sm font-bold text-text-muted mb-2">No skills found</p>
                                <p className="text-xs text-text-muted/60">Try changing the filter or add skills</p>
                            </div>
                        ) : (
                            <div className="overflow-y-auto flex-1 pr-1 space-y-1 custom-scrollbar">
                                {filteredSkills.map(skill => (
                                    <div
                                        key={skill.id}
                                        className={`group p-3 rounded-xl cursor-pointer transition-all border ${selectedSkill?.id === skill.id
                                            ? 'bg-primary/5 border-primary/20 shadow-sm'
                                            : skill.status === 'error'
                                                ? 'bg-red-50 border-red-200 hover:border-red-300'
                                                : 'hover:bg-beige/40 border-transparent hover:border-black/5 hover:shadow-sm'
                                            }`}
                                        onClick={() => loadSkillDetail(skill)}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="relative shrink-0">
                                                <SkillIcon skill={skill} size="sm" />
                                                <div className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white ${skill.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0 overflow-hidden">
                                                <div className="flex items-center gap-2">
                                                    <h3 className={`text-sm font-bold truncate ${skill.enabled ? 'text-text-main' : 'text-text-muted/60'}`}>{skill.name}</h3>
                                                    {skill.source === 'workspace' && (
                                                        <span className="text-[8px] px-1 py-0 rounded bg-blue-100 text-blue-600 font-bold uppercase tracking-tighter shrink-0">Dev</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-text-muted/40 truncate mt-0.5">{skill.category || 'Utility'}</p>
                                            </div>
                                            <button
                                                onClick={(e) => handleToggleSkill(skill, e)}
                                                disabled={toggling === skill.id}
                                                className={`size-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${skill.enabled
                                                    ? 'bg-green-50 text-green-600 border border-green-100'
                                                    : 'bg-gray-50 text-gray-400 border border-gray-100'
                                                    } hover:scale-105 active:scale-95 disabled:opacity-50`}
                                            >
                                                {toggling === skill.id ? (
                                                    <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-base">
                                                        {skill.enabled ? 'toggle_on' : 'toggle_off'}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </section>

                {/* Skill Details */}
                <Panel className="flex-1 flex flex-col bg-white overflow-hidden">
                    {selectedSkill ? (
                        <>
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-start gap-6">
                                    <SkillIcon skill={selectedSkill} size="lg" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className={`text-2xl font-bold ${selectedSkill.enabled ? 'text-text-main' : 'text-text-muted/40'}`}>
                                                {selectedSkill.name}
                                            </h2>
                                            {selectedSkill.enabled ? (
                                                <span className="px-2.5 py-0.5 rounded-lg bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-widest border border-green-100">Live</span>
                                            ) : (
                                                <span className="px-2.5 py-0.5 rounded-lg bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-widest border border-gray-100">Inactive</span>
                                            )}
                                            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${selectedSkill.source === 'workspace'
                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                : 'bg-purple-50 text-purple-700 border-purple-100'
                                                }`}>
                                                {selectedSkill.source}
                                            </span>
                                        </div>
                                        <p className="text-sm text-text-muted mb-4 line-clamp-2">{selectedSkill.description}</p>
                                        <div className="flex items-center gap-4">
                                            <Button
                                                variant={selectedSkill.enabled ? 'ghost' : 'primary'}
                                                size="sm"
                                                className="h-8 gap-2"
                                                onClick={(e) => handleToggleSkill(selectedSkill, e)}
                                                loading={toggling === selectedSkill.id}
                                            >
                                                <span className="material-symbols-outlined text-base">
                                                    {selectedSkill.enabled ? 'block' : 'check_circle'}
                                                </span>
                                                <span>{selectedSkill.enabled ? 'Disable Skill' : 'Enable Skill'}</span>
                                            </Button>

                                            <div className="h-4 w-px bg-gray-200 mx-2" />

                                            {selectedSkill.category && (
                                                <div className="flex items-center gap-2 text-text-muted">
                                                    <span className="material-symbols-outlined text-sm opacity-40">category</span>
                                                    <span className="text-xs font-semibold capitalize tracking-tight">{selectedSkill.category}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-text-muted">
                                                <span className="material-symbols-outlined text-sm opacity-40">terminal</span>
                                                <span className="text-xs font-semibold tracking-tight">
                                                    {selectedSkill.commands?.length || 0} commands
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Environment Variables — inline in header */}
                                {selectedSkill.requiredEnv && selectedSkill.requiredEnv.length > 0 && (
                                    <div className="mt-5 pt-5 border-t border-gray-100">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-sm text-text-muted/50">key</span>
                                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Required Keys</span>
                                        </div>
                                        <div className="space-y-2">
                                            {selectedSkill.requiredEnv.map(key => {
                                                const isConfigured = envState.isSet[key];
                                                const isVisible = envState.visibility[key];
                                                const currentValue = envState.values[key] || '';
                                                return (
                                                    <div key={key} className="flex items-center gap-3">
                                                        <div className="flex items-center gap-2 w-44 shrink-0">
                                                            <div className={`size-1.5 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-amber-500'}`} />
                                                            <code className="text-[11px] font-mono font-bold text-text-main truncate">{key}</code>
                                                        </div>
                                                        <input
                                                            type={isVisible ? 'text' : 'password'}
                                                            value={currentValue}
                                                            onChange={(e) => handleEnvChange(key, e.target.value)}
                                                            placeholder={isConfigured ? 'Configured — enter to update' : 'Enter value...'}
                                                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-mono text-text-main placeholder:text-text-muted/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                                                        />
                                                        <button
                                                            onClick={() => toggleEnvVisibility(key)}
                                                            className="size-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0"
                                                            title={isVisible ? 'Hide' : 'Show'}
                                                        >
                                                            <span className="material-symbols-outlined text-sm text-text-muted/40">
                                                                {isVisible ? 'visibility_off' : 'visibility'}
                                                            </span>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {envState.dirty && (
                                            <div className="mt-3 flex justify-end">
                                                <Button
                                                    variant="primary"
                                                    size="sm"
                                                    className="h-7 gap-1.5 text-xs"
                                                    onClick={saveSkillEnv}
                                                    loading={envState.saving}
                                                >
                                                    <span className="material-symbols-outlined text-sm">save</span>
                                                    <span>Save</span>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                {selectedSkill.status === 'error' && selectedSkill.error && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-red-500">error</span>
                                            <div>
                                                <h4 className="font-bold text-red-900 mb-1">Skill Error</h4>
                                                <p className="text-sm text-red-700">{selectedSkill.error}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedSkill.commands && selectedSkill.commands.length > 0 && (
                                    <div className="mb-6">
                                        <button
                                            onClick={() => setCommandsSkill(selectedSkill)}
                                            className="w-full text-left group/cmds"
                                        >
                                            <h3 className="text-lg font-bold text-text-main mb-4 flex items-center gap-2">
                                                <span className="material-symbols-outlined">terminal</span>
                                                Available Commands
                                                <span className="ml-auto text-[10px] font-semibold text-primary/60 uppercase tracking-widest group-hover/cmds:text-primary transition-colors flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">open_in_full</span>
                                                    View All
                                                </span>
                                            </h3>
                                        </button>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedSkill.commands.slice(0, 6).map((cmd, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setCommandsSkill(selectedSkill)}
                                                    className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer"
                                                >
                                                    <code className="text-xs font-mono font-bold text-primary">{cmd}</code>
                                                </button>
                                            ))}
                                            {selectedSkill.commands.length > 6 && (
                                                <button
                                                    onClick={() => setCommandsSkill(selectedSkill)}
                                                    className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 hover:border-primary/20 hover:bg-primary/5 transition-all text-xs font-bold text-text-muted"
                                                >
                                                    +{selectedSkill.commands.length - 6} more
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h3 className="text-lg font-bold text-text-main mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined">description</span>
                                        Documentation
                                    </h3>
                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                                        <SkillMarkdown content={selectedSkill.content || ''} />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center max-w-md">
                                <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl text-text-muted/40">extension</span>
                                </div>
                                <h3 className="text-lg font-bold text-text-main mb-2">Select a skill</h3>
                                <p className="text-sm text-text-muted/60">Choose a skill from the sidebar to view details</p>
                            </div>
                        </div>
                    )}
                </Panel>
            </div>

            {/* Commands Modal */}
            {commandsSkill && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-8"
                    onClick={(e) => { if (e.target === e.currentTarget) setCommandsSkill(null); }}
                >
                    <div className="w-full max-w-lg max-h-[75vh] bg-white rounded-2xl border border-black/5 shadow-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 pb-4 border-b border-gray-100 shrink-0 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-primary">terminal</span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-text-main font-display">{commandsSkill.name}</h2>
                                    <p className="text-[11px] text-text-muted/50 font-semibold uppercase tracking-widest">
                                        {commandsSkill.commands?.length || 0} Available Commands
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setCommandsSkill(null)}
                                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                <span className="material-symbols-outlined text-text-muted">close</span>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                            {commandsSkill.commands?.map((cmd, i) => (
                                <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center gap-4">
                                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <span className="text-primary font-bold text-xs font-mono">{i + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <code className="text-sm font-mono font-bold text-primary">{cmd}</code>
                                        <p className="text-[10px] text-text-muted/40 mt-1 font-semibold">Invocable by OpenClaw Brain</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
