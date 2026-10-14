# tolmol-sdk

Read (and write) **Tolmol** ration-shortfall reports on [Arkiv](https://arkiv.network), the Web3 database, on the
Tiramisu testnet (chain `7738577`). Tolmol is a community-witnessed, tamper-evident record of how much grain
people say they received at India's fair-price shops. All data on Tiramisu is **synthetic**.

- App: https://amannx21.github.io/Tolmol/
- Source and data contract: https://github.com/amannx21/Tolmol ([`arkiv/schema.md`](https://github.com/amannx21/Tolmol/blob/main/arkiv/schema.md),
  [`docs/data-contract.schema.json`](https://github.com/amannx21/Tolmol/blob/main/docs/data-contract.schema.json))

No Tolmol server is involved: every function talks to an Arkiv RPC directly.

## Install

```bash
npm install tolmol-sdk
```

Node 20+ or any modern browser bundler. Depends on `@arkiv-network/sdk` 0.8.1 and `viem`.

## Read a shop's evidence

```js
import { httpReader, shopReports, shopWitnesses, shopCorrections, shopStats, withdrawnKeys, patternSignals, formatBp } from "tolmol-sdk"

const reader = httpReader() // public Tiramisu RPC; pass another Arkiv URL to use a different server
const head = await reader.getBlockNumber()
const at = { atBlock: head } // read every query at one block, so pages never shift

const shop = "SYN-BR-0042"
const [reports, witnesses, corrections] = await Promise.all([
  shopReports(reader, shop, undefined, at),
  shopWitnesses(reader, shop, undefined, at),
  shopCorrections(reader, shop, undefined, at),
])
const withdrawn = withdrawnKeys(reports.items, corrections.items) // honoured only from the report's own creator
const [stats] = shopStats(reports.items, witnesses.items, withdrawn)
console.log(shop, formatBp(stats.shortfallBp), "short over", stats.reports, "reports,", stats.corroborated, "confirmed")

const p = patternSignals(reports.items, witnesses.items, withdrawn)
console.log("bursts (3+ phones within a minute):", p.rapidReports.length)
```

Every reader applies the same rules (see `arkiv/schema.md`): derived numbers are recomputed and forged ones dropped,
one report per device, shop, month and grain (earliest block wins), confirmations only from a *different* device,
withdrawals only from the device that wrote the report, shops only from the registry wallet.

## Command line (read-only, no keys)

```bash
npx tolmol-sdk shops --state BR
npx tolmol-sdk query --shop SYN-BR-0042 --format csv          # evidence export
npx tolmol-sdk query --shop SYN-BR-0042 --at-block 518000     # what was public at that block
npx tolmol-sdk dashboard --state BR
```

## Main exports

| Area | Functions |
|---|---|
| Clients | `httpReader`, `wsReader`, `writerFor`, `quotaError` |
| Queries | `listShops`, `shopReports`, `shopWitnesses`, `shopCorrections`, `stateCorrections`, `reportWitnesses`, `reportCorrections`, `dashboardReports`, `dashboardWitnesses`, `getReport`, `myReports`, `describeShopQueries`, `describeDashboardQueries` |
| Rules | `dedupeReports`, `validWitnesses`, `withdrawnKeys`, `shopStats`, `extensionTarget`, `patternSignals`, `rapidGroups`, `rapidReportKeys` |
| Writes | `submitReport`, `corroborate`, `withdrawReport` (testnet only; reports are created read-only and handed to `0x…dEaD` in the same batch, so nobody can edit or delete them) |
| Evidence | `evidenceRows`, `toCsv`, `toJson` |
| Live | `watchTolmol` (WebSocket entity events, no `fromBlock`) |
| Parsing | `parseReport`, `parseWitness`, `parseCorrection`, `parseShop`, `validateReportInput` |

## Privacy

Reports contain only shop, month, grain, grams, a 7-bit issue mask and the day. No names, phone numbers, Aadhaar,
ration card numbers, photos or free text, not even hashed. Never write real personal data with this package.

## Licence

MIT
