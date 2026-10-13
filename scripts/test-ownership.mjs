// Phase 0: who can delete / transfer, and what changes after a transfer. Usage: node --env-file=.env scripts/test-ownership.mjs
import { ExpirationTime } from "@arkiv-network/sdk"
import { str, bool } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import { pub, wallet, recorder } from "./lib/testkit.mjs"

const { step, file } = recorder("ownership")
const R = wallet("REPORTER"), A = wallet("WITNESS_A"), B = wallet("WITNESS_B")
const read = async (k) => { const e = await pub.getEntity(k); return { owner: e.owner, creator: e.creator, expiresAt: e.expiresAt } }
let k
await step("reporter creates T (readonly + permissionlessExtension, 2h)", "ok", async () => {
  const r = await R.createEntity({ payload: new Uint8Array(), contentType: "application/octet-stream",
    attributes: { project: str("tolmol"), type: str("tolmol.test"), synthetic: bool(true), test: str("ownership") },
    expires: ExpirationTime.fromHours(2), flags: { readonly: true, permissionlessExtension: true } })
  k = r.entityKey; return { entityKey: k, txHash: r.txHash, ...(await read(k)) }
})
await step("witness A deletes T", "rejected NotOwner", async () => ({ txHash: (await A.deleteEntity({ entityKey: k })).txHash }))
await step("witness A transfers T to itself", "rejected NotOwner", async () => ({ txHash: (await A.changeOwnership({ entityKey: k, newOwner: A.account.address })).txHash }))
await step("reporter transfers readonly T to witness A", "ok (readonly does not block transfer)", async () => {
  const r = await R.changeOwnership({ entityKey: k, newOwner: A.account.address }); return { txHash: r.txHash, ...(await read(k)) }
})
await step("query createdBy(reporter) still finds T; ownedBy(reporter) does not", "1 and 0", async () => {
  const w = [eq("project", str("tolmol")), eq("test", str("ownership"))]
  const c = await pub.select({ key: true }).where(w).createdBy(R.account.address).fetch()
  const o = await pub.select({ key: true }).where(w).ownedBy(R.account.address).fetch()
  const oa = await pub.select({ key: true }).where(w).ownedBy(A.account.address).fetch()
  return { createdByReporter: c.entities.filter((e) => e.key === k).length, ownedByReporter: o.entities.filter((e) => e.key === k).length, ownedByWitnessA: oa.entities.filter((e) => e.key === k).length }
})
await step("reporter (now non-owner) extends T to 3h", "ok (permissionless)", async () => { const r = await R.extendEntity({ entityKey: k, expires: ExpirationTime.fromHours(3) }); return { txHash: r.txHash, expiresAt: r.expiresAt } })
await step("witness B extends T to 4h after transfer", "ok", async () => { const r = await B.extendEntity({ entityKey: k, expires: ExpirationTime.fromHours(4) }); return { txHash: r.txHash, expiresAt: r.expiresAt } })
await step("reporter deletes T after transfer", "rejected NotOwner", async () => ({ txHash: (await R.deleteEntity({ entityKey: k })).txHash }))
await step("witness A (new owner) deletes readonly T", "ok (readonly does not block delete)", async () => ({ txHash: (await A.deleteEntity({ entityKey: k })).txHash }))
await step("getEntity(T) after delete", "NoEntityFoundError", async () => read(k))
await step("witness B extends deleted T", "rejected EntityNotFound", async () => ({ txHash: (await B.extendEntity({ entityKey: k, expires: ExpirationTime.fromHours(5) })).txHash }))
console.log("RESULTS_FILE", file)
