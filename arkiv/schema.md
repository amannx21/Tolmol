# Tolmol data schema on Arkiv

Status: **v1, 2026-10-13.** Every limit and behaviour below was tested on Tiramisu with
`@arkiv-network/sdk` 0.8.1 (evidence in `arkiv/friction.md`). This file is updated whenever the
code changes.

- Network: Tiramisu testnet, chain ID `7738577`
- All data is **synthetic**. Shop IDs start with `SYN-`. No real shop, dealer or person appears anywhere.
- All Tolmol entities carry `project = "tolmol"` and a `type`. Every query filters on both.

## Entity types at a glance

| Type | Created by | Owner after creation | Flags | Lifetime | Payload |
|---|---|---|---|---|---|
| `tolmol.shop` | Registry wallet (one fixed address) | Registry wallet | readonly, permissionlessExtension | 180 days | small JSON: synthetic display labels (EN/HI) |
| `tolmol.report` | The reporter's own device wallet | `0x000000000000000000000000000000000000dEaD` (burn) | readonly, permissionlessExtension | 90 days, extended by corroboration (see below) | empty |
| `tolmol.witness` | A different device wallet | burn address | readonly, permissionlessExtension | Same deadline as its report | empty |

### Why these flags and owners

- **readonly**: nobody can change a report's numbers after it is published, including its reporter.
  Tested: owner patch rejected with ReadOnlyEntity.
- **Transfer to the burn address in the same atomic batch as the create**: on Arkiv the owner
  can delete even a readonly entity (tested). A dealer could pressure a beneficiary to delete a
  report. After the transfer, nobody holds the key that can delete it. `$creator` still records
  who wrote it. Tested: reporter delete rejected with NotOwner, `createdBy(reporter)` still finds it.
- **permissionlessExtension**: any wallet can keep a report alive. Corroborating witnesses do this
  from their own devices. Tested: witness extensions succeed, owner and creator unchanged.
- **Shops stay owned by the registry** so a mistaken synthetic shop can be deleted.
  Its numbers still cannot change (readonly).

## Attribute conventions

- Names are lowercase `snake_case`. The node rejects uppercase (friction F7).
- Every quantity is an integer in **grams** (`i32`). There are no floats and no kilograms in attributes.
- Percentages are integer **basis points** (`i32`, 0 to 10000).
- Wall-clock times are **milliseconds since epoch** as `u64`. Block heights come from the system fields.
- Strings are at most 128 UTF-8 bytes (tested). Hindi text never goes in attributes.
- `schema_version` is `i32(1)` on every entity.

## `tolmol.shop` (synthetic registry)

| Attribute | Type | Example | Notes |
|---|---|---|---|
| `project` | str | `tolmol` | |
| `type` | str | `tolmol.shop` | |
| `schema_version` | i32 | `1` | |
| `shop_id` | str | `SYN-BR-0042` | `SYN-<state>-<4 digits>`. Synthetic |
| `state` | str | `BR` | ISO 3166-2:IN subdivision code without the `IN-` prefix |
| `district` | str | `gaya` | lowercase slug of a real district name. Districts are public geography |
| `synthetic` | bool | `true` | always true |

Payload (`application/json`): `{"label_en": "Synthetic FPS 42, Gaya", "label_hi": "...", "synthetic": true}`.

The app only trusts shops created by the registry wallet: `.createdBy(REGISTRY)`. Anyone can
write an entity with `type = tolmol.shop`, but it will not show up in the shop picker.

## `tolmol.report`

| Attribute | Type | Example | Notes |
|---|---|---|---|
| `project` | str | `tolmol` | |
| `type` | str | `tolmol.report` | |
| `schema_version` | i32 | `1` | |
| `shop_id` | str | `SYN-BR-0042` | must exist in the registry (checked by the app) |
| `state` | str | `BR` | copied from the shop, for dashboard filters |
| `district` | str | `gaya` | copied from the shop |
| `month` | str | `2026-10` | `YYYY-MM`, for equality filters |
| `month_num` | i32 | `202610` | the same month as a number, for range filters |
| `item` | str | `rice` | one of `rice`, `wheat`, `millet` |
| `entitled_g` | i32 | `25000` | 0 < x <= 100000 |
| `received_g` | i32 | `21000` | 0 <= x <= `entitled_g` |
| `shortfall_g` | i32 | `4000` | `entitled_g - received_g` |
| `shortfall_bp` | i32 | `1600` | `floor(shortfall_g * 10000 / entitled_g)` |
| `reported_at` | u64 | `1791882241095` | device clock, ms. Display only. Ordering uses blocks |
| `synthetic` | bool | `true` | true for all seed and demo data |

