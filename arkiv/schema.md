# Tolmol data schema on Arkiv

Status: **schema_version 1, 2026-10-13, with additive changes on 2026-10-14** (the `issues` attribute, the
`tolmol.correction` type, day-rounded `reported_at`, reporter-chosen lifetime). Old entities still parse: a
missing `issues` reads as 0. Every limit and behaviour below was tested on Tiramisu with `@arkiv-network/sdk`
0.8.1 (evidence in `arkiv/friction.md`). This file is updated whenever the code changes.

Machine-readable form: [`docs/data-contract.schema.json`](../docs/data-contract.schema.json) (JSON Schema).
`scripts/privacy-audit.ts` reads every `project = "tolmol"` entity on Tiramisu and fails if any has an attribute or
value outside this contract, or a non-empty payload (see "Privacy audit" below).

- Network: Tiramisu testnet, chain ID `7738577`
- All data is **synthetic**. Shop IDs start with `SYN-`. No real shop, dealer or person appears anywhere.
- All Tolmol entities carry `project = "tolmol"` and a `type`. Every query filters on both.

## Entity types at a glance

| Type | Created by | Owner after creation | Flags | Lifetime | Payload |
|---|---|---|---|---|---|
| `tolmol.shop` | Registry wallet (one fixed address) | Registry wallet | readonly, permissionlessExtension | 180 days | small JSON: synthetic display labels (EN/HI) |
| `tolmol.report` | The reporter's own device wallet | `0x000000000000000000000000000000000000dEaD` (burn) | readonly; permissionlessExtension unless the reporter opts out | **reporter chooses 30, 90 (default) or 180 days**; extended by corroboration if allowed (see below) | empty |
| `tolmol.witness` | A different device wallet | burn address | readonly, permissionlessExtension | Same deadline as its report | empty |
| `tolmol.correction` | The report's own device wallet (honoured only then) | burn address | readonly, permissionlessExtension | until the report's `createdAt` + 365 days | empty |
| `tolmol.verifier` | Registry wallet | Registry wallet | readonly | 180 days; the registry extends it while it trusts the verifier | empty |
| `tolmol.attestation` | A verifier named by the registry | That verifier | readonly | 365 days (re-verify yearly) | empty |
| `tolmol.response` | A device verified as that shop's dealer (counted only then) | burn address | readonly | until the report's `createdAt` + 365 days | empty |
| `tolmol.followup` | The report's own device (counted only then) | burn address | readonly | until the report's `createdAt` + 365 days | empty |
| `tolmol.action` | A device verified as an official of the shop's district (counted only then) | burn address | readonly | 365 days | empty |

### Why these flags and owners

- **readonly**: nobody can change a report's numbers after it is published, including its reporter.
  Tested: owner patch rejected with ReadOnlyEntity.
- **Transfer to the burn address in the same atomic batch as the create**: on Arkiv the owner
  can delete even a readonly entity (tested). A dealer could pressure a beneficiary to delete a
  report. After the transfer, nobody holds the key that can delete it. `$creator` still records
  who wrote it. Tested: reporter delete rejected with NotOwner, `createdBy(reporter)` still finds it.
- **permissionlessExtension**: any wallet can keep a report alive. Corroborating witnesses do this
  from their own devices. Tested: witness extensions succeed, owner and creator unchanged.
  **The reporter can opt out** ("let neighbours keep it longer" unticked). The report is then created without
  this flag, nobody can extend it (its owner is the burn address), and it expires on the date the reporter
  chose. Readers select `creationFlags`, so a witness's device knows not to try: the witness is still recorded,
  and the page says the lifetime is fixed.
- **Shops stay owned by the registry** so a mistaken synthetic shop can be deleted.
  Its numbers still cannot change (readonly).

## Attribute conventions

