// The monthly public board for schools and gram panchayats: the same idea as a ration shop's stock board (stock.ts),
// in each scheme's own terms, posted by the outlet's verified operator and sealed (readonly + 0x…dEaD).
//   school (mdm):    children enrolled, school days open, days a hot meal was served, grain received for the meals
//   panchayat (nrega): workers on the muster roll, person-days of work, the daily wage, total wages paid
// Readers set it against what parents or workers reported that month, exactly as with grain at a ration shop. Schools
// must display the meal menu and stock, and every MGNREGA worksite must show a citizen information board; this is that
// board, made tamper-proof.
import { ExpirationTime } from "@arkiv-network/sdk"
import { bool, i32, str, u64 } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import type { AttributeInputs } from "@arkiv-network/sdk"
import { BURN_ADDRESS, PROJECT, SCHEMA_VERSION } from "./constants.js"
import { dayStartMs, DISTRICT_RE, monthToNum, MONTH_RE, SHOP_ID_RE, STATE_RE, type Report } from "./model.js"
import type { RawEntity } from "./attributes.js"
import type { Reader, ReadOptions, ReadResult } from "./queries.js"
import type { Attestation } from "./verify.js"
import type { Writer } from "./writes.js"

type Hex = `0x${string}`
const lc = (x: string) => x.toLowerCase()
export const BOARD_TYPE = "tolmol.board" as const

export type MealBoardValues = { scheme: "mdm"; children: number; openDays: number; mealDays: number; grainG: number }
export type WorkBoardValues = { scheme: "nrega"; workers: number; personDays: number; rateInr: number; wagesPaidInr: number }
export type BoardValues = MealBoardValues | WorkBoardValues
export type OutletBoard = BoardValues & { key: Hex; creator: Hex; shopId: string; state: string; district: string; month: string; createdAt: bigint }

const int = (n: number, lo: number, hi: number) => Number.isSafeInteger(n) && n >= lo && n <= hi
function check(v: BoardValues) {
  if (v.scheme === "mdm") {
    if (!int(v.children, 1, 5_000) || !int(v.openDays, 1, 31) || !int(v.mealDays, 0, v.openDays) || !int(v.grainG, 0, 100_000_000)) throw new Error("invalid school meal board")
  } else if (!int(v.workers, 1, 10_000) || !int(v.personDays, 0, 100_000) || !int(v.rateInr, 1, 5_000) || !int(v.wagesPaidInr, 0, 1_000_000_000)) throw new Error("invalid work board")
}

export function boardAttributes(shop: { shopId: string; state: string; district: string }, month: string, v: BoardValues, o: { synthetic: boolean; atMs: bigint }): AttributeInputs {
  if (!SHOP_ID_RE.test(shop.shopId) || !STATE_RE.test(shop.state) || !DISTRICT_RE.test(shop.district)) throw new Error("invalid outlet")
  check(v)
  const head = {
    project: str(PROJECT),
    type: str(BOARD_TYPE),
    schema_version: i32(SCHEMA_VERSION),
    scheme: str(v.scheme),
    shop_id: str(shop.shopId),
    state: str(shop.state),
    district: str(shop.district),
    month: str(month),
    month_num: i32(monthToNum(month)),
    reported_at: u64(dayStartMs(o.atMs)),
    synthetic: bool(o.synthetic),
  }
  return v.scheme === "mdm"
    ? { ...head, children: i32(v.children), open_days: i32(v.openDays), meal_days: i32(v.mealDays), grain_g: i32(v.grainG) }
    : { ...head, workers: i32(v.workers), person_days: i32(v.personDays), rate_inr: i32(v.rateInr), wages_paid_inr: i32(v.wagesPaidInr) }
}

