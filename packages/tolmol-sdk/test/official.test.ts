import { describe, expect, it } from "vitest"
import type { RawEntity } from "../src/attributes.js"
import { needsAttention, officialActionAttributes, parseOfficialAction, strongestAction, validOfficialActions, type OfficialRecord } from "../src/official.js"
import type { ShopStats } from "../src/rules.js"
import type { Attestation } from "../src/verify.js"
import { ISSUE_NAMES } from "../src/constants.js"

const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const dev = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`
const official = (device: number, shopId: string): [string, Attestation] => [dev(device), {
  key: k(9000 + device), creator: dev(500), device: dev(device), state: "BR", shopId, cardTag: k(8000 + device), method: "test_card", role: "official", verifiedOn: 0n, synthetic: true, createdAt: 1n, expiresAt: 9n,
}]
const act = (n: number, creator: number, shopId: string, district: string, action: OfficialRecord["action"], createdAt = 100n): OfficialRecord =>
  ({ key: k(n), creator: dev(creator), shopId, state: "BR", district, action, createdAt })
const shopDistrict = new Map([["SYN-BR-0042", "gaya"], ["SYN-BR-0002", "gaya"], ["SYN-BR-0003", "patna"]])
const stats = (shopId: string, over: Partial<ShopStats>): ShopStats => ({
  shopId, scheme: "pds", state: "BR", district: shopDistrict.get(shopId) ?? "gaya", reports: 5, reporters: 3, corroborated: 0, witnesses: 0, totalEntitledG: 100_000,
  totalShortfallG: 10_000, shortfallBp: 1000, shortReports: 1, months: ["2026-10"], issueCounts: Object.fromEntries(ISSUE_NAMES.map((n) => [n, 0])) as ShopStats["issueCounts"], ...over,
})

describe("official actions", () => {
  it("round-trip through attributes; unknown actions are refused", () => {
    const attrs = officialActionAttributes({ shopId: "SYN-BR-0042", state: "BR", district: "gaya" }, "licence_suspended", { synthetic: true, atMs: 1n })
    const raw: RawEntity = { key: k(1), creator: dev(1), createdAt: 5n, attributes: Object.fromEntries(Object.entries(attrs)) as RawEntity["attributes"] }
    expect(parseOfficialAction(raw)?.action).toBe("licence_suspended")
    expect(() => officialActionAttributes({ shopId: "SYN-BR-0042", state: "BR", district: "gaya" }, "fine the reporter" as never, { synthetic: true, atMs: 1n })).toThrow()
  })
  it("count only from a verified official of the shop's own district, once per action", () => {
    const officials = new Map([official(60, "SYN-BR-0002"), official(61, "SYN-BR-0003")]) // 60: gaya, 61: patna
    const m = validOfficialActions([
      act(1, 60, "SYN-BR-0042", "gaya", "inspection_ordered"),
      act(2, 60, "SYN-BR-0042", "gaya", "inspection_ordered", 200n), // repeat: ignored
      act(3, 61, "SYN-BR-0042", "gaya", "licence_cancelled"), // official of another district: ignored
      act(4, 99, "SYN-BR-0042", "gaya", "licence_cancelled"), // not an official: ignored
      act(5, 60, "SYN-BR-0042", "patna", "show_cause_notice"), // wrong district on the record: ignored
      act(6, 60, "SYN-BR-0042", "gaya", "show_cause_notice", 300n),
    ], officials, shopDistrict)
    expect(m.get("SYN-BR-0042")?.map((a) => a.action)).toEqual(["inspection_ordered", "show_cause_notice"])
    expect(strongestAction(m.get("SYN-BR-0042"))?.action).toBe("show_cause_notice")
  })
  it("needs attention: evidence first, supporting signals add weight, no list entry without evidence", () => {
    const list = needsAttention(
      [
        stats("SYN-BR-0042", { shortfallBp: 3300, corroborated: 20, shortReports: 20 }),
        stats("SYN-BR-0002", { shortfallBp: 1100, issueCounts: { ...stats("x", {}).issueCounts, charged_money: 1 } }),
        stats("SYN-BR-0003", { shortfallBp: 500, corroborated: 9 }), // well confirmed, but no evidence of a problem
      ],
      new Map([["SYN-BR-0042", { reports: 29, answered: 4, fixed: 3, notFixed: 1, disputed: 0 }]]),
      new Map([["SYN-BR-0042", 26]]),
      new Map(),
    )
    expect(list.map((x) => x.shopId)).toEqual(["SYN-BR-0042", "SYN-BR-0002"])
    expect(list[0]!.reasons).toEqual(["high_shortfall", "not_fixed", "confirmed", "unanswered", "verified"])
    expect(list[1]!.reasons).toEqual(["charged_money"])
  })
})
