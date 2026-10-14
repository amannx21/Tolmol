import { describe, expect, it } from "vitest"
import { parseCorrection, parseReport, reportAttributes, type RawEntity } from "../src/attributes.js"
import { ALL_ISSUES_MASK, ISSUES, issueList } from "../src/constants.js"
import { evidenceRows } from "../src/evidence.js"
import { dayStartMs, validateReportInput, type Correction, type Report } from "../src/model.js"
import { dedupeReports, shopStats, withdrawnKeys } from "../src/rules.js"

const NOW = new Date("2026-10-14T08:00:00Z")
const A = "0xAaAa000000000000000000000000000000000001" as const
const B = "0xbBbB000000000000000000000000000000000002" as const
const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const ok = { shopId: "SYN-BR-0042", month: "2026-10", item: "rice" as const, entitledG: 25_000, receivedG: 21_000 }
const report = (over: Partial<Report> = {}): Report => ({
  ...ok, key: k(1), state: "BR", district: "gaya", monthNum: 202610, shortfallG: 4_000, shortfallBp: 1600, issues: 0, extendable: true,
  reportedAt: 1n, synthetic: true, creator: A, owner: "0x000000000000000000000000000000000000dEaD", createdAt: 100n, expiresAt: 999n, ...over,
})
const correction = (over: Partial<Correction> = {}): Correction => ({
  key: k(500), reportKey: k(1), shopId: "SYN-BR-0042", state: "BR", month: "2026-10", action: "withdraw", creator: A, createdAt: 200n, ...over,
})

describe("issues (what went wrong)", () => {
  it("accepts known flags and rejects unknown bits", () => {
    expect(validateReportInput({ ...ok, issues: ISSUES.charged_money | ISSUES.no_receipt }, NOW).issues).toBe(65)
    expect(validateReportInput(ok, NOW).issues).toBe(0)
    expect(() => validateReportInput({ ...ok, issues: 1 << 17 }, NOW)).toThrow(/issues/)
    expect(() => validateReportInput({ ...ok, issues: -1 }, NOW)).toThrow(/issues/)
    expect(() => validateReportInput({ ...ok, issues: 1.5 }, NOW)).toThrow(/issues/)
    expect(ALL_ISSUES_MASK).toBe((1 << 17) - 1)
    expect(issueList(ISSUES.shop_closed | ISSUES.bad_quality)).toEqual(["shop_closed", "bad_quality"])
  })
  it("store the first 7 flags in issues and the rest in issues2; old readers still count the report", () => {
    const mask = ISSUES.no_receipt | ISSUES.slip_mismatch | ISSUES.threatened
    const attrs = reportAttributes({ ...ok, issues: mask }, { state: "BR", district: "gaya" }, { synthetic: true, reportedAtMs: 1n })
    expect((attrs.issues as { value: number }).value).toBe(ISSUES.no_receipt)
    expect((attrs.issues2 as { value: number }).value).toBe((ISSUES.slip_mismatch | ISSUES.threatened) >> 7)
    const raw = { key: `0x${"ab".repeat(32)}`, creator: `0x${"cd".repeat(20)}`, owner: `0x${"00".repeat(19)}01`, createdAt: 1n, expiresAt: 2n, attributes: attrs } as unknown as RawEntity
    expect(parseReport(raw)?.issues).toBe(mask)
    // no issues2 attribute at all when only the first 7 flags are used (fewer attributes on the explorer)
    expect("issues2" in reportAttributes({ ...ok, issues: ISSUES.no_receipt }, { state: "BR", district: "gaya" }, { synthetic: true, reportedAtMs: 1n })).toBe(false)
  })
  it("are stored in one i32 attribute and parsed back; old reports without it read as 0", () => {
    const attrs = reportAttributes({ ...ok, issues: 6 }, { state: "BR", district: "gaya" }, { synthetic: true, reportedAtMs: 1_791_881_241_095n })
    expect((attrs.issues as { type: string; value: number }).value).toBe(6)
    const base: RawEntity = { key: k(1), creator: A, owner: A, createdAt: 1n, expiresAt: 2n, attributes: attrs as RawEntity["attributes"] }
    expect(parseReport(base)?.issues).toBe(6)
    const { issues: _drop, ...old } = attrs as Record<string, unknown>
    expect(parseReport({ ...base, attributes: old as RawEntity["attributes"] })?.issues).toBe(0)
    expect(parseReport({ ...base, attributes: { ...(attrs as object), issues: { type: "i32", value: 999 } } as RawEntity["attributes"] })).toBeNull()
  })
  it("are counted per shop", () => {
    const [s] = shopStats([report({ issues: ISSUES.charged_money }), report({ key: k(2), creator: B, issues: ISSUES.charged_money | ISSUES.shop_closed })], [])
    expect(s?.issueCounts.charged_money).toBe(2)
    expect(s?.issueCounts.shop_closed).toBe(1)
    expect(s?.issueCounts.no_receipt).toBe(0)
  })
})

describe("privacy: time stored to the day", () => {
  it("rounds report time down to the start of the UTC day", () => {
    expect(dayStartMs(1_791_881_241_095n)).toBe(1_791_849_600_000n)
    const attrs = reportAttributes(ok, { state: "BR", district: "gaya" }, { synthetic: true, reportedAtMs: 1_791_881_241_095n })
    expect((attrs.reported_at as { value: bigint }).value % 86_400_000n).toBe(0n)
  })
})

describe("withdrawals (corrections)", () => {
  it("are honoured only from the report's own creator", () => {
    const r = report()
    expect(withdrawnKeys([r], [correction()]).has(k(1).toLowerCase())).toBe(true)
    expect(withdrawnKeys([r], [correction({ creator: B })]).size).toBe(0)
    expect(withdrawnKeys([r], [correction({ reportKey: k(2) })]).size).toBe(0)
  })
  it("take the report out of counts and let a corrected report from the same device count instead", () => {
    const wrong = report({ key: k(1), createdAt: 100n, receivedG: 0, shortfallG: 25_000, shortfallBp: 10_000 })
    const fixed = report({ key: k(2), createdAt: 300n })
    const w = withdrawnKeys([wrong, fixed], [correction()])
    expect(dedupeReports([wrong, fixed], w).map((r) => r.key)).toEqual([k(2)])
    expect(shopStats([wrong, fixed], [], w)[0]?.shortfallBp).toBe(1600)
    const rows = evidenceRows([wrong, fixed], [], 999n, w)
    expect(rows.find((x) => x.entity_key === k(1))).toMatchObject({ withdrawn: true, counted: false })
    expect(rows.find((x) => x.entity_key === k(2))).toMatchObject({ withdrawn: false, counted: true })
  })
  it("parse strictly", () => {
    const attrs = {
      project: { type: "str", value: "tolmol" }, type: { type: "str", value: "tolmol.correction" }, schema_version: { type: "i32", value: 1 },
      report_key: { type: "key", value: k(1) }, shop_id: { type: "str", value: "SYN-BR-0042" }, state: { type: "str", value: "BR" },
      month: { type: "str", value: "2026-10" }, action: { type: "str", value: "withdraw" },
    }
    const e: RawEntity = { key: k(500), creator: A, createdAt: 5n, attributes: attrs }
    expect(parseCorrection(e)?.action).toBe("withdraw")
    expect(parseCorrection({ ...e, attributes: { ...attrs, action: { type: "str", value: "delete" } } })).toBeNull()
  })
})
