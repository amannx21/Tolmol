// "I got my full share this month." A false "I got less" is answered by the people who were at the same counter: each
// phone can say once per outlet and month that it got everything (full ration, a meal every school day, full wages).
// A report then shows how many others got their full share, and is marked "contradicted by others" when several did
// and nobody confirmed it. The report itself is never hidden or deleted: a dealer can short one family only, so a
// real victim keeps their record; the label only gives officials the context. Numbers and IDs only, sealed like a
// confirmation (readonly + 0x…dEaD), 90 days.
import { ExpirationTime } from "@arkiv-network/sdk"
import type { AttributeInputs } from "@arkiv-network/sdk"
import { bool, i32, str, u64 } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import { BURN_ADDRESS, PROJECT, SCHEMA_VERSION } from "./constants.js"
import type { RawEntity } from "./attributes.js"
import type { Report, Shop } from "./model.js"
import { dayStartMs, DISTRICT_RE, MONTH_RE, monthToNum, SHOP_ID_RE, STATE_RE } from "./model.js"
import type { Reader, ReadOptions, ReadResult } from "./queries.js"
import { DuplicateError, type Writer } from "./writes.js"

type Hex = `0x${string}`
const lc = (x: string) => x.toLowerCase()

export const FULLSHARE_TYPE = "tolmol.fullshare" as const
/** How many others must say they got their full share before an unconfirmed report is marked contradicted. */
export const CONTRADICT_MIN = 3

export type FullShare = { key: Hex; creator: Hex; shopId: string; state: string; district: string; month: string; createdAt: bigint }

export function fullShareAttributes(shop: Pick<Shop, "shopId" | "state" | "district">, month: string, o: { synthetic: boolean; atMs: bigint }): AttributeInputs {
  if (!SHOP_ID_RE.test(shop.shopId) || !STATE_RE.test(shop.state) || !DISTRICT_RE.test(shop.district) || !MONTH_RE.test(month)) throw new Error("invalid full-share record")
  return {
    project: str(PROJECT), type: str(FULLSHARE_TYPE), schema_version: i32(SCHEMA_VERSION), shop_id: str(shop.shopId), state: str(shop.state),
    district: str(shop.district), month: str(month), month_num: i32(monthToNum(month)), reported_at: u64(dayStartMs(o.atMs)), synthetic: bool(o.synthetic),
  }
}

const val = (e: RawEntity, n: string, t: string) => {
  const a = e.attributes?.[n]
  return a && a.type === t ? a.value : undefined
}
export function parseFullShare(e: RawEntity): FullShare | null {
  if (val(e, "project", "str") !== PROJECT || val(e, "type", "str") !== FULLSHARE_TYPE || val(e, "schema_version", "i32") !== SCHEMA_VERSION) return null
  if (typeof e.key !== "string" || typeof e.creator !== "string" || e.createdAt === undefined) return null
  const shopId = val(e, "shop_id", "str"), state = val(e, "state", "str"), district = val(e, "district", "str"), month = val(e, "month", "str")
  if (typeof shopId !== "string" || !SHOP_ID_RE.test(shopId) || typeof state !== "string" || !STATE_RE.test(state)) return null
  if (typeof district !== "string" || !DISTRICT_RE.test(district) || typeof month !== "string" || !MONTH_RE.test(month) || val(e, "month_num", "i32") !== monthToNum(month)) return null
  return { key: e.key as Hex, creator: e.creator as Hex, shopId, state, district, month, createdAt: e.createdAt }
}

async function walk(client: Reader, where: ReturnType<typeof eq>[], opts: ReadOptions & { createdBy?: Hex } = {}): Promise<ReadResult<FullShare>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  let q = client.select({ key: true, creator: true, createdAt: true, attributes: true }).where(where).limit(200).atBlock(atBlock)
  if (opts.createdBy) q = q.createdBy(opts.createdBy)
  let page = await q.fetch()
  const items: FullShare[] = []
  let dropped = 0
  for (let n = 0; ; n++) {
    for (const e of page.entities) {
      const x = parseFullShare(e as RawEntity)
      if (x) items.push(x)
      else dropped++
    }
    if (!page.hasNextPage() || n + 1 >= (opts.maxPages ?? 25)) break
    page = await page.next()
  }
  return { items, atBlock, dropped }
}
const base = () => [eq("project", str(PROJECT)), eq("type", str(FULLSHARE_TYPE))]
/** Q29: "got my full share" records at one outlet for one month. */
export const shopFullShares = (c: Reader, shopId: string, month: string, o: ReadOptions = {}) => walk(c, [...base(), eq("shop_id", str(shopId)), eq("month", str(month))], o)

/**
 * What the people at the same counter said about a report's month: how many other phones got their full share
 * (one each, never the reporter, never a phone that confirmed the report), and whether the report is contradicted.
 */
export function fullShareContext(report: Pick<Report, "shopId" | "month" | "creator">, fullShares: readonly FullShare[], confirmers: readonly string[]): { others: number; contradicted: boolean } {
  const skip = new Set([lc(report.creator), ...confirmers.map(lc)])
  const others = new Set(fullShares.filter((f) => f.shopId === report.shopId && f.month === report.month && !skip.has(lc(f.creator))).map((f) => lc(f.creator))).size
  return { others, contradicted: others >= CONTRADICT_MIN && confirmers.length === 0 }
}

/** This phone got its full share at this outlet this month. Once per phone, outlet and month; sealed, 90 days. */
export async function sayFullShare(reader: Reader, writer: Writer, shop: Pick<Shop, "shopId" | "state" | "district">, month: string, o: { synthetic: boolean; now?: Date } = { synthetic: true }) {
  const me = writer.account.address
  const mine = await walk(reader, [...base(), eq("shop_id", str(shop.shopId)), eq("month", str(month))], { createdBy: me, maxPages: 1 })
  if (mine.items[0]) throw new DuplicateError("You already said you got your full share here this month", mine.items[0].key)
  const [predicted] = await reader.predictEntityKeys({ owner: me, count: 1 })
  if (!predicted) throw new Error("could not predict the entity key")
  const res = await writer.executeBatch({
    creates: [
      {
        payload: new Uint8Array(),
        contentType: "application/octet-stream",
        attributes: fullShareAttributes(shop, month, { synthetic: o.synthetic, atMs: BigInt((o.now ?? new Date()).getTime()) }),
        expires: ExpirationTime.fromDays(90),
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
