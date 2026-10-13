// Read-only summary of Tolmol data on Tiramisu. Usage: node --import tsx scripts/inspect.ts
import { str } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import { DEFAULT_REGISTRY, httpReader, PROJECT, TYPE } from "../packages/tolmol-sdk/src/index.js"

const timer = setTimeout(() => {
  console.error("timed out after 90s")
  process.exit(2)
}, 90_000)

const r = httpReader()
const head = await r.getBlockNumber()
console.log("head", head)
for (const type of [TYPE.shop, TYPE.report, TYPE.witness]) {
  const t0 = Date.now()
  let page = await r
    .select({ key: true, creator: true, attributes: { shop_id: true, state: true } })
    .where(eq("project", str(PROJECT)), eq("type", str(type)))
    .limit(200)
    .atBlock(head)
    .fetch()
  const all = [...page.entities]
  while (page.hasNextPage()) {
    page = await page.next()
    all.push(...page.entities)
  }
  const creators = new Set(all.map((e) => e.creator.toLowerCase()))
  const byShop = new Map<string, number>()
  for (const e of all) {
    const id = String(e.attributes.shop_id?.value)
    byShop.set(id, (byShop.get(id) ?? 0) + 1)
  }
  const extra: Record<string, unknown> = {}
  if (type === TYPE.shop) {
    extra.fromRegistry = all.filter((e) => e.creator.toLowerCase() === DEFAULT_REGISTRY.toLowerCase()).length
    extra.duplicateShopIds = [...byShop.entries()].filter(([, n]) => n > 1)
  }
  console.log(type, { count: all.length, creators: creators.size, shops: byShop.size, ms: Date.now() - t0, ...extra })
}
clearTimeout(timer)
