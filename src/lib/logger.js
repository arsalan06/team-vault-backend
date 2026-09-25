import pino from "pino";
import { env } from "../config/env.js";

// One shared logger instance used everywhere, instead of console.log.
// Pino outputs structured JSON in production (machine-readable, works
// with log aggregators) and pretty-printed color output in dev.
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
