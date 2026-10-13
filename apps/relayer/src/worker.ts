// Cloudflare Workers entry. Bind a KV namespace as DRIP_KV for rate limits that survive across instances.
import { makeHandler, MemoryStore, type CounterStore, type RelayerEnv } from "./handler.js"

type KV = { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> }

class KvStore implements CounterStore {
  constructor(private kv: KV) {}
  async incr(key: string, ttlSeconds: number) {
    // KV is eventually consistent, so this is a soft limit; the on-chain "fresh wallet" checks are the hard ones.
    const n = Number((await this.kv.get(key)) ?? "0") + 1
    await this.kv.put(key, String(n), { expirationTtl: Math.max(60, ttlSeconds) })
    return n
  }
}

let cached: ((r: Request) => Promise<Response>) | undefined
const memory = new MemoryStore()

export default {
  fetch(req: Request, env: RelayerEnv & { DRIP_KV?: KV }) {
    cached ??= makeHandler(env, env.DRIP_KV ? new KvStore(env.DRIP_KV) : memory)
    return cached(req)
  },
}
