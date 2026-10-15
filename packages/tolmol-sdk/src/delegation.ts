// Inspector delegation, the way a district office actually works: the District Supply Officer (a verified official)
// sends a field inspector to a named shop for a few days. On Arkiv that is a `tolmol.delegation` entity created by the
// official: inspector device, one outlet, and the last block of the assignment. Authority only narrows: an inspector
// can record only inspection results, only for that outlet, only inside the window, and only if the delegating
// official's own district is the outlet's district. The entity is readonly and owned by the official, who can revoke it
// by deleting it; it lives a year past the window, so findings made in time stay attributable after the window ends.
import { ExpirationTime } from "@arkiv-network/sdk"
import { bool, i32, str, u64 } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import type { AttributeInputs } from "@arkiv-network/sdk"
import { BLOCKS_PER_DAY, PROJECT, SCHEMA_VERSION } from "./constants.js"
import { dayStartMs, DISTRICT_RE, SHOP_ID_RE, STATE_RE } from "./model.js"
import type { RawEntity } from "./attributes.js"
import type { OfficialAction } from "./official.js"
import type { Reader, ReadOptions, ReadResult } from "./queries.js"
import type { Writer } from "./writes.js"

type Hex = `0x${string}`
const lc = (x: string) => x.toLowerCase()

export const DELEGATION_TYPE = "tolmol.delegation" as const
/** What a delegated inspector may record: findings of the inspection, nothing that punishes or closes a case. */
export const INSPECTOR_ACTIONS: readonly OfficialAction[] = ["inspected_shortage_found", "inspected_no_issue"]
export const MAX_DELEGATION_DAYS = 30

export type Delegation = { key: Hex; creator: Hex; inspector: Hex; shopId: string; state: string; district: string; untilBlock: bigint; createdAt: bigint }

export function delegationAttributes(shop: { shopId: string; state: string; district: string }, inspector: string, untilBlock: bigint, o: { synthetic: boolean; atMs: bigint }): AttributeInputs {
  if (!SHOP_ID_RE.test(shop.shopId) || !STATE_RE.test(shop.state) || !DISTRICT_RE.test(shop.district)) throw new Error("invalid outlet")
  if (!/^0x[0-9a-fA-F]{40}$/.test(inspector)) throw new Error("invalid inspector address")
  return {
    project: str(PROJECT),
    type: str(DELEGATION_TYPE),
    schema_version: i32(SCHEMA_VERSION),
    inspector: str(lc(inspector)),
    shop_id: str(shop.shopId),
    state: str(shop.state),
    district: str(shop.district),
    until_block: u64(untilBlock),
    reported_at: u64(dayStartMs(o.atMs)),
    synthetic: bool(o.synthetic),
  }
}

const val = (e: RawEntity, n: string, t: string) => {
  const a = e.attributes?.[n]
  return a && a.type === t ? a.value : undefined
}
export function parseDelegation(e: RawEntity): Delegation | null {
  if (val(e, "project", "str") !== PROJECT || val(e, "type", "str") !== DELEGATION_TYPE || val(e, "schema_version", "i32") !== SCHEMA_VERSION) return null
  if (typeof e.key !== "string" || typeof e.creator !== "string" || e.createdAt === undefined) return null
  const inspector = val(e, "inspector", "str")
  const shopId = val(e, "shop_id", "str")
  const state = val(e, "state", "str")
  const district = val(e, "district", "str")
  const until = val(e, "until_block", "u64")
  if (typeof inspector !== "string" || !/^0x[0-9a-f]{40}$/.test(inspector) || typeof shopId !== "string" || !SHOP_ID_RE.test(shopId)) return null
  if (typeof state !== "string" || !STATE_RE.test(state) || typeof district !== "string" || !DISTRICT_RE.test(district) || typeof until !== "bigint") return null
  // A window must start no earlier than the entity and last at most 30 days.
  if (until < e.createdAt || until > e.createdAt + BigInt(MAX_DELEGATION_DAYS) * BLOCKS_PER_DAY) return null
  return { key: e.key as Hex, creator: e.creator as Hex, inspector: inspector as Hex, shopId, state, district, untilBlock: until, createdAt: e.createdAt }
}

async function walk(client: Reader, where: ReturnType<typeof eq>[], opts: ReadOptions = {}): Promise<ReadResult<Delegation>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  let page = await client.select({ key: true, creator: true, createdAt: true, attributes: true }).where(where).limit(200).atBlock(atBlock).fetch()
  const items: Delegation[] = []
  let dropped = 0
  for (let n = 0; ; n++) {
    for (const e of page.entities) {
      const x = parseDelegation(e as RawEntity)
      if (x) items.push(x)
      else dropped++
    }
    if (!page.hasNextPage() || n + 1 >= (opts.maxPages ?? 25)) break
    page = await page.next()
  }
  return { items, atBlock, dropped }
}
const base = () => [eq("project", str(PROJECT)), eq("type", str(DELEGATION_TYPE))]
/** Q23: delegations for one outlet. */
export const shopDelegations = (c: Reader, shopId: string, o: ReadOptions = {}) => walk(c, [...base(), eq("shop_id", str(shopId))], o)
/** Q24: delegations in a state (dashboard). */
export const stateDelegations = (c: Reader, state: string, o: ReadOptions = {}) => walk(c, [...base(), eq("state", str(state))], o)

/** The live delegation that lets `inspector` act at `shopId` at block `at`, if any. Only the delegating official is checked by the caller. */
export function activeDelegation(delegations: readonly Delegation[], inspector: string, shopId: string, at: bigint): Delegation | null {
  return delegations.find((d) => d.shopId === shopId && lc(d.inspector) === lc(inspector) && d.createdAt <= at && at <= d.untilBlock) ?? null
}

/** A verified official delegates an inspector to one outlet for `days` (1 to 30). Readonly, owned by the official (who may delete it to revoke). */
export async function delegateInspector(reader: Reader, official: Writer, shop: { shopId: string; state: string; district: string }, inspector: string, days: number, o: { synthetic: boolean; now?: Date } = { synthetic: true }) {
  if (!Number.isInteger(days) || days < 1 || days > MAX_DELEGATION_DAYS) throw new Error(`days must be 1 to ${MAX_DELEGATION_DAYS}`)
  const head = await reader.getBlockNumber({ cacheTime: 0 })
  const until = head + BigInt(days) * BLOCKS_PER_DAY
  return official.createEntity({
    payload: new Uint8Array(),
    contentType: "application/octet-stream",
    attributes: delegationAttributes(shop, inspector, until, { synthetic: o.synthetic, atMs: BigInt((o.now ?? new Date()).getTime()) }),
    expires: ExpirationTime.fromDays(days + 365),
    flags: { readonly: true },
  })
}
