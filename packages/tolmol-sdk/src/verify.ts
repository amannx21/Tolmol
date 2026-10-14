// Verified card holders, simple version (test cards). See docs/VERIFIED_REPORTERS.md.
//
// A ration card signed by an issuer (here a TEST issuer key standing in for the state, which in future would be the
// DigiLocker ration card) is shown once to a verifier. The verifier checks the signature, checks that the card has not
// verified another phone, and publishes one `tolmol.attestation` entity on Arkiv: "this device is a verified card
// holder at shop X". No name, card number or serial goes on Arkiv: only a keyed fingerprint of the card's random
// serial (`card_tag`), which nobody without the verifier's secret can link back to the card.
//
// Trust is by $creator: verifiers are named by `tolmol.verifier` entities from the registry wallet, and attestations
// count only from a named verifier. Known limit of this simple version: the verifier sees which device a card
// verified, so it could link that device's reports to the card. The anonymous (Semaphore) design removes that.
import { ExpirationTime } from "@arkiv-network/sdk"
import { bool, i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import { eq } from "@arkiv-network/sdk/query"
import type { AttributeInputs } from "@arkiv-network/sdk"
import { verifyMessage } from "viem"
import { DEFAULT_REGISTRY, PROJECT, SCHEMA_VERSION } from "./constants.js"
import { dayStartMs, SHOP_ID_RE, STATE_RE } from "./model.js"
import type { RawEntity } from "./attributes.js"
import type { Reader, ReadOptions, ReadResult } from "./queries.js"
import type { Writer } from "./writes.js"

type Hex = `0x${string}`
const lc = (x: string) => x.toLowerCase()

export const VERIFY_TYPE = { verifier: "tolmol.verifier", attestation: "tolmol.attestation" } as const
/** Public address of the TEST card issuer. Its cards are synthetic; in production the issuer is the state (DigiLocker). */
export const TEST_ISSUER = "0x75a542B54Ab0E187e41b3644e47Ac546B7D1011f" as const
export const VERIFY_LIFETIME_DAYS = { verifier: 180, attestation: 365 } as const
export const CARD_TYPES = ["PHH", "AAY"] as const
export type CardType = (typeof CARD_TYPES)[number]
export const ATTEST_METHODS = ["test_card", "camp"] as const
export type AttestMethod = (typeof ATTEST_METHODS)[number]

// ------------------------------------------------------------------ test ration cards
/** A synthetic ration card: no name, no card number, no family details. `serial` is random, `sig` is the issuer's. */
export type TestCard = { v: 1; state: string; shopId: string; type: CardType; serial: string; sig: Hex }

const SERIAL_RE = /^[0-9a-f]{32}$/

/** The exact text the issuer signs (EIP-191 personal message). */
export const cardMessage = (c: Omit<TestCard, "sig">) =>
  `Tolmol TEST ration card (synthetic, not a real card)\nv1|${c.state}|${c.shopId}|${c.type}|${c.serial}`

/** The exact text a phone signs to prove it controls the device it asks to verify. */
export const deviceProofMessage = (serial: string, device: string) => `Tolmol: verify this phone with test card ${serial}\ndevice ${lc(device)}`

export function parseCard(x: unknown): TestCard | null {
  const c = x as Partial<TestCard> | null
  if (!c || c.v !== 1 || typeof c.state !== "string" || !STATE_RE.test(c.state)) return null
  if (typeof c.shopId !== "string" || !SHOP_ID_RE.test(c.shopId) || !CARD_TYPES.includes(c.type as CardType)) return null
  if (typeof c.serial !== "string" || !SERIAL_RE.test(c.serial) || typeof c.sig !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(c.sig)) return null
  if (!c.shopId.startsWith(`SYN-${c.state}-`)) return null
  return { v: 1, state: c.state, shopId: c.shopId, type: c.type as CardType, serial: c.serial, sig: c.sig as Hex }
}

/** base64url(JSON) so a card fits in a QR code and a link fragment. */
export function encodeCard(c: TestCard): string {
  const json = JSON.stringify({ v: c.v, state: c.state, shopId: c.shopId, type: c.type, serial: c.serial, sig: c.sig })
  const b64 = typeof btoa === "function" ? btoa(json) : Buffer.from(json, "utf8").toString("base64")
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
export function decodeCard(s: string): TestCard | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
    const json = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8")
    return parseCard(JSON.parse(json))
  } catch {
    return null
  }
}

