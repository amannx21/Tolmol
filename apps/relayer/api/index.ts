// Vercel entry (Node.js runtime, Web Request/Response handlers). All paths are rewritten here by vercel.json.
// Env vars (set in the Vercel dashboard, never in the repo): RELAYER_PRIVATE_KEY, ALLOWED_ORIGINS, IP_SALT,
// and for the card verifier VERIFIER_PRIVATE_KEY, CARD_TAG_SECRET.
// Rate limits use per-instance memory; the on-chain "fresh wallet" and balance checks are the hard limits.
import { makeHandler, MemoryStore } from "../src/handler.js"

let handle: ((r: Request) => Promise<Response>) | undefined
const store = new MemoryStore()
const run = (req: Request) => {
  handle ??= makeHandler(
    {
      RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY ?? "",
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      IP_SALT: process.env.IP_SALT,
      RPC_URL: process.env.RPC_URL,
      VERIFIER_PRIVATE_KEY: process.env.VERIFIER_PRIVATE_KEY,
      CARD_TAG_SECRET: process.env.CARD_TAG_SECRET,
    },
    store,
  )
  return handle(req)
}

export const GET = run
export const POST = run
export const OPTIONS = run
