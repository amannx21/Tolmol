// The dealer's stock board, on Arkiv. Every fair-price shop must display its stock and timings (TPDS (Control) Order
// 2015, cl. 10(4)(ii)); here the verified dealer posts this month's grain received and the distribution days as a
// sealed entity (`tolmol.stock`). Card holders' reports are then read against it: "the board says 1,200 kg arrived;
// card holders say they got 22% less", which is the gap where ration leaks. A missing board is visible too.
//
// It also holds two verdicts every reader computes the same way from public data:
//  - fairShop: the "Fair shop" badge, earned month by month (it lapses on its own when the evidence stops supporting it);
//  - shopVerdict: the red / amber / green / grey answer to "Check my shop".
import { ExpirationTime } from "@arkiv-network/sdk"
import { bool, i32, str, u64 } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import type { AttributeInputs } from "@arkiv-network/sdk"
import { BURN_ADDRESS, PROJECT, SCHEMA_VERSION } from "./constants.js"
import { addMonths, dayStartMs, DISTRICT_RE, monthToNum, MONTH_RE, SHOP_ID_RE, STATE_RE, type Report } from "./model.js"
import type { RawEntity } from "./attributes.js"
import type { Reader, ReadOptions, ReadResult } from "./queries.js"
import type { Followup, Response } from "./answers.js"
import type { ShopStats } from "./rules.js"
import type { Attestation } from "./verify.js"
import type { Writer } from "./writes.js"

type Hex = `0x${string}`
const lc = (x: string) => x.toLowerCase()

export const STOCK_TYPE = "tolmol.stock" as const
/** A shop's monthly allocation is tonnes, not kilograms: up to 100 t per grain. */
export const MAX_STOCK_G = 100_000_000
export const MAX_CARDS = 5_000

export type StockValues = { riceG: number; wheatG: number; milletG: number; cards: number; fromDay: number; toDay: number }
export type StockBoard = StockValues & { key: Hex; creator: Hex; shopId: string; state: string; district: string; month: string; createdAt: bigint }

function check(v: StockValues) {
  const grams = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= MAX_STOCK_G
  if (!grams(v.riceG) || !grams(v.wheatG) || !grams(v.milletG)) throw new Error("grain must be whole grams between 0 and 100 tonnes")
  if (v.riceG + v.wheatG + v.milletG === 0) throw new Error("a board needs some grain")
  if (!Number.isSafeInteger(v.cards) || v.cards < 1 || v.cards > MAX_CARDS) throw new Error(`cards must be between 1 and ${MAX_CARDS}`)
  if (!Number.isSafeInteger(v.fromDay) || !Number.isSafeInteger(v.toDay) || v.fromDay < 1 || v.toDay > 31 || v.fromDay > v.toDay) throw new Error("distribution days must be within 1 to 31, first day before last")
}

export function stockAttributes(shop: { shopId: string; state: string; district: string }, month: string, v: StockValues, o: { synthetic: boolean; atMs: bigint }): AttributeInputs {
  if (!SHOP_ID_RE.test(shop.shopId) || !STATE_RE.test(shop.state) || !DISTRICT_RE.test(shop.district)) throw new Error("invalid shop")
  check(v)
  return {
    project: str(PROJECT),
    type: str(STOCK_TYPE),
    schema_version: i32(SCHEMA_VERSION),
    shop_id: str(shop.shopId),
    state: str(shop.state),
    district: str(shop.district),
    month: str(month),
    month_num: i32(monthToNum(month)),
    rice_g: i32(v.riceG),
    wheat_g: i32(v.wheatG),
    millet_g: i32(v.milletG),
    cards: i32(v.cards),
    from_day: i32(v.fromDay),
    to_day: i32(v.toDay),
    reported_at: u64(dayStartMs(o.atMs)),
    synthetic: bool(o.synthetic),
  }
}

