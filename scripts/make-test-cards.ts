// Simple verification demo (synthetic, testnet). Never prints keys.
//  1. Signs 40 TEST ration cards with the test issuer key (standing in for the state / DigiLocker) and writes them to
//     apps/web/public/test-cards.json, so anyone can try "verify this phone" in the app. Cards hold no name, no card
//     number, no family details: state, synthetic shop, card type, a random serial and the signature.
//  2. Verifies 6 of the synthetic seed devices with private test cards (same checks the verifier service runs) and
//     records the attestations in docs/seed-manifest.json.
// Idempotent for step 2 (skips devices already attested). Usage: node --env-file=.env --import tsx scripts/make-test-cards.ts
import fs from "node:fs"
import { randomBytes } from "node:crypto"
import { privateKeyToAccount } from "viem/accounts"
import {
  attestDevice, cardMessage, cardTag, deviceAttestations, encodeCard, httpReader, TEST_ISSUER, verifyCard, writerFor, type TestCard,
} from "../packages/tolmol-sdk/src/index.js"

const need = (k: string) => {
  const v = process.env[k]
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`${k} missing in .env`)
  return v as `0x${string}`
}
const issuer = privateKeyToAccount(need("TEST_ISSUER_PRIVATE_KEY"))
if (issuer.address !== TEST_ISSUER) throw new Error("TEST_ISSUER in the SDK does not match the issuer key")
const secret = need("CARD_TAG_SECRET")
const verifier = writerFor(privateKeyToAccount(need("VERIFIER_PRIVATE_KEY")))
const reader = httpReader()

async function card(shopId: string, type: "PHH" | "AAY"): Promise<TestCard> {
  const c = { v: 1 as const, state: shopId.slice(4, 6), shopId, type, serial: randomBytes(16).toString("hex") }
  const out = { ...c, sig: await issuer.signMessage({ message: cardMessage(c) }) }
  if (!(await verifyCard(out))) throw new Error("self-check failed")
  return out
}

// 1. Public test cards
const publicFile = "apps/web/public/test-cards.json"
if (!fs.existsSync(publicFile)) {
  const shops = ["SYN-BR-0042", "SYN-BR-0002", "SYN-UP-0007", "SYN-JH-0003"]
  const cards: string[] = []
  for (const s of shops) for (let i = 0; i < 10; i++) cards.push(encodeCard(await card(s, i % 4 === 0 ? "AAY" : "PHH")))
  fs.writeFileSync(publicFile, JSON.stringify({
    note: "SYNTHETIC test ration cards for the Tolmol demo. Signed by the TEST issuer key, not by any government. Each card can verify one phone.",
    issuer: TEST_ISSUER,
    cards,
  }, null, 2) + "\n")
  console.log(`wrote ${cards.length} public test cards`)
} else console.log("public test cards already exist; left unchanged")

// 2. Verify some seed devices
const keys = (JSON.parse(fs.readFileSync(".seed-wallets.json", "utf8")) as { keys: `0x${string}`[] }).keys
const manifestPath = "docs/seed-manifest.json"
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { reports: { shopId: string; creator: string }[]; attestations?: unknown[] }
manifest.attestations ??= []
for (const pk of keys.slice(0, 6)) {
  const device = privateKeyToAccount(pk).address
  const counts = new Map<string, number>()
  for (const r of manifest.reports) if (r.creator.toLowerCase() === device.toLowerCase()) counts.set(r.shopId, (counts.get(r.shopId) ?? 0) + 1)
  const shopId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "SYN-BR-0042"
  if ((await deviceAttestations(reader, device)).items.some((a) => a.creator.toLowerCase() === verifier.account.address.toLowerCase())) {
    console.log("already verified", device)
    continue
  }
  const c = await card(shopId, "PHH")
  const res = await attestDevice(verifier, { device, state: c.state, shopId, cardTag: await cardTag(secret, c.serial), method: "test_card", synthetic: true })
  manifest.attestations.push({ device, shopId, key: res.entityKey, txHash: res.txHash, verifier: verifier.account.address, note: "seed device verified with a private TEST card" })
  console.log("verified", device, "card for", shopId, res.entityKey)
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")
