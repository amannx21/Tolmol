// One-time setup for the simple verification demo (synthetic, testnet):
//  1. the reporter wallet tops up the verifier wallet with a little test GLM (it pays for attestation writes),
//  2. the registry wallet publishes a `tolmol.verifier` entity naming the verifier (trust by $creator).
// Idempotent. Never prints keys. Usage: node --env-file=.env --import tsx scripts/setup-verifier.ts
import { formatEther, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { httpReader, listVerifiers, registerVerifier, writerFor } from "../packages/tolmol-sdk/src/index.js"

const need = (k: string) => {
  const v = process.env[k]
  if (!v || !/^0x[0-9a-fA-F]{64}$/.test(v)) throw new Error(`${k} missing in .env`)
  return v as `0x${string}`
}
const reader = httpReader()
const verifier = privateKeyToAccount(need("VERIFIER_PRIVATE_KEY"))
const reporter = writerFor(privateKeyToAccount(need("REPORTER_PRIVATE_KEY")))
const registry = writerFor(privateKeyToAccount(need("REGISTRY_PRIVATE_KEY")))

const bal = await reader.getBalance({ address: verifier.address })
console.log("verifier", verifier.address, "balance", formatEther(bal), "GLM")
if (bal < parseEther("0.02")) {
  const tx = await reporter.sendTransaction({ to: verifier.address, value: parseEther("0.05") })
  await reader.waitForTransactionReceipt({ hash: tx })
  console.log("topped up 0.05 GLM, tx", tx)
}
const existing = (await listVerifiers(reader)).items.filter((v) => v.verifier === verifier.address.toLowerCase())
if (existing.length) console.log("already named by the registry:", existing.map((v) => v.key).join(", "))
else {
  const res = await registerVerifier(registry, verifier.address)
  console.log("tolmol.verifier created", res.entityKey, "tx", res.txHash)
}
