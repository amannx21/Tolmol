# Friction report: building Tolmol on Arkiv

Environment for every entry unless it says otherwise:
`@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, npm 11.6.1, Windows 11,
Tiramisu testnet (chain ID 7738577). Each entry says how it was observed:
**source** (read in the installed SDK), **docs**, or **chain** (run against Tiramisu).

This file is updated as we build. Entries only describe things we actually hit or tested.

## Summary

Every issue below has the surface, the versions, what we expected, what actually happened, steps to reproduce, and
the change that would fix it. Severity is for an app like ours (many small writes, many anonymous browser readers).

| # | Surface | Severity | What would fix it |
|---|---|---|---|
| F1 | AGENTS.md vs SDK query builder | medium | Say "range-filter on your own `u64` attribute"; make SDK and RPC agree on filterable system fields |
| F2 | Docs, live events | medium | Show a `webSocket()` example and say when `watchEntityEvents` subscribes vs polls |
| F3 | Hub faucet | low | Key the cooldown on the destination address, or say it is per connected wallet |
| F4 | Docs, fundamentals | low | Say plain GLM transfers between wallets are allowed |
| F5 | Public RPC + SDK errors | **high** | Map HTTP 413 to a typed `RequestTooLargeError`; document the 262,144-byte ingress limit |
| F6 | SDK attribute encoding | low | Count user attributes in the error message |
| F7 | SDK + node name validation | medium | Reject uppercase names in the SDK; fix both messages |
| F8 | Docs, pricing | low | Document that lifetime does not change the fee on Tiramisu today |
| F9 | Query engine, `$expiresAt` | medium | Index `$expiresAt` ranges, or document the cost |
| F10 | Node query errors | low | Put the detail ("!= is not supported, use NOT") in the top-level message |
| F11 | Hub faucet, WalletConnect | low | Fix or hide the WalletConnect option |
| F12 | Block explorer | low | Show balance and incoming transfers; publish a read API |
| F13 | RPC quota + viem retries | **high** | Typed `QuotaExceededError` from 429 + `Retry-After`; no silent 13-minute retry |
| F14 | RPC headers in browsers | **high** | Send the remaining query budget on every response (`Arkiv-Quota-Used-Percent`) |

## Issues

### F1. AGENTS.md says to range-filter on `$createdAt`, but the SDK query builder rejects it

- **Surface:** challenge AGENTS.md vs TypeScript SDK query builder.
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577); AGENTS.md at commit `7eb4e1c` of `global-tour-stop-pre-devcon`.
- **Observed by:** source, docs, and a local SDK run on 2026-10-13. It throws before any request is sent: `InvalidPredicateError: "$createdAt" is returned in query results but carries no index, so it cannot be filtered on.`
- **Expected:** AGENTS.md in `global-tour-stop-pre-devcon` (commit `7eb4e1c`) says
  "There is no server-side ordering ... sort on the client, or range-filter on `$createdAt`."
- **Actual:** `node_modules/@arkiv-network/sdk/src/query/expression.ts` only allows
  `$key`, `$owner`, `$creator` and `$expiresAt` in predicates. `$createdAt` is listed as
  result-only and throws `InvalidPredicateError`. The "Querying data" docs page agrees:
  `$createdAt` "carries no index and cannot be filtered on". The Arkiv skills repo
  (`known-issues.md`) says raw RPC accepts it anyway.
- **Repro:** `import { gt } from "@arkiv-network/sdk/query"; import { u64 } from "@arkiv-network/sdk/attr"; gt("$createdAt", u64(1n))`
- **Fix suggestion:** correct AGENTS.md to "range-filter on your own `u64` timestamp attribute",
  and make the SDK and raw RPC agree on which system attributes are filterable.
- **What we did:** store `reported_at` as a `u64` attribute and range on that.

### F2. Live-events docs only show HTTP polling; the WebSocket path is undocumented there

- **Surface:** docs page `typescript-sdk/live-events`, `watchEntityEvents`.
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577); docs as read on 2026-10-13.
- **Observed by:** docs, source, and chain on 2026-10-13 09:07 to 09:08 UTC (`scripts/test-events.mjs`).
- **Expected:** AGENTS.md says `watchEntityEvents` "opens a real socket only with a
  WebSocket transport and no `fromBlock`; over HTTP it silently polls". The rubric rewards
  the WebSocket path. We expected the live-events page to show it.
- **Actual:** every example on that page uses `transport: http()` and the page says the
  method "polls the chain for new events". `webSocket()` is never mentioned. The SDK source
  (`src/actions/public/watchEntityEvents.ts`) passes straight to viem `watchEvent`, so the
  transport type decides subscribe vs poll, but nothing in the SDK docs says so.
- **Chain result:** the node accepts a raw `eth_subscribe("logs", { address: 0x44...44 })` over
  `wss://` and returns a subscription id. With `createPublicClient({ transport: webSocket() })`
  and no `fromBlock`, `onEntityCreated` fired **before** our HTTP `createEntity` call returned its
  receipt (3 of 3 events). The same watcher on `http()` polled with `eth_blockNumber` +
  `eth_getLogs` (2 + 2 calls during one event) and fired 1.3 s to 4.6 s after the receipt.
