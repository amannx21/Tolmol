import { describe, expect, it } from "vitest"
import type { Report, Witness } from "tolmol-sdk"
import { draftRti } from "../src/rti"

const A = "0xAaAa000000000000000000000000000000000001" as const
const B = "0xbBbB000000000000000000000000000000000002" as const
const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const report = (over: Partial<Report> = {}): Report => ({
  key: k(1), shopId: "SYN-BR-0042", month: "2026-10", item: "rice", entitledG: 15_000, receivedG: 12_500,
  state: "BR", district: "gaya", monthNum: 202610, shortfallG: 2_500, shortfallBp: 1666, issues: 0, reportedAt: 1n, synthetic: true,
  creator: A, owner: "0x000000000000000000000000000000000000dEaD", createdAt: 100n, expiresAt: 999n, ...over,
})
const witness: Witness = {
  key: k(9), reportKey: k(1), shopId: "SYN-BR-0042", state: "BR", month: "2026-10", item: "rice", reportedAt: 1n,
  creator: B, owner: "0x000000000000000000000000000000000000dEaD", createdAt: 110n, expiresAt: 999n,
}
const input = {
  shop: { shopId: "SYN-BR-0042", district: "gaya", state: "BR", labelEn: "x", labelHi: "y" },
  shopId: "SYN-BR-0042", months: ["2026-10"], reports: [report()], witnesses: [witness], atBlock: 518183n,
  pageUrl: "https://amannx21.github.io/Tolmol/#/shop/SYN-BR-0042",
}

describe("draftRti", () => {
  it("cites the right sections and attaches the evidence (English)", () => {
    const t = draftRti(input, "en")
    for (const s of ["Section 6(1)", "Section 6(2)", "Section 7(1)", "Section 7(5)", "30 days", "District Supply Office, Gaya, Bihar"]) expect(t).toContain(s)
    expect(t).toContain("2.5 kg / 15 kg")
    expect(t).toContain("16.6%")
    expect(t).toContain("1 conf.")
    expect(t).toContain(`https://tiramisu.explorer.arkiv.network/entity/${k(1)}`)
    expect(t).toContain("block 518183")
    expect(t).toContain("SYNTHETIC")
  })
  it("leaves personal details as blanks and never includes a device address", () => {
    const t = draftRti(input, "en")
    expect(t).toMatch(/Name of applicant: _+/)
    expect(t).toMatch(/Address: _+/)
    expect(t.toLowerCase()).not.toContain(A.toLowerCase())
    expect(t.toLowerCase()).not.toContain(B.toLowerCase())
  })
  it("has a Hindi version with the same sections", () => {
    const t = draftRti(input, "hi")
    for (const s of ["धारा 6(1)", "धारा 6(2)", "धारा 7(1)", "धारा 7(5)", "30 दिनों", "बिहार"]) expect(t).toContain(s)
    expect(t).toMatch(/आवेदक का नाम: _+/)
  })
  it("ignores duplicate reports from the same device", () => {
    const dup = report({ key: k(2), createdAt: 500n, receivedG: 0, shortfallG: 15_000, shortfallBp: 10_000 })
    const t = draftRti({ ...input, reports: [report(), dup] }, "en")
    expect(t).not.toContain("100.0%")
  })
})
