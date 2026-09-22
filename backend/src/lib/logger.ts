import pino, { type Logger } from 'pino';

let appLogger: Logger = pino({ level: 'silent' });

export function setAppLogger(logger: unknown): void {
  if (
    typeof logger !== 'object' ||
    logger === null ||
    !('debug' in logger) ||
    !('info' in logger) ||
    !('warn' in logger) ||
    !('error' in logger)
  ) {
    throw new TypeError('Application logger does not implement the required pino methods');
  }
  appLogger = logger as Logger;
}

export function getAppLogger(): Logger {
  return appLogger;
}
