// Officials act on the record. A device verified as an official (role "official", jurisdiction = the district of the
// shop named on its ID) records what the department did about a shop: inspection, show-cause notice, licence
// suspended or cancelled, case registered, grain restored. Each action is sealed (readonly + 0x…dEaD), so nobody, the
// department included, can quietly remove it. And a public "needs attention" list, worked out from the evidence, shows
// which shops officials should look at and why, so inaction is visible too.
//
// Grounding: TPDS (Control) Order 2015: cl. 10(7) prompt action on violations "which may include suspension or
// cancellation" of the licence; cl. 11(1) inspections at least once in three months; cl. 13 punishment under section 7
// of the Essential Commodities Act; cl. 11(4) vigilance committees; cl. 12(2) social audits. See docs/SOURCES.md §12.
import { ExpirationTime } from "@arkiv-network/sdk"
import { bool, i32, str, u64 } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import type { AttributeInputs } from "@arkiv-network/sdk"
import { BURN_ADDRESS, PROJECT, SCHEMA_VERSION } from "./constants.js"
import { dayStartMs, DISTRICT_RE, SHOP_ID_RE, STATE_RE } from "./model.js"
import type { RawEntity } from "./attributes.js"
import type { Reader, ReadOptions, ReadResult } from "./queries.js"
import type { ShopStats } from "./rules.js"
import type { AnswerStats } from "./answers.js"
import type { Attestation } from "./verify.js"
import type { Writer } from "./writes.js"

type Hex = `0x${string}`
const lc = (x: string) => x.toLowerCase()

export const OFFICIAL_TYPE = "tolmol.action" as const
export const OFFICIAL_ACTIONS = [
  "inspection_ordered", // cl. 11(1)
  "inspected_shortage_found",
  "inspected_no_issue",
  "show_cause_notice", // first step of cl. 10(7) action
  "licence_suspended", // cl. 10(7)
  "licence_cancelled", // cl. 10(7); a new licence within a month, cl. 10(9)
  "case_registered", // cl. 13: punishment under s.7 of the Essential Commodities Act 1955
  "grain_restored", // card holders' due grain to be supplied
] as const
export type OfficialAction = (typeof OFFICIAL_ACTIONS)[number]
/** How serious an action is, for the latest-status line (higher = stronger). */
export const ACTION_WEIGHT: Record<OfficialAction, number> = {
  inspected_no_issue: 0,
  inspection_ordered: 1,
  grain_restored: 2,
  inspected_shortage_found: 3,
  show_cause_notice: 4,
  case_registered: 5,
  licence_suspended: 6,
  licence_cancelled: 7,
}

export type OfficialRecord = { key: Hex; creator: Hex; shopId: string; state: string; district: string; action: OfficialAction; createdAt: bigint }

export function officialActionAttributes(shop: { shopId: string; state: string; district: string }, action: OfficialAction, o: { synthetic: boolean; atMs: bigint }): AttributeInputs {
  if (!OFFICIAL_ACTIONS.includes(action)) throw new Error(`unknown action ${action}`)
  if (!SHOP_ID_RE.test(shop.shopId) || !STATE_RE.test(shop.state) || !DISTRICT_RE.test(shop.district)) throw new Error("invalid shop")
  return {
    project: str(PROJECT),
    type: str(OFFICIAL_TYPE),
    schema_version: i32(SCHEMA_VERSION),
    shop_id: str(shop.shopId),
    state: str(shop.state),
    district: str(shop.district),
    action: str(action),
    reported_at: u64(dayStartMs(o.atMs)),
    synthetic: bool(o.synthetic),
  }
}

const val = (e: RawEntity, n: string, t: string) => {
  const a = e.attributes?.[n]
  return a && a.type === t ? a.value : undefined
}
export function parseOfficialAction(e: RawEntity): OfficialRecord | null {
  if (val(e, "project", "str") !== PROJECT || val(e, "type", "str") !== OFFICIAL_TYPE || val(e, "schema_version", "i32") !== SCHEMA_VERSION) return null
  if (typeof e.key !== "string" || typeof e.creator !== "string" || e.createdAt === undefined) return null
  const shopId = val(e, "shop_id", "str")
  const state = val(e, "state", "str")
  const district = val(e, "district", "str")
  const action = val(e, "action", "str")
  if (typeof shopId !== "string" || !SHOP_ID_RE.test(shopId) || typeof state !== "string" || !STATE_RE.test(state)) return null
  if (typeof district !== "string" || !DISTRICT_RE.test(district) || !OFFICIAL_ACTIONS.includes(action as OfficialAction)) return null
  return { key: e.key as Hex, creator: e.creator as Hex, shopId, state, district, action: action as OfficialAction, createdAt: e.createdAt }
}

// ------------------------------------------------------------------ reads
async function walk(client: Reader, where: ReturnType<typeof eq>[], opts: ReadOptions = {}): Promise<ReadResult<OfficialRecord>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  let page = await client.select({ key: true, creator: true, createdAt: true, attributes: true }).where(where).limit(200).atBlock(atBlock).fetch()
  const items: OfficialRecord[] = []
  let dropped = 0
  for (let n = 0; ; n++) {
    for (const e of page.entities) {
      const x = parseOfficialAction(e as RawEntity)
      if (x) items.push(x)
      else dropped++
    }
    if (!page.hasNextPage() || n + 1 >= (opts.maxPages ?? 25)) break
    page = await page.next()
  }
  return { items, atBlock, dropped }
}
const base = [eq("project", str(PROJECT)), eq("type", str(OFFICIAL_TYPE))]
export const shopOfficialActions = (c: Reader, shopId: string, o: ReadOptions = {}) => walk(c, [...base, eq("shop_id", str(shopId))], o)
export const stateOfficialActions = (c: Reader, state: string, o: ReadOptions = {}) => walk(c, [...base, eq("state", str(state))], o)