const val = (e: RawEntity, n: string, t: string) => {
  const a = e.attributes?.[n]
  return a && a.type === t ? a.value : undefined
}
const int = (e: RawEntity, n: string) => {
  const v = val(e, n, "i32")
  return typeof v === "number" && Number.isSafeInteger(v) ? v : undefined
}
export function parseStock(e: RawEntity): StockBoard | null {
  if (val(e, "project", "str") !== PROJECT || val(e, "type", "str") !== STOCK_TYPE || val(e, "schema_version", "i32") !== SCHEMA_VERSION) return null
  if (typeof e.key !== "string" || typeof e.creator !== "string" || e.createdAt === undefined) return null
  const shopId = val(e, "shop_id", "str")
  const state = val(e, "state", "str")
  const district = val(e, "district", "str")
  const month = val(e, "month", "str")
  if (typeof shopId !== "string" || !SHOP_ID_RE.test(shopId) || typeof state !== "string" || !STATE_RE.test(state)) return null
  if (typeof district !== "string" || !DISTRICT_RE.test(district) || typeof month !== "string" || !MONTH_RE.test(month) || int(e, "month_num") !== monthToNum(month)) return null
  const v = { riceG: int(e, "rice_g"), wheatG: int(e, "wheat_g"), milletG: int(e, "millet_g"), cards: int(e, "cards"), fromDay: int(e, "from_day"), toDay: int(e, "to_day") }
  if (Object.values(v).some((x) => x === undefined)) return null
  try {
    check(v as StockValues)
  } catch {
    return null
  }
  return { ...(v as StockValues), key: e.key as Hex, creator: e.creator as Hex, shopId, state, district, month, createdAt: e.createdAt }
}

// ------------------------------------------------------------------ reads
const META = { key: true, creator: true, createdAt: true, attributes: true } as const
async function walk(client: Reader, where: ReturnType<typeof eq>[], opts: ReadOptions = {}): Promise<ReadResult<StockBoard>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  let page = await client.select(META).where(where).limit(200).atBlock(atBlock).fetch()
  const items: StockBoard[] = []
  let dropped = 0
  for (let n = 0; ; n++) {
    for (const e of page.entities) {
      const x = parseStock(e as RawEntity)
      if (x) items.push(x)
      else dropped++
    }
    if (!page.hasNextPage() || n + 1 >= (opts.maxPages ?? 25)) break
    page = await page.next()
  }
  return { items, atBlock, dropped }
}
const base = () => [eq("project", str(PROJECT)), eq("type", str(STOCK_TYPE))]
/** Q21: one shop's stock boards (every month, every version). */
export const shopStocks = (c: Reader, shopId: string, o: ReadOptions = {}) => walk(c, [...base(), eq("shop_id", str(shopId))], o)
/** Q22: every stock board in a state (dashboard: which shops posted none). */
export const stateStocks = (c: Reader, state: string, o: ReadOptions = {}) => walk(c, [...base(), eq("state", str(state))], o)

// ------------------------------------------------------------------ rules
const earlier = (a: { createdAt: bigint; key: string }, b: { createdAt: bigint; key: string }) =>
  a.createdAt !== b.createdAt ? a.createdAt < b.createdAt : lc(a.key) < lc(b.key)

/** Boards counted only from the verified dealer of that shop ($creator), per shop, oldest first. */
export function validStocks(boards: readonly StockBoard[], dealers: ReadonlyMap<string, Attestation>): Map<string, StockBoard[]> {
  const out = new Map<string, StockBoard[]>()
  for (const b of [...boards].sort((x, y) => (earlier(x, y) ? -1 : 1))) {
    if (dealers.get(lc(b.creator))?.shopId !== b.shopId) continue
    out.set(b.shopId, [...(out.get(b.shopId) ?? []), b])
  }
  return out
}

/** One month's board: the first declaration, the latest one, and every change in between (a board cannot be edited, only re-posted). */
export function boardForMonth(boards: readonly StockBoard[], month: string): { first: StockBoard; latest: StockBoard; versions: StockBoard[] } | null {
  const versions = boards.filter((b) => b.month === month).sort((x, y) => (earlier(x, y) ? -1 : 1))
  if (!versions.length) return null
  return { first: versions[0]!, latest: versions[versions.length - 1]!, versions }
}

export const boardTotalG = (b: StockValues) => b.riceG + b.wheatG + b.milletG

/**
 * The leakage estimate: the board's grain times the grain-weighted shortfall that card holders reported that month.
 * An estimate from a sample of card holders, not an audit; shown as such.
 */
