// Offline queue for reports. A report made without a connection is kept in this browser's localStorage
// (shop, month, grain, grams; nothing personal) and sent automatically when the device is back online.
// It is signed at send time with this phone's ID (or a separate one, if that setting is on).
import { useEffect, useState } from "preact/hooks"
import { DuplicateError, type ReportInput, type Shop } from "tolmol-sdk"
import { fileReport, GasError, SeparateIdError } from "./arkiv"

const KEY = "tolmol.queue.v1"
type Queued = { input: ReportInput; shop: Pick<Shop, "shopId" | "state" | "district">; queuedAt: number }
const listeners = new Set<(n: number) => void>()

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
}

export function enqueueReport(input: ReportInput, shop: Pick<Shop, "shopId" | "state" | "district">) {
  write([...read(), { input, shop: { shopId: shop.shopId, state: shop.state, district: shop.district }, queuedAt: Date.now() }])
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
      try {
        await fileReport(item.input, item.shop)
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

/** Call once at startup: flush on load and every time the browser comes back online. */
export function startQueue() {
  const go = () => void flushQueue()
  window.addEventListener("online", go)
  go()
}
