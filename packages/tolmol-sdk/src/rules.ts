import { BLOCKS_PER_DAY, LIFETIME_DAYS, MIN_WITNESSES_TO_EXTEND } from "./constants.js"
import type { Report, Witness } from "./model.js"

const lc = (s: string) => s.toLowerCase()

/** Earlier block wins; within one block, the lower entity key wins. Result order from the node is never used. */
function earlier(a: { createdAt: bigint; key: string }, b: { createdAt: bigint; key: string }): boolean {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt
  return lc(a.key) < lc(b.key)
}

/**
 * Keeps one report per (creator, shop, month, item): the earliest by block, ties broken by key.
 * Deterministic for any input order, so every viewer computes the same set.
 */
export function dedupeReports(reports: readonly Report[]): Report[] {
  const best = new Map<string, Report>()
  for (const r of reports) {
    const id = `${lc(r.creator)}|${r.shopId}|${r.month}|${r.item}`
    const cur = best.get(id)
    if (!cur || earlier(r, cur)) best.set(id, r)
  }
  return [...best.values()].sort((a, b) => (earlier(a, b) ? -1 : earlier(b, a) ? 1 : 0))
}

/**
 * Valid witnesses of one report: matching report key and shop/month/item, not the reporter,
 * one per creator (the earliest).
 */
export function validWitnesses(report: Report, witnesses: readonly Witness[]): Witness[] {
  const best = new Map<string, Witness>()
  for (const w of witnesses) {
    if (lc(w.reportKey) !== lc(report.key)) continue
    if (w.shopId !== report.shopId || w.month !== report.month || w.item !== report.item) continue
    if (lc(w.creator) === lc(report.creator)) continue
    const cur = best.get(lc(w.creator))
    if (!cur || earlier(w, cur)) best.set(lc(w.creator), w)
  }
  return [...best.values()].sort((a, b) => (earlier(a, b) ? -1 : 1))
}

export const witnessCount = (report: Report, witnesses: readonly Witness[]) => validWitnesses(report, witnesses).length

/**
 * The deadline a corroborating witness should extend a report to, or null for "no extension".
 * Extension happens once the report will have MIN_WITNESSES_TO_EXTEND distinct witnesses (including the new one).
 * Target: max(current, head + 180 days), capped at createdAt + 365 days. Never shortens.
 */
export function extensionTarget(
  report: Pick<Report, "createdAt" | "expiresAt">,
  witnessesAfterThisOne: number,
  head: bigint,
): bigint | null {
  if (witnessesAfterThisOne < MIN_WITNESSES_TO_EXTEND) return null
  const cap = report.createdAt + BigInt(LIFETIME_DAYS.cap) * BLOCKS_PER_DAY
  const want = head + BigInt(LIFETIME_DAYS.corroborated) * BLOCKS_PER_DAY
  const target = want < cap ? want : cap
  return target > report.expiresAt ? target : null
}

export type ShopStats = {
  shopId: string
  state: string
  district: string
  reports: number
  reporters: number
  corroborated: number
  witnesses: number
  totalEntitledG: number
  totalShortfallG: number
  /** Grain-weighted shortfall across all reports: floor(sum shortfall * 10000 / sum entitled). */
  shortfallBp: number
  /** Reports with a positive shortfall. */
  shortReports: number
  months: string[]
}

/** Aggregates deduplicated reports (and their witnesses) per shop, worst shortfall first. */
export function shopStats(reports: readonly Report[], witnesses: readonly Witness[]): ShopStats[] {
  const byReport = new Map<string, Witness[]>()
  for (const w of witnesses) {
    const k = lc(w.reportKey)
    const list = byReport.get(k)
    if (list) list.push(w)
    else byReport.set(k, [w])
  }
  const map = new Map<string, ShopStats & { _reporters: Set<string>; _months: Set<string> }>()
  for (const r of dedupeReports(reports)) {
    let s = map.get(r.shopId)
    if (!s) {
      s = {
        shopId: r.shopId,
        state: r.state,
        district: r.district,
        reports: 0,
        reporters: 0,
        corroborated: 0,
        witnesses: 0,
        totalEntitledG: 0,
        totalShortfallG: 0,
        shortfallBp: 0,
        shortReports: 0,
        months: [],
        _reporters: new Set(),
        _months: new Set(),
      }
      map.set(r.shopId, s)
    }
    const wc = witnessCount(r, byReport.get(lc(r.key)) ?? [])
    s.reports++
    s._reporters.add(lc(r.creator))
    s._months.add(r.month)
    s.witnesses += wc
    if (wc >= 1) s.corroborated++
    if (r.shortfallG > 0) s.shortReports++
    s.totalEntitledG += r.entitledG
    s.totalShortfallG += r.shortfallG
  }
  return [...map.values()]
    .map(({ _reporters, _months, ...s }) => ({
      ...s,
      reporters: _reporters.size,
      months: [..._months].sort(),
      shortfallBp: s.totalEntitledG > 0 ? Math.floor((s.totalShortfallG * 10_000) / s.totalEntitledG) : 0,
    }))
    .sort((a, b) => b.shortfallBp - a.shortfallBp || b.corroborated - a.corroborated || (a.shopId < b.shopId ? -1 : 1))
}

/** Remaining lifetime in whole days (floor), from block heights. */
export const daysLeft = (expiresAt: bigint, head: bigint) =>
  expiresAt <= head ? 0 : Number((expiresAt - head) / BLOCKS_PER_DAY)

/** Basis points as a percentage string with one decimal, e.g. 1650 -> "16.5%". Integer math only. */
export function formatBp(bp: number): string {
  const tenths = Math.floor(bp / 10)
  return `${Math.floor(tenths / 10)}.${tenths % 10}%`
}

/** Grams as kilograms with up to 3 decimals, e.g. 4500 -> "4.5 kg". */
export function formatKg(g: number): string {
  const whole = Math.floor(g / 1000)
  const frac = String(g % 1000).padStart(3, "0").replace(/0+$/, "")
  return frac ? `${whole}.${frac} kg` : `${whole} kg`
}
