// Phase 0: Entity Expiration bounds, payload and attribute limits on Tiramisu.
// Real writes: three tiny entities (30/90/180 days) and one 1-block entity. Everything else is a dry run
// (eth_estimateGas only, broadcast blocked) or local SDK validation. Usage: node --env-file=.env scripts/test-expiry-and-limits.mjs
import { ExpirationTime } from "@arkiv-network/sdk"
import { str, u64, bool, i32 } from "@arkiv-network/sdk/attr"
import { pub, wallet, dryWallet, recorder } from "./lib/testkit.mjs"

const { step, file } = recorder("expiry-and-limits")
const W = wallet("REPORTER")
const base = (variant) => ({ project: str("tolmol"), type: str("tolmol.test"), synthetic: bool(true), test: str("limits"), variant: str(variant) })
const empty = { payload: new Uint8Array(), contentType: "application/octet-stream" }

async function realCreate(variant, expires) {
  const r = await W.createEntity({ ...empty, attributes: base(variant), expires })
  const rc = await pub.getTransactionReceipt({ hash: r.txHash })
  return { entityKey: r.entityKey, txHash: r.txHash, block: rc.blockNumber, expiresAt: r.expiresAt,
    lifetimeBlocks: r.expiresAt - rc.blockNumber, gasUsed: rc.gasUsed }
}
const dryWithGas = (params) => async () => {
  const { client, probe } = dryWallet("REPORTER")
  try { await client.createEntity(params); return { note: "unexpected broadcast path" } }
  catch (e) { if (probe.gas !== undefined) return { estimatedGas: probe.gas, broadcast: "blocked (dry run)" }; throw e }
}

// --- Expiry: real writes at 30/90/180 days, to compare gas vs lifetime
for (const d of [30, 90, 180]) await step(`create fromDays(${d})`, `accepted, lifetime ${d * 43200} blocks`, () => realCreate(`days-${d}`, ExpirationTime.fromDays(d)))
await step("create fromBlocks(1) (shortest possible lifetime)", "accepted, lifetime 1 block", () => realCreate("blocks-1", ExpirationTime.fromBlocks(1)))
await step("ExpirationTime.fromSeconds(1)", "SDK rejects (not a whole block)", async () => ({ built: String(ExpirationTime.fromSeconds(1)) }))
await step("ExpirationTime.fromBlocks(0)", "SDK rejects", async () => ({ built: String(ExpirationTime.fromBlocks(0)) }))
const head = await pub.getBlockNumber()
await step(`dry create atBlock(head-1 = ${head - 1n})`, "rejected: dead on arrival", dryWithGas({ ...empty, attributes: base("dead"), expires: ExpirationTime.atBlock(head - 1n) }))
await step("dry create fromYears(10)", "estimate ok", dryWithGas({ ...empty, attributes: base("years-10"), expires: ExpirationTime.fromYears(10) }))
await step("dry create permanent()", "estimate ok or rejected", dryWithGas({ ...empty, attributes: base("permanent"), expires: ExpirationTime.permanent() }))
await step("dry create fromDays(90) (baseline for gas comparison)", "estimate ok", dryWithGas({ ...empty, attributes: base("d90"), expires: ExpirationTime.fromDays(90) }))

// --- Payload size
for (const n of [1024, 65536, 128000, 130144, 131072, 131073]) {
  await step(`dry create payload ${n} bytes`, n > 131072 ? "SDK rejects (>128 KiB)" : "estimate ok or ingress limit", dryWithGas({ payload: new Uint8Array(n).fill(65), contentType: "application/octet-stream", attributes: base(`payload-${n}`), expires: ExpirationTime.fromHours(1) }))
}

// --- Attribute count, string size, names, numeric types
const many = (n) => { const a = {}; for (let i = 0; i < n; i++) a[`a${String(i).padStart(2, "0")}`] = str("x"); return a }
await step("dry create 30 user attributes", "estimate ok", dryWithGas({ ...empty, attributes: many(30), expires: ExpirationTime.fromHours(1) }))
await step("dry create 31 user attributes", "rejected", dryWithGas({ ...empty, attributes: many(31), expires: ExpirationTime.fromHours(1) }))
await step("str value 128 bytes (ASCII)", "SDK accepts", async () => ({ ok: !!str("x".repeat(128)) }))
await step("str value 129 bytes (ASCII)", "SDK rejects", async () => ({ ok: !!str("x".repeat(129)) }))
await step("str value 43 Devanagari chars (129 bytes)", "SDK rejects (bytes, not chars)", async () => ({ bytes: Buffer.byteLength("क".repeat(43)), ok: !!str("क".repeat(43)) }))
await step("dry create uppercase attribute name shopId", "node rejects Ident32InvalidByte", dryWithGas({ ...empty, attributes: { ...base("upper"), shopId: str("SYN-BR-0001") }, expires: ExpirationTime.fromHours(1) }))
await step("dry create dotted attribute name tolmol.shop_id", "accepted (dots allowed)", dryWithGas({ ...empty, attributes: { ...base("dotted"), "tolmol.shop_id": str("SYN-BR-0001") }, expires: ExpirationTime.fromHours(1) }))
await step("dry create 32-char attribute name", "accepted", dryWithGas({ ...empty, attributes: { ...base("n32"), ["a".repeat(32)]: str("x") }, expires: ExpirationTime.fromHours(1) }))
await step("dry create 33-char attribute name", "rejected", dryWithGas({ ...empty, attributes: { ...base("n33"), ["a".repeat(33)]: str("x") }, expires: ExpirationTime.fromHours(1) }))
await step("i32(1.5)", "SDK rejects float", async () => ({ ok: !!i32(1.5) }))
await step("bare Date.now() as attribute", "rejected (i32 overflow)", dryWithGas({ ...empty, attributes: { ...base("bare-ms"), reported_at: Date.now() }, expires: ExpirationTime.fromHours(1) }))
await step("u64(Date.now())", "accepted", async () => ({ ok: !!u64(BigInt(Date.now())) }))
console.log("RESULTS_FILE", file)
