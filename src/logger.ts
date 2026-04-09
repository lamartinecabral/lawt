import pino from 'pino';
import type { CliConfig } from './types';

export function createLogger(config: CliConfig) {
  const options: pino.LoggerOptions = {
    level: config.verbose ? 'debug' : 'info',
  };

  if (!config.json) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}
