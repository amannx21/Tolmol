// Adds a few SYNTHETIC "all grain" reports with issue tags (charged money, shop closed, ...) from the seed devices,
// so the dashboard and shop pages show the issue counts. Idempotent: skips (device, shop, month, total) that exist.
// Usage: node --env-file=.env --import tsx scripts/seed-issues.ts
import fs from "node:fs"
import { privateKeyToAccount } from "viem/accounts"
import { currentMonth, httpReader, ISSUES, listShops, myExistingReport, submitReport, writerFor } from "../packages/tolmol-sdk/src/index.js"

const keys = JSON.parse(fs.readFileSync(".seed-wallets.json", "utf8")).keys as string[]
const reader = httpReader()
const shops = new Map((await listShops(reader, {})).items.map((s) => [s.shopId, s]))
const month = currentMonth()
const I = ISSUES
// [device index, shop, entitled g, received g, issues]
const plan: [number, string, number, number, number][] = [
  [4, "SYN-BR-0042", 20_000, 15_000, I.charged_money | I.no_receipt],
  [5, "SYN-BR-0042", 35_000, 0, I.auth_failed],
  [6, "SYN-BR-0042", 25_000, 18_000, I.thumb_no_grain | I.bad_quality],
  [7, "SYN-BR-0003", 15_000, 0, I.shop_closed],
  [8, "SYN-BR-0007", 20_000, 14_000, I.charged_money],
  [9, "SYN-UP-0002", 30_000, 0, I.portability_refused],
  [4, "SYN-JH-0003", 10_000, 7_000, I.bad_quality | I.no_receipt],
]
for (const [di, shopId, entitledG, receivedG, issues] of plan) {
  const shop = shops.get(shopId)
  if (!shop) throw new Error(`no shop ${shopId}`)
  const writer = writerFor(privateKeyToAccount(keys[di] as `0x${string}`))
  const input = { shopId, month, item: "total" as const, entitledG, receivedG, issues }
  if (await myExistingReport(reader, writer.account.address, input)) {
    console.log("exists", shopId, "device", di)
    continue
  }
  const res = await submitReport(reader, writer, input, shop, { synthetic: true, skipDuplicateCheck: true })
  console.log("report", shopId, `${receivedG}/${entitledG} g`, "issues", issues, res.entityKey, res.txHash)
}