That is 15 of the 30 allowed attributes. The payload is empty on purpose: **there is no
free-text field anywhere**, so nobody can type a name, phone number or ration card number into Arkiv.

The witness pseudo-ID is the device wallet, read from `$creator`. It is never copied into an attribute.

## `tolmol.witness`

| Attribute | Type | Example | Notes |
|---|---|---|---|
| `project` | str | `tolmol` | |
| `type` | str | `tolmol.witness` | |
| `schema_version` | i32 | `1` | |
| `report_key` | key | `0x612b...a7fd` | the report being corroborated |
| `shop_id` | str | `SYN-BR-0042` | copied from the report |
| `state` | str | `BR` | copied from the report, so the dashboard can fetch witnesses by state |
| `month` | str | `2026-10` | copied from the report |
| `item` | str | `rice` | copied from the report |
| `reported_at` | u64 | `1791882241095` | device clock, ms |
| `synthetic` | bool | `true` | |

A witness says "I also got less at this shop this month". It does not carry its own quantities.
If a witness wants to record their own numbers, they file their own `tolmol.report`.

## Rules the app enforces

1. **One report per (device, shop, month, item).** Before creating, the app queries
   `type = tolmol.report AND shop_id AND month AND item` with `.createdBy(myWallet)` and refuses
   if a live one exists.
2. **The dashboard ignores duplicates deterministically.** A duplicate can still be written by
   someone who skips the app. For each (`$creator`, shop, month, item), the dashboard keeps the
   report with the **lowest `createdAt` block**. Ties within one block go to the **lowest entity
   key** (hex order). Result order within a block is not creation order (tested), so it is never used.
3. **A witness must be a different wallet from the reporter**, and each wallet counts once per report.
   Witness entities whose `$creator` equals the report's `$creator` are ignored, and so are repeats.
4. **The corroboration count is computed, never stored.** It is the number of distinct `$creator`s
   among live witness entities for `report_key`, after rule 3. Extension events are not used
   because they name the owner, not the extender (tested).
5. **Quantities are validated** on the device: integers, 0 <= received <= entitled <= 100,000 g,
   and a month that is not in the future and not more than 12 months old.

These rules live in the app and the SDK package. Arkiv cannot enforce them, because anyone can
write any entity. The dashboard applies them when it reads, so a bypassing writer gains nothing.

## Entity Expiration and Lifetime Extension

Tiramisu blocks are 2 s, so 1 day = 43,200 blocks. Durations use whole days only.

| Type | Lifetime | Why |
|---|---|---|
| `tolmol.shop` | 180 days, any wallet can extend | the registry outlives the reports that point to it |
| `tolmol.report` | **90 days** at creation | long enough to file a complaint or RTI about last month's ration (RTI replies are due in 30 days) |
| `tolmol.witness` | same deadline as its report | a corroboration means nothing without its report |

**Corroboration renews the lease.** When a witness corroborates a report that will then have
**2 or more distinct witnesses**, the witness's device sends one atomic batch:

1. create its `tolmol.witness` (readonly, permissionlessExtension);
2. transfer it to the burn address;
3. extend the report to `max(current, head + 180 days)`, capped at `report.createdAt + 365 days`;
4. extend each existing live witness of that report to the same deadline.

With fewer than 2 witnesses, step 1 and 2 run, and the witness gets the report's current deadline.

The 365-day cap is **app policy**, not a protocol rule: with permissionless extension, anyone
using the SDK directly can extend further. We say so in the threat model.

Tested facts this relies on:
- Extension **sets** a deadline. It does not add to it, and it cannot shorten one (ExpiryNotExtended).
- `fromBlocks(1)` up to `permanent()` are all accepted. Tolmol stays within 90 to 365 days.
- On Tiramisu today the fee does not depend on lifetime (friction F8). We chose lifetimes by product logic.

If an entity expires, it leaves every query. Its creation transaction stays on the explorer, and
the evidence export (CSV/JSON) records the entity key, creator, block and transaction for each row.

## Queries the app runs

