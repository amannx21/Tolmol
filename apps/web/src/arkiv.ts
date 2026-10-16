import { useEffect, useState } from "preact/hooks"
import { concat, formatEther, keccak256, toHex } from "viem"
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts"
import {
  DuplicateError,
  myExistingReport,
  reportCorrections,
  submitReport,
  writerFor,
  wsReader,
  type Reader,
  type ReportInput,
  type Shop,
  type Writer,
} from "tolmol-sdk"
import { getPrefs } from "./prefs"
import { meteredReader } from "./rpc"

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
// Metered: logs each query for the inspector and answers from the last good copy when the free read budget runs out.
export const reader: Reader = meteredReader(rpcSetting.http)
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

/** This phone's own private key. An official's phone uses it to publish its key for private notes and to read the notes
 * sent to it; it is never sent anywhere. Null when storage is blocked (the key then lives only in this tab). */
export function devicePrivateKey(): `0x${string}` | null {
  device()
  try {
    const pk = localStorage.getItem(STORAGE_KEY)
    return pk && /^0x[0-9a-fA-F]{64}$/.test(pk) ? (pk as `0x${string}`) : null
  } catch {
    return null
  }
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
export const RELAYER_URL = (import.meta.env.VITE_RELAYER_URL as string | undefined) || (import.meta.env.PROD ? "https://tolmol-relayer.vercel.app" : "")

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
export async function ensureGas(address: `0x${string}` = device().account.address): Promise<boolean> {
  const bal = async () => {
    try {
      return await reader.getBalance({ address })
    } catch {
      return 0n
    }
  }
  if ((await bal()) >= MIN_WRITE_WEI) return true
  const r = await requestGas(address)
  if (!r.ok) return false
  for (let i = 0; i < 12; i++) {
    await new Promise((res) => setTimeout(res, 2000))
    if ((await bal()) >= MIN_WRITE_WEI) return true
  }
  return false
}

// --- Privacy: a separate anonymous ID for each report (optional) ---------------------------------------------------
// With this on, every report is signed by a brand-new key, so nobody can link one person's reports on chain.
// The new key gets its test gas from the relayer, which funds every fresh wallet, so the funding does not link the
// keys either (a top-up from this phone's main ID would). The keys stay on this phone only, so the reporter can still
// withdraw those reports from here. Trade-off: the "one report per device" rule can only be checked on this phone.
const ONE_TIME_KEY = "tolmol.onetime.v1"
type OneTime = { pk: `0x${string}`; address: `0x${string}`; shopId: string; month: string; item: string; reportKey?: string; at: number }

function readOneTime(): OneTime[] {
  try {
    const v = JSON.parse(localStorage.getItem(ONE_TIME_KEY) ?? "[]") as OneTime[]
    return Array.isArray(v) ? v.filter((x) => /^0x[0-9a-fA-F]{64}$/.test(x?.pk ?? "")) : []
  } catch {
    return []
  }
}
function writeOneTime(list: OneTime[]) {
  try {
    localStorage.setItem(ONE_TIME_KEY, JSON.stringify(list))
  } catch {
    /* private mode: the key lives only in memory; the report itself is still written */
  }
}

/** Every key this phone holds: its current ID, retired IDs and per-report IDs. */
function allKeys(): `0x${string}`[] {
  const out: `0x${string}`[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i) ?? ""
      if (name === STORAGE_KEY || name.startsWith("tolmol.device.retired.")) {
        const pk = localStorage.getItem(name)
        if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) out.push(pk as `0x${string}`)
      }
    }
  } catch {
    /* ignore */
  }
  return [...out, ...readOneTime().map((x) => x.pk)]
}

/** Lower-cased addresses of every ID on this phone, so "your report" works for retired and per-report IDs too. */
export function myAddresses(): Set<string> {
  const set = new Set<string>([device().account.address.toLowerCase()])
  for (const pk of allKeys()) set.add(privateKeyToAccount(pk).address.toLowerCase())
  return set
}

