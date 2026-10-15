// Privacy audit: reads EVERY entity tagged project = "tolmol" on Tiramisu and checks it against the data contract.
// Fails if any entity of a Tolmol type carries an unknown attribute, a value outside its allowed format, or a payload
// (reports, witnesses and corrections must have an empty payload; shops a small JSON with display labels only).
// Read-only. Usage: node --import tsx scripts/privacy-audit.ts
import { str } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import { httpReader, PROJECT } from "../packages/tolmol-sdk/src/index.js"

const SHOP = /^SYN-[A-Z]{2}-\d{4}$/
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const STATE = /^[A-Z]{2}$/
const DISTRICT = /^[a-z][a-z0-9-]{1,40}$/
const HEX32 = /^0x[0-9a-f]{64}$/
type Rule = (v: unknown) => boolean
const isInt = (lo: number, hi: number): Rule => (v) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi
const re = (r: RegExp): Rule => (v) => typeof v === "string" && r.test(v)
const oneOf = (...xs: unknown[]): Rule => (v) => xs.includes(v)
const any: Rule = () => true

const COMMON = { project: oneOf("tolmol"), schema_version: oneOf(1), synthetic: oneOf(true, false), reported_at: any }
// Items of every scheme on the ledger: ration (grams), school meals (days), MGNREGA wages (rupees).
const ITEM = oneOf("rice", "wheat", "millet", "total", "meal_days", "wage_inr")
const CONTRACT: Record<string, Record<string, Rule>> = {
  "tolmol.shop": { project: oneOf("tolmol"), schema_version: oneOf(1), type: oneOf("tolmol.shop"), shop_id: re(SHOP), state: re(STATE), district: re(DISTRICT), synthetic: oneOf(true) },
  // Outlets of the other schemes (schools, gram panchayats): a shop's attributes plus `scheme`.
  "tolmol.outlet": { project: oneOf("tolmol"), schema_version: oneOf(1), type: oneOf("tolmol.outlet"), shop_id: re(SHOP), state: re(STATE), district: re(DISTRICT), synthetic: oneOf(true), scheme: oneOf("mdm", "nrega") },
  "tolmol.report": {
    ...COMMON, type: oneOf("tolmol.report"), shop_id: re(SHOP), state: re(STATE), district: re(DISTRICT), month: re(MONTH), month_num: isInt(200001, 299912),
    item: ITEM, entitled_g: isInt(1, 100_000), received_g: isInt(0, 100_000), shortfall_g: isInt(0, 100_000),
    shortfall_bp: isInt(0, 10_000), issues: isInt(0, 127), issues2: isInt(1, 1023), scheme: oneOf("mdm", "nrega"),
  },
  "tolmol.witness": { ...COMMON, type: oneOf("tolmol.witness"), report_key: re(HEX32), shop_id: re(SHOP), state: re(STATE), month: re(MONTH), item: ITEM },
  "tolmol.correction": { ...COMMON, type: oneOf("tolmol.correction"), report_key: re(HEX32), shop_id: re(SHOP), state: re(STATE), month: re(MONTH), action: oneOf("withdraw") },
  // Verification (simple version): the registry names verifiers; a verifier attests a device. No card data, only a
  // keyed fingerprint (card_tag) that cannot be turned back into the card.
  "tolmol.verifier": { project: oneOf("tolmol"), schema_version: oneOf(1), type: oneOf("tolmol.verifier"), verifier: re(/^0x[0-9a-f]{40}$/), synthetic: oneOf(true) },
  "tolmol.attestation": {
    project: oneOf("tolmol"), schema_version: oneOf(1), type: oneOf("tolmol.attestation"), device: re(/^0x[0-9a-f]{40}$/), state: re(STATE), shop_id: re(SHOP),
    card_tag: re(HEX32), method: oneOf("test_card", "camp"), role: oneOf("card_holder", "dealer", "official"), verified_on: any, synthetic: oneOf(true, false),
  },
  // Shops answer (fixed choices only) and reporters confirm; no free text on either side.
  "tolmol.response": { ...COMMON, type: oneOf("tolmol.response"), report_key: re(HEX32), shop_id: re(SHOP), state: re(STATE), month: re(MONTH),
    action: oneOf("full_quantity", "stock_arrived", "scale_checked", "open_as_displayed", "board_updated", "receipt_given", "money_returned", "auth_help", "quality_replaced", "portability_served", "no_tied_sale", "card_returned", "respectful_service", "disputed",
      "meals_resumed", "menu_followed", "kitchen_cleaned", "equal_seating", "no_child_labour", "wages_paid", "job_card_returned", "work_allotted", "site_facilities") },
  // Official actions on a shop, from a fixed list (TPDS Control Order 2015 cl. 10(7), 11(1), 13).
  "tolmol.action": { ...COMMON, type: oneOf("tolmol.action"), shop_id: re(SHOP), state: re(STATE), district: re(DISTRICT),
    action: oneOf("inspection_ordered", "inspected_shortage_found", "inspected_no_issue", "show_cause_notice", "licence_suspended", "licence_cancelled", "case_registered", "grain_restored", "dues_restored") },
  // The dealer's monthly stock board: grain received and distribution days, numbers only.
  "tolmol.stock": { ...COMMON, type: oneOf("tolmol.stock"), shop_id: re(SHOP), state: re(STATE), district: re(DISTRICT), month: re(MONTH), month_num: isInt(200001, 299912),
    rice_g: isInt(0, 100_000_000), wheat_g: isInt(0, 100_000_000), millet_g: isInt(0, 100_000_000), cards: isInt(1, 5000), from_day: isInt(1, 31), to_day: isInt(1, 31) },
  // A district official sends an inspector to one outlet for a few days; numbers and addresses only.
  "tolmol.delegation": { ...COMMON, type: oneOf("tolmol.delegation"), inspector: re(/^0x[0-9a-f]{40}$/), shop_id: re(SHOP), state: re(STATE), district: re(DISTRICT), until_block: any },
  "tolmol.followup": { ...COMMON, type: oneOf("tolmol.followup"), report_key: re(HEX32), shop_id: re(SHOP), state: re(STATE), month: re(MONTH), status: oneOf("fixed", "not_fixed") },
}

