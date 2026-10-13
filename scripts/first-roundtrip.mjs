// First create + query round-trip on Tiramisu. Writes ONE tiny synthetic entity.
// Usage: node --env-file=.env scripts/first-roundtrip.mjs
// Never logs private keys. Prints addresses, tx hash, entity key and timestamps only.
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk"
import { str, u64, bool, key } from "@arkiv-network/sdk/attr"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { eq } from "@arkiv-network/sdk/query"
import { http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const pk = process.env.REPORTER_PRIVATE_KEY
if (!/^0x[0-9a-fA-F]{64}$/.test(pk ?? "")) throw new Error("REPORTER_PRIVATE_KEY missing or malformed in .env")
const account = privateKeyToAccount(pk)

const publicClient = createPublicClient({ chain: tiramisu, transport: http() })
const walletClient = createWalletClient({ chain: tiramisu, transport: http(), account })

if ((await publicClient.getChainId()) !== tiramisu.id) throw new Error("Wrong chain")
const balance = await publicClient.getBalance({ address: account.address })
console.log("signer", account.address, "balance(wei)", balance.toString())
if (balance === 0n) throw new Error("Signer unfunded. Use the faucet first.")

const startedIso = new Date().toISOString()
const { entityKey, txHash, expiresAt } = await walletClient.createEntity({
  payload: new Uint8Array(),
  contentType: "application/octet-stream",
  attributes: {
    project: str("tolmol"),
    type: str("tolmol.smoke"),
    synthetic: bool(true),
    reported_at: u64(BigInt(Date.now())),
  },
  expires: ExpirationTime.fromDays(14),
})
const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber })
console.log(JSON.stringify({
  startedIso, entityKey, txHash, status: receipt.status,
  block: receipt.blockNumber.toString(),
  blockTimeUtc: new Date(Number(block.timestamp) * 1000).toISOString(),
  expiresAt: expiresAt.toString(), gasUsed: receipt.gasUsed.toString(),
}, null, 2))

// Query it back: compound predicate + creator filter, pinned to the receipt block.
const page = await publicClient
  .select({ key: true, creator: true, owner: true, expiresAt: true, attributes: true, creationFlags: true })
  .where(eq("project", str("tolmol")), eq("type", str("tolmol.smoke")), eq("$key", key(entityKey)))
  .createdBy(account.address)
  .atBlock(receipt.blockNumber)
  .limit(5)
  .fetch()
console.log("matches", page.entities.length)
console.log(JSON.stringify(page.entities, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2))
console.log("explorer tx:", `https://tiramisu.explorer.arkiv.network/tx/${txHash}`)
console.log("explorer entity:", `https://tiramisu.explorer.arkiv.network/entity/${entityKey}`)
