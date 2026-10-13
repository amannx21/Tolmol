// Local / container entry: `npm run dev -w tolmol-relayer` serves the handler on PORT (default 8787).
import { createServer } from "node:http"
import { makeHandler, MemoryStore } from "./handler.js"

const handle = makeHandler(
  {
    RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY ?? "",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    IP_SALT: process.env.IP_SALT,
    RPC_URL: process.env.RPC_URL,
  },
  new MemoryStore(),
)

const port = Number(process.env.PORT ?? 8787)
createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v)
  if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", req.socket.remoteAddress ?? "unknown")
  const body = chunks.length && req.method !== "GET" && req.method !== "HEAD" ? Buffer.concat(chunks) : undefined
  const r = await handle(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body }))
  res.writeHead(r.status, Object.fromEntries(r.headers))
  res.end(Buffer.from(await r.arrayBuffer()))
}).listen(port, () => console.log(`tolmol relayer on http://localhost:${port}`))
