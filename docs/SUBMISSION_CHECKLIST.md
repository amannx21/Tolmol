# Submission checklist: Tolmol

Built from the rules repo at commit `7eb4e1cafe65892e7f52b2b33fe362357327aa90`.
Deadline: **18 Oct 2026 23:59 London = 22:59 UTC.** Keep the deployment up until **23 Oct 18:00**.

## Gates (any failure means the entry is not scored)

- [ ] Public deployment, connected to Tiramisu, judges can open it with no login and no access request
- [ ] Deployment stays up until at least 23 Oct 2026
- [ ] README has reproducible setup steps
- [ ] README has the **exact query** (and steps) that produce each claim in the submission
- [ ] Repo is public
- [x] Repo has the MIT `LICENSE`
- [ ] `/arkiv/schema.md` at repo root: entity types, attributes, expiration per type, the queries the app runs
- [ ] `/arkiv/friction.md` at repo root: per surface, expected vs actual, versions, repro steps
- [ ] Wallet addresses that create entities on Tiramisu, with roles: in README and `/arkiv/wallets.md`
- [ ] Judges can find the entities and creation transactions from those addresses on the explorer
- [ ] Evidence survives expiry: entity lifetimes outlast 23 Oct, **and** creation tx hashes are listed in the README in case they do not
- [ ] Demo video, 3 minutes or less, publicly viewable
- [ ] At least one track chosen on Devfolio (we pick Best Indian Use Case, Censorship Resistance, Security, Open Source)
- [ ] Every required Devfolio question answered (list below)
- [ ] All work built 9 to 18 Oct 2026. Pre-existing work section says "None" with baseline SHA `0902494101780b4516ca7563466030f0ac363dbe` (GitHub-generated LICENSE and .gitignore only)

## Disqualifier checks (re-run before submitting)

- [ ] The app queries Arkiv for real: every screen's data comes from an Arkiv query
- [ ] Arkiv is the primary data layer. No Postgres or other database behind it
- [ ] No private key, seed phrase, access key or secret in any Arkiv entity, in the repo, or in git history
- [ ] `.env` never committed (`git log --all -- .env` is empty)
- [ ] No real personal data in Arkiv, plaintext or hashed: no names, phones, Aadhaar, ration card numbers, photos, free text
- [ ] All shop IDs synthetic (`SYN-...`) and labelled synthetic in the UI, README and schema.md
- [ ] Seed and demo data labelled synthetic
- [ ] No plagiarised code. Third-party libraries credited
- [ ] No malicious code or deliberate vulnerabilities
- [ ] Submitted before 22:59 UTC on 18 Oct

## Devfolio project form

Standard fields:

- [ ] Project name
- [ ] Tagline
- [ ] Project media
- [ ] Repo link
- [ ] Demo video link (3 min or less)
- [ ] Builders
- [ ] **The problem it solves** \*
- [ ] **Challenges I ran into** \*
- [ ] Tracks: Best Indian Use Case, Censorship Resistance, Security, Open Source

Organiser questions (answers private to judges):

- [ ] 1. Live app URL \*
- [ ] 2. Does any team member hold Indian nationality? \* (Yes: AMAN ARORA)
- [ ] 3. Why Arkiv? \*
- [ ] 4. How do you use Arkiv? \* Per feature: how, why, and a link to the code
- [ ] 5. GitHub link to `/arkiv/friction.md` \*
- [ ] 6. Wallet addresses that create entities, each with its role \*
- [ ] 7. GitHub link to `/arkiv/schema.md` \*
- [ ] 8. How judges can reproduce our Arkiv usage, step by step \*
- [ ] 9. Pre-existing work reused \* ("None" plus baseline SHA)
- [ ] 10. Arkiv surfaces used \* (TypeScript SDK, WebSocket events, Docs, Hub, Faucet, Block Explorer, Arkiv skills, plus whatever else we actually use)
- [ ] 11. "Other" surface, if selected
- [ ] 12. Time to first Arkiv entity \* (from `docs/BASELINE.md`)
- [ ] 13. LLMs used \* (Claude via Claude Code)
- [ ] 14. One thing Arkiv should improve first \*
- [ ] 15. Open to a 20-minute feedback call? \*
- [ ] 16. Confirm: our work, built 9 to 18 Oct, pre-existing work disclosed \*
- [ ] 17. Confirm: repo public under MIT and every link accessible \*
- [ ] 18. Plan to attend Devcon 8 (optional)

Never paste private keys, seed phrases, access-key secrets or credentialed RPC URLs into any answer.

## Registration (each person, before submitting)

- [ ] Registered on Devfolio with Telegram handle
- [ ] Indian nationality declared
- [ ] USDC payout wallet (any EVM address, can differ from app wallets)
- [ ] KYC acknowledgement and contact consent

## At and after the deadline

- [ ] Final commit pushed before 22:59 UTC on 18 Oct
- [ ] Final commit tagged `submission-v1` and the tag pushed
- [ ] After submitting: **no force-push, rebase or amend** on the judged branch
- [ ] Deployment still up on 23 Oct
