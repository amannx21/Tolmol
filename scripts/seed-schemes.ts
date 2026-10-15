// Demo for "one ledger, three schemes" (synthetic, testnet). Never prints keys. Idempotent: reruns skip what exists.
//  1. The registry publishes 8 synthetic outlets for the other schemes: 4 schools (school meals, PM POSHAN) and 4 gram
//     panchayats (MGNREGA wages), in real districts: `tolmol.outlet` entities with a `scheme` attribute.
//  2. The 10 synthetic seed devices report meal days and wages there for 3 months; others confirm at short outlets.
//  3. Adds TEST head teacher (SCH) and employment assistant (GPO) IDs to apps/web/public/test-cards.json ("operators").
//  4. A demo head teacher (SYN-BR-5001) and employment assistant (SYN-BR-7001), keys kept in .env, are verified and
//     answer reports; the reporters say "fixed" or "not fixed".
//  5. The demo official for Gaya records actions on both Gaya outlets.
// Usage: node --env-file=.env --import tsx scripts/seed-schemes.ts
import fs from "node:fs"
import { randomBytes } from "node:crypto"
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk"
import { parseEther } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  addMonths, attestDevice, cardMessage, cardTag, corroborate, currentMonth, dedupeReports, deviceAttestations, encodeCard, followUpReport,
  httpReader, LIFETIME_DAYS, listOutlets, recordOfficialAction, respondToReport, SCHEME_ISSUES, shopAttributes, shopFollowups,
  shopOfficialActions, shopReports, shopResponses, shopWitnesses, submitReport, writerFor,
  type OfficialAction, type ResponseAction, type Scheme, type TestCard,
} from "../packages/tolmol-sdk/src/index.js"

const envText = () => fs.readFileSync(".env", "utf8")
const need = (k: string) => {
  const m = envText().match(new RegExp(`^${k}=(0x[0-9a-fA-F]{64})`, "m"))
  if (!m) throw new Error(`${k} missing in .env`)
  return m[1] as `0x${string}`
}
const ensureKey = (k: string) => {
  if (!new RegExp(`^${k}=`, "m").test(envText())) fs.appendFileSync(".env", `${envText().endsWith("\n") ? "" : "\n"}${k}=${generatePrivateKey()}\n`)
  return privateKeyToAccount(need(k))
}
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a)
const reader = httpReader()
const funder = writerFor(privateKeyToAccount(need("REPORTER_PRIVATE_KEY")))
const fund = async (address: `0x${string}`, min = "0.006", amount = "0.02") => {
  if ((await reader.getBalance({ address })) >= parseEther(min)) return
  const tx = await funder.sendTransaction({ to: address, value: parseEther(amount) })
  await reader.waitForTransactionReceipt({ hash: tx })
  log("funded", address, amount, "GLM")
}

type Outlet = { shopId: string; state: string; district: string; scheme: Exclude<Scheme, "pds">; labelEn: string; labelHi: string; profile: "fair" | "short" | "bad" }
const school = (n: string, state: string, district: string, en: string, hi: string, profile: Outlet["profile"]): Outlet => ({
  shopId: `SYN-${state}-${n}`, state, district, scheme: "mdm", profile,
  labelEn: `Synthetic Govt. Primary School ${n}, ${en}`, labelHi: `कृत्रिम सरकारी प्राथमिक विद्यालय ${n}, ${hi}`,
})
const panchayat = (n: string, state: string, district: string, en: string, hi: string, profile: Outlet["profile"]): Outlet => ({
  shopId: `SYN-${state}-${n}`, state, district, scheme: "nrega", profile,
  labelEn: `Synthetic Gram Panchayat ${n}, ${en}`, labelHi: `कृत्रिम ग्राम पंचायत ${n}, ${hi}`,
})
const OUTLETS: Outlet[] = [
  school("5001", "BR", "gaya", "Gaya", "गया", "bad"),
  school("5002", "BR", "patna", "Patna", "पटना", "fair"),
  school("5001", "UP", "varanasi", "Varanasi", "वाराणसी", "short"),
  school("5001", "JH", "ranchi", "Ranchi", "रांची", "short"),
  panchayat("7001", "BR", "gaya", "Gaya", "गया", "bad"),
  panchayat("7002", "BR", "muzaffarpur", "Muzaffarpur", "मुज़फ़्फ़रपुर", "fair"),
  panchayat("7001", "UP", "bahraich", "Bahraich", "बहराइच", "short"),
  panchayat("7001", "JH", "dumka", "Dumka", "दुमका", "bad"),
]

