import { logger } from "./logger";

const SERIALIZATION_ERROR_CODE = "40001";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 50;

function isSerializationError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === SERIALIZATION_ERROR_CODE
  );
}

const TRANSIENT_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EPIPE", "ENOTFOUND"]);
const TRANSIENT_MESSAGES = ["Connection terminated", "connection timeout", "Connection ended unexpectedly"];

export function isConnectionError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  if (typeof e["code"] === "string" && TRANSIENT_CODES.has(e["code"])) return true;
  const msg = typeof e["message"] === "string" ? e["message"] : "";
  return TRANSIENT_MESSAGES.some(t => msg.includes(t));
}

const QUERY_MAX_RETRIES = 3;
const QUERY_BASE_DELAY_MS = 300;

export async function withQueryRetry<T>(
  operation: () => Promise<T>,
  label: string,
): Promise<T> {
  for (let attempt = 1; attempt <= QUERY_MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (isConnectionError(err) && attempt < QUERY_MAX_RETRIES) {
        const delay = QUERY_BASE_DELAY_MS * attempt;
        logger.warn({ attempt, label, delay }, "DB bağlantı hatası, yeniden deneniyor...");
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

export async function withSerializationRetry<T>(
  operation: () => Promise<T>,
  label: string,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (isSerializationError(err) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 50;
        logger.warn({ attempt, label, delay: Math.round(delay) }, "Serialization conflict, retrying transaction");
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}
