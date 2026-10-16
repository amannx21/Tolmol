# Changelog

The data contract is `arkiv/schema.md` (and `docs/data-contract.schema.json`) in the repository. Every change below is
**additive**: a reader built for an earlier version keeps reading exactly what it read before, and drops what it does
not know instead of misreading it.

## 0.2.0 (2026-10-16)

### Data contract (new entity types and attributes, all optional for older readers)
- `tolmol.officekey`, `tolmol.note` (the only payload Tolmol fills: an encryption envelope) and `tolmol.fullshare`.
- `tolmol.outlet`: schools (`scheme = mdm`, school meals) and gram panchayats (`scheme = nrega`, MGNREGA wages), from
  the same registry wallet. A separate type, so `listShops` (ration shops) never returns a school.
- `tolmol.report` for another scheme: `scheme` attribute, items `meal_days` (school days) and `wage_inr` (rupees), the
  scheme's own issue flags. Ration reports are byte-for-byte unchanged. Older readers drop the new reports because
  they do not know the items.
- `tolmol.stock`: the dealer's sealed monthly stock board.
- `tolmol.delegation`: a district official sends an inspector to one outlet for 1 to 30 days.
- Response actions for schools and panchayats; official action `dues_restored`; card types `SCH` (head teacher) and
  `GPO` (panchayat employment assistant), both giving the `dealer` (outlet operator) role.

### Library
- `notes.ts`: private notes to the district official. `tolmol.officekey` (an official's public key; counts only if it
  hashes to `$creator` and the official is of that district: `validOfficeKeys`) and `tolmol.note` (ECIES on secp256k1,
  HKDF-SHA256, AES-256-GCM, bound to the report and the official; sealed; counts only from the report's own creator:
  `validNotes`). `encryptNote`, `decryptNote`, `publishOfficeKey`, `sendNote`, queries Q26 to Q28. Uses the audited
  `@noble` libraries viem is built on (now explicit dependencies).
- `fullshare.ts`: "I got my full share this month" (`tolmol.fullshare`, once per device, outlet and month, sealed),
  `sayFullShare`, `shopFullShares` (Q29) and `fullShareContext`, which labels an unconfirmed report contradicted when
  `CONTRADICT_MIN` (3) other devices got their full share. The report is never hidden.
- `trackRecord.ts`: who checks the checkers. `trackRecords` sets every counted official or inspector finding
  against the reports at that outlet in the next `AFTER_DAYS` (60) days; `isContradicted` flags a clearing finding
  (`CLEARING_ACTIONS`: no issue found, grain or dues restored) followed by attention-list evidence. Nothing is stored.
- `proof.ts`: `PROOF_MAX_AGE_S` is now one hour (was 15 minutes), so a proof can travel through a representative
  when the reporter does not come to the hearing.
- `schemes.ts`: `SCHEMES`, `ITEM_INFO` (scheme, unit, maximum per item), `SCHEME_ISSUES`, `SCHEME_ISSUE_GROUPS`,
  `formatAmount`, `forScheme`.
- `queries.ts`: `listOutlets` (one `OR` query over both registry types).
- `records.ts`: `outletRecord` and `stateRecord` (Q30, Q31): everything about an outlet or a state in one query, each
  record routed by its `type` to its own parser (`recordsWhere`). Same records as the per-type queries, far fewer reads.
- `stock.ts`: boards (`postStockBoard`, `shopStocks`, `stateStocks`, `validStocks`, `boardForMonth`,
  `leakageEstimate`, `boardMissing`) and two verdicts every reader computes the same way: `fairShop` and `shopVerdict`.
- `proof.ts`: `makeProof` / `checkProof`: a report's creator proves authorship in person; nothing is written.
- `delegation.ts`: `delegateInspector`, `shopDelegations`, `stateDelegations`; `validOfficialActions` accepts
  delegations and counts an inspector's findings only for the delegated outlet, inside the window, from an official
  of that district.
- `metered.ts`: `meteredTransport`, `localStore`, `memoryStore`, `curlFor` (see the README).
- `official.ts`: attention reasons `records_mismatch` and `discrimination` for the new schemes.
- CLI: `tolmol outlets`; `tolmol answers --shop`; amounts printed in each item's unit. Writes without any Tolmol
  server: `tolmol key` (a key on this computer, never printed), `tolmol submit` (a report) and `tolmol confirm` (a
  confirmation), with gas from the public faucet.

## 0.1.0 (2026-10-15)

First release: ration reports, witnesses, withdrawals, verification (registry, verifiers, attestations), dealer
answers and reporter follow-ups, official actions, evidence export, live events, CLI.
