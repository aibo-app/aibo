---
name: my_skill_name
description: "A brief, clear description of what this skill does (one sentence)"
metadata:
  {
    "openclaw":
      {
        "emoji": "🎯",
        "requires":
          {
            # Uncomment if your skill needs specific CLI tools:
            # "bins": ["gh", "docker"],

            # Uncomment if your skill needs config values:
            # "config": ["my_skill.enabled", "my_skill.api_key"]
          },
        "category": "productivity",

        # Optional: Installation instructions for required binaries
        # "install": [
        #   {
        #     "id": "brew",
        #     "kind": "brew",
        #     "formula": "my-tool",
        #     "bins": ["my-tool"],
        #     "label": "Install My Tool (Homebrew)"
        #   }
        # ]
      }
  }
---

# My Skill Name

A more detailed description of what this skill does and when the AI should use it.

## When to Use This Skill

Describe the scenarios where this skill is helpful:
- User asks about X
- User wants to do Y
- When Z information is needed

## Available Commands/Tools

### Command Name

**Tool:** `skillname.command_name`

IMPORTANT: The **Tool:** line above is how Aibō auto-discovers node commands.
Skills that define node commands MUST use this exact pattern: **Tool:** `prefix.action`
The command is automatically added to the gateway allowlist and SOUL.md.

**Parameters:**
- `param1` (required): Description
- `param2` (optional): Description with default value

**Returns:**
Format of the data returned

**Example:**
```json
// Node command params (passed as invokeParamsJson)
{
  "param1": "value",
  "param2": 123
}
```

```bash
# If using bash tool instead of node commands
some-command --flag value
```

## Usage Guidelines

- Important tips for the AI when using this skill
- Any caveats or limitations
- Best practices

## Example Queries

Show what users might ask:

**User:** "Do X for me"
→ Use `command.name` with parameters: {...}

**User:** "Show me Y"
→ Use `command.list` and format as table

## Security & Privacy

If this skill handles sensitive data:
- What data is accessed
- Where credentials are stored
- Any security considerations

## Dependencies

List any:
- External APIs used
- CLI tools required
- Configuration needed

## Configuration

If this skill needs config in `~/.openclaw/openclaw.json`:

```json
{
  "my_skill": {
    "enabled": true,
    "api_key": "your-key-here",
    "options": {
      "some_setting": "value"
    }
  }
}
```

## Advanced Usage

Any power-user features or advanced scenarios.

## Troubleshooting

Common issues and how to fix them.

## Related Skills

Link to other skills that work well with this one.