/** True if `issuer` signed this card. */
export async function verifyCard(c: TestCard, issuer: Hex = TEST_ISSUER): Promise<boolean> {
  try {
    return await verifyMessage({ address: issuer, message: cardMessage(c), signature: c.sig })
  } catch {
    return false
  }
}

/**
 * The verifier's fingerprint of a card: HMAC-SHA256(secret, serial). Lets anyone see that one card verified only one
 * phone, without revealing the serial. Web Crypto, so it runs in Node 20+ and browsers.
 */
export async function cardTag(secret: string, serial: string): Promise<Hex> {
  const enc = new TextEncoder()
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(serial)))
  return `0x${[...mac].map((x) => x.toString(16).padStart(2, "0")).join("")}`
}

// ------------------------------------------------------------------ entities
export type Verifier = { key: Hex; creator: Hex; verifier: Hex; createdAt: bigint; expiresAt: bigint }
export type Attestation = {
  key: Hex
  creator: Hex
  device: Hex
  state: string
  shopId: string
  cardTag: Hex
  method: AttestMethod
  verifiedOn: bigint
  synthetic: boolean
  createdAt: bigint
  expiresAt: bigint
}

export function verifierAttributes(verifier: string): AttributeInputs {
  if (!/^0x[0-9a-fA-F]{40}$/.test(verifier)) throw new Error("invalid verifier address")
  return { project: str(PROJECT), type: str(VERIFY_TYPE.verifier), schema_version: i32(SCHEMA_VERSION), verifier: str(lc(verifier)), synthetic: bool(true) }
}

export function attestationAttributes(a: { device: string; state: string; shopId: string; cardTag: Hex; method: AttestMethod; verifiedOnMs: bigint; synthetic: boolean }): AttributeInputs {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a.device)) throw new Error("invalid device address")
  if (!STATE_RE.test(a.state) || !SHOP_ID_RE.test(a.shopId) || !/^0x[0-9a-f]{64}$/.test(a.cardTag)) throw new Error("invalid attestation fields")
  return {
    project: str(PROJECT),
    type: str(VERIFY_TYPE.attestation),
    schema_version: i32(SCHEMA_VERSION),
    device: str(lc(a.device)),
    state: str(a.state),
    shop_id: str(a.shopId),
    card_tag: key(a.cardTag),
    method: str(a.method),
    verified_on: u64(dayStartMs(a.verifiedOnMs)),
    synthetic: bool(a.synthetic),
  }
}

const val = (e: RawEntity, n: string, t: string) => {
  const a = e.attributes?.[n]
  return a && a.type === t ? a.value : undefined
}
const isAddr = (v: unknown): v is Hex => typeof v === "string" && /^0x[0-9a-f]{40}$/.test(v)
const header = (e: RawEntity, type: string) =>
  val(e, "project", "str") === PROJECT && val(e, "type", "str") === type && val(e, "schema_version", "i32") === SCHEMA_VERSION &&
  typeof e.key === "string" && typeof e.creator === "string" && e.createdAt !== undefined && e.expiresAt !== undefined

export function parseVerifier(e: RawEntity): Verifier | null {
  if (!header(e, VERIFY_TYPE.verifier)) return null
  const v = val(e, "verifier", "str")
  if (!isAddr(v)) return null
  return { key: e.key!, creator: e.creator!, verifier: v, createdAt: e.createdAt!, expiresAt: e.expiresAt! }
}

export function parseAttestation(e: RawEntity): Attestation | null {
  if (!header(e, VERIFY_TYPE.attestation)) return null
  const device = val(e, "device", "str")
  const state = val(e, "state", "str")
  const shopId = val(e, "shop_id", "str")
  const tag = val(e, "card_tag", "key")
  const method = val(e, "method", "str")
  const verifiedOn = val(e, "verified_on", "u64")
  const synthetic = val(e, "synthetic", "bool")
  if (!isAddr(device) || typeof state !== "string" || !STATE_RE.test(state) || typeof shopId !== "string" || !SHOP_ID_RE.test(shopId)) return null
  if (typeof tag !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(tag) || !ATTEST_METHODS.includes(method as AttestMethod)) return null
  if (typeof verifiedOn !== "bigint" || typeof synthetic !== "boolean") return null
  return { key: e.key!, creator: e.creator!, device, state, shopId, cardTag: lc(tag) as Hex, method: method as AttestMethod, verifiedOn, synthetic, createdAt: e.createdAt!, expiresAt: e.expiresAt! }
}

