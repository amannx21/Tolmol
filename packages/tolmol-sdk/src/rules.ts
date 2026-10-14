import { BLOCKS_PER_DAY, ISSUE_NAMES, ISSUES, LIFETIME_DAYS, MIN_WITNESSES_TO_EXTEND, type IssueName } from "./constants.js"
import type { Correction, Report, Witness } from "./model.js"

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
export function dedupeReports(reports: readonly Report[], withdrawn: ReadonlySet<string> = new Set()): Report[] {
  const best = new Map<string, Report>()
  for (const r of reports) {
    if (withdrawn.has(lc(r.key))) continue
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
 * Null when the reporter opted out of community extension: the witness is still recorded, nothing is extended.
 */
export function extensionTarget(
  report: Pick<Report, "createdAt" | "expiresAt"> & { extendable?: boolean },
  witnessesAfterThisOne: number,
  head: bigint,
): bigint | null {
  if (report.extendable === false || witnessesAfterThisOne < MIN_WITNESSES_TO_EXTEND) return null
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
  /** How many counted reports flagged each issue. */
  issueCounts: Record<IssueName, number>
}

/** Aggregates deduplicated reports (and their witnesses) per shop, worst shortfall first. */
export function shopStats(reports: readonly Report[], witnesses: readonly Witness[], withdrawn: ReadonlySet<string> = new Set()): ShopStats[] {
  const byReport = new Map<string, Witness[]>()
  for (const w of witnesses) {
    const k = lc(w.reportKey)
    const list = byReport.get(k)
    if (list) list.push(w)
    else byReport.set(k, [w])
  }
  const map = new Map<string, ShopStats & { _reporters: Set<string>; _months: Set<string> }>()
  for (const r of dedupeReports(reports, withdrawn)) {
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
        issueCounts: Object.fromEntries(ISSUE_NAMES.map((n) => [n, 0])) as Record<IssueName, number>,
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
    for (const n of ISSUE_NAMES) if (r.issues & ISSUES[n]) s.issueCounts[n]++
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

/**
 * Keys of reports withdrawn by their own reporter. A correction counts only if its $creator is the report's
 * $creator; anyone else's "correction" is ignored, so nobody can hide someone else's report.
 */
export function withdrawnKeys(reports: readonly Report[], corrections: readonly Correction[]): Set<string> {
  const creatorOf = new Map(reports.map((r) => [lc(r.key), lc(r.creator)]))
  const out = new Set<string>()
  for (const c of corrections) {
    if (c.action === "withdraw" && creatorOf.get(lc(c.reportKey)) === lc(c.creator)) out.add(lc(c.reportKey))
  }
  return out
}

/** Defaults for patternSignals: 3+ different devices within 30 blocks (1 minute on Tiramisu). */
export const RAPID_WINDOW_BLOCKS = 30n
export const RAPID_MIN_DEVICES = 3

export type RapidGroup = { fromBlock: bigint; toBlock: bigint; count: number; devices: number; keys: string[] }

/**
 * Groups of entities written by RAPID_MIN_DEVICES or more different devices within RAPID_WINDOW_BLOCKS of each
 * other. Real card holders at one shop rarely file within the same minute; a script running many wallets does.
 * A pattern worth a look, not proof: everything here comes from public block numbers and $creator.
 */
export function rapidGroups(
  items: readonly { createdAt: bigint; creator: string; key: string }[],
  windowBlocks: bigint = RAPID_WINDOW_BLOCKS,
  minDevices: number = RAPID_MIN_DEVICES,
): RapidGroup[] {
  const sorted = [...items].sort((a, b) => (earlier(a, b) ? -1 : earlier(b, a) ? 1 : 0))
  const out: RapidGroup[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1]!.createdAt - sorted[i]!.createdAt <= windowBlocks) j++
    const devices = new Set(sorted.slice(i, j + 1).map((x) => lc(x.creator))).size
    if (devices >= minDevices) {
      const group = sorted.slice(i, j + 1)
      out.push({ fromBlock: group[0]!.createdAt, toBlock: group[group.length - 1]!.createdAt, count: group.length, devices, keys: group.map((x) => lc(x.key)) })
      i = j + 1
    } else i++
  }
  return out
}

export type PatternSignals = {
  /** Counted reports filed in rapid groups (see rapidGroups). */
  rapidReports: RapidGroup[]
  /** Valid confirmations filed in rapid groups. */
  rapidConfirmations: RapidGroup[]
  /** Counted reports whose device wrote nothing else in this data: no other report, no confirmation. */
  oneOffReports: number
  /** Reports counted (after dedupe and withdrawals). */
  reports: number
}

/**
 * Public-data patterns for one shop (or any set of reports), shown next to the numbers so readers can judge them.
 * Tolmol cannot prove who is behind a device (threat model T9, T10); this makes bursts and one-off devices visible.
 */
export function patternSignals(
  reports: readonly Report[],
  witnesses: readonly Witness[],
  withdrawn: ReadonlySet<string> = new Set(),
): PatternSignals {
  const counted = dedupeReports(reports, withdrawn)
  const valid = counted.flatMap((r) => validWitnesses(r, witnesses))
  const activity = new Map<string, number>()
  for (const x of [...reports, ...witnesses]) activity.set(lc(x.creator), (activity.get(lc(x.creator)) ?? 0) + 1)
  return {
    rapidReports: rapidGroups(counted),
    rapidConfirmations: rapidGroups(valid),
    oneOffReports: counted.filter((r) => (activity.get(lc(r.creator)) ?? 0) <= 1).length,
    reports: counted.length,
  }
}

/** Keys of counted reports that fall in a rapid group at their shop (for the "leave out bursts" view). */
export function rapidReportKeys(reports: readonly Report[], withdrawn: ReadonlySet<string> = new Set()): Set<string> {
  const byShop = new Map<string, Report[]>()
  for (const r of dedupeReports(reports, withdrawn)) byShop.set(r.shopId, [...(byShop.get(r.shopId) ?? []), r])
  const out = new Set<string>()
  for (const list of byShop.values()) for (const g of rapidGroups(list)) for (const k of g.keys) out.add(k)
  return out
}
