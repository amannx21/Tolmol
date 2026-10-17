// Private notes to the district official. What a person cannot say in public ("the dealer's son threatened me") goes
// to the one official who acts on it, and to nobody else, while still living on Arkiv where nobody can delete it.
//
// 1. A verified official turns on private notes once: their phone publishes its secp256k1 public key as a
//    `tolmol.officekey` entity. Anyone can check that key: it must hash to the entity's $creator, and that wallet must
//    be a verified official of the district (validOfficeKeys). Nobody can slip in their own key.
// 2. A reporter writes a note about their own report. The phone encrypts it to that key (ECIES: an ephemeral
//    secp256k1 key, ECDH, HKDF-SHA256, AES-256-GCM, with the report key and the official's address as associated
//    data, so a note cannot be moved to another report or another official) and seals it as a `tolmol.note`
//    entity: readonly and handed to 0x…dEaD in the same batch, created by the key that wrote the report.
// 3. The explorer shows only ciphertext. The official's phone decrypts it, and counts it only if its $creator is the
//    report's own creator (validNotes), so a note always comes from the person who made the report.
// Uses the audited @noble libraries that viem itself is built on. Demo notes are synthetic test text.
import { ExpirationTime } from "@arkiv-network/sdk"
import type { AttributeInputs } from "@arkiv-network/sdk"
import { bool, i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import { gcm } from "@noble/ciphers/aes"
import { secp256k1 } from "@noble/curves/secp256k1"
import { hkdf } from "@noble/hashes/hkdf"
import { sha256 } from "@noble/hashes/sha2"
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from "@noble/hashes/utils"
import { publicKeyToAddress } from "viem/accounts"
import { BURN_ADDRESS, PROJECT, SCHEMA_VERSION } from "./constants.js"
import type { RawEntity } from "./attributes.js"
import type { Report } from "./model.js"
import { dayStartMs, DISTRICT_RE, SHOP_ID_RE, STATE_RE } from "./model.js"
import type { Reader, ReadOptions, ReadResult } from "./queries.js"
import type { Attestation } from "./verify.js"
import type { Writer } from "./writes.js"

type Hex = `0x${string}`
const lc = (x: string) => x.toLowerCase()

export const OFFICEKEY_TYPE = "tolmol.officekey" as const
export const NOTE_TYPE = "tolmol.note" as const
export const NOTE_MAX_CHARS = 500
export const NOTE_ALG = "ecies-secp256k1-hkdf-sha256-aes-256-gcm" as const
/** What the note's payload holds: everything a reader needs to decrypt it with the right private key, nothing else. */
export type NoteEnvelope = { v: 1; alg: typeof NOTE_ALG; epk: Hex; iv: Hex; ct: Hex }

export type OfficeKey = { key: Hex; creator: Hex; pubkey: Hex; state: string; district: string; createdAt: bigint }
export type Note = { key: Hex; creator: Hex; reportKey: Hex; shopId: string; state: string; district: string; to: Hex; envelope: NoteEnvelope; createdAt: bigint }

// ------------------------------------------------------------------ crypto
const PUBKEY_RE = /^0x0[23][0-9a-f]{64}$/
const hex = (b: Uint8Array) => `0x${bytesToHex(b)}` as Hex
const unhex = (h: string) => hexToBytes(h.replace(/^0x/, ""))
const aad = (reportKey: string, to: string) => utf8ToBytes(`tolmol.note|${lc(reportKey)}|${lc(to)}`)
const noteKey = (shared: Uint8Array, epk: Uint8Array) => hkdf(sha256, shared.slice(1), epk, utf8ToBytes("tolmol-note-v1"), 32)

/** The compressed public key of a private key, as published in `tolmol.officekey`. */
export const publicKeyOf = (privateKey: Hex): Hex => hex(secp256k1.getPublicKey(unhex(privateKey), true))
/** The wallet address a compressed public key belongs to (so anyone can check a published key against its $creator). */
export function addressOfPublicKey(pubkey: string): Hex {
  const full = secp256k1.ProjectivePoint.fromHex(pubkey.replace(/^0x/, "")).toRawBytes(false)
  return lc(publicKeyToAddress(hex(full))) as Hex
}

/**
 * True if the text holds something that looks like a phone, Aadhaar or card number: a run of 10 or more digits
 * (spaces, dots and dashes between them ignored). The ciphertext stays in Arkiv's history even after the note expires,
 * so identifying numbers are refused, not just discouraged.
 */
// (No lookbehind in these patterns: iPhones before iOS 16.4 cannot parse it, and one such pattern stops the whole app.)
export const noteHasPersonalNumber = (text: string): boolean => /\d{10,}/.test(text.replace(/(\d)[\s.\-–]+(?=\d)/g, "$1"))

/**
 * Encrypts a note to an official's public key, bound to one report and one official. Standard ECIES (SEC 1 v2, s.5.1)
 * with an ephemeral secp256k1 key, the x-coordinate of the ECDH point through HKDF-SHA256 (salt: the ephemeral public
 * key, info: "tolmol-note-v1"), and AES-256-GCM with a 96-bit nonce; the associated data binds the report and the
 * official. `fixed` exists only for the known-answer test.
 */
export function encryptNote(text: string, recipientPubkey: Hex, reportKey: Hex, to: Hex, fixed?: { ephemeral: Uint8Array; iv: Uint8Array }): NoteEnvelope {
  const clean = text.trim()
  if (!clean) throw new Error("the note is empty")
  if ([...clean].length > NOTE_MAX_CHARS) throw new Error(`a note is at most ${NOTE_MAX_CHARS} characters`)
  if (noteHasPersonalNumber(clean)) throw new Error("a note must not contain a phone, Aadhaar or card number")
  const ephemeral = fixed?.ephemeral ?? secp256k1.utils.randomPrivateKey()
  const epk = secp256k1.getPublicKey(ephemeral, true)
  const k = noteKey(secp256k1.getSharedSecret(ephemeral, unhex(recipientPubkey), true), epk)
  const iv = fixed?.iv ?? randomBytes(12)
  const ct = gcm(k, iv, aad(reportKey, to)).encrypt(utf8ToBytes(clean))
  return { v: 1, alg: NOTE_ALG, epk: hex(epk), iv: hex(iv), ct: hex(ct) }
}

/** Decrypts with the official's private key. Throws if the key, the report or the official do not match. */
export function decryptNote(env: NoteEnvelope, privateKey: Hex, reportKey: Hex, to: Hex): string {
  const epk = unhex(env.epk)
  const k = noteKey(secp256k1.getSharedSecret(unhex(privateKey), epk, true), epk)
  return new TextDecoder().decode(gcm(k, unhex(env.iv), aad(reportKey, to)).decrypt(unhex(env.ct)))
}

export const encodeEnvelope = (e: NoteEnvelope) => utf8ToBytes(JSON.stringify(e))
/** Parses a note payload; null unless it is exactly an envelope (no extra fields, sane sizes). */
export function parseEnvelope(payload: Uint8Array | undefined): NoteEnvelope | null {
  if (!payload || payload.length === 0 || payload.length > 4096) return null
  try {
    const j = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>
    if (Object.keys(j).sort().join(",") !== "alg,ct,epk,iv,v" || j.v !== 1 || j.alg !== NOTE_ALG) return null
    if (typeof j.epk !== "string" || !PUBKEY_RE.test(j.epk)) return null
    if (typeof j.iv !== "string" || !/^0x[0-9a-f]{24}$/.test(j.iv)) return null
    if (typeof j.ct !== "string" || !/^0x[0-9a-f]{34,4000}$/.test(j.ct) || j.ct.length % 2 !== 0) return null
    return { v: 1, alg: NOTE_ALG, epk: j.epk as Hex, iv: j.iv as Hex, ct: j.ct as Hex }
  } catch {
    return null
  }
}

// ------------------------------------------------------------------ entities
const val = (e: RawEntity, n: string, t: string) => {
  const a = e.attributes?.[n]
  return a && a.type === t ? a.value : undefined
}
const common = (e: RawEntity, type: string) =>
  val(e, "project", "str") === PROJECT && val(e, "type", "str") === type && val(e, "schema_version", "i32") === SCHEMA_VERSION && typeof e.key === "string" && typeof e.creator === "string" && e.createdAt !== undefined

export function officeKeyAttributes(o: { pubkey: Hex; state: string; district: string; synthetic: boolean; atMs: bigint }): AttributeInputs {
  if (!PUBKEY_RE.test(o.pubkey) || !STATE_RE.test(o.state) || !DISTRICT_RE.test(o.district)) throw new Error("invalid office key")
  return { project: str(PROJECT), type: str(OFFICEKEY_TYPE), schema_version: i32(SCHEMA_VERSION), pubkey: str(o.pubkey), state: str(o.state), district: str(o.district), reported_at: u64(dayStartMs(o.atMs)), synthetic: bool(o.synthetic) }
}
export function parseOfficeKey(e: RawEntity): OfficeKey | null {
  if (!common(e, OFFICEKEY_TYPE)) return null
  const pubkey = val(e, "pubkey", "str"), state = val(e, "state", "str"), district = val(e, "district", "str")
  if (typeof pubkey !== "string" || !PUBKEY_RE.test(pubkey) || typeof state !== "string" || !STATE_RE.test(state) || typeof district !== "string" || !DISTRICT_RE.test(district)) return null
  return { key: e.key as Hex, creator: e.creator as Hex, pubkey: pubkey as Hex, state, district, createdAt: e.createdAt! }
}

export function noteAttributes(report: Pick<Report, "key" | "shopId" | "state" | "district">, to: Hex, o: { synthetic: boolean; atMs: bigint }): AttributeInputs {
  if (!SHOP_ID_RE.test(report.shopId) || !STATE_RE.test(report.state) || !DISTRICT_RE.test(report.district) || !/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error("invalid note")
  return {
    project: str(PROJECT), type: str(NOTE_TYPE), schema_version: i32(SCHEMA_VERSION), report_key: key(report.key), shop_id: str(report.shopId),
    state: str(report.state), district: str(report.district), to: str(lc(to)), reported_at: u64(dayStartMs(o.atMs)), synthetic: bool(o.synthetic),
  }
}
export function parseNote(e: RawEntity): Note | null {
  if (!common(e, NOTE_TYPE)) return null
  const reportKey = val(e, "report_key", "key"), shopId = val(e, "shop_id", "str"), state = val(e, "state", "str"), district = val(e, "district", "str"), to = val(e, "to", "str")
  if (typeof reportKey !== "string" || typeof shopId !== "string" || !SHOP_ID_RE.test(shopId) || typeof state !== "string" || !STATE_RE.test(state)) return null
  if (typeof district !== "string" || !DISTRICT_RE.test(district) || typeof to !== "string" || !/^0x[0-9a-f]{40}$/.test(to)) return null
  const envelope = parseEnvelope(e.payload)
  if (!envelope) return null
  return { key: e.key as Hex, creator: e.creator as Hex, reportKey: lc(reportKey) as Hex, shopId, state, district, to: to as Hex, envelope, createdAt: e.createdAt! }
}

// ------------------------------------------------------------------ trust rules
/**
 * Office keys that count, by district: the key must belong to its $creator (so nobody can publish someone else's key)
 * and the creator must be a verified official whose ID's outlet is in that district. Newest first.
 */
export function validOfficeKeys(keys: readonly OfficeKey[], officials: ReadonlyMap<string, Attestation>, shopDistrict: ReadonlyMap<string, string>): Map<string, OfficeKey[]> {
  const out = new Map<string, OfficeKey[]>()
  for (const k of keys) {
    let owner: string
    try {
      owner = addressOfPublicKey(k.pubkey)
    } catch {
      continue
    }
    if (owner !== lc(k.creator)) continue
    const off = officials.get(lc(k.creator))
    if (!off || shopDistrict.get(off.shopId) !== k.district) continue
    out.set(k.district, [...(out.get(k.district) ?? []), k])
  }
  for (const list of out.values()) list.sort((a, b) => (a.createdAt === b.createdAt ? 0 : a.createdAt > b.createdAt ? -1 : 1))
  return out
}
/** Notes that count: written by the key that created the report they are about. */
export function validNotes(notes: readonly Note[], reports: ReadonlyMap<string, Pick<Report, "creator">>): Note[] {
  return notes.filter((n) => {
    const r = reports.get(lc(n.reportKey))
    return !!r && lc(r.creator) === lc(n.creator)
  })
}

// ------------------------------------------------------------------ reads
async function walk<T>(client: Reader, where: ReturnType<typeof eq>[], parse: (e: RawEntity) => T | null, payload: boolean, opts: ReadOptions = {}): Promise<ReadResult<T>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  let page = await client.select({ key: true, creator: true, createdAt: true, attributes: true, payload }).where(where).limit(200).atBlock(atBlock).fetch()
  const items: T[] = []
  let dropped = 0
  for (let n = 0; ; n++) {
    for (const e of page.entities) {
      const x = parse(e as RawEntity)
      if (x) items.push(x)
      else dropped++
    }
    if (!page.hasNextPage() || n + 1 >= (opts.maxPages ?? 25)) break
    page = await page.next()
  }
  return { items, atBlock, dropped }
}
/** Q26: office keys published for a district. */
export const districtOfficeKeys = (c: Reader, district: string, o: ReadOptions = {}) =>
  walk(c, [eq("project", str(PROJECT)), eq("type", str(OFFICEKEY_TYPE)), eq("district", str(district))], parseOfficeKey, false, o)
/** Q27: notes about one outlet's reports addressed to one official (the payload is ciphertext). */
export const shopNotesTo = (c: Reader, shopId: string, to: string, o: ReadOptions = {}) =>
  walk(c, [eq("project", str(PROJECT)), eq("type", str(NOTE_TYPE)), eq("shop_id", str(shopId)), eq("to", str(lc(to)))], parseNote, true, o)
/** Q28: notes about one report (to show the reporter that their note was sent). */
export const reportNotes = (c: Reader, reportKey: Hex, o: ReadOptions = {}) =>
  walk(c, [eq("project", str(PROJECT)), eq("type", str(NOTE_TYPE)), eq("report_key", key(reportKey))], parseNote, true, o)

// ------------------------------------------------------------------ writes
/** A verified official turns on private notes: its phone's public key, readonly, kept a year, owned by the official. */
export async function publishOfficeKey(official: Writer, privateKey: Hex, shop: { state: string; district: string }, o: { synthetic: boolean; now?: Date } = { synthetic: true }) {
  const pubkey = publicKeyOf(privateKey)
  if (addressOfPublicKey(pubkey) !== lc(official.account.address)) throw new Error("the private key does not belong to this official's phone")
  return official.createEntity({
    payload: new Uint8Array(),
    contentType: "application/octet-stream",
    attributes: officeKeyAttributes({ pubkey, state: shop.state, district: shop.district, synthetic: o.synthetic, atMs: BigInt((o.now ?? new Date()).getTime()) }),
    expires: ExpirationTime.fromDays(365),
    flags: { readonly: true },
  })
}

/** The reporter sends a private note about their own report: encrypted to the official, sealed (readonly + 0x…dEaD), 180 days. */
export async function sendNote(reader: Reader, reporter: Writer, report: Pick<Report, "key" | "shopId" | "state" | "district" | "creator">, officeKey: OfficeKey, text: string, o: { synthetic: boolean; now?: Date } = { synthetic: true }) {
  if (lc(reporter.account.address) !== lc(report.creator)) throw new Error("only the phone that wrote the report can send a note about it")
  const to = lc(officeKey.creator) as Hex
  const envelope = encryptNote(text, officeKey.pubkey, report.key, to)
  const [predicted] = await reader.predictEntityKeys({ owner: reporter.account.address, count: 1 })
  if (!predicted) throw new Error("could not predict the entity key")
  const res = await reporter.executeBatch({
    creates: [
      {
        payload: encodeEnvelope(envelope),
        contentType: "application/json",
        attributes: noteAttributes(report, to, { synthetic: o.synthetic, atMs: BigInt((o.now ?? new Date()).getTime()) }),
        expires: ExpirationTime.fromDays(180),
        flags: { readonly: true },
        salt: predicted.salt,
      },
    ],
    ownershipChanges: [{ entityKey: predicted.key, newOwner: BURN_ADDRESS }],
  })
  const created = res.createdEntities[0]
  if (!created || lc(created) !== lc(predicted.key)) throw new Error("created key does not match the prediction")
  return { entityKey: created as Hex, txHash: res.txHash as Hex }
}