- Names are lowercase `snake_case`. The node rejects uppercase (friction F7).
- Every quantity is an integer in **grams** (`i32`). There are no floats and no kilograms in attributes.
- Percentages are integer **basis points** (`i32`, 0 to 10000).
- Wall-clock times are **milliseconds since epoch** as `u64`, **rounded down to the start of the UTC day**
  (since 2026-10-14; earlier entities carry the device's exact time). The exact moment is already public as the
  block, but a stored device clock added nothing except one more fingerprint. Ordering uses blocks.
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
| `item` | str | `rice` | one of `rice`, `wheat`, `millet`, or `total` (all grain together, used by Easy mode) |
| `entitled_g` | i32 | `25000` | 0 < x <= 100000 |
| `received_g` | i32 | `21000` | 0 <= x <= `entitled_g` |
| `shortfall_g` | i32 | `4000` | `entitled_g - received_g` |
| `shortfall_bp` | i32 | `1600` | `floor(shortfall_g * 10000 / entitled_g)` |
| `issues` | i32 | `65` | optional bitmask of what else went wrong, first 7 flags (table below). Absent = 0 |
| `issues2` | i32 | `5` | optional, since 2026-10-15, written only when non-zero: the further flags, shifted down by 7 (table below). Readers that only know `issues` still count the report |
| `reported_at` | u64 | `1791849600000` | start of the UTC day, ms. Display only. Ordering uses blocks |
| `synthetic` | bool | `true` | true for all seed and demo data |

That is 16 of the 30 allowed attributes. The payload is empty on purpose: **there is no
free-text field anywhere**, so nobody can type a name, phone number or ration card number into Arkiv.

The witness pseudo-ID is the device wallet, read from `$creator`. It is never copied into an attribute.

### `issues` bits

Fixed choices, tapped as big buttons in both modes. A number, never text, so nothing personal can be typed in.

| Bit | Value | Name | Shown as |
|---|---|---|---|
| 0 | 1 | `charged_money` | Asked to pay money (the grain is free) |
| 1 | 2 | `auth_failed` | Fingerprint or OTP failed, got nothing |
| 2 | 4 | `thumb_no_grain` | Thumbprint taken, but full grain not given |
| 3 | 8 | `shop_closed` | Shop was closed on ration day |
| 4 | 16 | `bad_quality` | Bad grain (stones, insects, wet) |
| 5 | 32 | `portability_refused` | Card from another place refused (One Nation One Ration Card) |
| 6 | 64 | `no_receipt` | No receipt or slip given |
| 7 | 128 (`issues2` 1) | `slip_mismatch` | The machine slip shows more grain than I got |
| 8 | 256 (`issues2` 2) | `no_weighing` | Grain was not weighed in front of me |
| 9 | 512 (`issues2` 4) | `tied_sale` | Made to buy other things (dal, salt, oil, soap) to get my ration |
| 10 | 1024 (`issues2` 8) | `card_kept` | The dealer kept my ration card |
| 11 | 2048 (`issues2` 16) | `no_board` | No board showing stock, price and timings |
| 12 | 4096 (`issues2` 32) | `told_lapsed` | Told my ration "lapsed" or did not come this month |
| 13 | 8192 (`issues2` 64) | `many_trips` | Had to come 3 or more times |
| 14 | 16384 (`issues2` 128) | `wrong_grain` | Given a different grain, or none of one grain |
| 15 | 32768 (`issues2` 256) | `threatened` | Scolded or threatened for asking |
| 16 | 65536 (`issues2` 512) | `member_left_out` | A family member's share was left out |

The report screens ask these as four short questions (grain; money or forced purchases; getting the ration; how the
dealer and shop treated you), one screen each in Easy mode and as headed groups in Full mode. Readers drop a report
whose `issues` or `issues2` is negative or has an unknown bit. Dashboards and shop pages show how many counted reports
flagged each issue; `slip_mismatch`, `tied_sale` (with `charged_money`) and `threatened` also count as evidence for the
"needs official attention" list. Why these matter: `docs/SOURCES.md` sections 6 to 9 and 13.

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
| `reported_at` | u64 | `1791849600000` | start of the UTC day, ms |
| `synthetic` | bool | `true` | |

A witness says "I also got less at this shop this month". It does not carry its own quantities.
If a witness wants to record their own numbers, they file their own `tolmol.report`.

## `tolmol.correction` (withdrawal)

A report cannot be edited or deleted, by anyone. But a reporter who made a mistake (wrong shop, wrong month, a
typo in the grams) needs a way to say so. A correction is a new, sealed entity that says "I withdraw this report".

| Attribute | Type | Example | Notes |
|---|---|---|---|
| `project` | str | `tolmol` | |
| `type` | str | `tolmol.correction` | |
| `schema_version` | i32 | `1` | |
| `report_key` | key | `0x612b...a7fd` | the report being withdrawn |
| `shop_id` | str | `SYN-BR-0042` | copied from the report, so shop pages can fetch corrections |
| `state` | str | `BR` | copied from the report, for the dashboard |
| `month` | str | `2026-10` | copied from the report |
| `action` | str | `withdraw` | the only action |
| `reported_at` | u64 | `1791849600000` | start of the UTC day, ms |
| `synthetic` | bool | `true` | |

- **Honoured only when its `$creator` equals the report's `$creator`.** Anyone can write a correction entity,
  but a dealer's wallet "withdrawing" someone else's report is ignored by every reader (`withdrawnKeys` in
  `packages/tolmol-sdk/src/rules.ts`). Trust by `$creator`, never by a field.
- The report itself stays on Arkiv, readable, with a "withdrawn by its reporter" tag. It is left out of
  dashboards, shop totals and the RTI and complaint letters, and evidence exports mark it `withdrawn = true`.
- Created readonly and handed to the burn address in the same batch, like a report, so a withdrawal cannot be
  undone either. It lives until the report's `createdAt` + 365 days, which outlasts any extension of the report.
- After withdrawing, the same device may file a corrected report for that shop, month and grain.

## `tolmol.verifier` and `tolmol.attestation` (verified card holders, simple version)

Fake device IDs are free, so Tolmol can mark reports from **verified card holders**. A verifier checks a ration card
once and publishes "this device is a verified card holder". In this demo the cards are **synthetic test cards** signed
by a test issuer key (`0x75a542B54Ab0E187e41b3644e47Ac546B7D1011f`), standing in for the state; in future the card would be the DigiLocker
ration card (`docs/VERIFIED_REPORTERS.md`). Verification is optional: unverified reports still count.

`tolmol.verifier` (created by the registry wallet; trusted only from it):

| Attribute | Type | Example | Notes |
|---|---|---|---|
| `project`, `type`, `schema_version` | | `tolmol`, `tolmol.verifier`, `1` | |
| `verifier` | str | `0x1c58335a9c5c5a3440f8018984cf9069b7c9408b` | the verifier wallet's address (lower case) |
| `synthetic` | bool | `true` | |

`tolmol.attestation` (created by a named verifier; counted only from one):

| Attribute | Type | Example | Notes |
|---|---|---|---|
| `project`, `type`, `schema_version` | | `tolmol`, `tolmol.attestation`, `1` | |
| `device` | str | `0x11fa…ae9c` | the verified device wallet (lower case) |
| `state` | str | `BR` | the card's state |
| `shop_id` | str | `SYN-BR-0003` | the card's (synthetic) shop |
| `card_tag` | key | `0x8c1e…` | HMAC-SHA256(verifier secret, card serial). The serial is random, not personal; without the secret nobody can link the tag to a card |
| `method` | str | `test_card` | `test_card` today; `camp` reserved for in-person verification |
| `role` | str | `card_holder` | `card_holder` (ration card), `dealer` (fair-price-shop licence, card type `FPS`) or `official` (official ID, card type `GOV`; jurisdiction = the district of `shop_id` in the registry). Absent on attestations before 2026-10-15 = `card_holder`. One device holds one role |
| `verified_on` | u64 | `1791936000000` | start of the UTC day, ms |
| `synthetic` | bool | `true` | |

**How the verifier works** (`apps/relayer/src/verifier.ts`, `POST /verify`): it checks the issuer's signature on the
card and a signature from the phone proving it controls `device`, then queries Arkiv for an attestation with the same
`card_tag` (`createdBy(verifier)`). If one exists for another device it refuses ("card already used"). Otherwise it
creates the attestation. Its "already used" memory **is Arkiv**: there is no verifier database.

**How readers decide who is verified** (`verifiedDevices` in `packages/tolmol-sdk/src/verify.ts`): trust attestations
only from a `verifier` named by a live registry entity; one device per `card_tag` (the earliest wins); one card per
device. Shop pages say how many counted reports come from verified card holders, reports and confirmations show
"✓ verified card holder", and the dashboard has a "count only verified" view.

## `tolmol.response` and `tolmol.followup` (shops answer, reporters confirm)

A community score card on Arkiv: the shop answers a report, the reporter says whether it was fixed. **No free text on
either side**: a dealer must not be able to write a name or a threat, and a reporter must not be able to type personal
details. Both are created readonly and transferred to `0x…dEaD` in the same batch, so neither side can take back what
it said. Both live until the report's `createdAt` + 365 days.

| Attribute | Type | Example | Notes |
|---|---|---|---|
| `project`, `type`, `schema_version` | | `tolmol`, `tolmol.response` / `tolmol.followup`, `1` | |
| `report_key` | key | `0xd775…` | the report answered |
| `shop_id`, `state`, `month` | str | `SYN-BR-0042`, `BR`, `2026-10` | copied from the report |
| `action` (response only) | str | `scale_checked` | one of `full_quantity`, `stock_arrived`, `scale_checked`, `open_as_displayed`, `board_updated`, `receipt_given`, `money_returned`, `auth_help`, `quality_replaced`, `portability_served`, `disputed`. Each matches a dealer duty under the TPDS (Control) Order 2015, cl. 10, or an issue tag (`docs/SOURCES.md` §10) |
| `status` (followup only) | str | `fixed` | `fixed` or `not_fixed` |
| `reported_at` | u64 | `1791936000000` | start of the UTC day, ms |
| `synthetic` | bool | `true` | |

## `tolmol.action` (officials act on the record)

What the department did about a shop, from a fixed list grounded in the TPDS (Control) Order 2015: cl. 10(7) (prompt
action, including suspending or cancelling the licence), cl. 11(1) (inspections at least once in three months) and
cl. 13 (punishment under section 7 of the Essential Commodities Act). Sealed (readonly + `0x…dEaD`), 365 days.

| Attribute | Type | Example | Notes |
|---|---|---|---|
| `project`, `type`, `schema_version` | | `tolmol`, `tolmol.action`, `1` | |
| `shop_id`, `state`, `district` | str | `SYN-BR-0042`, `BR`, `gaya` | the district must match the registry's district for the shop |
| `action` | str | `show_cause_notice` | one of `inspection_ordered`, `inspected_shortage_found`, `inspected_no_issue`, `show_cause_notice`, `licence_suspended`, `licence_cancelled`, `case_registered`, `grain_restored` |
| `reported_at` | u64 | `1791936000000` | start of the UTC day, ms |
| `synthetic` | bool | `true` | |

**Needs official attention** (`needsAttention` in `packages/tolmol-sdk/src/official.ts`), worked out by every reader
from public data: a shop is listed only with evidence of a problem (grain-weighted shortfall >= 20% over 3+ reports
from 2+ devices, money charged for free grain, or a reporter saying "not fixed"); confirmations, 3+ unanswered
shortfall reports and verified card holders add weight. Recording an action does not remove a shop from the list;
only better numbers do.

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
6. **A withdrawal counts only from the report's own creator** (see `tolmol.correction`). A withdrawn report
   is left out of rules 2 to 4 and no longer blocks rule 1 for its device.

7. **Patterns, not rules.** Readers also flag (never drop) reports filed by 3 or more different `$creator`s within
   30 blocks (one minute) at one shop, rapid confirmations, and devices that did nothing else (`patternSignals`).
   The dashboard can leave burst reports out as a view. All of it comes from public `createdAt` blocks and `$creator`.
8. **Verified card holders by `$creator`.** A device is verified only by an attestation whose `$creator` is a verifier
   named by a live `tolmol.verifier` from the registry; one device per card (earliest), one card per device.
9. **A shop's answer counts only from that shop's verified dealer** (`role = dealer`, same `shop_id`), once per
   (report, action), the earliest. 10. **"Fixed / not fixed" counts only from the report's own `$creator`**, latest wins.
   The score card counts "fixed" only from these confirmations, never from the dealer's claims.
11. **An official action counts only from a verified official of the shop's district** (`role = official`, the
   district of the ID's shop = the shop's district in the registry), once per (shop, action), the earliest.

