---
name: portfolio
description: Track and manage your crypto portfolio across Solana and Base chains. View balances, monitor prices, analyze transactions, and add wallets — all through natural language. Powered by Aibo's secure backend with real-time data from Jupiter, CoinGecko, Helius, and Alchemy.
metadata:
  {
    "openclaw":
      {
        "emoji": "💼",
        "category": "finance",
        "requires": { "config": ["portfolio.enabled"] },
      },
  }
---

# Portfolio Management

Track, analyze, and manage your cryptocurrency portfolio across multiple chains using natural language. This skill provides the AI assistant with direct access to your wallet data through Aibo's secure backend — no API keys required from the user.

## Architecture

The portfolio skill runs as an **OpenClaw Node tool**, meaning commands execute server-side inside the Aibo desktop app:

1. **Brain** (OpenClaw Agent) receives your natural language request
2. Brain invokes the appropriate tool (e.g., `portfolio.get_summary`)
3. **Body** (Aibo Desktop) executes the tool against its local database and backend APIs
4. Results are returned to Brain for formatting and presentation

All wallet addresses are stored locally. All RPC calls and API requests are proxied through Aibo's backend — private keys are never accessed or stored.

## Available Tools

### Portfolio Summary

Get a quick overview of your total portfolio value and top holdings.

**Tool:** `portfolio.get_summary`

**Parameters:** None

**Returns:** Text summary with:
- Total portfolio value in USD
- 24-hour change percentage
- Top 5 assets by value (with symbol, value, and change)

**Example Response:**
```
Total Portfolio Value: $5,234.52
24h Change: +2.30%
Top Assets: Solana (SOL): $1,234.50 (+3.2%), Ethereum (ETH): $980.00 (+1.5%), ...
```

### Detailed Portfolio

Get the full portfolio breakdown as structured JSON — useful for analysis, comparisons, and charting.

**Tool:** `portfolio.get_detailed_summary`

**Parameters:** None

**Returns:** JSON object containing:
- `assets[]` — Array of all holdings:
  - `symbol` — Token ticker (e.g., "SOL")
  - `name` — Full token name
  - `balance` — Raw token balance
  - `value` — USD value
  - `price` — Current price per token
  - `change` — 24h percentage change
  - `chain` — "SOLANA" or "EVM"
  - `logo` — Token logo URL
  - `history[]` — Recent price sparkline data
- `totalValue` — Aggregate USD value
- `totalChange24h` — Portfolio-wide 24h change
- `growthValue` — Absolute dollar change

**Reference:** [references/portfolio-data.md](references/portfolio-data.md)

### Transaction History

Fetch recent transactions across all tracked wallets.

**Tool:** `portfolio.get_transactions`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wallets` | Array | No | Filter to specific wallets. If omitted, fetches all tracked wallets |

Each wallet object:
```json
{ "address": "8xJp...", "chainType": "solana", "label": "Main" }
```

**Returns:** Array of up to 10 recent transactions:
- `type` — Transaction type (Transfer, Swap, Stake, etc.)
- `amount` — Token amount
- `symbol` — Token symbol
- `time` — Human-readable timestamp
- `chain` — "SOLANA" or "EVM"
- `status` — Confirmation status
- `details` — Swap label if applicable (e.g., "SOL → USDC")

**Reference:** [references/transactions.md](references/transactions.md)

### Add Wallet

Add a wallet address to portfolio tracking. The wallet will be stored locally and included in all future portfolio queries.

**Tool:** `wallet.add`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Wallet address (Solana base58 or EVM hex) |
| `chainType` | string | Yes | `"solana"` or `"evm"` |
| `label` | string | No | Human-readable name for the wallet |

**Example:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "chainType": "evm",
  "label": "Trading Wallet"
}
```

**Returns:** Success confirmation or error if wallet is already tracked.

**Reference:** [references/wallet-management.md](references/wallet-management.md)

### Market Price

Fetch current price and market stats for any token by symbol.

**Tool:** `market.get_price`

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | Yes | Token ticker (e.g., "SOL", "ETH", "BTC", "JUP") |

**Returns:** Formatted string with:
- Current price in USD
- 24h change percentage
- Volume, market cap, FDV, and liquidity when available

**Reference:** [references/market-data.md](references/market-data.md)

### Body State

Query the current state of the Aibo desktop UI.

**Tool:** `body.get_state`

**Parameters:** None

**Returns:** JSON object:
- `activePage` — Current page (dashboard, wallet, chat, etc.)
- `activeWallet` — Currently selected wallet address (or null)
- `theme` — Current theme ("light" or "dark")

## Supported Chains

| Chain | Native Token | RPC Provider | Token Standard | Data Source |
|-------|-------------|-------------|----------------|------------|
| Solana | SOL | Helius | SPL Tokens | Jupiter Aggregator |
| Base (EVM) | ETH | Alchemy | ERC-20 | CoinGecko, DexScreener |

## Data Sources

