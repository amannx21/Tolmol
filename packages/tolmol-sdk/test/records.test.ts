import { describe, expect, it } from "vitest"
import { responseAttributes } from "../src/answers.js"
import { reportAttributes, shopAttributes, witnessAttributes, type RawEntity } from "../src/attributes.js"
import { fullShareAttributes } from "../src/fullshare.js"
import type { Reader } from "../src/queries.js"
import { outletRecord, recordsWhere } from "../src/records.js"

const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const dev = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`
const shop = { shopId: "SYN-BR-0042", state: "BR", district: "gaya" }
const report = { key: k(1), shopId: shop.shopId, state: "BR", month: "2026-10", item: "rice" as const }
const ent = (n: number, attrs: unknown): RawEntity => ({ key: k(n), creator: dev(n), owner: dev(n), createdAt: BigInt(n), expiresAt: 1000n, attributes: attrs as RawEntity["attributes"] })

/** A reader that answers from fixed pages and records what it was asked. */
function fakeReader(pages: RawEntity[][]) {
  const asked: { where: unknown; atBlock?: bigint; limit?: number }[] = []
  const page = (i: number) => ({ entities: pages[i] ?? [], hasNextPage: () => i + 1 < pages.length, next: async () => page(i + 1) })
  const reader = {
    getBlockNumber: async () => 777n,
    select: () => {
      const q: { where: unknown; atBlock?: bigint; limit?: number } = { where: null }
      const b = {
        where: (w: unknown) => ((q.where = w), b),
        limit: (n: number) => ((q.limit = n), b),
        atBlock: (n: bigint) => ((q.atBlock = n), b),
        fetch: async () => (asked.push(q), page(0)),
      }
      return b
    },
  }
  return { reader: reader as unknown as Reader, asked }
}

describe("one query for everything about an outlet", () => {
  const records = [
    ent(1, reportAttributes({ shopId: shop.shopId, month: "2026-10", item: "rice", entitledG: 25_000, receivedG: 20_000 }, shop, { synthetic: true, reportedAtMs: 1n })),
    ent(2, witnessAttributes(report, { synthetic: true, reportedAtMs: 1n })),
    ent(3, responseAttributes(report, "disputed", { synthetic: true, atMs: 1n })),
    ent(4, fullShareAttributes(shop, "2026-10", { synthetic: true, atMs: 1n })),
    ent(5, shopAttributes(shop)), // a registry entry: read elsewhere, skipped here
  ]

  it("routes each record to its own parser, across pages, at one pinned block", async () => {
    const { reader, asked } = fakeReader([records.slice(0, 3), records.slice(3)])
    const r = await outletRecord(reader, shop.shopId)
    expect(r.atBlock).toBe(777n)
    expect([r.reports.length, r.witnesses.length, r.responses.length, r.fullShares.length]).toEqual([1, 1, 1, 1])
    expect(r.reports[0]!.shortfallBp).toBe(2000)
    expect(r.responses[0]!.action).toBe("disputed")
    expect(r.dropped).toBe(0)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ atBlock: 777n, limit: 200 })
  })

  it("drops a record of a known type that fails its parser, like every other query", async () => {
    const bad = ent(9, { ...(reportAttributes({ shopId: shop.shopId, month: "2026-10", item: "rice", entitledG: 25_000, receivedG: 20_000 }, shop, { synthetic: true, reportedAtMs: 1n }) as object), month_num: { type: "i32", value: 202609 } })
    const { reader } = fakeReader([[bad, records[1]!]])
    const r = await recordsWhere(reader, [], { atBlock: 5n })
    expect(r.atBlock).toBe(5n)
    expect(r.reports).toHaveLength(0)
    expect(r.witnesses).toHaveLength(1)
    expect(r.dropped).toBe(1)
  })

  it("refuses to walk past maxPages", async () => {
    const { reader } = fakeReader([[records[0]!], [records[1]!], [records[2]!]])
    await expect(recordsWhere(reader, [], { maxPages: 2 })).rejects.toThrow(/more than 2 pages/)
  })
})
