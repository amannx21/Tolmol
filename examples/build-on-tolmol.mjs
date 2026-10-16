// Build on Tolmol's open data in about 25 lines: no Tolmol server, no API key, no permission. Everything below is read
// straight from Arkiv and judged with the same public rules the app uses (tolmol-sdk, MIT).
// It prints, for one state: every outlet's verdict (red / amber / green / grey), and every official's and inspector's
// track record, with findings that later reports contradict.
// Usage: npm ci && npm run build -w tolmol-sdk && node examples/build-on-tolmol.mjs [BR|UP|JH]
import {
  addMonths, currentMonth, dashboardReports, formatBp, httpReader, listAttestations, listOutlets, listVerifiers, shopStats,
  shopVerdict, stateDelegations, stateOfficialActions, trackRecords, validOfficialActions, verifiedOfficials,
} from "tolmol-sdk"

const state = process.argv[2] ?? "BR"
const arkiv = httpReader() // the public Tiramisu RPC; any Arkiv endpoint works
const outlets = (await listOutlets(arkiv)).items.filter((o) => o.state === state) // trusted only from the registry ($creator)
const to = currentMonth()
const reports = (await dashboardReports(arkiv, { state, fromMonth: addMonths(to, -2), toMonth: to })).items

console.log(`Outlets in ${state}, last three months (verdict, shortfall, reports):`)
const stats = new Map(shopStats(reports, []).map((s) => [s.shopId, s]))
for (const o of outlets) {
  const s = stats.get(o.shopId)
  console.log(`  ${o.shopId}  ${o.scheme.padEnd(5)}  ${shopVerdict(s).padEnd(5)}  ${s ? formatBp(s.shortfallBp).padStart(6) : "     -"}  ${s?.reports ?? 0}`)
}

console.log(`\nWho checks the checkers in ${state}:`)
const officials = verifiedOfficials((await listVerifiers(arkiv)).items, (await listAttestations(arkiv)).items)
const districts = new Map((await listOutlets(arkiv)).items.map((o) => [o.shopId, o.district]))
const [acts, dels] = await Promise.all([stateOfficialActions(arkiv, state), stateDelegations(arkiv, state)])
const counted = validOfficialActions(acts.items, officials, districts, dels.items)
for (const r of trackRecords(counted, reports)) {
  console.log(`  ${r.signer}: ${r.findings.length} findings, ${r.clearing} cleared an outlet, ${r.contradicted} contradicted by later reports`)
}
