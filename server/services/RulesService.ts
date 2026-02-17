import { db } from '../index';
import { rules, ruleArtifacts } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

type ArtifactType = 'policy-fragment' | 'guard' | 'action-bundle';
type ArtifactStatus = 'ok' | 'failed' | 'pending';

interface Rule {
    id: number;
    text: string;
    createdAt: number;
    updatedAt: number;
}

interface RuleArtifact {
    id: number;
    ruleId: number;
    type: ArtifactType;
    content: string;
    outputPath: string | null;
    status: ArtifactStatus;
    compiledAt: number | null;
}

interface RuleWithArtifacts extends Rule {
    artifacts: RuleArtifact[];
}

// Keywords that indicate a guard rule (blocking / refusing behavior)
const GUARD_KEYWORDS = /\b(never|block|refuse|reject|deny|forbid|prohibit|don'?t|do not|must not|cannot|disallow)\b/i;
// Keywords that indicate an action-bundle (skill-like behavior)
const ACTION_KEYWORDS = /\b(skill|action|trigger|when.*then|automate|schedule|run|execute|perform|fetch|send|notify)\b/i;

/**
 * RulesService — CRUD + compilation pipeline for natural language rules.
 *
 * Rules are user-written natural language sentences that get classified and
 * compiled into artifacts:
 *   - policy-fragment: appended to SOUL.md as behavioral guidelines
 *   - guard: injected as hard constraints the agent must follow
 *   - action-bundle: materialized as SKILL.md files in the skills/ directory
 */
export class RulesService {
    private static instance: RulesService;

    private constructor() {}

    public static getInstance(): RulesService {
        if (!RulesService.instance) {
            RulesService.instance = new RulesService();
        }
        return RulesService.instance;
    }

    // ─── CRUD ──────────────────────────────────────────────────────

    public async listRules(): Promise<RuleWithArtifacts[]> {
        const allRules = await db.select().from(rules).all();
        const allArtifacts = await db.select().from(ruleArtifacts).all();

        const artifactsByRule = new Map<number, RuleArtifact[]>();
        for (const a of allArtifacts) {
            const list = artifactsByRule.get(a.ruleId) || [];
            list.push(a as RuleArtifact);
            artifactsByRule.set(a.ruleId, list);
        }

        return allRules.map(r => ({
            ...r,
            artifacts: artifactsByRule.get(r.id) || [],
        })) as RuleWithArtifacts[];
    }

    public async getRule(id: number): Promise<RuleWithArtifacts | null> {
        const rule = await db.select().from(rules).where(eq(rules.id, id)).get();
        if (!rule) return null;

        const artifacts = await db.select().from(ruleArtifacts).where(eq(ruleArtifacts.ruleId, id)).all();
        return { ...rule, artifacts } as RuleWithArtifacts;
    }

    public async createRule(text: string): Promise<Rule> {
        const now = Date.now();
        const result = await db.insert(rules).values({ text, createdAt: now, updatedAt: now }).returning();
        return result[0] as Rule;
    }

    public async updateRule(id: number, text: string): Promise<Rule | null> {
        const existing = await db.select().from(rules).where(eq(rules.id, id)).get();
        if (!existing) return null;

        await db.update(rules).set({ text, updatedAt: Date.now() }).where(eq(rules.id, id));
        return { ...existing, text, updatedAt: Date.now() } as Rule;
    }

    public async deleteRule(id: number): Promise<boolean> {
        const existing = await db.select().from(rules).where(eq(rules.id, id)).get();
        if (!existing) return false;

        // Clean up action-bundle skill directories
        const artifacts = await db.select().from(ruleArtifacts).where(eq(ruleArtifacts.ruleId, id)).all();
        for (const a of artifacts) {
            if (a.type === 'action-bundle' && a.outputPath) {
                try {
                    fs.rmSync(a.outputPath, { recursive: true, force: true });
                } catch {}
            }
        }

        await db.delete(ruleArtifacts).where(eq(ruleArtifacts.ruleId, id));
        await db.delete(rules).where(eq(rules.id, id));
        return true;
    }

    // ─── Compilation ───────────────────────────────────────────────

    /**
     * Classify and compile a rule into an artifact.
     * 1. Heuristic keyword classification
     * 2. Optional LLM classification via OpenClaw gateway (15s timeout)
     * 3. Generate artifact content
     * 4. For action-bundles: write SKILL.md to skills/rule-{id}/
     */
    public async compileRule(id: number): Promise<RuleArtifact | null> {
        const rule = await db.select().from(rules).where(eq(rules.id, id)).get();
        if (!rule) return null;

        // Mark as pending
        await db.delete(ruleArtifacts).where(eq(ruleArtifacts.ruleId, id));

        const pendingArtifact = await db.insert(ruleArtifacts).values({
            ruleId: id,
            type: 'pending' as ArtifactType,
            content: '',
            status: 'pending' as ArtifactStatus,
        }).returning();

        const artifactId = pendingArtifact[0].id;

        try {
            // Classify
            const type = await this.classifyRule(rule.text);

            // Generate content
            const content = this.generateArtifactContent(rule.text, type);

            // For action-bundles, write SKILL.md
            let outputPath: string | null = null;
            if (type === 'action-bundle') {
                outputPath = this.writeSkillFile(id, rule.text, content);
            }

            // Update artifact
            await db.update(ruleArtifacts).set({
                type,
                content,
                outputPath,
                status: 'ok' as ArtifactStatus,
                compiledAt: Date.now(),
            }).where(eq(ruleArtifacts.id, artifactId));

            return {
                id: artifactId,
                ruleId: id,
                type,
                content,
                outputPath,
                status: 'ok',
                compiledAt: Date.now(),
            };
        } catch (err: any) {
            await db.update(ruleArtifacts).set({
                type: 'policy-fragment',
                content: `Compilation failed: ${err.message}`,
                status: 'failed' as ArtifactStatus,
                compiledAt: Date.now(),
            }).where(eq(ruleArtifacts.id, artifactId));

            return {
                id: artifactId,
                ruleId: id,
                type: 'policy-fragment',
                content: `Compilation failed: ${err.message}`,
                outputPath: null,
                status: 'failed',
                compiledAt: Date.now(),
            };
        }
    }

    /**
     * Classify a rule using heuristics, with optional LLM fallback.
     */
    private async classifyRule(text: string): Promise<ArtifactType> {
        // Try LLM classification first (non-blocking, 15s timeout)
        try {
            const llmType = await this.llmClassify(text);
            if (llmType) return llmType;
        } catch {
            // Fall through to heuristic
        }

        // Heuristic classification
        if (GUARD_KEYWORDS.test(text)) return 'guard';
        if (ACTION_KEYWORDS.test(text)) return 'action-bundle';
        return 'policy-fragment';
    }

    /**
     * Optional LLM classification via OpenClaw's local gateway.
     */
    private async llmClassify(text: string): Promise<ArtifactType | null> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            const res = await fetch('http://localhost:18789/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer aibo' },
                body: JSON.stringify({
                    model: 'default',
                    max_tokens: 20,
                    messages: [
                        {
                            role: 'system',
                            content: 'Classify the following user rule into exactly one category. Respond with ONLY the category name, nothing else.\n\nCategories:\n- policy-fragment: general behavioral guidelines, personality traits, communication style\n- guard: hard constraints, things to never do, blocking rules, safety boundaries\n- action-bundle: automated actions, triggers, scheduled tasks, skill-like behavior',
                        },
                        { role: 'user', content: text },
                    ],
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);
            if (!res.ok) return null;

            const data = await res.json() as any;
            const answer = (data.choices?.[0]?.message?.content || '').trim().toLowerCase();

            if (answer.includes('guard')) return 'guard';
            if (answer.includes('action-bundle')) return 'action-bundle';
            if (answer.includes('policy-fragment')) return 'policy-fragment';
            return null;
        } catch {
            clearTimeout(timeout);
            return null;
        }
    }

    /**
     * Generate artifact content based on type.
     */
    private generateArtifactContent(ruleText: string, type: ArtifactType): string {
        switch (type) {
            case 'policy-fragment':
                return `- ${ruleText}`;

            case 'guard':
                return `**GUARD**: ${ruleText}\n\nYou MUST follow this constraint at all times. If a user request conflicts with this rule, politely decline and explain why.`;

            case 'action-bundle':
                return this.generateSkillContent(ruleText);

            default:
                return `- ${ruleText}`;
        }
    }

    /**
     * Generate SKILL.md content for action-bundle rules.
     */
    private generateSkillContent(ruleText: string): string {
        return `---
name: "Auto Rule"
description: "${ruleText.replace(/"/g, '\\"').substring(0, 100)}"
emoji: "📋"
category: "rules"
---

# Auto-Generated Rule Skill

This skill was automatically generated from a user-defined rule.

## Rule

> ${ruleText}

## Behavior

When this rule's conditions are met, follow the directive above.
`;
    }

    /**
     * Write a SKILL.md file for an action-bundle artifact.
     */
    private writeSkillFile(ruleId: number, _ruleText: string, content: string): string {
        const workspaceDir = path.join(__dirname, '..', '..', 'skills');
        const skillDir = path.join(workspaceDir, `rule-${ruleId}`);

        if (!fs.existsSync(skillDir)) {
            fs.mkdirSync(skillDir, { recursive: true });
        }

        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
        return skillDir;
    }

    // ─── Views for config injection ────────────────────────────────

    /**
     * Get all compiled policy-fragment artifacts concatenated (for SOUL.md injection).
     * Max 4000 chars to avoid bloating the system prompt.
     */
    public async getCompiledPolicyView(): Promise<string> {
        const artifacts = await db.select().from(ruleArtifacts).all();
        const policies = artifacts
            .filter(a => a.type === 'policy-fragment' && a.status === 'ok')
            .map(a => a.content);

        const joined = policies.join('\n');
        return joined.length > 4000 ? joined.substring(0, 4000) + '\n...(truncated)' : joined;
    }

    /**
     * Get all active guard artifacts (for SOUL.md injection).
     */
    public async getActiveGuards(): Promise<string[]> {
        const artifacts = await db.select().from(ruleArtifacts).all();
        return artifacts
            .filter(a => a.type === 'guard' && a.status === 'ok')
            .map(a => a.content);
    }
}
