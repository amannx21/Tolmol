// Demo for school and panchayat boards (synthetic, testnet). Never prints keys. Idempotent.
// The demo head teacher of SYN-BR-5001 and the demo employment assistant of SYN-BR-7001 (keys from seed-schemes.ts)
// post this month's and last month's boards. Usage: node --env-file=.env --import tsx scripts/seed-boards.ts
import fs from "node:fs"
import { privateKeyToAccount } from "viem/accounts"
import { addMonths, currentMonth, httpReader, listOutlets, postBoard, shopBoards, writerFor, type BoardValues } from "../packages/tolmol-sdk/src/index.js"

const need = (k: string) => {
  const m = fs.readFileSync(".env", "utf8").match(new RegExp(`^${k}=(0x[0-9a-fA-F]{64})`, "m"))
  if (!m) throw new Error(`${k} missing in .env`)
  return m[1] as `0x${string}`
}
const reader = httpReader()
const outlets = new Map((await listOutlets(reader, { state: "BR" })).items.map((s) => [s.shopId, s]))
const months = [addMonths(currentMonth(), -1), currentMonth()]
const plan: [string, string, BoardValues][] = [
  // The school claims a meal on (almost) every school day; parents' reports will say otherwise.
  ["DEMO_SCHOOL_HEAD_PRIVATE_KEY", "SYN-BR-5001", { scheme: "mdm", children: 214, openDays: 22, mealDays: 22, grainG: 470_000 }],
  // The panchayat says it paid all wages; workers' reports will say they got less.
  ["DEMO_PANCHAYAT_PRIVATE_KEY", "SYN-BR-7001", { scheme: "nrega", workers: 38, personDays: 412, rateInr: 250, wagesPaidInr: 103_000 }],
]
for (const [env, shopId, v] of plan) {
  const w = writerFor(privateKeyToAccount(need(env)))
  const have = new Set((await shopBoards(reader, shopId)).items.filter((b) => b.creator.toLowerCase() === w.account.address.toLowerCase()).map((b) => b.month))
  for (const month of months) {
    if (have.has(month)) continue
    const r = await postBoard(reader, w, outlets.get(shopId)!, month, v)
    console.log("board", shopId, month, r.entityKey.slice(0, 12))
  }
}
console.log("done")
