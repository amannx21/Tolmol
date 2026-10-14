import { describe, expect, it } from "vitest"
import { BLOCKS_PER_DAY } from "../src/constants.js"
import type { Report, Witness } from "../src/model.js"
import { dedupeReports, extensionTarget, formatBp, formatKg, shopStats, validWitnesses, witnessCount } from "../src/rules.js"
import { evidenceRows, toCsv } from "../src/evidence.js"

const A = "0xAaAa000000000000000000000000000000000001" as const
const B = "0xbBbB000000000000000000000000000000000002" as const
const C = "0xCcCc000000000000000000000000000000000003" as const
const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`

function report(over: Partial<Report> = {}): Report {
  return {
    key: k(1), shopId: "SYN-BR-0042", month: "2026-10", item: "rice", entitledG: 25_000, receivedG: 21_000,
    state: "BR", district: "gaya", monthNum: 202610, shortfallG: 4_000, shortfallBp: 1600, issues: 0, extendable: true, reportedAt: 1n,
    synthetic: true, creator: A, owner: "0x000000000000000000000000000000000000dEaD", createdAt: 100n, expiresAt: 100n + 90n * BLOCKS_PER_DAY,
    ...over,
  }
}
function witness(over: Partial<Witness> = {}): Witness {
  return {
    key: k(1000), reportKey: k(1), shopId: "SYN-BR-0042", state: "BR", month: "2026-10", item: "rice", reportedAt: 1n,
    creator: B, owner: "0x000000000000000000000000000000000000dEaD", createdAt: 110n, expiresAt: 100n + 90n * BLOCKS_PER_DAY,
    ...over,
  }
}

describe("dedupeReports", () => {
  it("keeps the earliest block per (creator, shop, month, item)", () => {
    const first = report({ key: k(5), createdAt: 100n })
    const later = report({ key: k(2), createdAt: 200n, receivedG: 0 })
    expect(dedupeReports([later, first]).map((r) => r.key)).toEqual([k(5)])
  })
  it("breaks ties inside one block by the lower key, regardless of input order", () => {
    const x = report({ key: k(9), createdAt: 100n })
    const y = report({ key: k(3), createdAt: 100n })
    expect(dedupeReports([x, y])[0]?.key).toBe(k(3))
    expect(dedupeReports([y, x])[0]?.key).toBe(k(3))
  })
  it("treats creator addresses case-insensitively", () => {
    const x = report({ key: k(9), creator: A })
    const y = report({ key: k(3), creator: A.toLowerCase() as `0x${string}`, createdAt: 300n })
    expect(dedupeReports([x, y])).toHaveLength(1)
  })
  it("keeps different items, months, shops and creators apart", () => {
    const rs = [
      report({ key: k(1) }),
      report({ key: k(2), item: "wheat" }),
      report({ key: k(3), month: "2026-09" }),
      report({ key: k(4), shopId: "SYN-BR-0043" }),
      report({ key: k(5), creator: B }),
    ]
    expect(dedupeReports(rs)).toHaveLength(5)
  })
})

describe("validWitnesses", () => {
  const r = report()
  it("ignores the reporter witnessing their own report", () => {
    expect(witnessCount(r, [witness({ creator: A })])).toBe(0)
  })
  it("counts each creator once", () => {
    expect(witnessCount(r, [witness({ key: k(10) }), witness({ key: k(11), createdAt: 120n }), witness({ key: k(12), creator: C })])).toBe(2)
  })
  it("ignores witnesses for another report or with mismatched shop/month/item", () => {
    const ws = [
      witness({ reportKey: k(2) }),
      witness({ key: k(13), shopId: "SYN-BR-0043" }),
      witness({ key: k(14), month: "2026-09" }),
      witness({ key: k(15), item: "wheat" }),
    ]
    expect(validWitnesses(r, ws)).toHaveLength(0)
  })
  it("matches report keys case-insensitively", () => {
    expect(witnessCount(report({ key: "0xABCD" as `0x${string}` }), [witness({ reportKey: "0xabcd" as `0x${string}` })])).toBe(1)
  })
})

describe("extensionTarget", () => {
  const r = report({ createdAt: 1_000n, expiresAt: 1_000n + 90n * BLOCKS_PER_DAY })
  it("does nothing below 2 witnesses", () => {
    expect(extensionTarget(r, 1, 2_000n)).toBeNull()
  })
  it("extends to head + 180 days at 2+ witnesses", () => {
    expect(extensionTarget(r, 2, 2_000n)).toBe(2_000n + 180n * BLOCKS_PER_DAY)
  })
  it("caps at createdAt + 365 days", () => {
    const head = 1_000n + 300n * BLOCKS_PER_DAY
    expect(extensionTarget(r, 3, head)).toBe(1_000n + 365n * BLOCKS_PER_DAY)
  })
  it("never shortens and returns null when already at or past the target", () => {
    const long = report({ createdAt: 1_000n, expiresAt: 1_000n + 365n * BLOCKS_PER_DAY })
    expect(extensionTarget(long, 5, 2_000n)).toBeNull()
  })
  it("never extends a report whose reporter opted out", () => {
    expect(extensionTarget({ createdAt: 1_000n, expiresAt: 5_000n, extendable: false }, 3, 2_000n)).toBeNull()
  })
})

describe("shopStats", () => {
  it("aggregates deduplicated reports, grain-weighted, worst first", () => {
    const rs = [
      report({ key: k(1), entitledG: 10_000, receivedG: 5_000, shortfallG: 5_000, shortfallBp: 5000 }),
      report({ key: k(2), creator: B, entitledG: 30_000, receivedG: 30_000, shortfallG: 0, shortfallBp: 0 }),
      report({ key: k(3), creator: B, createdAt: 900n, entitledG: 30_000, receivedG: 0, shortfallG: 30_000, shortfallBp: 10_000 }), // duplicate of k(2): ignored
      report({ key: k(4), shopId: "SYN-BR-0007", entitledG: 5_000, receivedG: 4_000, shortfallG: 1_000, shortfallBp: 2000 }),
    ]
    const ws = [witness({ reportKey: k(1), creator: C })]
    const [worst, next] = shopStats(rs, ws)
    expect(worst?.shopId).toBe("SYN-BR-0007") // 1000 short of 5000 = 20%
    expect(worst?.shortfallBp).toBe(2000)
    expect(next?.shopId).toBe("SYN-BR-0042")
    expect(next?.reports).toBe(2)
    expect(next?.reporters).toBe(2)
    expect(next?.shortfallBp).toBe(1250) // 5000 short of 40000; the duplicate 100% report is ignored
    expect(next?.corroborated).toBe(1)
  })
})

describe("formatting", () => {
  it("formats without floating point", () => {
    expect(formatBp(1650)).toBe("16.5%")
    expect(formatBp(10_000)).toBe("100.0%")
    expect(formatBp(3)).toBe("0.0%")
    expect(formatKg(4_500)).toBe("4.5 kg")
    expect(formatKg(35_000)).toBe("35 kg")
    expect(formatKg(125)).toBe("0.125 kg")
  })
})

describe("evidence export", () => {
  it("marks duplicates and the reporter's self-witness as not counted, and escapes CSV", () => {
    const r1 = report({ key: k(1) })
    const dup = report({ key: k(2), createdAt: 500n })
    const rows = evidenceRows([r1, dup], [witness({ reportKey: k(1), creator: A, key: k(50) }), witness({ reportKey: k(1), key: k(51) })], 999n)
    expect(rows.map((r) => [r.kind, r.counted])).toEqual([
      ["report", true],
      ["witness", false],
      ["witness", true],
      ["report", false],
    ])
    expect(rows[0]?.entity_url).toBe(`https://tiramisu.explorer.arkiv.network/entity/${k(1)}`)
    const csv = toCsv(rows)
    expect(csv.split("\n")[0]).toContain("entity_key,report_key,shop_id")
    expect(csv.trim().split("\n")).toHaveLength(5)
  })
})
