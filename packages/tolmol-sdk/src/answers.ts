// Shops answer, reporters confirm: a community-score-card loop on Arkiv.
//
// A verified dealer (an attestation with role "dealer" for that shop, see verify.ts) answers a report with one of a
// fixed list of actions (`tolmol.response`); the report's own device then says whether it was really fixed
// (`tolmol.followup`). There is no free text on either side, on purpose: a dealer must not be able to write
// "I know who you are", and a reporter must not be able to type a name. Both entities are readonly and handed to the
// burn address in the same batch, so neither side can delete what it said. A shop's score improves only through
// fixes its reporters confirm, and through lower shortfalls in later months; a dealer cannot edit or hide reports.
import { ExpirationTime } from "@arkiv-network/sdk"
import { bool, i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import type { AttributeInputs } from "@arkiv-network/sdk"
import { BLOCKS_PER_DAY, BURN_ADDRESS, ISSUES, LIFETIME_DAYS, PROJECT, SCHEMA_VERSION, type IssueName } from "./constants.js"
import { dayStartMs, MONTH_RE, SHOP_ID_RE, STATE_RE, type Report } from "./model.js"
import type { RawEntity } from "./attributes.js"
import type { Reader, ReadOptions, ReadResult } from "./queries.js"
import type { Attestation } from "./verify.js"
import type { Writer } from "./writes.js"

type Hex = `0x${string}`
const lc = (x: string) => x.toLowerCase()

export const ANSWER_TYPE = { response: "tolmol.response", followup: "tolmol.followup" } as const

/**
 * What a dealer can say. Each is something a fair-price shop owner is already expected to do under the TPDS (Control)
 * Order 2015, clause 10 (display boards, timings, records, not keeping cards) or an answer to one of Tolmol's issue
 * tags. "disputed" lets a dealer disagree on the record without being able to remove anything.
 */
export const RESPONSE_ACTIONS = [
  "full_quantity", // the full entitlement will be given; please come back
  "stock_arrived", // stock has arrived; please come and collect
  "scale_checked", // weighing scale checked / corrected
  "open_as_displayed", // shop opens on the displayed days and times (cl. 10(4)(vii))
  "board_updated", // entitlement, price and stock board updated (cl. 10(4)(ii))
  "receipt_given", // a receipt is now given with every sale
  "money_returned", // money taken for free grain has been returned
  "auth_help", // help when fingerprint / OTP fails (alternative authentication)
  "quality_replaced", // bad grain replaced
  "portability_served", // card holders from other places are served (One Nation One Ration Card)
  "disputed", // the shop disputes this report
] as const
export type ResponseAction = (typeof RESPONSE_ACTIONS)[number]

/** The answers that fit each issue tag, listed first in the dealer's choices. */
export const ACTIONS_FOR_ISSUE: Record<IssueName, ResponseAction[]> = {
  charged_money: ["money_returned"],
  auth_failed: ["auth_help"],
  thumb_no_grain: ["full_quantity"],
  shop_closed: ["open_as_displayed"],
  bad_quality: ["quality_replaced"],
  portability_refused: ["portability_served"],
  no_receipt: ["receipt_given"],
}

/** Suggested answers for a report: issue-specific first, then the general shortfall answers, then the rest. */
export function suggestedActions(issues: number): ResponseAction[] {
  const first = (Object.keys(ACTIONS_FOR_ISSUE) as IssueName[]).filter((n) => issues & ISSUES[n]).flatMap((n) => ACTIONS_FOR_ISSUE[n])
  return [...new Set<ResponseAction>([...first, "full_quantity", "stock_arrived", "scale_checked", ...RESPONSE_ACTIONS])]
}

export const FOLLOWUP_STATUSES = ["fixed", "not_fixed"] as const
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number]

export type Response = { key: Hex; creator: Hex; reportKey: Hex; shopId: string; state: string; month: string; action: ResponseAction; createdAt: bigint }
export type Followup = { key: Hex; creator: Hex; reportKey: Hex; shopId: string; state: string; month: string; status: FollowupStatus; createdAt: bigint }

// ------------------------------------------------------------------ attributes and parsing
const head = (type: string, report: Pick<Report, "key" | "shopId" | "state" | "month">, synthetic: boolean, atMs: bigint) => ({
  project: str(PROJECT),
  type: str(type),
  schema_version: i32(SCHEMA_VERSION),
  report_key: key(report.key),
  shop_id: str(report.shopId),
  state: str(report.state),
  month: str(report.month),
  reported_at: u64(dayStartMs(atMs)),
  synthetic: bool(synthetic),
})

