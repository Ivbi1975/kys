import { logger } from "./logger";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let hits = 0;
let misses = 0;

const store = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) {
    misses++;
    return undefined;
  }
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    misses++;
    return undefined;
  }
  hits++;
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function cacheInvalidate(...keys: string[]): void {
  for (const key of keys) {
    store.delete(key);
  }
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function cacheStats() {
  return {
    hits,
    misses,
    size: store.size,
    hitRate: hits + misses > 0 ? Math.round((hits / (hits + misses)) * 100) : 0,
  };
}

const CACHE_LOG_INTERVAL = 60_000;

setInterval(() => {
  const total = hits + misses;
  if (total > 0) {
    const rate = Math.round((hits / total) * 100);
    logger.info({ hitRate: rate, hits, misses, entries: store.size }, "Cache stats");
  }
}, CACHE_LOG_INTERVAL).unref();