export function leakageEstimate(board: StockValues, monthReports: readonly Pick<Report, "entitledG" | "shortfallG" | "scheme">[]) {
  const r = monthReports.filter((x) => x.scheme === "pds")
  const e = r.reduce((t, x) => t + x.entitledG, 0)
  const s = r.reduce((t, x) => t + x.shortfallG, 0)
  const bp = e > 0 ? Math.floor((s * 10_000) / e) : 0
  return { reports: r.length, shortfallBp: bp, declaredG: boardTotalG(board), unaccountedG: Math.floor((boardTotalG(board) * bp) / 10_000) }
}

/** After the 5th of a month, a shop with reports that month but no valid board shows "No stock board". */
export const BOARD_DUE_DAY = 5
export function boardMissing(boards: readonly StockBoard[], month: string, now: Date = new Date()): boolean {
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  if (month === thisMonth && now.getUTCDate() <= BOARD_DUE_DAY) return false
  return !boards.some((b) => b.month === month)
}

// ------------------------------------------------------------------ verdicts
export const FAIR_CHECKS = ["enough_reports", "low_shortfall", "all_answered", "none_not_fixed", "board_posted"] as const
export type FairCheck = (typeof FAIR_CHECKS)[number]
export type FairShop = { fair: boolean; failed: FairCheck[]; months: string[] }

/**
 * "Fair shop" for this month and last month, from public evidence only. Earned, not claimed: the shop needs 3+ counted
 * reports from 2+ devices, under 5% shortfall, an answer to every shortfall report, no reporter saying "not fixed",
 * and (ration shops) a stock board this month. It lapses by itself as soon as the evidence stops supporting it.
 */
export function fairShop(input: {
  reports: readonly Report[]
  answers: ReadonlyMap<string, Response[]>
  followups: ReadonlyMap<string, Followup>
  boards?: readonly StockBoard[]
  month: string
  scheme?: Report["scheme"]
  now?: Date
}): FairShop {
  const months = [addMonths(input.month, -1), input.month]
  const r = input.reports.filter((x) => months.includes(x.month))
  const failed: FairCheck[] = []
  if (r.length < 3 || new Set(r.map((x) => lc(x.creator))).size < 2) failed.push("enough_reports")
  const e = r.reduce((t, x) => t + x.entitledG, 0)
  const s = r.reduce((t, x) => t + x.shortfallG, 0)
  if (e === 0 || (s * 10_000) / e >= 500) failed.push("low_shortfall")
  if (r.some((x) => x.shortfallG > 0 && !input.answers.has(lc(x.key)))) failed.push("all_answered")
  if (r.some((x) => input.followups.get(lc(x.key))?.status === "not_fixed")) failed.push("none_not_fixed")
  if ((input.scheme ?? "pds") === "pds" && boardMissing(input.boards ?? [], input.month, input.now)) failed.push("board_posted")
  return { fair: failed.length === 0, failed, months }
}

export type Verdict = "red" | "amber" | "green" | "grey"
/**
 * The one-glance answer to "Check my shop":
 *  grey  = fewer than 2 counted reports (not enough to say anything);
 *  red   = 15%+ shortfall, or the shop is on the officials' attention list;
 *  amber = 5%+ shortfall, or no stock board this month;
 *  green = under 5% and none of the above (the Fair shop badge needs more; see fairShop).
 */
export function shopVerdict(stats: Pick<ShopStats, "reports" | "shortfallBp"> | undefined, o: { onAttentionList?: boolean; noBoard?: boolean } = {}): Verdict {
  if (!stats || stats.reports < 2) return "grey"
  if (stats.shortfallBp >= 1500 || o.onAttentionList) return "red"
  if (stats.shortfallBp >= 500 || o.noBoard) return "amber"
  return "green"
}

// ------------------------------------------------------------------ write
/** The verified dealer posts the month's stock board. Sealed (readonly + 0x…dEaD), kept 365 days. A correction is a new board. */
export async function postStockBoard(reader: Reader, dealer: Writer, shop: { shopId: string; state: string; district: string }, month: string, v: StockValues, o: { synthetic: boolean; now?: Date } = { synthetic: true }) {
  const [predicted] = await reader.predictEntityKeys({ owner: dealer.account.address, count: 1 })
  if (!predicted) throw new Error("could not predict the entity key")
  const res = await dealer.executeBatch({
    creates: [
      {
        payload: new Uint8Array(),
        contentType: "application/octet-stream",
        attributes: stockAttributes(shop, month, v, { synthetic: o.synthetic, atMs: BigInt((o.now ?? new Date()).getTime()) }),
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
