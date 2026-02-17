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
exports.default = skillRoutes;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SkillRegistryService_1 = require("../services/SkillRegistryService");
const ICON_EXTENSIONS = ['.png', '.svg', '.jpg', '.jpeg', '.webp'];
async function skillRoutes(fastify) {
    const registry = SkillRegistryService_1.SkillRegistryService.getInstance();
    // Serve skill icon files
    fastify.get('/api/skills/:id/icon', async (request, reply) => {
        const id = request.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!id || id !== request.params.id) {
            return reply.code(400).send({ error: 'Invalid skill ID' });
        }
        const skill = await registry.getSkillById(id);
        if (!skill) {
            return reply.code(404).send({ error: 'Skill not found' });
        }
        for (const ext of ICON_EXTENSIONS) {
            const iconPath = path.join(skill.path, `icon${ext}`);
            if (fs.existsSync(iconPath)) {
                const mimeTypes = {
                    '.png': 'image/png',
                    '.svg': 'image/svg+xml',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.webp': 'image/webp',
                };
                reply.header('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                reply.header('Cache-Control', 'public, max-age=3600');
                return fs.createReadStream(iconPath);
            }
        }
        return reply.code(404).send({ error: 'No icon found' });
    });
    // Get all skills (cached via registry)
    fastify.get('/api/skills', async () => {
        const skills = await registry.getAllSkills();
        return { skills };
    });
    // Toggle a skill's enabled state
    fastify.post('/api/skills/toggle', async (request, reply) => {
        const { skillName, enabled } = request.body;
        if (!skillName || typeof skillName !== 'string') {
            return reply.code(400).send({ error: 'skillName is required.' });
        }
        if (skillName.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(skillName)) {
            return reply.code(400).send({ error: 'Invalid skill name.' });
        }
        if (['__proto__', 'constructor', 'prototype'].includes(skillName)) {
            return reply.code(400).send({ error: 'Invalid skill name.' });
        }
        if (typeof enabled !== 'boolean') {
            return reply.code(400).send({ error: 'enabled must be a boolean.' });
        }
        await registry.toggleSkill(skillName, enabled);
        return { success: true };
    });
    // Get a specific skill by ID (with full content)
    fastify.get('/api/skills/:id', async (request, reply) => {
        const id = request.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!id || id !== request.params.id) {
            return reply.code(400).send({ error: 'Invalid skill ID' });
        }
        const skill = await registry.getSkillById(id);
        if (!skill) {
            return reply.code(404).send({ error: 'Skill not found' });
        }
        const content = registry.getSkillContent(skill);
        return { ...skill, content };
    });
    // Get env var config for a skill (required vars + current values, masked)
    fastify.get('/api/skills/:id/env', async (request, reply) => {
        const id = request.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!id || id !== request.params.id) {
            return reply.code(400).send({ error: 'Invalid skill ID' });
        }
        const skill = await registry.getSkillById(id);
        if (!skill) {
            return reply.code(404).send({ error: 'Skill not found' });
        }
        const env = await registry.getSkillEnv(id);
        const requiredEnv = skill.requiredEnv || [];
        // Build response with masked values
        const vars = {};
        for (const key of requiredEnv) {
            const val = env[key] || '';
            vars[key] = {
                value: val ? maskValue(val) : '',
                isSet: !!val,
            };
        }
        return { requiredEnv, vars };
    });
    // Set env vars for a skill
    fastify.post('/api/skills/:id/env', async (request, reply) => {
        const id = request.params.id.replace(/[^a-zA-Z0-9_-]/g, '');
        if (!id || id !== request.params.id) {
            return reply.code(400).send({ error: 'Invalid skill ID' });
        }
        const skill = await registry.getSkillById(id);
        if (!skill) {
            return reply.code(404).send({ error: 'Skill not found' });
        }
        const { env } = request.body;
        if (!env || typeof env !== 'object') {
            return reply.code(400).send({ error: 'env must be an object' });
        }
        // Only allow setting keys that are in requiredEnv (or any key for workspace skills)
        const allowedKeys = new Set(skill.requiredEnv || []);
        const sanitized = {};
        for (const [key, value] of Object.entries(env)) {
            if (typeof key !== 'string' || typeof value !== 'string')
                continue;
            if (key.length > 128 || !/^[A-Z][A-Z0-9_]*$/.test(key))
                continue;
            if (allowedKeys.size > 0 && !allowedKeys.has(key))
                continue;
            sanitized[key] = value;
        }
        // Merge with existing env (keep values not being updated)
        const existing = await registry.getSkillEnv(id);
        const merged = { ...existing, ...sanitized };
        // Remove empty values
        for (const key of Object.keys(merged)) {
            if (!merged[key])
                delete merged[key];
        }
        await registry.setSkillEnv(id, merged);
        return { success: true };
    });
}
function maskValue(val) {
    if (val.length <= 8)
        return '*'.repeat(val.length);
    return val.substring(0, 4) + '*'.repeat(Math.min(val.length - 4, 20));
}
