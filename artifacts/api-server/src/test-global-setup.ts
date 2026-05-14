import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function setup() {
  process.env.API_KEY = process.env.API_KEY || "__vitest_test_key__";
  process.env.NODE_ENV = "development";
  process.env.DB_POOL_MAX = "3";

  const maxAttempts = 8;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await db.execute(sql`SELECT 1`);
      process.stdout.write(`[test-setup] DB bağlantısı hazır (deneme ${i})\n`);
      return;
    } catch {
      if (i === maxAttempts) {
        throw new Error(`[test-setup] DB bağlantısı ${maxAttempts} denemede kurulamadı`);
      }
      const wait = i * 2000;
      process.stdout.write(`[test-setup] DB bağlantı denemesi ${i}/${maxAttempts} başarısız, ${wait}ms bekleniyor...\n`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}
