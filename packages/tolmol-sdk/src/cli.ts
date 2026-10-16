#!/usr/bin/env node
// tolmol: read Tolmol evidence straight from Arkiv (Tiramisu), and file or confirm a report from your own computer.
// No Tolmol server is involved: reads need no key; writes are signed by a key on this computer and paid with free
// test gas from the public faucet, not our relayer. If our website or relayer is blocked, reporting still works.
//
//   tolmol shops [--state BR] [--district gaya]
//   tolmol outlets [--state BR]            (ration shops, schools and gram panchayats)
//   tolmol query --shop SYN-BR-0042 [--month 2026-10] [--at-block N] [--format table|csv|json]
//   tolmol dashboard --state BR [--from 2026-08] [--to 2026-10]
//   tolmol report <entityKey>
//   tolmol answers --shop SYN-BR-0042   (dealer answers and reporter follow-ups that count, and the ones ignored)
//   tolmol key                          (once: make a key for this computer; prints its address, never the key)
//   tolmol submit --shop SYN-BR-0042 --item rice --entitled 25000 --received 20000 [--month 2026-10] [--days 90] [--no-extend]
//   tolmol confirm <reportKey>          (confirm someone else's report: "I got short too")
//
// Options: --rpc <url> to use another Arkiv RPC endpoint.
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseArgs } from "node:util"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { httpReader, quotaError, writerFor } from "./clients.js"
import { explorerEntityUrl } from "./constants.js"
import { evidenceRows, toCsv, toJson } from "./evidence.js"
import { addMonths, currentMonth, isItem, monthToNum, validateReportInput } from "./model.js"
import { ALL_ITEMS, coarsenWages, formatAmount, ITEM_INFO } from "./schemes.js"
import { corroborate, DuplicateError, ReportNotFoundError, SelfWitnessError, submitReport } from "./writes.js"
import { dashboardReports, dashboardWitnesses, getReport, listOutlets, listShops, reportCorrections, reportWitnesses, shopCorrections, shopReports, shopWitnesses, stateCorrections } from "./queries.js"
import { latestFollowups, shopFollowups, shopResponses, validResponses } from "./answers.js"
import { listAttestations, listVerifiers, verifiedDealers } from "./verify.js"
import { dedupeReports, formatBp, patternSignals, rapidReportKeys, shopStats, validWitnesses, withdrawnKeys } from "./rules.js"

const FAUCET = "https://hub.arkiv.network/faucet"
const APP = "https://tolmol-web-kappa.vercel.app"
const DEFAULT_KEY_FILE = path.join(os.homedir(), ".tolmol", "key")
/** Enough test gas for a few writes (the app uses the same floor). */
const MIN_WRITE_WEI = 3_000_000_000_000_000n

const USAGE = `tolmol: read Tolmol evidence from Arkiv (Tiramisu testnet), and file or confirm a report without our website.

  tolmol shops [--state BR] [--district gaya]
  tolmol outlets [--state BR]
  tolmol query --shop SYN-BR-0042 [--month 2026-10] [--at-block N] [--format table|csv|json]
  tolmol dashboard --state BR [--from 2026-08] [--to 2026-10]
  tolmol report <entityKey>
  tolmol answers --shop SYN-BR-0042

Write (signed on this computer, free test gas from ${FAUCET}):
  tolmol key                     make a key for this computer once; prints its address, never the key
  tolmol submit --shop SYN-BR-0042 --item rice --entitled 25000 --received 20000
                [--month 2026-10] [--days 30|90|180] [--no-extend]
                items: rice, wheat, millet, total (grams); meal_days (days); wage_inr (rupees, rounded to 500)
  tolmol confirm <reportKey>     confirm someone else's report from this computer's key

  --rpc <url>        another Arkiv RPC endpoint (default: public Tiramisu RPC)
  --key-file <path>  where the key lives (default ${DEFAULT_KEY_FILE}); or set TOLMOL_PRIVATE_KEY
All data in the public demo is SYNTHETIC: never enter a real card, name or phone number.`

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
    item: { type: "string" },
    entitled: { type: "string" },
    received: { type: "string" },
    days: { type: "string" },
    "no-extend": { type: "boolean" },
    "key-file": { type: "string" },
    help: { type: "boolean", short: "h" },
  },
})

const out = (s: string) => process.stdout.write(s.endsWith("\n") ? s : s + "\n")
const short = (k: string) => `${k.slice(0, 8)}…${k.slice(-4)}`
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length))

/** This computer's key: TOLMOL_PRIVATE_KEY, or the key file. Never printed. */
function loadKey(file: string): `0x${string}` {
  const fromEnv = process.env.TOLMOL_PRIVATE_KEY
  const k = (fromEnv ?? (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "")).trim()
  if (!k) throw new Error(`no key yet: run "tolmol key" first (or set TOLMOL_PRIVATE_KEY)`)
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) throw new Error(`the key in ${fromEnv ? "TOLMOL_PRIVATE_KEY" : file} is not a 32-byte hex key`)
  return k as `0x${string}`
}

