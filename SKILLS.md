# Aibō Skills System 🧠

Aibō is built as a proper **OpenClaw wrapper**, which means you can extend it with custom skills just like any OpenClaw application.

## What is OpenClaw?

[OpenClaw](https://github.com/openclaw/openclaw-core) is an open-source AI agent framework that provides:
- Multi-channel messaging (Discord, Slack, iMessage, etc.)
- Extensible tool/skill system
- Node-side tool execution for secure API access
- Voice and GUI integrations

Aibō wraps OpenClaw to provide portfolio management as a specialized skill, but you can add any OpenClaw-compatible skill!

## Architecture

```
Aibō Desktop App (The Body)
    ↓
Local Server (port 3001)
    ↓ WebSocket
OpenClaw Gateway (port 18789) - The Brain
    ↓
Skills (portfolio, custom, etc.)
    ↓
Tools & Node Commands
```

## Built-in Skills

### Portfolio Management (`skills/portfolio/`)

The core Aibō skill that provides:
- Multi-chain wallet tracking (Solana + Base)
- Transaction history
- Market data and prices
- Portfolio analytics

**Available Commands:**
- `portfolio.get_summary` - High-level portfolio overview
- `portfolio.get_detailed_summary` - Full asset breakdown
- `portfolio.get_transactions` - Recent transaction history
- `wallet.add` - Add new wallet to tracking
- `market.get_price` - Get token prices

## Adding Your Own Skills

### Step 1: Create Skill Directory

```bash
mkdir -p skills/my-custom-skill
cd skills/my-custom-skill
```

### Step 2: Create `SKILL.md`

Every skill needs a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: my_custom_skill
description: "Brief description of what your skill does"
metadata:
  {
    "openclaw":
      {
        "emoji": "🎯",
        "requires": { "bins": ["some-cli-tool"] },
        "category": "productivity"
      }
  }
---

# My Custom Skill

Explain what your skill does and how the AI should use it.

## Available Commands

Document the commands/tools this skill provides.

## Usage Examples

Show example queries the user might ask.
```

### Step 3: (Optional) Add Node Commands

If your skill needs server-side tools (for API keys, database access, etc.), register them in `OpenClawClient.ts`:

```typescript
private async handleInvokeRequest(payload: any) {
    const { id, command, paramsJSON } = payload;
    const args = paramsJSON ? JSON.parse(paramsJSON) : {};

    switch (command) {
        case 'my_skill.my_command':
            result = await this.myCustomFunction(args);
            break;
        // ... existing commands
    }
}
```

### Step 4: Restart Aibō

```bash
npm run dev
```

OpenClaw will automatically discover your new skill in the `skills/` directory!

## Skill Discovery

OpenClaw loads skills from these locations (in order of precedence):

1. **`./skills/`** (Aibō workspace) - Your custom skills ⭐
2. **`~/.openclaw/skills/`** (Global managed skills)
3. **Bundled OpenClaw skills** (github, discord, etc.)

If the same skill name exists in multiple places, workspace skills win.

## Using ClawHub

Install community skills from [ClawHub](https://clawhub.com):

```bash
# Install a skill from ClawHub
npx clawhub install weather

# List installed skills
npx clawhub list

# Update all skills
npx clawhub update --all
```

Skills from ClawHub are installed to `./skills/` and load automatically.

## Example Skills You Can Add

### Weather Skill
Get weather forecasts in natural language

### GitHub Skill
Already bundled in OpenClaw! Manage PRs, issues, runs

### Discord Skill
Post messages to Discord channels

### Custom Data Sources
Connect to your company's APIs, databases, etc.

## Security Notes

⚠️ **Important:**
- Skills can execute code on your machine
- Only install skills from trusted sources
- Review `SKILL.md` and any scripts before enabling
- API keys in skills have access to your local environment

For sensitive operations, use node-side tools (registered in OpenClawClient) to keep credentials server-side.

## Skill Development Tips

### Keep Skills Focused
Each skill should do one thing well. Don't create a "utilities" skill with 20 unrelated commands.

### Use Clear Descriptions
The AI uses your `SKILL.md` to understand when and how to use your skill. Be specific!

### Test Locally
Use `openclaw agent --message "test my skill"` to verify before deploying.

### Share on ClawHub
If your skill is useful, publish it to ClawHub for others!

```bash
npx clawhub publish ./skills/my-skill
```

## Advanced: Plugin System
For complex integrations, OpenClaw supports plugins that can:
- Add multiple skills at once
- Provide custom UI components
- Hook into lifecycle events
- Add new tool types

See [OpenClaw Plugin SDK](https://openclaw.ai/docs/plugins) for details.

## Getting Help

- **OpenClaw Docs**: https://openclaw.ai/docs
- **ClawHub**: https://clawhub.com
- **Aibō Issues**: https://github.com/yourusername/aibo/issues

## Example Skill Template

See `skills/_template/` for a copy-paste template to start your own skill.
