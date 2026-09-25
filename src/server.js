import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { pool } from "./lib/db.js";

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${env.PORT}`);
});

// Catches bugs that would otherwise crash Node silently or unpredictably.
// Logging them is a safety net — the real fix is finding and removing
// the code that caused them.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1); // the process is in an unknown state; safer to restart
});

// Graceful shutdown: stop accepting new connections, let in-flight
// requests finish, close the DB pool, then exit. Prevents cut-off
// requests when you redeploy or Ctrl+C the dev server.
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    logger.info("Shutdown complete");
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
