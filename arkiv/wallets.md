# Wallets that create Tolmol's Arkiv entities

Network: **Tiramisu testnet**, chain ID `7738577`.
Explorer: https://tiramisu.explorer.arkiv.network

These are throwaway test wallets generated on 2026-10-13 for this hackathon only.
Their private keys live only in a local, git-ignored `.env` file. They hold test GLM only.

| Address | Role | Explorer |
|---|---|---|
| `0xDAD092E626A158220Aa2838d25CCD69F51de76BE` | Reporter: creates `tolmol.report` entities in seed data and tests | [view](https://tiramisu.explorer.arkiv.network/address/0xDAD092E626A158220Aa2838d25CCD69F51de76BE) |
| `0xAe8DCc161d9F27fACFE6D48A8B4DF148D64ab9E3` | Witness A: creates `tolmol.witness` entities that corroborate reports | [view](https://tiramisu.explorer.arkiv.network/address/0xAe8DCc161d9F27fACFE6D48A8B4DF148D64ab9E3) |
| `0xA7EF19b057E28BcB7048a202992423Da937Df140` | Witness B: a second, distinct corroborating witness | [view](https://tiramisu.explorer.arkiv.network/address/0xA7EF19b057E28BcB7048a202992423Da937Df140) |
| `0x6DBf6A36E27d814c58A05312913DCEEfc0dAe221` | Registry: creates the synthetic `tolmol.shop` entities. The app trusts shops only from this creator | [view](https://tiramisu.explorer.arkiv.network/address/0x6DBf6A36E27d814c58A05312913DCEEfc0dAe221) |
| `0x357A30b18BF4020F243186d76dBdD44b830119e2` | Relayer: sends small test-GLM drips to fresh device wallets. Never creates Tolmol entities | [view](https://tiramisu.explorer.arkiv.network/address/0x357A30b18BF4020F243186d76dBdD44b830119e2) |
| `0xf125a4CeC04AA7632559c2d2928de4DD237E8A9B` | Seed device 00: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0xf125a4CeC04AA7632559c2d2928de4DD237E8A9B) |
| `0x64a2843da41E9a5681F8956D05297e885C458DbD` | Seed device 01: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0x64a2843da41E9a5681F8956D05297e885C458DbD) |
| `0x4EA5b8EBda63Ed7f28065496BB12Cb50AbD1cbF5` | Seed device 02: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0x4EA5b8EBda63Ed7f28065496BB12Cb50AbD1cbF5) |
| `0x943492Bc0C1396B684F42d62F9E2493A6ED24474` | Seed device 03: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0x943492Bc0C1396B684F42d62F9E2493A6ED24474) |
| `0x6bF3F6864F5C6Cda1118ab6f7845Ff45D75040cb` | Seed device 04: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0x6bF3F6864F5C6Cda1118ab6f7845Ff45D75040cb) |
| `0xf985803904E79A5E601bD5F8773F65A4051bF801` | Seed device 05: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0xf985803904E79A5E601bD5F8773F65A4051bF801) |
| `0xd5D24b2A40bE856E74a08ada8314b59F4957B679` | Seed device 06: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0xd5D24b2A40bE856E74a08ada8314b59F4957B679) |
| `0xDa3aB4811c8ff2B3e42ddA415163CCaAbF4FFb91` | Seed device 07: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0xDa3aB4811c8ff2B3e42ddA415163CCaAbF4FFb91) |
| `0x61B3f6Bfa03A5CA049BdbD45b1901E4CF0C53c0F` | Seed device 08: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0x61B3f6Bfa03A5CA049BdbD45b1901E4CF0C53c0F) |
| `0x6134D1300E6824faedE5a9a5C994621F82516c3b` | Seed device 09: a synthetic beneficiary that files reports and confirms others' reports | [view](https://tiramisu.explorer.arkiv.network/address/0x6134D1300E6824faedE5a9a5C994621F82516c3b) |

Status on 2026-10-13: the reporter was funded with 10 GLM from the Hub faucet and created the first entity at 08:47:24 UTC (tx `0x787d9912493add89b34a726c9546fd847dc0a6b3230f37294c09a737193a1755`). At 08:52 UTC the reporter sent 1 GLM to each witness wallet, because the faucet cooldown is tied to the connected wallet (tx `0x96df16d41a0077a1b82fe0faa6089d9fee89cb9ab871a6ead907506fa52fffab` and `0x39d9e594c0c166af21c9be409c3dba6633d7833a066cb5ce4cc4703dc92503da`). Both witnesses then extended a test entity in the extend-permission test (`arkiv/friction.md`). This file will list any further wallets, such as browser wallets used in the demo, as they are added.


End-user device wallets are generated in each browser and are not listed here. To list every wallet that created a Tolmol report, run the query in `arkiv/schema.md` (Q6) and read `creator`, or use the CLI once it ships.

Every seeded shop, report and witness, with its creator and creation transaction, is listed in [`docs/seed-manifest.json`](../docs/seed-manifest.json).