These rules live in the app and the SDK package. Arkiv cannot enforce them, because anyone can
write any entity. The dashboard applies them when it reads, so a bypassing writer gains nothing.

## Entity Expiration and Lifetime Extension

Tiramisu blocks are 2 s, so 1 day = 43,200 blocks. Durations use whole days only.

| Type | Lifetime | Why |
|---|---|---|
| `tolmol.shop` | 180 days, any wallet can extend | the registry outlives the reports that point to it |
| `tolmol.report` | **the reporter's choice: 30, 90 (default) or 180 days** | 90 days is long enough to file a complaint or RTI about last month's ration (RTI replies are due in 30 days). A reporter who wants less exposure can pick 30; one building a longer case can pick 180 |
| `tolmol.witness` | same deadline as its report | a corroboration means nothing without its report |
| `tolmol.correction` | until report `createdAt` + 365 days | must outlive the report, whatever extensions it got |
| `tolmol.verifier` | 180 days, extended by the registry | letting it lapse revokes the verifier everywhere, with no delete and no server |
| `tolmol.attestation` | 365 days | a card holder re-verifies once a year |
| `tolmol.response`, `tolmol.followup` | until report `createdAt` + 365 days | outlive the report they are about |
| `tolmol.action` | 365 days | a year of a shop's enforcement history |

