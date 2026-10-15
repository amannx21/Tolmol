import type { PublicArkivClient } from "@arkiv-network/sdk"
import { i32, key, str } from "@arkiv-network/sdk/attr"
import { eq, gte, lte, or, type Expression } from "@arkiv-network/sdk/query"
import { DEFAULT_REGISTRY, PROJECT, TYPE } from "./constants.js"
import { parseCorrection, parseReport, parseShop, parseWitness, type RawEntity } from "./attributes.js"
import { monthToNum, type Correction, type Report, type Shop, type Witness } from "./model.js"

export type Reader = PublicArkivClient
type Hex = `0x${string}`

export type ReadOptions = {
  /** Read the chain as it was at this block ("state as of block N"). Defaults to the current head. */
  atBlock?: bigint
  /** Safety bound on how many 200-entity pages one call may walk. */
  maxPages?: number
}

export type ReadResult<T> = { items: T[]; atBlock: bigint; dropped: number }

const META = { key: true, creator: true, owner: true, createdAt: true, expiresAt: true, creationFlags: true, attributes: true } as const

/**
 * Walks every page of one query at a single pinned block, so pages never shift under us.
 * Entities that fail validation are counted in `dropped` and left out.
 */
async function walk<T>(
  client: Reader,
  where: Expression[],
  parse: (e: RawEntity) => T | null,
  opts: ReadOptions & { createdBy?: Hex; payload?: boolean } = {},
): Promise<ReadResult<T>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  const maxPages = opts.maxPages ?? 25
  let q = client
    .select(opts.payload ? { ...META, payload: true } : META)
    .where(where)
    .limit(200)
    .atBlock(atBlock)
  if (opts.createdBy) q = q.createdBy(opts.createdBy)
  let page = await q.fetch()
  const items: T[] = []
  let dropped = 0
  for (let pages = 1; ; pages++) {
    for (const e of page.entities) {
      const v = parse(e as RawEntity)
      if (v) items.push(v)
      else dropped++
    }
    if (!page.hasNextPage()) break
    if (pages >= maxPages) throw new Error(`query needs more than ${maxPages} pages; narrow the filter`)
    page = await page.next()
  }
  return { items, atBlock, dropped }
}

const base = (type: string): Expression[] => [eq("project", str(PROJECT)), eq("type", str(type))]

/** Q1: the synthetic shop registry, trusted only from the registry creator. */
export function listShops(
  client: Reader,
  filter: { state?: string; district?: string } = {},
  opts: ReadOptions & { registry?: Hex } = {},
): Promise<ReadResult<Shop>> {
  const w = base(TYPE.shop)
  if (filter.state) w.push(eq("state", str(filter.state)))
  if (filter.district) w.push(eq("district", str(filter.district)))
  return walk(client, w, parseShop, { ...opts, createdBy: opts.registry ?? DEFAULT_REGISTRY, payload: true })
}

/**
 * Q1b: every outlet of every scheme (ration shops, schools, gram panchayats), trusted only from the registry creator.
 * One query: `type = tolmol.shop OR type = tolmol.outlet`.
 */
export function listOutlets(
  client: Reader,
  filter: { state?: string; district?: string } = {},
  opts: ReadOptions & { registry?: Hex } = {},
): Promise<ReadResult<Shop>> {
  const w: Expression[] = [eq("project", str(PROJECT)), or([eq("type", str(TYPE.shop)), eq("type", str(TYPE.outlet))])]
  if (filter.state) w.push(eq("state", str(filter.state)))
  if (filter.district) w.push(eq("district", str(filter.district)))
  return walk(client, w, parseShop, { ...opts, createdBy: opts.registry ?? DEFAULT_REGISTRY, payload: true })
}

/** Q2: reports for one shop, optionally for one month. */
export function shopReports(client: Reader, shopId: string, month?: string, opts: ReadOptions = {}) {
  const w = base(TYPE.report)
  w.push(eq("shop_id", str(shopId)))
  if (month) w.push(eq("month", str(month)))
  return walk(client, w, parseReport, opts)
}

/** Witnesses for a set of reports at one shop (one query, filtered on the device by report key). */
export function shopWitnesses(client: Reader, shopId: string, month?: string, opts: ReadOptions = {}) {
  const w = base(TYPE.witness)
  w.push(eq("shop_id", str(shopId)))
  if (month) w.push(eq("month", str(month)))
  return walk(client, w, parseWitness, opts)
}

/** Q3: witnesses of one report. */
export function reportWitnesses(client: Reader, reportKey: Hex, opts: ReadOptions = {}) {
  const w = base(TYPE.witness)
  w.push(eq("report_key", key(reportKey)))
  return walk(client, w, parseWitness, opts)
}

