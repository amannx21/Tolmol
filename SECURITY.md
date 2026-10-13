# Security

Tolmol is a hackathon project on the **Arkiv Tiramisu testnet**. It handles no real money and, by design,
no personal data. Please still report problems.

## Reporting a vulnerability

Open a GitHub issue titled "security" **without** exploit details, and we will contact you, or email the
maintainer listed on the GitHub profile `amannx21`. Please do not post private keys or working exploits publicly.

## What we protect

- **No secrets in the repo or on Arkiv.** Keys live only in a git-ignored `.env` (scripts) or in the browser's
  local storage (device keys). A pre-commit hook (`scripts/check-secrets.mjs`) compares staged files against the
  real local keys, and CI runs gitleaks.
- **No personal data on Arkiv.** Reports carry only shop ID, month, grain, entitled and received grams. Inputs with
  any other field, free text or non-synthetic shop IDs are rejected by `validateReportInput`.
- **Tamper evidence.** Reports and witnesses are created `readonly` and handed to `0x...dEaD` in the same atomic
  transaction, so nobody can edit or delete them. Authorship is the immutable `$creator`.
- **Relayer abuse.** The gas-drip relayer only sends small amounts of test GLM to fresh wallets, with per-IP and
  daily limits. It never signs Tolmol data.

What is *not* solved (sybil wallets, collusion, a dishonest reporter) is listed in `docs/THREAT_MODEL.md`.
