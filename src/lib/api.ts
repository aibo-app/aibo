/** Centralized API base URL - reads from env or falls back to localhost */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const WS_BASE = API_BASE.replace(/^http/, 'ws');
