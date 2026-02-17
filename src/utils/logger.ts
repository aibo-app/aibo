/**
 * Centralized logging utility
 * Respects NODE_ENV and provides consistent logging across the app
 */

const isDevelopment = import.meta.env.DEV;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Internal logging function
 */
function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  // In production, only log warnings and errors
  if (!isDevelopment && (level === 'debug' || level === 'info')) {
    return;
  }

  const prefix = `[${context}]`;
  const formattedMessage = `${prefix} ${message}`;

  switch (level) {
    case 'debug':
      if (data !== undefined) {
        console.debug(formattedMessage, data);
      } else {
        console.debug(formattedMessage);
      }
      break;
    case 'info':
      if (data !== undefined) {
        console.log(formattedMessage, data);
      } else {
        console.log(formattedMessage);
      }
      break;
    case 'warn':
      if (data !== undefined) {
        console.warn(formattedMessage, data);
      } else {
        console.warn(formattedMessage);
      }
      break;
    case 'error':
      if (data !== undefined) {
        console.error(formattedMessage, data);
      } else {
        console.error(formattedMessage);
      }
      break;
  }
}

/**
 * Logger interface
 */
export const logger = {
  debug: (context: string, message: string, data?: unknown) => log('debug', context, message, data),
  info: (context: string, message: string, data?: unknown) => log('info', context, message, data),
  warn: (context: string, message: string, data?: unknown) => log('warn', context, message, data),
  error: (context: string, message: string, data?: unknown) => log('error', context, message, data),
};

/**
 * Create a scoped logger for a specific context
 * @param context - Context name (e.g., 'ChatPage', 'AssistantPopup')
 */
export function createLogger(context: string) {
  return {
    debug: (message: string, data?: unknown) => logger.debug(context, message, data),
    info: (message: string, data?: unknown) => logger.info(context, message, data),
    warn: (message: string, data?: unknown) => logger.warn(context, message, data),
    error: (message: string, data?: unknown) => logger.error(context, message, data),
  };
}