const r = httpReader()
const head = await r.getBlockNumber()
let page = await r
  .select({ key: true, creator: true, payload: true, contentType: true, attributes: true })
  .where(eq("project", str(PROJECT)))
  .limit(200)
  .atBlock(head)
  .fetch()
const all = [...page.entities]
while (page.hasNextPage()) {
  page = await page.next()
  all.push(...page.entities)
}

const counts: Record<string, number> = {}
const problems: string[] = []
for (const e of all) {
  const attrs = e.attributes as Record<string, { type: string; value: unknown } | undefined>
  const type = String(attrs.type?.value)
  counts[type] = (counts[type] ?? 0) + 1
  const rules = CONTRACT[type]
  if (!rules) continue // tolmol.test entities from the friction experiments: synthetic, reported separately
  for (const [name, a] of Object.entries(attrs)) {
    const rule = rules[name]
    if (!rule) problems.push(`${e.key} (${type}): unknown attribute "${name}"`)
    else if (!rule(a?.value)) problems.push(`${e.key} (${type}): attribute "${name}" has a value outside the contract`)
  }
  const payload = e.payload as Uint8Array
  if (type === "tolmol.shop" || type === "tolmol.outlet") {
    try {
      const j = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>
      const keys = Object.keys(j).sort().join(",")
      if (keys !== "label_en,label_hi,synthetic" || j.synthetic !== true) problems.push(`${e.key} (shop): unexpected payload keys ${keys}`)
    } catch {
      problems.push(`${e.key} (shop): payload is not the expected JSON`)
    }
  } else if (payload.length !== 0) problems.push(`${e.key} (${type}): payload is not empty (${payload.length} bytes)`)
}

console.log(`Privacy audit of every project="tolmol" entity on Tiramisu at block ${head}`)
for (const [t, n] of Object.entries(counts).sort()) console.log(`  ${t.padEnd(18)} ${n}${CONTRACT[t] ? "" : "  (test entities from friction experiments, synthetic; not part of the app)"}`)
if (problems.length) {
  console.log(`FAIL: ${problems.length} problem(s)`)
  for (const p of problems.slice(0, 50)) console.log("  " + p)
  process.exit(1)
}
console.log("PASS: every Tolmol entity matches the data contract: no unknown attributes, no free text, no personal data, empty payloads.")
