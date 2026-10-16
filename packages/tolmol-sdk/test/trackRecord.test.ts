import { describe, expect, it } from "vitest"
import { BLOCKS_PER_DAY } from "../src/constants.js"
import type { Report } from "../src/model.js"
import type { OfficialRecord } from "../src/official.js"
import { afterStats, isContradicted, trackRecords } from "../src/trackRecord.js"

const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const dev = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`
const DAY = BLOCKS_PER_DAY
// Only the fields the track record reads; the rest of a Report does not matter here.
const rep = (n: number, device: number, createdAt: bigint, entitledG: number, receivedG: number, shopId = "SYN-BR-0042", month = "2026-10"): Report =>
  ({ key: k(n), creator: dev(device), shopId, month, item: "total", entitledG, receivedG, shortfallG: entitledG - receivedG, createdAt, scheme: "pds" }) as unknown as Report
const act = (n: number, creator: number, action: OfficialRecord["action"], createdAt: bigint, via?: number, shopId = "SYN-BR-0042"): OfficialRecord =>
  ({ key: k(n), creator: dev(creator), shopId, state: "BR", district: "gaya", action, createdAt, ...(via ? { via: dev(via) } : {}) })

const at = 1_000n * DAY
const shortAfter = [rep(1, 1, at + DAY, 35_000, 25_000), rep(2, 2, at + 2n * DAY, 35_000, 24_000), rep(3, 3, at + 3n * DAY, 35_000, 26_000)]

describe("track record of officials and inspectors", () => {
  it("counts only reports after the finding, inside the window", () => {
    const s = afterStats([rep(9, 9, at - DAY, 35_000, 0), ...shortAfter, rep(8, 8, at + 61n * DAY, 35_000, 0)], "SYN-BR-0042", at)
    expect(s).toEqual({ reports: 3, reporters: 3, shortfallBp: 2857 })
  })
  it("flags 'no issue' when attention-list evidence follows; not a shortage finding", () => {
    const s = afterStats(shortAfter, "SYN-BR-0042", at)
    expect(isContradicted({ action: "inspected_no_issue" }, s)).toBe(true)
    expect(isContradicted({ action: "grain_restored" }, s)).toBe(true)
    expect(isContradicted({ action: "inspected_shortage_found" }, s)).toBe(false)
  })
  it("does not flag a finding backed by full reports, or by too few reporters", () => {
    expect(isContradicted({ action: "inspected_no_issue" }, afterStats([rep(1, 1, at + DAY, 35_000, 35_000), rep(2, 2, at + DAY, 35_000, 35_000), rep(3, 3, at + DAY, 35_000, 34_000)], "SYN-BR-0042", at))).toBe(false)
    expect(isContradicted({ action: "inspected_no_issue" }, afterStats([rep(1, 1, at + DAY, 35_000, 0), rep(2, 1, at + DAY, 35_000, 0, "SYN-BR-0042", "2026-11"), rep(3, 1, at + DAY, 35_000, 0, "SYN-BR-0042", "2026-12")], "SYN-BR-0042", at))).toBe(false)
  })
  it("lists an inspector's finding under the inspector and the official who sent them", () => {
    const m = new Map([["SYN-BR-0042", [act(1, 70, "inspected_no_issue", at, 60), act(2, 60, "show_cause_notice", at - DAY)]]])
    const recs = trackRecords(m, shortAfter)
    const by = Object.fromEntries(recs.map((r) => [r.signer, r]))
    expect(by[dev(70)]?.contradicted).toBe(1)
    expect(by[dev(60)]?.findings.length).toBe(2)
    expect(by[dev(60)]?.contradicted).toBe(1)
    expect(recs[0]?.contradicted).toBe(1)
  })
})