const val = (e: RawEntity, n: string, t: string) => {
  const a = e.attributes?.[n]
  return a && a.type === t ? a.value : undefined
}
const num = (e: RawEntity, n: string) => {
  const v = val(e, n, "i32")
  return typeof v === "number" && Number.isSafeInteger(v) ? v : NaN
}
export function parseBoard(e: RawEntity): OutletBoard | null {
  if (val(e, "project", "str") !== PROJECT || val(e, "type", "str") !== BOARD_TYPE || val(e, "schema_version", "i32") !== SCHEMA_VERSION) return null
  if (typeof e.key !== "string" || typeof e.creator !== "string" || e.createdAt === undefined) return null
  const scheme = val(e, "scheme", "str")
  const shopId = val(e, "shop_id", "str")
  const state = val(e, "state", "str")
  const district = val(e, "district", "str")
  const month = val(e, "month", "str")
  if (typeof shopId !== "string" || !SHOP_ID_RE.test(shopId) || typeof state !== "string" || !STATE_RE.test(state)) return null
  if (typeof district !== "string" || !DISTRICT_RE.test(district) || typeof month !== "string" || !MONTH_RE.test(month) || num(e, "month_num") !== monthToNum(month)) return null
  const v: BoardValues | null =
    scheme === "mdm"
      ? { scheme, children: num(e, "children"), openDays: num(e, "open_days"), mealDays: num(e, "meal_days"), grainG: num(e, "grain_g") }
      : scheme === "nrega"
        ? { scheme, workers: num(e, "workers"), personDays: num(e, "person_days"), rateInr: num(e, "rate_inr"), wagesPaidInr: num(e, "wages_paid_inr") }
        : null
  if (!v) return null
  try {
    check(v)
  } catch {
    return null
  }
  return { ...v, key: e.key as Hex, creator: e.creator as Hex, shopId, state, district, month, createdAt: e.createdAt }
}

async function walk(client: Reader, where: ReturnType<typeof eq>[], opts: ReadOptions = {}): Promise<ReadResult<OutletBoard>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  let page = await client.select({ key: true, creator: true, createdAt: true, attributes: true }).where(where).limit(200).atBlock(atBlock).fetch()
  const items: OutletBoard[] = []
  let dropped = 0
  for (let n = 0; ; n++) {
    for (const e of page.entities) {
      const x = parseBoard(e as RawEntity)
      if (x) items.push(x)
      else dropped++
    }
    if (!page.hasNextPage() || n + 1 >= (opts.maxPages ?? 25)) break
    page = await page.next()
  }
  return { items, atBlock, dropped }
}
const base = () => [eq("project", str(PROJECT)), eq("type", str(BOARD_TYPE))]
/** Q26: one school's or panchayat's boards. */
export const shopBoards = (c: Reader, shopId: string, o: ReadOptions = {}) => walk(c, [...base(), eq("shop_id", str(shopId))], o)

const earlier = (a: { createdAt: bigint; key: string }, b: { createdAt: bigint; key: string }) =>
  a.createdAt !== b.createdAt ? a.createdAt < b.createdAt : lc(a.key) < lc(b.key)
/** Boards counted only from the outlet's verified operator ($creator), oldest first. */
export function validBoards(boards: readonly OutletBoard[], operators: ReadonlyMap<string, Attestation>, shopId: string): OutletBoard[] {
  return boards.filter((b) => b.shopId === shopId && operators.get(lc(b.creator))?.shopId === shopId).sort((x, y) => (earlier(x, y) ? -1 : 1))
}

/**
 * The gap between the board and the reports of that month.
 *  school: the board's share of open days with a meal vs the share parents reported (grain-weighted across reports);
 *  panchayat: wages the board says were paid, times the share workers say they did not get (an estimate, not an audit).
 */
export function boardGap(board: BoardValues, monthReports: readonly Pick<Report, "entitledG" | "receivedG" | "scheme">[]) {
  const r = monthReports.filter((x) => x.scheme === board.scheme)
  const e = r.reduce((t, x) => t + x.entitledG, 0)
  const got = r.reduce((t, x) => t + x.receivedG, 0)
  const reportedBp = e > 0 ? Math.floor((got * 10_000) / e) : 10_000
  if (board.scheme === "mdm") {
    const claimedBp = Math.floor((board.mealDays * 10_000) / board.openDays)
    return { reports: r.length, claimedBp, reportedBp, gapBp: Math.max(0, claimedBp - reportedBp), unaccountedInr: 0 }
  }
  return { reports: r.length, claimedBp: 10_000, reportedBp, gapBp: 10_000 - reportedBp, unaccountedInr: Math.floor((board.wagesPaidInr * (10_000 - reportedBp)) / 10_000) }
}

/** The verified operator posts the month's board. Sealed (readonly + 0x…dEaD), kept 365 days; a correction is a new board. */
export async function postBoard(reader: Reader, operator: Writer, shop: { shopId: string; state: string; district: string }, month: string, v: BoardValues, o: { synthetic: boolean; now?: Date } = { synthetic: true }) {
  const [predicted] = await reader.predictEntityKeys({ owner: operator.account.address, count: 1 })
  if (!predicted) throw new Error("could not predict the entity key")
  const res = await operator.executeBatch({
    creates: [
      {
        payload: new Uint8Array(),
        contentType: "application/octet-stream",
        attributes: boardAttributes(shop, month, v, { synthetic: o.synthetic, atMs: BigInt((o.now ?? new Date()).getTime()) }),
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