All queries are built with `@arkiv-network/sdk/query` and typed constructors from `@arkiv-network/sdk/attr`.
Pages are at most 200. Multi-page walks are pinned with `.atBlock(head)` and use `cursor`/`next()`.

| # | Purpose | Query |
|---|---|---|
| Q1 | Shop picker | `project = "tolmol" AND type = "tolmol.shop" AND state = <s> [AND district = <d>]`, `.createdBy(REGISTRY)` |
| Q2 | Shop page: reports for a month | `project AND type = "tolmol.report" AND shop_id = <id> AND month = <m>` |
| Q3 | Witnesses of a report | `project AND type = "tolmol.witness" AND report_key = key(<k>)` |
| Q4 | Dedupe check before a report | `project AND type = "tolmol.report" AND shop_id AND month AND item`, `.createdBy(me)` |
| Q5 | Witnesses of a report, used for the dedupe check before a witness | `project AND type = "tolmol.witness" AND report_key = key(<k>)`, then filtered by `creator` on the device (saves a query) |
| Q5b | Dashboard witnesses | `project AND type = "tolmol.witness" AND state = <s> AND month = <m>` (one query per month) |
| Q6 | Dashboard | `project AND type = "tolmol.report" AND state = <s> AND month_num >= <from> AND month_num <= <to>`, all pages, then rules 2 to 4 on the device |
| Q7 | Worst-shortfall filter | Q6 `AND shortfall_bp >= <threshold>` |
| Q8 | Evidence "as of block N" | Q2 or Q3 with `.atBlock(N)` |
| Q9 | My reports | `project AND type = "tolmol.report"`, `.createdBy(me)` |

Fields selected: `key`, `creator`, `owner`, `createdAt`, `expiresAt`, `attributes` (never the
payload for reports, which is empty anyway).

`$expiresAt` is not used as a filter: it made queries 5 to 10 times slower (friction F9). Time
left is computed on the device from the selected `expiresAt` and the current head.

## Live updates

The dashboard runs `watchEntityEvents` on a **WebSocket** transport with no `fromBlock`, so the
node pushes events (tested). Events carry only the key, and each `getEntity` costs 100 units of the
viewer's anonymous query budget (friction F13). So the app does **not** fetch every entity created on
Tiramisu: it reacts to `OwnershipTransferred` events whose new owner is `0x…dEaD`. Every Tolmol report
and witness gets exactly that transfer in its creating batch, so this filters out other projects' traffic
for free. The fetched entity is still fully validated before it is shown. On a socket error the app
shows "reconnecting". viem resubscribes on its own (tested), and the app also re-creates the
watcher as a fallback.

## Batches

- Report: 1 create + 1 ownership transfer, atomic. The key is predicted with `predictEntityKeys`
  and the create uses the predicted salt (tested).
- Witness: 1 create + 1 transfer + up to 1 + N extensions, atomic.
- Seed script: at most **40 creates per batch**. Larger batches hit the public RPC's 262,144-byte
  request limit at about 57 creates (friction F5).

## What stays off Arkiv, on purpose

| Kept off Arkiv | Why |
|---|---|
| Names, phone numbers, Aadhaar, ration card numbers, addresses | Arkiv entities are public and permanent in transaction history. Hashing does not help: these values are guessable, so hashes can be reversed |
| Free text of any kind | Free text invites personal details. Every field is a number or a fixed choice |
| Photos of receipts, weighing scales or shops | Too large (the public RPC caps requests at 262,144 bytes), and photos identify people and places |
| Household size and card type | They would make reports easier to link to a household. The device uses them only to compute `entitled_g` |
| Device private keys | Kept in the browser's local storage on that device only, never sent anywhere |
| Rate-limit counters and IP addresses for the gas top-up | Operational data about real people. Kept in the relayer's short-lived store, never on chain |
| Aggregates (dashboard rankings, percentages per district) | Derived data. Anyone can recompute it from the raw entities, so storing it would only add a second, trustable copy |
| Real shop registries and beneficiary lists | Out of scope by design. Tolmol uses a synthetic registry |

## Wallets

See `arkiv/wallets.md`. In short:
- the registry wallet creates every `tolmol.shop`;
- each device wallet creates its own reports and witnesses. Judges can list them by querying
  `type = "tolmol.report"` and reading `creator`;
- the relayer wallet only sends small GLM top-ups. It never creates Tolmol entities.
