/**
 * Application Constants
 * Centralized configuration values used throughout the app
 */

// ===== POLLING INTERVALS =====
export const POLLING_INTERVALS = {
  DATA_REFRESH: 60000, // 60s - Portfolio, transactions, global stats
  STATUS_CHECK: 30000, // 30s - OpenClaw brain connection status
  MARKET_TRENDS: 60000, // 60s - Market ticker data
} as const;

// ===== TIMEOUTS =====
export const TIMEOUTS = {
  AGENT_ACTION_DISPLAY: 5000, // 5s - How long to show agent action overlays
  ONBOARDING_REDIRECT: 2000, // 2s - Delay before redirecting after onboarding
  FOCUS_DELAY: 50, // 50ms - Focus trap delay for assistant popup
} as const;

// ===== API ENDPOINTS =====
export const DEFAULT_ENDPOINTS = {
  OLLAMA: 'http://localhost:11434',
} as const;

// ===== EXTERNAL SERVICES =====
export const EXTERNAL_URLS = {
  DICEBEAR_AVATAR: 'https://api.dicebear.com/7.x/identicon/svg',
  COINGECKO_CDN: 'https://assets.coingecko.com/coins/images',
} as const;

// ===== TTS CONFIGURATION =====
export const TTS_CONFIG = {
  DEFAULT_VOICE: 'en-US-AnaNeural',
  FALLBACK_VOICE: 'en-US-AriaNeural',
} as const;

// ===== DEMO MODE =====
export const DEMO_CONFIG = {
  IS_DEMO_MODE: false,
  FORCE_FULL_SCREEN: false,
  DEMO_SCALE: 1.0,
} as const;

// ===== FILE SIZE LIMITS =====
export const FILE_LIMITS = {
  MAX_DB_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

// ===== ANIMATION =====
export const ANIMATION = {
  CANVAS_FPS: 8, // 8fps for pixelated look
  FRAME_TIME: 125, // ~8fps (1000ms / 8)
} as const;

// ===== ASSET METADATA =====
export const ASSET_LOGOS = {
  BTC: `${EXTERNAL_URLS.COINGECKO_CDN}/1/small/bitcoin.png`,
  ETH: `${EXTERNAL_URLS.COINGECKO_CDN}/279/small/ethereum.png`,
  SOL: `${EXTERNAL_URLS.COINGECKO_CDN}/4128/small/solana.png`,
  USDC: `${EXTERNAL_URLS.COINGECKO_CDN}/6319/small/USD_Coin_icon.png`,
  USDT: `${EXTERNAL_URLS.COINGECKO_CDN}/325/small/Tether.png`,
} as const;

export const CHAIN_LOGOS = {
  Ethereum: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  Solana: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
  Bitcoin: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png',
  Polygon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
  Base: 'https://github.com/base-org/brand-kit/raw/main/logo/symbol/Base_Symbol_Blue.png',
} as const;

// ===== SERVER CONFIGURATION =====
export const SERVER_CONFIG = {
  DEFAULT_PORT: 3001,
  MAX_BACKEND_RESTARTS: 3,
  RESTART_DELAY_BASE: 2000, // 2s base delay, multiplied by restart count
} as const;