async function needGas(reader: ReturnType<typeof httpReader>, address: `0x${string}`) {
  if ((await reader.getBalance({ address })) < MIN_WRITE_WEI) {
    throw new Error(`this key has no test gas yet. Paste ${address} at ${FAUCET}, then run this again.`)
  }
}

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

  if (cmd === "outlets") {
    const r = await listOutlets(reader, { state: values.state }, { atBlock })
    for (const s of r.items.sort((a, b) => (a.shopId < b.shopId ? -1 : 1))) out(`${pad(s.shopId, 13)} ${pad(s.scheme, 6)} ${pad(s.state, 3)} ${pad(s.district, 14)} ${s.labelEn}`)
    return out(`# ${r.items.length} synthetic outlets (ration shops, schools, gram panchayats), read at block ${r.atBlock}`)
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
    const unit = reps.items[0]?.item ?? "rice"
    if (s) out(`shortfall ${formatBp(s.shortfallBp)} of ${formatAmount(unit, s.totalEntitledG)} · ${s.reports} reports (${s.reporters} devices) · ${s.corroborated} confirmed`)
    const p = patternSignals(reps.items, wits.items, withdrawn)
    for (const g of p.rapidReports) out(`pattern: ${g.count} reports from ${g.devices} devices within blocks ${g.fromBlock}-${g.toBlock} (1 minute)`)
    for (const r of reps.items) {
      const w = validWitnesses(r, wits.items).length
      const tag = withdrawn.has(r.key.toLowerCase()) ? "  [withdrawn by reporter]" : ""
      out(`  ${r.month} ${pad(r.item, 6)} ${pad(formatAmount(r.item, r.receivedG) + "/" + formatAmount(r.item, r.entitledG), 18)} short ${pad(formatBp(r.shortfallBp), 6)} witnesses ${w}  creator ${r.creator}  ${explorerEntityUrl(r.key)}${tag}`)
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

  if (cmd === "answers") {
    if (!values.shop) throw new Error("--shop is required")
    const shop = values.shop
    const head = atBlock ?? (await reader.getBlockNumber({ cacheTime: 0 }))
    const o = { atBlock: head }
    const [vs, as, reps, corr, rs, fs] = await Promise.all([
      listVerifiers(reader, o),
      listAttestations(reader, o),
      shopReports(reader, shop, undefined, o),
      shopCorrections(reader, shop, undefined, o),
      shopResponses(reader, shop, o),
      shopFollowups(reader, shop, o),
    ])
    const dealers = verifiedDealers(vs.items, as.items)
    const withdrawn = withdrawnKeys(reps.items, corr.items)
    const counted = dedupeReports(reps.items, withdrawn)
    const answers = validResponses(counted, rs.items, dealers)
    const follow = latestFollowups(counted, fs.items)
    const kept = new Set([...answers.values()].flat().map((x) => x.key.toLowerCase()))
    const creatorOf = new Map(counted.map((r) => [r.key.toLowerCase(), r.creator.toLowerCase()]))
    out(`${shop} at block ${head}: ${counted.length} counted reports, ${answers.size} answered by the verified dealer, ${[...follow.values()].filter((f) => f.status === "fixed").length} marked fixed by their reporter`)
    out(`verified dealers of ${shop}: ${[...dealers.values()].filter((d) => d.shopId === shop).map((d) => d.device).join(", ") || "none"}`)
    for (const r of counted) {
      const a = answers.get(r.key.toLowerCase()) ?? []
      const f = follow.get(r.key.toLowerCase())
      if (a.length || f) out(`  ${short(r.key)} ${r.month} ${pad(r.item, 6)} answer: ${a.map((x) => x.action).join(", ") || "-"}  reporter: ${f?.status ?? "-"}`)
    }
    const ignoredAnswers = rs.items.filter((x) => !kept.has(x.key.toLowerCase()) && dealers.get(x.creator.toLowerCase())?.shopId !== shop)
    const ignoredFollowups = fs.items.filter((f) => creatorOf.has(f.reportKey) && creatorOf.get(f.reportKey) !== f.creator.toLowerCase())
    out(`ignored (not signed by this shop's verified dealer / by the report's creator): ${ignoredAnswers.length + ignoredFollowups.length}`)
    for (const x of ignoredAnswers) out(`  answer   ${pad(x.action, 18)} on ${short(x.reportKey)} by ${x.creator}  ${explorerEntityUrl(x.key)}`)
    for (const f of ignoredFollowups) out(`  followup ${pad(f.status, 18)} on ${short(f.reportKey)} by ${f.creator}  ${explorerEntityUrl(f.key)}`)
    return
  }

  if (cmd === "key") {
    const file = values["key-file"] ?? DEFAULT_KEY_FILE
    if (!process.env.TOLMOL_PRIVATE_KEY && !fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      // Made once and never overwritten ("wx"); readable by this user only where the OS supports file modes.
      fs.writeFileSync(file, generatePrivateKey() + "\n", { mode: 0o600, flag: "wx" })
      out(`made a new key in ${file} (keep it private; it is never printed)`)
    }
    const address = privateKeyToAccount(loadKey(file)).address
    out(`address ${address}`)
    out((await reader.getBalance({ address })) >= MIN_WRITE_WEI ? "test gas: enough to write" : `test gas: none yet. Paste the address at ${FAUCET}`)
    return
  }

  if (cmd === "submit") {
    const { shop: shopId, item } = values
    if (!shopId || !item) throw new Error("--shop and --item are required")
    if (!isItem(item)) throw new Error(`--item must be one of ${ALL_ITEMS.join(", ")}`)
    const num = (v: string | undefined, name: string) => {
      if (!v || !/^\d+$/.test(v)) throw new Error(`--${name} must be a whole number (${ITEM_INFO[item].unit})`)
      return Number(v)
    }
    let entitled = num(values.entitled, "entitled")
    let received = num(values.received, "received")
    // Exact wages could single a worker out: rounded to 500 rupees, as in the app.
    if (item === "wage_inr") ({ owed: entitled, paid: received } = coarsenWages(entitled, received))
    const days = values.days ? Number(values.days) : 90
    if (![30, 90, 180].includes(days)) throw new Error("--days must be 30, 90 or 180")
    // Cheapest checks first: a typo, a missing key or no gas costs no query.
    const input = validateReportInput({ shopId, month: values.month ?? currentMonth(), item, entitledG: entitled, receivedG: received })
    const writer = writerFor(privateKeyToAccount(loadKey(values["key-file"] ?? DEFAULT_KEY_FILE)), values.rpc)
    await needGas(reader, writer.account.address)
    const shop = (await listOutlets(reader, {})).items.find((s) => s.shopId === shopId)
    if (!shop) throw new Error(`${shopId} is not an outlet in the trusted registry (see "tolmol outlets")`)
    if (ITEM_INFO[item].scheme !== shop.scheme) throw new Error(`${shopId} is a ${shop.scheme} outlet; ${item} belongs to ${ITEM_INFO[item].scheme}`)
    try {
      const res = await submitReport(reader, writer, input, shop, { synthetic: true, lifetimeDays: days, allowExtension: !values["no-extend"] })
      out("sealed: nobody can edit or delete it, including us")
      out(`report   ${res.entityKey}`)
      out(`tx       ${res.txHash}`)
      out(`explorer ${explorerEntityUrl(res.entityKey)}`)
      out(`app      ${APP}/#/r/${res.entityKey}`)
    } catch (e) {
      if (e instanceof DuplicateError) throw new Error(`this key already reported ${shopId}, ${input.month}, ${item}: ${e.existingKey}`)
      throw e
    }
    return
  }

  if (cmd === "confirm") {
    const key = positionals[1] as `0x${string}` | undefined
    if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("usage: tolmol confirm <reportKey>")
    const writer = writerFor(privateKeyToAccount(loadKey(values["key-file"] ?? DEFAULT_KEY_FILE)), values.rpc)
    await needGas(reader, writer.account.address)
    try {
      const res = await corroborate(reader, writer, key, { synthetic: true })
      out(`confirmed: ${res.witnessesAfter} confirmation(s) now${res.extendedTo ? `; the report now lives until block ${res.extendedTo}` : ""}`)
      out(`witness  ${res.entityKey}`)
      out(`explorer ${explorerEntityUrl(res.entityKey)}`)
    } catch (e) {
      if (e instanceof SelfWitnessError) throw new Error("this key wrote the report; a confirmation must come from someone else")
      if (e instanceof DuplicateError) throw new Error(`this key already confirmed it: ${e.existingKey}`)
      if (e instanceof ReportNotFoundError) throw new Error("not found, expired, or not a valid Tolmol report")
      throw e
    }
    return
  }

  throw new Error(`unknown command ${cmd}\n\n${USAGE}`)
}

main().catch((e) => {
  const q = quotaError(e)
  if (q) {
    const wait = q.retryAfterSeconds ? ` in about ${Math.ceil(q.retryAfterSeconds / 60)} minutes` : " later"
    process.stderr.write(`tolmol: Arkiv's free read limit for this computer is used up for now; try again${wait}, or use --rpc <url>\n`)
    process.exitCode = 1
    return
  }
  process.stderr.write(`tolmol: ${(e as Error).message}\n`)
  process.exitCode = 1
})
