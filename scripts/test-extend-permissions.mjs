// Who may extend (and patch) an Arkiv entity? Tests creation flags on Tiramisu with 3 distinct wallets.
// Usage: node --env-file=.env scripts/test-extend-permissions.mjs
// Writes only small synthetic test entities (type tolmol.test, a few hours of life). Never logs keys.
import { createPublicClient, createWalletClient, ExpirationTime, ENTITY_EVENTS_ABI } from "@arkiv-network/sdk"
import { str, u64, bool } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { decodeEventLog, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const acct = (name) => {
  const pk = process.env[`${name}_PRIVATE_KEY`]
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk ?? "")) throw new Error(`${name}_PRIVATE_KEY missing or malformed`)
  return privateKeyToAccount(pk)
}
const pub = createPublicClient({ chain: tiramisu, transport: http() })
const wallets = Object.fromEntries(["REPORTER", "WITNESS_A", "WITNESS_B"].map((n) => {
  const account = acct(n)
  return [n, createWalletClient({ chain: tiramisu, transport: http(), account })]
}))
const results = []
const j = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))

async function extendedEvents(txHash) {
  const r = await pub.getTransactionReceipt({ hash: txHash })
  return r.logs.flatMap((l) => {
    try { const e = decodeEventLog({ abi: ENTITY_EVENTS_ABI, data: l.data, topics: l.topics }); return e.eventName === "ExpiryExtended" ? [e.args] : [] }
    catch { return [] }
  }).map((a) => ({ eventOwner: a.owner, eventExpiresAt: a.expiresAt, txFrom: r.from, block: r.blockNumber }))
}
function errSummary(e) {
  const chain = []; let c = e
  for (let i = 0; c && i < 8; i++) { chain.push(`${c.name}: ${String(c.shortMessage ?? c.message).split("\n")[0].slice(0, 220)}`); c = c.cause }
  return { errorClass: e?.constructor?.name, txHash: e?.txHash, chain }
}
async function step(label, expect, fn) {
  const at = new Date().toISOString()
  try {
    const out = await fn()
    results.push({ label, at, expect, outcome: "success", ...out })
  } catch (e) {
    results.push({ label, at, expect, outcome: "rejected", ...errSummary(e) })
  }
  console.log(j(results.at(-1)))
}
const read = async (k) => { const e = await pub.getEntity(k); return { owner: e.owner, creator: e.creator, expiresAt: e.expiresAt, flags: e.creationFlags } }

// 0. Reporter creates two entities atomically: one default, one readonly + permissionlessExtension.
const base = { project: str("tolmol"), type: str("tolmol.test"), synthetic: bool(true), test: str("extend-permissions") }
const now = BigInt(Date.now())
let plainKey, openKey
await step("0 reporter batch-creates PLAIN (no flags) and OPEN (readonly+permissionlessExtension)", "success", async () => {
  const r = await wallets.REPORTER.executeBatch({ creates: [
    { payload: new Uint8Array(), contentType: "application/octet-stream", attributes: { ...base, variant: str("plain"), reported_at: u64(now) }, expires: ExpirationTime.fromHours(2) },
    { payload: new Uint8Array(), contentType: "application/octet-stream", attributes: { ...base, variant: str("open"), reported_at: u64(now) }, expires: ExpirationTime.fromHours(2), flags: { readonly: true, permissionlessExtension: true } },
  ] })
  ;[plainKey, openKey] = r.createdEntities
  return { txHash: r.txHash, plainKey, openKey, plain: await read(plainKey), open: await read(openKey) }
})
if (!plainKey || !openKey) { console.log("setup failed"); process.exit(1) }

await step("1 witness A extends PLAIN to 4h", "rejected NotOwner", async () => {
  const r = await wallets.WITNESS_A.extendEntity({ entityKey: plainKey, expires: ExpirationTime.fromHours(4) })
  return { txHash: r.txHash, expiresAt: r.expiresAt, after: await read(plainKey) }
})
await step("2 witness A extends OPEN to 4h", "success, owner unchanged", async () => {
  const r = await wallets.WITNESS_A.extendEntity({ entityKey: openKey, expires: ExpirationTime.fromHours(4) })
  return { txHash: r.txHash, expiresAt: r.expiresAt, after: await read(openKey), events: await extendedEvents(r.txHash) }
})
await step("3 witness B extends OPEN to 3h (earlier than current)", "rejected ExpiryNotExtended", async () => {
  const r = await wallets.WITNESS_B.extendEntity({ entityKey: openKey, expires: ExpirationTime.fromHours(3) })
  return { txHash: r.txHash, expiresAt: r.expiresAt, after: await read(openKey) }
})
await step("4 witness B extends OPEN to 6h", "success, owner unchanged", async () => {
  const r = await wallets.WITNESS_B.extendEntity({ entityKey: openKey, expires: ExpirationTime.fromHours(6) })
  return { txHash: r.txHash, expiresAt: r.expiresAt, after: await read(openKey), events: await extendedEvents(r.txHash) }
})
await step("5 witness A patches OPEN", "rejected (NotOwner or ReadOnlyEntity)", async () => {
  const r = await wallets.WITNESS_A.patchEntity({ entityKey: openKey, set: { variant: str("tampered") } })
  return { txHash: r.txHash }
})
await step("6 reporter (owner) patches OPEN", "rejected ReadOnlyEntity", async () => {
  const r = await wallets.REPORTER.patchEntity({ entityKey: openKey, set: { variant: str("tampered") } })
  return { txHash: r.txHash }
})
await step("7 reporter (owner) extends PLAIN to 4h", "success", async () => {
  const r = await wallets.REPORTER.extendEntity({ entityKey: plainKey, expires: ExpirationTime.fromHours(4) })
  return { txHash: r.txHash, expiresAt: r.expiresAt, after: await read(plainKey), events: await extendedEvents(r.txHash) }
})
const finalOpen = await pub.getEntity(openKey)
console.log("FINAL_OPEN", j({ variant: finalOpen.attributes.variant, owner: finalOpen.owner, creator: finalOpen.creator, expiresAt: finalOpen.expiresAt }))
console.log("RESULTS_JSON", j(results))
