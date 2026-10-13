# Decisions

| Date (UTC) | Decision | Why |
|---|---|---|
| 2026-10-13 | **One wallet per device, held in the browser.** Each device generates its own local keypair (brief section 3.3). Reports and witness entries are signed in the browser, so `$creator` is that device's wallet. | Per-witness dedupe and the "witness must differ from the reporter" check both rely on distinct `$creator` values. One server wallet would make every creator the same and break them. It would also fail the Security track's creator test. |
| 2026-10-13 | **No server wallet writes entities.** A funding (relayer) endpoint may exist, but it may only send small amounts of testnet GLM to device wallets. | Keeps authorship on chain with the user's device, while users without GLM can still write. |
| 2026-10-13 | Seed and test wallets: Reporter, Witness A and Witness B (see `arkiv/wallets.md`). The builder funds them from the Hub faucet. | Lets us test witness corroboration and who can extend a report with real, distinct creators. |

## Resolved by on-chain tests (2026-10-13)

- **A drip endpoint is possible.** Plain GLM transfers between wallets succeed (21000 gas),
  despite the fundamentals page. See friction F4.
- **Reports should be created with `readonly` and `permissionlessExtension`.** Then nobody,
  including the reporter, can edit a report, while any witness can keep it alive. Tested
  with Witness A and Witness B (see the extend-permission test in `arkiv/friction.md`).
- **Count witnesses from `tolmol.witness` entities by `$creator`, not from extension events.**
  The `ExpiryExtended` event reports the owner, not the wallet that extended.
