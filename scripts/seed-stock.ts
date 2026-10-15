// Demo for the stock board and the Fair shop badge (synthetic, testnet). Never prints keys. Idempotent.
//  1. The demo dealer of SYN-BR-0042 (a "bad" synthetic shop) posts stock boards for the last 3 months, and posts this
//     month's board twice (a lower second figure), so the shop page shows the version history and a large gap.
//  2. The fairest ration shop in Bihar with enough reports gets a demo dealer (key kept in .env as
//     DEMO_FAIR_DEALER_PRIVATE_KEY): it answers every shortfall report, its reporters say "fixed", and it posts this
//     month's board, so it earns the Fair shop badge from public evidence alone.
// Usage: node --env-file=.env --import tsx scripts/seed-stock.ts
import fs from "node:fs"
import { randomBytes } from "node:crypto"
import { parseEther } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  addMonths, attestDevice, cardMessage, cardTag, currentMonth, dashboardReports, dedupeReports, deviceAttestations, followUpReport, httpReader,
  listShops, postStockBoard, respondToReport, shopFollowups, shopResponses, shopStats, shopStocks, writerFor, type TestCard,
} from "../packages/tolmol-sdk/src/index.js"

const envText = () => fs.readFileSync(".env", "utf8")
const need = (k: string) => {
  const m = envText().match(new RegExp(`^${k}=(0x[0-9a-fA-F]{64})`, "m"))
  if (!m) throw new Error(`${k} missing in .env`)
  return m[1] as `0x${string}`
}
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a)
const reader = httpReader()
const funder = writerFor(privateKeyToAccount(need("REPORTER_PRIVATE_KEY")))
const fund = async (address: `0x${string}`) => {
  if ((await reader.getBalance({ address })) >= parseEther("0.006")) return
  await reader.waitForTransactionReceipt({ hash: await funder.sendTransaction({ to: address, value: parseEther("0.02") }) })
  log("funded", address)
}
const shops = new Map((await listShops(reader, { state: "BR" })).items.map((s) => [s.shopId, s]))
const months = [addMonths(currentMonth(), -2), addMonths(currentMonth(), -1), currentMonth()]

// ------------------------------------------------------------------ 1. the demo shop's boards
const demo = writerFor(privateKeyToAccount(need("DEMO_DEALER_PRIVATE_KEY")))
await fund(demo.account.address)
const have = (await shopStocks(reader, "SYN-BR-0042")).items.filter((b) => b.creator.toLowerCase() === demo.account.address.toLowerCase())
const plan = [
  { month: months[0]!, riceG: 1_380_000, wheatG: 920_000 },
  { month: months[1]!, riceG: 1_350_000, wheatG: 900_000 },
  { month: months[2]!, riceG: 1_400_000, wheatG: 940_000 },
  { month: months[2]!, riceG: 1_200_000, wheatG: 800_000 }, // re-posted lower: both versions stay on record
]
for (const [i, p] of plan.entries()) {
  if (have.filter((b) => b.month === p.month).length > plan.slice(0, i).filter((q) => q.month === p.month).length) continue
  const r = await postStockBoard(reader, demo, shops.get("SYN-BR-0042")!, p.month, { riceG: p.riceG, wheatG: p.wheatG, milletG: 0, cards: 92, fromDay: 1, toDay: 10 })
  log("board SYN-BR-0042", p.month, r.entityKey.slice(0, 12))
}

// ------------------------------------------------------------------ 2. a shop that earns the Fair shop badge
const recent = (await dashboardReports(reader, { state: "BR", fromMonth: months[1]!, toMonth: months[2]! })).items.filter((r) => r.scheme === "pds")
const candidates = shopStats(recent, [])
  .filter((s) => s.shopId !== "SYN-BR-0042" && s.reports >= 3 && s.reporters >= 2)
  .sort((a, b) => a.shortfallBp - b.shortfallBp)
const fair = candidates[0]
if (!fair || fair.shortfallBp >= 500) throw new Error("no ration shop in Bihar is under 5% short with enough reports")
log("fair shop candidate", fair.shopId, `${(fair.shortfallBp / 100).toFixed(1)}% short over ${fair.reports} reports`)
if (!/^DEMO_FAIR_DEALER_PRIVATE_KEY=/m.test(envText())) fs.appendFileSync(".env", `${envText().endsWith("\n") ? "" : "\n"}DEMO_FAIR_DEALER_PRIVATE_KEY=${generatePrivateKey()}\n`)
const fairAcct = privateKeyToAccount(need("DEMO_FAIR_DEALER_PRIVATE_KEY"))
await fund(fairAcct.address)
if (!(await deviceAttestations(reader, fairAcct.address)).items.some((a) => a.role === "dealer" && a.shopId === fair.shopId)) {
  const issuer = privateKeyToAccount(need("TEST_ISSUER_PRIVATE_KEY"))
  const c = { v: 1 as const, state: "BR", shopId: fair.shopId, type: "FPS" as const, serial: randomBytes(16).toString("hex") }
  const lic: TestCard = { ...c, sig: await issuer.signMessage({ message: cardMessage(c) }) }
  const res = await attestDevice(writerFor(privateKeyToAccount(need("VERIFIER_PRIVATE_KEY"))), { device: fairAcct.address, state: "BR", shopId: fair.shopId, cardTag: await cardTag(need("CARD_TAG_SECRET"), lic.serial), method: "test_card", role: "dealer", synthetic: true })
  log("verified fair dealer", res.entityKey.slice(0, 12))
}
const fairW = writerFor(fairAcct)
const keys = (JSON.parse(fs.readFileSync(".seed-wallets.json", "utf8")) as { keys: `0x${string}`[] }).keys
const byAddr = new Map(keys.map((k) => [privateKeyToAccount(k).address.toLowerCase(), k]))
const counted = dedupeReports(recent.filter((r) => r.shopId === fair.shopId)).filter((r) => r.shortfallG > 0)
const answered = new Set((await shopResponses(reader, fair.shopId)).items.filter((x) => x.creator.toLowerCase() === fairAcct.address.toLowerCase()).map((x) => x.reportKey))
const followed = new Set((await shopFollowups(reader, fair.shopId)).items.map((x) => x.reportKey))
for (const r of counted) {
  if (!answered.has(r.key.toLowerCase())) log("answer", r.key.slice(0, 12), (await respondToReport(reader, fairW, r, "full_quantity")).entityKey.slice(0, 12))
  const k = byAddr.get(r.creator.toLowerCase())
  if (k && !followed.has(r.key.toLowerCase())) log("fixed", r.key.slice(0, 12), (await followUpReport(reader, writerFor(privateKeyToAccount(k)), r, "fixed")).entityKey.slice(0, 12))
}
if (!(await shopStocks(reader, fair.shopId)).items.some((b) => b.month === currentMonth() && b.creator.toLowerCase() === fairAcct.address.toLowerCase())) {
  const r = await postStockBoard(reader, fairW, shops.get(fair.shopId)!, currentMonth(), { riceG: 1_100_000, wheatG: 730_000, milletG: 0, cards: 75, fromDay: 1, toDay: 12 })
  log("board", fair.shopId, currentMonth(), r.entityKey.slice(0, 12))
}
log("done; Fair shop demo:", fair.shopId)