- **Repro:** `node --env-file=.env scripts/test-events.mjs`: it starts one watcher on `webSocket()` and one on
  `http()`, creates an entity, and logs when each fires and which RPC calls each made.
- **Fix suggestion:** add a WebSocket example to the live-events page and state when it
  subscribes vs polls. Note that viem decides this from the transport type.

### F3. Faucet cooldown applies to the connected wallet, not the destination address

- **Surface:** Arkiv Hub faucet (https://hub.arkiv.network/faucet).
- **Versions:** the Hub web app as served on 2026-10-13 (no version shown), Chrome on Windows 11, a Base wallet.
- **Observed by:** the builder, in the Hub UI, 2026-10-13, with a Base wallet connected.
- **Expected:** a cooldown per destination address, so a second, unfunded address could
  be claimed for. Projects need several distinct wallets: we need a reporter and two
  witnesses with different `$creator` values.
- **Actual:** Faucet cooldown (1 hour) applies to the connected wallet, not the destination
  address, even when sending to a different address. After funding the reporter, claims for
  the two witness addresses were blocked; the UI showed about 55 minutes left.
- **Repro:** connect a wallet on the Hub, claim to address A, then try to claim to an
  unfunded address B with the same wallet connected.
- **Workaround:** we sent 1 GLM from the funded reporter wallet to each witness wallet
  with a plain transfer (see "Paths tested that worked").
- **Fix suggestion:** say on the faucet page that the cooldown is per connected wallet, or
  key the cooldown on the destination address. A documented multi-wallet testing recipe would help.

### F4. Docs say every non-operation transaction reverts, but plain GLM transfers succeed

- **Surface:** docs page `start-here/fundamentals` ("A chain with a database engine instead of the EVM").
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577); viem `sendTransaction` with the SDK's `tiramisu` chain.
- **Observed by:** docs and chain, 2026-10-13 08:52 UTC.
- **Expected:** the page says "A transaction is accepted only if its `to` address is a known
  Arkiv operation address. Every other transaction reverts." So we expected a plain
  value transfer to another wallet to revert, which would rule out a gas-drip endpoint.
- **Actual:** a plain viem `sendTransaction({ to: <EOA>, value: 1 GLM })` succeeded twice:
  tx `0x96df16d4...fffab` (block 515889) and tx `0x39d9e594...503da` (block 515892),
  21000 gas each, recipients credited 1 GLM.
- **Repro:** `node --env-file=.env scripts/drip-glm.mjs 1 <address>`.
- **Fix suggestion:** reword the sentence to say that contract calls and deployments are
  rejected, and that native GLM transfers between wallets are allowed.

### F5. The public RPC's 262,144-byte request limit surfaces as "Execution error without revert data"

- **Surface:** public HTTP RPC ingress + TypeScript SDK error mapping (`createEntity`, `executeBatch`).
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577); `curl` 8 for the raw requests.
- **Observed by:** chain, 2026-10-13 08:59 to 09:05 UTC. Severity: **high** for batch writers,
  because the error gives no hint of the cause.
- **Expected:** either a 128 KiB payload (the documented and SDK-enforced limit, 131,072 bytes) can
  be written, or the SDK says the request was too large.
