# Changelog

The data contract is `arkiv/schema.md` (and `docs/data-contract.schema.json`) in the repository. Every change below is
**additive**: a reader built for an earlier version keeps reading exactly what it read before, and drops what it does
not know instead of misreading it.

## 0.2.0 (2026-10-16)

### Data contract (new entity types and attributes, all optional for older readers)
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
- `schemes.ts`: `SCHEMES`, `ITEM_INFO` (scheme, unit, maximum per item), `SCHEME_ISSUES`, `SCHEME_ISSUE_GROUPS`,
  `formatAmount`, `forScheme`.
- `queries.ts`: `listOutlets` (one `OR` query over both registry types).
- `stock.ts`: boards (`postStockBoard`, `shopStocks`, `stateStocks`, `validStocks`, `boardForMonth`,
  `leakageEstimate`, `boardMissing`) and two verdicts every reader computes the same way: `fairShop` and `shopVerdict`.
- `proof.ts`: `makeProof` / `checkProof`: a report's creator proves authorship in person; nothing is written.
- `delegation.ts`: `delegateInspector`, `shopDelegations`, `stateDelegations`; `validOfficialActions` accepts
  delegations and counts an inspector's findings only for the delegated outlet, inside the window, from an official
  of that district.
- `metered.ts`: `meteredTransport`, `localStore`, `memoryStore`, `curlFor` (see the README).
- `official.ts`: attention reasons `records_mismatch` and `discrimination` for the new schemes.
- CLI: `tolmol outlets`; `tolmol answers --shop`; amounts printed in each item's unit.

## 0.1.0 (2026-10-15)

First release: ration reports, witnesses, withdrawals, verification (registry, verifiers, attestations), dealer
answers and reporter follow-ups, official actions, evidence export, live events, CLI.
