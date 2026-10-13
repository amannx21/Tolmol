// Phase 0: batch writes, create+burn-transfer in one batch, query operators, pagination past 200, cursor resume, atBlock.
// Real writes: 2 batches of 105 tiny entities (6h life) + 1 burn test. Usage: node --env-file=.env scripts/test-queries.mjs
import { ExpirationTime } from "@arkiv-network/sdk"
import { str, i32, u64, bool } from "@arkiv-network/sdk/attr"
import { eq, gte, lt, not, or, startsWith, ne } from "@arkiv-network/sdk/query"
import { pub, wallet, recorder } from "./lib/testkit.mjs"

const { step, file } = recorder("queries")
const R = wallet("REPORTER")
const A = wallet("WITNESS_A")
const BURN = "0x000000000000000000000000000000000000dEaD"
const run = `run-${Date.now()}`
const scope = [eq("project", str("tolmol")), eq("test", str("pagination")), eq("run", str(run))]
const mk = (seq) => ({
  payload: new Uint8Array(),
  contentType: "application/octet-stream",
  expires: ExpirationTime.fromHours(6),
  attributes: {
    project: str("tolmol"), type: str("tolmol.test"), synthetic: bool(true), test: str("pagination"), run: str(run),
    seq: i32(seq), shop_id: str(`SYN-${seq % 2 ? "BR" : "UP"}-${String(seq).padStart(4, "0")}`),
    reported_at: u64(BigInt(Date.now())),
  },
})

const beforeBlock = await pub.getBlockNumber()
let firstBatchBlock
// 5 batches of 42: the public RPC rejects request bodies over 262,144 bytes (HTTP 413), about 57 creates of this shape.
for (let b = 0; b < 5; b++) {
  await step(`batch ${b + 1}: 42 creates in one tx`, "ok", async () => {
    const r = await R.executeBatch({ creates: Array.from({ length: 42 }, (_, i) => mk(b * 42 + i)) })
    const rc = await pub.getTransactionReceipt({ hash: r.txHash })
    if (b === 0) firstBatchBlock = rc.blockNumber
    return { txHash: r.txHash, created: r.createdEntities.length, block: rc.blockNumber, gasUsed: rc.gasUsed, gasPerCreate: rc.gasUsed / 42n }
  })
}
const head = await pub.getBlockNumber()

// --- Pagination
await step("limit(200) page 1 + next()", "200 then 10", async () => {
  let p = await pub.select({ key: true }).where(scope).limit(200).atBlock(head).fetch()
  const first = p.entities.length
  const hasNext = p.hasNextPage()
  p = await p.next()
  return { first, hasNext, second: p.entities.length, hasNextAfter: p.hasNextPage(), blockNumber: p.blockNumber }
})
await step("limit(201)", "rejected (max 200)", async () => ({ got: (await pub.select({ key: true }).where(scope).limit(201).fetch()).entities.length }))
await step("limit(0)", "rejected", async () => ({ got: (await pub.select({ key: true }).where(scope).limit(0).fetch()).entities.length }))
await step("no limit()", "100 per page (docs)", async () => {
  const p = await pub.select({ key: true }).where(scope).fetch()
  return { got: p.entities.length, hasNext: p.hasNextPage() }
})
await step("async iterator over all", "210", async () => {
  let n = 0
  for await (const _ of pub.select({ key: true }).where(scope).limit(200)) n++
  return { total: n }
})
await step("cursor resume with .cursor(saved)", "50 then 160", async () => {
  const p = await pub.select({ key: true }).where(scope).limit(50).atBlock(head).fetch()
  let q = await pub.select({ key: true }).where(scope).limit(50).atBlock(head).cursor(p.cursor).fetch()
  let n = q.entities.length
  while (q.hasNextPage()) { q = await q.next(); n += q.entities.length }
  return { firstPage: p.entities.length, resumedTotal: n }
})
await step("cursor reused with a different page size", "rejected kind=cursor", async () => {
  const p = await pub.select({ key: true }).where(scope).limit(50).atBlock(head).fetch()
  return { got: (await pub.select({ key: true }).where(scope).limit(60).atBlock(head).cursor(p.cursor).fetch()).entities.length }
})
await step("result order", "newest first", async () => {
  const p = await pub.select({ key: true, attributes: { seq: true } }).where(scope).limit(5).atBlock(head).fetch()
  return { seqs: p.entities.map((e) => e.attributes.seq?.value) }
})

// --- Operators
const count = async (...w) => {
  let n = 0
  for await (const _ of pub.select({ key: true }).where([...scope, ...w]).limit(200).atBlock(head)) n++
  return n
}
await step("range: seq >= 100 AND seq < 150", "50", async () => ({ n: await count(gte("seq", i32(100)), lt("seq", i32(150))) }))
await step("OR: seq = 1 OR 2 OR 209", "3", async () => ({ n: await count(or(eq("seq", i32(1)), eq("seq", i32(2)), eq("seq", i32(209)))) }))
await step("NOT (seq < 200)", "10", async () => ({ n: await count(not(lt("seq", i32(200)))) }))
await step("STARTSWITH shop_id SYN-BR-", "105 (odd seqs)", async () => ({ n: await count(startsWith("shop_id", "SYN-BR-")) }))
await step("type mismatch: seq = u64(5)", "0, no error", async () => ({ n: await count(eq("seq", u64(5n))) }))
await step("type mismatch: seq = str 5", "0, no error", async () => ({ n: await count(eq("seq", str("5"))) }))
await step("ne(seq, 5)", "rejected by node", async () => ({ n: await count(ne("seq", i32(5))) }))
await step("$expiresAt < head + 1 day", "210", async () => ({ n: await count(lt("$expiresAt", u64(head + 43200n))) }))
await step("raw string in the brief's syntax (&& and !=)", "rejected parse", async () => {
  const r = await pub.query('project = "tolmol" && seq != 5', { select: { key: true }, limit: 10 })
  return { got: r.entities.length }
})
await step("raw string AND / NOT syntax", "209", async () => {
  const q = `project = str('tolmol') AND run = str('${run}') AND NOT (seq = i32(5))`
  let r = await pub.query(q, { select: { key: true }, limit: 200, atBlock: head })
  let n = r.entities.length
  while (r.cursor) { r = await pub.query(q, { select: { key: true }, limit: 200, atBlock: head, cursor: r.cursor }); n += r.entities.length }
  return { n, query: q }
})

// --- Historical reads
await step("atBlock(before batch 1)", "0", async () => ({ n: (await pub.select({ key: true }).where(scope).atBlock(beforeBlock).fetch()).entities.length }))
await step("atBlock(batch 1 block)", "42", async () => {
  let n = 0
  for await (const _ of pub.select({ key: true }).where(scope).limit(200).atBlock(firstBatchBlock)) n++
  return { n }
})
for (const back of [1000n, 10000n, 100000n, 500000n]) {
  await step(`atBlock(head - ${back})`, "ok or rejected kind=block", async () => {
    const r = await pub.select({ key: true }).where(eq("project", str("tolmol"))).atBlock(head - back).limit(1).fetch()
    return { ok: true, blockNumber: r.blockNumber }
  })
}

console.log("RESULTS_FILE", file)
