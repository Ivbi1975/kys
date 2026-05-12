import app from "./app";
import { logger } from "./lib/logger";
import { startPoolMonitoring, shutdownPool } from "@workspace/db";
import { syncAiSettingsToDb } from "./routes/ai-notes";
import { startPurgeScheduler } from "./services/purge.service";
import { startAuditLogPurgeScheduler } from "./services/audit-log.service";
import type { Server } from "http";

const rawPort = process.env["PORT"];
const host = process.env["HOST"]?.trim() || "127.0.0.1";

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

const server: Server = app.listen({ port, host }, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ host, port }, "Server listening");
  startPoolMonitoring();
  startPurgeScheduler();
  startAuditLogPurgeScheduler();
  syncAiSettingsToDb()
    .then(() => logger.info("AI settings synced to DB"))
    .catch((err) => logger.error({ err }, "Failed to sync AI settings to DB"));
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

process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
  const transient = ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EPIPE", "ENOTFOUND"];
  if (transient.includes(err.code ?? "")) {
    logger.warn({ err }, "DB/network bağlantı hatası (geçici) — sunucu çalışmaya devam ediyor");
    return;
  }
  logger.error({ err }, "Yakalanmayan hata — sunucu kapatılıyor");
  process.exit(1);
});