**Corroboration renews the lease.** When a witness corroborates a report that will then have
**2 or more distinct witnesses**, the witness's device sends one atomic batch:

1. create its `tolmol.witness` (readonly, permissionlessExtension);
2. transfer it to the burn address;
3. extend the report to `max(current, head + 180 days)`, capped at `report.createdAt + 365 days`;
4. extend each existing live witness of that report to the same deadline.

With fewer than 2 witnesses, or when the reporter opted out of extension, only steps 1 and 2 run, and the
witness gets the report's current deadline.

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
| Q10 | Shop page: withdrawals | `project AND type = "tolmol.correction" AND shop_id = <id> [AND month = <m>]` |
| Q11 | Dashboard: withdrawals | `project AND type = "tolmol.correction" AND state = <s>` |
| Q12 | Report page: is it withdrawn? | `project AND type = "tolmol.correction" AND report_key = key(<k>)` |
| Q13 | Trusted verifiers | `project AND type = "tolmol.verifier"`, `.createdBy(REGISTRY)` |
| Q14 | Verified devices | `project AND type = "tolmol.attestation"` (one per verified phone), then `verifiedDevices` on the device |
| Q15 | Verifier: card already used? | `project AND type = "tolmol.attestation" AND card_tag = key(<tag>)`, `.createdBy(verifier)` |
| Q16 | Report page: the shop's answers and the reporter's word | `project AND type = "tolmol.response" AND report_key = key(<k>)`, and the same for `tolmol.followup` |
| Q17 | Shop score card | `project AND type = "tolmol.response" AND shop_id = <id>`, and the same for `tolmol.followup` |
| Q19 | Shop page: official actions | `project AND type = "tolmol.action" AND shop_id = <id>` |
| Q20 | Dashboard: official actions, attention list | `project AND type = "tolmol.action" AND state = <s>` |
| Q18 | Dashboard answered / fixed | `project AND type = "tolmol.response" AND state = <s>`, and the same for `tolmol.followup` |