- **Actual:**
  - A raw `curl` with a 262,144-byte body gets HTTP 200. At 262,145 bytes it gets
    **HTTP 413** `{"error":"BAD_REQUEST","message":"request body too large"}`.
  - The SDK turns that 413 into `EntityMutationError: Transaction failed: Execution error without
    revert data` (cause chain: `EstimateGasExecutionError: HTTP request failed.`). The 413 status
    and body are not in the message.
  - Payload: 128,000 bytes estimated fine (5,205,960 gas). 130,144 and 131,072 bytes failed this way.
    So the SDK's 131,072-byte limit is unreachable over the public RPC.
  - Batches: each create with 8 small attributes is about 4.5 KB of signed transaction on the wire
    (hex-encoded). 40, 50 and 55 creates fit (179,638 / 224,439 / 246,839 bytes). **60 creates
    (269,187 bytes) failed** the same way, far below the 36,000,000 block gas limit.
- **Repro:** `node --env-file=.env scripts/test-expiry-and-limits.mjs` (payload rows), or call
  `executeBatch` with 60 creates of 8 attributes each.
- **Workaround:** we cap batches at 40 creates and payloads at 64 KiB. Tolmol payloads are empty anyway.
- **Fix suggestion:** map HTTP 413 to a typed `RequestTooLargeError` with the byte count, and
  document the ingress limit next to the 128 KiB payload limit (or raise it to fit a full payload).

### F6. `TooManyAttributesError` counts cells the caller never wrote

- **Surface:** SDK attribute encoding. **Observed by:** local SDK run, 2026-10-13 08:59 UTC. Severity: low.
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577).
- **Expected:** passing 31 user attributes fails with "at most 30 attributes, got 31".
- **Actual:** `TooManyAttributesError: An entity may carry at most 32 attributes, got 33.` The two
  extra cells are `$payload` and `$contentType`. 30 user attributes estimated fine (233,380 gas).
- **Repro:** `createEntity({ payload: new Uint8Array(), contentType: "application/octet-stream", attributes: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`a${i}`, str("x")])), expires: ExpirationTime.fromHours(1) })`.
- **Fix suggestion:** report user attributes in the message ("30 user attributes; you passed 31").

### F7. Uppercase attribute names: the node's own error says uppercase is allowed

- **Surface:** node validation + SDK name validation. **Observed by:** chain (dry run), 2026-10-13 08:59 UTC.
  Severity: medium (it passes SDK validation, then fails at the node).
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577).
- **Expected:** `shopId` is either accepted, or rejected by the SDK before any request.
- **Actual:** the SDK accepted it. The node rejected it during gas estimation with
  `an attribute name holds "I" (0x49) at byte 4, which is outside the name charset ("A"-"Z", "a"-"z",
  "0"-"9", ".", "-" and "_", with a letter first)`. The message lists "A"-"Z" as allowed while
  rejecting an uppercase letter. The SDK's `InvalidAttributeNameError` text also says A-Z is
  allowed and that "names are case-sensitive". The mutating-data docs page is correct: "Uppercase
  letters are rejected". The skills repo lists the same issue.
- **Repro:** `createEntity({ ..., attributes: { shopId: str("SYN-BR-0042") } })`: no SDK error; gas estimation fails at the node.
- **Fix suggestion:** make the SDK reject uppercase locally and fix both messages.

### F8. Docs say you pay for the lifetime you choose; on Tiramisu, lifetime does not change the fee

- **Surface:** docs (fundamentals: "You pay for the lifetime you choose"; "Start with a short lifetime
  to save on fees"; best practices: "Do not over-allocate: it costs more").
- **Observed by:** chain, 2026-10-13 08:58 to 08:59 UTC. Severity: low, but it changes design advice.
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577); docs as read on 2026-10-13.
- **Expected:** a 180-day entity costs more than a 30-day one.
- **Actual:** the same create with `fromBlocks(1)`, `fromDays(30)`, `fromDays(90)` and
  `fromDays(180)` used **105,384 gas each**. The reporter's balance dropped by exactly
  gas x price (105,384,000,210,768 wei) for each, read with `eth_getBalance` at block N-1 and N,
  so no separate lifetime charge was deducted. Dry-run estimates for `fromYears(10)` and
  `permanent()` were identical (106,385) to `fromDays(90)`.
- **Repro:** `node --env-file=.env scripts/test-expiry-and-limits.mjs`, then compare receipts.
- **Fix suggestion:** document the current pricing, or note that lifetime pricing is planned.
  Tolmol still picks lifetimes by product logic (see `schema.md`), not by fee.

### F9. A `$expiresAt` range makes queries 5 to 10 times slower and once timed out

