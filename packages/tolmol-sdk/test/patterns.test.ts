import { describe, expect, it } from "vitest"
import type { Report, Witness } from "../src/model.js"
import { patternSignals, rapidGroups, rapidReportKeys } from "../src/rules.js"

const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const dev = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`
const report = (n: number, creator: number, createdAt: bigint, shopId = "SYN-BR-0042"): Report => ({
  shopId, month: "2026-10", item: "rice", entitledG: 25_000, receivedG: 20_000, key: k(n), state: "BR", district: "gaya",
  monthNum: 202610, shortfallG: 5_000, shortfallBp: 2000, issues: 0, extendable: true, reportedAt: 1n, synthetic: true,
  creator: dev(creator), owner: "0x000000000000000000000000000000000000dEaD", createdAt, expiresAt: 10_000_000n,
})
const witness = (n: number, of: Report, creator: number, createdAt: bigint): Witness => ({
  key: k(n), reportKey: of.key, shopId: of.shopId, state: of.state, month: of.month, item: of.item, reportedAt: 1n,
  creator: dev(creator), owner: "0x000000000000000000000000000000000000dEaD", createdAt, expiresAt: 10_000_000n,
})

describe("rapidGroups (bursts from many devices)", () => {
  it("flags 3 devices within one minute (30 blocks)", () => {
    const g = rapidGroups([report(1, 1, 100n), report(2, 2, 110n), report(3, 3, 130n)])
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ fromBlock: 100n, toBlock: 130n, count: 3, devices: 3 })
    expect(g[0]!.keys).toEqual([k(1), k(2), k(3)])
  })
  it("ignores reports spread over time, and many reports from ONE device", () => {
    expect(rapidGroups([report(1, 1, 100n), report(2, 2, 200n), report(3, 3, 300n)])).toEqual([])
    expect(rapidGroups([report(1, 1, 100n), report(2, 1, 101n), report(3, 1, 102n)])).toEqual([])
  })
  it("is independent of input order", () => {
    const xs = [report(3, 3, 120n), report(1, 1, 100n), report(2, 2, 110n), report(4, 4, 900n)]
    expect(rapidGroups(xs)).toEqual(rapidGroups([...xs].reverse()))
  })
})

describe("patternSignals", () => {
  it("counts rapid reports, rapid confirmations and one-off devices", () => {
    const r1 = report(1, 1, 100n)
    const r2 = report(2, 2, 105n)
    const r3 = report(3, 3, 110n)
    const r4 = report(4, 4, 5_000n)
    const ws = [witness(10, r4, 5, 6_000n), witness(11, r4, 6, 6_001n), witness(12, r4, 7, 6_002n), witness(13, r1, 4, 7_000n)]
    const p = patternSignals([r1, r2, r3, r4], ws)
    expect(p.reports).toBe(4)
    expect(p.rapidReports.map((g) => g.count)).toEqual([3])
    expect(p.rapidConfirmations.map((g) => g.count)).toEqual([3])
    // devices 1, 2 and 3 only filed their report (being confirmed by others is not their activity);
    // device 4 also confirmed r1
    expect(p.oneOffReports).toBe(3)
  })
  it("leaves out withdrawn reports", () => {
    const p = patternSignals([report(1, 1, 100n), report(2, 2, 105n), report(3, 3, 110n)], [], new Set([k(3)]))
    expect(p.reports).toBe(2)
    expect(p.rapidReports).toEqual([])
  })
  it("rapidReportKeys works per shop", () => {
    const keys = rapidReportKeys([report(1, 1, 100n), report(2, 2, 105n, "SYN-BR-0001"), report(3, 3, 110n)])
    expect(keys.size).toBe(0) // only 2 devices at SYN-BR-0042 within the window
    const keys2 = rapidReportKeys([report(1, 1, 100n), report(2, 2, 105n), report(3, 3, 110n), report(4, 4, 115n, "SYN-BR-0001")])
    expect([...keys2].sort()).toEqual([k(1), k(2), k(3)])
  })
})
