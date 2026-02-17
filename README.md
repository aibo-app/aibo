# Aibō OS: The Embodied Desktop Crypto Agent

Aibō OS is a local-first desktop companion designed to bridge the gap between complex blockchain data and intuitive, natural language interaction. Built as a proper **OpenClaw wrapper**, Aibō provides portfolio management as a skill while maintaining full extensibility for custom skills.

## 🧠 The Architecture

Aibō follows a **Brain-Body** orchestration pattern:

*   **The Body (Desktop Aibo)**: This repository. A React/Vite/Electron frontend that manages the UI, local wallet databases, and system-level interactions.
*   **The Brain (OpenClaw Core)**: Included as a submodule. A high-performance agent framework embedded within the application.
*   **The Soul (Backend Team)**: *Proprietary.* A separate service that handles high-frequency blockchain indexing, data aggregation, and secure AI proxying.

> **Note for Open Source Users**: This repository contains the **Body** and the **Brain**. The "Soul" (Backend Team) is proprietary and not included.
> 
> *   **What works**: The desktop app, local wallet management, OpenClaw agent core, custom skills, and local AI (Ollama).
> *   **What requires configuration**: Portfolio data, transaction history, and cloud AI (Anthropic/OpenAI) usually proxy through the "Soul". You can configure your own API keys in the Settings to bypass this for chat/AI, but some specific crypto data aggregations may return empty results.

## ✨ Key Features

*   **Local-First Privacy**: Your wallet data and orchestration logic live on your machine.
*   **OpenClaw-Powered**: Full OpenClaw agent framework with extensible skills system.
*   **Extensible Architecture**: Add custom skills for any use case - not just crypto!
*   **Hybrid Brain Engine**: Support for cloud models (Anthropic/OpenAI) or fully local execution via Ollama.
*   **Reactive UI**: A dynamic "Neural Link" interface that visualizes the AI's internal state and reactions.

## 🛠️ Tech Stack

*   **Frontend**: React, TypeScript, Vite, Vanilla CSS (The Smooth UI).
*   **Backend**: Fastify, Drizzle ORM, Better-SQLite3.
*   **Agent Framework**: [OpenClaw Core](https://github.com/Start-Impulse/openclaw-core).
*   **Blockchain**: Viem (EVM), @solana/web3.js (Solana).

## 🚀 Getting Started

1.  **Clone the repo** (including submodules for the core).
2.  **Setup environment**:
    ```bash
    cp .env.example .env
    # Add your RPC URLs and API keys
    ```
3.  **Install dependencies**:
    ```bash
    npm install
    cd server/openclaw-core && pnpm install
    ```
4.  **Run in Dev Mode**:
    ```bash
    npm run dev
    ```
    *Note: The startup script will skip the `backend-team` service if the folder is missing.*

## 📜 Legal & License

Aibō OS (The Body & Brain integration) is released under the MIT License.
The "Backend Team" services are proprietary.

Built with ❤️ for the decentralized future.
