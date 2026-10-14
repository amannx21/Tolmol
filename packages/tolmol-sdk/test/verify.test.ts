import { describe, expect, it } from "vitest"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import type { RawEntity } from "../src/attributes.js"
import {
  attestationAttributes,
  cardMessage,
  cardTag,
  decodeCard,
  encodeCard,
  parseAttestation,
  parseCard,
  verifiedDevices,
  verifyCard,
  type Attestation,
  type TestCard,
  type Verifier,
} from "../src/verify.js"

const issuer = privateKeyToAccount(generatePrivateKey())
const unsigned = { v: 1 as const, state: "BR", shopId: "SYN-BR-0042", type: "PHH" as const, serial: "0123456789abcdef0123456789abcdef" }
const makeCard = async (over: Partial<typeof unsigned> = {}): Promise<TestCard> => {
  const c = { ...unsigned, ...over }
  return { ...c, sig: await issuer.signMessage({ message: cardMessage(c) }) }
}
const dev = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`
const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`

describe("test ration cards", () => {
  it("round-trips through the QR/link encoding", async () => {
    const c = await makeCard()
    expect(decodeCard(encodeCard(c))).toEqual(c)
  })
  it("accepts the issuer's signature and rejects a changed card or another signer", async () => {
    const c = await makeCard()
    expect(await verifyCard(c, issuer.address)).toBe(true)
    expect(await verifyCard({ ...c, shopId: "SYN-BR-0002" }, issuer.address)).toBe(false)
    expect(await verifyCard(c, privateKeyToAccount(generatePrivateKey()).address)).toBe(false)
  })
  it("rejects malformed cards: real-looking shop, wrong state prefix, bad serial", async () => {
    const c = await makeCard()
    expect(parseCard({ ...c, shopId: "BR-0042" })).toBeNull()
    expect(parseCard({ ...c, state: "UP" })).toBeNull()
    expect(parseCard({ ...c, serial: "xyz" })).toBeNull()
    expect(decodeCard("not-a-card")).toBeNull()
  })
  it("fingerprints a serial with a secret, so the serial itself never goes on chain", async () => {
    const a = await cardTag("secret-1", unsigned.serial)
    expect(a).toMatch(/^0x[0-9a-f]{64}$/)
    expect(await cardTag("secret-1", unsigned.serial)).toBe(a)
    expect(await cardTag("secret-2", unsigned.serial)).not.toBe(a)
    expect(a).not.toContain(unsigned.serial)
  })
})

describe("attestations", () => {
  it("parse back from their attributes, with no card data", () => {
    const attrs = attestationAttributes({ device: dev(7), state: "BR", shopId: "SYN-BR-0042", cardTag: k(99), method: "test_card", verifiedOnMs: 1_791_900_000_123n, synthetic: true })
    expect(Object.keys(attrs).sort()).toEqual(["card_tag", "device", "method", "project", "schema_version", "shop_id", "state", "synthetic", "type", "verified_on"])
    const raw: RawEntity = {
      key: k(1),
      creator: dev(500),
      createdAt: 10n,
      expiresAt: 99n,
      attributes: Object.fromEntries(Object.entries(attrs).map(([n, v]) => [n, v as { type: string; value: unknown }])),
    }
    const a = parseAttestation(raw)
    expect(a?.device).toBe(dev(7))
    expect(a?.verifiedOn).toBe(1_791_849_600_000n) // rounded to the day
  })

  const v = (n: number): Verifier => ({ key: k(1000 + n), creator: dev(1), verifier: dev(500 + n), createdAt: 1n, expiresAt: 9n })
  const att = (n: number, over: Partial<Attestation>): Attestation => ({
    key: k(n), creator: dev(500), device: dev(n), state: "BR", shopId: "SYN-BR-0042", cardTag: k(9000 + n), method: "test_card",
    verifiedOn: 0n, synthetic: true, createdAt: BigInt(n), expiresAt: 99n, ...over,
  })

  it("count only from verifiers named by the registry", () => {
    const m = verifiedDevices([v(0)], [att(1, {}), att(2, { creator: dev(666) })])
    expect([...m.keys()]).toEqual([dev(1)])
  })
  it("one card verifies one phone (earliest wins), and one phone counts once", () => {
    const m = verifiedDevices([v(0)], [att(2, { cardTag: k(5) }), att(1, { cardTag: k(5) }), att(3, { device: dev(1) })])
    expect(m.get(dev(1))?.key).toBe(k(1))
    expect(m.has(dev(2))).toBe(false)
    expect(m.size).toBe(1)
  })
})
