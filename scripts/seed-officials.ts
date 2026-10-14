// Demo for "officials act on the record" (synthetic, testnet). Never prints keys. Idempotent.
//  1. Adds 6 TEST official IDs (type GOV, 2 per demo district) to apps/web/public/test-cards.json, if missing.
//  2. Creates a demo official for Gaya (district of SYN-BR-0042), key kept in .env as DEMO_OFFICIAL_PRIVATE_KEY, funds
//     it from the reporter wallet, and has the verifier attest it (role official) with a private test ID.
//  3. The official records: inspection ordered, inspected (shortage found), show-cause notice on SYN-BR-0042.
// Usage: node --env-file=.env --import tsx scripts/seed-officials.ts
import fs from "node:fs"
import { randomBytes } from "node:crypto"
import { parseEther } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  attestDevice, cardMessage, cardTag, deviceAttestations, encodeCard, httpReader, listShops, recordOfficialAction, shopOfficialActions, writerFor,
  type OfficialAction, type TestCard,
} from "../packages/tolmol-sdk/src/index.js"

const envText = () => fs.readFileSync(".env", "utf8")
const need = (k: string) => {
  const m = envText().match(new RegExp(`^${k}=(0x[0-9a-fA-F]{64})`, "m"))
  if (!m) throw new Error(`${k} missing in .env`)
  return m[1] as `0x${string}`
}
const issuer = privateKeyToAccount(need("TEST_ISSUER_PRIVATE_KEY"))
const reader = httpReader()
const SHOP = "SYN-BR-0042"
const card = async (shopId: string): Promise<TestCard> => {
  const c = { v: 1 as const, state: shopId.slice(4, 6), shopId, type: "GOV" as const, serial: randomBytes(16).toString("hex") }
  return { ...c, sig: await issuer.signMessage({ message: cardMessage(c) }) }
}

const file = "apps/web/public/test-cards.json"
const pub = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown> & { officials?: string[] }
if (!pub.officials) {
  pub.officials = []
  for (const s of ["SYN-BR-0042", "SYN-UP-0007", "SYN-JH-0003"]) for (let i = 0; i < 2; i++) pub.officials.push(encodeCard(await card(s)))
  pub.note = "SYNTHETIC test ration cards, dealer licences and official IDs for the Tolmol demo. Signed by the TEST issuer key, not by any government. Each can verify one phone."
  fs.writeFileSync(file, JSON.stringify(pub, null, 2) + "\n")
  console.log("added", pub.officials.length, "test official IDs")
}

if (!/^DEMO_OFFICIAL_PRIVATE_KEY=/m.test(envText())) fs.appendFileSync(".env", `${envText().endsWith("\n") ? "" : "\n"}DEMO_OFFICIAL_PRIVATE_KEY=${generatePrivateKey()}\n`)
const acct = privateKeyToAccount(need("DEMO_OFFICIAL_PRIVATE_KEY"))
const official = writerFor(acct)
console.log("demo official", acct.address)
if ((await reader.getBalance({ address: acct.address })) < parseEther("0.005")) {
  const tx = await writerFor(privateKeyToAccount(need("REPORTER_PRIVATE_KEY"))).sendTransaction({ to: acct.address, value: parseEther("0.02") })
  await reader.waitForTransactionReceipt({ hash: tx })
  console.log("funded official, tx", tx)
}
if (!(await deviceAttestations(reader, acct.address)).items.some((a) => a.role === "official")) {
  const id = await card(SHOP)
  const res = await attestDevice(writerFor(privateKeyToAccount(need("VERIFIER_PRIVATE_KEY"))), { device: acct.address, state: "BR", shopId: SHOP, cardTag: await cardTag(need("CARD_TAG_SECRET"), id.serial), method: "test_card", role: "official", synthetic: true })
  console.log("official attested", res.entityKey)
}
const shop = (await listShops(reader, { state: "BR" })).items.find((s) => s.shopId === SHOP)!
const done = new Set((await shopOfficialActions(reader, SHOP)).items.map((a) => a.action))
for (const action of ["inspection_ordered", "inspected_shortage_found", "show_cause_notice"] as OfficialAction[]) {
  if (done.has(action)) continue
  console.log("action", action, (await recordOfficialAction(reader, official, shop, action)).entityKey)
}
