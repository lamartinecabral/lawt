import pino from "pino";

let logger: pino.Logger = pino({ level: "silent" });

export function initLogger(verbose: boolean): void {
  logger = pino({
    level: verbose ? "debug" : "info",
    transport: verbose
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  });
}

export function getLogger(): pino.Logger {
  return logger;
}
