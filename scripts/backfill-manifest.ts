// Fills missing creation tx hashes in docs/seed-manifest.json (and the shop list) from EntityCreated logs.
// Read-only: eth_getLogs only. Usage: node --import tsx scripts/backfill-manifest.ts
import fs from "node:fs"
import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk"
import { createPublicClient, decodeEventLog, http, type Hex } from "viem"
import { DEFAULT_REGISTRY, httpReader, listShops, tiramisu } from "../packages/tolmol-sdk/src/index.js"

const pub = createPublicClient({ chain: tiramisu, transport: http() })
const FROM = 515_000n // before any Tolmol entity existed (first write: block 515746)
const head = await pub.getBlockNumber()
const created = new Map<string, { txHash: Hex; block: bigint }>()
for (let from = FROM; from <= head; from += 5_000n) {
  const to = from + 4_999n > head ? head : from + 4_999n
  const logs = await pub.getLogs({ address: "0x4400000000000000000000000000000000000044", fromBlock: from, toBlock: to })
  for (const l of logs) {
    try {
      const e = decodeEventLog({ abi: ENTITY_EVENTS_ABI, data: l.data, topics: l.topics as [Hex, ...Hex[]] })
      if (e.eventName === "EntityCreated") created.set((e.args.entityKey as string).toLowerCase(), { txHash: l.transactionHash!, block: l.blockNumber! })
    } catch {
      /* not an entity event */
    }
  }
}
const m = JSON.parse(fs.readFileSync("docs/seed-manifest.json", "utf8"))
let filled = 0
for (const x of [...m.reports, ...m.witnesses]) {
  const c = created.get(String(x.key).toLowerCase())
  if (c && !x.txHash) {
    x.txHash = c.txHash
    filled++
  }
  if (c) x.block = c.block.toString()
}
const shops = (await listShops(httpReader(), {})).items
m.shops = shops
  .sort((a, b) => (a.shopId < b.shopId ? -1 : 1))
  .map((s) => ({ shopId: s.shopId, state: s.state, district: s.district, key: s.key, creator: s.creator, txHash: created.get(s.key.toLowerCase())?.txHash, block: created.get(s.key.toLowerCase())?.block.toString() }))
m.registry = DEFAULT_REGISTRY
fs.writeFileSync("docs/seed-manifest.json", JSON.stringify(m, null, 2) + "\n")
console.log(`scanned ${created.size} creations up to block ${head}; filled ${filled} tx hashes; ${m.shops.length} shops, ${m.shops.filter((s: { txHash?: string }) => s.txHash).length} with tx`)
console.log("missing:", [...m.reports, ...m.witnesses].filter((x: { txHash?: string }) => !x.txHash).length)
