import { describe, expect, it } from "vitest"
import type { RawEntity } from "../src/attributes.js"
import { CONTRADICT_MIN, fullShareAttributes, fullShareContext, parseFullShare, type FullShare } from "../src/fullshare.js"

const dev = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`
const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const shop = { shopId: "SYN-BR-0042", state: "BR", district: "gaya" }
const fs = (n: number, creator: number, month = "2026-10", shopId = "SYN-BR-0042"): FullShare => ({ key: k(n), creator: dev(creator), shopId, state: "BR", district: "gaya", month, createdAt: 1n })
const report = { shopId: "SYN-BR-0042", month: "2026-10", creator: dev(1) }

describe("got my full share", () => {
  it("round-trips through attributes; a wrong month number is refused", () => {
    const attrs = fullShareAttributes(shop, "2026-10", { synthetic: true, atMs: 1n })
    const raw: RawEntity = { key: k(1), creator: dev(2), createdAt: 3n, attributes: attrs as RawEntity["attributes"] }
    expect(parseFullShare(raw)?.month).toBe("2026-10")
    const bad: RawEntity = { ...raw, attributes: { ...(attrs as Record<string, unknown>), month_num: { type: "i32", value: 202609 } } as RawEntity["attributes"] }
    expect(parseFullShare(bad)).toBeNull()
  })
  it(`marks an unconfirmed report contradicted once ${CONTRADICT_MIN} other phones got their full share`, () => {
    const three = [fs(1, 10), fs(2, 11), fs(3, 12)]
    expect(fullShareContext(report, three, [])).toEqual({ others: 3, contradicted: true })
    expect(fullShareContext(report, three.slice(0, 2), [])).toEqual({ others: 2, contradicted: false })
  })
  it("never counts the reporter, a confirmer, a repeat, another month or another outlet", () => {
    const list = [fs(1, 1), fs(2, 10), fs(3, 10), fs(4, 11), fs(5, 12, "2026-09"), fs(6, 13, "2026-10", "SYN-BR-0001"), fs(7, 14)]
    expect(fullShareContext(report, list, [dev(14)])).toEqual({ others: 2, contradicted: false })
  })
  it("a confirmed report is never marked contradicted, whatever the count", () => {
    expect(fullShareContext(report, [fs(1, 10), fs(2, 11), fs(3, 12), fs(4, 13)], [dev(20)])).toEqual({ others: 4, contradicted: false })
  })
})
