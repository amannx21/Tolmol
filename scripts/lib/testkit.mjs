// Shared helpers for Tolmol's on-chain experiments. Never logs private keys.
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import fs from "node:fs"

export const RPC = tiramisu.rpcUrls.default.http[0]
export const pub = createPublicClient({ chain: tiramisu, transport: http(RPC) })

export function account(role) {
  const pk = process.env[`${role}_PRIVATE_KEY`]
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk ?? "")) throw new Error(`${role}_PRIVATE_KEY missing or malformed`)
  return privateKeyToAccount(pk)
}
export const wallet = (role) => createWalletClient({ chain: tiramisu, transport: http(RPC), account: account(role) })

/** A wallet client that runs every step up to signing (incl. eth_estimateGas) but refuses to broadcast. */
export function dryWallet(role) {
  const probe = { gas: undefined }
  const base = http(RPC)
  const transport = (opts) => {
    const t = base(opts)
    return {
      ...t,
      request: async (args) => {
        if (args.method === "eth_sendRawTransaction" || args.method === "eth_sendTransaction") throw new Error("DRY_RUN_BLOCKED_BROADCAST")
        const r = await t.request(args)
        if (args.method === "eth_estimateGas") probe.gas = BigInt(r)
        return r
      },
    }
  }
  return { client: createWalletClient({ chain: tiramisu, transport, account: account(role) }), probe }
}

export const j = (v) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x))
export function errSummary(e) {
  const out = []; let c = e
  for (let i = 0; c && i < 6; i++) { out.push(`${c.name}: ${String(c.shortMessage ?? c.message).split("\n")[0].slice(0, 240)}`); c = c.cause }
  return { errorClass: e?.constructor?.name, code: e?.code ?? e?.cause?.code, kind: e?.kind, txHash: e?.txHash, chain: out }
}

function hasInChain(e, text) {
  for (let c = e, i = 0; c && i < 12; c = c.cause, i++) if (String(c.message ?? "").includes(text) || String(c.details ?? "").includes(text)) return true
  return false
}

export function recorder(name) {
  const results = []
  const file = `test-results/${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  async function step(label, expect, fn) {
    const at = new Date().toISOString()
    let rec
    try { rec = { label, at, expect, outcome: "ok", ...(await fn()) } }
    catch (e) {
      const sum = errSummary(e)
      const dry = sum.chain.join(" ").includes("DRY_RUN_BLOCKED") || hasInChain(e, "DRY_RUN_BLOCKED")
      rec = { label, at, expect, outcome: dry ? "dry-run-ok" : "rejected", ...(dry ? { chain: undefined } : sum) }
    }
    results.push(rec); console.log(j(rec))
    fs.writeFileSync(file, j(results))
    return rec
  }
  return { step, results, file }
}