// Deterministic PRNG, so the dataset is reproducible.
let seed = 7
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// ------------------------------------------------------------------ 1. outlets
const registry = writerFor(privateKeyToAccount(need("REGISTRY_PRIVATE_KEY")))
const existing = new Map((await listOutlets(reader, {})).items.map((s) => [s.shopId, s]))
const missing = OUTLETS.filter((o) => !existing.has(o.shopId))
if (missing.length) {
  const res = await registry.executeBatch({
    creates: missing.map((o) => ({
      payload: jsonToPayload({ label_en: o.labelEn, label_hi: o.labelHi, synthetic: true }),
      contentType: "application/json",
      attributes: shopAttributes(o),
      expires: ExpirationTime.fromDays(LIFETIME_DAYS.shop),
      flags: { readonly: true, permissionlessExtension: true },
    })),
  })
  log("published", missing.length, "synthetic schools and panchayats, tx", res.txHash)
}
const outlets = new Map((await listOutlets(reader, {})).items.map((s) => [s.shopId, s]))
for (const o of OUTLETS) if (outlets.get(o.shopId)?.scheme !== o.scheme) throw new Error(`${o.shopId} is not on the registry as ${o.scheme}`)

// ------------------------------------------------------------------ 2. reports and confirmations
const keys = (JSON.parse(fs.readFileSync(".seed-wallets.json", "utf8")) as { keys: `0x${string}`[] }).keys
const devices = keys.map((k) => privateKeyToAccount(k))
for (const d of devices) await fund(d.address, "0.006", "0.015")
const months = [addMonths(currentMonth(), -2), addMonths(currentMonth(), -1), currentMonth()]
const pickIssues = (scheme: Exclude<Scheme, "pds">, profile: Outlet["profile"]) => {
  if (profile === "fair") return 0
  const bits = Object.values(SCHEME_ISSUES[scheme])
  let mask = 0
  for (const b of bits) if (rand() < (profile === "bad" ? 0.3 : 0.12)) mask |= b
  return mask
}
for (const [oi, o] of OUTLETS.entries()) {
  const shop = outlets.get(o.shopId)!
  const already = new Set((await shopReports(reader, o.shopId)).items.map((r) => `${r.creator.toLowerCase()}|${r.month}`))
  const reporters = [0, 1, 2, 3].map((j) => devices[(oi * 3 + j) % devices.length]!)
  for (const d of reporters)
    for (const month of months) {
      if (already.has(`${d.address.toLowerCase()}|${month}`)) continue
      if (rand() < 0.2 && month !== currentMonth()) continue
      const loss = o.profile === "fair" ? rand() * 0.05 : o.profile === "short" ? 0.1 + rand() * 0.15 : 0.3 + rand() * 0.3
      let input
      if (o.scheme === "mdm") {
        const schoolDays = 20 + Math.floor(rand() * 5)
        input = { shopId: o.shopId, month, item: "meal_days" as const, entitledG: schoolDays, receivedG: Math.max(0, Math.round(schoolDays * (1 - loss))), issues: pickIssues("mdm", o.profile) }
      } else {
        const days = 8 + Math.floor(rand() * 13)
        const owed = days * 250 // synthetic daily wage for the demo, not a notified rate
        input = { shopId: o.shopId, month, item: "wage_inr" as const, entitledG: owed, receivedG: Math.max(0, Math.round((owed * (1 - loss)) / 50) * 50), issues: pickIssues("nrega", o.profile) }
      }
      const res = await submitReport(reader, writerFor(d), input, shop, { synthetic: true, skipDuplicateCheck: true })
      log("report", o.shopId, month, input.item, `${input.receivedG}/${input.entitledG}`, res.entityKey.slice(0, 12))
    }
  if (o.profile === "fair") continue
  // Confirmations: at short and bad outlets, a neighbour (another seed device) confirms this month's reports.
  const reps = dedupeReports((await shopReports(reader, o.shopId)).items).filter((r) => r.month === currentMonth() && r.shortfallG > 0)
  const wits = (await shopWitnesses(reader, o.shopId)).items
  for (const r of reps.slice(0, 3)) {
    const by = devices.find((d) => d.address.toLowerCase() !== r.creator.toLowerCase() && !wits.some((w) => w.reportKey === r.key.toLowerCase() && w.creator.toLowerCase() === d.address.toLowerCase()) && !reporters.includes(d))
    if (!by || wits.some((w) => w.reportKey === r.key.toLowerCase())) continue
    const c = await corroborate(reader, writerFor(by), r.key, { synthetic: true })
    log("confirmed", o.shopId, r.key.slice(0, 12), "witness", c.entityKey.slice(0, 12), "witnesses now", c.witnessesAfter)
  }
}

