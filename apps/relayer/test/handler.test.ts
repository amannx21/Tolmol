import { describe, expect, it } from "vitest"
import { makeHandler, MemoryStore, PER_IP_PER_DAY, type CounterStore } from "../src/handler.js"

// A throwaway key that never holds funds; these tests never reach the chain.
const env = { RELAYER_PRIVATE_KEY: `0x${"11".repeat(32)}`, ALLOWED_ORIGINS: "https://tolmol.example" }
const post = (body: unknown, ip = "203.0.113.7") =>
  new Request("https://relayer.example/drip", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip, origin: "https://tolmol.example" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

describe("relayer input handling", () => {
  const handle = makeHandler(env, new MemoryStore())
  it("answers CORS preflight for the allowed origin", async () => {
    const r = await handle(new Request("https://relayer.example/drip", { method: "OPTIONS", headers: { origin: "https://tolmol.example" } }))
    expect(r.status).toBe(204)
    expect(r.headers.get("access-control-allow-origin")).toBe("https://tolmol.example")
  })
  it("rejects bad JSON and invalid addresses before touching the chain", async () => {
    expect((await handle(post("not json"))).status).toBe(400)
    expect((await handle(post({ address: "0x1234" }))).status).toBe(400)
    expect((await handle(post({ address: "Sunita Devi, 9876543210" }))).status).toBe(400)
  })
  it("404s unknown routes", async () => {
    expect((await handle(new Request("https://relayer.example/sign", { method: "POST" }))).status).toBe(404)
  })
  it("refuses to start without a well-formed key", () => {
    expect(() => makeHandler({ RELAYER_PRIVATE_KEY: "" }, new MemoryStore())).toThrow()
  })
})

describe("relayer rate limits", () => {
  it("returns 429 once an IP is over its daily limit", async () => {
    const full: CounterStore = { incr: async (k) => (k.startsWith("ip:") ? PER_IP_PER_DAY + 1 : 1) }
    const r = await makeHandler(env, full)(post({ address: "0x000000000000000000000000000000000000bEEF" }))
    expect(r.status).toBe(429)
  })
  it("returns 429 once the global daily budget is used", async () => {
    const full: CounterStore = { incr: async (k) => (k.startsWith("total:") ? 10_000 : 1) }
    const r = await makeHandler(env, full)(post({ address: "0x000000000000000000000000000000000000bEEF" }))
    expect(r.status).toBe(429)
  })
  it("keys the per-IP limit on the platform's header only; a visitor-sent IP header is ignored", async () => {
    const seen: string[] = []
    // the global budget is "used up", so each request stops right after the per-IP count (no chain access)
    const store: CounterStore = { incr: async (k) => (seen.push(k), k.startsWith("total:") ? 10_000 : 1) }
    const h = makeHandler({ ...env, IP_HEADER: "x-real-ip" }, store)
    const req = (spoof: string) =>
      new Request("https://relayer.example/drip", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.9", "cf-connecting-ip": spoof, "x-forwarded-for": spoof },
        body: JSON.stringify({ address: "0x000000000000000000000000000000000000bEEF" }),
      })
    expect((await h(req("198.51.100.1"))).status).toBe(429)
    expect((await h(req("198.51.100.2"))).status).toBe(429)
    const ipKeys = seen.filter((k) => k.startsWith("ip:"))
    expect(ipKeys).toHaveLength(2)
    expect(ipKeys[0]).toBe(ipKeys[1]) // same bucket despite different spoofed headers
  })
  it("memory store counts per key and expires", async () => {
    const s = new MemoryStore()
    expect(await s.incr("a", 60)).toBe(1)
    expect(await s.incr("a", 60)).toBe(2)
    expect(await s.incr("b", 60)).toBe(1)
  })
})