/** A writer for one of this phone's IDs (to withdraw a report it wrote), or null if the key is not here. */
export function writerForAddress(address: string): Writer | null {
  if (address.toLowerCase() === device().account.address.toLowerCase()) return device().writer
  for (const pk of allKeys()) {
    const acct = privateKeyToAccount(pk)
    if (acct.address.toLowerCase() === address.toLowerCase()) return writerFor(acct, rpcSetting.http)
  }
  return null
}

/**
 * Who signs a confirmation ("I got less too"). Normally this phone's ID. With "separate anonymous ID" on, one ID per
 * outlet, derived from this phone's key (the same every time for that outlet, so it is never stored and "one
 * confirmation per report per phone" still holds): a phone's confirmations at different outlets cannot be linked.
 */
export function confirmWriter(shopId: string): Writer {
  const pk = getPrefs().separateIds ? devicePrivateKey() : null
  if (!pk) return device().writer
  return writerFor(privateKeyToAccount(keccak256(concat([pk, toHex(`tolmol-confirm|${shopId}`)]))), rpcSetting.http)
}

/** The phone could not get test gas for the write. */
export class GasError extends Error {}
/** A separate ID was asked for, but the relayer could not fund a fresh key right now (its daily limit, or offline). */
export class SeparateIdError extends Error {}

/**
 * Files a report with the right key: this phone's ID, or a fresh one when "separate ID for each report" is on.
 * Used by Easy mode, the full form and the offline queue, so all three follow the same rules.
 */
export async function fileReport(
  input: ReportInput,
  shop: Pick<Shop, "shopId" | "state" | "district">,
  opts: { lifetimeDays?: number; allowExtension?: boolean; separateId?: boolean } = {},
): Promise<{ entityKey: `0x${string}`; txHash: `0x${string}`; separateId: boolean }> {
  const separate = opts.separateId ?? getPrefs().separateIds
  const write = { synthetic: true, lifetimeDays: opts.lifetimeDays, allowExtension: opts.allowExtension }
  if (!separate) {
    if (!(await ensureGas())) throw new GasError("no test gas")
    const res = await submitReport(reader, device().writer, input, shop, write)
    return { ...res, separateId: false }
  }

  // One report per shop, month and grain from this phone, across all its IDs. Per-report IDs are checked from the
  // list on this phone (the chain cannot link them; that is the point); the main ID with one query, as usual.
  const list = readOneTime()
  const same = (x: { shopId: string; month: string; item: string }) => x.shopId === input.shopId && x.month === input.month && x.item === input.item
  for (const x of list.filter((x) => x.reportKey && same(x))) {
    const withdrawn = (await reportCorrections(reader, x.reportKey as `0x${string}`)).items.some((c) => c.creator.toLowerCase() === x.address.toLowerCase())
    if (!withdrawn) throw new DuplicateError("You already reported this shop, month and item", x.reportKey as `0x${string}`)
  }
  const mainExisting = await myExistingReport(reader, device().account.address, input)
  if (mainExisting) {
    const withdrawn = (await reportCorrections(reader, mainExisting.key)).items.some((c) => c.creator.toLowerCase() === mainExisting.creator.toLowerCase())
    if (!withdrawn) throw new DuplicateError("You already reported this shop, month and item", mainExisting.key)
  }

  // Reuse a funded key that never got its report written (e.g. the write failed), otherwise make a new one.
  let entry = list.find((x) => !x.reportKey && same(x))
  if (!entry) {
    const pk = generatePrivateKey()
    entry = { pk, address: privateKeyToAccount(pk).address, shopId: input.shopId, month: input.month, item: input.item, at: Date.now() }
    writeOneTime([...list, entry]) // saved before funding, so the key is never lost
  }
  if (!(await ensureGas(entry.address))) throw new SeparateIdError("could not fund a separate ID")
  const writer = writerFor(privateKeyToAccount(entry.pk), rpcSetting.http)
  const res = await submitReport(reader, writer, input, shop, { ...write, skipDuplicateCheck: true })
  writeOneTime(readOneTime().map((x) => (x.pk === entry!.pk ? { ...x, reportKey: res.entityKey } : x)))
  return { ...res, separateId: true }
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
