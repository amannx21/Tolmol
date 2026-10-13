import type { PublicArkivClient } from "@arkiv-network/sdk"
import { parseReport, parseWitness, type RawEntity } from "./attributes.js"
import { BURN_ADDRESS } from "./constants.js"
import type { Report, Witness } from "./model.js"

type Hex = `0x${string}`
export type LiveStatus = "connecting" | "live" | "reconnecting" | "stopped"

export type WatchHandlers = {
  onReport?: (r: Report) => void
  onWitness?: (w: Witness) => void
  /** A report or witness got a new deadline (someone corroborated it). */
  onExtended?: (key: Hex, expiresAt: bigint) => void
  onStatus?: (s: LiveStatus, detail?: string) => void
}

/**
 * Follows new Tolmol reports and witnesses as they land.
 *
 * Pass a client built on a WebSocket transport: with no `fromBlock`, viem then uses `eth_subscribe`
 * and the node pushes each event (tested on Tiramisu). Events carry only the entity key, and every
 * `getEntity` is an `arkiv_query` that costs 100 units of the viewer's anonymous budget. So we do not
 * fetch every entity created on the chain: every Tolmol report and witness is handed to the burn
 * address in the transaction that creates it, and only entities whose ownership moves to the burn
 * address are fetched and validated.
 *
 * viem 2.57 reconnects and resubscribes by itself after a dropped socket (tested). As a fallback,
 * after any reported error we also tear the watcher down and start a fresh one.
 */
export function watchTolmol(client: PublicArkivClient, handlers: WatchHandlers, opts: { restartDelayMs?: number } = {}) {
  const restartDelay = opts.restartDelayMs ?? 3_000
  let stopped = false
  let unwatch: (() => void) | undefined
  let restartTimer: ReturnType<typeof setTimeout> | undefined

  const fetchAndDispatch = async (key: Hex) => {
    try {
      const e = (await client.getEntity(key)) as RawEntity
      const r = parseReport(e)
      if (r) return handlers.onReport?.(r)
      const w = parseWitness(e)
      if (w) handlers.onWitness?.(w)
    } catch {
      /* deleted, expired or not ours: ignore */
    }
  }

  const start = () => {
    if (stopped) return
    handlers.onStatus?.("connecting")
    unwatch = client.watchEntityEvents({
      onOwnershipTransferred: (ev) => {
        if (ev.newOwner.toLowerCase() === BURN_ADDRESS.toLowerCase()) void fetchAndDispatch(ev.entityKey)
      },
      onExpiryExtended: (ev) => handlers.onExtended?.(ev.entityKey, ev.expiresAt),
      onError: (err) => {
        if (stopped) return
        handlers.onStatus?.("reconnecting", err.message.split("\n")[0])
        clearTimeout(restartTimer)
        restartTimer = setTimeout(() => {
          unwatch?.()
          start()
        }, restartDelay)
      },
    })
    handlers.onStatus?.("live")
  }

  start()
  return () => {
    stopped = true
    clearTimeout(restartTimer)
    unwatch?.()
    handlers.onStatus?.("stopped")
  }
}
