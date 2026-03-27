import app from "./app";
import { logger } from "./lib/logger";
import { startPoolMonitoring, shutdownPool } from "@workspace/db";
import type { Server } from "http";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

let isShuttingDown = false;

const server: Server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startPoolMonitoring();
});

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Received shutdown signal, starting graceful shutdown...");

  const forceTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timed out after 10s, forcing exit");
    process.exit(1);
  }, 10_000);
  forceTimeout.unref();

  server.close(async () => {
    logger.info("HTTP server closed, draining DB pool...");
    try {
      await shutdownPool();
      logger.info("DB pool closed. Shutdown complete.");
    } catch (err) {
      logger.error({ err }, "Error closing DB pool during shutdown");
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
