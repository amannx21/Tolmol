// Demo for inspector delegation (synthetic, testnet). Never prints keys. Idempotent.
// The demo official for Gaya (DEMO_OFFICIAL_PRIVATE_KEY) sends a demo inspector (DEMO_INSPECTOR_PRIVATE_KEY, created
// here and kept in .env) to SYN-BR-0002 for 14 days; the inspector records "inspected, shortage found" there.
// Usage: node --env-file=.env --import tsx scripts/seed-delegation.ts
import fs from "node:fs"
import { parseEther } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { delegateInspector, httpReader, listShops, recordOfficialAction, shopDelegations, shopOfficialActions, writerFor } from "../packages/tolmol-sdk/src/index.js"

const envText = () => fs.readFileSync(".env", "utf8")
const need = (k: string) => {
  const m = envText().match(new RegExp(`^${k}=(0x[0-9a-fA-F]{64})`, "m"))
  if (!m) throw new Error(`${k} missing in .env`)
  return m[1] as `0x${string}`
}
const reader = httpReader()
const SHOP = "SYN-BR-0002"
if (!/^DEMO_INSPECTOR_PRIVATE_KEY=/m.test(envText())) fs.appendFileSync(".env", `${envText().endsWith("\n") ? "" : "\n"}DEMO_INSPECTOR_PRIVATE_KEY=${generatePrivateKey()}\n`)
const inspector = privateKeyToAccount(need("DEMO_INSPECTOR_PRIVATE_KEY"))
const official = writerFor(privateKeyToAccount(need("DEMO_OFFICIAL_PRIVATE_KEY")))
if ((await reader.getBalance({ address: inspector.address })) < parseEther("0.004")) {
  const tx = await writerFor(privateKeyToAccount(need("REPORTER_PRIVATE_KEY"))).sendTransaction({ to: inspector.address, value: parseEther("0.01") })
  await reader.waitForTransactionReceipt({ hash: tx })
  console.log("funded inspector", inspector.address)
}
const shop = (await listShops(reader, { state: "BR" })).items.find((s) => s.shopId === SHOP)!
const head = await reader.getBlockNumber()
const live = (await shopDelegations(reader, SHOP)).items.some((d) => d.inspector === inspector.address.toLowerCase() && d.untilBlock > head)
if (!live) console.log("delegation", (await delegateInspector(reader, official, shop, inspector.address, 14)).entityKey)
const done = (await shopOfficialActions(reader, SHOP)).items.some((a) => a.creator.toLowerCase() === inspector.address.toLowerCase())
if (!done) console.log("inspector finding", (await recordOfficialAction(reader, writerFor(inspector), shop, "inspected_shortage_found")).entityKey)
console.log("done; inspector", inspector.address)
