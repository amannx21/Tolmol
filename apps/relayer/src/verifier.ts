// Card verifier (simple version, TEST cards). POST /verify {card, device, sig}
//
// Checks that a ration card was signed by the issuer (a TEST key here; in future the state, via DigiLocker), that the
// phone asking controls `device` (it signed a fixed message), and that this card has not verified another phone. Then
// it publishes one `tolmol.attestation` entity on Arkiv, created by the verifier wallet: "this device is a verified
// card holder at shop X". The card itself is never stored anywhere: only `card_tag` = HMAC(secret, serial) goes on
// Arkiv, which cannot be linked back to the card without the secret. The "already used?" check reads Arkiv, so there
// is no verifier database.
//
// Self-contained (only @arkiv-network/sdk and viem) because the relayer deploys on its own. The formats must match
// packages/tolmol-sdk/src/verify.ts; apps/relayer/test/verifier.test.ts checks that they do.
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk"
import { bool, i32, key, str, u64 } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { eq } from "@arkiv-network/sdk/query"
import { http, isAddress, verifyMessage, type Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"

export const TEST_ISSUER = "0x75a542B54Ab0E187e41b3644e47Ac546B7D1011f" as const
export const VERIFY_PER_IP_PER_DAY = 5

export type VerifierEnv = { VERIFIER_PRIVATE_KEY?: string; CARD_TAG_SECRET?: string; CARD_ISSUER?: string; RPC_URL?: string }
/** PHH / AAY: a ration card (verifies a card holder). FPS: a fair-price-shop dealer licence (verifies the shop's dealer). */
export type Card = { v: 1; state: string; shopId: string; type: "PHH" | "AAY" | "FPS"; serial: string; sig: Hex }

export const cardMessage = (c: Omit<Card, "sig">) => `Tolmol TEST ration card (synthetic, not a real card)\nv1|${c.state}|${c.shopId}|${c.type}|${c.serial}`
export const deviceProofMessage = (serial: string, device: string) => `Tolmol: verify this phone with test card ${serial}\ndevice ${device.toLowerCase()}`

export function decodeCard(s: unknown): Card | null {
  if (typeof s !== "string" || s.length > 1000) return null
  try {
    const c = JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/"))) as Partial<Card>
    if (c.v !== 1 || typeof c.state !== "string" || !/^[A-Z]{2}$/.test(c.state)) return null
    if (typeof c.shopId !== "string" || !/^SYN-[A-Z]{2}-\d{4}$/.test(c.shopId) || !c.shopId.startsWith(`SYN-${c.state}-`)) return null
    if (c.type !== "PHH" && c.type !== "AAY" && c.type !== "FPS") return null
    if (typeof c.serial !== "string" || !/^[0-9a-f]{32}$/.test(c.serial) || typeof c.sig !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(c.sig)) return null
    return { v: 1, state: c.state, shopId: c.shopId, type: c.type, serial: c.serial, sig: c.sig as Hex }
  } catch {
    return null
  }
}

export async function cardTag(secret: string, serial: string): Promise<Hex> {
  const enc = new TextEncoder()
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(serial)))
  return `0x${[...mac].map((x) => x.toString(16).padStart(2, "0")).join("")}`
}

const dayStartMs = (ms: number) => BigInt(Math.floor(ms / 86_400_000) * 86_400_000)

export type VerifyResult = { status: number; body: Record<string, unknown> }

export function makeVerifier(env: VerifierEnv) {
  const pk = env.VERIFIER_PRIVATE_KEY
  const secret = env.CARD_TAG_SECRET
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk) || !secret || secret.length < 32) return null
  const issuer = (env.CARD_ISSUER && isAddress(env.CARD_ISSUER) ? env.CARD_ISSUER : TEST_ISSUER) as Hex
  const account = privateKeyToAccount(pk as Hex)
  const transport = http(env.RPC_URL ?? tiramisu.rpcUrls.default.http[0], { retryCount: 1, timeout: 20_000 })
  const reader = createPublicClient({ chain: tiramisu, transport })
  const writer = createWalletClient({ chain: tiramisu, transport, account })
  const me = account.address
  let queue: Promise<unknown> = Promise.resolve() // one write at a time, so our nonces never collide

  const find = async (name: string, value: ReturnType<typeof str> | ReturnType<typeof key>) => {
    const page = await reader
      .select({ key: true, attributes: true })
      .where([eq("project", str("tolmol")), eq("type", str("tolmol.attestation")), eq(name, value)])
      .createdBy(me)
      .limit(10)
      .fetch()
    return page.entities as unknown as { key: Hex; attributes: Record<string, { value: unknown } | undefined> }[]
  }

  return {
    address: me,
    async verify(input: { card?: unknown; device?: unknown; sig?: unknown }): Promise<VerifyResult> {
      const card = decodeCard(input.card)
      if (!card) return { status: 400, body: { error: "not a Tolmol test ration card" } }
      if (typeof input.device !== "string" || !isAddress(input.device, { strict: false })) return { status: 400, body: { error: "invalid device address" } }
      if (typeof input.sig !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(input.sig)) return { status: 400, body: { error: "missing device signature" } }
      const device = input.device.toLowerCase() as Hex

      const { sig, ...unsigned } = card
      if (!(await verifyMessage({ address: issuer, message: cardMessage(unsigned), signature: sig }).catch(() => false)))
        return { status: 403, body: { error: "card_signature", detail: "this card was not signed by the card issuer" } }
      if (!(await verifyMessage({ address: device, message: deviceProofMessage(card.serial, device), signature: input.sig as Hex }).catch(() => false)))
        return { status: 403, body: { error: "device_signature", detail: "the phone did not prove it controls this device" } }

      const tag = await cardTag(secret, card.serial)
      const used = await find("card_tag", key(tag))
      if (used.length) {
        const same = used.find((e) => e.attributes.device?.value === device)
        return same ? { status: 200, body: { ok: true, already: true, entityKey: same.key } } : { status: 409, body: { error: "card_used", detail: "this card has already verified another phone" } }
      }
      const mine = await find("device", str(device))
      if (mine.length) return { status: 200, body: { ok: true, already: true, entityKey: mine[0]!.key } }

      const run = queue.then(() =>
        writer.createEntity({
          payload: new Uint8Array(),
          contentType: "application/octet-stream",
          attributes: {
            project: str("tolmol"),
            type: str("tolmol.attestation"),
            schema_version: i32(1),
            device: str(device),
            state: str(card.state),
            shop_id: str(card.shopId),
            card_tag: key(tag),
            method: str("test_card"),
            role: str(card.type === "FPS" ? "dealer" : "card_holder"),
            verified_on: u64(dayStartMs(Date.now())),
            synthetic: bool(true),
          },
          expires: ExpirationTime.fromDays(365),
          flags: { readonly: true },
        }),
      )
      queue = run.catch(() => undefined)
      try {
        const res = await run
        return { status: 200, body: { ok: true, entityKey: res.entityKey, txHash: res.txHash, shopId: card.shopId, role: card.type === "FPS" ? "dealer" : "card_holder" } }
      } catch (e) {
        return { status: 502, body: { error: `write failed: ${String((e as Error).message).split("\n")[0]}` } }
      }
    },
  }
}