export function responseAttributes(report: Pick<Report, "key" | "shopId" | "state" | "month">, action: ResponseAction, o: { synthetic: boolean; atMs: bigint }): AttributeInputs {
  if (!RESPONSE_ACTIONS.includes(action)) throw new Error(`unknown action ${action}`)
  return { ...head(ANSWER_TYPE.response, report, o.synthetic, o.atMs), action: str(action) }
}
export function followupAttributes(report: Pick<Report, "key" | "shopId" | "state" | "month">, status: FollowupStatus, o: { synthetic: boolean; atMs: bigint }): AttributeInputs {
  if (!FOLLOWUP_STATUSES.includes(status)) throw new Error(`unknown status ${status}`)
  return { ...head(ANSWER_TYPE.followup, report, o.synthetic, o.atMs), status: str(status) }
}

const val = (e: RawEntity, n: string, t: string) => {
  const a = e.attributes?.[n]
  return a && a.type === t ? a.value : undefined
}
function parseCommon(e: RawEntity, type: string) {
  if (val(e, "project", "str") !== PROJECT || val(e, "type", "str") !== type || val(e, "schema_version", "i32") !== SCHEMA_VERSION) return null
  if (typeof e.key !== "string" || typeof e.creator !== "string" || e.createdAt === undefined) return null
  const reportKey = val(e, "report_key", "key")
  const shopId = val(e, "shop_id", "str")
  const state = val(e, "state", "str")
  const month = val(e, "month", "str")
  if (typeof reportKey !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(reportKey)) return null
  if (typeof shopId !== "string" || !SHOP_ID_RE.test(shopId) || typeof state !== "string" || !STATE_RE.test(state) || typeof month !== "string" || !MONTH_RE.test(month)) return null
  return { key: e.key as Hex, creator: e.creator as Hex, reportKey: lc(reportKey) as Hex, shopId, state, month, createdAt: e.createdAt }
}
export function parseResponse(e: RawEntity): Response | null {
  const c = parseCommon(e, ANSWER_TYPE.response)
  const action = val(e, "action", "str")
  return c && RESPONSE_ACTIONS.includes(action as ResponseAction) ? { ...c, action: action as ResponseAction } : null
}
export function parseFollowup(e: RawEntity): Followup | null {
  const c = parseCommon(e, ANSWER_TYPE.followup)
  const status = val(e, "status", "str")
  return c && FOLLOWUP_STATUSES.includes(status as FollowupStatus) ? { ...c, status: status as FollowupStatus } : null
}

// ------------------------------------------------------------------ reads
const META = { key: true, creator: true, createdAt: true, attributes: true } as const
async function walk<T>(client: Reader, where: ReturnType<typeof eq>[], parse: (e: RawEntity) => T | null, opts: ReadOptions = {}): Promise<ReadResult<T>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  let page = await client.select(META).where(where).limit(200).atBlock(atBlock).fetch()
  const items: T[] = []
  let dropped = 0
  for (let n = 0; ; n++) {
    for (const e of page.entities) {
      const x = parse(e as RawEntity)
      if (x) items.push(x)
      else dropped++
    }
    if (!page.hasNextPage() || n + 1 >= (opts.maxPages ?? 25)) break
    page = await page.next()
  }
  return { items, atBlock, dropped }
}
const base = (type: string) => [eq("project", str(PROJECT)), eq("type", str(type))]
export const shopResponses = (c: Reader, shopId: string, o: ReadOptions = {}) => walk(c, [...base(ANSWER_TYPE.response), eq("shop_id", str(shopId))], parseResponse, o)
export const shopFollowups = (c: Reader, shopId: string, o: ReadOptions = {}) => walk(c, [...base(ANSWER_TYPE.followup), eq("shop_id", str(shopId))], parseFollowup, o)
export const stateResponses = (c: Reader, state: string, o: ReadOptions = {}) => walk(c, [...base(ANSWER_TYPE.response), eq("state", str(state))], parseResponse, o)
export const stateFollowups = (c: Reader, state: string, o: ReadOptions = {}) => walk(c, [...base(ANSWER_TYPE.followup), eq("state", str(state))], parseFollowup, o)
export const reportResponses = (c: Reader, reportKey: Hex, o: ReadOptions = {}) => walk(c, [...base(ANSWER_TYPE.response), eq("report_key", key(reportKey))], parseResponse, o)
export const reportFollowups = (c: Reader, reportKey: Hex, o: ReadOptions = {}) => walk(c, [...base(ANSWER_TYPE.followup), eq("report_key", key(reportKey))], parseFollowup, o)

// ------------------------------------------------------------------ rules
const earlier = (a: { createdAt: bigint; key: string }, b: { createdAt: bigint; key: string }) =>
  a.createdAt !== b.createdAt ? a.createdAt < b.createdAt : lc(a.key) < lc(b.key)

