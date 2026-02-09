# Aibō OS: The Embodied Desktop Crypto Agent

Aibō OS is a local-first desktop companion designed to bridge the gap between complex blockchain data and intuitive, natural language interaction. It "embodies" the OpenClaw Brain into a sleek, reactive desktop interface.

## 🧠 The Architecture: Brain & Body

Aibō follows a **Brain-Body** orchestration pattern:
- **The Body (Desktop Aibo)**: A React/Vite/Electron frontend that manages the UI, local wallet databases, and system-level interactions.
- **The Brain (OpenClaw Core)**: A high-performance agent framework embedded within the application. It handles intent recognition, tool execution, and LLM orchestration.
- **The Nervous System (OpenClawClient)**: A real-time bridge that allows the Brain to query the Body's data (e.g., "What's my SOL balance?") and the Body to react to the Brain's decisions (e.g., Turning the UI red during market volatility).

## ✨ Key Features

- **Local-First Privacy**: Your wallet data and orchestration logic live on your machine.
- **Assistant Skills**: Integrated tools for portfolio tracking, transaction history, and wallet management.
- **Hybrid Brain Engine**: Support for cloud models (Anthropic/OpenAI) or fully local execution via Ollama.
- **Reactive UI**: A dynamic "Neural Link" interface that visualizes the AI's internal state and reactions.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite, Vanilla CSS (The Smooth UI).
- **Backend**: Fastify, Drizzle ORM, Better-SQLite3.
- **Agent Framework**: [OpenClaw Core](https://github.com/openclaw/openclaw-core-proto).
- **Blockchain**: Viem (EVM), @solana/web3.js (Solana).

## 🚀 Getting Started

1. **Clone the repo** (including submodules for the core).
2. **Setup environment**:
   ```bash
   cp .env.example .env
   # Add your RPC URLs and API keys
   ```
3. **Install dependencies**:
   ```bash
   npm install
   cd server/openclaw-core && pnpm install
   ```
4. **Run in Dev Mode**:
   ```bash
   npm run dev
   ```

## 📜 Legal & Open Source
Aibō OS is released under the MIT License. Built with ❤️ for the decentralized future.
