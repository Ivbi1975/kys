import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

if (!process.env.API_KEY) {
  process.env.API_KEY = "__vitest_test_key__";
}
process.env.NODE_ENV = "development";

async function warmupDb() {
  const maxAttempts = 8;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await db.execute(sql`SELECT 1`);
      process.stdout.write(`[test-setup] DB hazır (deneme ${i})\n`);
      return;
    } catch {
      if (i === maxAttempts) {
        process.stderr.write(`[test-setup] UYARI: DB ${maxAttempts} denemede bağlanamadı, testler başlıyor...\n`);
        return;
      }
      const wait = Math.min(i * 1500, 8000);
      process.stdout.write(`[test-setup] DB bağlantısı bekleniyor (${i}/${maxAttempts}), ${wait}ms...\n`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

await warmupDb();
