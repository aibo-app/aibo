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
exports.SkillRegistryService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const SettingsService_1 = require("./SettingsService");
const ICON_EXTENSIONS = ['.png', '.svg', '.jpg', '.jpeg', '.webp'];
/**
 * SkillRegistryService — Single source of truth for skill discovery.
 *
 * Scans bundled (openclaw-core/skills) and workspace (skills/) directories,
 * parses SKILL.md metadata + commands, and caches results in memory.
 * All consumers (routes, config service) go through here.
 */
class SkillRegistryService {
    static instance;
    coreDir = '';
    /** In-memory cache — invalidated on toggle or explicit clear */
    cachedSkills = null;
    constructor() { }
    static getInstance() {
        if (!SkillRegistryService.instance) {
            SkillRegistryService.instance = new SkillRegistryService();
        }
        return SkillRegistryService.instance;
    }
    setCoreDir(dir) {
        this.coreDir = dir;
        this.cachedSkills = null; // invalidate on reconfigure
    }
    getCoreDir() {
        return this.coreDir;
    }
    /** Clear cached skills (call after installing/removing skills) */
    invalidateCache() {
        this.cachedSkills = null;
    }
    /**
     * Get all discovered skills (cached). Scans filesystem on first call,
     * then serves from memory until invalidated.
     */
    async getAllSkills() {
        if (this.cachedSkills)
            return this.cachedSkills;
        const skills = [];
        // Scan workspace skills first (they override bundled with same ID)
        const workspaceDir = this.resolveWorkspaceSkillsDir();
        if (workspaceDir) {
            skills.push(...this.scanDir(workspaceDir, 'workspace'));
        }
        // Scan bundled skills from openclaw-core
        if (this.coreDir) {
            const bundledDir = path.join(this.coreDir, 'skills');
            if (fs.existsSync(bundledDir)) {
                const workspaceIds = new Set(skills.map(s => s.id));
                const bundled = this.scanDir(bundledDir, 'bundled')
                    .filter(s => !workspaceIds.has(s.id));
                skills.push(...bundled);
            }
        }
        // Attach enabled state
        const config = await this.getSkillsConfig();
        for (const skill of skills) {
            const entry = config.entries?.[skill.id];
            // Workspace skills default enabled, bundled default disabled
            skill.enabled = entry?.enabled ?? (skill.source === 'workspace');
        }
        this.cachedSkills = skills;
        return skills;
    }
    /**
     * Get only enabled skills that have node commands.
     * Used by OpenClawConfigService for allowCommands + SOUL.md.
     */
    async getEnabledNodeCommands() {
        const skills = await this.getAllSkills();
        const commands = [];
        for (const skill of skills) {
            if (!skill.enabled)
                continue;
            // Only extract **Tool:** node commands for gateway/SOUL.md (not the broader UI set)
            const content = this.getSkillContent(skill);
            const nodeCommands = this.extractNodeCommands(content);
            if (nodeCommands.length === 0)
                continue;
            const descriptions = this.extractCommandDescriptions(skill.path);
            for (const cmd of nodeCommands) {
                commands.push({
                    name: cmd,
                    description: descriptions.get(cmd) || cmd,
                    skillName: skill.name,
                });
            }
        }
        return commands;
    }
    /**
     * Toggle a skill's enabled state. Invalidates cache + regenerates config.
     */
    async toggleSkill(skillName, enabled) {
        const settingsService = SettingsService_1.SettingsService.getInstance();
        const config = await settingsService.getJSON('OPENCLAW_SKILLS_CONFIG') || {};
        config.entries = config.entries || {};
        config.entries[skillName] = {
            ...(config.entries[skillName] || { enabled: false }),
            enabled,
        };
        await settingsService.setJSON('OPENCLAW_SKILLS_CONFIG', config);
        this.cachedSkills = null; // invalidate
        // Lazy import to break circular dependency (OpenClawConfigService → SkillRegistryService)
        const { OpenClawConfigService } = await Promise.resolve().then(() => __importStar(require('./OpenClawConfigService')));
        await OpenClawConfigService.getInstance().generateConfig();
    }
    async getSkillsConfig() {
        const settingsService = SettingsService_1.SettingsService.getInstance();
        return await settingsService.getJSON('OPENCLAW_SKILLS_CONFIG') || {};
    }
    /**
     * Get the current env var values for a skill (from SkillsConfig).
     * Returns { key: value } for each required env var. Missing keys have empty string.
     */
    async getSkillEnv(skillId) {
        const config = await this.getSkillsConfig();
        const entry = config.entries?.[skillId];
        return entry?.env || {};
    }
    /**
     * Set env var values for a skill. Merges with existing config, regenerates gateway config.
     */
    async setSkillEnv(skillId, env) {
        const settingsService = SettingsService_1.SettingsService.getInstance();
        const config = await settingsService.getJSON('OPENCLAW_SKILLS_CONFIG') || {};
        config.entries = config.entries || {};
        config.entries[skillId] = {
            ...(config.entries[skillId] || { enabled: false }),
            env,
        };
        await settingsService.setJSON('OPENCLAW_SKILLS_CONFIG', config);
        this.cachedSkills = null;
        // Regenerate gateway config so OpenClaw picks up the new env vars
        const { OpenClawConfigService } = await Promise.resolve().then(() => __importStar(require('./OpenClawConfigService')));
        await OpenClawConfigService.getInstance().generateConfig();
    }
    /**
     * Check if a binary is available on PATH.
     */
    isBinInstalled(bin) {
        try {
            (0, child_process_1.execSync)(`which ${bin}`, { stdio: 'ignore' });
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get full skill status for SOUL.md generation.
     * Returns enabled skills with their dependency/env status.
     */
    async getSkillStatusForBrain() {
        const skills = await this.getAllSkills();
        const statuses = [];
        for (const skill of skills) {
            if (!skill.enabled)
                continue;
            const missingBins = [];
            if (skill.requiredBins) {
                for (const bin of skill.requiredBins) {
                    if (!this.isBinInstalled(bin))
                        missingBins.push(bin);
                }
            }
            if (skill.anyBins && skill.anyBins.length > 0) {
                const hasAny = skill.anyBins.some(b => this.isBinInstalled(b));
                if (!hasAny)
                    missingBins.push(...skill.anyBins);
            }
            const missingEnv = [];
            if (skill.requiredEnv) {
                const env = await this.getSkillEnv(skill.id);
                for (const key of skill.requiredEnv) {
                    if (!env[key])
                        missingEnv.push(key);
                }
            }
            statuses.push({
                id: skill.id,
                name: skill.name,
                description: skill.description,
                emoji: skill.emoji,
                ready: missingBins.length === 0 && missingEnv.length === 0,
                missingBins,
                missingEnv,
                installOptions: skill.installOptions,
            });
        }
        return statuses;
    }
    /**
     * Get a single skill by ID.
     */
    async getSkillById(id) {
        const skills = await this.getAllSkills();
        return skills.find(s => s.id === id) || null;
    }
    /**
     * Read the raw SKILL.md content for a skill (for detail view).
     */
    getSkillContent(skill) {
        const mdPath = path.join(skill.path, 'SKILL.md');
        try {
            return fs.readFileSync(mdPath, 'utf-8');
        }
        catch {
            return '';
        }
    }
    // --- Internal scanning ---
    resolveWorkspaceSkillsDir() {
        if (this.coreDir) {
            const dir = path.resolve(this.coreDir, '..', '..', 'skills');
            if (fs.existsSync(dir))
                return dir;
        }
        const cwdDir = path.join(process.cwd(), 'skills');
        if (fs.existsSync(cwdDir))
            return cwdDir;
        return null;
    }
    scanDir(dir, source) {
        const skills = [];
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return skills;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.'))
                continue;
            const skillPath = path.join(dir, entry.name);
            const skillMdPath = path.join(skillPath, 'SKILL.md');
            if (!fs.existsSync(skillMdPath)) {
                if (source === 'workspace') {
                    skills.push({
                        id: entry.name,
                        name: entry.name,
                        description: 'No SKILL.md found',
                        source,
                        path: skillPath,
                        commands: [],
                        status: 'error',
                        error: 'Missing SKILL.md file',
                    });
                }
                continue;
            }
            try {
                const content = fs.readFileSync(skillMdPath, 'utf-8');
                const meta = this.parseFrontmatter(content);
                const commands = this.extractCommands(content);
                const icon = this.findIcon(skillPath, entry.name);
                skills.push({
                    id: entry.name,
                    name: meta.name || entry.name,
                    description: meta.description || 'No description provided',
                    emoji: meta.emoji,
                    category: meta.category,
                    source,
                    path: skillPath,
                    commands,
                    icon,
                    ...(meta.requiredEnv?.length ? { requiredEnv: meta.requiredEnv } : {}),
                    ...(meta.requiredBins?.length ? { requiredBins: meta.requiredBins } : {}),
                    ...(meta.anyBins?.length ? { anyBins: meta.anyBins } : {}),
                    ...(meta.installOptions?.length ? { installOptions: meta.installOptions } : {}),
                    status: 'loaded',
                });
            }
            catch (err) {
                skills.push({
                    id: entry.name,
                    name: entry.name,
                    description: 'Error loading skill',
                    source,
                    path: skillPath,
                    commands: [],
                    status: 'error',
                    error: err.message,
                });
            }
        }
        return skills;
    }
    parseFrontmatter(content) {
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match)
            return {};
        const fm = match[1];
        const result = {};
        for (const line of fm.split('\n')) {
            const [key, ...valueParts] = line.split(':');
            if (!key || valueParts.length === 0)
                continue;
            const k = key.trim().toLowerCase();
            const v = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
            if (k === 'name')
                result.name = v;
            if (k === 'description')
                result.description = v;
        }
        const emojiMatch = fm.match(/["']?emoji["']?:\s*["']?(.+?)["']?(?:,|$)/);
        if (emojiMatch)
            result.emoji = emojiMatch[1];
        const catMatch = fm.match(/["']?category["']?:\s*["']?(.+?)["']?(?:,|$)/);
        if (catMatch)
            result.category = catMatch[1];
        // Extract metadata JSON for requires + install
        let requiredEnv;
        let requiredBins;
        let anyBins;
        let installOptions;
        const metadataIdx = fm.indexOf('metadata:');
        if (metadataIdx >= 0) {
            const afterMetadata = fm.substring(metadataIdx + 'metadata:'.length);
            const firstBrace = afterMetadata.indexOf('{');
            if (firstBrace >= 0) {
                let depth = 0;
                let end = -1;
                for (let i = firstBrace; i < afterMetadata.length; i++) {
                    if (afterMetadata[i] === '{')
                        depth++;
                    else if (afterMetadata[i] === '}') {
                        depth--;
                        if (depth === 0) {
                            end = i;
                            break;
                        }
                    }
                }
                if (end > firstBrace) {
                    try {
                        // Strip trailing commas (SKILL.md uses relaxed JSON)
                        const jsonStr = afterMetadata.substring(firstBrace, end + 1)
                            .replace(/,\s*([\]}])/g, '$1');
                        const json = JSON.parse(jsonStr);
                        const oc = json.openclaw || json.clawdbot || json;
                        if (oc?.requires?.env && Array.isArray(oc.requires.env)) {
                            requiredEnv = oc.requires.env;
                        }
                        if (oc?.requires?.bins && Array.isArray(oc.requires.bins)) {
                            requiredBins = oc.requires.bins;
                        }
                        if (oc?.requires?.anyBins && Array.isArray(oc.requires.anyBins)) {
                            anyBins = oc.requires.anyBins;
                        }
                        if (oc?.install && Array.isArray(oc.install)) {
                            installOptions = oc.install;
                        }
                    }
                    catch { /* ignore parse errors */ }
                }
            }
        }
        return { ...result, requiredEnv, requiredBins, anyBins, installOptions };
    }
    /**
     * Extract all displayable commands from a SKILL.md.
     * Covers multiple documentation patterns used by workspace and bundled skills.
     */
    extractCommands(content) {
        const commands = [];
        const seen = new Set();
        const add = (cmd) => {
            if (seen.has(cmd))
                return;
            // Skip if this is a prefix of an already-added command (e.g. `bankr prompt` vs `bankr prompt <text>`)
            for (const existing of seen) {
                if (existing.startsWith(cmd + ' ') || existing.startsWith(cmd + '\t'))
                    return;
            }
            seen.add(cmd);
            commands.push(cmd);
        };
        let m;
        // 1. **Tool:** markers — node commands (primary)
        const toolRegex = /\*\*Tool:\*\*\s*`([^`]+)`/g;
        while ((m = toolRegex.exec(content)) !== null) {
            add(m[1]);
        }
        // 2. Markdown table rows with backtick-wrapped commands in first column
        //    Matches: | `bankr login` | description |
        const tableRowRegex = /^\|\s*`([^`]+)`\s*\|/gm;
        while ((m = tableRowRegex.exec(content)) !== null) {
            const cmd = m[1].trim();
            // Skip table headers, env vars (ALL_CAPS), URLs, parameter names
            if (/^(Command|Variable|Endpoint|Action|Method)$/i.test(cmd))
                continue;
            if (/^[A-Z][A-Z_]+$/.test(cmd))
                continue;
            if (cmd.startsWith('/') || cmd.startsWith('http'))
                continue;
            // Skip single words without dots/spaces — likely parameter names (e.g. `address`, `chainType`)
            if (!/[\s.]/.test(cmd))
                continue;
            add(cmd);
        }
        // 3. JSON "action": "value" patterns (discord, slack skills)
        const actionRegex = /"action"\s*:\s*"([a-zA-Z]\w+)"/g;
        while ((m = actionRegex.exec(content)) !== null) {
            add(m[1]);
        }
        // 4. Backtick commands in list items — bullet (- / *) and numbered (1.)
        //    Matches: - Today: `remindctl today` or 5. Sign in: `op signin`
        const listLineRegex = /^(?:[-*]|\d+\.)\s+.+$/gm;
        let listMatch;
        while ((listMatch = listLineRegex.exec(content)) !== null) {
            const line = listMatch[0];
            const backtickRegex = /`([^`]+)`/g;
            let btMatch;
            while ((btMatch = backtickRegex.exec(line)) !== null) {
                let cmd = btMatch[1].trim();
                // Strip quoted strings, angle-bracket placeholders, bracket args, trailing flags
                cmd = cmd.replace(/\s+["<\[].*$/, '').replace(/\s+--\S.*$/, '').trim();
                // Strip trailing words containing uppercase (placeholders like KEY_HERE)
                cmd = cmd.replace(/\s+\S*[A-Z]\S*.*$/, '').trim();
                // Must look like a CLI command: lowercase tool + space + lowercase subcommand
                if (!/^[a-z][\w.-]+\s+[a-z]/.test(cmd))
                    continue;
                // Skip install/setup commands
                if (/^(brew|apt|pnpm|npm|pip|cargo|go|bun|npx)\s/i.test(cmd))
                    continue;
                // Skip generic system commands
                if (/^(curl|echo|mkdir|cd|ls|cat|export|source|chmod|sudo|git|docker|make)\b/i.test(cmd))
                    continue;
                // Skip if contains English stopwords (prose, not a command)
                if (/\b(the|is|are|to|for|with|from|and|or|not|this|that|can|will|has|was|been|its|your)\b/i.test(cmd))
                    continue;
                // Skip paths, flags, file globs
                if (cmd.includes('/') || cmd.startsWith('-') || cmd.startsWith('.'))
                    continue;
                add(cmd);
            }
        }
        // 5. Bash code block first-line commands (github gh commands, etc.)
        //    Language marker REQUIRED to avoid matching closing ``` as opening
        const codeBlockRegex = /```(?:bash|sh|shell)\n\s*([^\n]+)/g;
        while ((m = codeBlockRegex.exec(content)) !== null) {
            let line = m[1].trim();
            // Skip comments, variable assignments, shell constructs
            if (line.startsWith('#') || /^[A-Z_]+=/.test(line) || /^(if|for|while|do|then|else)\b/.test(line))
                continue;
            // Extract only strictly-lowercase words (rejects uppercase, flags, quotes, vars)
            const words = line.split(/\s+/).filter(w => /^[a-z][a-z0-9._-]*$/.test(w));
            if (words.length < 2)
                continue;
            let cmd = words.slice(0, Math.min(3, words.length)).join(' ');
            cmd = cmd.replace(/\s+\d+$/, '').trim();
            // Must look like a CLI command: lowercase tool + space + lowercase subcommand
            if (!/^[a-z][\w-]+\s+[a-z][\w-]*/.test(cmd))
                continue;
            // Skip generic system/install commands and curl API calls
            if (/^(curl|brew|apt|pnpm|npm|pip|cargo|echo|mkdir|cd|ls|cat|export|source|chmod|sudo|docker|make|tmux|sleep|git|bun|npx|jq|sed|awk|grep|find|xargs|tee|sort|uniq|wc|diff|tar|zip|ssh|scp|rsync|wget|nc|nohup)\b/i.test(cmd))
                continue;
            add(cmd);
        }
        // 6. ### Section headers above code blocks — fallback for API/curl-based skills
        //    Only fires when patterns 1-5 found nothing (trello, notion, weather)
        if (commands.length === 0) {
            const headerCodeRegex = /^###\s+(.+)\n\n```/gm;
            while ((m = headerCodeRegex.exec(content)) !== null) {
                const header = m[1].trim();
                if (header.length > 50)
                    continue;
                // Skip setup/config/reference sections
                if (/^(setup|install|config|prerequisite|reference|note|example|guardrail|usage|requirement)/i.test(header))
                    continue;
                add(header);
            }
        }
        return commands;
    }
    /**
     * Extract only **Tool:** node commands (used for gateway allowCommands + SOUL.md).
     * Separate from extractCommands() which is broader for UI display.
     */
    extractNodeCommands(content) {
        const commands = [];
        const toolRegex = /\*\*Tool:\*\*\s*`([^`]+)`/g;
        let m;
        while ((m = toolRegex.exec(content)) !== null) {
            commands.push(m[1]);
        }
        return commands;
    }
    /**
     * Extract command → description map by looking at ### headers above **Tool:** lines.
     */
    extractCommandDescriptions(skillPath) {
        const map = new Map();
        const mdPath = path.join(skillPath, 'SKILL.md');
        let content;
        try {
            content = fs.readFileSync(mdPath, 'utf-8');
        }
        catch {
            return map;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const toolMatch = lines[i].match(/\*\*Tool:\*\*\s*`([a-zA-Z_][a-zA-Z0-9_.]+)`/);
            if (!toolMatch)
                continue;
            let description = toolMatch[1];
            for (let j = i - 1; j >= 0; j--) {
                const headerMatch = lines[j].match(/^###\s+(.+)/);
                if (headerMatch) {
                    description = headerMatch[1].trim();
                    break;
                }
            }
            map.set(toolMatch[1], description);
        }
        return map;
    }
    findIcon(skillDir, skillId) {
        for (const ext of ICON_EXTENSIONS) {
            if (fs.existsSync(path.join(skillDir, `icon${ext}`))) {
                return `/api/skills/${skillId}/icon`;
            }
        }
        return undefined;
    }
}
exports.SkillRegistryService = SkillRegistryService;