/**
 * Answers that count: written by a device verified as the dealer OF THAT SHOP, about a report of that shop.
 * One answer per (report, action), the earliest. Returns report key -> answers, oldest first.
 */
export function validResponses(reports: readonly Pick<Report, "key" | "shopId">[], responses: readonly Response[], dealers: ReadonlyMap<string, Attestation>): Map<string, Response[]> {
  const shopOf = new Map(reports.map((r) => [lc(r.key), r.shopId]))
  const best = new Map<string, Response>()
  for (const x of responses) {
    const shop = shopOf.get(x.reportKey)
    if (!shop || shop !== x.shopId || dealers.get(lc(x.creator))?.shopId !== shop) continue
    const id = `${x.reportKey}|${x.action}`
    const cur = best.get(id)
    if (!cur || earlier(x, cur)) best.set(id, x)
  }
  const out = new Map<string, Response[]>()
  for (const x of [...best.values()].sort((a, b) => (earlier(a, b) ? -1 : 1))) out.set(x.reportKey, [...(out.get(x.reportKey) ?? []), x])
  return out
}

/** The reporter's current word on each report: only from the report's own creator, the latest one wins. */
export function latestFollowups(reports: readonly Pick<Report, "key" | "creator">[], followups: readonly Followup[]): Map<string, Followup> {
  const creatorOf = new Map(reports.map((r) => [lc(r.key), lc(r.creator)]))
  const out = new Map<string, Followup>()
  for (const f of followups) {
    if (creatorOf.get(f.reportKey) !== lc(f.creator)) continue
    const cur = out.get(f.reportKey)
    if (!cur || earlier(cur, f)) out.set(f.reportKey, f)
  }
  return out
}

export type AnswerStats = { reports: number; answered: number; fixed: number; notFixed: number; disputed: number }

/** The shop's side of the score card, over counted reports. "fixed" counts only what reporters confirmed. */
export function answerStats(counted: readonly Pick<Report, "key">[], answers: ReadonlyMap<string, Response[]>, followups: ReadonlyMap<string, Followup>): AnswerStats {
  const s: AnswerStats = { reports: counted.length, answered: 0, fixed: 0, notFixed: 0, disputed: 0 }
  for (const r of counted) {
    const a = answers.get(lc(r.key)) ?? []
    if (a.length) s.answered++
    if (a.some((x) => x.action === "disputed")) s.disputed++
    const f = followups.get(lc(r.key))?.status
    if (f === "fixed") s.fixed++
    else if (f === "not_fixed") s.notFixed++
  }
  return s
}

// ------------------------------------------------------------------ writes
async function sealed(reader: Reader, writer: Writer, attributes: AttributeInputs, report: Pick<Report, "createdAt">) {
  const [predicted] = await reader.predictEntityKeys({ owner: writer.account.address, count: 1 })
  if (!predicted) throw new Error("could not predict the entity key")
  const res = await writer.executeBatch({
    creates: [
      {
        payload: new Uint8Array(),
        contentType: "application/octet-stream",
        attributes,
        expires: ExpirationTime.atBlock(report.createdAt + BigInt(LIFETIME_DAYS.cap) * BLOCKS_PER_DAY, { atLeast: ExpirationTime.fromHours(1) }),
        flags: { readonly: true },
        salt: predicted.salt,
      },
    ],
    ownershipChanges: [{ entityKey: predicted.key, newOwner: BURN_ADDRESS }],
  })
  const created = res.createdEntities[0]
  if (!created || lc(created) !== lc(predicted.key)) throw new Error("created key does not match the prediction")
  return { entityKey: created as Hex, txHash: res.txHash as Hex }
}

/** A verified dealer answers a report of its shop. Sealed: readonly and owned by 0x…dEaD, so it cannot be taken back. */
export function respondToReport(reader: Reader, dealer: Writer, report: Report, action: ResponseAction, o: { synthetic: boolean; now?: Date } = { synthetic: true }) {
  return sealed(reader, dealer, responseAttributes(report, action, { synthetic: o.synthetic, atMs: BigInt((o.now ?? new Date()).getTime()) }), report)
}

/** The report's own device says whether the shop really fixed it. Counted only from the report's creator. */
export function followUpReport(reader: Reader, reporter: Writer, report: Report, status: FollowupStatus, o: { synthetic: boolean; now?: Date } = { synthetic: true }) {
  if (lc(reporter.account.address) !== lc(report.creator)) throw new Error("Only the device that wrote a report can confirm whether it was fixed")
  return sealed(reader, reporter, followupAttributes(report, status, { synthetic: o.synthetic, atMs: BigInt((o.now ?? new Date()).getTime()) }), report)
}
