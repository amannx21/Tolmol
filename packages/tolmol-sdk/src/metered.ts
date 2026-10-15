// A reusable Arkiv read transport for browser apps (not specific to Tolmol). Plain JSON-RPC over fetch, plus:
//  - a log of every request with Arkiv's own cost (`Arkiv-Cost`) and the reads left (`RateLimit`), for an inspector;
//  - the last good answer of each read, served (and flagged) when the anonymous budget runs out (HTTP 429) or the
//    network fails, so a page shows a labelled saved copy instead of going blank;
//  - one request per identical read in flight, and an identical single-page read (same query, same block) answered in
//    the last 5 seconds is reused: the same question at the same block always has the same answer, so this is never
//    stale, and two parts of one page asking it cost one read (the anonymous budget is small).
// Saved copies are looked up without block pins (pages pin reads to the head, which moves every 2 seconds).
// Use: createPublicClient({ chain: tiramisu, transport: meteredTransport({ url, store, onChange }) }).
import { custom, RpcRequestError } from "viem"

export type ReadLog = { at: number; method: string; params: unknown; cost: number | null; status: "live" | "saved" | "failed" | "reused" }
export type MeterState = { log: ReadLog[]; remaining: number | null; limit: number | null; savedAt: number | null; spent: number }
/** Where saved copies live (localStorage in a browser; any key-value store elsewhere). */
export type SavedStore = { load(): Record<string, { at: number; result: unknown }>; save(all: Record<string, { at: number; result: unknown }>): void }

export const memoryStore = (): SavedStore => {
  let m: Record<string, { at: number; result: unknown }> = {}
  return { load: () => m, save: (all) => void (m = all) }
}
/** localStorage-backed store; quietly in-memory when storage is blocked or full. */
export const localStore = (key: string): SavedStore => ({
  load() {
    try {
      return JSON.parse(globalThis.localStorage?.getItem(key) ?? "{}") as Record<string, { at: number; result: unknown }>
    } catch {
      return {}
    }
  },
  save(all) {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(all))
    } catch {
      /* full or blocked: the in-memory copy still works for this page */
    }
  },
})

/** Reads worth answering from a saved copy (never balances, nonces or transactions). */
export const cacheableRead = (method: string) => method.startsWith("arkiv_") || method === "eth_blockNumber"
const savedKey = (url: string, method: string, params: unknown) => `${url} ${method} ${JSON.stringify(params ?? [], (k, v: unknown) => (/block/i.test(k) ? undefined : v))}`
function parseRateLimit(h: string | null) {
  const m = h && /limit=(\d+).*?remaining=(\d+)/.exec(h)
  return m ? { limit: Number(m[1]), remaining: Number(m[2]) } : null
}

export function meteredTransport(o: { url: string; store?: SavedStore; maxEntries?: number; maxEntryChars?: number; reuseMs?: number; onChange?: (s: MeterState) => void }) {
  const reuseMs = o.reuseMs ?? 5_000
  const recent = new Map<string, { at: number; result: unknown }>()
  const store = o.store ?? memoryStore()
  const maxEntries = o.maxEntries ?? 40
  const maxChars = o.maxEntryChars ?? 300_000
  const state: MeterState = { log: [], remaining: null, limit: null, savedAt: null, spent: 0 }
  let saved = store.load()
  const emit = () => o.onChange?.(state)
  const log = (e: ReadLog) => {
    state.log = [e, ...state.log].slice(0, 30)
    emit()
  }
  const remember = (k: string, result: unknown) => {
    if (JSON.stringify(result).length > maxChars) return
    saved[k] = { at: Date.now(), result }
    const keys = Object.keys(saved).sort((a, b) => (saved[b]?.at ?? 0) - (saved[a]?.at ?? 0))
    for (const x of keys.slice(maxEntries)) delete saved[x]
    store.save(saved)
  }
  const fromSaved = (method: string, params: unknown, cost: number | null) => {
    const hit = cacheableRead(method) ? saved[savedKey(o.url, method, params)] : undefined
    if (!hit) return undefined
    state.savedAt = hit.at
    log({ at: Date.now(), method, params, cost, status: "saved" })
    return { result: hit.result }
  }
  const inflight = new Map<string, Promise<unknown>>()
  let id = 0
  const transport = custom(
    {
      async request({ method, params }: { method: string; params?: unknown }) {
        const k = `${method} ${JSON.stringify(params ?? [])}`
        const shared = cacheableRead(method) ? inflight.get(k) : undefined
        if (shared) return shared
        // Exactly the same single-page query (same block), answered moments ago: the answer cannot differ, reuse it.
        if (method === "arkiv_query") {
          const r = recent.get(k)
          if (r && Date.now() - r.at < reuseMs) {
            log({ at: Date.now(), method, params, cost: 0, status: "reused" })
            return r.result
          }
        }
        const run = (async () => {
          const body = { jsonrpc: "2.0", id: ++id, method, params: params ?? [] }
          let res: Response
          try {
            res = await fetch(o.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
          } catch (e) {
            const s = fromSaved(method, params, null)
            if (s) return s.result
            throw e
          }
          const rl = parseRateLimit(res.headers.get("RateLimit"))
          if (rl) {
            state.remaining = rl.remaining
            state.limit = rl.limit
          }
          const cost = Number(res.headers.get("Arkiv-Cost")) || null
          if (cost) state.spent += cost
          if (!res.ok) {
            const s = fromSaved(method, params, cost)
            if (s) return s.result
            log({ at: Date.now(), method, params, cost, status: "failed" })
            const text = await res.text().catch(() => "")
            throw Object.assign(new Error(`HTTP ${res.status} ${res.status === 429 ? "Too Many Requests" : res.statusText} ${text.slice(0, 200)}`), { status: res.status, headers: res.headers })
          }
          const json = (await res.json()) as { result?: unknown; error?: { code: number; message: string; data?: unknown } }
          if (json.error) {
            log({ at: Date.now(), method, params, cost, status: "failed" })
            throw new RpcRequestError({ body, error: json.error, url: o.url })
          }
          if (cacheableRead(method)) {
            remember(savedKey(o.url, method, params), json.result)
            // Only complete answers are reused: a page with a cursor belongs to a walk pinned to one block.
            if (method === "arkiv_query" && !(json.result as { cursor?: unknown } | null)?.cursor) recent.set(k, { at: Date.now(), result: json.result })
            if (method === "eth_blockNumber") emit()
            else {
              state.savedAt = null
              log({ at: Date.now(), method, params, cost, status: "live" })
            }
          } else emit()
          return json.result
        })()
        if (cacheableRead(method)) {
          inflight.set(k, run)
          run.finally(() => inflight.delete(k)).catch(() => {})
        }
        return run
      },
    },
    { retryCount: 0 }, // a 429 retry would wait out Retry-After (~13 to 30 min) and look like a hang
  )
  return Object.assign(transport, { meter: state, reload: () => void (saved = store.load()) })
}

/** The exact request as a curl command, so anyone can re-run it without the app. */
export function curlFor(url: string, method: string, params: unknown) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  return `curl -s ${url} -H 'content-type: application/json' -d '${body.replace(/'/g, "'\\''")}'`
}
