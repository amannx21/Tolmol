// Who checks the checkers. Every finding an official or a delegated inspector recorded is set against what reporters
// said at that outlet in the days that followed. A finding that clears an outlet ("inspected: no issue", "grain or
// dues restored") followed by the same evidence that puts an outlet on the attention list (20%+ short over 3+ reports
// from 2+ devices) is flagged as contradicted. Nothing here is stored: every reader recomputes it from public entities,
// so an official cannot hide a bad track record and nobody can fake one.
import { BLOCKS_PER_DAY } from "./constants.js"
import type { Report } from "./model.js"
import type { OfficialAction, OfficialRecord } from "./official.js"
import { dedupeReports } from "./rules.js"

type Hex = `0x${string}`

/** Findings that say the outlet is fine, or that the problem was put right. */
export const CLEARING_ACTIONS: readonly OfficialAction[] = ["inspected_no_issue", "grain_restored", "dues_restored"]
/** How long after a finding the reports are counted against it. */
export const AFTER_DAYS = 60

export type AfterStats = { reports: number; reporters: number; shortfallBp: number }
export type Finding = { action: OfficialRecord; after: AfterStats; contradicted: boolean }
export type TrackRecord = { signer: Hex; findings: Finding[]; clearing: number; contradicted: number }

/** Reports at the outlet created after `fromBlock` and within `days`: how many, from how many devices, how short. */
export function afterStats(reports: readonly Report[], shopId: string, fromBlock: bigint, days = AFTER_DAYS): AfterStats {
  const until = fromBlock + BigInt(days) * BLOCKS_PER_DAY
  const rs = dedupeReports(reports).filter((r) => r.shopId === shopId && r.createdAt > fromBlock && r.createdAt <= until)
  const entitled = rs.reduce((t, r) => t + r.entitledG, 0)
  const short = rs.reduce((t, r) => t + r.shortfallG, 0)
  return { reports: rs.length, reporters: new Set(rs.map((r) => r.creator.toLowerCase())).size, shortfallBp: entitled ? Math.floor((short * 10_000) / entitled) : 0 }
}

/** A clearing finding followed by attention-list evidence. */
export const isContradicted = (a: Pick<OfficialRecord, "action">, s: AfterStats) =>
  CLEARING_ACTIONS.includes(a.action) && s.reports >= 3 && s.reporters >= 2 && s.shortfallBp >= 2000

/**
 * The track record of every official and inspector, from findings that already count (validOfficialActions).
 * A finding is listed under the wallet that signed it and, for a delegated inspector, also under the official who
 * sent them. Most contradicted first.
 */
export function trackRecords(actions: ReadonlyMap<string, readonly OfficialRecord[]>, reports: readonly Report[], days = AFTER_DAYS): TrackRecord[] {
  const by = new Map<string, { signer: Hex; findings: Finding[] }>()
  const add = (signer: Hex, f: Finding) => {
    const id = signer.toLowerCase()
    const cur = by.get(id) ?? { signer, findings: [] }
    cur.findings.push(f)
    by.set(id, cur)
  }
  for (const list of actions.values()) {
    for (const a of list) {
      const after = afterStats(reports, a.shopId, a.createdAt, days)
      const f: Finding = { action: a, after, contradicted: isContradicted(a, after) }
      add(a.creator, f)
      if (a.via && a.via.toLowerCase() !== a.creator.toLowerCase()) add(a.via, f)
    }
  }
  return [...by.values()]
    .map(({ signer, findings }) => ({
      signer,
      findings: findings.sort((x, y) => (x.action.createdAt < y.action.createdAt ? 1 : -1)),
      clearing: findings.filter((f) => CLEARING_ACTIONS.includes(f.action.action)).length,
      contradicted: findings.filter((f) => f.contradicted).length,
    }))
    .sort((x, y) => y.contradicted - x.contradicted || y.findings.length - x.findings.length || (x.signer < y.signer ? -1 : 1))
}
