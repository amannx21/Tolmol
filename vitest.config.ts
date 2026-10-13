import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"], exclude: ["**/*.e2e.test.ts"] } },
      { test: { name: "e2e", include: ["**/test/**/*.e2e.test.ts"], exclude: ["**/node_modules/**"], testTimeout: 180_000, hookTimeout: 180_000 } },
    ],
  },
})
