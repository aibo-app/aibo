import React, { useState, useEffect } from 'react';
import { Panel, SectionTitle } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Switch } from '../ui/Switch';
import { API_BASE } from '../../lib/api';
import { createLogger } from '../../utils/logger';
import { Clock, Plus, Trash2, Bell, BarChart3, Search, Calendar, Zap } from 'lucide-react';

const log = createLogger('MonitoringPanel');

interface CronJobConfig {
    id: string;
    name: string;
    enabled: boolean;
    schedule: {
        kind: 'cron' | 'every' | 'at';
        expr?: string;
        everyMs?: number;
        at?: string;
    };
    action: 'portfolio_summary' | 'price_alert' | 'custom_query';
    params?: Record<string, unknown>;
    deliverTo?: {
        channel: string;
        recipient: string;
    };
}

export const MonitoringPanel: React.FC = () => {
    const [jobs, setJobs] = useState<CronJobConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingJob, setEditingJob] = useState<CronJobConfig | null>(null);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/cron/jobs`);
            const data = await res.json();
            setJobs(data.jobs || []);
        } catch (error) {
            log.error('Failed to fetch jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleJob = async (id: string, enabled: boolean) => {
        try {
            await fetch(`${API_BASE}/api/cron/jobs/${id}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            setJobs(prev => prev.map(j => j.id === id ? { ...j, enabled } : j));
        } catch (error) {
            log.error('Failed to toggle job:', error);
        }
    };

    const handleDeleteJob = async (id: string) => {
        if (!confirm('Delete this monitoring job?')) return;
        try {
            await fetch(`${API_BASE}/api/cron/jobs/${id}`, {
                method: 'DELETE'
            });
            fetchJobs();
        } catch (error) {
            log.error('Failed to delete job:', error);
        }
    };

    const handleSaveJob = async (job: CronJobConfig) => {
        try {
            const res = await fetch(`${API_BASE}/api/cron/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(job)
            });
            if (res.ok) {
                setEditingJob(null);
                fetchJobs();
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to save job');
            }
        } catch (error) {
            log.error('Failed to save job:', error);
        }
    };

    const createNewJob = () => {
        const id = Math.random().toString(36).substring(7);
        setEditingJob({
            id,
            name: 'New Monitor',
            enabled: true,
            schedule: { kind: 'cron', expr: '0 9 * * *' },
            action: 'portfolio_summary',
            deliverTo: { channel: 'telegram', recipient: '' }
        });
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'portfolio_summary': return <BarChart3 size={16} />;
            case 'price_alert': return <Zap size={16} />;
            case 'custom_query': return <Search size={16} />;
            default: return <Bell size={16} />;
        }
    };

    if (loading) return (
        <Panel className="p-8 flex items-center justify-center min-h-[400px]">
            <div className="size-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </Panel>
    );

    return (
        <div className="space-y-6">
            <Panel className="p-6 bg-white shadow-sm border-black/5">
                <SectionTitle
                    title="Proactive Monitoring"
                    icon="notifications_active"
                    action={
                        <Button variant="primary" size="sm" onClick={createNewJob} className="h-8 gap-1.5">
                            <Plus size={14} />
                            <span>Create Monitor</span>
                        </Button>
                    }
                />

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {jobs.map(job => (
                        <div key={job.id} className={`p-4 rounded-2xl border transition-all ${job.enabled ? 'bg-white border-black/5 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`size-10 rounded-xl flex items-center justify-center ${job.action === 'portfolio_summary' ? 'bg-blue-50 text-blue-600' :
                                        job.action === 'price_alert' ? 'bg-orange-50 text-orange-600' :
                                            'bg-purple-50 text-purple-600'
                                        }`}>
                                        {getActionIcon(job.action)}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-text-main line-clamp-1">{job.name}</h4>
                                        <div className="flex items-center gap-1.5 text-[10px] text-text-muted/60 font-bold uppercase tracking-wider">
                                            <Clock size={10} />
                                            <span>{job.schedule.kind === 'cron' ? job.schedule.expr : job.schedule.kind}</span>
                                        </div>
                                    </div>
                                </div>
                                <Switch enabled={job.enabled} onChange={val => handleToggleJob(job.id, val)} />
                            </div>

                            <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-50">
                                <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] gap-1.5" onClick={() => setEditingJob(job)}>
                                    Edit
                                </Button>
                                <button className="ml-auto p-1.5 text-text-muted/30 hover:text-red-500 transition-colors" onClick={() => handleDeleteJob(job.id)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {jobs.length === 0 && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-black/5 rounded-2xl bg-gray-50/30 backdrop-blur-sm">
                            <div className="size-14 rounded-full bg-white shadow-soft flex items-center justify-center mb-4 relative">
                                <Clock className="text-primary/20" size={24} />
                                <div className="absolute -top-0.5 -right-0.5 size-4 bg-primary rounded-full flex items-center justify-center text-white shadow-button">
                                    <Plus size={10} />
                                </div>
                            </div>
                            <h4 className="text-sm font-bold text-text-main mb-1.5">No active monitors</h4>
                            <p className="text-[10px] text-text-muted/60 max-w-[240px] mx-auto mb-1 leading-relaxed">
                                Get automated summaries and price alerts delivered to your channels.
                            </p>
                            <p className="text-[9px] font-bold text-primary/40 uppercase tracking-widest mt-3">
                                Click "Create Monitor" to begin
                            </p>
                        </div>
                    )}
                </div>
            </Panel>

            {/* Edit Modal */}
            {editingJob && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-8" onClick={(e) => e.target === e.currentTarget && setEditingJob(null)}>
                    <div className="w-full max-w-lg bg-white rounded-2xl border border-black/5 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                                <Calendar size={20} className="text-primary" />
                                {editingJob.id.length < 10 ? 'Create Monitor' : 'Edit Monitor'}
                            </h3>
                            <button onClick={() => setEditingJob(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <Trash2 size={18} className="text-text-muted/40" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <Input
                                label="Monitor Name"
                                value={editingJob.name}
                                onChange={e => setEditingJob({ ...editingJob, name: e.target.value })}
                                placeholder="Morning Summary..."
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1">Action Type</label>
                                    <select
                                        className="w-full h-10 bg-gray-50 border border-gray-100 rounded-xl px-4 text-xs font-bold appearance-none"
                                        value={editingJob.action}
                                        onChange={e => setEditingJob({ ...editingJob, action: e.target.value as any })}
                                    >
                                        <option value="portfolio_summary">Portfolio Summary</option>
                                        <option value="price_alert">Price Alert</option>
                                        <option value="custom_query">Custom Data Query</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1">Schedule Kind</label>
                                    <select
                                        className="w-full h-10 bg-gray-50 border border-gray-100 rounded-xl px-4 text-xs font-bold appearance-none"
                                        value={editingJob.schedule.kind}
                                        onChange={e => setEditingJob({ ...editingJob, schedule: { ...editingJob.schedule, kind: e.target.value as any } })}
                                    >
                                        <option value="cron">Cron Expression</option>
                                        <option value="every">Interval (ms)</option>
                                        <option value="at">Specific Time</option>
                                    </select>
                                </div>
                            </div>

                            {editingJob.schedule.kind === 'cron' && (
                                <Input
                                    label="Cron Expression"
                                    description="Standard 5-part cron (min hour day month dow)"
                                    value={editingJob.schedule.expr}
                                    onChange={e => setEditingJob({ ...editingJob, schedule: { ...editingJob.schedule, expr: e.target.value } })}
                                    placeholder="0 9 * * *"
                                />
                            )}

                            {editingJob.schedule.kind === 'every' && (
                                <Input
                                    label="Interval (Milliseconds)"
                                    type="number"
                                    value={String(editingJob.schedule.everyMs || 60000)}
                                    onChange={e => setEditingJob({ ...editingJob, schedule: { ...editingJob.schedule, everyMs: parseInt(e.target.value) } })}
                                />
                            )}

                            <div className="flex gap-4 p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                                <div className="flex-1 space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-primary ml-1">Deliver To</label>
                                    <div className="flex gap-2">
                                        <select
                                            className="w-32 h-10 bg-white border border-primary/10 rounded-xl px-3 text-xs font-bold"
                                            value={editingJob.deliverTo?.channel}
                                            onChange={e => setEditingJob({ ...editingJob, deliverTo: { ...editingJob.deliverTo!, channel: e.target.value } })}
                                        >
                                            <option value="telegram">Telegram</option>
                                            <option value="discord">Discord</option>
                                            <option value="whatsapp">WhatsApp</option>
                                        </select>
                                        <Input
                                            className="h-10 border-primary/10"
                                            placeholder="Recipient ID / Username"
                                            value={editingJob.deliverTo?.recipient}
                                            onChange={e => setEditingJob({ ...editingJob, deliverTo: { ...editingJob.deliverTo!, recipient: e.target.value } })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                            <Button variant="ghost" className="flex-1" onClick={() => setEditingJob(null)}>Cancel</Button>
                            <Button variant="primary" className="flex-1 shadow-button" onClick={() => handleSaveJob(editingJob)}>Save Monitor</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
