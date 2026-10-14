import { describe, expect, it } from "vitest"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import * as sdk from "../../../packages/tolmol-sdk/src/index.js"
import { makeHandler, MemoryStore } from "../src/handler.js"
import * as v from "../src/verifier.js"

// The verifier deploys on its own, so it repeats the card format. These tests keep it identical to the SDK's.
describe("verifier matches the SDK's card format", () => {
  it("same issuer, messages and fingerprint", async () => {
    expect(v.TEST_ISSUER).toBe(sdk.TEST_ISSUER)
    const c = { v: 1 as const, state: "BR", shopId: "SYN-BR-0042", type: "PHH" as const, serial: "00112233445566778899aabbccddeeff" }
    expect(v.cardMessage(c)).toBe(sdk.cardMessage(c))
    expect(v.deviceProofMessage(c.serial, "0xABCD")).toBe(sdk.deviceProofMessage(c.serial, "0xABCD"))
    expect(await v.cardTag("s".repeat(40), c.serial)).toBe(await sdk.cardTag("s".repeat(40), c.serial))
    const issuer = privateKeyToAccount(generatePrivateKey())
    const signed = { ...c, sig: await issuer.signMessage({ message: sdk.cardMessage(c) }) }
    expect(v.decodeCard(sdk.encodeCard(signed))).toEqual(signed)
  })
  it("rejects malformed cards", () => {
    expect(v.decodeCard("x")).toBeNull()
    expect(v.decodeCard(123)).toBeNull()
  })
})

describe("POST /verify input handling (no chain access)", () => {
  const env = { RELAYER_PRIVATE_KEY: `0x${"11".repeat(32)}`, VERIFIER_PRIVATE_KEY: `0x${"22".repeat(32)}`, CARD_TAG_SECRET: "t".repeat(64) }
  const post = (body: unknown) => new Request("https://relayer.example/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  it("is off without verifier env vars", async () => {
    const h = makeHandler({ RELAYER_PRIVATE_KEY: env.RELAYER_PRIVATE_KEY }, new MemoryStore())
    expect((await h(post({}))).status).toBe(503)
  })
  it("rejects non-cards, bad devices and cards not signed by the issuer before any write", async () => {
    const h = makeHandler(env, new MemoryStore())
    expect((await h(post({ card: "nope", device: "0x1", sig: "0x" }))).status).toBe(400)
    const forger = privateKeyToAccount(generatePrivateKey())
    const c = { v: 1 as const, state: "BR", shopId: "SYN-BR-0042", type: "PHH" as const, serial: "00112233445566778899aabbccddeeff" }
    const card = sdk.encodeCard({ ...c, sig: await forger.signMessage({ message: sdk.cardMessage(c) }) })
    const phone = privateKeyToAccount(generatePrivateKey())
    const sig = await phone.signMessage({ message: sdk.deviceProofMessage(c.serial, phone.address) })
    expect((await h(post({ card, device: "Sunita Devi", sig }))).status).toBe(400)
    const r = await h(post({ card, device: phone.address, sig }))
    expect(r.status).toBe(403)
    expect(((await r.json()) as { error: string }).error).toBe("card_signature")
  })
})
