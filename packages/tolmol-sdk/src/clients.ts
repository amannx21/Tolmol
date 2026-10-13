import { createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, webSocket, type LocalAccount } from "viem"
import type { Reader } from "./queries.js"
import type { Writer } from "./writes.js"

export { tiramisu }
export const TIRAMISU_HTTP = tiramisu.rpcUrls.default.http[0]
export const TIRAMISU_WS = tiramisu.rpcUrls.default.webSocket[0]

/** Read-only client over HTTP. No key needed; safe in a browser. */
export function httpReader(url: string = TIRAMISU_HTTP): Reader {
  return createPublicClient({ chain: tiramisu, transport: http(url, { retryCount: 2, timeout: 20_000 }) }) as unknown as Reader
}

/** Read-only client over WebSocket, for live events that are pushed rather than polled. */
export function wsReader(url: string = TIRAMISU_WS): Reader {
  return createPublicClient({ chain: tiramisu, transport: webSocket(url, { reconnect: { attempts: 10, delay: 2_000 }, keepAlive: { interval: 15_000 } }) }) as unknown as Reader
}

/** A signing client for one local account (a device key in the browser, or a seed wallet in scripts). */
export function writerFor(account: LocalAccount, url: string = TIRAMISU_HTTP): Writer {
  return createWalletClient({ chain: tiramisu, transport: http(url, { retryCount: 0, timeout: 30_000 }), account }) as unknown as Writer
}
