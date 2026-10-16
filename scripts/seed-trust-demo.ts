// Demo data for three trust features (synthetic, testnet). Never prints keys.
//  1. Who checks the checkers (SYN-BR-0002, Gaya): the delegated demo inspector records "inspected: no issue found"; then three fresh
//     synthetic phones report about 31% short there. The track record (#/track) flags the finding as contradicted.
//  2. Private notes: the demo Gaya official turns on private notes (publishes its public key), and one of those phones
//     sends an encrypted, synthetic note about its own report. The explorer shows only ciphertext.
//  3. "I got my full share": at a quiet demo shop, one phone claims 11 kg short (unconfirmed) and three others say they
//     got their full ration this month, so that report shows "contradicted by 3 others". SYN-BR-0001 (the Fair shop
//     example) is never touched.
// Idempotent: each step checks Arkiv first and skips what already exists.
// Usage: node --env-file=.env --import tsx scripts/seed-trust-demo.ts
import fs from "node:fs"
import { parseEther } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  activeDelegation,
  currentMonth,
  dedupeReports,
  districtOfficeKeys,
  explorerEntityUrl,
  httpReader,
  listAttestations,
  listOutlets,
  listVerifiers,
  publishOfficeKey,
  recordOfficialAction,
  sayFullShare,
  sendNote,
  shopFullShares,
  shopDelegations,
  shopNotesTo,
  shopOfficialActions,
  shopReports,
  submitReport,
  validOfficeKeys,
  verifiedOfficials,
  writerFor,
  type Writer,
} from "../packages/tolmol-sdk/src/index.js"

const SHOP_ID = "SYN-BR-0002"
const NOTE = "SYNTHETIC DEMO NOTE: the dealer said he would stop my ration if I complained again. / नकली डेमो संदेश: कोटेदार ने कहा कि दोबारा शिकायत की तो राशन बंद कर देगा।"
const need = (k: string) => {
  const m = fs.readFileSync(".env", "utf8").match(new RegExp(`^${k}=(0x[0-9a-fA-F]{64})`, "m"))
  if (!m) throw new Error(`${k} missing in .env`)
  return m[1] as `0x${string}`
}
const reader = httpReader()
const lc = (x: string) => x.toLowerCase()
const shop = (await listOutlets(reader)).items.find((s) => s.shopId === SHOP_ID)
if (!shop) throw new Error(`${SHOP_ID} is not in the registry`)
const funder = writerFor(privateKeyToAccount(need("REPORTER_PRIVATE_KEY")))
const inspectorPk = need("DEMO_INSPECTOR_PRIVATE_KEY")
const officialPk = need("DEMO_OFFICIAL_PRIVATE_KEY")
const inspector = writerFor(privateKeyToAccount(inspectorPk))
const official = writerFor(privateKeyToAccount(officialPk))

// ---- 1. the inspector's "no issue found", inside its delegation window
const head = await reader.getBlockNumber({ cacheTime: 0 })
const acts = (await shopOfficialActions(reader, SHOP_ID)).items
let finding = acts.find((a) => a.action === "inspected_no_issue" && lc(a.creator) === lc(inspector.account.address))
if (!finding) {
  const dels = (await shopDelegations(reader, SHOP_ID)).items
  if (!activeDelegation(dels, inspector.account.address, SHOP_ID, head)) throw new Error("the demo inspector has no live delegation at SYN-BR-0002 (run scripts/seed-delegation.ts)")
  const res = await recordOfficialAction(reader, inspector, shop, "inspected_no_issue", { synthetic: true })
  console.log("inspector: inspected, no issue found", explorerEntityUrl(res.entityKey))
  finding = (await shopOfficialActions(reader, SHOP_ID)).items.find((a) => lc(a.key) === lc(res.entityKey))
  if (!finding) throw new Error("the finding did not read back")
} else console.log("inspector finding already there:", explorerEntityUrl(finding.key))