Fields selected: `key`, `creator`, `owner`, `createdAt`, `expiresAt`, `creationFlags`, `attributes` (never the
payload for reports, which is empty anyway). Shop and dashboard pages have a "How this is computed" panel that
prints the exact query strings they ran.

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
| The ration card used for verification, and its serial | Only `card_tag`, a keyed fingerprint of a random serial, goes on Arkiv. The card is checked by the verifier and never stored anywhere |
| Free text of any kind | Free text invites personal details. Every field is a number or a fixed choice |
| Photos of receipts, weighing scales or shops | Too large (the public RPC caps requests at 262,144 bytes), and photos identify people and places |
| Household size and card type | They would make reports easier to link to a household. The device uses them only to compute `entitled_g` |
| The exact time of a report | `reported_at` is rounded to the day. The block time is public anyway, but we add no extra clock |
| What went wrong, in words | Only a 7-bit number (`issues`). No text box, so no names or phone numbers can slip in |
| Device private keys | Kept in the browser's local storage on that device only, never sent anywhere |
| Reports waiting for a connection | The offline queue holds shop, month, grain and grams in the browser's local storage until there is signal; only then are they signed and written |
| Name and address on an RTI application | The "Draft my RTI" letter leaves them as blanks to fill in by hand; they never reach Tolmol or Arkiv |
| Rate-limit counters and IP addresses for the gas top-up | Operational data about real people. Kept in the relayer's short-lived store, never on chain |
| Aggregates (dashboard rankings, percentages per district) | Derived data. Anyone can recompute it from the raw entities, so storing it would only add a second, trustable copy |
| Real shop registries and beneficiary lists | Out of scope by design. Tolmol uses a synthetic registry |

## Wallets

See `arkiv/wallets.md`. In short:
- the registry wallet creates every `tolmol.shop`;
- each device wallet creates its own reports and witnesses. Judges can list them by querying
  `type = "tolmol.report"` and reading `creator`;
- the relayer wallet only sends small GLM top-ups. It never creates Tolmol entities.

## Privacy audit

`node --import tsx scripts/privacy-audit.ts` (read-only, no keys) fetches every entity tagged `project = "tolmol"`
on Tiramisu and checks each one against this contract: only the attributes listed above, each value in its
allowed format (synthetic `SYN-` shop IDs, `YYYY-MM` months, two-letter states, lowercase district slugs, grams in
range, `issues` within 7 bits), and an empty payload for reports, witnesses and corrections (shops: exactly
`label_en`, `label_hi`, `synthetic`). Last result: see `arkiv/friction.md` ("Tested paths"). Entities of type
`tolmol.test` come from the friction experiments, are synthetic, and are listed separately.
