// Offline queue for reports. A report made without a connection is kept in this browser's localStorage
// (shop, month, grain, grams; nothing personal) and sent automatically when the device is back online.
// It is signed at send time with this phone's ID (or a separate one, if that setting is on).
// The same queue sends a report LATER, only when the person chooses it: "send later" holds it on the phone for 1 to
// 6 hours, so the moment it lands on Arkiv cannot be matched to the moment the person stood at the counter. It is
// sent the first time Tolmol is open after that time (a web page cannot wake itself up while it is closed), so it is
// never switched on by itself, and "Send now" (sendWaitingNow) can release it at any time.
import { useEffect, useState } from "preact/hooks"
import { DuplicateError, type ReportInput, type Shop } from "tolmol-sdk"
import { fileReport, GasError, SeparateIdError } from "./arkiv"

const KEY = "tolmol.queue.v1"
type Opts = { lifetimeDays?: number; allowExtension?: boolean; separateId?: boolean }
type Queued = { input: ReportInput; shop: Pick<Shop, "shopId" | "state" | "district">; queuedAt: number; opts?: Opts; notBefore?: number }
const listeners = new Set<(n: number) => void>()
// Any change to the queue (a report added, sent, or released by "Send now"), even when the count stays the same.
const changeListeners = new Set<(v: number) => void>()
let version = 0

function read(): Queued[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
function write(q: Queued[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q))
  } catch {
    /* storage unavailable: nothing we can do offline */
  }
  listeners.forEach((f) => f(q.length))
  version++
  changeListeners.forEach((f) => f(version))
}

/** A random delay between 1 and 6 hours (crypto-random, so it does not follow a pattern). */
export function randomDelayMs() {
  const r = new Uint32Array(1)
  crypto.getRandomValues(r)
  return 3_600_000 + Math.floor((r[0]! / 2 ** 32) * 5 * 3_600_000)
}

export function enqueueReport(input: ReportInput, shop: Pick<Shop, "shopId" | "state" | "district">, extra: { opts?: Opts; delayed?: boolean } = {}) {
  const item: Queued = { input, shop: { shopId: shop.shopId, state: shop.state, district: shop.district }, queuedAt: Date.now(), opts: extra.opts }
  if (extra.delayed) item.notBefore = Date.now() + randomDelayMs()
  write([...read(), item])
}

/** When the latest delayed report will go out (for the "will be sent after …" note). */
export const nextDelayed = (): number | null => read().reduce<number | null>((m, q) => (q.notBefore && (!m || q.notBefore > m) ? q.notBefore : m), null)

// "Send at a random time": one choice per report screen, shared between the preview box and the save button.
let sendLater = false
const laterListeners = new Set<(v: boolean) => void>()
export const getSendLater = () => sendLater
export function setSendLater(v: boolean) {
  sendLater = v
  laterListeners.forEach((f) => f(v))
}
export function useSendLater(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(sendLater)
  useEffect(() => {
    laterListeners.add(setV)
    return () => void laterListeners.delete(setV)
  }, [])
  return [v, setSendLater]
}

/** "Send now": reports held for a later time go out at once (as soon as there is a connection). */
export function sendWaitingNow() {
  write(read().map((q) => ({ ...q, notBefore: undefined })))
  void flushQueue()
}

/** Looks like "no network" rather than a rejected write. */
export const isOffline = (e: unknown) =>
  !navigator.onLine || /Failed to fetch|NetworkError|network|HTTP request failed|fetch failed|timed out/i.test(String((e as Error)?.message ?? e))

let flushing = false
/** Sends queued reports one by one. Keeps any that fail for network reasons; drops ones that are now duplicates. */
export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine) return 0
  flushing = true
  let sent = 0
  try {
    for (const item of read()) {
      if (item.notBefore && item.notBefore > Date.now()) continue // held back on purpose; not yet
      try {
        await fileReport(item.input, item.shop, item.opts)
        sent++
      } catch (e) {
        // No gas yet, or no network: keep it and try again later.
        if (e instanceof GasError || e instanceof SeparateIdError) break
        if (!(e instanceof DuplicateError) && isOffline(e)) break
        // Duplicate or a permanent rejection: drop it so the queue cannot get stuck.
      }
      write(read().filter((q) => q.queuedAt !== item.queuedAt))
    }
  } finally {
    flushing = false
  }
  return sent
}

export function useQueueCount() {
  const [n, setN] = useState(() => read().length)
  useEffect(() => {
    listeners.add(setN)
    return () => void listeners.delete(setN)
  }, [])
  return n
}

/** Re-renders the caller on every change to the queue (used where the held/released state is shown). */
export function useQueueChanges() {
  const [v, setV] = useState(version)
  useEffect(() => {
    changeListeners.add(setV)
    return () => void changeListeners.delete(setV)
  }, [])
  return v
}

/** Call once at startup: flush on load and every time the browser comes back online. */
export function startQueue() {
  const go = () => void flushQueue()
  window.addEventListener("online", go)
  setInterval(go, 60_000) // delayed reports go out within a minute of their time while the app is open
  go()
}
