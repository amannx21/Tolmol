// Demo for "shops answer, reporters confirm" (synthetic, testnet). Never prints keys. Idempotent where it matters.
//  1. Adds 8 TEST dealer licences (type FPS, 2 per demo shop) to apps/web/public/test-cards.json, if missing.
//  2. Creates a demo dealer wallet for SYN-BR-0042 (key kept in .env as DEMO_DEALER_PRIVATE_KEY), funds it from the
//     reporter wallet, and has the verifier attest it as that shop's dealer with a private test licence.
//  3. The dealer answers 4 reports; their seed reporters confirm "fixed" (3) or "not fixed" (1).
// Usage: node --env-file=.env --import tsx scripts/seed-answers.ts
import fs from "node:fs"
import { randomBytes } from "node:crypto"
import { parseEther } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  attestDevice, cardMessage, cardTag, dedupeReports, deviceAttestations, encodeCard, followUpReport, httpReader, respondToReport,
  shopFollowups, shopReports, shopResponses, writerFor, type ResponseAction, type TestCard,
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
const card = async (shopId: string, type: TestCard["type"]): Promise<TestCard> => {
  const c = { v: 1 as const, state: shopId.slice(4, 6), shopId, type, serial: randomBytes(16).toString("hex") }
  return { ...c, sig: await issuer.signMessage({ message: cardMessage(c) }) }
}

// 1. public test dealer licences
const file = "apps/web/public/test-cards.json"
const pub = JSON.parse(fs.readFileSync(file, "utf8")) as { note: string; issuer: string; cards: string[]; dealers?: string[] }
if (!pub.dealers) {
  pub.dealers = []
  for (const s of ["SYN-BR-0042", "SYN-BR-0002", "SYN-UP-0007", "SYN-JH-0003"]) for (let i = 0; i < 2; i++) pub.dealers.push(encodeCard(await card(s, "FPS")))
  pub.note = "SYNTHETIC test ration cards and dealer licences for the Tolmol demo. Signed by the TEST issuer key, not by any government. Each card or licence can verify one phone."
  fs.writeFileSync(file, JSON.stringify(pub, null, 2) + "\n")
  console.log("added", pub.dealers.length, "test dealer licences")
}

// 2. demo dealer for SYN-BR-0042
if (!/^DEMO_DEALER_PRIVATE_KEY=/m.test(envText())) fs.appendFileSync(".env", `${envText().endsWith("\n") ? "" : "\n"}DEMO_DEALER_PRIVATE_KEY=${generatePrivateKey()}\n`)
const dealerAcct = privateKeyToAccount(need("DEMO_DEALER_PRIVATE_KEY"))
const dealer = writerFor(dealerAcct)
console.log("demo dealer", dealerAcct.address)
if ((await reader.getBalance({ address: dealerAcct.address })) < parseEther("0.005")) {
  const tx = await writerFor(privateKeyToAccount(need("REPORTER_PRIVATE_KEY"))).sendTransaction({ to: dealerAcct.address, value: parseEther("0.02") })
  await reader.waitForTransactionReceipt({ hash: tx })
  console.log("funded dealer, tx", tx)
}
const verifier = writerFor(privateKeyToAccount(need("VERIFIER_PRIVATE_KEY")))
if (!(await deviceAttestations(reader, dealerAcct.address)).items.some((a) => a.role === "dealer" && a.shopId === SHOP)) {
  const lic = await card(SHOP, "FPS")
  const res = await attestDevice(verifier, { device: dealerAcct.address, state: "BR", shopId: SHOP, cardTag: await cardTag(need("CARD_TAG_SECRET"), lic.serial), method: "test_card", role: "dealer", synthetic: true })
  console.log("dealer attested", res.entityKey)
}

// 3. answers and follow-ups
const seedKeys = (JSON.parse(fs.readFileSync(".seed-wallets.json", "utf8")) as { keys: `0x${string}`[] }).keys
const byAddr = new Map(seedKeys.map((k) => [privateKeyToAccount(k).address.toLowerCase(), k]))
const reports = dedupeReports((await shopReports(reader, SHOP)).items).filter((r) => r.shortfallG > 0 && byAddr.has(r.creator.toLowerCase()))
const answered = new Set((await shopResponses(reader, SHOP)).items.map((x) => x.reportKey))
const followed = new Set((await shopFollowups(reader, SHOP)).items.map((x) => x.reportKey))
const plan: [ResponseAction, "fixed" | "not_fixed"][] = [["full_quantity", "fixed"], ["scale_checked", "fixed"], ["receipt_given", "fixed"], ["stock_arrived", "not_fixed"]]
const picks = reports.filter((r) => r.month === reports[reports.length - 1]!.month).slice(0, plan.length)
for (const [i, r] of picks.entries()) {
  const [action, status] = plan[i]!
  if (!answered.has(r.key.toLowerCase())) console.log("answer", r.key.slice(0, 12), action, (await respondToReport(reader, dealer, r, action)).entityKey)
  if (!followed.has(r.key.toLowerCase())) console.log("follow-up", r.key.slice(0, 12), status, (await followUpReport(reader, writerFor(privateKeyToAccount(byAddr.get(r.creator.toLowerCase())!)), r, status)).entityKey)
}