// ------------------------------------------------------------------ rules
const earlier = (a: { createdAt: bigint; key: string }, b: { createdAt: bigint; key: string }) =>
  a.createdAt !== b.createdAt ? a.createdAt < b.createdAt : lc(a.key) < lc(b.key)

/**
 * Official actions that count: by a device verified as an official whose jurisdiction (the district of the shop on
 * its ID) is the shop's district from the registry. One per (shop, action), the earliest. shop -> actions, oldest first.
 */
export function validOfficialActions(
  actions: readonly OfficialRecord[],
  officials: ReadonlyMap<string, Attestation>,
  shopDistrict: ReadonlyMap<string, string>,
): Map<string, OfficialRecord[]> {
  const best = new Map<string, OfficialRecord>()
  for (const a of actions) {
    const district = shopDistrict.get(a.shopId)
    const off = officials.get(lc(a.creator))
    if (!district || district !== a.district || !off || shopDistrict.get(off.shopId) !== district) continue
    const id = `${a.shopId}|${a.action}`
    const cur = best.get(id)
    if (!cur || earlier(a, cur)) best.set(id, a)
  }
  const out = new Map<string, OfficialRecord[]>()
  for (const a of [...best.values()].sort((x, y) => (earlier(x, y) ? -1 : 1))) out.set(a.shopId, [...(out.get(a.shopId) ?? []), a])
  return out
}

/** The strongest action taken so far (what a reader most needs to know), or null. */
export function strongestAction(list: readonly OfficialRecord[] | undefined): OfficialRecord | null {
  let best: OfficialRecord | null = null
  for (const a of list ?? []) if (!best || ACTION_WEIGHT[a.action] >= ACTION_WEIGHT[best.action]) best = a
  return best
}

export const ATTENTION_REASONS = ["high_shortfall", "confirmed", "charged_money", "not_fixed", "unanswered", "verified"] as const
export type AttentionReason = (typeof ATTENTION_REASONS)[number]
export type Attention = { shopId: string; district: string; reasons: AttentionReason[]; score: number; latest: OfficialRecord | null }

/**
 * Shops that need official attention, worst first. Rules are fixed and public, so anyone can check the list:
 *  - high_shortfall: grain-weighted shortfall >= 20% over 3+ reports from 2+ devices
 *  - confirmed: 2+ reports confirmed by other devices
 *  - charged_money: anyone reported being charged for free grain
 *  - not_fixed: a reporter said the shop's fix did not happen
 *  - unanswered: 3+ shortfall reports the shop has not answered
 *  - verified: 2+ reports from verified card holders (stronger evidence)
 * A shop drops off only when its numbers improve, not because an official recorded something.
 */
export function needsAttention(
  stats: readonly ShopStats[],
  answers: ReadonlyMap<string, AnswerStats>,
  verifiedReports: ReadonlyMap<string, number>,
  actions: ReadonlyMap<string, OfficialRecord[]>,
): Attention[] {
  const out: Attention[] = []
  for (const s of stats) {
    const a = answers.get(s.shopId)
    const reasons: AttentionReason[] = []
    if (s.shortfallBp >= 2000 && s.reports >= 3 && s.reporters >= 2) reasons.push("high_shortfall")
    if (s.corroborated >= 2) reasons.push("confirmed")
    if (s.issueCounts.charged_money > 0) reasons.push("charged_money")
    if ((a?.notFixed ?? 0) > 0) reasons.push("not_fixed")
    if (s.shortReports - (a?.answered ?? 0) >= 3) reasons.push("unanswered")
    if ((verifiedReports.get(s.shopId) ?? 0) >= 2) reasons.push("verified")
    // Evidence of a problem is needed; supporting signals alone do not put a shop on the list.
    if (!reasons.some((r) => r === "high_shortfall" || r === "charged_money" || r === "not_fixed")) continue
    const weight: Record<AttentionReason, number> = { high_shortfall: 3, charged_money: 3, not_fixed: 2, confirmed: 2, unanswered: 1, verified: 1 }
    out.push({ shopId: s.shopId, district: s.district, reasons, score: reasons.reduce((t, r) => t + weight[r], 0) + Math.floor(s.shortfallBp / 1000), latest: strongestAction(actions.get(s.shopId)) })
  }
  return out.sort((x, y) => y.score - x.score || (x.shopId < y.shopId ? -1 : 1))
}

// ------------------------------------------------------------------ writes
/** A verified official records an action on a shop. Sealed: readonly and owned by 0x…dEaD, kept 365 days. */
export async function recordOfficialAction(reader: Reader, official: Writer, shop: { shopId: string; state: string; district: string }, action: OfficialAction, o: { synthetic: boolean; now?: Date } = { synthetic: true }) {
  const [predicted] = await reader.predictEntityKeys({ owner: official.account.address, count: 1 })
  if (!predicted) throw new Error("could not predict the entity key")
  const res = await official.executeBatch({
    creates: [
      {
        payload: new Uint8Array(),
        contentType: "application/octet-stream",
        attributes: officialActionAttributes(shop, action, { synthetic: o.synthetic, atMs: BigInt((o.now ?? new Date()).getTime()) }),
        expires: ExpirationTime.fromDays(365),
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
