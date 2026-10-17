import { fileURLToPath } from "node:url"
import preact from "@preact/preset-vite"
import { defineConfig, type Plugin } from "vite"

/**
 * Content-Security-Policy for the built app (not the dev server). Device keys live in this origin's localStorage, so
 * scripts may come only from this site: an injected <script> or inline handler cannot run and read them.
 * connect-src allows any https/wss endpoint because users may point the app at another Arkiv server (Settings).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https: wss:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")
const csp = (): Plugin => ({
  name: "tolmol-csp",
  apply: "build",
  transformIndexHtml: (html) => html.replace("<head>", `<head>
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
})

export default defineConfig({
  plugins: [preact(), csp()],
  resolve: {
    alias: { "tolmol-sdk": fileURLToPath(new URL("../../packages/tolmol-sdk/src/index.ts", import.meta.url)) },
  },
  base: "./",
  // Older phones matter: iOS 14 Safari and Chrome 87 cannot parse newer syntax (class fields, static blocks), and one
  // unparseable line blanks the whole app. esbuild rewrites such syntax for these targets.
  build: { target: ["es2020", "safari14", "chrome87", "firefox78", "edge88"], sourcemap: true, chunkSizeWarningLimit: 800 },
})
