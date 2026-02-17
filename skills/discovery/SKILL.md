---
name: discovery
description: Discover trending tokens and new AI-launched agents on Base. Use when asked about trending coins, clanker, or new launches.
metadata:
  {
    "openclaw":
      {
        "emoji": "🚀",
        "category": "alpha",
        "requires": { "config": ["discovery.enabled"] },
      },
  }
---

# Alpha Discovery

Find "Alpha" (early opportunities) on the Base network. This skill connects to Aibō's high-frequency discovery engine.

## Available Tools

### Trending Tokens
Get a list of tokens with high volume relative to their age on Base.

**Tool:** `discovery.get_trending`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Number of tokens to return (default: 5) |

### Clanker AI Tokens
Get the latest AI agents launched via the Clanker protocol on Base.

**Tool:** `discovery.get_clanker`

**Parameters:** None

## Troubleshooting
- If no tokens appear, verify the `backend-team` service is running on port 4000.
- Data quality depends on DexScreener and Helius aggregation.