// ---- 2. reports after the finding, about 31% short, from fresh synthetic phones
const fresh = async (): Promise<Writer> => {
  const acct = privateKeyToAccount(generatePrivateKey())
  const tx = await funder.sendTransaction({ to: acct.address, value: parseEther("0.004") })
  await reader.waitForTransactionReceipt({ hash: tx })
  console.log("synthetic phone", acct.address)
  return writerFor(acct)
}
const fileShort = async (w: Writer) => {
  const res = await submitReport(reader, w, { shopId: SHOP_ID, month: currentMonth(), item: "total", entitledG: 35_000, receivedG: 24_000, issues: 0 }, shop, { synthetic: true, skipDuplicateCheck: true })
  console.log("  report, 11 of 35 kg short", explorerEntityUrl(res.entityKey))
  return res.entityKey
}
const after = dedupeReports((await shopReports(reader, SHOP_ID)).items).filter((r) => r.createdAt > finding!.createdAt && r.shortfallG > 0)
const reporters = new Set(after.map((r) => lc(r.creator)))
const made: { w: Writer; reportKey: `0x${string}` }[] = []
while (reporters.size + made.length < 3) {
  const w = await fresh()
  made.push({ w, reportKey: await fileShort(w) })
}
console.log(`reports after the finding: ${after.length + made.length} from ${reporters.size + made.length} phones`)

// ---- 3. the Gaya official turns on private notes
const officials = verifiedOfficials((await listVerifiers(reader)).items, (await listAttestations(reader)).items)
const districts = new Map((await listOutlets(reader)).items.map((s) => [s.shopId, s.district]))
const keysNow = async () => validOfficeKeys((await districtOfficeKeys(reader, shop.district)).items, officials, districts).get(shop.district) ?? []
let officeKey = (await keysNow()).find((k) => lc(k.creator) === lc(official.account.address))
if (!officeKey) {
  const res = await publishOfficeKey(official, officialPk, shop, { synthetic: true })
  console.log("official: private notes on", explorerEntityUrl(res.entityKey))
  officeKey = (await keysNow()).find((k) => lc(k.creator) === lc(official.account.address))
  if (!officeKey) throw new Error("the office key did not count (is the demo official verified for Gaya?)")
} else console.log("official's key for private notes already there:", explorerEntityUrl(officeKey.key))

// ---- 4. one encrypted note from a reporter about their own report
const notes = (await shopNotesTo(reader, SHOP_ID, official.account.address)).items
if (notes.length === 0) {
  const from = made[0] ?? (await (async () => {
    const w = await fresh()
    return { w, reportKey: await fileShort(w) }
  })())
  const report = (await shopReports(reader, SHOP_ID)).items.find((r) => lc(r.key) === lc(from.reportKey))
  if (!report) throw new Error("the report did not read back")
  const res = await sendNote(reader, from.w, report, officeKey, NOTE, { synthetic: true })
  console.log("encrypted note (the explorer shows ciphertext only)", explorerEntityUrl(res.entityKey))
} else console.log(`notes to the official already there: ${notes.length}`)
// ---- 5. "I got my full share" contradicting a lone, unconfirmed claim at a quiet shop
const month = currentMonth()
const outlets = (await listOutlets(reader)).items.filter((s) => s.scheme === "pds" && s.state === "BR" && !["SYN-BR-0001", "SYN-BR-0002", "SYN-BR-0042"].includes(s.shopId))
let quiet = outlets.find((s) => s.shopId === process.env.FULL_SHOP)
if (!quiet) {
  for (const s of outlets) {
    if ((await shopFullShares(reader, s.shopId, month)).items.length > 0) { quiet = s; break } // already seeded
  }
}
if (!quiet) {
  for (const s of outlets) {
    if ((await shopReports(reader, s.shopId)).items.every((r) => r.month !== month)) { quiet = s; break }
  }
}
if (!quiet) throw new Error("no quiet demo shop for the full-share example")
const shares = (await shopFullShares(reader, quiet.shopId, month)).items
if (shares.length >= 3) console.log(`full-share example already at ${quiet.shopId}: ${shares.length} phones`)
else {
  console.log(`full-share example at ${quiet.shopId} (${month})`)
  const claimant = await fresh()
  const claim = await submitReport(reader, claimant, { shopId: quiet.shopId, month, item: "total", entitledG: 35_000, receivedG: 24_000, issues: 0 }, quiet, { synthetic: true, skipDuplicateCheck: true })
  console.log("  lone claim, 11 of 35 kg short", explorerEntityUrl(claim.entityKey))
  for (let i = shares.length; i < 3; i++) {
    const w = await fresh()
    const res = await sayFullShare(reader, w, quiet, month, { synthetic: true })
    console.log("  got my full ration", explorerEntityUrl(res.entityKey))
  }
}
console.log("done")
