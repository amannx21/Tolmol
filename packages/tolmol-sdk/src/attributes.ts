import type { AttributeInputs } from "@arkiv-network/sdk"
import { bool, i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import { PROJECT, SCHEMA_VERSION, TYPE } from "./constants.js"
import {
  DISTRICT_RE,
  isItem,
  monthToNum,
  MONTH_RE,
  SHOP_ID_RE,
  shortfallBp,
  STATE_RE,
  type Report,
  type ReportInput,
  type Shop,
  type Witness,
} from "./model.js"

type Hex = `0x${string}`

/** The shape of an entity as returned by a query or `getEntity`, loosely typed so we can validate it ourselves. */
export type RawEntity = {
  key?: Hex
  creator?: Hex
  owner?: Hex
  createdAt?: bigint
  expiresAt?: bigint
  attributes?: Readonly<Record<string, { type: string; value: unknown } | undefined>>
  payload?: Uint8Array
  toJson?: () => unknown
}

export function shopAttributes(s: { shopId: string; state: string; district: string }): AttributeInputs {
  if (!SHOP_ID_RE.test(s.shopId)) throw new Error(`invalid synthetic shop id ${s.shopId}`)
  if (!STATE_RE.test(s.state) || !DISTRICT_RE.test(s.district)) throw new Error(`invalid state/district for ${s.shopId}`)
  return {
    project: str(PROJECT),
    type: str(TYPE.shop),
    schema_version: i32(SCHEMA_VERSION),
    shop_id: str(s.shopId),
    state: str(s.state),
    district: str(s.district),
    synthetic: bool(true),
  }
}

export function reportAttributes(
  input: ReportInput,
  shop: Pick<Shop, "state" | "district">,
  opts: { synthetic: boolean; reportedAtMs: bigint },
): AttributeInputs {
  return {
    project: str(PROJECT),
    type: str(TYPE.report),
    schema_version: i32(SCHEMA_VERSION),
    shop_id: str(input.shopId),
    state: str(shop.state),
    district: str(shop.district),
    month: str(input.month),
    month_num: i32(monthToNum(input.month)),
    item: str(input.item),
    entitled_g: i32(input.entitledG),
    received_g: i32(input.receivedG),
    shortfall_g: i32(input.entitledG - input.receivedG),
    shortfall_bp: i32(shortfallBp(input.entitledG, input.receivedG)),
    reported_at: u64(opts.reportedAtMs),
    synthetic: bool(opts.synthetic),
  }
}

export function witnessAttributes(
  report: Pick<Report, "key" | "shopId" | "state" | "month" | "item">,
  opts: { synthetic: boolean; reportedAtMs: bigint },
): AttributeInputs {
  return {
    project: str(PROJECT),
    type: str(TYPE.witness),
    schema_version: i32(SCHEMA_VERSION),
    report_key: key(report.key),
    shop_id: str(report.shopId),
    state: str(report.state),
    month: str(report.month),
    item: str(report.item),
    reported_at: u64(opts.reportedAtMs),
    synthetic: bool(opts.synthetic),
  }
}

// --- Parsing. Anyone can write an entity with our attributes, so every field is type-checked and
// --- range-checked on the way in. Anything malformed is dropped (returns null), never repaired.

function attr<T extends string>(e: RawEntity, name: string, type: T) {
  const a = e.attributes?.[name]
  return a && a.type === type ? a.value : undefined
}
const s = (e: RawEntity, n: string) => {
  const v = attr(e, n, "str")
  return typeof v === "string" ? v : undefined
}
const n32 = (e: RawEntity, n: string) => {
  const v = attr(e, n, "i32")
  return typeof v === "number" && Number.isSafeInteger(v) ? v : undefined
}
const n64 = (e: RawEntity, n: string) => {
  const v = attr(e, n, "u64")
  return typeof v === "bigint" ? v : undefined
}
const b = (e: RawEntity, n: string) => {
  const v = attr(e, n, "bool")
  return typeof v === "boolean" ? v : undefined
}
const isHex = (v: unknown): v is Hex => typeof v === "string" && /^0x[0-9a-fA-F]+$/.test(v)

function common(e: RawEntity, type: string) {
  if (s(e, "project") !== PROJECT || s(e, "type") !== type || n32(e, "schema_version") !== SCHEMA_VERSION) return null
  if (!isHex(e.key) || !isHex(e.creator)) return null
  return { key: e.key, creator: e.creator }
}

export function parseShop(e: RawEntity): Shop | null {
  const c = common(e, TYPE.shop)
  if (!c) return null
  const shopId = s(e, "shop_id")
  const state = s(e, "state")
  const district = s(e, "district")
  if (!shopId || !SHOP_ID_RE.test(shopId) || !state || !STATE_RE.test(state) || !district || !DISTRICT_RE.test(district)) return null
  if (b(e, "synthetic") !== true) return null
  let labelEn = shopId
  let labelHi = shopId
  try {
    const j = e.toJson?.() as { label_en?: unknown; label_hi?: unknown } | undefined
    if (typeof j?.label_en === "string" && j.label_en.length <= 80) labelEn = j.label_en
    if (typeof j?.label_hi === "string" && j.label_hi.length <= 80) labelHi = j.label_hi
  } catch {
    /* payload not selected or not JSON: fall back to the ID */
  }
  return { ...c, shopId, state, district, labelEn, labelHi, expiresAt: e.expiresAt ?? 0n }
}

export function parseReport(e: RawEntity): Report | null {
  const c = common(e, TYPE.report)
  if (!c || !isHex(e.owner) || e.createdAt === undefined || e.expiresAt === undefined) return null
  const shopId = s(e, "shop_id")
  const month = s(e, "month")
  const item = s(e, "item")
  const state = s(e, "state")
  const district = s(e, "district")
  const monthNum = n32(e, "month_num")
  const entitledG = n32(e, "entitled_g")
  const receivedG = n32(e, "received_g")
  const sg = n32(e, "shortfall_g")
  const sbp = n32(e, "shortfall_bp")
  const reportedAt = n64(e, "reported_at")
  if (!shopId || !SHOP_ID_RE.test(shopId) || !month || !MONTH_RE.test(month) || !isItem(item)) return null
  if (!state || !district || monthNum !== monthToNum(month)) return null
  if (entitledG === undefined || receivedG === undefined || sg === undefined || sbp === undefined || reportedAt === undefined) return null
  // Recompute derived fields instead of trusting them.
  let bp: number
  try {
    bp = shortfallBp(entitledG, receivedG)
  } catch {
    return null
  }
  if (sg !== entitledG - receivedG || sbp !== bp) return null
  return {
    ...c,
    owner: e.owner,
    shopId,
    month,
    monthNum,
    item,
    state,
    district,
    entitledG,
    receivedG,
    shortfallG: sg,
    shortfallBp: sbp,
    reportedAt,
    synthetic: b(e, "synthetic") === true,
    createdAt: e.createdAt,
    expiresAt: e.expiresAt,
  }
}

export function parseWitness(e: RawEntity): Witness | null {
  const c = common(e, TYPE.witness)
  if (!c || !isHex(e.owner) || e.createdAt === undefined || e.expiresAt === undefined) return null
  const reportKey = attr(e, "report_key", "key")
  const shopId = s(e, "shop_id")
  const state = s(e, "state")
  const month = s(e, "month")
  const item = s(e, "item")
  const reportedAt = n64(e, "reported_at")
  if (!state || !STATE_RE.test(state)) return null
  if (!isHex(reportKey) || !shopId || !SHOP_ID_RE.test(shopId) || !month || !MONTH_RE.test(month) || !isItem(item)) return null
  if (reportedAt === undefined) return null
  return { ...c, owner: e.owner, reportKey, shopId, state, month, item, reportedAt, createdAt: e.createdAt, expiresAt: e.expiresAt }
}
