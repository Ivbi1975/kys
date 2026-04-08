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
