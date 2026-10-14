import { describe, expect, it } from "vitest"
import { parseReport, parseWitness, reportAttributes, witnessAttributes, type RawEntity } from "../src/attributes.js"

const KEY = `0x${"ab".repeat(32)}` as const
const CREATOR = "0x1111111111111111111111111111111111111111" as const
const input = { shopId: "SYN-BR-0042", month: "2026-10", item: "rice" as const, entitledG: 25_000, receivedG: 21_000 }

/** Turns encoder output into what a query returns: { name: { type, value } }. */
function asEntity(attrs: Record<string, unknown>, over: Partial<RawEntity> = {}): RawEntity {
  return { key: KEY, creator: CREATOR, owner: CREATOR, createdAt: 10n, expiresAt: 1000n, attributes: attrs as RawEntity["attributes"], ...over }
}

describe("report attributes round-trip", () => {
  const attrs = reportAttributes(input, { state: "BR", district: "gaya" }, { synthetic: true, reportedAtMs: 1_791_881_241_095n })
  it("uses lowercase names, typed integers and no free text", () => {
    for (const name of Object.keys(attrs)) expect(name).toMatch(/^[a-z][a-z0-9_]*$/)
    expect(Object.keys(attrs)).toHaveLength(16) // 15 + the issues bitmask
    expect((attrs.shortfall_bp as { type: string; value: number }).type).toBe("i32")
    expect((attrs.shortfall_bp as { value: number }).value).toBe(1600)
    expect((attrs.reported_at as { type: string }).type).toBe("u64")
  })
  it("parses back to the same report", () => {
    const r = parseReport(asEntity(attrs))
    expect(r?.shortfallBp).toBe(1600)
    expect(r?.shortfallG).toBe(4000)
    expect(r?.monthNum).toBe(202610)
  })
  it("drops entities whose derived fields were forged", () => {
    expect(parseReport(asEntity({ ...attrs, shortfall_bp: { type: "i32", value: 9000 } }))).toBeNull()
    expect(parseReport(asEntity({ ...attrs, shortfall_g: { type: "i32", value: 1 } }))).toBeNull()
    expect(parseReport(asEntity({ ...attrs, month_num: { type: "i32", value: 202609 } }))).toBeNull()
  })
  it("drops entities with the wrong attribute type, project, type or a real-looking shop id", () => {
    expect(parseReport(asEntity({ ...attrs, entitled_g: { type: "str", value: "25000" } }))).toBeNull()
    expect(parseReport(asEntity({ ...attrs, project: { type: "str", value: "other" } }))).toBeNull()
    expect(parseReport(asEntity({ ...attrs, type: { type: "str", value: "tolmol.witness" } }))).toBeNull()
    expect(parseReport(asEntity({ ...attrs, shop_id: { type: "str", value: "9876543210" } }))).toBeNull()
    expect(parseReport(asEntity({ ...attrs, received_g: { type: "i32", value: 30_000 } }))).toBeNull()
  })
})

describe("witness attributes round-trip", () => {
  it("references the report by key and parses back", () => {
    const attrs = witnessAttributes({ key: KEY, shopId: "SYN-BR-0042", state: "BR", month: "2026-10", item: "rice" }, { synthetic: true, reportedAtMs: 1n })
    expect((attrs.report_key as { type: string }).type).toBe("key")
    const w = parseWitness(asEntity(attrs, { key: `0x${"cd".repeat(32)}` }))
    expect(w?.reportKey.toLowerCase()).toBe(KEY)
    expect(w?.state).toBe("BR")
  })
})
