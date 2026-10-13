import { createPublicClient, createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http, webSocket, type LocalAccount } from "viem"
import type { Reader } from "./queries.js"
import type { Writer } from "./writes.js"

export { tiramisu }
export const TIRAMISU_HTTP = tiramisu.rpcUrls.default.http[0]
export const TIRAMISU_WS = tiramisu.rpcUrls.default.webSocket[0]

/**
 * Read-only client over HTTP. No key needed; safe in a browser.
 * retryCount is 0 on purpose: on HTTP 429 viem honours `Retry-After`, which for the anonymous
 * query budget is ~13 minutes, so a retry looks like a hang (friction F13). Fail fast instead.
 */
export function httpReader(url: string = TIRAMISU_HTTP): Reader {
  return createPublicClient({ chain: tiramisu, transport: http(url, { retryCount: 0, timeout: 20_000 }) }) as unknown as Reader
}

/**
 * Recognises Arkiv's anonymous query-budget error (HTTP 429, ANON_COST_LIMITED) anywhere in an error's cause chain.
 * Returns the suggested wait in seconds when known.
 */
export function quotaError(e: unknown): { retryAfterSeconds: number | null } | null {
  for (let c: unknown = e, i = 0; c && i < 12; c = (c as { cause?: unknown }).cause, i++) {
    const o = c as { status?: number; message?: string; details?: string; headers?: { get?(k: string): string | null } }
    const text = `${o.message ?? ""} ${o.details ?? ""}`
    if (o.status === 429 || /ANON_COST_LIMITED|Too Many Requests|429/.test(text)) {
      const ra = o.headers?.get?.("Retry-After")
      return { retryAfterSeconds: ra && /^\d+$/.test(ra) ? Number(ra) : null }
    }
  }
  return null
}

/** Read-only client over WebSocket, for live events that are pushed rather than polled. */
export function wsReader(url: string = TIRAMISU_WS): Reader {
  return createPublicClient({ chain: tiramisu, transport: webSocket(url, { reconnect: { attempts: 10, delay: 2_000 }, keepAlive: { interval: 15_000 } }) }) as unknown as Reader
}

/** A signing client for one local account (a device key in the browser, or a seed wallet in scripts). */
export function writerFor(account: LocalAccount, url: string = TIRAMISU_HTTP): Writer {
  return createWalletClient({ chain: tiramisu, transport: http(url, { retryCount: 0, timeout: 30_000 }), account }) as unknown as Writer
}
