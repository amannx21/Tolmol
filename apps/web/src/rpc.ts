import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { useEffect, useState } from "preact/hooks"
import { curlFor, localStore, meteredTransport, TIRAMISU_HTTP, type MeterState, type Reader } from "tolmol-sdk"

/**
 * The browser's own connection to Arkiv: tolmol-sdk's meteredTransport (plain JSON-RPC from this phone to the Arkiv
 * server, no Tolmol backend), which logs every query with its cost and the reads left for the inspector, merges
 * identical queries in flight, and answers from the last good copy, labelled as saved, when Arkiv's free anonymous
 * read budget runs out. Only public Arkiv data is saved, and only on this phone. This file only connects it to Preact.
 */
export type { ReadLog } from "tolmol-sdk"
export type ReadState = MeterState

const listeners = new Set<() => void>()
let state: MeterState = { log: [], remaining: null, limit: null, savedAt: null, spent: 0 }

export function meteredReader(url: string = TIRAMISU_HTTP): Reader {
  const transport = meteredTransport({
    url,
    store: localStore("tolmol.readcache.v1"),
    onChange: (s) => {
      state = s
      listeners.forEach((f) => f())
    },
  })
  state = transport.meter
  return createPublicClient({ chain: tiramisu, transport }) as unknown as Reader
}

export function useReads(): ReadState {
  const [, setN] = useState(0)
  useEffect(() => {
    const f = () => setN((n) => n + 1)
    listeners.add(f)
    return () => void listeners.delete(f)
  }, [])
  return state
}

export { curlFor }
