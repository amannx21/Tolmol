// Read Tolmol data with ONLY the official Arkiv SDK (no tolmol-sdk, no Tolmol server).
// This is what "another team can build on it without asking" looks like: the data contract is
// arkiv/schema.md (human) and docs/data-contract.schema.json (machine).
//
//   npm install @arkiv-network/sdk@0.8.1 viem   (or run from this repo after `npm ci`)
//   node examples/minimal-reader.mjs SYN-BR-0042
import { createPublicClient } from "@arkiv-network/sdk"
import { str } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { eq } from "@arkiv-network/sdk/query"
import { http } from "viem"

const shopId = process.argv[2] ?? "SYN-BR-0042"
const client = createPublicClient({ chain: tiramisu, transport: http() })
const v = (e, name) => e.attributes[name]?.value

let page = await client
  .select({ key: true, creator: true, createdAt: true, attributes: true })
  .where(eq("project", str("tolmol")), eq("type", str("tolmol.report")), eq("shop_id", str(shopId)))
  .limit(200)
  .fetch()
const reports = [...page.entities]
while (page.hasNextPage()) {
  page = await page.next()
  reports.push(...page.entities)
}

// Your own rules go here. Tolmol's (dedupe, different-device witnesses, reporter-only withdrawals)
// are documented in arkiv/schema.md; this example just totals what it reads.
let entitled = 0
let received = 0
for (const r of reports) {
  entitled += v(r, "entitled_g")
  received += v(r, "received_g")
}
console.log(`${shopId}: ${reports.length} reports read at block ${page.blockNumber}`)
console.log(`entitled ${entitled / 1000} kg, received ${received / 1000} kg, short ${(entitled - received) / 1000} kg`)
for (const r of reports.slice(0, 5)) console.log(`  ${v(r, "month")} ${v(r, "item")} ${v(r, "received_g")}/${v(r, "entitled_g")} g by ${r.creator}`)