- **Surface:** node query engine via `select().where(lt("$expiresAt", u64(...)))`.
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577).
- **Observed by:** chain, 2026-10-13 09:06 to 09:07 UTC. Severity: medium for "expiring soon" views.
- **Expected:** similar latency to the same query without the `$expiresAt` predicate.
- **Actual:** `project + test + $expiresAt < head+43200`: first run **timed out** (viem
  `TimeoutError` after its default 10 s x retries, about 41 s total). The rerun succeeded in
  4,665 ms. `$expiresAt < head+600` alone took 3,744 ms. The control query without `$expiresAt`
  took 747 ms, and `$expiresAt > head` took 467 ms.
- **Repro:** `scripts/test-queries.mjs` step "$expiresAt < head + 1 day", or time
  `select({key:true}).where(eq("project", str("tolmol")), lt("$expiresAt", u64(head + 43200n))).limit(200).fetch()`
  against the same query without the `$expiresAt` predicate.
- **Workaround:** Tolmol selects `expiresAt` and computes "time left" on the client instead of
  filtering on it.
- **Fix suggestion:** index `$expiresAt` for range predicates (it is the natural "expiring soon" query), or document
  that such ranges scan and can time out.

### F10. `!=` and `ne()`: helpful detail, confusing top-level message

- **Surface:** node query errors. **Observed by:** chain, 2026-10-13 09:06 UTC. Severity: low.
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577).
- **Expected:** an error whose top-level message says what is wrong with the query (`!=` is not supported).
- **Actual:** `ne("seq", i32(5))` gives `QueryError (type, -32002): Requested resource not
  available.` The useful part ("!= is not part of the query language, write NOT (attr = value)")
  is only in the error's data. A raw `&&` query gives `(parse, -32001): Requested resource not
  found.` with detail "unexpected character". The generic text comes from the JSON-RPC
  error-code names, not the query problem.
- **Repro:** `await client.select({ key: true }).where([eq("project", str("tolmol")), ne("seq", i32(5))]).fetch()`, then
  print `error.message` and `error.cause.data`.
- **Fix suggestion:** put the detail in the top-level message. The SDK could also drop or
  deprecate `ne()`, `exists()` and `hasType()` until the node supports them.

### F11. Hub faucet: WalletConnect option crashes

- **Surface:** Hub faucet. **Observed by:** the builder, 2026-10-13 (reported, not reproduced by the agent).
- **Versions:** the Hub web app as served on 2026-10-13, Chrome on Windows 11.
- **Expected:** choosing WalletConnect opens a wallet chooser or QR code, like the Base option.
- **Repro:** open https://hub.arkiv.network/faucet, choose "Connect wallet", then WalletConnect.
- **Actual:** choosing WalletConnect on the faucet shows "This page couldn't load". The Base option
  works. A "Use a different address" link lets you send to an address other than the connected one.
- **Fix suggestion:** fix or hide the WalletConnect option.

### F12. Explorer address page: no balance, no incoming transactions

- **Surface:** Block Explorer (`tiramisu.explorer.arkiv.network/address/<addr>`).
- **Observed by:** the builder, 2026-10-13 (reported). The agent could not check the page's data
  without a browser: `/api/v2/addresses/<addr>` returns 404 and `/api?module=account...` returns 400.
- **Versions:** the explorer web app as served on 2026-10-13, Chrome on Windows 11.
- **Expected:** an address page with the balance and both incoming and outgoing transactions, as on other explorers.
- **Repro:** open `https://tiramisu.explorer.arkiv.network/address/0xAe8DCc161d9F27fACFE6D48A8B4DF148D64ab9E3` (Witness A,
  funded only by an incoming 1 GLM transfer, tx `0x96df16d4...fffab`).
- **Actual (as reported):** the page lists only outgoing transactions and shows no balance. Our
  witness wallets were funded by incoming transfers, so their pages do not show where their GLM came from.
- **Fix suggestion:** show balance and incoming transfers, and publish a documented read API.

### F13. Anonymous query budget runs out silently: reads look like hangs

- **Surface:** public HTTP RPC quota for `arkiv_query` + viem/SDK retry behaviour.
- **Versions:** `@arkiv-network/sdk` 0.8.1, viem 2.57.5, Node 24.11.0, Tiramisu (chain 7738577); viem's HTTP transport with its default `retryCount`.
- **Observed by:** chain, 2026-10-13 09:24 to 09:34 UTC, while two seed runs (about 150 writes, each
  preceded by dedupe reads) ran from one IP. Severity: **high** for anyone seeding or indexing without an access key.
