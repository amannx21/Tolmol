import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const alias = { "tolmol-sdk": fileURLToPath(new URL("./packages/tolmol-sdk/src/index.ts", import.meta.url)) }

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"], exclude: ["**/*.e2e.test.ts"] } },
      { resolve: { alias }, test: { name: "e2e", include: ["**/test/**/*.e2e.test.ts"], exclude: ["**/node_modules/**"], testTimeout: 180_000, hookTimeout: 180_000 } },
    ],
  },
})
