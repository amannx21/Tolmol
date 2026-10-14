import { explorerAddressUrl, explorerEntityUrl, issueList } from "./constants.js"
import type { Report, Witness } from "./model.js"
import { dedupeReports, validWitnesses } from "./rules.js"

export type EvidenceRow = {
  kind: "report" | "witness"
  entity_key: string
  report_key: string
  shop_id: string
  state: string
  month: string
  item: string
  entitled_g: number | ""
  received_g: number | ""
  shortfall_g: number | ""
  shortfall_bp: number | ""
  creator: string
  created_at_block: string
  expires_at_block: string
  read_at_block: string
  synthetic: boolean | ""
  issues: string
  withdrawn: boolean
  counted: boolean
  entity_url: string
  creator_url: string
}

/**
 * Flattens one shop's reports and witnesses into rows a journalist or RTI filer can keep.
 * Every row names the entity key, the on-chain creator and the block, so it can be re-checked on the explorer.
 * `counted` says whether the dashboard counts the row (after dedupe and the different-witness rule).
 */
export function evidenceRows(
  reports: readonly Report[],
  witnesses: readonly Witness[],
  readAtBlock: bigint,
  withdrawn: ReadonlySet<string> = new Set(),
): EvidenceRow[] {
  const kept = new Set(dedupeReports(reports, withdrawn).map((r) => r.key.toLowerCase()))
  const rows: EvidenceRow[] = []
  const sorted = [...reports].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.key < b.key ? -1 : 1))
  for (const r of sorted) {
    rows.push({
      kind: "report",
      entity_key: r.key,
      report_key: r.key,
      shop_id: r.shopId,
      state: r.state,
      month: r.month,
      item: r.item,
      entitled_g: r.entitledG,
      received_g: r.receivedG,
      shortfall_g: r.shortfallG,
      shortfall_bp: r.shortfallBp,
      creator: r.creator,
      created_at_block: r.createdAt.toString(),
      expires_at_block: r.expiresAt.toString(),
      read_at_block: readAtBlock.toString(),
      synthetic: r.synthetic,
      issues: issueList(r.issues).join(" "),
      withdrawn: withdrawn.has(r.key.toLowerCase()),
      counted: kept.has(r.key.toLowerCase()),
      entity_url: explorerEntityUrl(r.key),
      creator_url: explorerAddressUrl(r.creator),
    })
    const valid = new Set(validWitnesses(r, witnesses).map((w) => w.key.toLowerCase()))
    for (const w of witnesses.filter((x) => x.reportKey.toLowerCase() === r.key.toLowerCase())) {
      rows.push({
        kind: "witness",
        entity_key: w.key,
        report_key: w.reportKey,
        shop_id: w.shopId,
        state: w.state,
        month: w.month,
        item: w.item,
        entitled_g: "",
        received_g: "",
        shortfall_g: "",
        shortfall_bp: "",
        creator: w.creator,
        created_at_block: w.createdAt.toString(),
        expires_at_block: w.expiresAt.toString(),
        read_at_block: readAtBlock.toString(),
        synthetic: "",
        issues: "",
        withdrawn: false,
        counted: valid.has(w.key.toLowerCase()) && kept.has(r.key.toLowerCase()),
        entity_url: explorerEntityUrl(w.key),
        creator_url: explorerAddressUrl(w.creator),
      })
    }
  }
  return rows
}

const csvCell = (v: unknown) => {
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: readonly EvidenceRow[]): string {
  const cols = Object.keys(
    rows[0] ?? {
      kind: 0, entity_key: 0, report_key: 0, shop_id: 0, state: 0, month: 0, item: 0, entitled_g: 0, received_g: 0,
      shortfall_g: 0, shortfall_bp: 0, creator: 0, created_at_block: 0, expires_at_block: 0, read_at_block: 0,
      synthetic: 0, issues: 0, withdrawn: 0, counted: 0, entity_url: 0, creator_url: 0,
    },
  )
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","))].join("\n") + "\n"
}

export function toJson(rows: readonly EvidenceRow[], meta: Record<string, unknown>): string {
  return JSON.stringify({ ...meta, rows }, null, 2) + "\n"
}
