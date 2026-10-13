# Baseline and timeline

## Pre-existing work

None. The only commit before this work is GitHub's auto-generated `LICENSE` (MIT) and
`.gitignore` (Node).

| | |
|---|---|
| Baseline commit | `0902494101780b4516ca7563466030f0ac363dbe` |
| Baseline commit time | 2026-10-13 08:17:20 UTC (13:47:20 IST) |
| Repo | https://github.com/amannx21/Tolmol |

## Timeline (all UTC)

| Time | Event |
|---|---|
| 2026-10-13 08:17:20 | Repo created (baseline commit above) |
| 2026-10-13 08:23:09 | Build session started: rules and docs reading |
| 2026-10-13 ~08:24 | `@arkiv-network/sdk@0.8.1` installed (viem 2.57.5, Node 24.11.0, npm 11.6.1, Windows 11) |
| 2026-10-13 ~08:26 | Three test wallets generated. First SDK read on Tiramisu succeeded: chain ID 7738577, head block 515114 |
| 2026-10-13 ~08:46 | Reporter wallet funded from the Hub faucet: balance read as 10 GLM via `eth_getBalance` |
| 2026-10-13 08:47:19.667 | Round-trip script started (`node --env-file=.env scripts/first-roundtrip.mjs`) |
| 2026-10-13 08:47:21.095 | `createEntity` sent |
| **2026-10-13 08:47:24** | **First Arkiv entity written.** Block 515746 timestamp |
| 2026-10-13 08:47:28.017 | Query read-back returned the entity. Script exited 0 |

## Time to first Arkiv entity

**24 min 15 s** from the build session start (08:23:09 UTC) to the block time of the first
create (08:47:24 UTC). That is 30 min 04 s from repo creation. It includes the wait for
faucet funding. Devfolio answer: **2 hours or less**.

| Field | Value |
|---|---|
| Entity key | `0x612b6c189b97b4515c27e2d6650d74adece7ac1c6a2e3484b638890ed684a7fd` |
| Transaction | `0x787d9912493add89b34a726c9546fd847dc0a6b3230f37294c09a737193a1755` |
| Creator | `0xDAD092E626A158220Aa2838d25CCD69F51de76BE` (reporter) |
| Block | 515746 |
| Expires at block | 1120546 (`ExpirationTime.fromDays(14)`, about 27 Oct 2026) |
| Gas used | 100384 at 1000000002 wei, fee about 0.0001 GLM |
| Entity type | `tolmol.smoke`, synthetic, empty payload |
| Tx on explorer | https://tiramisu.explorer.arkiv.network/tx/0x787d9912493add89b34a726c9546fd847dc0a6b3230f37294c09a737193a1755 |
| Entity on explorer | https://tiramisu.explorer.arkiv.network/entity/0x612b6c189b97b4515c27e2d6650d74adece7ac1c6a2e3484b638890ed684a7fd |