/** Q4: has this wallet already reported this shop, month and item? */
export async function myExistingReport(client: Reader, me: Hex, input: { shopId: string; month: string; item: string }) {
  const w = base(TYPE.report)
  w.push(eq("shop_id", str(input.shopId)), eq("month", str(input.month)), eq("item", str(input.item)))
  const r = await walk(client, w, parseReport, { createdBy: me, maxPages: 1 })
  return r.items[0] ?? null
}

/** Q5: has this wallet already witnessed this report? */
export async function myExistingWitness(client: Reader, me: Hex, reportKey: Hex) {
  const w = base(TYPE.witness)
  w.push(eq("report_key", key(reportKey)))
  const r = await walk(client, w, parseWitness, { createdBy: me, maxPages: 1 })
  return r.items[0] ?? null
}

/** Q6 / Q7: reports in a state over a month range, optionally only those at or above a shortfall threshold. */
export function dashboardReports(
  client: Reader,
  filter: { state: string; fromMonth: string; toMonth: string; district?: string; minShortfallBp?: number },
  opts: ReadOptions = {},
) {
  const w = base(TYPE.report)
  w.push(
    eq("state", str(filter.state)),
    gte("month_num", i32(monthToNum(filter.fromMonth))),
    lte("month_num", i32(monthToNum(filter.toMonth))),
  )
  if (filter.district) w.push(eq("district", str(filter.district)))
  if (filter.minShortfallBp !== undefined) w.push(gte("shortfall_bp", i32(filter.minShortfallBp)))
  return walk(client, w, parseReport, opts)
}

/** Witnesses in a state for the given months (to compute corroboration on the dashboard). */
export async function dashboardWitnesses(
  client: Reader,
  filter: { state: string; months: string[] },
  opts: ReadOptions = {},
): Promise<ReadResult<Witness>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  const rs = await Promise.all(
    filter.months.map((m) => {
      const w = base(TYPE.witness)
      w.push(eq("state", str(filter.state)), eq("month", str(m)))
      return walk(client, w, parseWitness, { ...opts, atBlock })
    }),
  )
  return { items: rs.flatMap((r) => r.items), atBlock, dropped: rs.reduce((n, r) => n + r.dropped, 0) }
}

/** Q9: everything this wallet has reported. */
export function myReports(client: Reader, me: Hex, opts: ReadOptions = {}) {
  return walk(client, base(TYPE.report), parseReport, { ...opts, createdBy: me })
}

/** One report by key, validated. Returns null if it is missing, expired or not a valid Tolmol report. */
export async function getReport(client: Reader, reportKey: Hex): Promise<Report | null> {
  try {
    return parseReport((await client.getEntity(reportKey)) as RawEntity)
  } catch {
    return null
  }
}

/** Withdrawals filed for reports at one shop (honoured only from the report's own creator, see withdrawnKeys). */
export function shopCorrections(client: Reader, shopId: string, month?: string, opts: ReadOptions = {}): Promise<ReadResult<Correction>> {
  const w = base(TYPE.correction)
  w.push(eq("shop_id", str(shopId)))
  if (month) w.push(eq("month", str(month)))
  return walk(client, w, parseCorrection, opts)
}

/** Withdrawals in a state (for the dashboard). One query: corrections are rare. */
export function stateCorrections(client: Reader, state: string, opts: ReadOptions = {}): Promise<ReadResult<Correction>> {
  const w = base(TYPE.correction)
  w.push(eq("state", str(state)))
  return walk(client, w, parseCorrection, opts)
}

/** Withdrawals of one report. */
export function reportCorrections(client: Reader, reportKey: Hex, opts: ReadOptions = {}): Promise<ReadResult<Correction>> {
  const w = base(TYPE.correction)
  w.push(eq("report_key", key(reportKey)))
  return walk(client, w, parseCorrection, opts)
}

/** Human-readable query strings for a shop page, shown in the UI so anyone can re-run them. */
export function describeShopQueries(shopId: string, month?: string): string[] {
  const m = month ? ` AND month = str('${month}')` : ""
  return [
    `project = str('tolmol') AND type = str('tolmol.report') AND shop_id = str('${shopId}')${m}`,
    `project = str('tolmol') AND type = str('tolmol.witness') AND shop_id = str('${shopId}')${m}`,
    `project = str('tolmol') AND type = str('tolmol.correction') AND shop_id = str('${shopId}')${m}`,
  ]
}

/** Human-readable query strings for the dashboard. */
export function describeDashboardQueries(state: string, fromMonth: string, toMonth: string): string[] {
  return [
    `project = str('tolmol') AND type = str('tolmol.report') AND state = str('${state}') AND month_num >= i32(${monthToNum(fromMonth)}) AND month_num <= i32(${monthToNum(toMonth)})`,
    `project = str('tolmol') AND type = str('tolmol.witness') AND state = str('${state}') AND month = str(<each month>)`,
    `project = str('tolmol') AND type = str('tolmol.correction') AND state = str('${state}')`,
  ]
}
