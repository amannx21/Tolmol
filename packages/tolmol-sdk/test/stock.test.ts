import { describe, expect, it } from "vitest"
import { privateKeyToAccount } from "viem/accounts"
import { parseStock, stockAttributes, validStocks, boardForMonth, leakageEstimate, boardMissing, fairShop, shopVerdict, type StockBoard } from "../src/stock.js"
import { checkProof, decodeProof, encodeProof, makeProof } from "../src/proof.js"
import { meteredTransport, memoryStore } from "../src/metered.js"
import { boardAttributes, boardGap, parseBoard, validBoards } from "../src/boards.js"
import { reportAttributes, type RawEntity } from "../src/attributes.js"
import type { Report } from "../src/model.js"
import type { Attestation } from "../src/verify.js"
import type { Reader } from "../src/queries.js"

const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const dev = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`
const SHOP = { shopId: "SYN-BR-0042", state: "BR", district: "gaya" }
const vals = { riceG: 1_200_000, wheatG: 800_000, milletG: 0, cards: 92, fromDay: 1, toDay: 10 }
const board = (n: number, creator: number, month: string, over: Partial<StockBoard> = {}): StockBoard => ({ ...vals, key: k(n), creator: dev(creator), ...SHOP, month, createdAt: BigInt(n), ...over })
const dealer = (shopId: string): Attestation => ({ key: k(900), creator: dev(99), device: dev(1), state: "BR", shopId, cardTag: k(901), method: "test_card", role: "dealer", verifiedOn: 1n, synthetic: true, createdAt: 1n, expiresAt: 9n } as unknown as Attestation)
const report = (n: number, creator: number, month: string, e: number, got: number): Report =>
  ({ key: k(n), creator: dev(creator), shopId: SHOP.shopId, state: "BR", district: "gaya", month, monthNum: Number(month.replace("-", "")), item: "rice", entitledG: e, receivedG: got,
    shortfallG: e - got, shortfallBp: Math.floor(((e - got) * 10_000) / e), issues: 0, scheme: "pds", reportedAt: 1n, synthetic: true, owner: dev(0xdead), createdAt: BigInt(n), expiresAt: 999n, extendable: true }) as Report

describe("stock board", () => {
  it("round-trips through attributes and rejects nonsense", () => {
    const attrs = stockAttributes(SHOP, "2026-10", vals, { synthetic: true, atMs: 1n })
    const e: RawEntity = { key: k(1), creator: dev(1), createdAt: 5n, attributes: attrs as RawEntity["attributes"] }
    expect(parseStock(e)?.riceG).toBe(1_200_000)
    expect(() => stockAttributes(SHOP, "2026-10", { ...vals, fromDay: 12, toDay: 3 }, { synthetic: true, atMs: 1n })).toThrow()
    expect(parseStock({ ...e, attributes: { ...e.attributes, cards: { type: "i32", value: 0 } } })).toBeNull()
  })
  it("counts boards only from the shop's verified dealer, and keeps every version", () => {
    const dealers = new Map([[dev(1).toLowerCase(), dealer(SHOP.shopId)]])
    const valid = validStocks([board(3, 1, "2026-10", { riceG: 1_000_000 }), board(2, 1, "2026-10"), board(4, 7, "2026-10")], dealers).get(SHOP.shopId)!
    expect(valid).toHaveLength(2) // the stranger's board (creator 7) is ignored
    const b = boardForMonth(valid, "2026-10")!
    expect(b.first.riceG).toBe(1_200_000)
    expect(b.latest.riceG).toBe(1_000_000)
    expect(b.versions).toHaveLength(2)
  })
  it("estimates the unaccounted grain from what card holders reported", () => {
    const est = leakageEstimate(vals, [report(1, 1, "2026-10", 25_000, 20_000), report(2, 2, "2026-10", 25_000, 20_000)])
    expect(est.shortfallBp).toBe(2000)
    expect(est.unaccountedG).toBe(400_000) // 20% of 2,000 kg
  })
  it("says a board is missing only after the 5th", () => {
    expect(boardMissing([], "2026-10", new Date("2026-10-03T00:00:00Z"))).toBe(false)
    expect(boardMissing([], "2026-10", new Date("2026-10-16T00:00:00Z"))).toBe(true)
    expect(boardMissing([board(1, 1, "2026-10")], "2026-10", new Date("2026-10-16T00:00:00Z"))).toBe(false)
  })
})

describe("Fair shop and the verdict", () => {
  const now = new Date("2026-10-16T00:00:00Z")
  const reps = [report(1, 1, "2026-09", 25_000, 24_500), report(2, 2, "2026-10", 25_000, 25_000), report(3, 3, "2026-10", 25_000, 24_800)]
  const answered = new Map(reps.filter((r) => r.shortfallG > 0).map((r) => [r.key.toLowerCase(), [{} as never]]))
  it("is earned only with every check passing", () => {
    expect(fairShop({ reports: reps, answers: answered, followups: new Map(), boards: [board(9, 1, "2026-10")], month: "2026-10", now }).fair).toBe(true)
    const noBoard = fairShop({ reports: reps, answers: answered, followups: new Map(), boards: [], month: "2026-10", now })
    expect(noBoard.failed).toEqual(["board_posted"])
    const unanswered = fairShop({ reports: reps, answers: new Map(), followups: new Map(), boards: [board(9, 1, "2026-10")], month: "2026-10", now })
    expect(unanswered.failed).toContain("all_answered")
    const notFixed = fairShop({ reports: reps, answers: answered, followups: new Map([[reps[0]!.key.toLowerCase(), { status: "not_fixed" } as never]]), boards: [board(9, 1, "2026-10")], month: "2026-10", now })
    expect(notFixed.failed).toContain("none_not_fixed")
  })
  it("gives the one-glance verdict", () => {
    expect(shopVerdict(undefined)).toBe("grey")
    expect(shopVerdict({ reports: 1, shortfallBp: 5000 })).toBe("grey")
    expect(shopVerdict({ reports: 4, shortfallBp: 2000 })).toBe("red")
    expect(shopVerdict({ reports: 4, shortfallBp: 600 })).toBe("amber")
    expect(shopVerdict({ reports: 4, shortfallBp: 100 }, { noBoard: true })).toBe("amber")
    expect(shopVerdict({ reports: 4, shortfallBp: 100 })).toBe("green")
  })
})

describe("prove a report is mine", () => {
  const acct = privateKeyToAccount(`0x${"11".repeat(32)}`)
  const other = privateKeyToAccount(`0x${"22".repeat(32)}`)
  // A reader whose only entity is report k(5), created by `creator`.
  const fakeReader = (creator: `0x${string}` | null) =>
    ({
      getEntity: async () =>
        creator && {
          key: k(5), creator, owner: dev(0xdead), createdAt: 10n, expiresAt: 999n,
          attributes: reportAttributes({ shopId: "SYN-BR-0042", month: "2026-10", item: "rice", entitledG: 25_000, receivedG: 20_000 }, { state: "BR", district: "gaya" }, { synthetic: true, reportedAtMs: 1n }),
        },
    }) as unknown as Reader
  it("checks the signer against the report's creator, and the code and age", async () => {
    const at = 1_791_900_000_000
    const p = await makeProof(acct, k(5), "123456", at)
    expect(decodeProof(encodeProof(p))).toEqual(p)
    expect(decodeProof("not a proof")).toBeNull()
    const ok = await checkProof(fakeReader(acct.address), p, { expectCode: "123456", now: at + 60_000 })
    expect(ok.ok && ok.fresh && ok.codeMatches).toBe(true)
    const late = await checkProof(fakeReader(acct.address), p, { expectCode: "654321", now: at + 3_600_000 })
    expect(late.ok && !late.fresh && late.codeMatches === false).toBe(true)
    expect((await checkProof(fakeReader(other.address), p)).ok).toBe(false) // someone else's report
    expect((await checkProof(fakeReader(null), p)).ok).toBe(false) // no such report
  })
})

describe("metered transport", () => {
  it("answers from the saved copy when Arkiv returns 429, and logs cost and reads left", async () => {
    const calls: number[] = []
    const responses = [
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { data: ["ok"] } }), { status: 200, headers: { "Arkiv-Cost": "100", RateLimit: "limit=600, remaining=599, reset=60" } }),
      new Response("{}", { status: 429 }),
    ]
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => (calls.push(1), responses.shift()!)) as typeof fetch
    try {
      const tr = meteredTransport({ url: "https://rpc.example", store: memoryStore() })
      const t = tr({})
      const params = ["q", { atBlock: "0x10" }]
      expect(await t.request({ method: "arkiv_query", params })).toEqual({ data: ["ok"] })
      // Same question at a newer block, budget exhausted: the saved copy answers.
      expect(await t.request({ method: "arkiv_query", params: ["q", { atBlock: "0x20" }] })).toEqual({ data: ["ok"] })
      expect(tr.meter.spent).toBe(100)
      expect(tr.meter.remaining).toBe(599)
      expect(tr.meter.savedAt).not.toBeNull()
      expect(tr.meter.log.map((l) => l.status)).toEqual(["saved", "live"])
    } finally {
      globalThis.fetch = realFetch
    }
  })
})

describe("metered transport reuse", () => {
  it("reuses an identical query at the same block, but asks again at a newer block", async () => {
    let calls = 0
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () => (calls++, new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { data: [calls] } }), { status: 200 }))) as typeof fetch
    try {
      const tr = meteredTransport({ url: "https://rpc.example", store: memoryStore() })
      const t = tr({})
      const a = await t.request({ method: "arkiv_query", params: ["q", { atBlock: "0x10" }] })
      const b = await t.request({ method: "arkiv_query", params: ["q", { atBlock: "0x10" }] })
      expect(b).toEqual(a)
      expect(calls).toBe(1)
      expect(tr.meter.log[0]?.status).toBe("reused")
      await t.request({ method: "arkiv_query", params: ["q", { atBlock: "0x11" }] }) // after a write, the head moved
      expect(calls).toBe(2)
    } finally {
      globalThis.fetch = realFetch
    }
  })
})

describe("school and panchayat boards", () => {
  const SCHOOL = { shopId: "SYN-BR-5001", state: "BR", district: "gaya" }
  it("round-trips, refuses impossible numbers, and counts only the outlet's operator", () => {
    const attrs = boardAttributes(SCHOOL, "2026-10", { scheme: "mdm", children: 200, openDays: 22, mealDays: 22, grainG: 400_000 }, { synthetic: true, atMs: 1n })
    const e: RawEntity = { key: k(70), creator: dev(1), createdAt: 5n, attributes: attrs as RawEntity["attributes"] }
    const b = parseBoard(e)!
    expect(b.scheme).toBe("mdm")
    expect(() => boardAttributes(SCHOOL, "2026-10", { scheme: "mdm", children: 200, openDays: 20, mealDays: 25, grainG: 0 }, { synthetic: true, atMs: 1n })).toThrow() // more meal days than school days
    const ops = new Map([[dev(1).toLowerCase(), dealer("SYN-BR-5001")]])
    expect(validBoards([b, { ...b, key: k(71), creator: dev(9) }], ops, "SYN-BR-5001")).toHaveLength(1)
  })
  it("sets the board against what parents and workers reported", () => {
    const meal = (got: number) => ({ entitledG: 20, receivedG: got, scheme: "mdm" as const })
    const g = boardGap({ scheme: "mdm", children: 200, openDays: 22, mealDays: 22, grainG: 0 }, [meal(10), meal(10)])
    expect(g.claimedBp).toBe(10_000)
    expect(g.reportedBp).toBe(5_000)
    const wage = { entitledG: 3000, receivedG: 1500, scheme: "nrega" as const }
    const w = boardGap({ scheme: "nrega", workers: 30, personDays: 400, rateInr: 250, wagesPaidInr: 100_000 }, [wage])
    expect(w.unaccountedInr).toBe(50_000)
  })
})
