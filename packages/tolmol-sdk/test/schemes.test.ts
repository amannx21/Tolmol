import { describe, expect, it } from "vitest"
import { parseReport, parseShop, reportAttributes, shopAttributes, type RawEntity } from "../src/attributes.js"
import { suggestedActions } from "../src/answers.js"
import { ISSUES } from "../src/constants.js"
import { validateReportInput, ValidationError } from "../src/model.js"
import { needsAttention } from "../src/official.js"
import { forScheme, shopStats } from "../src/rules.js"
import { coarsenWages, formatAmount, SCHEME_ISSUES, schemeIssueList, schemeOfItem } from "../src/schemes.js"

const KEY = `0x${"ab".repeat(32)}` as const
const CREATOR = "0x1111111111111111111111111111111111111111" as const
const NOW = new Date("2026-10-16T08:00:00Z")
const asEntity = (attrs: Record<string, unknown>, over: Partial<RawEntity> = {}): RawEntity => ({
  key: KEY, creator: CREATOR, owner: CREATOR, createdAt: 10n, expiresAt: 1000n, attributes: attrs as RawEntity["attributes"], ...over,
})
const where = { state: "BR", district: "gaya" }
const meal = { shopId: "SYN-BR-5001", month: "2026-10", item: "meal_days" as const, entitledG: 22, receivedG: 14, issues: SCHEME_ISSUES.mdm.seated_apart! }
const wage = { shopId: "SYN-BR-7001", month: "2026-10", item: "wage_inr" as const, entitledG: 3000, receivedG: 1750, issues: SCHEME_ISSUES.nrega.wage_late! | SCHEME_ISSUES.nrega.fake_names! }

describe("one ledger, several schemes", () => {
  it("knows each item's scheme and unit", () => {
    expect(schemeOfItem("rice")).toBe("pds")
    expect(schemeOfItem("meal_days")).toBe("mdm")
    expect(schemeOfItem("wage_inr")).toBe("nrega")
    expect(formatAmount("rice", 4500)).toBe("4.5 kg")
    expect(formatAmount("meal_days", 8)).toBe("8 days")
    expect(formatAmount("wage_inr", 12500)).toBe("₹12,500")
  })

  it("validates amounts in the item's own unit and issues in the scheme's own flags", () => {
    expect(validateReportInput(meal, NOW).entitledG).toBe(22)
    expect(validateReportInput(wage, NOW).receivedG).toBe(1750)
    expect(() => validateReportInput({ ...meal, entitledG: 40 }, NOW)).toThrow(ValidationError) // a month has at most 31 school days
    // A ration flag on a school-meal report is not a school-meal flag.
    expect(() => validateReportInput({ ...meal, issues: ISSUES.card_kept }, NOW)).toThrow(ValidationError)
  })

  it("writes `scheme` only on non-ration reports; ration reports are unchanged", () => {
    const m = reportAttributes(meal, where, { synthetic: true, reportedAtMs: 1_791_881_241_095n })
    expect(m.scheme).toEqual({ type: "str", value: "mdm" })
    const r = reportAttributes({ ...meal, shopId: "SYN-BR-0042", item: "rice", entitledG: 25_000, receivedG: 21_000, issues: 0 }, where, { synthetic: true, reportedAtMs: 1n })
    expect(r.scheme).toBeUndefined()
    expect(Object.keys(r)).toHaveLength(16)
  })

  it("parses a school-meal report and rejects a scheme that does not match the item", () => {
    const m = reportAttributes(meal, where, { synthetic: true, reportedAtMs: 1n })
    const parsed = parseReport(asEntity(m))
    expect(parsed?.scheme).toBe("mdm")
    expect(parsed?.shortfallG).toBe(8)
    expect(parseReport(asEntity({ ...m, scheme: { type: "str", value: "nrega" } }))).toBeNull()
    const { scheme: _drop, ...noScheme } = m
    expect(parseReport(asEntity(noScheme))).toBeNull() // a meal item without `scheme` would read as ration to older code
    // A ration item claiming another scheme is rejected too.
    const rice = reportAttributes({ ...meal, item: "rice", entitledG: 25_000, receivedG: 21_000, issues: 0 }, where, { synthetic: true, reportedAtMs: 1n })
    expect(parseReport(asEntity({ ...rice, scheme: { type: "str", value: "mdm" } }))).toBeNull()
  })

  it("keeps schools and panchayats out of the ration shop type", () => {
    const shop = shopAttributes({ shopId: "SYN-BR-0042", ...where })
    const school = shopAttributes({ shopId: "SYN-BR-5001", ...where, scheme: "mdm" })
    expect(shop.type).toEqual({ type: "str", value: "tolmol.shop" })
    expect(school.type).toEqual({ type: "str", value: "tolmol.outlet" })
    expect(parseShop(asEntity(shop))?.scheme).toBe("pds")
    expect(parseShop(asEntity(school))?.scheme).toBe("mdm")
    // A shop entity that claims a scheme, or an outlet that claims ration, is malformed.
    expect(parseShop(asEntity({ ...shop, scheme: { type: "str", value: "mdm" } }))).toBeNull()
    expect(parseShop(asEntity({ ...school, scheme: { type: "str", value: "pds" } }))).toBeNull()
  })

  it("counts an outlet's own scheme only, with that scheme's issue names", () => {
    const m = parseReport(asEntity(reportAttributes(meal, where, { synthetic: true, reportedAtMs: 1n })))!
    const r = parseReport(asEntity(reportAttributes({ shopId: "SYN-BR-5001", month: "2026-10", item: "rice", entitledG: 25_000, receivedG: 0 }, where, { synthetic: true, reportedAtMs: 1n }), { key: `0x${"cd".repeat(32)}` }))!
    const only = forScheme([m, r], "mdm")
    expect(only).toHaveLength(1)
    const s = shopStats(only, [])[0]!
    expect(s.scheme).toBe("mdm")
    expect(s.issueCounts.seated_apart).toBe(1)
    expect(schemeIssueList("nrega", wage.issues)).toEqual(["wage_late", "fake_names"])
  })

  it("suggests answers that fit the outlet, and flags records that do not match", () => {
    expect(suggestedActions(SCHEME_ISSUES.nrega.job_card_kept!, "nrega")[0]).toBe("job_card_returned")
    expect(suggestedActions(0, "mdm")).not.toContain("stock_arrived")
    const w = parseReport(asEntity(reportAttributes(wage, where, { synthetic: true, reportedAtMs: 1n })))!
    const att = needsAttention(shopStats([w], []), new Map(), new Map(), new Map())
    expect(att[0]?.reasons).toContain("records_mismatch")
  })
})

describe("MGNREGA wage rounding (muster rolls are public)", () => {
  it("rounds owed and paid to whole steps, keeping the share paid", () => {
    expect(coarsenWages(3000, 1750)).toEqual({ owed: 3000, paid: 2000 })
    expect(coarsenWages(2750, 1100)).toEqual({ owed: 3000, paid: 1000 })
    expect(coarsenWages(250, 0)).toEqual({ owed: 500, paid: 0 })
    expect(coarsenWages(3000, 3000)).toEqual({ owed: 3000, paid: 3000 })
    expect(() => coarsenWages(1000, 2000)).toThrow()
  })
})