| Data Type | Primary Source | Fallback | Cache TTL |
|-----------|---------------|----------|-----------|
| Token Prices | CoinGecko API | Stale cache | 60 seconds |
| Portfolio Balances | Helius (SOL) / Alchemy (EVM) | Backend Team proxy | Real-time |
| Transaction History | Helius (SOL) / Alchemy (EVM) | Backend Team proxy | Real-time |
| Market Stats | DexScreener, CoinGecko | Cached values | 60 seconds |
| Gas Prices | Blocknative | Default estimate | 5 minutes |
| Fear & Greed Index | alternative.me | Cached value | 5 minutes |

## Common Patterns

### Portfolio Check

Ask about your holdings in natural language:

- "What's my portfolio worth?"
- "Show me my complete portfolio"
- "How are my holdings doing today?"
- "Give me a breakdown of my assets"
- "What's my biggest holding?"

### Price Queries

Check token prices and market data:

- "What's the price of SOL?"
- "How much is ETH right now?"
- "Check the price of JUP"
- "Is BTC up or down today?"
- "Compare SOL and ETH prices"

### Transaction Review

Look at recent activity:

- "Show me my recent transactions"
- "What trades did I make today?"
- "Any recent swaps?"
- "Show Solana transactions only"
- "What was my last transaction?"

### Wallet Management

Add and organize wallets:

- "Add my Solana wallet: 8xJp..."
- "Track this EVM address: 0x742d..."
- "Add a Base wallet called Trading"
- "What wallets am I tracking?"

### Combined Queries

The Brain can chain multiple tools in one response:

- "What's my portfolio worth and what's the price of SOL?" → `portfolio.get_summary` + `market.get_price`
- "Show my holdings and recent swaps" → `portfolio.get_detailed_summary` + `portfolio.get_transactions`
- "Add this wallet and show me the balance: 8xJp..." → `wallet.add` + `portfolio.get_summary`

## Market Monitoring

The portfolio skill includes a built-in market volatility monitor that runs while connected to the Brain:

- **Monitored Assets:** SOL, ETH
- **Check Interval:** Every 60 seconds
- **Alert Threshold:** 1% price move triggers a status color change
- **High Volatility:** 2%+ move triggers additional visual effects

Alerts are dispatched as shell actions to the desktop UI (status color, vibration).

## Security

- **Local Storage:** Wallet addresses stored in encrypted local SQLite database
- **No Private Keys:** This skill never accesses or stores private keys
- **Proxied Requests:** All RPC and API calls go through Aibo's backend — user API keys are not exposed
- **Read-Only:** Portfolio tools are read-only (except `wallet.add` which stores an address locally)
- **Scoped Access:** Tools are registered with explicit OpenClaw scopes: `portfolio:read`, `wallet:manage`, `market:read`

## Integration with BankrBot

When the **bankr** skill is also installed, the two skills complement each other:

| Capability | Portfolio Skill | BankrBot |
|-----------|----------------|----------|
| View balances | Local wallet tracking | Bankr-managed wallets |
| Price queries | CoinGecko / DexScreener | Bankr AI agent |
| Transactions | Read-only history | Execute trades |
| Wallet management | Add/track addresses | Auto-provisioned wallets |
| Trading | Not supported | Full swap/bridge/DCA |
| Market research | Basic price data | Technical analysis, sentiment |

Use the **portfolio skill** for tracking your own self-custody wallets. Use **BankrBot** for trading and advanced market features.

## Troubleshooting

### No Wallets Tracked

If portfolio commands return "No wallets tracked":
1. Add a wallet using `wallet.add` or the Wallet page in the UI
2. Provide the full address and correct chain type

### Stale Prices

Price data is cached for 60 seconds. If prices seem outdated:
- CoinGecko may be rate-limited (free tier: 10-30 req/min)
- Check the server logs for `[PortfolioService]` warnings
- Cached prices are always preferred over no data

### Backend Connection

If portfolio data is unavailable:
- Ensure the Backend Team service is running on port 3001
- Check the `.env` file for correct API keys (Helius, Alchemy)
- The portfolio will return empty data gracefully if the backend is down

### Missing Tokens

If a token doesn't appear in your portfolio:
- Verify the token has a non-zero balance on-chain
- Some low-liquidity tokens may not have price data
- Token metadata is fetched from multiple sources with fallbacks

## Best Practices

### For Natural Language

1. Be specific about which chain when asking about tokens that exist on multiple chains
2. Use clear wallet labels when adding wallets (e.g., "Main Solana", "Trading Base")
3. Ask for summaries first, then drill into details if needed
4. Specify time context: "today's transactions" vs "recent transactions"

### For Accuracy

1. Portfolio values update in real-time, but prices cache for 60 seconds
2. Transaction history shows the most recent 10 entries per query
3. Small-balance dust tokens may appear in detailed summaries
4. USD values are approximate based on last cached price

---

**Quick Start:** Add your first wallet with "Track my Solana wallet: [address]", then ask "What's my portfolio worth?" to see it in action.
