// Gas-drip relayer for Tolmol device wallets. Platform-neutral: a Fetch API handler (Request -> Response)
// that runs on Cloudflare Workers, Vercel/Netlify functions, Deno or Node.
//
// It ONLY sends a small amount of Tiramisu test GLM to a fresh device wallet. It never creates, signs or relays
// Tolmol entities, so every report and witness keeps its own device as `$creator`.
//
// Abuse limits (all must pass):
//  - the address is a valid EVM address and has sent 0 transactions (a fresh device),
//  - its balance is below MAX_RECIPIENT_BALANCE (so one address cannot be drained into),
//  - at most PER_IP_PER_DAY drips per client IP per day, and PER_DAY_TOTAL drips per day overall,
//  - the relayer keeps a reserve and refuses when its own balance is low.
// The rate-limit store holds hashed IPs for 24 hours only. Nothing about the requester is written to Arkiv.
import { tiramisu } from "@arkiv-network/sdk/chains"
import { createPublicClient, createWalletClient, formatEther, http, isAddress, parseEther, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"

export const DRIP_WEI = parseEther("0.005") // about 30 report writes at today's Tiramisu gas price
export const MAX_RECIPIENT_BALANCE = parseEther("0.002")
export const RESERVE_WEI = parseEther("0.05")
export const PER_IP_PER_DAY = 3
export const PER_DAY_TOTAL = 500

/** Minimal key-value store with expiry (Cloudflare KV, Upstash, or the in-memory fallback). */
export interface CounterStore {
  incr(key: string, ttlSeconds: number): Promise<number>
}

export class MemoryStore implements CounterStore {
  private m = new Map<string, { n: number; exp: number }>()
  async incr(key: string, ttlSeconds: number) {
    const now = Date.now()
    const cur = this.m.get(key)
    const next = cur && cur.exp > now ? { n: cur.n + 1, exp: cur.exp } : { n: 1, exp: now + ttlSeconds * 1000 }
    this.m.set(key, next)
    return next.n
  }
}

export type RelayerEnv = {
  RELAYER_PRIVATE_KEY: string
  /** Comma-separated list of allowed browser origins, or "*". */
  ALLOWED_ORIGINS?: string
  /** Secret salt for hashing IPs in the rate-limit store. */
  IP_SALT?: string
  RPC_URL?: string
}

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function cors(origin: string | null, env: RelayerEnv): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim())
  const allow = allowed.includes("*") ? "*" : origin && allowed.includes(origin) ? origin : allowed[0] ?? ""
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  }
}

const json = (status: number, body: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })

export function makeHandler(env: RelayerEnv, store: CounterStore) {
  const pk = env.RELAYER_PRIVATE_KEY
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk ?? "")) throw new Error("RELAYER_PRIVATE_KEY missing or malformed")
  const account = privateKeyToAccount(pk as Hex)
  const transport = http(env.RPC_URL ?? tiramisu.rpcUrls.default.http[0], { retryCount: 1, timeout: 20_000 })
  const pub = createPublicClient({ chain: tiramisu, transport })
  const wallet = createWalletClient({ chain: tiramisu, transport, account })
  // One drip at a time per instance, so our own transactions never collide on the nonce.
  let queue: Promise<unknown> = Promise.resolve()

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    // Hosts mount the handler at different prefixes (/api on Vercel); route on the last path segment.
    const path = "/" + (url.pathname.split("/").filter(Boolean).pop() ?? "")
    const h = cors(req.headers.get("origin"), env)
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h })

    if (req.method === "GET" && (path === "/" || path === "/health" || path === "/api")) {
      const bal = await pub.getBalance({ address: account.address })
      return json(200, { ok: true, relayer: account.address, balanceGlm: formatEther(bal), dripGlm: formatEther(DRIP_WEI), network: "tiramisu", chainId: tiramisu.id }, h)
    }

    if (req.method !== "POST" || (path !== "/drip" && path !== "/api")) return json(404, { error: "not found" }, h)

    let address: unknown
    try {
      address = ((await req.json()) as { address?: unknown }).address
    } catch {
      return json(400, { error: "body must be JSON: {\"address\": \"0x...\"}" }, h)
    }
    if (typeof address !== "string" || !isAddress(address, { strict: false })) return json(400, { error: "invalid address" }, h)
    const to = address as Hex

    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const day = new Date().toISOString().slice(0, 10)
    const ipKey = `ip:${day}:${await sha256Hex(`${env.IP_SALT ?? "tolmol"}:${ip}`)}`
    if ((await store.incr(ipKey, 86_400)) > PER_IP_PER_DAY) return json(429, { error: "daily limit for this network reached; try the Arkiv faucet" }, h)
    if ((await store.incr(`total:${day}`, 86_400)) > PER_DAY_TOTAL) return json(429, { error: "relayer daily budget used up; try the Arkiv faucet" }, h)

    const [nonce, bal, own] = await Promise.all([
      pub.getTransactionCount({ address: to }),
      pub.getBalance({ address: to }),
      pub.getBalance({ address: account.address }),
    ])
    if (nonce > 0) return json(409, { error: "only fresh device wallets (no transactions yet) can get a drip" }, h)
    if (bal >= MAX_RECIPIENT_BALANCE) return json(409, { error: "this device already has enough test gas" }, h)
    if (own < DRIP_WEI + RESERVE_WEI) return json(503, { error: "relayer is out of test GLM; try the Arkiv faucet" }, h)

    const run = queue.then(() => wallet.sendTransaction({ to, value: DRIP_WEI }))
    queue = run.catch(() => undefined)
    try {
      const txHash = await run
      return json(200, { ok: true, txHash, amountGlm: formatEther(DRIP_WEI) }, h)
    } catch (e) {
      return json(502, { error: `send failed: ${String((e as Error).message).split("\n")[0]}` }, h)
    }
  }
}
