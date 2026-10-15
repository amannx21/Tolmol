import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { useEffect, useState } from "preact/hooks"
import { custom, RpcRequestError } from "viem"
import { TIRAMISU_HTTP, type Reader } from "tolmol-sdk"

/**
 * The browser's own connection to Arkiv. Still a plain JSON-RPC POST from this phone to the Arkiv server (no Tolmol
 * backend), with three additions:
 * - an inspector: every query this page sent, exactly as sent, with the cost Arkiv charged (`Arkiv-Cost` header) and
 *   the read allowance left (`RateLimit` header), so anyone can re-run it with curl and see the same answer;
 * - the last good answer: when Arkiv's free anonymous read budget runs out (HTTP 429), a query this phone already ran
 *   is answered from its saved copy, clearly marked as saved, instead of an empty page;
 * - one in-flight request per identical query, so two parts of a page asking the same thing cost one read.
 * Only public Arkiv data is saved, and only on this phone.
 */

export type ReadLog = { at: number; method: string; params: unknown; cost: number | null; status: "live" | "saved" | "failed" }
export type ReadState = { log: ReadLog[]; remaining: number | null; limit: number | null; savedAt: number | null; spent: number }

const CACHE_KEY = "tolmol.readcache.v1"
const MAX_ENTRIES = 40
const MAX_ENTRY_CHARS = 300_000
const state: ReadState = { log: [], remaining: null, limit: null, savedAt: null, spent: 0 }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((f) => f())

type Saved = Record<string, { at: number; result: unknown }>
let saved: Saved = {}
try {
  saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Saved
} catch {
  saved = {}
}
function remember(key: string, result: unknown) {
  const text = JSON.stringify(result)
  if (text.length > MAX_ENTRY_CHARS) return
  saved[key] = { at: Date.now(), result }
  const keys = Object.keys(saved).sort((a, b) => (saved[b]?.at ?? 0) - (saved[a]?.at ?? 0))
  for (const k of keys.slice(MAX_ENTRIES)) delete saved[k]
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(saved))
  } catch {
    /* storage full or blocked: keep the in-memory copy */
  }
}

/** Read methods whose answer can be shown from a saved copy (never balances, nonces or transactions). */
const cacheable = (method: string) => method.startsWith("arkiv_") || method === "eth_blockNumber"
/**
 * Pages pin their reads to the current block, which changes every few seconds. The saved copy is looked up without
 * the block, so the last answer to the same question is found (it is labelled as a saved copy anyway).
 */
const savedKey = (url: string, method: string, params: unknown) =>
  `${url} ${method} ${JSON.stringify(params ?? [], (k, v: unknown) => (/block/i.test(k) ? undefined : v))}`

function parseRateLimit(h: string | null) {
  const m = h && /limit=(\d+).*?remaining=(\d+)/.exec(h)
  return m ? { limit: Number(m[1]), remaining: Number(m[2]) } : null
}

function log(entry: ReadLog) {
  state.log = [entry, ...state.log].slice(0, 30)
  emit()
}

const inflight = new Map<string, Promise<unknown>>()
let id = 0

export function meteredTransport(url: string) {
  return custom({
    async request({ method, params }: { method: string; params?: unknown }) {
      const key = `${url} ${method} ${JSON.stringify(params ?? [])}`
      const shared = cacheable(method) ? inflight.get(key) : undefined
      if (shared) return shared
      const run = (async () => {
        const body = { jsonrpc: "2.0", id: ++id, method, params: params ?? [] }
        let res: Response
        try {
          res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        } catch (e) {
          const hit = cacheable(method) ? saved[savedKey(url, method, params)] : undefined
          if (hit) {
            state.savedAt = hit.at
            log({ at: Date.now(), method, params, cost: null, status: "saved" })
            return hit.result
          }
          throw e
        }
        const sk = savedKey(url, method, params)
        const rl = parseRateLimit(res.headers.get("RateLimit"))
        if (rl) {
          state.remaining = rl.remaining
          state.limit = rl.limit
        }
        const cost = Number(res.headers.get("Arkiv-Cost")) || null
        if (cost) state.spent += cost
        if (res.status === 429 || !res.ok) {
          const hit = cacheable(method) ? saved[sk] : undefined
          if (hit) {
            state.savedAt = hit.at
            log({ at: Date.now(), method, params, cost, status: "saved" })
            return hit.result
          }
          log({ at: Date.now(), method, params, cost, status: "failed" })
          const text = await res.text().catch(() => "")
          throw Object.assign(new Error(`HTTP ${res.status} ${res.status === 429 ? "Too Many Requests" : res.statusText} ${text.slice(0, 200)}`), {
            status: res.status,
            headers: res.headers,
          })
        }
        const json = (await res.json()) as { result?: unknown; error?: { code: number; message: string; data?: unknown } }
        if (json.error) {
          log({ at: Date.now(), method, params, cost, status: "failed" })
          throw new RpcRequestError({ body, error: json.error, url })
        }
        if (cacheable(method)) {
          remember(sk, json.result)
          if (method === "eth_blockNumber") emit()
          else {
            state.savedAt = null
            log({ at: Date.now(), method, params, cost, status: "live" })
          }
        } else emit()
        return json.result
      })()
      if (cacheable(method)) {
        inflight.set(key, run)
        run.finally(() => inflight.delete(key)).catch(() => {})
      }
      return run
    },
  }, { retryCount: 0 }) // a 429 retry would wait out Retry-After (~13 min) and look like a hang (friction F13)
}

export function meteredReader(url: string = TIRAMISU_HTTP): Reader {
  return createPublicClient({ chain: tiramisu, transport: meteredTransport(url) }) as unknown as Reader
}

export function useReads(): ReadState {
  const [, setN] = useState(0)
  useEffect(() => {
    const f = () => setN((n) => n + 1)
    listeners.add(f)
    return () => void listeners.delete(f)
  }, [])
  return state
}

/** The exact request as a curl command, so anyone can re-run it without this site. */
export function curlFor(url: string, method: string, params: unknown) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  return `curl -s ${url} -H 'content-type: application/json' -d '${body.replace(/'/g, "'\\''")}'`
}
