import { useEffect, useState } from "preact/hooks"
import { formatEther } from "viem"
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts"
import { httpReader, writerFor, wsReader, type Reader, type Writer } from "tolmol-sdk"

/** Shared read-only clients. Reads go straight from the browser to the public Arkiv RPC: no Tolmol backend. */
// --- Arkiv server: the public Tiramisu RPC by default; the user can point the app at any other Arkiv server
// (censorship resistance: blocking one endpoint does not hide the data). Stored on this device only.
const RPC_KEY = "tolmol.rpc.v1"
function savedRpc(): { http?: string; ws?: string } {
  try {
    const v = JSON.parse(localStorage.getItem(RPC_KEY) ?? "{}") as { http?: unknown; ws?: unknown }
    const ok = (u: unknown, proto: RegExp) => (typeof u === "string" && proto.test(u) ? u : undefined)
    return { http: ok(v.http, /^https?:\/\//), ws: ok(v.ws, /^wss?:\/\//) }
  } catch {
    return {}
  }
}
export const rpcSetting = savedRpc()
/** Saves a custom server (or clears it with null) and reloads, so every client uses it. */
export function setRpc(http: string | null, wsUrl: string | null) {
  try {
    if (!http) localStorage.removeItem(RPC_KEY)
    else localStorage.setItem(RPC_KEY, JSON.stringify({ http, ws: wsUrl || undefined }))
  } catch {
    /* ignore */
  }
  location.reload()
}
export const reader: Reader = httpReader(rpcSetting.http)
let ws: Reader | undefined
export const liveReader = () => (ws ??= wsReader(rpcSetting.ws))

// --- Device identity: an anonymous keypair generated on this device. It is not a login and is never sent anywhere.
const STORAGE_KEY = "tolmol.device.v1"
let account: PrivateKeyAccount | undefined
let writer: Writer | undefined

export function device(): { account: PrivateKeyAccount; writer: Writer } {
  if (!account) {
    let pk: string | null = null
    try {
      pk = localStorage.getItem(STORAGE_KEY)
    } catch {
      /* private mode: key lives only in memory for this tab */
    }
    if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
      pk = generatePrivateKey()
      try {
        localStorage.setItem(STORAGE_KEY, pk)
      } catch {
        /* ignore */
      }
    }
    account = privateKeyToAccount(pk as `0x${string}`)
    writer = writerFor(account, rpcSetting.http)
  }
  return { account, writer: writer! }
}

/**
 * Privacy: start a fresh anonymous identity. The old key is kept on this phone only (so its reports can still be
 * withdrawn from here), but new reports are signed by a new key and are not linked to the old ones on chain.
 */
export function newIdentity() {
  try {
    const old = localStorage.getItem(STORAGE_KEY)
    if (old) localStorage.setItem(`tolmol.device.retired.${Date.now()}`, old)
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
  location.reload()
}

export function useBalance(address: `0x${string}`) {
  const [wei, setWei] = useState<bigint | null>(null)
  const refresh = async () => {
    try {
      setWei(await reader.getBalance({ address }))
    } catch {
      setWei(null)
    }
  }
  useEffect(() => {
    void refresh()
  }, [address])
  return { wei, glm: wei === null ? "…" : Number(formatEther(wei)).toFixed(4), refresh }
}

/** Enough test GLM for roughly 20 writes at today's Tiramisu gas price. */
export const MIN_WRITE_WEI = 3_000_000_000_000_000n

/** Public URL of the gas-drip relayer (not a secret). VITE_RELAYER_URL overrides it; dev builds default to none. */
const RELAYER_URL = (import.meta.env.VITE_RELAYER_URL as string | undefined) || (import.meta.env.PROD ? "https://tolmol-relayer.vercel.app" : "")

/** Asks the gas-drip relayer for a small amount of testnet GLM. The relayer only ever sends GLM; it never writes Tolmol data. */
export async function requestGas(address: `0x${string}`): Promise<{ ok: boolean; txHash?: string; error?: string; status?: number }> {
  if (!RELAYER_URL) return { ok: false, error: "NO_RELAYER" }
  try {
    const res = await fetch(`${RELAYER_URL.replace(/\/$/, "")}/drip`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address }),
    })
    const body = (await res.json().catch(() => ({}))) as { txHash?: string; error?: string }
    return res.ok ? { ok: true, txHash: body.txHash } : { ok: false, error: body.error ?? `HTTP ${res.status}`, status: res.status }
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) }
  }
}

/**
 * Makes sure this device can pay for a write: if its test-GLM balance is low, asks the relayer once and waits
 * (up to ~25 s) for the drip to land. Used by Easy mode so people never see the word "gas".
 */
export async function ensureGas(): Promise<boolean> {
  const { account } = device()
  const bal = async () => {
    try {
      return await reader.getBalance({ address: account.address })
    } catch {
      return 0n
    }
  }
  if ((await bal()) >= MIN_WRITE_WEI) return true
  const r = await requestGas(account.address)
  if (!r.ok) return false
  for (let i = 0; i < 12; i++) {
    await new Promise((res) => setTimeout(res, 2000))
    if ((await bal()) >= MIN_WRITE_WEI) return true
  }
  return false
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
