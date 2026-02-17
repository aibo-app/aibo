"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RulesService = void 0;
const index_1 = require("../index");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
class RulesService {
    static instance;
    constructor() { }
    static getInstance() {
        if (!RulesService.instance) {
            RulesService.instance = new RulesService();
        }
        return RulesService.instance;
    }
    // ─── CRUD ──────────────────────────────────────────────────────
    async listRules() {
        const allRules = await index_1.db.select().from(schema_1.rules).all();
        const allArtifacts = await index_1.db.select().from(schema_1.ruleArtifacts).all();
        const artifactsByRule = new Map();
        for (const a of allArtifacts) {
            const list = artifactsByRule.get(a.ruleId) || [];
            list.push(a);
            artifactsByRule.set(a.ruleId, list);
        }
        return allRules.map(r => ({
            ...r,
            artifacts: artifactsByRule.get(r.id) || [],
        }));
    }
    async getRule(id) {
        const rule = await index_1.db.select().from(schema_1.rules).where((0, drizzle_orm_1.eq)(schema_1.rules.id, id)).get();
        if (!rule)
            return null;
        const artifacts = await index_1.db.select().from(schema_1.ruleArtifacts).where((0, drizzle_orm_1.eq)(schema_1.ruleArtifacts.ruleId, id)).all();
        return { ...rule, artifacts };
    }
    async createRule(text) {
        const now = Date.now();
        const result = await index_1.db.insert(schema_1.rules).values({ text, createdAt: now, updatedAt: now }).returning();
        return result[0];
    }
    async updateRule(id, text) {
        const existing = await index_1.db.select().from(schema_1.rules).where((0, drizzle_orm_1.eq)(schema_1.rules.id, id)).get();
        if (!existing)
            return null;
        await index_1.db.update(schema_1.rules).set({ text, updatedAt: Date.now() }).where((0, drizzle_orm_1.eq)(schema_1.rules.id, id));
        return { ...existing, text, updatedAt: Date.now() };
    }
    async deleteRule(id) {
        const existing = await index_1.db.select().from(schema_1.rules).where((0, drizzle_orm_1.eq)(schema_1.rules.id, id)).get();
        if (!existing)
            return false;
        // Clean up action-bundle skill directories
        const artifacts = await index_1.db.select().from(schema_1.ruleArtifacts).where((0, drizzle_orm_1.eq)(schema_1.ruleArtifacts.ruleId, id)).all();
        for (const a of artifacts) {
            if (a.type === 'action-bundle' && a.outputPath) {
                try {
                    fs.rmSync(a.outputPath, { recursive: true, force: true });
                }
                catch { }
            }
        }
        await index_1.db.delete(schema_1.ruleArtifacts).where((0, drizzle_orm_1.eq)(schema_1.ruleArtifacts.ruleId, id));
        await index_1.db.delete(schema_1.rules).where((0, drizzle_orm_1.eq)(schema_1.rules.id, id));
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
    async compileRule(id) {
        const rule = await index_1.db.select().from(schema_1.rules).where((0, drizzle_orm_1.eq)(schema_1.rules.id, id)).get();
        if (!rule)
            return null;
        // Mark as pending
        await index_1.db.delete(schema_1.ruleArtifacts).where((0, drizzle_orm_1.eq)(schema_1.ruleArtifacts.ruleId, id));
        const pendingArtifact = await index_1.db.insert(schema_1.ruleArtifacts).values({
            ruleId: id,
            type: 'pending',
            content: '',
            status: 'pending',
        }).returning();
        const artifactId = pendingArtifact[0].id;
        try {
            // Classify
            const type = await this.classifyRule(rule.text);
            // Generate content
            const content = this.generateArtifactContent(rule.text, type);
            // For action-bundles, write SKILL.md
            let outputPath = null;
            if (type === 'action-bundle') {
                outputPath = this.writeSkillFile(id, rule.text, content);
            }
            // Update artifact
            await index_1.db.update(schema_1.ruleArtifacts).set({
                type,
                content,
                outputPath,
                status: 'ok',
                compiledAt: Date.now(),
            }).where((0, drizzle_orm_1.eq)(schema_1.ruleArtifacts.id, artifactId));
            return {
                id: artifactId,
                ruleId: id,
                type,
                content,
                outputPath,
                status: 'ok',
                compiledAt: Date.now(),
            };
        }
        catch (err) {
            await index_1.db.update(schema_1.ruleArtifacts).set({
                type: 'policy-fragment',
                content: `Compilation failed: ${err.message}`,
                status: 'failed',
                compiledAt: Date.now(),
            }).where((0, drizzle_orm_1.eq)(schema_1.ruleArtifacts.id, artifactId));
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
    async classifyRule(text) {
        // Try LLM classification first (non-blocking, 15s timeout)
        try {
            const llmType = await this.llmClassify(text);
            if (llmType)
                return llmType;
        }
        catch {
            // Fall through to heuristic
        }
        // Heuristic classification
        if (GUARD_KEYWORDS.test(text))
            return 'guard';
        if (ACTION_KEYWORDS.test(text))
            return 'action-bundle';
        return 'policy-fragment';
    }
    /**
     * Optional LLM classification via OpenClaw's local gateway.
     */
    async llmClassify(text) {
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
            if (!res.ok)
                return null;
            const data = await res.json();
            const answer = (data.choices?.[0]?.message?.content || '').trim().toLowerCase();
            if (answer.includes('guard'))
                return 'guard';
            if (answer.includes('action-bundle'))
                return 'action-bundle';
            if (answer.includes('policy-fragment'))
                return 'policy-fragment';
            return null;
        }
        catch {
            clearTimeout(timeout);
            return null;
        }
    }
    /**
     * Generate artifact content based on type.
     */
    generateArtifactContent(ruleText, type) {
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
    generateSkillContent(ruleText) {
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
    writeSkillFile(ruleId, _ruleText, content) {
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
    async getCompiledPolicyView() {
        const artifacts = await index_1.db.select().from(schema_1.ruleArtifacts).all();
        const policies = artifacts
            .filter(a => a.type === 'policy-fragment' && a.status === 'ok')
            .map(a => a.content);
        const joined = policies.join('\n');
        return joined.length > 4000 ? joined.substring(0, 4000) + '\n...(truncated)' : joined;
    }
    /**
     * Get all active guard artifacts (for SOUL.md injection).
     */
    async getActiveGuards() {
        const artifacts = await index_1.db.select().from(schema_1.ruleArtifacts).all();
        return artifacts
            .filter(a => a.type === 'guard' && a.status === 'ok')
            .map(a => a.content);
    }
}
exports.RulesService = RulesService;
