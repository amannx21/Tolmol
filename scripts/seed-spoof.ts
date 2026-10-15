// Plants a FAKE dealer answer and a FAKE "fixed" follow-up at the demo shop SYN-BR-0042, written by a stranger's wallet
// (fresh key, never saved). Same entity type and attributes as the real ones; only $creator differs. The shop page must
// ignore both and list the stranger under "ignored". Synthetic, testnet. Never prints keys. Skips if a spoof exists.
// Usage: node --env-file=.env --import tsx scripts/seed-spoof.ts
import fs from "node:fs"
import { parseEther } from "viem"
import { ExpirationTime } from "@arkiv-network/sdk"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  dedupeReports, followupAttributes, httpReader, respondToReport, shopFollowups, shopReports, shopResponses, writerFor, listAttestations, verifiedDealers, listVerifiers,
} from "../packages/tolmol-sdk/src/index.js"

const SHOP = "SYN-BR-0042"
const need = (k: string) => {
  const m = fs.readFileSync(".env", "utf8").match(new RegExp(`^${k}=(0x[0-9a-fA-F]{64})`, "m"))
  if (!m) throw new Error(`${k} missing in .env`)
  return m[1] as `0x${string}`
}
const reader = httpReader()
const dealers = verifiedDealers((await listVerifiers(reader)).items, (await listAttestations(reader)).items)
const [rs, fs2] = await Promise.all([shopResponses(reader, SHOP), shopFollowups(reader, SHOP)])
const reports = dedupeReports((await shopReports(reader, SHOP)).items)
const creatorOf = new Map(reports.map((r) => [r.key.toLowerCase(), r.creator.toLowerCase()]))
const fakeAnswers = rs.items.filter((x) => dealers.get(x.creator.toLowerCase())?.shopId !== SHOP).length
const fakeFollowups = fs2.items.filter((f) => creatorOf.has(f.reportKey) && creatorOf.get(f.reportKey) !== f.creator.toLowerCase()).length
console.log(`present: ${fakeAnswers} fake answers, ${fakeFollowups} fake follow-ups`)
if (fakeAnswers > 0 && fakeFollowups > 0) process.exit(0)
const stranger = privateKeyToAccount(generatePrivateKey())
console.log("stranger wallet", stranger.address)
const tx = await writerFor(privateKeyToAccount(need("REPORTER_PRIVATE_KEY"))).sendTransaction({ to: stranger.address, value: parseEther("0.004") })
await reader.waitForTransactionReceipt({ hash: tx })
const w = writerFor(stranger)
const target = reports.filter((r) => r.shortfallG > 0)
if (target.length < 2) throw new Error("need two reports with a shortfall at " + SHOP)
if (!fakeAnswers) {
  const a = await respondToReport(reader, w, target[0]!, "full_quantity", { synthetic: true })
  console.log("fake dealer answer", a.entityKey, "tx", a.txHash)
}
if (!fakeFollowups) {
  // The SDK refuses to write a follow-up for someone else's report, so write the raw entity, as an attacker would.
  const f = await w.createEntity({
    payload: new Uint8Array(),
    contentType: "application/octet-stream",
    attributes: followupAttributes(target[1]!, "fixed", { synthetic: true, atMs: BigInt(Date.now()) }),
    expires: ExpirationTime.fromDays(60),
    flags: { readonly: true },
  })
  console.log("fake fixed follow-up", f.entityKey, "tx", f.txHash)
}
