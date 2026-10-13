// Phase 0: watchEntityEvents over WebSocket vs HTTP, and behaviour after the socket drops.
// Real writes: 3 tiny entities (1h life). Usage: node --env-file=.env scripts/test-events.mjs
import { createPublicClient, ExpirationTime } from "@arkiv-network/sdk"
import { str, bool } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, webSocket } from "viem"
import { wallet, recorder } from "./lib/testkit.mjs"

const { step, file } = recorder("events")
const R = wallet("REPORTER")
const WS_URL = tiramisu.rpcUrls.default.webSocket[0]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 1. Raw protocol check: does the node accept eth_subscribe("logs") on the operation address?
await step("raw eth_subscribe logs over WSS", "subscription id", () => new Promise((resolve, reject) => {
  const ws = new WebSocket(WS_URL)
  const timer = setTimeout(() => { ws.close(); reject(new Error("no reply in 10s")) }, 10_000)
  ws.onopen = () => ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["logs", { address: "0x4400000000000000000000000000000000000044" }] }))
  ws.onmessage = (m) => { clearTimeout(timer); ws.close(); resolve({ reply: String(m.data).slice(0, 200) }) }
  ws.onerror = (e) => { clearTimeout(timer); reject(new Error(`ws error ${e.message ?? ""}`)) }
}))

// Count HTTP polling requests for the HTTP watcher
const httpCalls = {}
const httpClient = createPublicClient({ chain: tiramisu, transport: http(undefined, {
  onFetchRequest: async (req) => { const m = JSON.parse(await req.clone().text()).method ?? "batch"; httpCalls[m] = (httpCalls[m] ?? 0) + 1 },
}) })
const wsTransport = webSocket(WS_URL)
const wsClient = createPublicClient({ chain: tiramisu, transport: wsTransport })

const seen = { ws: new Map(), http: new Map() }
const errors = { ws: [], http: [] }
const unwatchWs = wsClient.watchEntityEvents({ onEntityCreated: (e) => seen.ws.set(e.entityKey, Date.now()), onError: (e) => errors.ws.push(String(e.message).slice(0, 160)) })
const unwatchHttp = httpClient.watchEntityEvents({ onEntityCreated: (e) => seen.http.set(e.entityKey, Date.now()), onError: (e) => errors.http.push(String(e.message).slice(0, 160)) })
await sleep(3000)

async function createAndWait(label) {
  const sent = Date.now()
  const r = await R.createEntity({ payload: new Uint8Array(), contentType: "application/octet-stream", expires: ExpirationTime.fromHours(1),
    attributes: { project: str("tolmol"), type: str("tolmol.test"), synthetic: bool(true), test: str("events"), label: str(label) } })
  const confirmed = Date.now()
  for (let i = 0; i < 60 && !(seen.ws.has(r.entityKey) && seen.http.has(r.entityKey)); i++) await sleep(500)
  const lat = (m) => (m.has(r.entityKey) ? m.get(r.entityKey) - confirmed : null)
  return { entityKey: r.entityKey, txHash: r.txHash, sendToConfirmMs: confirmed - sent, wsLatencyAfterConfirmMs: lat(seen.ws), httpLatencyAfterConfirmMs: lat(seen.http) }
}

const before = { ...httpCalls }
await step("event 1 with both watchers live", "both fire", () => createAndWait("e1"))
await step("HTTP watcher request count during event 1", "polling (eth_getFilterChanges or eth_getLogs)", async () => {
  const delta = {}
  for (const [k, v] of Object.entries(httpCalls)) delta[k] = v - (before[k] ?? 0)
  return { delta }
})

// 2. Drop the socket and see whether the WS watcher recovers on its own.
await step("force-close the WebSocket", "closed", async () => {
  const rpc = await wsClient.transport.getRpcClient()
  rpc.socket.close()
  await sleep(6000)
  return { readyStateAfter6s: (await wsClient.transport.getRpcClient()).socket.readyState }
})
await step("event 2 after socket drop", "ws fires if viem resubscribes", () => createAndWait("e2"))

// 3. Fallback: re-create the watcher after a drop (what the app will do on error / missed heartbeat).
unwatchWs()
const unwatchWs2 = wsClient.watchEntityEvents({ onEntityCreated: (e) => seen.ws.set(e.entityKey, Date.now()), onError: (e) => errors.ws.push(String(e.message).slice(0, 160)) })
await sleep(3000)
await step("event 3 after re-creating the WS watcher", "ws fires", () => createAndWait("e3"))
await step("errors reported to onError", "-", async () => ({ ws: errors.ws, http: errors.http }))
unwatchWs2(); unwatchHttp()
console.log("RESULTS_FILE", file)
process.exit(0)
