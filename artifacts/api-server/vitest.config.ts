import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      BULK_IMPORT_RATE_LIMIT: "100",
    },
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ["src/test-setup.ts"],
    globalSetup: ["src/test-global-setup.ts"],
    pool: "forks",
    forks: {
      singleFork: true,
    },
    sequence: {
      concurrent: false,
    },
  },
});
