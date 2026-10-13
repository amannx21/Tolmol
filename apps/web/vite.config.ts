import { fileURLToPath } from "node:url"
import preact from "@preact/preset-vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: { "tolmol-sdk": fileURLToPath(new URL("../../packages/tolmol-sdk/src/index.ts", import.meta.url)) },
  },
  base: "./",
  build: { target: "es2022", sourcemap: true, chunkSizeWarningLimit: 800 },
})
