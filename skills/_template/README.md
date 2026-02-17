# Skill Template

Copy this directory to create your own custom skill!

## Quick Start

1. **Copy the template:**
   ```bash
   cp -r skills/_template skills/my-new-skill
   cd skills/my-new-skill
   ```

2. **Edit `SKILL.md`:**
   - Update the `name` in frontmatter
   - Write clear description
   - Document your commands/tools
   - Add example queries

3. **Restart Aibō:**
   ```bash
   npm run dev
   ```

4. **Test your skill:**
   Ask the AI to use your new skill!

## Skill Types

### Simple Skills (Bash-only)

If your skill just wraps CLI tools, you don't need any code. Just write good instructions in `SKILL.md`:

```markdown
---
name: weather
description: "Get weather forecasts using wttr.in"
---

# Weather Skill

To get the weather, use:

\`\`\`bash
curl "wttr.in/CityName?format=3"
\`\`\`

The output will be "CityName: ⛅️ +23°C".
```

### Node Commands (Server-side)

For skills that need:
- API keys
- Database access
- Secure credentials
- Complex logic

You'll need to register a node command in `server/services/OpenClawClient.ts`:

```typescript
case 'my_skill.my_command':
    result = await this.mySkillCommand(args);
    break;

// Then implement:
private async mySkillCommand(args: { param: string }) {
    // Your logic here with access to db, APIs, etc.
    return { success: true, data: "result" };
}
```

## Examples

Check these real skills for inspiration:
- `skills/portfolio/` - Node commands for portfolio data
- OpenClaw bundled skills (`server/openclaw-core/skills/`):
  - `github/` - GitHub CLI wrapper
  - `discord/` - Discord posting
  - `canvas/` - Screen capture

## Publishing

Share your skill on ClawHub:

```bash
npx clawhub publish ./skills/my-skill
```

## Need Help?

- Read [SKILLS.md](../../SKILLS.md) for full documentation
- Check [OpenClaw docs](https://openclaw.ai/docs)
- See [ClawHub](https://clawhub.com) for examples
