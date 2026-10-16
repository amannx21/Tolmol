import { describe, expect, it } from "vitest"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import type { RawEntity } from "../src/attributes.js"
import {
  addressOfPublicKey,
  decryptNote,
  encodeEnvelope,
  encryptNote,
  noteAttributes,
  NOTE_MAX_CHARS,
  officeKeyAttributes,
  parseEnvelope,
  parseNote,
  parseOfficeKey,
  publicKeyOf,
  validNotes,
  validOfficeKeys,
  type OfficeKey,
} from "../src/notes.js"
import type { Attestation } from "../src/verify.js"

const k = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`
const official = privateKeyToAccount(generatePrivateKey())
const officialPk = generatePrivateKey()
const officialAcct = privateKeyToAccount(officialPk)
const report = { key: k(42), shopId: "SYN-BR-0042", state: "BR", district: "gaya", creator: official.address }
const to = officialAcct.address.toLowerCase() as `0x${string}`
const attest = (device: string, shopId: string): [string, Attestation] => [device.toLowerCase(), { key: k(9), creator: k(1).slice(0, 42), device, state: "BR", shopId, cardTag: k(8), method: "test_card", role: "official", verifiedOn: 0n, synthetic: true, createdAt: 1n, expiresAt: 9n } as unknown as Attestation]
const asEntity = (attrs: Record<string, unknown>, creator: string, payload: Uint8Array = new Uint8Array()): RawEntity =>
  ({ key: k(7), creator: creator as `0x${string}`, createdAt: 10n, payload, attributes: attrs as RawEntity["attributes"] })

describe("private notes to the official", () => {
  it("only the official's key can read a note, and only for that report and that official", () => {
    const env = encryptNote("The dealer's son threatened me when I asked for the full 35 kg.", publicKeyOf(officialPk), report.key, to)
    expect(decryptNote(env, officialPk, report.key, to)).toBe("The dealer's son threatened me when I asked for the full 35 kg.")
    expect(() => decryptNote(env, generatePrivateKey(), report.key, to)).toThrow()
    expect(() => decryptNote(env, officialPk, k(43), to)).toThrow() // moved to another report
    expect(() => decryptNote(env, officialPk, report.key, k(1).slice(0, 42) as `0x${string}`)).toThrow() // relabelled to another official
  })
  it("the payload is ciphertext only, in exactly the envelope shape", () => {
    const env = encryptNote("कोटेदार ने धमकी दी", publicKeyOf(officialPk), report.key, to)
    const bytes = encodeEnvelope(env)
    expect(new TextDecoder().decode(bytes)).not.toContain("धमकी")
    expect(parseEnvelope(bytes)).toEqual(env)
    expect(parseEnvelope(new TextEncoder().encode(JSON.stringify({ ...env, name: "x" })))).toBeNull()
    expect(parseEnvelope(new TextEncoder().encode("plain text"))).toBeNull()
    expect(() => encryptNote("x".repeat(NOTE_MAX_CHARS + 1), publicKeyOf(officialPk), report.key, to)).toThrow()
  })
  it("an office key counts only if it belongs to its creator, a verified official of that district", () => {
    const pub = publicKeyOf(officialPk)
    expect(addressOfPublicKey(pub)).toBe(to)
    const officials = new Map([attest(officialAcct.address, "SYN-BR-0002")])
    const districts = new Map([["SYN-BR-0002", "gaya"]])
    const good: OfficeKey = { key: k(1), creator: officialAcct.address, pubkey: pub, state: "BR", district: "gaya", createdAt: 5n }
    const stolen: OfficeKey = { ...good, key: k(2), creator: official.address } // someone else publishing the official's key
    const elsewhere: OfficeKey = { ...good, key: k(3), district: "patna" }
    const m = validOfficeKeys([good, stolen, elsewhere], officials, districts)
    expect(m.get("gaya")?.map((x) => x.key)).toEqual([k(1)])
    expect(m.get("patna")).toBeUndefined()
  })
  it("entities round-trip, and a note counts only from the report's own creator", () => {
    const keyAttrs = officeKeyAttributes({ pubkey: publicKeyOf(officialPk), state: "BR", district: "gaya", synthetic: true, atMs: 1n })
    expect(parseOfficeKey(asEntity(keyAttrs, officialAcct.address))?.district).toBe("gaya")
    const env = encryptNote("note", publicKeyOf(officialPk), report.key, to)
    const n = parseNote(asEntity(noteAttributes(report, to, { synthetic: true, atMs: 1n }), report.creator, encodeEnvelope(env)))
    expect(n?.reportKey).toBe(report.key)
    expect(parseNote(asEntity(noteAttributes(report, to, { synthetic: true, atMs: 1n }), report.creator))).toBeNull() // no ciphertext
    const reports = new Map([[report.key.toLowerCase(), { creator: report.creator }]])
    expect(validNotes([n!], reports)).toHaveLength(1)
    expect(validNotes([{ ...n!, creator: officialAcct.address }], reports)).toHaveLength(0)
  })
})
