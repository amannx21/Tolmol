// Send test GLM from the reporter wallet to other Tiramisu wallets, one at a time.
// Usage: node --env-file=.env scripts/drip-glm.mjs <amountGLM> <address> [<address> ...]
// Never logs private keys.
import { tiramisu } from "@arkiv-network/sdk/chains"
import { createPublicClient, createWalletClient, http, parseEther, formatEther, isAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const [amountArg, ...targets] = process.argv.slice(2)
if (!amountArg || targets.length === 0 || !targets.every((a) => isAddress(a))) throw new Error("usage: <amountGLM> <address>...")
const pk = process.env.REPORTER_PRIVATE_KEY
if (!/^0x[0-9a-fA-F]{64}$/.test(pk ?? "")) throw new Error("REPORTER_PRIVATE_KEY missing or malformed")
const account = privateKeyToAccount(pk)
const pub = createPublicClient({ chain: tiramisu, transport: http() })
const wallet = createWalletClient({ chain: tiramisu, transport: http(), account })
const value = parseEther(amountArg)

for (const to of targets) {
  const sentAt = new Date().toISOString()
  const hash = await wallet.sendTransaction({ to, value })
  const r = await pub.waitForTransactionReceipt({ hash })
  console.log(JSON.stringify({ sentAt, from: account.address, to, glm: amountArg, hash, status: r.status,
    block: r.blockNumber.toString(), gasUsed: r.gasUsed.toString(),
    explorer: `https://tiramisu.explorer.arkiv.network/tx/${hash}` }))
}
for (const a of [account.address, ...targets]) console.log("balance", a, formatEther(await pub.getBalance({ address: a })), "GLM")
