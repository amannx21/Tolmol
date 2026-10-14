#!/usr/bin/env node
// tolmol: read Tolmol evidence straight from Arkiv (Tiramisu). Read-only, no keys, no Tolmol server involved.
//
//   tolmol shops [--state BR] [--district gaya]
//   tolmol query --shop SYN-BR-0042 [--month 2026-10] [--at-block N] [--format table|csv|json]
//   tolmol dashboard --state BR [--from 2026-08] [--to 2026-10]
//   tolmol report <entityKey>
//
// Options: --rpc <url> to use another Arkiv RPC endpoint.
import { parseArgs } from "node:util"
import { httpReader } from "./clients.js"
import { explorerEntityUrl } from "./constants.js"
import { evidenceRows, toCsv, toJson } from "./evidence.js"
import { addMonths, currentMonth, monthToNum } from "./model.js"
import { dashboardReports, dashboardWitnesses, getReport, listShops, reportCorrections, reportWitnesses, shopCorrections, shopReports, shopWitnesses, stateCorrections } from "./queries.js"
import { formatBp, formatKg, patternSignals, rapidReportKeys, shopStats, validWitnesses, withdrawnKeys } from "./rules.js"

const USAGE = `tolmol: read Tolmol ration-shortfall evidence from Arkiv (Tiramisu testnet). Read-only.

  tolmol shops [--state BR] [--district gaya]
  tolmol query --shop SYN-BR-0042 [--month 2026-10] [--at-block N] [--format table|csv|json]
  tolmol dashboard --state BR [--from 2026-08] [--to 2026-10]
  tolmol report <entityKey>

  --rpc <url>   another Arkiv RPC endpoint (default: public Tiramisu RPC)
All data in the public demo is SYNTHETIC.`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    state: { type: "string" },
    district: { type: "string" },
    shop: { type: "string" },
    month: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    "at-block": { type: "string" },
    format: { type: "string", default: "table" },
    rpc: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
})

const out = (s: string) => process.stdout.write(s.endsWith("\n") ? s : s + "\n")
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length))

async function main() {
  const cmd = positionals[0]
  if (values.help || !cmd) return out(USAGE)
  const reader = httpReader(values.rpc)
  const atBlock = values["at-block"] ? BigInt(values["at-block"]) : undefined

  if (cmd === "shops") {
    const r = await listShops(reader, { state: values.state, district: values.district }, { atBlock })
    for (const s of r.items.sort((a, b) => (a.shopId < b.shopId ? -1 : 1))) out(`${pad(s.shopId, 13)} ${pad(s.state, 3)} ${pad(s.district, 14)} ${s.labelEn}`)
    return out(`# ${r.items.length} synthetic shops from the registry, read at block ${r.atBlock}`)
  }

  if (cmd === "query") {
    if (!values.shop) throw new Error("--shop is required")
    const head = atBlock ?? (await reader.getBlockNumber({ cacheTime: 0 }))
    const [reps, wits, corr] = await Promise.all([
      shopReports(reader, values.shop, values.month, { atBlock: head }),
      shopWitnesses(reader, values.shop, values.month, { atBlock: head }),
      shopCorrections(reader, values.shop, values.month, { atBlock: head }),
    ])
    const withdrawn = withdrawnKeys(reps.items, corr.items)
    const rows = evidenceRows(reps.items, wits.items, head, withdrawn)
    if (values.format === "csv") return out(toCsv(rows))
    if (values.format === "json") return out(toJson(rows, { network: "Arkiv Tiramisu 7738577", shop_id: values.shop, month: values.month ?? "all", read_at_block: head.toString(), note: "SYNTHETIC demo data" }))
    const s = shopStats(reps.items, wits.items, withdrawn)[0]
    out(`${values.shop} ${values.month ?? "(all months)"} at block ${head}`)
    if (s) out(`shortfall ${formatBp(s.shortfallBp)} of ${formatKg(s.totalEntitledG)} · ${s.reports} reports (${s.reporters} devices) · ${s.corroborated} confirmed`)
    const p = patternSignals(reps.items, wits.items, withdrawn)
    for (const g of p.rapidReports) out(`pattern: ${g.count} reports from ${g.devices} devices within blocks ${g.fromBlock}-${g.toBlock} (1 minute)`)
    for (const r of reps.items) {
      const w = validWitnesses(r, wits.items).length
      const tag = withdrawn.has(r.key.toLowerCase()) ? "  [withdrawn by reporter]" : ""
      out(`  ${r.month} ${pad(r.item, 6)} ${pad(formatKg(r.receivedG) + "/" + formatKg(r.entitledG), 18)} short ${pad(formatBp(r.shortfallBp), 6)} witnesses ${w}  creator ${r.creator}  ${explorerEntityUrl(r.key)}${tag}`)
    }
    return
  }

  if (cmd === "dashboard") {
    if (!values.state) throw new Error("--state is required (BR, UP or JH in the demo)")
    const to = values.to ?? currentMonth()
    const from = values.from ?? addMonths(to, -2)
    const months: string[] = []
    for (let m = from; monthToNum(m) <= monthToNum(to); m = addMonths(m, 1)) months.push(m)
    const head = atBlock ?? (await reader.getBlockNumber({ cacheTime: 0 }))
    const [reps, wits, corr] = await Promise.all([
      dashboardReports(reader, { state: values.state, fromMonth: from, toMonth: to }, { atBlock: head }),
      dashboardWitnesses(reader, { state: values.state, months }, { atBlock: head }),
      stateCorrections(reader, values.state, { atBlock: head }),
    ])
    const withdrawn = withdrawnKeys(reps.items, corr.items)
    const rapid = rapidReportKeys(reps.items, withdrawn)
    out(`${values.state} ${from}..${to} at block ${head}: worst shortfall first`)
    shopStats(reps.items, wits.items, withdrawn).forEach((s, i) => {
      const bursts = reps.items.filter((r) => r.shopId === s.shopId && rapid.has(r.key.toLowerCase())).length
      out(`${pad(String(i + 1), 3)} ${pad(s.shopId, 13)} ${pad(formatBp(s.shortfallBp), 7)} ${pad(s.district, 13)} reports ${pad(String(s.reports), 3)} confirmed ${pad(String(s.corroborated), 3)}${bursts ? ` in bursts ${bursts}` : ""}`)
    })
    return
  }

  if (cmd === "report") {
    const key = positionals[1] as `0x${string}` | undefined
    if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("usage: tolmol report <entityKey>")
    const r = await getReport(reader, key)
    if (!r) throw new Error("not found, expired, or not a valid Tolmol report")
    const [ws, corr] = await Promise.all([reportWitnesses(reader, key), reportCorrections(reader, key)])
    return out(
      JSON.stringify(
        {
          ...r,
          withdrawnByReporter: withdrawnKeys([r], corr.items).size > 0,
          witnesses: validWitnesses(r, ws.items).map((w) => ({ key: w.key, creator: w.creator, createdAt: w.createdAt })),
          explorer: explorerEntityUrl(r.key),
        },
        (_, v) => (typeof v === "bigint" ? v.toString() : v),
        2,
      ),
    )
  }

  throw new Error(`unknown command ${cmd}\n\n${USAGE}`)
}

main().catch((e) => {
  process.stderr.write(`tolmol: ${(e as Error).message}\n`)
  process.exit(1)
})
