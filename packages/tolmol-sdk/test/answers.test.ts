import { describe, expect, it } from "vitest"
import type { RawEntity } from "../src/attributes.js"
import {
  answerStats, followupAttributes, latestFollowups, parseFollowup, parseResponse, responseAttributes, suggestedActions, validResponses,
  type Followup, type Response,
} from "../src/answers.js"
import { ISSUES } from "../src/constants.js"
import type { Attestation } from "../src/verify.js"

const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const dev = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`
const report = (n: number, creator: number, shopId = "SYN-BR-0042") => ({ key: k(n), creator: dev(creator), shopId, state: "BR", month: "2026-10", createdAt: 100n })
const dealer = (device: number, shopId: string): [string, Attestation] => [dev(device), {
  key: k(9000 + device), creator: dev(500), device: dev(device), state: "BR", shopId, cardTag: k(8000 + device), method: "test_card", role: "dealer", verifiedOn: 0n, synthetic: true, createdAt: 1n, expiresAt: 9n,
}]
const resp = (n: number, reportN: number, creator: number, action: Response["action"], createdAt = 200n, shopId = "SYN-BR-0042"): Response =>
  ({ key: k(1000 + n), creator: dev(creator), reportKey: k(reportN), shopId, state: "BR", month: "2026-10", action, createdAt })
const fu = (n: number, reportN: number, creator: number, status: Followup["status"], createdAt: bigint): Followup =>
  ({ key: k(2000 + n), creator: dev(creator), reportKey: k(reportN), shopId: "SYN-BR-0042", state: "BR", month: "2026-10", status, createdAt })
const asRaw = (attrs: object, n: number): RawEntity => ({ key: k(n), creator: dev(1), createdAt: 5n, attributes: Object.fromEntries(Object.entries(attrs)) as RawEntity["attributes"] })

describe("shop answers and reporter follow-ups", () => {
  it("round-trip through attributes, with fixed choices only", () => {
    const r = report(1, 7)
    expect(parseResponse(asRaw(responseAttributes(r, "scale_checked", { synthetic: true, atMs: 1n }), 3))?.action).toBe("scale_checked")
    expect(parseFollowup(asRaw(followupAttributes(r, "fixed", { synthetic: true, atMs: 1n }), 4))?.status).toBe("fixed")
    expect(() => responseAttributes(r, "I know who you are" as never, { synthetic: true, atMs: 1n })).toThrow()
  })
  it("suggests the answer that fits each issue first", () => {
    expect(suggestedActions(ISSUES.charged_money | ISSUES.no_receipt).slice(0, 2)).toEqual(["money_returned", "receipt_given"])
    expect(suggestedActions(0)[0]).toBe("full_quantity")
  })
  it("count answers only from the verified dealer of THAT shop, once per action", () => {
    const reports = [report(1, 7), report(2, 8, "SYN-BR-0002")]
    const dealers = new Map([dealer(50, "SYN-BR-0042"), dealer(51, "SYN-BR-0002")])
    const m = validResponses(reports, [
      resp(1, 1, 50, "stock_arrived"),
      resp(2, 1, 50, "stock_arrived", 300n), // repeat: ignored
      resp(3, 1, 51, "disputed"), // dealer of another shop: ignored
      resp(4, 1, 99, "scale_checked"), // not a dealer: ignored
      resp(5, 2, 51, "disputed", 200n, "SYN-BR-0002"),
    ], dealers)
    expect(m.get(k(1))?.map((x) => x.key)).toEqual([k(1001)])
    expect(m.get(k(2))?.map((x) => x.action)).toEqual(["disputed"])
  })
  it("take the reporter's latest word, and nobody else's", () => {
    const reports = [report(1, 7)]
    const m = latestFollowups(reports, [fu(1, 1, 7, "not_fixed", 300n), fu(2, 1, 7, "fixed", 400n), fu(3, 1, 66, "not_fixed", 500n)])
    expect(m.get(k(1))?.status).toBe("fixed")
  })
  it("score: answered, fixed only as confirmed by reporters, disputed", () => {
    const reports = [report(1, 7), report(2, 8), report(3, 9)]
    const answers = new Map([[k(1), [resp(1, 1, 50, "stock_arrived")]], [k(2), [resp(2, 2, 50, "disputed")]]])
    const fus = new Map([[k(1), fu(1, 1, 7, "fixed", 300n)], [k(3), fu(3, 3, 9, "not_fixed", 300n)]])
    expect(answerStats(reports, answers, fus)).toEqual({ reports: 3, answered: 2, fixed: 1, notFixed: 1, disputed: 1 })
  })
})