- **Expected:** a clear error when the budget is used up.
- **Actual:** `arkiv_query` started returning **HTTP 429** with body
  `{"error":"ANON_COST_LIMITED","message":"unauthenticated query budget exhausted; get an API key at https://hub.arkiv.network for a monthly quota"}`
  and headers `ratelimit: limit=10000, remaining=0, reset=785` and `retry-after: 785`. `eth_blockNumber` on
  the same IP kept returning 200 (`limit=600`), so the RPC looked healthy. In our scripts a
  `select().fetch()` did not fail fast. With viem's transport retries it sat until our own 90 s
  watchdog killed it, with no message mentioning the quota.
- **Repro:** run many `arkiv_query` calls from one IP without an access key, then
  `curl -i` an `arkiv_query`. Compare with `eth_blockNumber`.
- **Root cause of the "hang" (found 2026-10-13 10:40 UTC):** viem's HTTP transport retries a 429 and
  honours `Retry-After` (`node_modules/viem/_esm/utils/buildRequest.js`, lines 132 to 136). With
  `retry-after: 780` it silently waits 13 minutes. Our deployed dashboard sat on "Reading from Arkiv…" for this
  reason. With `http(url, { retryCount: 0 })` the same read fails in 1,182 ms and the 429 is visible.
- **Workaround:** fewer reads per write in the seed, one seed run at a time (lock file), and an
  access key for scripts. In the app, every visitor reads from their own IP, readers use `retryCount: 0`,
  and the UI shows "free read limit used up, try again in N min" from `Retry-After`.
- **Update 2026-10-15:** the RPC exposes `RateLimit`, `Retry-After`, `Arkiv-Cost` and `Arkiv-Quota-Used-Percent`
  to browsers (`access-control-expose-headers`), and every `arkiv_query` answers `arkiv-cost: 100`. That made a
  better fix possible in the browser: the web app now uses its own fetch transport (`apps/web/src/rpc.ts`) that
  shows each query, its cost and the reads left in a footer inspector, merges identical queries in flight, and
  answers from the last good copy (saved on the phone, labelled "saved copy") when Arkiv returns 429. Suggestion
  for Arkiv: document these headers next to the query budget; they are the only way a browser app can see it.
- **Fix suggestion:** surface 429 + `Retry-After` as a typed `QuotaExceededError` in the SDK (no
  silent retry for a 13-minute window), and document the anonymous budget (10,000 cost units per
  window) next to the access-key page.
- **Seen again on 2026-10-15 (~13:00 UTC), with the headers:** an end-to-end browser regression of the app (five
  synthetic phones, every page) emptied the budget, after which the node answered
  `HTTP 429`, `ratelimit: limit=10000, remaining=0, reset=1033`, `retry-after: 1033`, body `"ANON_COST_LIMITED"`.
  A retry about 14 minutes after the first 429 still failed, and only then did we read the headers, which said
  `reset=1033` (17 more minutes); after waiting that long, reads worked again. With budget left, the same header
  instead shows a second, shorter limit on requests (`ratelimit: limit=600, remaining=557, reset=15`), so one
  network can also be throttled by a burst of parallel page loads. Two limits share one header name, which is easy
  to misread. The node already sends a precise `RateLimit` header (and exposes it through
  `access-control-expose-headers`), but the SDK reports only "HTTP request failed". *Fix suggestion:* read
  `RateLimit`'s `remaining` / `reset` into the typed error, so apps can show "N reads left" before hitting zero.

### F14. A browser cannot see how much of the query budget is left until it is gone

