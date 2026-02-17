import React, { useState, useEffect, useRef } from 'react';
import { Panel, SectionTitle } from '../components/ui/Panel';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { API_BASE } from '../lib/api';

interface RuleArtifact {
    id: number;
    ruleId: number;
    type: 'policy-fragment' | 'guard' | 'action-bundle';
    content: string;
    outputPath: string | null;
    status: 'ok' | 'failed' | 'pending';
    compiledAt: number | null;
}

interface Rule {
    id: number;
    text: string;
    createdAt: number;
    updatedAt: number;
    artifacts: RuleArtifact[];
}

const EXAMPLE_RULES = [
    'Always be friendly and encouraging when discussing portfolio losses',
    'Never share wallet addresses or private keys in responses',
    'When a token drops more than 20%, proactively alert me',
    'Respond in a concise, no-fluff style — skip pleasantries',
    'Never recommend buying memecoins',
    'Always include risk disclaimers when suggesting trades',
];

type BadgeStatus = 'ok' | 'failed' | 'pending' | 'inactive';

export const RulesPage: React.FC = () => {
    const [rules, setRules] = useState<Rule[]>([]);
    const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
    const [loading, setLoading] = useState(true);
    const [newRuleText, setNewRuleText] = useState('');
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [recompiling, setRecompiling] = useState<number | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        loadRules();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    // Poll when any rule has pending status
    useEffect(() => {
        const hasPending = rules.some(r => r.artifacts.some(a => a.status === 'pending'));
        if (hasPending && !pollRef.current) {
            pollRef.current = setInterval(loadRules, 3000);
        } else if (!hasPending && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, [rules]);

    const loadRules = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/rules`);
            const data = await res.json();
            setRules(data.rules);
            // Update selected rule if it exists
            if (selectedRule) {
                const updated = data.rules.find((r: Rule) => r.id === selectedRule.id);
                if (updated) setSelectedRule(updated);
            }
        } catch (err) {
            console.error('Failed to load rules:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newRuleText.trim() || creating) return;
        setCreating(true);
        try {
            const res = await fetch(`${API_BASE}/api/rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: newRuleText.trim() }),
            });
            const data = await res.json();
            setRules(prev => [...prev, data.rule]);
            setSelectedRule(data.rule);
            setNewRuleText('');
            // Start polling for compilation result
            setTimeout(loadRules, 2000);
        } catch (err) {
            console.error('Failed to create rule:', err);
        } finally {
            setCreating(false);
        }
    };

    const handleUpdate = async (id: number) => {
        if (!editText.trim()) return;
        try {
            await fetch(`${API_BASE}/api/rules/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: editText.trim() }),
            });
            setEditingId(null);
            setTimeout(loadRules, 1000);
        } catch (err) {
            console.error('Failed to update rule:', err);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await fetch(`${API_BASE}/api/rules/${id}`, { method: 'DELETE' });
            setRules(prev => prev.filter(r => r.id !== id));
            if (selectedRule?.id === id) setSelectedRule(null);
        } catch (err) {
            console.error('Failed to delete rule:', err);
        }
    };

    const handleRecompile = async (id: number) => {
        setRecompiling(id);
        try {
            await fetch(`${API_BASE}/api/rules/${id}/compile`, { method: 'POST' });
            setTimeout(loadRules, 1000);
        } catch (err) {
            console.error('Failed to recompile rule:', err);
        } finally {
            setRecompiling(null);
        }
    };

    const getRuleStatus = (rule: Rule): BadgeStatus => {
        if (rule.artifacts.length === 0) return 'inactive';
        const latest = rule.artifacts[0];
        return latest.status as BadgeStatus;
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            'policy-fragment': 'Policy',
            'guard': 'Guard',
            'action-bundle': 'Action',
        };
        return labels[type] || type;
    };

    const getTypeBadge = (type: string) => {
        const styles: Record<string, string> = {
            'policy-fragment': 'bg-blue-50 text-blue-700 border-blue-100',
            'guard': 'bg-red-50 text-red-700 border-red-100',
            'action-bundle': 'bg-purple-50 text-purple-700 border-purple-100',
        };
        return styles[type] || 'bg-gray-50 text-gray-700 border-gray-100';
    };

    return (
        <div className="flex-1 flex flex-col p-8 overflow-hidden bg-beige custom-scrollbar pb-10">
            <PageHeader
                title="Rules"
                subtitle="Define natural language rules that shape your assistant's behavior"
            />

            <div className="flex-1 flex gap-6 overflow-hidden mt-2">
                {/* Rules List Sidebar */}
                <section className="w-80 flex flex-col shrink-0 h-full gap-4">
                    {/* New Rule Input */}
                    <Panel className="p-4 bg-white">
                        <div className="flex flex-col gap-3">
                            <textarea
                                value={newRuleText}
                                onChange={(e) => setNewRuleText(e.target.value)}
                                placeholder="Write a rule in plain English..."
                                className="w-full h-20 p-3 text-sm bg-gray-50 border border-gray-100 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 placeholder:text-text-muted/40"
                                maxLength={2000}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate();
                                }}
                            />
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    className="gap-2"
                                    onClick={handleCreate}
                                    loading={creating}
                                    disabled={!newRuleText.trim()}
                                >
                                    <span className="material-symbols-outlined text-base">add</span>
                                    <span>Add Rule</span>
                                </Button>
                                <div className="relative ml-auto group">
                                    <button className="text-[10px] font-semibold text-text-muted/50 hover:text-primary uppercase tracking-widest transition-colors">
                                        Examples
                                    </button>
                                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-black/5 shadow-lg p-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-10">
                                        {EXAMPLE_RULES.map((ex, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setNewRuleText(ex)}
                                                className="w-full text-left text-xs text-text-muted hover:text-text-main hover:bg-gray-50 p-2 rounded-lg transition-colors"
                                            >
                                                {ex}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Panel>

                    {/* Rules List */}
                    <Panel className="p-6 flex flex-col gap-4 flex-1 bg-white">
                        <SectionTitle
                            title="Active Rules"
                            icon="gavel"
                            subtitle={`${rules.length} rule${rules.length !== 1 ? 's' : ''}`}
                        />

                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="text-text-muted/40 text-sm font-semibold">Loading rules...</div>
                            </div>
                        ) : rules.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                                <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-3xl text-text-muted/40">gavel</span>
                                </div>
                                <p className="text-sm font-bold text-text-muted mb-2">No rules yet</p>
                                <p className="text-xs text-text-muted/60">Add a rule above to shape your assistant's behavior</p>
                            </div>
                        ) : (
                            <div className="overflow-y-auto flex-1 pr-1 space-y-1 custom-scrollbar">
                                {rules.map(rule => (
                                    <div
                                        key={rule.id}
                                        className={`group p-3 rounded-xl cursor-pointer transition-all border ${selectedRule?.id === rule.id
                                            ? 'bg-primary/5 border-primary/20 shadow-sm'
                                            : 'hover:bg-beige/40 border-transparent hover:border-black/5 hover:shadow-sm'
                                        }`}
                                        onClick={() => setSelectedRule(rule)}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 text-white text-base ${
                                                getRuleStatus(rule) === 'ok' ? 'bg-green-500'
                                                : getRuleStatus(rule) === 'failed' ? 'bg-red-500'
                                                : getRuleStatus(rule) === 'pending' ? 'bg-orange-500'
                                                : 'bg-gray-400'
                                            }`}>
                                                <span className="material-symbols-outlined text-base">
                                                    {rule.artifacts[0]?.type === 'guard' ? 'shield' :
                                                     rule.artifacts[0]?.type === 'action-bundle' ? 'bolt' : 'description'}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-text-main line-clamp-2 leading-snug">{rule.text}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <StatusBadge status={getRuleStatus(rule)} />
                                                    {rule.artifacts[0]?.type && (
                                                        <span className={`px-1.5 py-0 rounded text-[8px] font-bold uppercase tracking-tighter border ${getTypeBadge(rule.artifacts[0].type)}`}>
                                                            {getTypeLabel(rule.artifacts[0].type)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Panel>
                </section>

                {/* Rule Details */}
                <Panel className="flex-1 flex flex-col bg-white overflow-hidden">
                    {selectedRule ? (
                        <>
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-start gap-4">
                                    <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 text-white text-2xl shadow-lg ${
                                        getRuleStatus(selectedRule) === 'ok' ? 'bg-green-500'
                                        : getRuleStatus(selectedRule) === 'failed' ? 'bg-red-500'
                                        : getRuleStatus(selectedRule) === 'pending' ? 'bg-orange-500'
                                        : 'bg-gray-400'
                                    }`}>
                                        <span className="material-symbols-outlined text-2xl">
                                            {selectedRule.artifacts[0]?.type === 'guard' ? 'shield' :
                                             selectedRule.artifacts[0]?.type === 'action-bundle' ? 'bolt' : 'description'}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h2 className="text-lg font-bold text-text-main">Rule #{selectedRule.id}</h2>
                                            <StatusBadge status={getRuleStatus(selectedRule)} />
                                            {selectedRule.artifacts[0]?.type && (
                                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${getTypeBadge(selectedRule.artifacts[0].type)}`}>
                                                    {getTypeLabel(selectedRule.artifacts[0].type)}
                                                </span>
                                            )}
                                        </div>

                                        {editingId === selectedRule.id ? (
                                            <div className="flex flex-col gap-2">
                                                <textarea
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    className="w-full h-20 p-3 text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                                                    maxLength={2000}
                                                />
                                                <div className="flex gap-2">
                                                    <Button variant="primary" size="sm" onClick={() => handleUpdate(selectedRule.id)}>Save</Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-text-muted leading-relaxed">{selectedRule.text}</p>
                                        )}

                                        <div className="flex items-center gap-3 mt-4">
                                            {editingId !== selectedRule.id && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-1.5"
                                                    onClick={() => { setEditingId(selectedRule.id); setEditText(selectedRule.text); }}
                                                >
                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                    <span>Edit</span>
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-1.5"
                                                onClick={() => handleRecompile(selectedRule.id)}
                                                loading={recompiling === selectedRule.id}
                                            >
                                                <span className="material-symbols-outlined text-sm">refresh</span>
                                                <span>Recompile</span>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDelete(selectedRule.id)}
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                                <span>Delete</span>
                                            </Button>

                                            <span className="ml-auto text-[10px] text-text-muted/40 font-medium">
                                                Created {new Date(selectedRule.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                                {/* Artifact Details */}
                                {selectedRule.artifacts.length > 0 ? (
                                    selectedRule.artifacts.map(artifact => (
                                        <div key={artifact.id}>
                                            <h3 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2 uppercase tracking-widest">
                                                <span className="material-symbols-outlined text-sm">code</span>
                                                Compiled Output
                                            </h3>

                                            {artifact.status === 'failed' && (
                                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                                                    <div className="flex items-start gap-3">
                                                        <span className="material-symbols-outlined text-red-500">error</span>
                                                        <div>
                                                            <h4 className="font-bold text-red-900 mb-1">Compilation Failed</h4>
                                                            <p className="text-sm text-red-700">{artifact.content}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {artifact.status === 'pending' && (
                                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                                        <p className="text-sm text-orange-700 font-medium">Compiling rule...</p>
                                                    </div>
                                                </div>
                                            )}

                                            {artifact.status === 'ok' && (
                                                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                                                    <pre className="whitespace-pre-wrap text-xs text-text-muted font-mono leading-relaxed">
                                                        {artifact.content}
                                                    </pre>
                                                </div>
                                            )}

                                            {artifact.compiledAt && (
                                                <p className="text-[10px] text-text-muted/40 mt-2 font-medium">
                                                    Compiled {new Date(artifact.compiledAt).toLocaleString()}
                                                </p>
                                            )}

                                            {artifact.outputPath && (
                                                <div className="mt-4">
                                                    <h3 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2 uppercase tracking-widest">
                                                        <span className="material-symbols-outlined text-sm">folder</span>
                                                        Output Path
                                                    </h3>
                                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                        <code className="text-xs font-mono text-text-muted break-all">{artifact.outputPath}</code>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 text-center">
                                        <span className="material-symbols-outlined text-3xl text-text-muted/30 mb-2">hourglass_empty</span>
                                        <p className="text-sm text-text-muted/60">No artifacts yet — rule is being compiled</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center max-w-md">
                                <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-3xl text-text-muted/40">gavel</span>
                                </div>
                                <h3 className="text-lg font-bold text-text-main mb-2">Select a rule</h3>
                                <p className="text-sm text-text-muted/60">Choose a rule from the sidebar to view details and compiled output</p>
                            </div>
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    );
};