// ------------------------------------------------------------------ reads
const META = { key: true, creator: true, owner: true, createdAt: true, expiresAt: true, attributes: true } as const

async function walkAll<T>(client: Reader, where: ReturnType<typeof eq>[], parse: (e: RawEntity) => T | null, opts: ReadOptions & { createdBy?: Hex } = {}): Promise<ReadResult<T>> {
  const atBlock = opts.atBlock ?? (await client.getBlockNumber({ cacheTime: 0 }))
  let q = client.select(META).where(where).limit(200).atBlock(atBlock)
  if (opts.createdBy) q = q.createdBy(opts.createdBy)
  let page = await q.fetch()
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

const base = (type: string) => [eq("project", str(PROJECT)), eq("type", str(type))]

/** Verifiers named by the registry wallet (trusted by $creator). */
export function listVerifiers(client: Reader, opts: ReadOptions & { registry?: Hex } = {}) {
  return walkAll(client, base(VERIFY_TYPE.verifier), parseVerifier, { ...opts, createdBy: opts.registry ?? DEFAULT_REGISTRY })
}
/** Attestations in a state (dashboard, shop pages). */
export function stateAttestations(client: Reader, state: string, opts: ReadOptions = {}) {
  return walkAll(client, [...base(VERIFY_TYPE.attestation), eq("state", str(state))], parseAttestation, opts)
}
/** Attestations naming one device (report page, "is this phone verified?"). */
export function deviceAttestations(client: Reader, device: string, opts: ReadOptions = {}) {
  return walkAll(client, [...base(VERIFY_TYPE.attestation), eq("device", str(lc(device)))], parseAttestation, opts)
}
/** Attestations made with one card fingerprint (the verifier's "already used?" check). */
export function tagAttestations(client: Reader, tag: Hex, opts: ReadOptions & { createdBy?: Hex } = {}) {
  return walkAll(client, [...base(VERIFY_TYPE.attestation), eq("card_tag", key(tag))], parseAttestation, opts)
}

// ------------------------------------------------------------------ rules
const earlier = (a: { createdAt: bigint; key: string }, b: { createdAt: bigint; key: string }) =>
  a.createdAt !== b.createdAt ? a.createdAt < b.createdAt : lc(a.key) < lc(b.key)

/**
 * Devices verified as card holders: attestations from a verifier named by the registry, one device per card
 * (the earliest attestation for a card_tag wins) and one card per device. Deterministic for any input order.
 * Returns lower-cased device address -> its attestation.
 */
export function verifiedDevices(verifiers: readonly Verifier[], attestations: readonly Attestation[]): Map<string, Attestation> {
  const trusted = new Set(verifiers.map((v) => lc(v.verifier)))
  const byTag = new Map<string, Attestation>()
  for (const a of attestations) {
    if (!trusted.has(lc(a.creator))) continue
    const cur = byTag.get(a.cardTag)
    if (!cur || earlier(a, cur)) byTag.set(a.cardTag, a)
  }
  const byDevice = new Map<string, Attestation>()
  for (const a of byTag.values()) {
    const cur = byDevice.get(lc(a.device))
    if (!cur || earlier(a, cur)) byDevice.set(lc(a.device), a)
  }
  return byDevice
}

// ------------------------------------------------------------------ writes (registry and verifier wallets only)
const EMPTY = new Uint8Array()

/** Registry: name a verifier wallet. Owned by the registry, so it can let it lapse (Entity Expiration) to revoke. */
export async function registerVerifier(registry: Writer, verifier: string) {
  return registry.createEntity({
    payload: EMPTY,
    contentType: "application/octet-stream",
    attributes: verifierAttributes(verifier),
    expires: ExpirationTime.fromDays(VERIFY_LIFETIME_DAYS.verifier),
    flags: { readonly: true },
  })
}

/** Verifier: publish one attestation. Readonly; owned by the verifier, so a mistaken one can be deleted. */
export async function attestDevice(verifier: Writer, a: { device: string; state: string; shopId: string; cardTag: Hex; method: AttestMethod; synthetic: boolean; now?: Date }) {
  return verifier.createEntity({
    payload: EMPTY,
    contentType: "application/octet-stream",
    attributes: attestationAttributes({ ...a, verifiedOnMs: BigInt((a.now ?? new Date()).getTime()) }),
    expires: ExpirationTime.fromDays(VERIFY_LIFETIME_DAYS.attestation),
    flags: { readonly: true },
  })
}