- **Surface:** public HTTP RPC response headers (`RateLimit`, `Arkiv-Quota-Used-Percent`), as seen by a browser.
- **Versions:** the public Tiramisu RPC on 2026-10-16; `curl` 8 and Chrome 141 `fetch`.
- **Observed by:** chain, 2026-10-16 (repeated with `curl -i` and from the app's own fetch transport).
- **Expected:** with budget left, some header tells the client how much of the ~10,000-unit anonymous query budget
  remains, so an app can warn "N reads left" before it hits zero. `access-control-expose-headers` even lists
  `Arkiv-Quota-Used-Percent`, which suggests such a header exists.
- **Actual:** a successful `arkiv_query` returns `arkiv-cost: 100` and `ratelimit: limit=600, remaining=597, reset=49`
  (the per-minute request limit), and no `Arkiv-Quota-Used-Percent` at all. The budget appears only in the 429 that
  ends it: `ratelimit: limit=10000, remaining=0, reset=3259`. Our footer inspector can therefore show "reads left 597/600"
  one second before every query starts failing for up to an hour. Testing the new screens of this app twice emptied the
  budget for the whole network (one IP), including for anyone else browsing from it.
- **Repro:** `curl -i` any `arkiv_query` with budget left, then again after about 100 queries from the same IP; compare
  the `ratelimit` lines, and look for `arkiv-quota-used-percent` in both.
- **Fix suggestion:** send `Arkiv-Quota-Used-Percent` (already exposed to browsers) on every metered response, or a
  second structured field, e.g. `RateLimit: "minute";r=597;t=49, "budget";r=4200;t=1800` (the IETF RateLimit header
  draft allows several named policies). Document the window length; in our runs `reset` ranged up to 3,259 s.

## Paths tested that worked

- **Read-only public client on Tiramisu.** `createPublicClient({ chain: tiramisu, transport: http() })`
  then `getChainId()` returned 7738577 and `getBlockNumber()` returned 515114 at
  2026-10-13 ~08:26 UTC. No access key needed.

- **First create + query round-trip (chain).** Run at 2026-10-13 08:47:19.667 UTC with
  `node --env-file=.env scripts/first-roundtrip.mjs`.
  - *Expected:* one `createEntity` with an empty payload, four typed attributes
    (`project` str, `type` str, `synthetic` bool, `reported_at` u64) and
    `ExpirationTime.fromDays(14)`; then a query with three `eq` predicates (including
    `$key`), `.createdBy(reporter)` and `.atBlock(receiptBlock)` returns exactly that entity.
  - *Actual:* worked first time. Tx `0x787d9912...1755` landed in block 515746
    (block time 08:47:24 UTC), status success, gas 100384, fee about 0.0001 GLM. The query
    returned 1 match with the same key, `creator` = `owner` = reporter, all four attributes
    with the types we wrote, and flags `raw: 0`. Script finished at 08:47:28.017 UTC.
  - *Expiry check:* `expiresAt` = 1120546 = 515746 + 604800, and 604800 = 14 days / 2 s.
    The create result's `expiresAt` matched the queried value exactly.
  - *Explorer:* both `/tx/<hash>` and `/entity/<key>` routes returned HTTP 200.
  - *Note:* an empty `Uint8Array` payload with `application/octet-stream` was accepted.
- **Raw `eth_getBalance` over the HTTP RPC (chain).** A plain `curl` JSON-RPC call with no
  access key returned the reporter balance (10 GLM after the faucet) at about 08:46 UTC.
- **Plain GLM transfer between wallets (chain).** 2026-10-13 08:52 UTC, viem 2.57.5 wallet
  client with the SDK's `tiramisu` chain. Reporter sent 1 GLM to Witness A
  (tx `0x96df16d41a0077a1b82fe0faa6089d9fee89cb9ab871a6ead907506fa52fffab`) and 1 GLM to
  Witness B (tx `0x39d9e594c0c166af21c9be409c3dba6633d7833a066cb5ce4cc4703dc92503da`).
  Both succeeded with 21000 gas and both balances read back as exactly 1 GLM.
- **Who can extend or patch an entity: creation flags with three distinct wallets (chain).**
  Run 2026-10-13 08:53:21 to 08:54:08 UTC with
  `node --env-file=.env scripts/test-extend-permissions.mjs`. The reporter created two
  synthetic `tolmol.test` entities in one `executeBatch` (tx
  `0xd3124c096a5f35eeb42b98274ccc36bb226ae4fa9628d2ae3ba023ecfed97fb4`), each with
  `fromHours(2)`: PLAIN with no flags (`0x596bcaaf...3864d`) and OPEN with
  `{ readonly: true, permissionlessExtension: true }` (`0xc4785ab3...922f9`, `raw: 3`).
  Every step matched what the docs say:

  | # | Wallet | Action | Expected | Actual |
  |---|---|---|---|---|
  | 1 | Witness A | extend PLAIN to 4 h | NotOwner | Rejected: "entity ... is owned by 0xDAD0..., not 0xAe8D..." |
  | 2 | Witness A | extend OPEN to 4 h | success | Success, tx `0xbf0f7285...5dce6a`, `expiresAt` 523131. Owner and creator unchanged |
  | 3 | Witness B | extend OPEN to 3 h (earlier) | ExpiryNotExtended | Rejected: "already expires at block 523131, so extending it to 521334 would shorten its life" |
  | 4 | Witness B | extend OPEN to 6 h | success | Success, tx `0xe0b4bb72...b97a54e`, `expiresAt` 526737 |
  | 5 | Witness A | patch OPEN | NotOwner or ReadOnlyEntity | Rejected with NotOwner. Ownership is checked before readonly |
  | 6 | Reporter (owner) | patch OPEN | ReadOnlyEntity | Rejected: "was created readonly, so its contents can never change" |
  | 7 | Reporter (owner) | extend PLAIN to 4 h | success | Success, tx `0x0b437bb2...3c79319`, `expiresAt` 523144 |

  Observations that shape our design:
  - Every rejection happened during gas estimation. No transaction was broadcast and no
    gas was spent, so `EntityMutationError.txHash` was undefined.
  - The SDK's top-level error message names the exact cause. The viem errors underneath
    only say "Execution reverted for an unknown reason". Read the outer message, not the cause chain.
  - The `ExpiryExtended` event's `owner` field held the **reporter** (the owner) even when a
    witness extended. The extender only shows up as the transaction's `from`. The live-events
    docs already warn about this ("not necessarily who extended it"). So the extension event
    alone cannot count distinct witnesses. Tolmol counts witnesses from `tolmol.witness`
    entities filtered by `$creator`, and treats extension as the lease that keeps a report alive.
  - Each `extendEntity` set the expiry to "landing block + duration", not "old expiry + duration".
    For example, step 2: 523131 = 515931 + 7200.

- **Entity Expiration bounds (chain, 2026-10-13 08:58 to 08:59 UTC).** `fromDays(30)`, `fromDays(90)`
  and `fromDays(180)` were accepted with lifetimes of exactly 1,296,000 / 3,888,000 / 7,776,000
  blocks (receipt block + days x 43,200). `fromBlocks(1)` was accepted with a 1-block lifetime:
  the shortest possible. `fromSeconds(1)` and `fromBlocks(0)` throw `InvalidExpiryError` locally with
  clear messages. `atBlock(head - 1)` throws locally: "would be dead on arrival". `fromYears(10)`
  and `permanent()` estimated fine, so there is no practical upper bound.
- **String and number validation (local SDK).** A 128-byte `str` is accepted and 129 bytes rejected,
  counted in UTF-8 bytes: 43 Devanagari characters (129 bytes) are rejected. This matters for Hindi
  values, so Tolmol keeps Hindi text out of attributes. `i32(1.5)` and a bare `Date.now()` are
  rejected with messages that name the fix (`dec()` / `u64()`). Names of 32 bytes and dotted names
  are accepted; 33 bytes are rejected.
- **Ownership rules (chain, 2026-10-13 09:00 to 09:01 UTC, `scripts/test-ownership.mjs`).**
  A non-owner cannot delete or transfer (NotOwner). The owner can transfer a readonly entity.
  After the transfer, `$creator` is unchanged: `createdBy(reporter)` still finds it,
  `ownedBy(reporter)` does not and `ownedBy(witnessA)` does. Permissionless extension still works for
  the old owner and a third wallet. The old owner can no longer delete it. The new owner **can**
  delete a readonly entity. After deletion, `getEntity` throws `NoEntityFoundError` and an extend
  fails with "no entity ... it may have been deleted, or have expired".
- **Create + transfer to a burn address in one atomic batch (chain, 2026-10-13 09:03 UTC).**
  `predictEntityKeys` returned key `0xffd7684b...04e2f7`. One `executeBatch` with that salt created the
  entity (readonly + permissionlessExtension) and transferred it to `0x...dEaD`
  (tx `0xc8d74500a9aac6a26820eeb84709c3554f6b2e85d98c032ccae6f16dd10d1c70`). The predicted key
  matched. Owner became `0x...dEaD` and creator stayed the reporter. The reporter's delete was then
  rejected (NotOwner) and Witness A's extension succeeded. Tolmol uses this for every report.
- **Pagination past 200 (chain, 2026-10-13 09:05 to 09:06 UTC, `scripts/test-queries.mjs`).**
  210 entities in 5 batches of 42 (5,056,128 gas per batch, 120,384 per create). `limit(200)`
  gave 200 + 10 over two pages at one pinned block. No `limit()` gave 100. `limit(201)` and
  `limit(0)` are rejected locally. The async iterator walked all 210. A saved cursor resumed
  correctly (50 + 160). A cursor reused with `limit(60)` instead of 50 was accepted.
- **Result order within a block is not creation order.** Across blocks, results come newest
  first as documented. Within one block, entities from the same batch came back as seq
  186, 200, 208, 170, 207. So nothing should rely on result order to break ties within a block.
- **Operators (chain).** Ranges (`>=` and `<` on i32: 50 of 50), `OR` (3 of 3), `NOT` (10 of 10) and
  `STARTSWITH` (105 of 105) all returned exact counts. A type mismatch (`seq = u64(5)` or
  `str('5')` against an i32) returns 0 with no error, as the docs warn. A raw query string with
  `AND` / `NOT (...)` returned 209 of 209.
- **Historical reads (chain).** `atBlock(block before the first batch)` returned 0, and
  `atBlock(first batch block)` returned exactly 42. Reads at head minus 1,000 / 10,000 / 100,000 /
  500,000 blocks all succeeded, which is effectively the whole chain history (head was about
  516,300). Tolmol's "state as of block N" evidence view is built on this.
- **WebSocket reconnection (chain, 2026-10-13 09:08 UTC).** After we force-closed the socket,
  `onError` received "The socket has been closed" twice. viem 2.57.5 reconnected (readyState 1
  within 6 s) and **resubscribed**: the next event still arrived over WebSocket. Re-creating the
  watcher also worked. Tolmol shows a live/reconnecting badge and re-creates the watcher on error
  as a belt-and-braces fallback.
- **Full browser flow with a browser-generated key (chain, 2026-10-13 10:08 to 10:12 UTC).** Chrome, Vite dev
  build, viem `privateKeyToAccount` on a key from `generatePrivateKey()` kept in `localStorage`, public RPC over
  HTTP with CORS (`access-control-allow-origin: *`). The local relayer dripped 0.005 GLM to the fresh device.
  The report form sent one `executeBatch` (create + transfer to `0x…dEaD`): report
  `0xba2886c3a3128179c5e56e09ff08e9e5332c7d3a2b725a97592b001c9fdc5e03`, block 518183, owner `0x…dEaD`.
  A second browser key then got its own drip and corroborated it (witness at block 518235). Both
  writes worked first time from the browser, with no wallet extension.
- **Cost of reads (chain, 2026-10-13 09:48 UTC).** Each `arkiv_query` returned `arkiv-cost: 100`, whether it
  selected only `key` or full attributes with `limit 200`. `eth_blockNumber` carried no `arkiv-cost`. The SDK's
  `predictEntityKeys` uses `eth_call` (`entityNonce`), not `arkiv_query`. We designed the app's reads around this
  (see F13 and `schema.md`, "Live updates").
- **Reading creation flags in a query (chain).** 2026-10-14 ~12:15 UTC, SDK 0.8.1. A query on
  `project = "tolmol" AND type = "tolmol.report" AND shop_id = "SYN-BR-0042"` with
  `select({ key: true, creationFlags: true })` returned `{ readonly: true, permissionlessExtension: true, raw: 3 }`
  for each entity. *Expected:* the flags are selectable like any other system field (`SELECTION_KEYS` lists
  `creationFlags`). *Actual:* as expected. Tolmol uses this so a witness never tries to extend a report whose
  reporter opted out of permissionless extension (that batch would revert as a whole).
- **Privacy audit over every Tolmol entity (chain).** 2026-10-14 at block 565380, `node --import tsx
  scripts/privacy-audit.ts` (read-only, anonymous). It walked every `project = "tolmol"` entity with cursor
  pagination pinned at one block (25 shops, 178 reports, 174 witnesses, 1 correction, plus 4 synthetic
  `tolmol.test`/`tolmol.smoke` entities from these experiments) and checked each attribute against
  `docs/data-contract.schema.json`. Result: **PASS**, no unknown attributes, no out-of-format values, every
  report, witness and correction payload empty. 382 entities came back in 2 pages of up to 200, so the audit
  costs 2 queries (200 units of the anonymous budget, F13).