// ------------------------------------------------------------------ 3. test operator IDs (synthetic)
const issuer = privateKeyToAccount(need("TEST_ISSUER_PRIVATE_KEY"))
const idFor = async (shopId: string, type: "SCH" | "GPO"): Promise<TestCard> => {
  const c = { v: 1 as const, state: shopId.slice(4, 6), shopId, type, serial: randomBytes(16).toString("hex") }
  return { ...c, sig: await issuer.signMessage({ message: cardMessage(c) }) }
}
const file = "apps/web/public/test-cards.json"
const pub = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown> & { operators?: string[] }
if (!pub.operators) {
  pub.operators = []
  for (const [s, type] of [["SYN-BR-5001", "SCH"], ["SYN-UP-5001", "SCH"], ["SYN-BR-7001", "GPO"], ["SYN-JH-7001", "GPO"]] as const)
    for (let i = 0; i < 2; i++) pub.operators.push(encodeCard(await idFor(s, type)))
  pub.note = "SYNTHETIC test ration cards, dealer licences, school and panchayat IDs and official IDs for the Tolmol demo. Signed by the TEST issuer key, not by any government. Each can verify one phone."
  fs.writeFileSync(file, JSON.stringify(pub, null, 2) + "\n")
  log("added", pub.operators.length, "test school and panchayat IDs")
}

// ------------------------------------------------------------------ 4. demo operators answer, reporters follow up
const verifier = writerFor(privateKeyToAccount(need("VERIFIER_PRIVATE_KEY")))
const byAddr = new Map(keys.map((k) => [privateKeyToAccount(k).address.toLowerCase(), k]))
const demos: { env: string; shopId: string; type: "SCH" | "GPO"; plan: [ResponseAction, "fixed" | "not_fixed"][] }[] = [
  { env: "DEMO_SCHOOL_HEAD_PRIVATE_KEY", shopId: "SYN-BR-5001", type: "SCH", plan: [["meals_resumed", "fixed"], ["menu_followed", "not_fixed"]] },
  { env: "DEMO_PANCHAYAT_PRIVATE_KEY", shopId: "SYN-BR-7001", type: "GPO", plan: [["wages_paid", "fixed"], ["wages_paid", "not_fixed"]] },
]
for (const d of demos) {
  const acct = ensureKey(d.env)
  await fund(acct.address)
  if (!(await deviceAttestations(reader, acct.address)).items.some((a) => a.role === "dealer" && a.shopId === d.shopId)) {
    const id = await idFor(d.shopId, d.type)
    const res = await attestDevice(verifier, { device: acct.address, state: d.shopId.slice(4, 6), shopId: d.shopId, cardTag: await cardTag(need("CARD_TAG_SECRET"), id.serial), method: "test_card", role: "dealer", synthetic: true })
    log("verified operator of", d.shopId, res.entityKey.slice(0, 12))
  }
  const op = writerFor(acct)
  const reps = dedupeReports((await shopReports(reader, d.shopId)).items).filter((r) => r.shortfallG > 0 && byAddr.has(r.creator.toLowerCase()))
  const answered = new Set((await shopResponses(reader, d.shopId)).items.map((x) => x.reportKey))
  const followed = new Set((await shopFollowups(reader, d.shopId)).items.map((x) => x.reportKey))
  const picks = reps.filter((r) => r.month === currentMonth()).slice(0, d.plan.length)
  for (const [i, r] of picks.entries()) {
    const [action, status] = d.plan[i]!
    if (!answered.has(r.key.toLowerCase())) log("answer", d.shopId, action, (await respondToReport(reader, op, r, action)).entityKey.slice(0, 12))
    if (!followed.has(r.key.toLowerCase())) log("follow-up", d.shopId, status, (await followUpReport(reader, writerFor(privateKeyToAccount(byAddr.get(r.creator.toLowerCase())!)), r, status)).entityKey.slice(0, 12))
  }
}

// ------------------------------------------------------------------ 5. the Gaya official acts on both Gaya outlets
const official = writerFor(privateKeyToAccount(need("DEMO_OFFICIAL_PRIVATE_KEY")))
for (const [shopId, actions] of [["SYN-BR-5001", ["inspection_ordered"]], ["SYN-BR-7001", ["inspected_shortage_found", "dues_restored"]]] as [string, OfficialAction[]][]) {
  const done = new Set((await shopOfficialActions(reader, shopId)).items.map((a) => a.action))
  for (const action of actions) if (!done.has(action)) log("official", shopId, action, (await recordOfficialAction(reader, official, outlets.get(shopId)!, action)).entityKey.slice(0, 12))
}
log("done")
