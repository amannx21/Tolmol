import { ITEMS, MAX_ENTITLED_G, type Item } from "./constants.js"

/** Synthetic shop IDs only: `SYN-<state code>-<4 digits>`. Anything else is rejected, so no real registry ID can slip in. */
export const SHOP_ID_RE = /^SYN-[A-Z]{2}-\d{4}$/
export const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
export const STATE_RE = /^[A-Z]{2}$/
export const DISTRICT_RE = /^[a-z][a-z-]{1,40}$/

export type Shop = {
  key: `0x${string}`
  shopId: string
  state: string
  district: string
  labelEn: string
  labelHi: string
  creator: `0x${string}`
  expiresAt: bigint
}

export type ReportInput = {
  shopId: string
  month: string
  item: Item
  entitledG: number
  receivedG: number
}

export type Report = ReportInput & {
  key: `0x${string}`
  state: string
  district: string
  monthNum: number
  shortfallG: number
  shortfallBp: number
  reportedAt: bigint
  synthetic: boolean
  creator: `0x${string}`
  owner: `0x${string}`
  createdAt: bigint
  expiresAt: bigint
}

export type Witness = {
  key: `0x${string}`
  reportKey: `0x${string}`
  shopId: string
  state: string
  month: string
  item: Item
  reportedAt: bigint
  creator: `0x${string}`
  owner: `0x${string}`
  createdAt: bigint
  expiresAt: bigint
}

export class ValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(`${field}: ${message}`)
    this.name = "ValidationError"
  }
}

export const isItem = (v: unknown): v is Item => typeof v === "string" && (ITEMS as readonly string[]).includes(v)

/** `2026-10` -> `202610`. */
export function monthToNum(month: string): number {
  const m = MONTH_RE.exec(month)
  if (!m) throw new ValidationError("month", `must be YYYY-MM, got ${JSON.stringify(month)}`)
  return Number(m[1]) * 100 + Number(m[2])
}

/** The month `n` months before `month` (n may be negative). */
export function addMonths(month: string, n: number): string {
  const num = monthToNum(month)
  const total = Math.floor(num / 100) * 12 + ((num % 100) - 1) + n
  const y = Math.floor(total / 12)
  const mm = (total % 12) + 1
  return `${y}-${String(mm).padStart(2, "0")}`
}

export function currentMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

/**
 * Integer shortfall in basis points: floor((entitled - received) * 10000 / entitled).
 * All inputs are integers in grams, so this never touches floating point.
 */
export function shortfallBp(entitledG: number, receivedG: number): number {
  if (!Number.isSafeInteger(entitledG) || !Number.isSafeInteger(receivedG)) {
    throw new ValidationError("quantity", "grams must be integers")
  }
  if (entitledG <= 0) throw new ValidationError("entitledG", "must be greater than 0")
  if (receivedG < 0 || receivedG > entitledG) throw new ValidationError("receivedG", "must be between 0 and entitledG")
  return Math.floor(((entitledG - receivedG) * 10_000) / entitledG)
}

/** Converts a kilogram figure typed by a person (e.g. "4.5") to whole grams, rejecting anything that is not a plain number. */
export function kgToGrams(kg: string): number {
  const t = kg.trim()
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(t)) throw new ValidationError("kg", "enter a number like 5 or 4.5")
  const [whole, frac = ""] = t.split(".")
  return Number(whole) * 1000 + Number(frac.padEnd(3, "0"))
}

const ALLOWED_INPUT_KEYS = new Set(["shopId", "month", "item", "entitledG", "receivedG"])

/**
 * Validates a report before it can reach Arkiv. Rejects unknown fields outright, so a caller cannot
 * smuggle a name, phone number or card number into an entity through an extra property.
 */
export function validateReportInput(input: unknown, now: Date = new Date()): ReportInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ValidationError("report", "must be an object")
  }
  for (const k of Object.keys(input)) {
    if (!ALLOWED_INPUT_KEYS.has(k)) throw new ValidationError(k, "is not a report field (Tolmol stores no free text or personal data)")
  }
  const r = input as Record<string, unknown>
  if (typeof r.shopId !== "string" || !SHOP_ID_RE.test(r.shopId)) {
    throw new ValidationError("shopId", "must be a synthetic shop ID like SYN-BR-0042")
  }
  if (typeof r.month !== "string") throw new ValidationError("month", "must be YYYY-MM")
  const monthNum = monthToNum(r.month)
  const nowMonth = monthToNum(currentMonth(now))
  const oldest = monthToNum(addMonths(currentMonth(now), -12))
  if (monthNum > nowMonth) throw new ValidationError("month", "cannot be in the future")
  if (monthNum < oldest) throw new ValidationError("month", "cannot be more than 12 months ago")
  if (!isItem(r.item)) throw new ValidationError("item", `must be one of ${ITEMS.join(", ")}`)
  const e = r.entitledG
  const rec = r.receivedG
  if (typeof e !== "number" || !Number.isSafeInteger(e) || e <= 0 || e > MAX_ENTITLED_G) {
    throw new ValidationError("entitledG", `must be a whole number of grams between 1 and ${MAX_ENTITLED_G}`)
  }
  if (typeof rec !== "number" || !Number.isSafeInteger(rec) || rec < 0 || rec > e) {
    throw new ValidationError("receivedG", "must be a whole number of grams between 0 and the entitlement")
  }
  return { shopId: r.shopId, month: r.month, item: r.item, entitledG: e, receivedG: rec }
}
