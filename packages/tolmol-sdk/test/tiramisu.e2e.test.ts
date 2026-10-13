// End-to-end against the real Tiramisu testnet. No mocks.
// Run: npm run test:e2e   (needs REPORTER/WITNESS_A/WITNESS_B keys in .env and a little test GLM in each)
import { privateKeyToAccount } from "viem/accounts"
import { describe, expect, it } from "vitest"
import {
  BLOCKS_PER_DAY,
  BURN_ADDRESS,
  corroborate,
  currentMonth,
  DuplicateError,
  httpReader,
  reportWitnesses,
  SelfWitnessError,
  shopReports,
  submitReport,
  validWitnesses,
  writerFor,
} from "../src/index.js"

const keys = ["REPORTER", "WITNESS_A", "WITNESS_B"].map((r) => process.env[`${r}_PRIVATE_KEY`])
const ready = keys.every((k) => /^0x[0-9a-fA-F]{64}$/.test(k ?? ""))

describe.skipIf(!ready)("Tolmol on Tiramisu (live)", () => {
  const reader = httpReader()
  const [reporter, witnessA, witnessB] = keys.map((k) => writerFor(privateKeyToAccount(k as `0x${string}`)))
  // A throwaway synthetic shop in test state "ZZ", so each run starts clean.
  const shop = { shopId: `SYN-ZZ-${String(Math.floor(Math.random() * 10_000)).padStart(4, "0")}`, state: "ZZ", district: "e2e-test" }
  const month = currentMonth()
  let reportKey: `0x${string}`

  it("files a report that nobody can delete", async () => {
    const res = await submitReport(reader, reporter!, { shopId: shop.shopId, month, item: "rice", entitledG: 25_000, receivedG: 21_000 }, shop, { synthetic: true })
    reportKey = res.entityKey
    const got = await shopReports(reader, shop.shopId, month)
    expect(got.items).toHaveLength(1)
    const r = got.items[0]!
    expect(r.key.toLowerCase()).toBe(reportKey.toLowerCase())
    expect(r.creator.toLowerCase()).toBe(reporter!.account.address.toLowerCase())
    expect(r.owner.toLowerCase()).toBe(BURN_ADDRESS.toLowerCase())
    expect(r.shortfallBp).toBe(1600)
    expect(r.expiresAt - r.createdAt).toBe(90n * BLOCKS_PER_DAY)
    const raw = await reader.getEntity(reportKey)
    expect(raw.creationFlags.readonly).toBe(true)
    expect(raw.creationFlags.permissionlessExtension).toBe(true)
  })

  it("refuses a duplicate report from the same wallet", async () => {
    await expect(
      submitReport(reader, reporter!, { shopId: shop.shopId, month, item: "rice", entitledG: 25_000, receivedG: 0 }, shop, { synthetic: true }),
    ).rejects.toBeInstanceOf(DuplicateError)
  })

  it("refuses the reporter corroborating their own report", async () => {
    await expect(corroborate(reader, reporter!, reportKey, { synthetic: true })).rejects.toBeInstanceOf(SelfWitnessError)
  })

  it("first witness: corroborates without extending", async () => {
    const res = await corroborate(reader, witnessA!, reportKey, { synthetic: true })
    expect(res.witnessesAfter).toBe(1)
    expect(res.extendedTo).toBeNull()
    await expect(corroborate(reader, witnessA!, reportKey, { synthetic: true })).rejects.toBeInstanceOf(DuplicateError)
  })

  it("second witness: corroborates and extends the report and the first witness in the same batch", async () => {
    const before = (await shopReports(reader, shop.shopId, month)).items[0]!
    const res = await corroborate(reader, witnessB!, reportKey, { synthetic: true })
    expect(res.witnessesAfter).toBe(2)
    expect(res.extendedTo).not.toBeNull()
    const after = (await shopReports(reader, shop.shopId, month)).items[0]!
    expect(after.expiresAt).toBe(res.extendedTo)
    expect(after.expiresAt).toBeGreaterThan(before.expiresAt)
    const ws = await reportWitnesses(reader, reportKey)
    const valid = validWitnesses(after, ws.items)
    expect(valid).toHaveLength(2)
    for (const w of valid) {
      expect(w.expiresAt).toBe(res.extendedTo)
      expect(w.owner.toLowerCase()).toBe(BURN_ADDRESS.toLowerCase())
    }
  })

  it("can read the shop as it was before the witnesses (atBlock)", async () => {
    const r = (await shopReports(reader, shop.shopId, month)).items[0]!
    const asOf = await shopReports(reader, shop.shopId, month, { atBlock: r.createdAt })
    expect(asOf.items).toHaveLength(1)
    expect(asOf.items[0]!.expiresAt).toBe(r.createdAt + 90n * BLOCKS_PER_DAY)
    const ws = await reportWitnesses(reader, reportKey, { atBlock: r.createdAt })
    expect(ws.items).toHaveLength(0)
  })
})
